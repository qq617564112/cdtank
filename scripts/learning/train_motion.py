"""Warm-start a recurrent motion policy from sparse human-labelled history."""

import argparse
import gzip
import json
import math
from pathlib import Path
import random
import time

import numpy as np
import torch
from torch import nn
from torch.nn import functional as F


FEATURES = ["yawSin", "yawCos", "bodyYawSin", "bodyYawCos", "aimSin", "aimCos",
            "hp1000", "disguised", "previousMove", "previousTurn", "previousAim",
            "previousFire", "localDx100", "localDz100", "dy100", "hasPreviousPose"]


def observation(tank, previous):
    yaw = tank["yaw"]
    body = tank.get("bodyYaw", yaw)
    aim = tank["aim"]
    command = tank["input"]
    dx = tank["x"] - previous["x"] if previous else 0
    dz = tank["z"] - previous["z"] if previous else 0
    dy = tank["y"] - previous["y"] if previous else 0
    return [math.sin(yaw), math.cos(yaw), math.sin(body), math.cos(body),
            math.sin(aim), math.cos(aim), tank["hp"] / 1000,
            float(tank.get("disguised", False)), command["move"], command["turn"],
            command["aim"], float(command["fire"]),
            (dx * math.cos(yaw) - dz * math.sin(yaw)) / 100,
            (dx * math.sin(yaw) + dz * math.cos(yaw)) / 100, dy / 100,
            float(previous is not None)]


def action(tank):
    return [0 if tank["input"][key] < -.25 else 2 if tank["input"][key] > .25 else 1
            for key in ("move", "turn", "aim")]


class MotionPolicy(nn.Module):
    def __init__(self):
        super().__init__()
        self.encoder = nn.Sequential(nn.Linear(len(FEATURES), 64), nn.Tanh())
        self.memory = nn.GRU(64, 64, batch_first=True)
        self.actor = nn.Linear(64, 9)

    def forward(self, observations, hidden=None):
        states, hidden = self.memory(self.encoder(observations), hidden)
        return self.actor(states).reshape(*states.shape[:2], 3, 3), hidden


def trajectories(path):
    frames = {}
    summary = None
    with gzip.open(path, "rt", encoding="utf-8") as source:
        for line in source:
            row = json.loads(line)
            if row["type"] == "summary":
                summary = row
            if row["type"] != "frame":
                continue
            for tank in row["tanks"]:
                key = (row["matchId"], row["session"], row["round"], tank["id"])
                frames.setdefault(key, []).append((row["at"], tank))
    if summary is None:
        raise ValueError('The history export is incomplete: missing summary')
    episodes = []
    for key, values in frames.items():
        values.sort(key=lambda value: value[0])
        observations, actions, baseline = [], [], []
        previous = None
        for index, (at, tank) in enumerate(values[:-1]):
            next_at, future = values[index + 1]
            valid = (tank["control"] == future["control"] == "HUMAN"
                     and tank["alive"] and future["alive"]
                     and tank["deaths"] == future["deaths"]
                     and 350 <= next_at - at <= 750)
            if not valid:
                if observations:
                    episodes.append((key[0], observations, actions, baseline))
                observations, actions, baseline, previous = [], [], [], None
                continue
            observations.append(observation(tank, previous))
            actions.append(action(future))
            baseline.append(action(tank))
            previous = tank
        if observations:
            episodes.append((key[0], observations, actions, baseline))
    return episodes, summary


def batches(episodes, device, length=16):
    windows = []
    for _, observations, actions, baseline in episodes:
        for start in range(0, len(observations), length):
            end = min(start + length, len(observations))
            count = end - start
            if count < 4:
                continue
            x = np.zeros((length, len(FEATURES)), dtype=np.float32)
            y = np.ones((length, 3), dtype=np.int64)
            b = np.ones((length, 3), dtype=np.int64)
            mask = np.arange(length) < count
            x[:count], y[:count], b[:count] = observations[start:end], actions[start:end], baseline[start:end]
            windows.append((x, y, b, mask))
    if not windows:
        raise ValueError("No usable continuous human-labelled trajectory windows")
    return tuple(torch.as_tensor(np.stack(values), device=device) for values in zip(*windows))


