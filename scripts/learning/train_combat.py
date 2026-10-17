"""Train a recurrent PPO policy against the authoritative headless World."""

import argparse
from concurrent.futures import ThreadPoolExecutor
import http.client
import json
import os
from pathlib import Path
import random
import subprocess
import sys
import time
from urllib.parse import urlsplit

import numpy as np
import torch
from torch import nn
from torch.distributions import Categorical
from teacher import primitive_action, teach


SIZES = [3, 3, 3, 2, 9]


class Environment:
    def __init__(self, args, number):
        self.number = number
        self.episode = 0
        self.args = args
        endpoint = urlsplit(args.environment_url)
        if endpoint.scheme != "http" or not endpoint.hostname:
            raise ValueError("Use the simulation server's http://host:port address")
        self.connection = http.client.HTTPConnection(endpoint.hostname, endpoint.port or 80, timeout=120)
        try:
            self.connection.request("GET", "/health")
            response = self.connection.getresponse()
            health = json.loads(response.read())
            if response.status != 200 or health.get("service") != "cdtank-learning" or health.get("protocol") != 1:
                raise RuntimeError("Endpoint is not a compatible learning simulation")
            self.source = health["source"]
        except BaseException:
            self.connection.close()
            raise

    def command(self, request):
        self.connection.request("POST", "/environment", body=json.dumps(request),
                                headers={"Content-Type": "application/json"})
        response = self.connection.getresponse()
        result = json.loads(response.read())
        if response.status != 200 or result.get("type") == "error":
            raise RuntimeError(f"Environment {self.number}: {result.get('error', response.status)}")
        return result

    def reset(self):
        seed = self.args.seed + self.number * 1000000 + self.episode
        self.episode += 1
        level = random.Random(seed).randint(0, self.args.level) if self.args.mix_levels else self.args.level
        return self.command({"type": "reset", "seed": seed, "mode": self.args.mode,
                             "mapId": self.args.map_id, "players": self.args.players,
                             "controlled": 1, "seconds": 60, "tankId": 1,
                             "ammoId": self.args.ammo_id,
                             "lesson": self.args.lesson, "level": level})

    def step(self, action):
        return self.command({"type": "step", "actions": [action]})

    def close(self):
        self.connection.close()


class Policy(nn.Module):
    def __init__(self, width):
        super().__init__()
        self.encoder = nn.Linear(width, 64)
        self.memory = nn.GRUCell(64, 64)
        self.actor = nn.Linear(64, sum(SIZES))
        self.critic = nn.Linear(64, 1)

    def forward(self, observation, hidden, reset, masks):
        hidden = self.memory(torch.tanh(self.encoder(observation)), hidden * (1 - reset[:, None]))
        logits = self.actor(hidden).masked_fill(~masks, -1e9)
        distributions = [Categorical(logits=part) for part in logits.split(SIZES, dim=-1)]
        return distributions, self.critic(hidden).squeeze(-1), hidden

    def warm_start(self, filename):
        prior = torch.load(filename, map_location="cpu")["policy"]
        with torch.no_grad():
            self.encoder.weight[:, :16].copy_(prior["encoder.0.weight"])
            self.encoder.weight[:, 16:].mul_(.1)
            self.encoder.bias.copy_(prior["encoder.0.bias"])
            for name in ("weight_ih", "weight_hh", "bias_ih", "bias_hh"):
                getattr(self.memory, name).copy_(prior[f"memory.{name}_l0"])
            self.actor.weight[:9].copy_(prior["actor.weight"])
            self.actor.bias[:9].copy_(prior["actor.bias"])

    def initialize(self, state):
        """Retain trained features while adding zero-initialized curriculum inputs."""
        state = dict(state)
        weight = state["encoder.weight"]
        if weight.shape[1] < self.encoder.in_features:
            expanded = torch.zeros_like(self.encoder.weight)
            expanded[:, :weight.shape[1]] = weight
            state["encoder.weight"] = expanded
        self.load_state_dict(state)


def tensors(results, device):
    frames = [result["frames"][0] for result in results]
    observations = torch.tensor([frame["observation"] for frame in frames], device=device)
    masks = torch.tensor([sum(frame["actionMasks"], []) for frame in frames], dtype=torch.bool, device=device)
    return observations, masks


