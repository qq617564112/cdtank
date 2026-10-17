"""Measure observed control continuity at the history's 500 ms sampling cadence."""

import argparse
from collections import Counter, defaultdict
import gzip
import json
from pathlib import Path


HEADS = ("move", "turn", "aim", "fire")


def direction(value):
    return -1 if value < -.25 else 1 if value > .25 else 0


def history_tracks(path):
    tracks = defaultdict(list)
    metadata = None
    summary = None
    counts = Counter()
    with gzip.open(path, "rt", encoding="utf-8") as stream:
        for line in stream:
            row = json.loads(line)
            if row["type"] == "metadata":
                metadata = row
            elif row["type"] == "summary":
                summary = row
            elif row["type"] == "frame":
                for tank in row["tanks"]:
                    counts["frames"] += 1
                    active = tank["control"] == "HUMAN" and tank["alive"] and tank["input"]["sequence"] > 0
                    counts["acceptedInputAliveFrames"] += active
                    counts["zeroSequenceFrames"] += tank["input"]["sequence"] == 0
                    key = (row["matchId"], row["session"], row["round"], tank["id"],
                           row["mode"], row["mapId"], tank["tankId"])
                    action = [direction(tank["input"][head]) for head in HEADS[:3]]
                    action.append(int(tank["input"]["fire"]))
                    tracks[key].append((row["at"], tank["deaths"], active, action))
    if metadata is None or summary is None:
        raise ValueError("History export needs its metadata and final summary")
    return tracks, {"path": str(path), "metadata": metadata, "exportSummary": summary,
                    "profileCounts": dict(counts)}


def native_tracks(directory):
    config = json.loads((directory / "config.json").read_text(encoding="utf-8-sig"))
    tracks = defaultdict(list)
    with (directory / "episodes.jsonl").open(encoding="utf-8") as stream:
        for line in stream:
            row = json.loads(line)
            for sample in row["trajectory"]:
                for actor, frame in enumerate(sample["actors"]):
                    action = frame["actions"]
                    active = action is not None and frame["metrics"]["hp"] > 0
                    key = (row["episode"], actor, config["mode"], config["map_id"], config.get("tank_id", 1))
                    selected = [value - 1 for value in action[:3]] + [action[3]] if action else None
                    tracks[key].append((frame["position"]["at"], frame["metrics"]["deaths"], active, selected))
    return tracks, {"path": str(directory), "config": config,
                    "result": json.loads((directory / "result.json").read_text(encoding="utf-8-sig"))}


class Profile:
    def __init__(self):
        self.tracks = 0
        self.frames = 0
        self.pairs = 0
        self.pair_ms = 0
        self.states = [Counter() for _ in HEADS]
        self.transitions = [Counter() for _ in HEADS]

    def add(self, values):
        self.tracks += 1
        previous = None
        for at, deaths, active, action in sorted(values):
            if not active:
                previous = None
                continue
            self.frames += 1
            for states, value in zip(self.states, action):
                states[value] += 1
            if previous is not None:
                before_at, before_deaths, before_action = previous
                elapsed = at - before_at
                if deaths == before_deaths and 350 <= elapsed <= 750:
                    self.pairs += 1
                    self.pair_ms += elapsed
                    for transitions, before, after in zip(self.transitions, before_action, action):
                        transitions[before, after] += 1
            previous = (at, deaths, action)

    def result(self):
        heads = {}
        for head, states, transitions in zip(HEADS, self.states, self.transitions):
            switches = sum(count for (before, after), count in transitions.items() if before != after)
            reversals = sum(count for (before, after), count in transitions.items() if before * after == -1)
            heads[head] = {
                "sampledStateCounts": dict(states),
                "sampledStateRates": {key: count / self.frames for key, count in states.items()},
                "persistenceRate": 1 - switches / self.pairs if self.pairs else None,
                "observedSwitchesPerMinute": switches * 60000 / self.pair_ms if self.pair_ms else None,
                "directReversalRate": reversals / self.pairs if self.pairs else None,
                "transitionCounts": {f"{before}:{after}": count for (before, after), count in transitions.items()},
            }
        return {"tracks": self.tracks, "aliveAcceptedInputFrames": self.frames,
                "continuousPairs": self.pairs, "continuousPairMilliseconds": self.pair_ms, "heads": heads}


def profiles(tracks):
    total = Profile()
    contexts = defaultdict(Profile)
    for key, values in tracks.items():
        if not any(value[2] for value in values):
            continue
        total.add(values)
        mode, map_id, tank_id = key[-3:]
        contexts[mode, map_id, tank_id].add(values)
    return {"allContexts": total.result(), "contexts": [
        {"mode": mode, "mapId": map_id, "tankId": tank_id, **profile.result()}
        for (mode, map_id, tank_id), profile in sorted(contexts.items())]}


def main(args):
    human_tracks, human_source = history_tracks(Path(args.history))
    result = {"schema": 1, "cadenceMs": 500, "continuousIntervalMs": [350, 750],
              "interpretation": "Observed control persistence; changes within a sampling interval are unavailable. "
                  "Compare matching mode, map and tank contexts. Client manual origin and reaction time are unrecorded.",
              "human": {"source": human_source, **profiles(human_tracks)}, "native": []}
    for directory in args.native_run:
        tracks, source = native_tracks(Path(directory))
        result["native"].append({"source": source, **profiles(tracks)})
    with Path(args.output).open("x", encoding="utf-8") as stream:
        json.dump(result, stream, ensure_ascii=False, indent=2)
    print(json.dumps({"output": args.output, "humanFrames": result["human"]["allContexts"]["aliveAcceptedInputFrames"],
                      "humanPairs": result["human"]["allContexts"]["continuousPairs"],
                      "nativeRuns": len(result["native"])}))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--history", required=True)
    parser.add_argument("--native-run", action="append", default=[])
    parser.add_argument("--output", required=True)
    main(parser.parse_args())
