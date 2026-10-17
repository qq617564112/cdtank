"""Export a frozen actor for native CPU execution without training dependencies."""

import argparse
import json
from pathlib import Path

import torch

from train_combat import Policy, SIZES


def main(args):
    checkpoint = torch.load(args.checkpoint, map_location="cpu")
    hidden_size = checkpoint["config"].get("hiddenSize", 64)
    policy = Policy(305, central_width=checkpoint["config"].get("centralStateWidth", 0), hidden_size=hidden_size)
    policy.initialize(checkpoint["policy"])
    tensors = {name: value.detach().tolist() for name, value in policy.state_dict().items()
               if name.startswith(("encoder.", "mask_encoder.", "memory.", "actor."))}
    output = {"format": "cdtank-recurrent-actor-v1", "observationWidth": 305,
              "observationSchema": 6, "hiddenSize": hidden_size, "actionSizes": SIZES, "decisionMs": 100,
              "checkpoint": {"path": args.checkpoint, "steps": checkpoint["steps"],
                             "source": checkpoint["config"].get("source"),
                             "simulationSource": checkpoint["config"].get("simulationSource")},
              "trainingCourses": checkpoint["config"].get("trainingCourses"),
              "readyForGameplay": False, "tensors": tensors}
    destination = Path(args.output)
    destination.parent.mkdir(parents=True, exist_ok=True)
    with destination.open("x", encoding="utf-8") as stream:
        json.dump(output, stream, separators=(",", ":"))
    print(json.dumps({"output": str(destination), "steps": checkpoint["steps"],
                      "bytes": destination.stat().st_size, "readyForGameplay": False}), flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--checkpoint", required=True)
    parser.add_argument("--output", required=True)
    main(parser.parse_args())
