"""Run ordinary CPU policy matches across explicit maps, vehicles and rosters."""

import argparse
import json
from pathlib import Path

from evaluate_native import main as evaluate_policy


def main(args):
    output = Path(args.output)
    output.mkdir(parents=True, exist_ok=False)
    courses = json.loads(Path(args.curriculum).read_text(encoding="utf-8-sig"))
    (output / "config.json").write_text(json.dumps({**vars(args), "courses": courses}, indent=2), encoding="utf-8")
    results = []
    for number, course in enumerate(courses):
        mode = course["mode"]
        defaults = {"mode": mode, "map_id": 7, "tank_id": 1, "players": 4,
                    "controlled": 2 if mode <= 3 else 1, "ammo_id": 2001, "items": None}
        options = {**defaults, **course, "model": args.model,
                   "environment_url": args.environment_url, "episodes": args.episodes,
                   "environments": args.environments, "seed": args.seed,
                   "lesson": "combat", "level": 1, "mix_levels": False,
                   "output": str(output / f"course-{number}")}
        summary = evaluate_policy(argparse.Namespace(**options))
        config = json.loads((Path(options["output"]) / "config.json").read_text(encoding="utf-8"))
        results.append({**course, "items": config["items"],
                        "output": options["output"], **summary})
        (output / "progress.json").write_text(json.dumps(results, indent=2), encoding="utf-8")
    (output / "result.json").write_text(json.dumps({"evaluations": results,
        "readyForGameplay": False}, indent=2), encoding="utf-8")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--environment-url", required=True)
    parser.add_argument("--model", required=True)
    parser.add_argument("--curriculum", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--episodes", type=int, default=32)
    parser.add_argument("--environments", type=int, default=8)
    parser.add_argument("--seed", type=int, default=100000179)
    options = parser.parse_args()
    if options.episodes < 1 or options.environments < 1:
        parser.error("Episodes and environments must be positive")
    main(options)
