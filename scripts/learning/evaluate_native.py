"""Evaluate exported CPU policies through World's ordinary autopilot input path."""

import argparse
from concurrent.futures import ThreadPoolExecutor
import json
from pathlib import Path

import numpy as np
import torch

from train_combat import Environment, Policy


def main(args):
    output = Path(args.output)
    output.mkdir(parents=True, exist_ok=False)
    args.native_policy = json.loads(Path(args.model).read_text(encoding="utf-8"))
    model = args.native_policy
    courses = model.get("trainingCourses") or []
    if args.items is None and len(courses) == 1:
        args.items = courses[0].get("items")
    reference = Policy(model["observationWidth"], hidden_size=model["hiddenSize"]).eval()
    reference.load_state_dict({**reference.state_dict(),
        **{name: torch.tensor(value, dtype=torch.float32) for name, value in model["tensors"].items()}})
    torch.set_num_threads(2)
    environments = []
    episodes = []
    decisions, mismatches, maximum_error = 0, 0, 0.
    try:
        count = min(args.environments, args.episodes)
        environments = [Environment(args, index) for index in range(count)]
        config = {**{key: value for key, value in vars(args).items() if key != "native_policy"},
                  "modelCheckpoint": model["checkpoint"], "simulationSource": environments[0].source,
                  "execution": "native CPU actor via ordinary autopilot authority",
                  "executionUsesPrivilegedState": False, "readyForGameplay": False}
        (output / "config.json").write_text(json.dumps(config, indent=2), encoding="utf-8")
        with ThreadPoolExecutor(max_workers=count) as pool:
            initial = list(pool.map(lambda index: environments[index].reset(args.seed + index), range(count)))
            running = [slot(environments[index], index, result, reference.hidden_size) for index, result in enumerate(initial)]
            next_episode = count
            with (output / "episodes.jsonl").open("x", encoding="utf-8") as stream:
                while running:
                    advanced = list(pool.map(lambda row: row["environment"].step([[1, 1, 1, 0, 0]] * args.controlled), running))
                    remaining = []
                    for row, result in zip(running, advanced):
                        row["returns"] = [total + reward for total, reward in zip(row["returns"], result["rewards"])]
                        row["tick"] += 1
                        for actor, evidence in enumerate(result["nativeDecisions"]):
                            if not evidence or evidence["at"] == row["lastDecision"][actor]:
                                continue
                            row["lastDecision"][actor] = evidence["at"]
                            reset = torch.tensor([float(evidence["reset"])])
                            x = torch.tensor([evidence["observation"]])
                            mask = torch.tensor([sum(evidence["actionMasks"], [])], dtype=torch.bool)
                            with torch.no_grad():
                                ds, _, hidden = reference(x, row["hidden"][actor], reset, mask)
                                features = reference.actor(hidden)[0]
                            expected = [int(dist.logits.argmax(dim=-1)) for dist in ds]
                            error = float((features - torch.tensor(evidence["logits"])).abs().max())
                            maximum_error = max(maximum_error, error)
                            decisions += 1
                            mismatches += int(expected != evidence["actions"])
                            row["hidden"][actor] = hidden
                        if row["tick"] % 5 == 0 or result["done"]:
                            row["trajectory"].append({"tick": row["tick"], "actors": [
                                {"position": frame["memory"], "metrics": frame["metrics"],
                                 "actions": evidence["actions"] if evidence else None,
                                 "decisionAt": evidence["at"] if evidence else None,
                                 "decisionObservation": evidence["observation"] if evidence else None}
                                for frame, evidence in zip(result["frames"], result["nativeDecisions"])]})
                        if result["done"]:
                            entry = {"episode": row["episode"], "seed": result["seed"], "steps": row["tick"],
                                     "outcomes": result["outcomes"], "success": result["success"],
                                     "actorReturns": row["returns"], "actorMetrics": [frame["metrics"] for frame in result["frames"]],
                                     "actorItemMetrics": result["actorItemMetrics"], "trajectory": row["trajectory"]}
                            episodes.append(entry)
                            stream.write(json.dumps(entry) + "\n")
                            stream.flush()
                            if next_episode < args.episodes:
                                remaining.append(slot(row["environment"], next_episode,
                                                      row["environment"].reset(args.seed + next_episode), reference.hidden_size))
                                next_episode += 1
                            else:
                                row["environment"].close()
                        else:
                            remaining.append(row)
                    running = remaining
        outcomes = [row["outcomes"][0] for row in episodes]
        metrics = [item for row in episodes for item in row["actorMetrics"]]
        item_metrics = [item for row in episodes for item in row["actorItemMetrics"]]
        summary = {"episodes": len(episodes), "winRate": outcomes.count("WIN") / len(episodes),
                   "lossRate": outcomes.count("LOSE") / len(episodes), "drawRate": outcomes.count("DRAW") / len(episodes),
                   "unfinishedEpisodes": outcomes.count(None), "nativeDecisions": decisions,
                   "pytorchActionMismatches": mismatches, "maximumLogitError": maximum_error,
                   "killsMean": float(np.mean([row["kills"] for row in metrics])),
                   "deathsMean": float(np.mean([row["deaths"] for row in metrics])),
                   "damageTakenMean": float(np.mean([row["damageTaken"] for row in metrics])),
                   "shotsMean": float(np.mean([row["shots"] for row in metrics])),
                   "hitsMean": float(np.mean([row["hits"] for row in metrics])),
                   "objectiveDamageMean": float(np.mean([row["bunkerDamage"] for row in metrics])),
                   "vipDamageMean": float(np.mean([row["vipDamage"] for row in metrics])),
                   "objectivesMean": float(np.mean([row["objectives"] for row in metrics])),
                   "itemUsesMean": float(np.mean([row["consumedItems"] for row in item_metrics])),
                   "rejectedItemsMean": float(np.mean([row["rejectedItems"] for row in item_metrics])),
                   "healedHpMean": float(np.mean([row["healedHp"] for row in item_metrics])),
                   "checkpointSteps": model["checkpoint"]["steps"], "readyForGameplay": False}
        (output / "result.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
        print(json.dumps(summary), flush=True)
        return summary
    finally:
        for environment in environments:
            environment.close()


def slot(environment, episode, result, hidden_size):
    actors = len(result["frames"])
    return {"environment": environment, "episode": episode, "tick": 0, "returns": [0.] * actors,
            "hidden": [torch.zeros(1, hidden_size) for _ in range(actors)], "lastDecision": [None] * actors,
            "trajectory": []}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--environment-url", required=True)
    parser.add_argument("--model", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--episodes", type=int, default=32)
    parser.add_argument("--environments", type=int, default=4)
    parser.add_argument("--mode", type=int, default=1)
    parser.add_argument("--map-id", type=int, default=7)
    parser.add_argument("--tank-id", type=int, default=1)
    parser.add_argument("--players", type=int, default=4)
    parser.add_argument("--controlled", type=int, default=2)
    parser.add_argument("--ammo-id", type=int, default=2001)
    parser.add_argument("--items", type=json.loads, help="Override the single-course model's training loadout")
    parser.add_argument("--seed", type=int, default=100000179)
    options = parser.parse_args()
    options.lesson, options.level, options.mix_levels = "combat", 1, False
    main(options)
