"""Train a recurrent PPO policy against the authoritative headless World."""

import argparse
from concurrent.futures import ThreadPoolExecutor
import http.client
import json
import os
from pathlib import Path
import random
import time
from urllib.parse import urlsplit

import numpy as np
import torch
from torch import nn
from torch.distributions import Categorical
from gpu_budget import GpuBudget
from teacher import teach, demonstration_actions, demonstration_loss, DemonstrationReplay
from human_style import HumanControlPrior


SIZES = [3, 3, 3, 2, 9]


def course_options(args):
    defaults = {"controlled": 1, "tank_id": 1}
    return [{key: course.get(key, getattr(args, key, defaults.get(key)))
             for key in ("lesson", "level", "mix_levels", "mode", "map_id", "tank_id", "players", "controlled", "ammo_id", "items")}
            for course in getattr(args, "courses", None) or [{}]]


class Environment:
    def __init__(self, args, number):
        self.number = number
        self.episode = 0
        self.args = args
        self.native_policy = getattr(args, "native_policy", None)
        courses = course_options(args)
        self.course = courses[number % len(courses)]
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

    def reset(self, seed=None):
        if seed is None:
            seed = self.args.seed + self.number * 1000000 + self.episode
        self.episode += 1
        course = self.course
        level = random.Random(seed).randint(0, course["level"]) if course["mix_levels"] else course["level"]
        request = {"type": "reset", "seed": seed, "mode": course["mode"],
                             "mapId": course["map_id"], "players": course["players"],
                             "controlled": course["controlled"], "seconds": 60, "tankId": course["tank_id"],
                             "ammoId": course["ammo_id"],
                             "items": course["items"],
                             "lesson": course["lesson"], "level": level}
        if course["lesson"] in ("combat", "siege") and course["mode"] <= 3 and course["controlled"] < course["players"]:
            request["learnerTeam"] = random.Random(seed + 104729).randrange(2)
        if getattr(self.args, "teacher_source", "primitive") == "cpu" and (self.args.teacher_steps or self.args.imitation_weight):
            request["expert"] = True
        if self.native_policy:
            request["nativePolicy"] = self.native_policy
        result = self.command(request)
        if "learnerTeam" in request and result.get("learnerTeam") != request["learnerTeam"]:
            raise RuntimeError("The simulation service must honor the requested learner team")
        result["lesson"] = course["lesson"]
        paths = getattr(self.args, "opponent_paths", None)
        self.opponent_index = random.Random(seed + 7919).randrange(len(paths)) if paths else None
        result["opponentIndex"] = self.opponent_index
        if course["lesson"] == "items" and result["frames"][0]["schema"] < 4:
            raise RuntimeError("Item courses require the simulation server with observation schema 4")
        return result

    def step(self, action):
        actions = [action] if action and isinstance(action[0], (int, float)) else action
        result = self.command({"type": "step", "actions": actions})
        result["opponentIndex"] = self.opponent_index
        return result

    def close(self):
        self.connection.close()


