"""Measure frozen policies on separate curriculum seeds and save actual rollouts."""

import argparse
from concurrent.futures import ThreadPoolExecutor
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
    budget = GpuBudget(args.gpu_utilization_limit, output)
    episodes = []
    environments = []
    try:
        count = min(args.environments, args.episodes)
        for number in range(count):
            environments.append(Environment(args, number))
        with ThreadPoolExecutor(max_workers=count) as pool:
            initial = list(pool.map(lambda number: environments[number].reset(args.seed + number), range(count)))
            source = Path(__file__).resolve().parents[2] / "source.json"
            config = {**vars(args), "checkpointSteps": checkpoint["steps"],
                      "checkpointSource": checkpoint.get("config", {}).get("source"),
                      "checkpointSimulationSource": checkpoint.get("config", {}).get("simulationSource"),
                      "trainerSource": json.loads(source.read_text(encoding="utf-8")) if source.exists() else None,
                      "simulationSource": environments[0].source,
                      "observationWidth": len(initial[0]["frames"][0]["observation"]),
                      "observationSchema": initial[0]["frames"][0]["schema"],
                      "torch": torch.__version__, "device": torch.cuda.get_device_name(0)}
            (output / "config.json").write_text(json.dumps(config, indent=2), encoding="utf-8")
            policy = Policy(config["observationWidth"], budget).cuda().eval()
            policy.initialize(checkpoint["policy"])
            running = [episode_slot(env, number, result) for number, (env, result)
                       in enumerate(zip(environments, initial))]
            next_episode = count
            with (output / "episodes.jsonl").open("x", encoding="utf-8") as log:
                while running:
                    observation, masks = tensors([slot["result"] for slot in running], "cuda")
                    hidden = torch.stack([slot["hidden"] for slot in running])
                    reset = torch.tensor([slot["reset"] for slot in running], device="cuda")
                    with torch.no_grad():
                        distributions, _, hidden = policy(observation, hidden, reset, masks)
                        chosen = [dist.sample() if args.stochastic else dist.logits.argmax(dim=-1)
                                  for dist in distributions]
                        actions = torch.stack(chosen, dim=-1).tolist()
                    advanced = list(pool.map(lambda pair: pair[0]["environment"].step(pair[1]), zip(running, actions)))
                    remaining = []
                    for index, (slot, result, action) in enumerate(zip(running, advanced, actions)):
                        before = slot["result"]["frames"][0]
                        frame = result["frames"][0]
                        tick = slot["tick"]
                        slot["return"] += result["rewards"][0]
                        if tick % 10 == 0 or result["done"]:
                            slot["trajectory"].append({"tick": tick, "action": action,
                                "position": frame["memory"], "goalDistance": result.get("goalDistance"),
                                "observation": frame["observation"]})
                        if result["done"] or tick >= 999:
                            row = {"episode": slot["episode"], "seed": result["seed"], "steps": tick + 1,
                                   "lesson": result["lesson"], "level": result["level"],
                                   "return": slot["return"], "success": result.get("success"),
                                   "metrics": frame["metrics"], "lessonMetrics": result.get("lessonMetrics"),
                                   "trajectory": slot["trajectory"]}
                            episodes.append(row)
                            log.write(json.dumps(row) + "\n")
                            log.flush()
                            if next_episode < args.episodes:
                                reset_result = slot["environment"].reset(args.seed + next_episode)
                                remaining.append(episode_slot(slot["environment"], next_episode, reset_result))
                                next_episode += 1
                            else:
                                slot["environment"].close()
                        else:
                            slot.update(result=result, hidden=hidden[index], tick=tick + 1,
                                        reset=float(frame["metrics"]["deaths"] != before["metrics"]["deaths"]))
                            remaining.append(slot)
                    running = remaining
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
        return summary
    finally:
        for environment in environments:
            environment.close()
        budget.close()


def episode_slot(environment, episode, result):
    return {"environment": environment, "episode": episode, "result": result,
            "hidden": torch.zeros(64, device="cuda"), "reset": 1., "tick": 0,
            "return": 0., "trajectory": []}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--environment-url", required=True)
    parser.add_argument("--checkpoint", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--episodes", type=int, default=32)
    parser.add_argument("--environments", type=int, default=8)
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
    args = parser.parse_args()
    if args.environments < 1 or args.episodes < 1:
        parser.error("Episodes and environments must be positive")
    main(args)
