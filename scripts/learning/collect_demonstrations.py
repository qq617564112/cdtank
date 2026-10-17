"""Save continuous authoritative-world demonstrations for foundation rehearsal."""

import argparse
from concurrent.futures import ThreadPoolExecutor
import json
from pathlib import Path

import numpy as np

from teacher import demonstration_actions
from train_combat import Environment, course_options


def main(args):
    output = Path(args.output)
    output.mkdir(parents=True, exist_ok=False)
    args.courses = json.loads(Path(args.curriculum).read_text(encoding="utf-8-sig"))
    args.teacher_source = "primitive"
    courses = course_options(args)
    if args.environments % len(courses):
        raise ValueError("Use the same number of worlds for each foundation course")
    rounds = args.sequences_per_course * len(courses) // args.environments
    if rounds * args.environments != args.sequences_per_course * len(courses):
        raise ValueError("Sequence count must fill complete collection rounds")
    environments = []
    batches = {key: [] for key in ("observation", "masks", "reset", "teacher")}
    course_ids = []
    episode_seeds = []
    try:
        environments = [Environment(args, index) for index in range(args.environments)]
        with ThreadPoolExecutor(max_workers=args.environments) as pool:
            with (output / "episodes.jsonl").open("x", encoding="utf-8") as log:
                for number in range(rounds):
                    results = list(pool.map(lambda env: env.reset(), environments))
                    episode_seeds.extend(result["seed"] for result in results)
                    reset = np.ones(args.environments, dtype=np.float32)
                    storage = {key: [] for key in batches}
                    for _ in range(args.sequence_length):
                        frames = [result["frames"][0] for result in results]
                        if any(len(result["frames"]) != 1 for result in results):
                            raise ValueError("Foundation rehearsal controls one actor per world")
                        actions = demonstration_actions(results, "primitive")
                        storage["observation"].append([frame["observation"] for frame in frames])
                        storage["masks"].append([sum(frame["actionMasks"], []) for frame in frames])
                        storage["reset"].append(reset)
                        storage["teacher"].append(actions)
                        advanced = list(pool.map(lambda pair: pair[0].step(pair[1]), zip(environments, actions)))
                        reset = np.zeros(args.environments, dtype=np.float32)
                        for index, result in enumerate(advanced):
                            died = result["frames"][0]["metrics"]["deaths"] != frames[index]["metrics"]["deaths"]
                            reset[index] = float(result["done"] or died)
                            if result["done"]:
                                log.write(json.dumps({"seed": result["seed"], "lesson": result["lesson"],
                                    "level": result["level"], "success": result["success"],
                                    "lessonMetrics": result["lessonMetrics"]}) + "\n")
                                advanced[index] = environments[index].reset()
                                episode_seeds.append(advanced[index]["seed"])
                        results = advanced
                    for key, values in storage.items():
                        dtype = np.bool_ if key == "masks" else np.int64 if key == "teacher" else np.float32
                        batches[key].append(np.asarray(values, dtype=dtype))
                    course_ids.extend(index % len(courses) for index in range(args.environments))
                    log.flush()
                    (output / "progress.json").write_text(json.dumps({"round": number + 1,
                        "rounds": rounds, "sequences": len(course_ids)}, indent=2), encoding="utf-8")
        metadata = {**vars(args), "courses": courses, "labelSource": "scripted primitive control",
                    "simulationSource": environments[0].source, "episodeSeeds": episode_seeds,
                    "observationSchema": results[0]["frames"][0]["schema"],
                    "sequences": len(course_ids), "steps": len(course_ids) * args.sequence_length}
        source = Path(__file__).resolve().parents[2] / "source.json"
        metadata["trainerSource"] = json.loads(source.read_text(encoding="utf-8")) if source.exists() else None
        np.savez_compressed(output / "sequences.npz", **{key: np.concatenate(value, axis=1)
                            for key, value in batches.items()}, course=np.asarray(course_ids),
                            metadata=np.asarray(json.dumps(metadata)))
        (output / "result.json").write_text(json.dumps(metadata, indent=2), encoding="utf-8")
        print(json.dumps({"output": str(output), "steps": metadata["steps"],
                          "sequences": len(course_ids)}), flush=True)
    finally:
        for environment in environments:
            environment.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--environment-url", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--curriculum", required=True)
    parser.add_argument("--environments", type=int, default=16)
    parser.add_argument("--sequences-per-course", type=int, default=64)
    parser.add_argument("--sequence-length", type=int, default=128)
    parser.add_argument("--seed", type=int, default=200000179)
    parser.add_argument("--lesson", default="navigation")
    parser.add_argument("--level", type=int, default=2)
    parser.add_argument("--mix-levels", action="store_true")
    parser.add_argument("--mode", type=int, default=4)
    parser.add_argument("--map-id", type=int, default=7)
    parser.add_argument("--players", type=int, default=2)
    parser.add_argument("--controlled", type=int, default=1)
    parser.add_argument("--ammo-id", type=int, default=2001)
    parser.add_argument("--items", type=json.loads)
    main(parser.parse_args())