def metrics(policy, data):
    x, y, baseline, mask = data
    with torch.no_grad():
        logits, _ = policy(x)
        loss = F.cross_entropy(logits[mask].reshape(-1, 3), y[mask].reshape(-1))
        correct = (logits.argmax(-1) == y)[mask].float().mean(0).tolist()
        persistence = (baseline == y)[mask].float().mean(0).tolist()
    return {"loss": loss.item(), "accuracy": correct, "persistenceAccuracy": persistence,
            "commands": int(mask.sum().item())}


def main(args):
    random.seed(args.seed)
    np.random.seed(args.seed)
    torch.manual_seed(args.seed)
    torch.set_num_threads(2)
    if not torch.cuda.is_available():
        raise RuntimeError("CUDA is required for this training run")
    device = torch.device("cuda")
    torch.backends.cudnn.deterministic = True
    torch.backends.cudnn.benchmark = False
    output = Path(args.output)
    output.mkdir(parents=True, exist_ok=False)
    episodes, summary = trajectories(args.data)
    match_ids = sorted({episode[0] for episode in episodes})
    if len(match_ids) < 3:
        raise ValueError("At least three separate settled human-labelled matches are required")
    random.shuffle(match_ids)
    validation_ids = set(match_ids[:max(1, len(match_ids) // 5)])
    training = [e for e in episodes if e[0] not in validation_ids]
    validation = [e for e in episodes if e[0] in validation_ids]
    train = batches(training, device)
    valid = batches(validation, device)
    policy = MotionPolicy().to(device)
    optimizer = torch.optim.Adam(policy.parameters(), lr=args.learning_rate)
    config = {**vars(args), "features": FEATURES, "device": torch.cuda.get_device_name(0),
              "torch": torch.__version__, "trainingMatches": sorted(set(match_ids) - validation_ids),
              "validationMatches": sorted(validation_ids), "sourceSummary": summary,
              "cadenceMs": 500, "target": "next sampled movement commands",
              "stage": "sparse human-labelled motion prior", "actionHeads": ["move", "turn", "aim"]}
    (output / "config.json").write_text(json.dumps(config, indent=2), encoding="utf-8")
    best_loss = math.inf
    best_epoch = 0
    started = time.monotonic()
    with (output / "metrics.jsonl").open("x", encoding="utf-8") as log:
        for epoch in range(1, args.epochs + 1):
            policy.train()
            order = torch.randperm(len(train[0]), device=device)
            for indices in order.split(args.batch_size):
                x, y, _, mask = (values[indices] for values in train)
                logits, _ = policy(x)
                loss = F.cross_entropy(logits[mask].reshape(-1, 3), y[mask].reshape(-1))
                optimizer.zero_grad()
                loss.backward()
                nn.utils.clip_grad_norm_(policy.parameters(), .5)
                optimizer.step()
            policy.eval()
            row = {"epoch": epoch, "seconds": time.monotonic() - started,
                   "train": metrics(policy, train), "validation": metrics(policy, valid)}
            line = json.dumps(row)
            print(line, flush=True)
            log.write(line + "\n")
            log.flush()
            checkpoint = {"policy": policy.state_dict(), "optimizer": optimizer.state_dict(),
                          "epoch": epoch, "config": config, "metrics": row}
            torch.save(checkpoint, output / "latest.pt")
            if row["validation"]["loss"] < best_loss:
                best_loss = row["validation"]["loss"]
                best_epoch = epoch
                torch.save(checkpoint, output / "best.pt")
            if epoch - best_epoch >= args.patience:
                break
    result = {"completedEpochs": epoch, "bestEpoch": best_epoch, "bestValidationLoss": best_loss,
              "elapsedSeconds": time.monotonic() - started,
              "checkpoint": str(output / "best.pt"), "readyForGameplay": False,
              "stage": "motion prior; combat and human-origin validation remain required"}
    (output / "result.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
    print(json.dumps(result), flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--epochs", type=int, default=100)
    parser.add_argument("--patience", type=int, default=15)
    parser.add_argument("--batch-size", type=int, default=64)
    parser.add_argument("--learning-rate", type=float, default=.0003)
    parser.add_argument("--seed", type=int, default=179)
    main(parser.parse_args())
