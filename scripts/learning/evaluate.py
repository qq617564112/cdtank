"""Measure frozen policies on separate curriculum seeds and save actual rollouts."""

import argparse
import json
from pathlib import Path
import random

import numpy as np
import torch

from train_combat import Environment, Policy, tensors
from gpu_budget import GpuBudget


def main(args):
    output = Path(args.output)
    output.mkdir(parents=True, exist_ok=False)
    torch.set_num_threads(2)
    random.seed(args.seed)
    np.random.seed(args.seed)
    torch.manual_seed(args.seed)
    checkpoint = torch.load(args.checkpoint, map_location="cuda")
    (output / "config.json").write_text(json.dumps(vars(args), indent=2), encoding="utf-8")
    environment = Environment(args, 0)
    budget = GpuBudget(args.gpu_utilization_limit, output)
    episodes = []
    try:
        first = environment.reset()
        source = Path(__file__).resolve().parents[2] / "source.json"
        config = {**vars(args), "checkpointSteps": checkpoint["steps"],
                  "checkpointSource": checkpoint.get("config", {}).get("source"),
                  "checkpointSimulationSource": checkpoint.get("config", {}).get("simulationSource"),
                  "trainerSource": json.loads(source.read_text(encoding="utf-8")) if source.exists() else None,
                  "simulationSource": environment.source,
                  "observationWidth": len(first["frames"][0]["observation"]),
                  "observationSchema": first["frames"][0]["schema"],
                  "torch": torch.__version__, "device": torch.cuda.get_device_name(0)}
        (output / "config.json").write_text(json.dumps(config, indent=2), encoding="utf-8")
        policy = Policy(len(first["frames"][0]["observation"]), budget).cuda().eval()
        policy.initialize(checkpoint["policy"])
        with (output / "episodes.jsonl").open("x", encoding="utf-8") as log:
            for episode in range(args.episodes):
                result = first if episode == 0 else environment.reset()
                hidden = torch.zeros(1, 64, device="cuda")
                reset = torch.ones(1, device="cuda")
                total = 0
                trajectory = []
                for tick in range(1000):
                    observation, masks = tensors([result], "cuda")
                    with torch.no_grad():
                        distributions, _, hidden = policy(observation, hidden, reset, masks)
                        chosen = [dist.sample() if args.stochastic else dist.logits.argmax(dim=-1)
                                  for dist in distributions]
                        action = torch.stack(chosen, dim=-1)[0].tolist()
                    before = result["frames"][0]
                    result = environment.step(action)
                    frame = result["frames"][0]
                    reset = torch.tensor([float(frame["metrics"]["deaths"] != before["metrics"]["deaths"])], device="cuda")
                    total += result["rewards"][0]
                    if tick % 10 == 0 or result["done"]:
                        trajectory.append({"tick": tick, "action": action,
                                           "position": frame["memory"],
                                           "goalDistance": result.get("goalDistance"),
                                           "observation": frame["observation"]})
                    if result["done"]:
                        break
                row = {"episode": episode, "seed": result["seed"], "steps": tick + 1,
                       "lesson": result["lesson"], "level": result["level"],
                       "return": total, "success": result.get("success"),
                       "metrics": frame["metrics"], "lessonMetrics": result.get("lessonMetrics"),
                       "trajectory": trajectory}
                episodes.append(row)
                log.write(json.dumps(row) + "\n")
                log.flush()
        summary = {"episodes": len(episodes), "successRate": np.mean([bool(row["success"]) for row in episodes]),
                   "returnMean": np.mean([row["return"] for row in episodes]),
                   "stepsMean": np.mean([row["steps"] for row in episodes]),
                   "itemUsesMean": np.mean([row["lessonMetrics"].get("consumedItems", 0) for row in episodes]),
                   "healedHpMean": np.mean([row["lessonMetrics"].get("healedHp", 0) for row in episodes]),
                   "damageTakenMean": np.mean([row["metrics"]["damageTaken"] for row in episodes]),
                   "finalHpMean": np.mean([row["metrics"]["hp"] for row in episodes]),
                   "checkpointSteps": checkpoint["steps"], "readyForGameplay": False}
        (output / "result.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
        print(json.dumps(summary), flush=True)
    finally:
        environment.close()
        budget.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--environment-url", required=True)
    parser.add_argument("--checkpoint", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--episodes", type=int, default=32)
    parser.add_argument("--lesson", choices=["turning", "navigation", "aiming", "shooting", "dodge", "range", "items", "combat"], default="navigation")
    parser.add_argument("--level", type=int, default=1)
    parser.add_argument("--mix-levels", action="store_true")
    parser.add_argument("--mode", type=int, default=4)
    parser.add_argument("--map-id", type=int, default=7)
    parser.add_argument("--players", type=int, default=2)
    parser.add_argument("--ammo-id", type=int, default=2001)
    parser.add_argument("--items", type=json.loads, help="Use [] to measure the same policy without consumables")
    parser.add_argument("--seed", type=int, default=100000179)
    parser.add_argument("--stochastic", action="store_true")
    parser.add_argument("--gpu-utilization-limit", type=int, default=80)
    main(parser.parse_args())