class Policy(nn.Module):
    def __init__(self, width, gpu_budget=None, central_width=0, hidden_size=64):
        super().__init__()
        self.gpu_budget = gpu_budget
        self.hidden_size = hidden_size
        self.encoder = nn.Linear(width, hidden_size)
        self.memory = nn.GRUCell(hidden_size, hidden_size)
        self._memory_flattened = False
        self.actor = nn.Linear(hidden_size, sum(SIZES))
        self.critic = nn.Linear(hidden_size, 1)
        self.mask_encoder = nn.Linear(sum(SIZES), hidden_size, bias=False)
        nn.init.zeros_(self.mask_encoder.weight)
        self.central_critic = nn.Sequential(nn.Linear(central_width, 128), nn.Tanh(),
            nn.Linear(128, 64), nn.Tanh(), nn.Linear(64, 1)) if central_width else None

    def forward(self, observation, hidden, reset, masks, central_state=None):
        if self.gpu_budget:
            self.gpu_budget.wait()
        features = self.encoder(observation) + self.mask_encoder(masks.to(observation.dtype))
        hidden = self.memory(torch.tanh(features), hidden * (1 - reset[:, None]))
        logits = self.actor(hidden).masked_fill(~masks, -1e9)
        distributions = [Categorical(logits=part) for part in logits.split(SIZES, dim=-1)]
        value = self.central_critic(central_state) if self.central_critic is not None and central_state is not None else self.critic(hidden.detach())
        return distributions, value.squeeze(-1), hidden

    def sequence(self, observation, hidden, reset, masks, central_state=None):
        """Batch truncated trajectories, splitting each actor at its memory resets."""
        if self.gpu_budget:
            self.gpu_budget.wait()
        features = torch.tanh(self.encoder(observation) + self.mask_encoder(masks.to(observation.dtype)))
        ticks, actors = reset.shape
        reset_rows = reset.detach().cpu().bool().tolist()
        segments = []
        for actor in range(actors):
            boundaries = [0] + [tick for tick in range(1, ticks) if reset_rows[tick][actor]] + [ticks]
            segments.extend((end - start, actor, start, end) for start, end in zip(boundaries, boundaries[1:]))
        segments.sort(key=lambda entry: entry[0], reverse=True)
        lengths, actor_indices, starts, _ = np.asarray(segments, dtype=np.int64).T
        offsets = np.arange(lengths[0], dtype=np.int64)[:, None]
        active = offsets < lengths[None, :]
        positions = torch.as_tensor(((starts[None, :] + offsets) * actors
                                     + actor_indices[None, :])[active], device=features.device)
        batch_sizes = torch.from_numpy(active.sum(axis=1, dtype=np.int64))
        packed_features = features.reshape(-1, self.hidden_size).index_select(0, positions)
        selected_actors = torch.as_tensor(actor_indices.copy(), device=hidden.device)
        keep_initial = torch.tensor([start == 0 and not reset_rows[0][actor]
                                     for _, actor, start, _ in segments], device=hidden.device, dtype=hidden.dtype)
        initial = (hidden.index_select(0, selected_actors) * keep_initial[:, None]).unsqueeze(0)
        # PyTorch 2.3's packed GRU operator uses the GRUCell parameter layout.
        weights = [self.memory.weight_ih, self.memory.weight_hh, self.memory.bias_ih, self.memory.bias_hh]
        if observation.is_cuda and not self._memory_flattened:
            with torch.no_grad():
                torch._cudnn_rnn_flatten_weight(weights, 4, self.hidden_size, 3, self.hidden_size, 0, 1, False, False)
            self._memory_flattened = True
        output, _ = torch._VF.gru(packed_features, batch_sizes, initial, weights, True, 1, 0., self.training, False)
        states = output.new_zeros(ticks * actors, self.hidden_size).index_copy(0, positions, output).reshape(ticks, actors, self.hidden_size)
        logits = self.actor(states).masked_fill(~masks, -1e9)
        distributions = [Categorical(logits=part) for part in logits.split(SIZES, dim=-1)]
        value = self.central_critic(central_state) if self.central_critic is not None and central_state is not None else self.critic(states.detach())
        return distributions, value.squeeze(-1), states[-1]

    def warm_start(self, filename):
        if self.hidden_size != 64:
            prior_policy = Policy(self.encoder.in_features)
            prior_policy.warm_start(filename)
            self.initialize(prior_policy.state_dict())
            return
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
        """Preserve prior actor outputs while expanding inputs or recurrent capacity."""
        state = dict(state)
        weight = state["encoder.weight"]
        old_hidden, old_width = weight.shape
        if old_hidden > self.hidden_size or old_width > self.encoder.in_features:
            raise ValueError("Policy initialization cannot shrink trained dimensions")
        if old_hidden != self.hidden_size or old_width != self.encoder.in_features:
            expanded = self.encoder.weight.detach().clone()
            expanded[:old_hidden].zero_()
            expanded[:old_hidden, :old_width] = weight
            state["encoder.weight"] = expanded
        state.setdefault("mask_encoder.weight", torch.zeros_like(self.mask_encoder.weight))
        if old_hidden < self.hidden_size:
            for name in ("encoder.bias", "mask_encoder.weight"):
                expanded = self.state_dict()[name].clone()
                expanded[:old_hidden] = state[name][:old_hidden]
                state[name] = expanded
            for suffix in ("weight_ih", "weight_hh", "bias_ih", "bias_hh"):
                name = f"memory.{suffix}"
                expanded = self.state_dict()[name].clone()
                for gate in range(3):
                    start, before = gate * self.hidden_size, gate * old_hidden
                    if suffix.startswith("weight"):
                        expanded[start:start + old_hidden].zero_()
                        expanded[start:start + old_hidden, :old_hidden] = state[name][before:before + old_hidden]
                    else:
                        expanded[start:start + old_hidden] = state[name][before:before + old_hidden]
                state[name] = expanded
            for name in ("actor.weight", "critic.weight"):
                expanded = torch.zeros_like(self.state_dict()[name])
                expanded[:, :old_hidden] = state[name]
                state[name] = expanded
        for name, value in self.state_dict().items():
            if name.startswith("central_critic."):
                state.setdefault(name, value)
        self.load_state_dict(state)


def tensors(results, device):
    frames = [frame for result in results for frame in result["frames"]]
    observations = torch.tensor([frame["observation"] for frame in frames], device=device)
    masks = torch.tensor([sum(frame["actionMasks"], []) for frame in frames], dtype=torch.bool, device=device)
    return observations, masks


def critic_tensors(results, device):
    return torch.tensor([state for result in results for state in result["criticStates"]], device=device)


