"""Measure frozen local policies on separate seeds and save every learned actor."""

import argparse
from concurrent.futures import ThreadPoolExecutor
import json
from pathlib import Path
import random

import numpy as np
import torch

from train_combat import Environment, OpponentPool, Policy, tensors
from gpu_budget import GpuBudget


def main(args):
    output = Path(args.output)
    output.mkdir(parents=True, exist_ok=False)
    torch.set_num_threads(2)
    random.seed(args.seed)
    np.random.seed(args.seed)
    torch.manual_seed(args.seed)
    device = torch.device(getattr(args, "device", "cuda"))
    checkpoint = torch.load(args.checkpoint, map_location=device)
    (output / "config.json").write_text(json.dumps(vars(args), indent=2), encoding="utf-8")
    budget = GpuBudget(args.gpu_utilization_limit, output) if device.type == "cuda" else None
    episodes = []
    environments = []
    try:
        count = min(args.environments, args.episodes)
        for number in range(count):
            environments.append(Environment(args, number))
        with ThreadPoolExecutor(max_workers=count) as pool:
            initial = list(pool.map(lambda number: environments[number].reset(args.seed + number), range(count)))
            actors_per_world = len(initial[0]["frames"])
            source = Path(__file__).resolve().parents[2] / "source.json"
            config = {**vars(args), "checkpointSteps": checkpoint["steps"],
                      "checkpointSource": checkpoint.get("config", {}).get("source"),
                      "checkpointSimulationSource": checkpoint.get("config", {}).get("simulationSource"),
                      "trainerSource": json.loads(source.read_text(encoding="utf-8")) if source.exists() else None,
                      "simulationSource": environments[0].source,
                      "observationWidth": len(initial[0]["frames"][0]["observation"]),
                      "observationSchema": initial[0]["frames"][0]["schema"],
                      "actorsPerWorld": actors_per_world, "controlledRoster": initial[0].get("actors"),
                      "executionUsesPrivilegedState": False,
                      "torch": torch.__version__,
                      "device": torch.cuda.get_device_name(0) if device.type == "cuda" else "cpu"}
            (output / "config.json").write_text(json.dumps(config, indent=2), encoding="utf-8")
            policy = Policy(config["observationWidth"], budget,
                            checkpoint.get("config", {}).get("centralStateWidth", 0),
                            checkpoint.get("config", {}).get("hiddenSize", 64)).to(device).eval()
            policy.initialize(checkpoint["policy"])
            opponents = OpponentPool(getattr(args, "opponent_paths", None), config["observationWidth"], budget, device)
            config["opponentCheckpoints"] = opponents.sources
            (output / "config.json").write_text(json.dumps(config, indent=2), encoding="utf-8")
            running = [episode_slot(env, number, result, policy.hidden_size, opponents.hidden_size, device) for number, (env, result)
                       in enumerate(zip(environments, initial))]
            next_episode = count
            with (output / "episodes.jsonl").open("x", encoding="utf-8") as log:
                while running:
                    observation, masks = tensors([slot["result"] for slot in running], device)
                    hidden = torch.cat([slot["hidden"] for slot in running])
                    opponent_hidden = torch.cat([slot["opponentHidden"] for slot in running])
                    reset = torch.tensor([value for slot in running for value in slot["reset"]], device=device)
                    with torch.no_grad():
                        distributions, _, hidden = policy(observation, hidden, reset, masks)
                        chosen = [dist.sample() if args.stochastic else dist.logits.argmax(dim=-1)
                                  for dist in distributions]
                        actions = torch.stack(chosen, dim=-1)
                        opponent_hidden = opponents.act([slot["result"] for slot in running], observation, masks,
                                                        reset, opponent_hidden, actions)
                        actions = actions.reshape(len(running), actors_per_world, 5).tolist()
                    advanced = list(pool.map(lambda pair: pair[0]["environment"].step(pair[1]), zip(running, actions)))
                    remaining = []
                    for index, (slot, result, action) in enumerate(zip(running, advanced, actions)):
                        before = slot["result"]["frames"]
                        frames = result["frames"]
                        tick = slot["tick"]
                        slot["returns"] = [total + reward for total, reward in zip(slot["returns"], result["rewards"])]
                        if tick % 10 == 0 or result["done"]:
                            actors = [{"action": selected, "position": frame["memory"],
                                       "observation": frame["observation"]} for frame, selected in zip(frames, action)]
                            slot["trajectory"].append({"tick": tick, "goalDistance": result.get("goalDistance"),
                                **actors[0], "actors": actors})
                        if result["done"] or tick >= 999:
                            row = {"episode": slot["episode"], "seed": result["seed"], "steps": tick + 1,
                                   "lesson": result["lesson"], "level": result["level"],
                                   "return": float(np.mean(slot["returns"])), "actorReturns": slot["returns"],
                                   "success": result.get("success"), "outcomes": result.get("outcomes"),
                                   "metrics": frames[0]["metrics"], "actorMetrics": [frame["metrics"] for frame in frames],
                                   "learnedTeam": frames[0]["metrics"]["team"],
                                   "actorItemMetrics": result.get("actorItemMetrics"),
                                   "lessonMetrics": result.get("lessonMetrics"), "trajectory": slot["trajectory"]}
                            row["trainedActorIndices"] = [actor for actor, frame in enumerate(frames)
                                if not opponents.policies or frame["metrics"]["team"] == 0]
                            episodes.append(row)
                            log.write(json.dumps(row) + "\n")
                            log.flush()
                            if next_episode < args.episodes:
                                reset_result = slot["environment"].reset(args.seed + next_episode)
                                remaining.append(episode_slot(slot["environment"], next_episode, reset_result,
                                                              policy.hidden_size, opponents.hidden_size, device))
                                next_episode += 1
                            else:
                                slot["environment"].close()
                        else:
                            slot.update(result=result, hidden=hidden[index * actors_per_world:(index + 1) * actors_per_world],
                                        opponentHidden=opponent_hidden[index * actors_per_world:(index + 1) * actors_per_world],
                                        tick=tick + 1, reset=[float(frame["metrics"]["deaths"] != old["metrics"]["deaths"])
                                                             for frame, old in zip(frames, before)])
                            remaining.append(slot)
                    running = remaining
        metrics = [row["actorMetrics"][index] for row in episodes for index in row["trainedActorIndices"]]
        item_metrics = [(row["actorItemMetrics"] or [row["lessonMetrics"]])[index]
                        for row in episodes for index in row["trainedActorIndices"]]
        outcomes = [(row["outcomes"] or [None])[0] for row in episodes]
        summary = {"episodes": len(episodes), "actorsPerWorld": actors_per_world,
                   "successRate": float(np.mean([bool(row["success"]) for row in episodes])),
                   "winRate": outcomes.count("WIN") / len(episodes),
                   "lossRate": outcomes.count("LOSE") / len(episodes),
                   "drawRate": outcomes.count("DRAW") / len(episodes),
                   "unfinishedEpisodes": outcomes.count(None),
                   "returnMean": float(np.mean([row["return"] for row in episodes])),
                   "stepsMean": float(np.mean([row["steps"] for row in episodes])),
                   "itemUsesMean": float(np.mean([row.get("consumedItems", 0) for row in item_metrics])),
                   "healedHpMean": float(np.mean([row.get("healedHp", 0) for row in item_metrics])),
                   "damageTakenMean": float(np.mean([row["damageTaken"] for row in metrics])),
                   "finalHpMean": float(np.mean([row["hp"] for row in metrics])),
                   "killsMean": float(np.mean([row["kills"] for row in metrics])),
                   "deathsMean": float(np.mean([row["deaths"] for row in metrics])),
                   "objectiveDamageMean": float(np.mean([row["bunkerDamage"] for row in metrics])),
                   "vipDamageMean": float(np.mean([row["vipDamage"] for row in metrics])),
                   "objectivesMean": float(np.mean([row["objectives"] for row in metrics])),
                   "checkpointSteps": checkpoint["steps"], "readyForGameplay": False}
        (output / "result.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
        print(json.dumps(summary), flush=True)
        return summary
    finally:
        for environment in environments:
            environment.close()
        if budget:
            budget.close()


def episode_slot(environment, episode, result, hidden_size, opponent_hidden_size, device):
    actors = len(result["frames"])
    return {"environment": environment, "episode": episode, "result": result,
            "hidden": torch.zeros(actors, hidden_size, device=device), "reset": [1.] * actors, "tick": 0,
            "opponentHidden": torch.zeros(actors, opponent_hidden_size, device=device),
            "returns": [0.] * actors, "trajectory": []}


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
    parser.add_argument("--tank-id", type=int, default=1)
    parser.add_argument("--players", type=int, default=2)
    parser.add_argument("--controlled", type=int, default=1)
    parser.add_argument("--opponent-pool")
    parser.add_argument("--ammo-id", type=int, default=2001)
    parser.add_argument("--items", type=json.loads, help="Use [] to measure the same policy without consumables")
    parser.add_argument("--seed", type=int, default=100000179)
    parser.add_argument("--stochastic", action="store_true")
    parser.add_argument("--gpu-utilization-limit", type=int, default=80)
    parser.add_argument("--device", choices=("cuda", "cpu"), default="cuda")
    args = parser.parse_args()
    args.opponent_paths = json.loads(Path(args.opponent_pool).read_text(encoding="utf-8-sig")) if args.opponent_pool else None
    if args.environments < 1 or args.episodes < 1:
        parser.error("Episodes and environments must be positive")
    main(args)
