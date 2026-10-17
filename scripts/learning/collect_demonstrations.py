"""Save continuous authoritative-world demonstrations for foundation rehearsal."""

import argparse
from concurrent.futures import ThreadPoolExecutor
import json
from pathlib import Path

import numpy as np
import torch

from teacher import demonstration_actions
from train_combat import Environment, Policy, course_options


def load_frozen_policy(path):
    saved = torch.load(path, map_location="cpu")
    config = saved["config"]
    width = saved["policy"]["encoder.weight"].shape[1]
    policy = Policy(width, None, config.get("centralStateWidth", 0), config.get("hiddenSize", 64)).eval()
    policy.initialize(saved["policy"])
    source = {"path": path, "steps": saved["steps"], "source": config.get("source"),
        "offlineUpdates": config.get("offlineUpdates", 0),
        "observationWidth": width, "hiddenSize": policy.hidden_size,
        "observationSchema": config["observationSchema"], "execution": "PyTorch CPU"}
    return {"policy": policy, "width": width, "indices": []}, source


def frozen_actions(groups, frames, reset):
    actions = [None] * len(frames)
    with torch.no_grad():
        for group in groups.values():
            indices = group["indices"]
            observation = torch.tensor([frames[index]["observation"][:group["width"]] for index in indices])
            masks = torch.tensor([sum(frames[index]["actionMasks"], []) for index in indices], dtype=torch.bool)
            distributions, _, group["hidden"] = group["policy"](observation, group["hidden"],
                torch.as_tensor(reset[indices]), masks)
            chosen = torch.stack([distribution.logits.argmax(-1) for distribution in distributions], dim=-1).tolist()
            for index, action in zip(indices, chosen):
                actions[index] = action
    return actions


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
    teacher_groups = {}
    teacher_sources = []
    behavior_groups = {}
    behavior_source = None
    paths = json.loads(Path(args.teachers).read_text(encoding="utf-8-sig")) if args.teachers else None
    if paths is not None:
        if len(paths) != len(courses):
            raise ValueError("Provide one frozen teacher per collection course")
        torch.set_num_threads(2)
        for index in range(args.environments):
            path = paths[index % len(courses)]
            if path not in teacher_groups:
                teacher_groups[path], source = load_frozen_policy(path)
                teacher_sources.append(source)
            teacher_groups[path]["indices"].append(index)
    if args.behavior:
        behavior, behavior_source = load_frozen_policy(args.behavior)
        behavior["indices"] = list(range(args.environments))
        behavior_groups[args.behavior] = behavior
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
                    for group in (*teacher_groups.values(), *behavior_groups.values()):
                        group["hidden"] = torch.zeros(len(group["indices"]), group["policy"].hidden_size)
                    storage = {key: [] for key in batches}
                    for _ in range(args.sequence_length):
                        frames = [result["frames"][0] for result in results]
                        if any(len(result["frames"]) != 1 for result in results):
                            raise ValueError("Foundation rehearsal controls one actor per world")
                        actions = frozen_actions(teacher_groups, frames, reset) if teacher_groups \
                            else demonstration_actions(results, "primitive")
                        executed = frozen_actions(behavior_groups, frames, reset) if behavior_groups else actions
                        storage["observation"].append([frame["observation"] for frame in frames])
                        storage["masks"].append([sum(frame["actionMasks"], []) for frame in frames])
                        storage["reset"].append(reset)
                        storage["teacher"].append(actions)
                        advanced = list(pool.map(lambda pair: pair[0].step(pair[1]), zip(environments, executed)))
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
        metadata = {**vars(args), "courses": courses,
                    "labelSource": "frozen learned local policies" if teacher_groups else "scripted primitive control",
                    "courseTeachers": paths, "teacherCheckpoints": teacher_sources,
                    "behaviorCheckpoint": behavior_source,
                    "executionSource": "shared student policy" if behavior_groups else "course teacher",
                    "simulationSource": environments[0].source, "episodeSeeds": episode_seeds,
                    "observationSchema": results[0]["frames"][0]["schema"],
                    "sequences": len(course_ids), "steps": len(course_ids) * args.sequence_length}
        source = Path(__file__).resolve().parents[2] / "source.json"
        metadata["trainerSource"] = json.loads(source.read_text(encoding="utf-8")) if source.exists() else None
        metadata["collectedSteps"] = metadata["steps"]
        metadata["collectedSequences"] = metadata["sequences"]
        arrays = {key: np.concatenate(value, axis=1) for key, value in batches.items()}
        course_ids = np.asarray(course_ids)
        if args.previous:
            with np.load(args.previous, allow_pickle=False) as archive:
                prior = json.loads(str(archive["metadata"]))
                prior_courses = [{"tank_id": 1, **course} for course in prior["courses"]]
                if prior_courses != courses or prior["observationSchema"] != metadata["observationSchema"] \
                        or prior["sequence_length"] != args.sequence_length:
                    raise ValueError("Aggregate the same courses, observation schema and sequence length")
                if prior["courseTeachers"] != paths:
                    raise ValueError("Aggregate trajectories labeled by the same frozen specialists")
                arrays = {key: np.concatenate((archive[key], values), axis=1) for key, values in arrays.items()}
                course_ids = np.concatenate((archive["course"], course_ids))
                metadata["previousData"] = {"path": args.previous, "steps": prior["steps"],
                    "sequences": prior["sequences"], "trainerSource": prior["trainerSource"],
                    "behaviorCheckpoint": prior.get("behaviorCheckpoint")}
                metadata["sequences"] += prior["sequences"]
                metadata["steps"] += prior["steps"]
        np.savez_compressed(output / "sequences.npz", **arrays, course=course_ids,
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
    parser.add_argument("--teachers", help="JSON list of frozen local policy checkpoints in course order")
    parser.add_argument("--behavior", help="Frozen shared student executes while course teachers label its observations")
    parser.add_argument("--previous", help="Aggregate earlier trajectories labeled by the same frozen course teachers")
    parser.add_argument("--environments", type=int, default=16)
    parser.add_argument("--sequences-per-course", type=int, default=64)
    parser.add_argument("--sequence-length", type=int, default=128)
    parser.add_argument("--seed", type=int, default=200000179)
    parser.add_argument("--lesson", default="navigation")
    parser.add_argument("--level", type=int, default=2)
    parser.add_argument("--mix-levels", action="store_true")
    parser.add_argument("--mode", type=int, default=4)
    parser.add_argument("--map-id", type=int, default=7)
    parser.add_argument("--tank-id", type=int, default=1)
    parser.add_argument("--players", type=int, default=2)
    parser.add_argument("--controlled", type=int, default=1)
    parser.add_argument("--ammo-id", type=int, default=2001)
    parser.add_argument("--items", type=json.loads)
    options = parser.parse_args()
    if options.behavior and not options.teachers:
        parser.error("Student execution requires frozen course teachers")
    main(options)