class OpponentPool:
    """Frozen historical actors on team one, with independent recurrent state."""
    def __init__(self, paths, width, budget, device):
        self.policies = []
        self.sources = []
        for path in paths or []:
            checkpoint = torch.load(path, map_location=device)
            policy = Policy(width, budget, checkpoint.get("config", {}).get("centralStateWidth", 0),
                            checkpoint.get("config", {}).get("hiddenSize", 64)).to(device).eval()
            policy.initialize(checkpoint["policy"])
            policy.requires_grad_(False)
            self.policies.append(policy)
            self.sources.append({"path": path, "steps": checkpoint["steps"],
                                 "source": checkpoint.get("config", {}).get("source"),
                                 "simulationSource": checkpoint.get("config", {}).get("simulationSource")})
        self.hidden_size = max((policy.hidden_size for policy in self.policies), default=64)

    def act(self, results, observation, masks, reset, hidden, actions):
        if not self.policies:
            return hidden
        for number, policy in enumerate(self.policies):
            indices = []
            offset = 0
            for result in results:
                if result["opponentIndex"] == number:
                    indices.extend(offset + index for index, frame in enumerate(result["frames"])
                                   if frame["metrics"]["team"] == 1)
                offset += len(result["frames"])
            if not indices:
                continue
            selected = torch.tensor(indices, device=observation.device)
            distributions, _, state = policy(observation[selected], hidden[selected, :policy.hidden_size], reset[selected], masks[selected])
            actions[selected] = torch.stack([dist.logits.argmax(dim=-1) for dist in distributions], dim=-1)
            hidden[selected, :policy.hidden_size] = state
        return hidden


def save_checkpoint(path, policy, optimizer, config, steps, update):
    temporary = path.with_suffix(".tmp")
    torch.save({"policy": policy.state_dict(), "optimizer": optimizer.state_dict(),
                "config": config, "steps": steps, "update": update}, temporary)
    temporary.replace(path)


