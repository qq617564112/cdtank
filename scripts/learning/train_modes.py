"""Train five independent mode candidates from a common team checkpoint."""

import argparse
import json
from pathlib import Path

from train_combat import main as train_policy


def main(args):
    output = Path(args.output)
    output.mkdir(parents=True, exist_ok=False)
    loadout = [{"slot": 5, "itemTableId": 2, "quantity": 1},
               {"slot": 6, "itemTableId": 8, "quantity": 1},
               {"slot": 7, "itemTableId": 6, "quantity": 1},
               {"slot": 8, "itemTableId": 4, "quantity": 1}]
    courses = [{"mode": mode, "map_id": map_id, "players": 4,
                "controlled": 2 if mode <= 3 else 1}
               for mode, map_id in ((1, 7), (2, 2), (3, 7), (4, 7), (5, 20))]
    plan = {**vars(args), "courses": courses, "loadout": loadout,
            "strategy": "independent mode parameters initialized from one common team checkpoint",
            "readyForGameplay": False}
    (output / "config.json").write_text(json.dumps(plan, indent=2), encoding="utf-8")
    models = []
    for course in courses:
        destination = output / f"mode-{course['mode']}"
        (output / "progress.json").write_text(json.dumps({"currentMode": course["mode"],
            "completed": models, "readyForGameplay": False}, indent=2), encoding="utf-8")
        options = argparse.Namespace(environment_url=args.environment_url, output=str(destination),
            prior=None, resume=None, weights=args.checkpoint, steps=args.steps,
            environments=args.environments, rollout=128, epochs=4,
            minibatch_sequences=args.minibatch_sequences, gpu_utilization_limit=args.gpu_utilization_limit,
            hidden_size=args.hidden_size,
            learning_rate=.00025, ammo_id=2001, lesson="combat", level=1, mix_levels=False,
            seed=args.seed + 1000 * course["mode"], evaluation_episodes=args.evaluation_episodes,
            evaluation_environments=min(8, args.environments), teacher_steps=0,
            teacher_student_fraction=.75, imitation_weight=0., curriculum=None, courses=None,
            items=loadout, centralized_critic=True, opponent_pool=None, opponent_paths=None, **course)
        train_policy(options)
        result = json.loads((destination / "result.json").read_text(encoding="utf-8"))
        models.append({**course, "checkpoint": str(destination / "latest.pt"),
                       "steps": result["steps"], "evaluations": result["evaluations"]})
    manifest = {"models": models, "readyForGameplay": False}
    (output / "progress.json").write_text(json.dumps({"currentMode": None, **manifest}, indent=2), encoding="utf-8")
    (output / "result.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--environment-url", required=True)
    parser.add_argument("--checkpoint", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--steps", type=int, default=300000)
    parser.add_argument("--environments", type=int, default=8)
    parser.add_argument("--minibatch-sequences", type=int, default=64)
    parser.add_argument("--hidden-size", type=int, choices=(64, 128, 256), default=256)
    parser.add_argument("--evaluation-episodes", type=int, default=32)
    parser.add_argument("--gpu-utilization-limit", type=int, default=80)
    parser.add_argument("--seed", type=int, default=179)
    main(parser.parse_args())
