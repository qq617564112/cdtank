"""Primitive control demonstrations from the learner's public observation."""

import math
import random
from collections import deque

NEAREST_ENEMY = 24
WEAPON_ENEMY = 136
GOAL_DIRECTION = 157
ITEM_FEATURES = 160
ITEM_WIDTH = 13


def demonstration_loss(distributions, chosen):
    """Retain sparse firing and consumable decisions among neutral control ticks."""
    import torch

    weights = torch.ones_like(chosen, dtype=torch.float32)
    weights[..., 0] = torch.where(chosen[..., 0] != 1, 3., 1.)
    weights[..., 3] = torch.where(chosen[..., 3] == 1, 5., 1.)
    weights[..., 4] = torch.where(chosen[..., 4] >= 2, 30., 1.)
    return -sum((dist.log_prob(chosen[..., head]) * weights[..., head]).mean()
                for head, dist in enumerate(distributions))


def primitive_action(frame, lesson):
    """Bootstrap isolated controls; these labels are scripted, never human."""
    observation = frame["observation"]
    action = [1, 1, 1, 0, 0]
    if lesson in ("turning", "navigation"):
        lateral, forward = observation[GOAL_DIRECTION:GOAL_DIRECTION + 2]
        angle = math.atan2(lateral, forward)
        if abs(angle) > .06:
            action[1] = 2 if angle > 0 else 0
        can_turn = any(frame["actionMasks"][1][index] for index in (0, 2))
        if lesson == "navigation" and (abs(angle) <= .06 or not can_turn and forward > 0) and observation[159] * 600 > 15:
            action[0] = 2
    elif lesson in ("aiming", "shooting"):
        if observation[NEAREST_ENEMY]:
            angle = math.atan2(observation[WEAPON_ENEMY + 3], observation[WEAPON_ENEMY + 4])
            if abs(angle) > .06:
                action[2] = 2 if angle > 0 else 0
            action[3] = int(abs(angle) < .1 and bool(observation[WEAPON_ENEMY + 2]))
            if lesson == "shooting":
                body_angle = math.atan2(observation[25], observation[26])
                if abs(body_angle) > .12:
                    action[1] = 2 if body_angle > 0 else 0
                elif observation[WEAPON_ENEMY] > .6 and observation[16] > .25:
                    action[0] = 2
                elif observation[WEAPON_ENEMY] < .2 and observation[20] > .25:
                    action[0] = 0
        elif lesson == "shooting":
            probes = observation[282:290] if len(observation) >= 290 else observation[16:24]
            direction = max(range(8), key=lambda index: probes[index] - .1 * min(index, 8 - index))
            if probes[0] > .25:
                action[0] = 2
            else:
                action[1] = 2 if direction <= 4 else 0
    elif lesson == "dodge":
        if observation[NEAREST_ENEMY]:
            bearing = math.atan2(observation[25], observation[26])
            options = [math.atan2(math.sin(bearing + side * math.pi / 2),
                                  math.cos(bearing + side * math.pi / 2)) for side in (-1, 1)]
            probes = observation[282:290] if len(observation) >= 290 else observation[16:24]
            heading = max(options, key=lambda value: probes[round(value / (math.pi / 4)) % 8] - .15 * abs(value))
            if abs(heading) > .12:
                action[1] = 2 if heading > 0 else 0
            if abs(heading) < .35 and probes[0] > .25:
                action[0] = 2
            elif probes[4] > .25 and probes[0] <= .25:
                action[0] = 0
    elif lesson == "range":
        if observation[NEAREST_ENEMY]:
            ratio = observation[WEAPON_ENEMY]
            if ratio > .86:
                action[0] = 2
            elif ratio < .79:
                action[0] = 0
    elif lesson == "items":
        if len(observation) < 266:
            raise ValueError("Item demonstrations need observation schema 4")
        if observation[159] > 0 and observation[158] > 0:
            action[0] = 2
        for slot in range(5, 9):
            offset = ITEM_FEATURES + (slot - 2) * ITEM_WIDTH
            healing = observation[offset + 1] and observation[offset + 10] >= .2 and observation[142]
            protection = observation[offset + 6] and observation[NEAREST_ENEMY]
            movement = observation[offset + 4] and observation[159] * 600 > 80
            if frame["actionMasks"][4][slot] and (healing or protection or movement):
                action[4] = slot
                break
    else:
        raise ValueError("No primitive teacher for this lesson")
    for head, value in enumerate(action):
        if not frame["actionMasks"][head][value]:
            action[head] = next(index for index, allowed in enumerate(frame["actionMasks"][head]) if allowed)
    return action