def main(args):
    args.teacher_source = getattr(args, "teacher_source", "primitive")
    args.teacher_replay_sequences = getattr(args, "teacher_replay_sequences", 4096)
    args.teacher_batch_sequences = getattr(args, "teacher_batch_sequences", 256)
    args.teacher_epochs = getattr(args, "teacher_epochs", 2)
    args.teacher_learning_rate = getattr(args, "teacher_learning_rate", .001)
    args.direction_label_weight = getattr(args, "direction_label_weight", 1.)
    args.rehearsal = getattr(args, "rehearsal", None)
    args.rehearsal_weight = getattr(args, "rehearsal_weight", 3.)
    args.rehearsal_batch_sequences = getattr(args, "rehearsal_batch_sequences", 32)
    args.rehearsal_references = getattr(args, "rehearsal_references", None)
    args.rehearsal_reference_weight = getattr(args, "rehearsal_reference_weight", 10.)
    args.policy_reference = getattr(args, "policy_reference", None)
    args.policy_reference_weight = getattr(args, "policy_reference_weight", 1.)
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
    budget = GpuBudget(args.gpu_utilization_limit, output)
    environments = []
    try:
        for index in range(args.environments):
            environments.append(Environment(args, index))
        with ThreadPoolExecutor(max_workers=args.environments) as pool:
            results = list(pool.map(lambda env: env.reset(), environments))
            actors_per_world = len(results[0]["frames"])
            if any(len(result["frames"]) != actors_per_world for result in results):
                raise ValueError("Courses in one run must control the same number of actors")
            agents = args.environments * actors_per_world
            human_style = HumanControlPrior(args.human_control_profile, environments, actors_per_world) \
                if getattr(args, "human_control_profile", None) else None
            observations, masks = tensors(results, device)
            centralized = getattr(args, "centralized_critic", False)
            central = critic_tensors(results, device) if centralized else None
            central_width = central.shape[-1] if centralized else 0
            initial_path = args.resume or args.weights
            initial = torch.load(initial_path, map_location=device) if initial_path else None
            hidden_size = getattr(args, "hidden_size", None) or (initial["config"].get("hiddenSize", 64) if initial else 64)
            args.hidden_size = hidden_size
            policy = Policy(observations.shape[-1], budget, central_width, hidden_size).to(device)
            reference = None
            reference_source = None
            if args.policy_reference:
                saved_reference = torch.load(args.policy_reference, map_location=device)
                reference_width = saved_reference["policy"]["encoder.weight"].shape[1]
                if reference_width > observations.shape[-1]:
                    raise ValueError("Policy reference observations must be available in the current simulation")
                reference = Policy(reference_width, budget, saved_reference["config"].get("centralStateWidth", 0),
                    saved_reference["config"].get("hiddenSize", 64)).to(device).eval()
                reference.initialize(saved_reference["policy"])
                reference.requires_grad_(False)
                reference_source = {"path": args.policy_reference, "steps": saved_reference["steps"],
                    "source": saved_reference["config"].get("source"), "observationWidth": reference_width,
                    "hiddenSize": reference.hidden_size, "executionUsesPrivilegedState": False}
                del saved_reference
            rehearsal = DemonstrationReplay(args.rehearsal, args.rehearsal_batch_sequences, device,
                observations.shape[-1], results[0]["frames"][0]["schema"]) if args.rehearsal else None
            opponent_paths = getattr(args, "opponent_paths", None)
            opponents = OpponentPool(opponent_paths, observations.shape[-1], budget, device)
            trainable = [index for index, frame in enumerate(frame for result in results for frame in result["frames"])
                         if not opponent_paths or frame["metrics"]["team"] == 0]
            trained_agents = len(trainable)
            trained_per_world = trained_agents // args.environments
            if opponent_paths and any(course["mode"] > 3 or course["controlled"] != course["players"]
                                      or course["lesson"] != "combat" for course in course_options(args)):
                raise ValueError("Historical opponents require all team-mode combat actors to be controlled")
            if args.prior:
                policy.warm_start(args.prior)
            initialization = None
            if args.weights:
                policy.initialize(initial["policy"])
                old_width = initial["policy"]["encoder.weight"].shape[1]
                old_hidden = initial["config"].get("hiddenSize", 64)
                if old_hidden != hidden_size:
                    initial_actor = Policy(old_width, budget, initial["config"].get("centralStateWidth", 0), old_hidden).to(device).eval()
                    initial_actor.initialize(initial["policy"])
                    with torch.no_grad():
                        prior_ds, _, _ = initial_actor(observations[:, :old_width], torch.zeros(agents, old_hidden, device=device),
                                                   torch.ones(agents, device=device), masks)
                        expanded_ds, _, _ = policy(observations, torch.zeros(agents, hidden_size, device=device),
                                                   torch.ones(agents, device=device), masks)
                        mismatches = sum((old.logits.argmax(-1) != new.logits.argmax(-1)).sum().item()
                                         for old, new in zip(prior_ds, expanded_ds))
                        error = max((old.logits - new.logits).abs().max().item() for old, new in zip(prior_ds, expanded_ds))
                    initialization = {"previousHiddenSize": old_hidden, "hiddenSize": hidden_size,
                                      "actualResetActors": agents, "actionHeadMismatches": mismatches,
                                      "maximumLogitError": error}
                    del initial_actor, prior_ds, expanded_ds
            optimizer = torch.optim.Adam([
                {"params": [value for name, value in policy.named_parameters() if name != "mask_encoder.weight"]},
                {"params": policy.mask_encoder.parameters()}], lr=args.learning_rate, eps=1e-5)
            checkpoint = initial if args.resume else None
            if args.imitation_weight is None:
                if checkpoint:
                    prior_config = checkpoint["config"]
                    args.imitation_weight = prior_config.get("imitationWeight",
                        prior_config.get("imitation_weight", 0) if prior_config.get("teacher_steps", 0) else 0)
                else:
                    args.imitation_weight = .1 if args.teacher_steps else 0
            if args.teacher_source == "cpu" and any(course["lesson"] != "combat" for course in course_options(args)):
                raise ValueError("CPU demonstrations require ordinary combat courses")
            if args.imitation_weight and args.teacher_source == "primitive" and any(course["lesson"] not in ("turning", "navigation", "aiming", "shooting", "dodge", "range", "items", "siege", "destruction")
                    or course["lesson"] == "navigation" and course["level"] > 2
                    or course["lesson"] in ("items", "siege", "destruction") and course["level"] > 2 for course in course_options(args)):
                raise ValueError("Auxiliary imitation requires a supported primitive lesson")
            if actors_per_world > 1 and args.teacher_source == "primitive" and (args.teacher_steps or args.imitation_weight):
                raise ValueError("Primitive imitation supports one controlled actor per world")
            config = {**vars(args), "torch": torch.__version__, "device": torch.cuda.get_device_name(0),
                      "observationWidth": observations.shape[-1], "actionSizes": SIZES,
                      "simulationHz": 20, "decisionHz": 10, "observationSchema": results[0]["frames"][0]["schema"],
                      "algorithm": "recurrent MAPPO" if centralized else "recurrent PPO", "hiddenSize": hidden_size,
                      "sequenceBackend": "PyTorch 2.3 packed GRU with actor reset segments",
                      "actorsPerWorld": actors_per_world, "actorBatchSize": agents,
                      "trainedActorsPerWorld": trained_per_world, "trainedActorBatchSize": trained_agents,
                      "opponentPaths": opponent_paths,
                      "opponentCheckpoints": opponents.sources,
                      "centralStateWidth": central_width,
                      "localCriticInput": "detached actor state",
                      "parameters": sum(parameter.numel() for parameter in policy.parameters()),
                      "initialization": initialization,
                      "rehearsalSource": rehearsal.source if rehearsal else None,
                      "policyReferenceSource": reference_source,
                      "humanControlSource": human_style.source if human_style else None,
                      "initialCheckpoint": {"steps": initial["steps"],
                          "teacherProgress": initial["config"].get("teacherProgress"),
                          "source": initial["config"].get("source"),
                          "simulationSource": initial["config"].get("simulationSource")} if initial else None,
                      "controlledRoster": results[0].get("actors"),
                      "maskInputWidth": sum(SIZES), "trainingCourses": course_options(args),
                      "imitationWeight": args.imitation_weight,
                      "demonstrationSource": "scripted HIGH CPU with navigation and team context" if args.teacher_source == "cpu"
                          else "scripted primitive control",
                      "actorUsesPrivilegedState": False,
                      "demonstrationUsesPrivilegedState": args.teacher_source == "cpu",
                      "imitationEventWeights": {"movement": 3, "fire": 5, "consumable": 30, "other": 1},
                      "teacherBootstrapSteps": args.teacher_steps if not args.resume else 0}
            source = Path(__file__).resolve().parents[2] / "source.json"
            config["source"] = json.loads(source.read_text(encoding="utf-8")) if source.exists() else None
            config["simulationSource"] = environments[0].source
            steps = 0
            update = 0
            if checkpoint:
                if (checkpoint["policy"]["encoder.weight"].shape[1] != observations.shape[-1]
                        or checkpoint["config"].get("centralStateWidth", 0) != central_width
                        or checkpoint["config"].get("hiddenSize", 64) != hidden_size):
                    raise ValueError("Resume needs the same observation width and critic architecture; use --weights for a new stage")
                policy.initialize(checkpoint["policy"])
                optimizer_state = checkpoint["optimizer"]
                if len(optimizer_state["param_groups"]) == 1:
                    optimizer_state["param_groups"].append(optimizer.state_dict()["param_groups"][1])
                optimizer.load_state_dict(optimizer_state)
                steps, update = checkpoint["steps"], checkpoint["update"]
            if rehearsal:
                references = json.loads(Path(args.rehearsal_references).read_text(encoding="utf-8-sig")) \
                    if args.rehearsal_references else None
                rehearsal.prepare_references(policy, references)
                config["rehearsalReferenceSources"] = rehearsal.reference_sources
                config["rehearsalControlLabelSource"] = "frozen reference argmax" if references else rehearsal.source["labelSource"]
            (output / "config.json").write_text(json.dumps(config, indent=2), encoding="utf-8")
            save_checkpoint(output / "initial.pt", policy, optimizer, config, steps, update)
            if args.teacher_steps and not args.resume:
                teacher_optimizer = torch.optim.Adam(policy.parameters(), lr=args.teacher_learning_rate)
                results = teach(policy, teacher_optimizer, environments, pool, results,
                                args, device, output, tensors,
                                lambda progressed: save_checkpoint(output / "teacher-latest.pt", policy, optimizer,
                                    {**config, "teacherProgress": progressed}, 0, 0))
                save_checkpoint(output / "teacher.pt", policy, optimizer, config, 0, 0)
                observations, masks = tensors(results, device)
            hidden = torch.zeros(agents, hidden_size, device=device)
            opponent_hidden = torch.zeros(agents, opponents.hidden_size, device=device)
            reference_hidden = torch.zeros(agents, reference.hidden_size, device=device) if reference else None
            reset = torch.ones(agents, device=device)
            episode_returns = [[0.0] * actors_per_world for _ in environments]
            completed = 0
            started = time.monotonic()
            with (output / "metrics.jsonl").open("x", encoding="utf-8") as log:
                while steps < args.steps:
                    storage = {key: [] for key in ("x", "masks", "hidden", "reset", "actions", "logp", "value", "reward", "done")}
                    if centralized:
                        storage["central"] = []
                    if args.imitation_weight:
                        storage["teacher"] = []
                    if reference:
                        storage["reference"] = []
                    if human_style:
                        storage["human_style_reward"] = []
                    episodes = []
                    policy.eval()
                    for _ in range(args.rollout):
                        with torch.no_grad():
                            distributions, value, next_hidden = policy(observations, hidden, reset, masks, central)
                            actions = torch.stack([dist.sample() for dist in distributions], dim=-1)
                            opponent_hidden = opponents.act(results, observations, masks, reset, opponent_hidden, actions)
                            logp = sum(dist.log_prob(actions[:, head]) for head, dist in enumerate(distributions))
                            if reference:
                                targets, _, reference_hidden = reference(observations[:, :reference_width],
                                    reference_hidden, reset, masks)
                                storage["reference"].append(torch.cat([target.probs for target in targets], dim=-1))
                        for key, tensor in (("x", observations), ("masks", masks), ("hidden", hidden),
                                            ("reset", reset), ("actions", actions), ("logp", logp), ("value", value)):
                            storage[key].append(tensor)
                        if centralized:
                            storage["central"].append(central)
                        if args.imitation_weight:
                            storage["teacher"].append(torch.tensor(
                                demonstration_actions(results, args.teacher_source), device=device))
                        action_list = actions.reshape(args.environments, actors_per_world, len(SIZES)).cpu().tolist()
                        next_results = list(pool.map(lambda pair: pair[0].step(pair[1]), zip(environments, action_list)))
                        done = torch.tensor([result["done"] for result in next_results for _ in result["frames"]],
                                            device=device, dtype=torch.float32)
                        reward = torch.tensor([reward for result in next_results for reward in result["rewards"]],
                                              device=device, dtype=torch.float32)
                        if human_style:
                            style_reward = torch.tensor(human_style.rewards(results, next_results, action_list), device=device)
                            style_reward *= args.human_control_weight
                            reward += style_reward
                            storage["human_style_reward"].append(style_reward)
                        storage["reward"].append(reward)
                        storage["done"].append(done)
                        next_reset = []
                        for index, result in enumerate(next_results):
                            for actor, frame in enumerate(result["frames"]):
                                episode_returns[index][actor] += result["rewards"][actor]
                                died = frame["metrics"]["deaths"] != results[index]["frames"][actor]["metrics"]["deaths"]
                                next_reset.append(float(result["done"] or died))
                            if result["done"]:
                                completed += 1
                                episodes.append({"return": float(np.mean(episode_returns[index])),
                                                 "actorReturns": episode_returns[index],
                                                 "seed": result["seed"], "lesson": result["lesson"],
                                                 "level": result["level"],
                                                 "success": result.get("success"),
                                                 "lessonMetrics": result.get("lessonMetrics"),
                                                 "metrics": result["frames"][0]["metrics"],
                                                 "actorMetrics": [frame["metrics"] for frame in result["frames"]],
                                                 "actorItemMetrics": result.get("actorItemMetrics"),
                                                 "learnedTeam": result["frames"][0]["metrics"]["team"],
                                                 "outcomes": result.get("outcomes")})
                                episode_returns[index] = [0.0] * actors_per_world
                                next_results[index] = environments[index].reset()
                        results = next_results
                        observations, masks = tensors(results, device)
                        central = critic_tensors(results, device) if centralized else None
                        hidden = next_hidden
                        reset = torch.tensor(next_reset, device=device)
                        steps += trained_agents
                    data = {key: torch.stack(values) for key, values in storage.items()}
                    with torch.no_grad():
                        _, next_value, _ = policy(observations, hidden, reset, masks, central)
                        advantages = torch.zeros_like(data["reward"])
                        gae = torch.zeros(agents, device=device)
                        for tick in reversed(range(args.rollout)):
                            continuation = 1 - data["done"][tick]
                            delta = data["reward"][tick] + .995 * next_value * continuation - data["value"][tick]
                            gae = delta + .995 * .95 * continuation * gae
                            advantages[tick] = gae
                            next_value = data["value"][tick]
                        returns = advantages + data["value"]
                        trained_advantages = advantages[:, trainable]
                        advantages = (advantages - trained_advantages.mean()) / (trained_advantages.std() + 1e-8)
                    chunks = [(env, start) for env in trainable
                              for start in range(0, args.rollout, 32)]
                    losses = []
                    rehearsal_losses = []
                    reference_losses = []
                    reference_mismatches = []
                    policy_reference_losses = []
                    policy.train()
                    for _ in range(args.epochs):
                        random.shuffle(chunks)
                        for offset in range(0, len(chunks), args.minibatch_sequences):
                            selected = chunks[offset:offset + args.minibatch_sequences]
                            states = torch.stack([data["hidden"][start, env] for env, start in selected])
                            env_indices = torch.tensor([env for env, start in selected], device=device)
                            starts = torch.tensor([start for env, start in selected], device=device)
                            ticks = starts[None, :] + torch.arange(32, device=device)[:, None]
                            ds, values, states = policy.sequence(data["x"][ticks, env_indices], states,
                                data["reset"][ticks, env_indices], data["masks"][ticks, env_indices],
                                data["central"][ticks, env_indices] if centralized else None)
                            chosen = data["actions"][ticks, env_indices]
                            new_logp = sum(dist.log_prob(chosen[..., head]) for head, dist in enumerate(ds))
                            old_logp = data["logp"][ticks, env_indices]
                            ratio = (new_logp - old_logp).exp()
                            advantage = advantages[ticks, env_indices]
                            actor_loss = -torch.minimum(ratio * advantage, ratio.clamp(.8, 1.2) * advantage).mean()
                            critic_loss = (values - returns[ticks, env_indices]).square().mean()
                            entropy = sum(dist.entropy().mean() for dist in ds)
                            divergence = ((ratio - 1) - (new_logp - old_logp)).mean().detach()
                            loss = actor_loss + .5 * critic_loss - .005 * entropy
                            imitation_loss = demonstration_loss(ds, data["teacher"][ticks, env_indices],
                                args.direction_label_weight) if args.imitation_weight else loss.new_zeros(())
                            loss += args.imitation_weight * imitation_loss
                            if reference:
                                targets = data["reference"][ticks, env_indices].split(SIZES, dim=-1)
                                policy_reference_loss = sum((target * (target.clamp_min(1e-9).log()
                                    - distribution.logits)).sum(-1).mean() for target, distribution in zip(targets, ds))
                                loss += args.policy_reference_weight * policy_reference_loss
                                policy_reference_losses.append(policy_reference_loss.item())
                            if rehearsal:
                                rehearsal_loss, reference_loss, mismatch = rehearsal.loss(policy,
                                    use_reference_actions=bool(args.rehearsal_references))
                                loss += args.rehearsal_weight * rehearsal_loss
                                loss += args.rehearsal_reference_weight * reference_loss
                                rehearsal_losses.append(rehearsal_loss.item())
                                reference_losses.append(reference_loss.item())
                                reference_mismatches.append(mismatch.item())
                            optimizer.zero_grad()
                            budget.wait()
                            loss.backward()
                            nn.utils.clip_grad_norm_(policy.parameters(), .5)
                            optimizer.step()
                            budget.wait()
                            losses.append([actor_loss.item(), critic_loss.item(), entropy.item(),
                                           divergence.item(), imitation_loss.item()])
                    hidden = hidden.detach()
                    update += 1
                    row = {"update": update, "steps": steps, "seconds": time.monotonic() - started,
                           "gpuMemoryAllocatedMiB": torch.cuda.memory_allocated() / 1048576,
                           "gpuMemoryReservedMiB": torch.cuda.memory_reserved() / 1048576,
                           "gpuPeakMemoryAllocatedMiB": torch.cuda.max_memory_allocated() / 1048576,
                           "worldSteps": steps // trained_per_world, "actorsPerWorld": actors_per_world,
                           "actorBatchSize": agents,
                           "trainedActorBatchSize": trained_agents,
                           "gpuPercent": budget.utilization, "gpuPausedSeconds": budget.paused_seconds,
                           "completedEpisodes": completed, "losses": np.mean(losses, axis=0).tolist(),
                           "rehearsalLossMean": float(np.mean(rehearsal_losses)) if rehearsal_losses else None,
                           "rehearsalReferenceKlMean": float(np.mean(reference_losses)) if reference_losses else None,
                           "rehearsalReferenceHeadMismatchRate": float(np.mean(reference_mismatches)) if reference_mismatches else None,
                           "policyReferenceKlMean": float(np.mean(policy_reference_losses)) if policy_reference_losses else None,
                           "humanControlRewardMean": data["human_style_reward"][:, trainable].mean().item() if human_style else None,
                           "episodes": episodes, "rewardMean": data["reward"][:, trainable].mean().item()}
                    text = json.dumps(row)
                    print(text, flush=True)
                    log.write(text + "\n")
                    log.flush()
                    save_checkpoint(output / "latest.pt", policy, optimizer, config, steps, update)
                save_checkpoint(output / "latest.pt", policy, optimizer, config, steps, update)
                result = {"steps": steps, "updates": update, "seconds": time.monotonic() - started,
                          "completedEpisodes": completed, "readyForGameplay": False}
                (output / "result.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
    finally:
        for environment in environments:
            environment.close()
        budget.close()
    evaluations = []
    from evaluate import main as evaluate_policy

    for number, course in enumerate(course_options(args)):
        levels = range(course["level"] + 1) if course["mix_levels"] else [course["level"]]
        for level in levels:
            prefix = f"evaluation-course-{number}-" if args.courses else "evaluation-"
            destination = output / f"{prefix}level-{level}"
            summary = evaluate_policy(argparse.Namespace(**{**course, "level": level, "mix_levels": False,
                "environment_url": args.environment_url, "checkpoint": str(output / "latest.pt"),
                "output": str(destination), "episodes": args.evaluation_episodes,
                "environments": args.evaluation_environments, "stochastic": False,
                "device": "cpu",
                "opponent_paths": opponent_paths,
                "gpu_utilization_limit": args.gpu_utilization_limit, "seed": args.seed + 100000000}))
            evaluations.append({**course, "level": level, "output": str(destination),
                                **summary})
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
    parser.add_argument("--minibatch-sequences", type=int, default=8)
    parser.add_argument("--hidden-size", type=int, choices=(64, 128, 256))
    parser.add_argument("--gpu-utilization-limit", type=int, default=80)
    parser.add_argument("--learning-rate", type=float, default=.00025)
    parser.add_argument("--mode", type=int, default=4)
    parser.add_argument("--map-id", type=int, default=7)
    parser.add_argument("--tank-id", type=int, default=1)
    parser.add_argument("--players", type=int, default=2)
    parser.add_argument("--controlled", type=int, default=1)
    parser.add_argument("--centralized-critic", action="store_true")
    parser.add_argument("--opponent-pool", help="JSON list of frozen historical checkpoint paths")
    parser.add_argument("--ammo-id", type=int, default=2001)
    parser.add_argument("--lesson", choices=["turning", "navigation", "aiming", "shooting", "dodge", "range", "items", "siege", "destruction", "combat"], default="combat")
    parser.add_argument("--level", type=int, choices=range(4), default=1)
    parser.add_argument("--mix-levels", action="store_true", help="Replay levels zero through the selected level")
    parser.add_argument("--seed", type=int, default=179)
    parser.add_argument("--evaluation-episodes", type=int, default=32)
    parser.add_argument("--evaluation-environments", type=int, default=8)
    parser.add_argument("--teacher-steps", type=int, default=0)
    parser.add_argument("--teacher-source", choices=("primitive", "cpu"), default="primitive")
    parser.add_argument("--teacher-replay-sequences", type=int, default=4096)
    parser.add_argument("--teacher-batch-sequences", type=int, default=256)
    parser.add_argument("--teacher-epochs", type=int, default=2)
    parser.add_argument("--teacher-learning-rate", type=float, default=.001)
    parser.add_argument("--direction-label-weight", type=float, default=1.,
                        help="Weight active body and turret turn labels during online imitation")
    parser.add_argument("--teacher-student-fraction", type=float, default=.75)
    parser.add_argument("--imitation-weight", type=float)
    parser.add_argument("--curriculum", help="JSON list of courses assigned evenly across environments")
    parser.add_argument("--rehearsal", help="Collected foundation sequences.npz for skill retention during PPO")
    parser.add_argument("--rehearsal-weight", type=float, default=3.)
    parser.add_argument("--rehearsal-batch-sequences", type=int, default=32)
    parser.add_argument("--rehearsal-references", help="JSON list of fixed teacher checkpoints, in rehearsal course order")
    parser.add_argument("--rehearsal-reference-weight", type=float, default=10.)
    parser.add_argument("--policy-reference", help="Frozen actor that labels the current PPO world's full observation history")
    parser.add_argument("--policy-reference-weight", type=float, default=1.)
    parser.add_argument("--human-control-profile", help="Fixed 500 ms human control transition profile")
    parser.add_argument("--human-control-weight", type=float, default=.02)
    parser.add_argument("--items", type=json.loads, help="Override the lesson loadout with a JSON list of slot/itemTableId/quantity")
    args = parser.parse_args()
    args.opponent_paths = json.loads(Path(args.opponent_pool).read_text(encoding="utf-8-sig")) if args.opponent_pool else None
    if args.opponent_paths is not None and (not isinstance(args.opponent_paths, list) or not args.opponent_paths):
        parser.error("The opponent pool must contain checkpoint paths")
    args.courses = json.loads(Path(args.curriculum).read_text(encoding="utf-8-sig")) if args.curriculum else None
    if args.courses is not None and (not isinstance(args.courses, list) or not args.courses
                                    or args.environments < len(args.courses)):
        parser.error("The curriculum needs at least one environment per course")
    if args.rollout % 32:
        parser.error("--rollout must be a multiple of 32")
    if args.minibatch_sequences < 1:
        parser.error("--minibatch-sequences must be positive")
    if args.rehearsal and (args.rehearsal_batch_sequences < 1 or args.rehearsal_weight <= 0
                          or args.rehearsal_reference_weight <= 0):
        parser.error("Rehearsal needs a positive batch size and loss weight")
    if args.policy_reference and args.policy_reference_weight <= 0:
        parser.error("Policy reference loss weight must be positive")
    if args.human_control_profile and args.human_control_weight <= 0:
        parser.error("Human control reward weight must be positive")
    if min(args.teacher_replay_sequences, args.teacher_batch_sequences, args.teacher_epochs) < 1:
        parser.error("Teacher replay, batch size and epochs must be positive")
    if args.direction_label_weight <= 0:
        parser.error("Direction label weight must be positive")
    if args.teacher_learning_rate <= 0:
        parser.error("Teacher learning rate must be positive")
    if args.evaluation_environments < 1 or args.evaluation_episodes < 1:
        parser.error("Evaluation episodes and environments must be positive")
    for course in course_options(args):
        if not 1 <= course["controlled"] <= course["players"] <= 6:
            parser.error("Each course needs one to six controlled actors within the room size")
        if course["lesson"] not in ("turning", "navigation", "aiming", "shooting", "dodge", "range", "items", "siege", "destruction", "combat") or course["level"] not in range(4):
            parser.error("Each course needs a supported lesson and level")
        if args.teacher_steps and args.teacher_source == "primitive" and (course["lesson"] not in ("turning", "navigation", "aiming", "shooting", "dodge", "range", "items", "siege", "destruction")
                or course["lesson"] == "navigation" and course["level"] > 2
                or course["lesson"] in ("items", "siege", "destruction") and course["level"] > 2):
            parser.error("Primitive demonstrations require supported basic movement, shooting, dodge, range or item courses")
    main(args)
