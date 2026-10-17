"""Primitive control demonstrations from the learner's public observation."""

import math
import random

NEAREST_ENEMY = 24
WEAPON_ENEMY = 136
GOAL_DIRECTION = 157


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
    elif lesson == "aiming":
        if observation[NEAREST_ENEMY]:
            angle = math.atan2(observation[WEAPON_ENEMY + 3], observation[WEAPON_ENEMY + 4])
            if abs(angle) > .06:
                action[2] = 2 if angle > 0 else 0
            action[3] = int(abs(angle) < .1 and bool(observation[WEAPON_ENEMY + 2]))
    elif lesson == "range":
        if observation[NEAREST_ENEMY]:
            ratio = observation[WEAPON_ENEMY]
            if ratio > .86:
                action[0] = 2
            elif ratio < .79:
                action[0] = 0
    else:
        raise ValueError("No primitive teacher for this lesson")
    for head, value in enumerate(action):
        if not frame["actionMasks"][head][value]:
            action[head] = next(index for index, allowed in enumerate(frame["actionMasks"][head]) if allowed)
    return action


def teach(policy, optimizer, environments, pool, results, args, device, output, tensors):
    """Imitate contiguous real-world expert rollouts before reward optimization."""
    import json
    import torch
    from torch import nn

    hidden = torch.zeros(len(environments), 64, device=device)
    reset = torch.ones(len(environments), device=device)
    steps = 0
    episodes = []
    with (output / "teacher.jsonl").open("x", encoding="utf-8") as log:
        while steps < args.teacher_steps:
            losses = []
            for _ in range(32):
                observations, masks = tensors(results, device)
                distributions, _, hidden = policy(observations, hidden, reset, masks)
                actions = [primitive_action(result["frames"][0], result["lesson"]) for result in results]
                chosen = torch.tensor(actions, device=device)
                losses.append(-sum(dist.log_prob(chosen[:, head]).mean()
                                   for head, dist in enumerate(distributions)))
                student_probability = args.teacher_student_fraction * min(1, steps / max(1, args.teacher_steps))
                predicted = torch.stack([dist.logits.argmax(dim=-1) for dist in distributions], dim=-1).tolist()
                executed = [student if random.random() < student_probability else demonstrated
                            for student, demonstrated in zip(predicted, actions)]
                next_results = list(pool.map(lambda pair: pair[0].step(pair[1]), zip(environments, executed)))
                resets = []
                for index, result in enumerate(next_results):
                    died = result["frames"][0]["metrics"]["deaths"] != results[index]["frames"][0]["metrics"]["deaths"]
                    resets.append(float(result["done"] or died))
                    if result["done"]:
                        episodes.append({"seed": result["seed"], "lesson": result["lesson"], "level": result["level"],
                                         "success": result["success"], "lessonMetrics": result["lessonMetrics"]})
                        next_results[index] = environments[index].reset()
                results = next_results
                reset = torch.tensor(resets, device=device)
                steps += len(environments)
            loss = torch.stack(losses).mean()
            optimizer.zero_grad()
            policy.gpu_budget.wait()
            loss.backward()
            nn.utils.clip_grad_norm_(policy.parameters(), .5)
            optimizer.step()
            policy.gpu_budget.wait()
            hidden = hidden.detach()
            row = {"steps": steps, "loss": loss.item(), "episodes": episodes,
                   "studentActionProbability": student_probability, "labelSource": "scripted primitive control"}
            log.write(json.dumps(row) + "\n")
            log.flush()
            episodes = []
    return results