def demonstration_actions(results, source):
    if source == "cpu":
        if any("expertActions" not in result or result["expertActions"] is None for result in results):
            raise RuntimeError("CPU demonstrations require the expert simulation service")
        return [action for result in results for action in result["expertActions"]]
    return [primitive_action(frame, result["lesson"]) for result in results for frame in result["frames"]]


class DemonstrationReplay:
    """Rehearse complete control sequences, sampling each foundation course equally."""

    def __init__(self, filename, batch_size, device, width, schema):
        import json
        import numpy as np
        import torch

        with np.load(filename, allow_pickle=False) as archive:
            metadata = json.loads(str(archive["metadata"]))
            if metadata["observationSchema"] != schema or archive["observation"].shape[-1] != width:
                raise ValueError("Rehearsal observations must match the current simulation schema")
            self.data = {key: torch.as_tensor(archive[key], device=device)
                         for key in ("observation", "masks", "reset", "teacher")}
            self.groups = [np.flatnonzero(archive["course"] == course).tolist()
                           for course in np.unique(archive["course"])]
        self.batch_size = batch_size
        self.device = device
        self.source = {"path": filename, "trainerSource": metadata["trainerSource"],
                       "simulationSource": metadata["simulationSource"],
                       "courses": metadata["courses"], "sequences": metadata["sequences"],
                       "sequenceLength": metadata["sequence_length"], "labelSource": metadata["labelSource"]}

    def loss(self, policy):
        import torch

        selected = [random.choice(self.groups[index % len(self.groups)]) for index in range(self.batch_size)]
        indices = torch.tensor(selected, device=self.device)
        data = {key: value[:, indices] for key, value in self.data.items()}
        hidden = torch.zeros(self.batch_size, policy.hidden_size, device=self.device)
        distributions, _, _ = policy.sequence(data["observation"], hidden, data["reset"], data["masks"])
        return demonstration_loss(distributions, data["teacher"])


