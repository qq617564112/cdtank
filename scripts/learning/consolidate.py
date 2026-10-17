"""Distill fixed skill specialists into one recurrent actor using recorded worlds."""

import argparse
import json
import os
from pathlib import Path
import random
import time

import torch
from torch import nn

from gpu_budget import GpuBudget
from teacher import DemonstrationReplay
from train_combat import Policy, save_checkpoint


def main(args):
    output = Path(args.output)
    output.mkdir(parents=True, exist_ok=False)
    cache = output.parent.parent / "cache"
    cache.mkdir(exist_ok=True)
    os.environ["TEMP"] = str(cache)
    os.environ["TMP"] = str(cache)
    random.seed(args.seed)
    torch.manual_seed(args.seed)
    torch.set_num_threads(2)
    if not torch.cuda.is_available():
        raise RuntimeError("CUDA is required")
    device = torch.device("cuda")
    budget = GpuBudget(args.gpu_utilization_limit, output)
    try:
        initial = torch.load(args.weights, map_location=device)
        width = initial["policy"]["encoder.weight"].shape[1]
        hidden_size = initial["config"].get("hiddenSize", 64)
        policy = Policy(width, budget, 0, hidden_size).to(device)
        policy.initialize(initial["policy"])
        replay = DemonstrationReplay(args.replay, args.batch_sequences, device, width,
                                     initial["config"]["observationSchema"])
        references = json.loads(Path(args.references).read_text(encoding="utf-8-sig"))
        replay.prepare_references(policy, references)
        optimizer = torch.optim.Adam(policy.parameters(), lr=args.learning_rate, eps=1e-5)
        source = Path(__file__).resolve().parents[2] / "source.json"
        config = {**vars(args), "algorithm": "multi-teacher recurrent behavior distillation",
                  "source": json.loads(source.read_text(encoding="utf-8")) if source.exists() else None,
                  "simulationSource": replay.source["simulationSource"],
                  "rehearsalSource": replay.source, "rehearsalReferenceSources": replay.reference_sources,
                  "trainingCourses": replay.source["courses"], "observationWidth": width,
                  "observationSchema": initial["config"]["observationSchema"],
                  "hiddenSize": hidden_size, "centralStateWidth": 0, "actionSizes": [3, 3, 3, 2, 9],
                  "actorUsesPrivilegedState": False, "newWorldSteps": 0,
                  "recordedWorldSteps": replay.source["sequences"] * replay.source["sequenceLength"],
                  "initialCheckpoint": {"path": args.weights, "steps": initial["steps"],
                                        "source": initial["config"].get("source")},
                  "torch": torch.__version__, "device": torch.cuda.get_device_name(0)}
        del initial
        (output / "config.json").write_text(json.dumps(config, indent=2), encoding="utf-8")
        save_checkpoint(output / "initial.pt", policy, optimizer, config, 0, 0)
        started = time.monotonic()
        policy.train()
        with (output / "metrics.jsonl").open("x", encoding="utf-8") as log:
            for update in range(1, args.updates + 1):
                control_loss, reference_loss, mismatch = replay.loss(policy)
                loss = args.control_weight * control_loss + reference_loss
                optimizer.zero_grad()
                budget.wait()
                loss.backward()
                nn.utils.clip_grad_norm_(policy.parameters(), .5)
                optimizer.step()
                budget.wait()
                row = {"offlineUpdates": update, "newWorldSteps": 0,
                       "replayedStateFrames": update * args.batch_sequences * replay.source["sequenceLength"],
                       "seconds": time.monotonic() - started, "loss": loss.item(),
                       "controlLoss": control_loss.item(), "referenceKl": reference_loss.item(),
                       "referenceHeadMismatchRate": mismatch.item(), "gpuPercent": budget.utilization,
                       "gpuMemoryAllocatedMiB": torch.cuda.memory_allocated() / 1048576,
                       "gpuMemoryReservedMiB": torch.cuda.memory_reserved() / 1048576}
                log.write(json.dumps(row) + "\n")
                log.flush()
                if update == 1 or update % 10 == 0:
                    print(json.dumps(row), flush=True)
                if update % 50 == 0 or update == args.updates:
                    save_checkpoint(output / "latest.pt", policy, optimizer,
                                    {**config, "offlineUpdates": update}, 0, update)
        result = {"offlineUpdates": args.updates, "newWorldSteps": 0,
                  "seconds": time.monotonic() - started, "readyForGameplay": False}
        (output / "result.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
    finally:
        budget.close()
    from evaluate_curriculum import main as evaluate_curriculum

    evaluate_curriculum(argparse.Namespace(environment_url=args.environment_url,
        checkpoint=str(output / "latest.pt"), output=str(output / "evaluation"), curriculum=None,
        episodes=args.evaluation_episodes, environments=args.evaluation_environments,
        gpu_utilization_limit=args.gpu_utilization_limit, seed=args.seed + 100000000,
        without_items=False))
    result["evaluations"] = json.loads((output / "evaluation" / "result.json").read_text())["evaluations"]
    (output / "result.json").write_text(json.dumps(result, indent=2), encoding="utf-8")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", required=True)
    parser.add_argument("--environment-url", required=True)
    parser.add_argument("--weights", required=True)
    parser.add_argument("--replay", required=True)
    parser.add_argument("--references", required=True)
    parser.add_argument("--updates", type=int, default=400)
    parser.add_argument("--batch-sequences", type=int, default=32)
    parser.add_argument("--learning-rate", type=float, default=.0001)
    parser.add_argument("--control-weight", type=float, default=.25)
    parser.add_argument("--gpu-utilization-limit", type=int, default=60)
    parser.add_argument("--evaluation-episodes", type=int, default=32)
    parser.add_argument("--evaluation-environments", type=int, default=8)
    parser.add_argument("--seed", type=int, default=179)
    options = parser.parse_args()
    if min(options.updates, options.batch_sequences, options.evaluation_episodes, options.evaluation_environments) < 1:
        parser.error("Updates, batches and evaluation sizes must be positive")
    main(options)
