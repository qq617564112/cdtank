"""Evaluate completed training runs sequentially in one immutable trainer process."""

import argparse
import json
from pathlib import Path
import time

from evaluate_curriculum import main as evaluate_courses


def main(args):
    output = Path(args.output)
    output.mkdir(parents=True, exist_ok=False)
    candidates = json.loads(Path(args.candidates).read_text(encoding="utf-8-sig"))
    (output / "config.json").write_text(json.dumps({**vars(args), "candidates": candidates}, indent=2), encoding="utf-8")
    completed = []
    for candidate in candidates:
        source = Path(candidate["run"])
        while not (source / "result.json").exists():
            (output / "progress.json").write_text(json.dumps({"waitingFor": str(source), "completed": completed}, indent=2), encoding="utf-8")
            time.sleep(30)
        destination = output / source.name
        options = argparse.Namespace(checkpoint=str(source / "latest.pt"), output=str(destination),
            environment_url=candidate["environment_url"], curriculum=None, episodes=args.episodes,
            environments=args.environments, gpu_utilization_limit=args.gpu_utilization_limit,
            seed=args.seed, without_items=False)
        evaluate_courses(options)
        summary = json.loads((destination / "result.json").read_text(encoding="utf-8"))
        completed.append({"run": str(source), "output": str(destination), **summary})
        (output / "progress.json").write_text(json.dumps({"waitingFor": None, "completed": completed}, indent=2), encoding="utf-8")
    (output / "result.json").write_text(json.dumps({"candidates": completed, "readyForGameplay": False}, indent=2), encoding="utf-8")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--candidates", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--episodes", type=int, default=32)
    parser.add_argument("--environments", type=int, default=4)
    parser.add_argument("--gpu-utilization-limit", type=int, default=80)
    parser.add_argument("--seed", type=int, default=100000179)
    main(parser.parse_args())