def teach(policy, optimizer, environments, pool, results, args, device, output, tensors, checkpoint):
    """Imitate contiguous real-world expert rollouts before reward optimization."""
    import json
    import torch
    from torch import nn

    actors_per_world = len(results[0]["frames"])
    agents = len(environments) * actors_per_world
    hidden = torch.zeros(agents, policy.hidden_size, device=device)
    reset = torch.ones(agents, device=device)
    steps = 0
    last_saved = 0
    episodes = []
    replay = deque(maxlen=max(1, args.teacher_replay_sequences // agents))
    with (output / "teacher.jsonl").open("x", encoding="utf-8") as log:
        while steps < args.teacher_steps:
            initial_hidden = hidden.detach()
            storage = {key: [] for key in ("observation", "masks", "reset", "teacher", "predicted")}
            for _ in range(32):
                observations, masks = tensors(results, device)
                with torch.no_grad():
                    distributions, _, hidden = policy(observations, hidden, reset, masks)
                actions = demonstration_actions(results, args.teacher_source)
                chosen = torch.tensor(actions, device=device)
                student_probability = args.teacher_student_fraction * min(1, steps / max(1, args.teacher_steps))
                predicted_tensor = torch.stack([dist.logits.argmax(dim=-1) for dist in distributions], dim=-1)
                for key, value in (("observation", observations), ("masks", masks), ("reset", reset),
                                   ("teacher", chosen), ("predicted", predicted_tensor)):
                    storage[key].append(value)
                predicted = predicted_tensor.tolist()
                executed = [student if random.random() < student_probability else demonstrated
                            for student, demonstrated in zip(predicted, actions)]
                world_actions = [executed[index * actors_per_world:(index + 1) * actors_per_world]
                                 for index in range(len(environments))]
                next_results = list(pool.map(lambda pair: pair[0].step(pair[1]), zip(environments, world_actions)))
                resets = []
                for index, result in enumerate(next_results):
                    for actor, frame in enumerate(result["frames"]):
                        died = frame["metrics"]["deaths"] != results[index]["frames"][actor]["metrics"]["deaths"]
                        resets.append(float(result["done"] or died))
                    if result["done"]:
                        episodes.append({"seed": result["seed"], "lesson": result["lesson"], "level": result["level"],
                                         "success": result["success"], "lessonMetrics": result["lessonMetrics"],
                                         "actorMetrics": [frame["metrics"] for frame in result["frames"]],
                                         "outcomes": result.get("outcomes")})
                        next_results[index] = environments[index].reset()
                results = next_results
                reset = torch.tensor(resets, device=device)
                steps += agents
            data = {key: torch.stack(value) for key, value in storage.items()}
            with torch.no_grad():
                distributions, _, sequence_hidden = policy.sequence(data["observation"], initial_hidden,
                                                                    data["reset"], data["masks"])
                predicted_sequence = torch.stack([dist.logits.argmax(dim=-1) for dist in distributions], dim=-1)
                sequence_mismatches = (predicted_sequence != data["predicted"]).sum().item()
                hidden_error = (sequence_hidden - hidden).abs().max().item()
            hidden = sequence_hidden.detach()
            del distributions, predicted_sequence, sequence_hidden
            replay.append((initial_hidden, {key: data[key] for key in ("observation", "masks", "reset", "teacher")}))
            replay_actors = [(batch, actor) for batch in replay for actor in range(agents)]
            selected = random.sample(replay_actors, min(args.teacher_batch_sequences, len(replay_actors)))
            batch_hidden = torch.stack([batch[0][actor] for batch, actor in selected])
            batch_data = {key: torch.stack([batch[1][key][:, actor] for batch, actor in selected], dim=1)
                          for key in ("observation", "masks", "reset", "teacher")}
            losses = []
            for _ in range(args.teacher_epochs):
                distributions, _, _ = policy.sequence(batch_data["observation"], batch_hidden,
                    batch_data["reset"], batch_data["masks"])
                loss = demonstration_loss(distributions, batch_data["teacher"])
                optimizer.zero_grad()
                policy.gpu_budget.wait()
                loss.backward()
                nn.utils.clip_grad_norm_(policy.parameters(), .5)
                optimizer.step()
                policy.gpu_budget.wait()
                losses.append(loss.item())
            row = {"steps": steps, "loss": sum(losses) / len(losses), "episodes": episodes,
                   "replaySequences": len(replay_actors), "batchSequences": len(selected),
                   "optimizationEpochs": args.teacher_epochs,
                   "sequenceActionHeadMismatches": sequence_mismatches, "sequenceHiddenMaximumError": hidden_error,
                   "gpuMemoryAllocatedMiB": torch.cuda.memory_allocated() / 1048576,
                   "gpuMemoryReservedMiB": torch.cuda.memory_reserved() / 1048576,
                   "studentActionProbability": student_probability,
                   "labelSource": "scripted HIGH CPU with navigation and team context" if args.teacher_source == "cpu"
                       else "scripted primitive control"}
            log.write(json.dumps(row) + "\n")
            log.flush()
            episodes = []
            if steps - last_saved >= 4096:
                checkpoint(steps)
                last_saved = steps
    checkpoint(steps)
    return results
