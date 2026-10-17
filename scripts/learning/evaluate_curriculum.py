"""Evaluate every checkpoint course in one CUDA process on independent seeds."""

import argparse
import json
from pathlib import Path

import torch

from evaluate import main as evaluate_policy


def main(args):
    output = Path(args.output)
    output.mkdir(parents=True, exist_ok=False)
    checkpoint = torch.load(args.checkpoint, map_location="cpu")
    config = checkpoint["config"]
    courses = config.get("trainingCourses") or [{key: config[key]
        for key in ("lesson", "level", "mix_levels", "mode", "map_id", "players", "ammo_id")}]
    if args.curriculum:
        courses = json.loads(Path(args.curriculum).read_text(encoding="utf-8-sig"))
    (output / "config.json").write_text(json.dumps({**vars(args), "courses": courses,
        "checkpointSteps": checkpoint["steps"]}, indent=2), encoding="utf-8")
    del checkpoint
    results = []
    for number, course in enumerate(courses):
        defaults = {"lesson": "navigation", "level": 1, "mix_levels": False, "mode": 4,
                    "map_id": 7, "players": 2, "controlled": 1, "ammo_id": 2001, "items": None}
        course = {**defaults, **course}
        levels = range(course["level"] + 1) if course["mix_levels"] else [course["level"]]
        for level in levels:
            destination = output / f"course-{number}-level-{level}"
            options = {**course, "level": level, "mix_levels": False,
                "checkpoint": args.checkpoint, "output": str(destination),
                "environment_url": args.environment_url, "episodes": args.episodes,
                "environments": args.environments, "stochastic": False,
                "gpu_utilization_limit": args.gpu_utilization_limit, "seed": args.seed}
            options["opponent_paths"] = config.get("opponentPaths")
            if args.without_items:
                options["items"] = []
            summary = evaluate_policy(argparse.Namespace(**options))
            results.append({**course, "level": level, "output": str(destination), **summary})
            (output / "progress.json").write_text(json.dumps(results, indent=2), encoding="utf-8")
    (output / "result.json").write_text(json.dumps({"evaluations": results,
        "readyForGameplay": False}, indent=2), encoding="utf-8")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--environment-url", required=True)
    parser.add_argument("--checkpoint", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--curriculum")
    parser.add_argument("--episodes", type=int, default=32)
    parser.add_argument("--environments", type=int, default=8)
    parser.add_argument("--gpu-utilization-limit", type=int, default=80)
    parser.add_argument("--seed", type=int, default=100000179)
    parser.add_argument("--without-items", action="store_true")
    options = parser.parse_args()
    if options.episodes < 1 or options.environments < 1:
        parser.error("Episodes and environments must be positive")
    main(options)