def save_checkpoint(path, policy, optimizer, config, steps, update):
    temporary = path.with_suffix(".tmp")
    torch.save({"policy": policy.state_dict(), "optimizer": optimizer.state_dict(),
                "config": config, "steps": steps, "update": update}, temporary)
    temporary.replace(path)


def main(args):
    output = Path(args.output)
    output.mkdir(parents=True, exist_ok=False)
    cache = output.parent.parent / 'cache'
    cache.mkdir(exist_ok=True)
    os.environ['TEMP'] = str(cache)
    os.environ['TMP'] = str(cache)
    os.environ['TORCH_HOME'] = str(cache / 'torch')
    os.environ['XDG_CACHE_HOME'] = str(cache)
    random.seed(args.seed)
    np.random.seed(args.seed)
    torch.manual_seed(args.seed)
    torch.set_num_threads(2)
    if not torch.cuda.is_available():
        raise RuntimeError("CUDA is required")
    device = torch.device("cuda")
    environments = []
    try:
        for index in range(args.environments):
            environments.append(Environment(args, index))
        with ThreadPoolExecutor(max_workers=args.environments) as pool:
            results = list(pool.map(lambda env: env.reset(), environments))
            observations, masks = tensors(results, device)
            policy = Policy(observations.shape[-1]).to(device)
            if args.prior:
                policy.warm_start(args.prior)
            if args.weights:
                policy.initialize(torch.load(args.weights, map_location=device)["policy"])
            optimizer = torch.optim.Adam(policy.parameters(), lr=args.learning_rate, eps=1e-5)
            checkpoint = torch.load(args.resume, map_location=device) if args.resume else None
            if args.imitation_weight is None:
                if checkpoint:
                    prior_config = checkpoint["config"]
                    args.imitation_weight = prior_config.get("imitationWeight",
                        prior_config.get("imitation_weight", 0) if prior_config.get("teacher_steps", 0) else 0)
                else:
                    args.imitation_weight = .1 if args.teacher_steps else 0
            if args.imitation_weight and (args.lesson not in ("turning", "navigation", "aiming", "range")
                    or args.lesson == "navigation" and args.level > 2 or args.lesson == "range" and args.level > 1):
                raise ValueError("Auxiliary imitation requires a supported primitive lesson")
            config = {**vars(args), "torch": torch.__version__, "device": torch.cuda.get_device_name(0),
                      "observationWidth": observations.shape[-1], "actionSizes": SIZES,
                      "simulationHz": 20, "decisionHz": 10, "observationSchema": results[0]["frames"][0]["schema"],
                      "algorithm": "recurrent PPO", "hiddenSize": 64,
                      "imitationWeight": args.imitation_weight,
                      "teacherBootstrapSteps": args.teacher_steps if not args.resume else 0}
            source = Path(__file__).resolve().parents[2] / "source.json"
            config["source"] = json.loads(source.read_text(encoding="utf-8")) if source.exists() else None
            config["simulationSource"] = environments[0].source
            steps = 0
            update = 0
            if checkpoint:
                policy.load_state_dict(checkpoint["policy"])
                optimizer.load_state_dict(checkpoint["optimizer"])
                steps, update = checkpoint["steps"], checkpoint["update"]
            (output / "config.json").write_text(json.dumps(config, indent=2), encoding="utf-8")
            if args.teacher_steps and not args.resume:
                teacher_optimizer = torch.optim.Adam(policy.parameters(), lr=.001)
                results = teach(policy, teacher_optimizer, environments, pool, results,
                                args, device, output, tensors)
                save_checkpoint(output / "teacher.pt", policy, optimizer, config, 0, 0)
                observations, masks = tensors(results, device)
            hidden = torch.zeros(args.environments, 64, device=device)
            reset = torch.ones(args.environments, device=device)
            episode_returns = [0.0] * args.environments
            completed = 0
            started = time.monotonic()
            with (output / "metrics.jsonl").open("x", encoding="utf-8") as log:
                while steps < args.steps:
                    storage = {key: [] for key in ("x", "masks", "hidden", "reset", "actions", "logp", "value", "reward", "done")}
                    if args.imitation_weight:
                        storage["teacher"] = []
                    episodes = []
                    policy.eval()
                    for _ in range(args.rollout):
                        with torch.no_grad():
                            distributions, value, next_hidden = policy(observations, hidden, reset, masks)
                            actions = torch.stack([dist.sample() for dist in distributions], dim=-1)
                            logp = sum(dist.log_prob(actions[:, head]) for head, dist in enumerate(distributions))
                        for key, tensor in (("x", observations), ("masks", masks), ("hidden", hidden),
                                            ("reset", reset), ("actions", actions), ("logp", logp), ("value", value)):
                            storage[key].append(tensor)
                        if args.imitation_weight:
                            storage["teacher"].append(torch.tensor(
                                [primitive_action(result["frames"][0], args.lesson) for result in results], device=device))
                        action_list = actions.cpu().tolist()
                        next_results = list(pool.map(lambda pair: pair[0].step(pair[1]), zip(environments, action_list)))
                        done = torch.tensor([result["done"] for result in next_results], device=device, dtype=torch.float32)
                        reward = torch.tensor([result["rewards"][0] for result in next_results], device=device)
                        storage["reward"].append(reward)
                        storage["done"].append(done)
                        next_reset = []
                        for index, result in enumerate(next_results):
                            episode_returns[index] += result["rewards"][0]
                            died = result["frames"][0]["metrics"]["deaths"] != results[index]["frames"][0]["metrics"]["deaths"]
                            next_reset.append(float(result["done"] or died))
                            if result["done"]:
                                completed += 1
                                episodes.append({"return": episode_returns[index],
                                                 "seed": result["seed"], "lesson": result["lesson"],
                                                 "level": result["level"],
                                                 "success": result.get("success"),
                                                 "lessonMetrics": result.get("lessonMetrics"),
                                                 "metrics": result["frames"][0]["metrics"]})
                                episode_returns[index] = 0
                                next_results[index] = environments[index].reset()
                        results = next_results
                        observations, masks = tensors(results, device)
                        hidden = next_hidden
                        reset = torch.tensor(next_reset, device=device)
                        steps += args.environments
                    data = {key: torch.stack(values) for key, values in storage.items()}
                    with torch.no_grad():
                        _, next_value, _ = policy(observations, hidden, reset, masks)
                        advantages = torch.zeros_like(data["reward"])
                        gae = torch.zeros(args.environments, device=device)
                        for tick in reversed(range(args.rollout)):
                            continuation = 1 - data["done"][tick]
                            delta = data["reward"][tick] + .995 * next_value * continuation - data["value"][tick]
                            gae = delta + .995 * .95 * continuation * gae
                            advantages[tick] = gae
                            next_value = data["value"][tick]
                        returns = advantages + data["value"]
                        advantages = (advantages - advantages.mean()) / (advantages.std() + 1e-8)
                    chunks = [(env, start) for env in range(args.environments)
                              for start in range(0, args.rollout, 32)]
                    losses = []
                    policy.train()
                    for _ in range(args.epochs):
                        random.shuffle(chunks)
                        for offset in range(0, len(chunks), 8):
                            selected = chunks[offset:offset + 8]
                            states = torch.stack([data["hidden"][start, env] for env, start in selected])
                            actor_losses, critic_losses, entropies, divergences = [], [], [], []
                            imitation_losses = []
                            for relative in range(32):
                                env_indices = torch.tensor([env for env, start in selected], device=device)
                                ticks = torch.tensor([start + relative for env, start in selected], device=device)
                                ds, values, states = policy(data["x"][ticks, env_indices], states,
                                                           data["reset"][ticks, env_indices], data["masks"][ticks, env_indices])
                                chosen = data["actions"][ticks, env_indices]
                                new_logp = sum(dist.log_prob(chosen[:, head]) for head, dist in enumerate(ds))
                                old_logp = data["logp"][ticks, env_indices]
                                ratio = (new_logp - old_logp).exp()
                                advantage = advantages[ticks, env_indices]
                                actor_losses.append(-torch.minimum(ratio * advantage, ratio.clamp(.8, 1.2) * advantage).mean())
                                critic_losses.append((values - returns[ticks, env_indices]).square().mean())
                                entropies.append(sum(dist.entropy().mean() for dist in ds))
                                divergences.append(((ratio - 1) - (new_logp - old_logp)).mean().detach())
                                if args.imitation_weight:
                                    demonstrated = data["teacher"][ticks, env_indices]
                                    imitation_losses.append(-sum(dist.log_prob(demonstrated[:, head]).mean()
                                                                for head, dist in enumerate(ds)))
                            actor_loss = torch.stack(actor_losses).mean()
                            critic_loss = torch.stack(critic_losses).mean()
                            entropy = torch.stack(entropies).mean()
                            loss = actor_loss + .5 * critic_loss - .005 * entropy
                            imitation_loss = torch.stack(imitation_losses).mean() if imitation_losses else loss.new_zeros(())
                            loss += args.imitation_weight * imitation_loss
                            optimizer.zero_grad()
                            loss.backward()
                            nn.utils.clip_grad_norm_(policy.parameters(), .5)
                            optimizer.step()
                            losses.append([actor_loss.item(), critic_loss.item(), entropy.item(),
                                           torch.stack(divergences).mean().item(), imitation_loss.item()])
                    hidden = hidden.detach()
                    update += 1
                    row = {"update": update, "steps": steps, "seconds": time.monotonic() - started,
                           "completedEpisodes": completed, "losses": np.mean(losses, axis=0).tolist(),
                           "episodes": episodes, "rewardMean": data["reward"].mean().item()}
                    text = json.dumps(row)
                    print(text, flush=True)
                    log.write(text + "\n")
                    log.flush()
                    save_checkpoint(output / "latest.pt", policy, optimizer, config, steps, update)
                result = {"steps": steps, "updates": update, "seconds": time.monotonic() - started,
                          "completedEpisodes": completed, "readyForGameplay": False}
                (output / "result.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
    finally:
        for environment in environments:
            environment.close()
    evaluations = []
    levels = range(args.level + 1) if args.mix_levels else [args.level]
    for level in levels:
        destination = output / f"evaluation-level-{level}"
        subprocess.run([sys.executable, str(Path(__file__).with_name("evaluate.py")),
                        "--environment-url", args.environment_url,
                        "--checkpoint", str(output / "latest.pt"), "--output", str(destination),
                        "--lesson", args.lesson, "--level", str(level), "--mode", str(args.mode),
                        "--map-id", str(args.map_id), "--players", str(args.players),
                        "--ammo-id", str(args.ammo_id), "--episodes", str(args.evaluation_episodes),
                        "--seed", str(args.seed + 100000000)], check=True)
        evaluations.append({"level": level, "output": str(destination),
                            **json.loads((destination / "result.json").read_text(encoding="utf-8"))})
    result["evaluations"] = evaluations
    (output / "result.json").write_text(json.dumps(result, indent=2), encoding="utf-8")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--environment-url", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--prior")
    parser.add_argument("--resume")
    parser.add_argument("--weights", help="Initialize from an earlier curriculum stage with a fresh optimizer")
    parser.add_argument("--steps", type=int, default=1000000)
    parser.add_argument("--environments", type=int, default=4)
    parser.add_argument("--rollout", type=int, default=128)
    parser.add_argument("--epochs", type=int, default=4)
    parser.add_argument("--learning-rate", type=float, default=.00025)
    parser.add_argument("--mode", type=int, default=4)
    parser.add_argument("--map-id", type=int, default=7)
    parser.add_argument("--players", type=int, default=2)
    parser.add_argument("--ammo-id", type=int, default=2001)
    parser.add_argument("--lesson", choices=["turning", "navigation", "aiming", "shooting", "dodge", "range", "combat"], default="combat")
    parser.add_argument("--level", type=int, choices=range(4), default=1)
    parser.add_argument("--mix-levels", action="store_true", help="Replay levels zero through the selected level")
    parser.add_argument("--seed", type=int, default=179)
    parser.add_argument("--evaluation-episodes", type=int, default=32)
    parser.add_argument("--teacher-steps", type=int, default=0)
    parser.add_argument("--teacher-student-fraction", type=float, default=.75)
    parser.add_argument("--imitation-weight", type=float)
    args = parser.parse_args()
    if args.rollout % 32:
        parser.error("--rollout must be a multiple of 32")
    if args.teacher_steps and args.lesson not in ("turning", "navigation", "aiming", "range"):
        parser.error("Primitive demonstrations support turning, navigation, aiming and range")
    if args.teacher_steps and (args.lesson == "navigation" and args.level > 2
                               or args.lesson == "range" and args.level > 1):
        parser.error("Primitive demonstrations require direct navigation or non-shooting range levels")
    main(args)
