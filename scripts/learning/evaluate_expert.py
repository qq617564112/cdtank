"""Measure scripted demonstrations through ordinary simulation inputs."""

import argparse
from concurrent.futures import ThreadPoolExecutor
import json
from pathlib import Path

from train_combat import Environment
from teacher import demonstration_actions


def main(args):
    output = Path(args.output)
    output.mkdir(parents=True, exist_ok=False)
    args.lesson = getattr(args, "lesson", "combat")
    args.level = getattr(args, "level", 1)
    args.mix_levels = False
    args.teacher_source = getattr(args, "teacher_source", "cpu")
    args.teacher_steps = 1
    args.imitation_weight = 0
    environments = []
    episodes = []
    try:
        for number in range(min(args.environments, args.episodes)):
            environments.append(Environment(args, number))
        config = {**vars(args), "simulationSource": environments[0].source,
                  "labelSource": "scripted HIGH CPU with navigation and team context"
                      if args.teacher_source == "cpu" else "scripted primitive control",
                  "demonstrationUsesPrivilegedState": args.teacher_source == "cpu"}
        source = Path(__file__).resolve().parents[2] / "source.json"
        config["trainerSource"] = json.loads(source.read_text(encoding="utf-8")) if source.exists() else None
        (output / "config.json").write_text(json.dumps(config, indent=2), encoding="utf-8")
        with ThreadPoolExecutor(max_workers=len(environments)) as pool:
            results = list(pool.map(lambda pair: pair[0].reset(args.seed + pair[1]),
                                    zip(environments, range(len(environments)))))
            slots = [{"environment": env, "result": result, "episode": number, "tick": 0, "trajectory": []}
                     for number, (env, result) in enumerate(zip(environments, results))]
            next_episode = len(environments)
            with (output / "episodes.jsonl").open("x", encoding="utf-8") as log:
                while slots:
                    actions = [demonstration_actions([slot["result"]], args.teacher_source) for slot in slots]
                    for slot, action in zip(slots, actions):
                        if slot["tick"] % 10 == 0:
                            slot["trajectory"].append({"tick": slot["tick"], "actors": [
                                {"action": chosen, "observation": frame["observation"],
                                 "actionMasks": frame["actionMasks"], "position": frame["memory"]}
                                for chosen, frame in zip(action, slot["result"]["frames"])]})
                    advanced = list(pool.map(lambda pair: pair[0]["environment"].step(pair[1]), zip(slots, actions)))
                    remaining = []
                    for slot, result in zip(slots, advanced):
                        slot["tick"] += 1
                        if result["done"]:
                            row = {"episode": slot["episode"], "seed": result["seed"], "steps": slot["tick"],
                                   "outcomes": result["outcomes"],
                                   "lesson": result["lesson"], "level": result["level"],
                                   "success": result["success"], "lessonMetrics": result["lessonMetrics"],
                                   "actorMetrics": [frame["metrics"] for frame in result["frames"]],
                                   "actorItemMetrics": result["actorItemMetrics"], "trajectory": slot["trajectory"]}
                            episodes.append(row)
                            log.write(json.dumps(row) + "\n")
                            log.flush()
                            (output / "progress.json").write_text(json.dumps({"episodes": len(episodes)}, indent=2), encoding="utf-8")
                            if next_episode < args.episodes:
                                remaining.append({"environment": slot["environment"],
                                    "result": slot["environment"].reset(args.seed + next_episode),
                                    "episode": next_episode, "tick": 0, "trajectory": []})
                                next_episode += 1
                            else:
                                slot["environment"].close()
                        else:
                            slot["result"] = result
                            remaining.append(slot)
                    slots = remaining
        outcomes = [row["outcomes"][0] for row in episodes]
        metrics = [metric for row in episodes for metric in row["actorMetrics"]]
        items = [metric for row in episodes for metric in row["actorItemMetrics"]]
        summary = {"episodes": len(episodes), "winRate": outcomes.count("WIN") / len(episodes),
                   "successRate": sum(bool(row["success"]) for row in episodes) / len(episodes),
                   "stepsMean": sum(row["steps"] for row in episodes) / len(episodes),
                   "rangeKillsMean": sum(row["lessonMetrics"].get("rangeKills", 0) for row in episodes) / len(episodes),
                   "damageTakenMean": sum(metric["damageTaken"] for metric in metrics) / len(metrics),
                   "lossRate": outcomes.count("LOSE") / len(episodes), "drawRate": outcomes.count("DRAW") / len(episodes),
                   "unfinishedEpisodes": outcomes.count(None), "labelSource": config["labelSource"],
                   "killsMean": sum(metric["kills"] for metric in metrics) / len(metrics),
                   "deathsMean": sum(metric["deaths"] for metric in metrics) / len(metrics),
                   "itemUsesMean": sum(metric["consumedItems"] for metric in items) / len(items),
                   "healedHpMean": sum(metric["healedHp"] for metric in items) / len(items),
                   "objectiveDamageMean": sum(metric["bunkerDamage"] for metric in metrics) / len(metrics),
                   "vipDamageMean": sum(metric["vipDamage"] for metric in metrics) / len(metrics),
                   "objectivesMean": sum(metric["objectives"] for metric in metrics) / len(metrics),
                   "readyForGameplay": False}
        (output / "result.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
        print(json.dumps(summary), flush=True)
    finally:
        for environment in environments:
            environment.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--environment-url", required=True)
    parser.add_argument("--teacher-source", choices=("primitive", "cpu"), default="cpu")
    parser.add_argument("--lesson", default="combat")
    parser.add_argument("--level", type=int, default=1)
    parser.add_argument("--output", required=True)
    parser.add_argument("--mode", type=int, choices=range(1, 6), default=4)
    parser.add_argument("--map-id", type=int, default=7)
    parser.add_argument("--players", type=int, default=2)
    parser.add_argument("--controlled", type=int, default=1)
    parser.add_argument("--ammo-id", type=int, default=2001)
    parser.add_argument("--items", type=json.loads)
    parser.add_argument("--episodes", type=int, default=32)
    parser.add_argument("--environments", type=int, default=8)
    parser.add_argument("--seed", type=int, default=100000179)
    main(parser.parse_args())
