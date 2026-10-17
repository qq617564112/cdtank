"""Reward control continuity learned from human-labelled half-second samples."""

import json
import math
from pathlib import Path


class HumanControlPrior:
    def __init__(self, filename, environments, actors_per_world):
        profile = json.loads(Path(filename).read_text(encoding="utf-8"))
        if profile["cadenceMs"] != 500:
            raise ValueError("Human control rewards require the 500 ms history profile")
        human = profile["human"]
        contexts = {(row["mode"], row["mapId"], row["tankId"]): row for row in human["contexts"]}
        self.tables = []
        self.history = [None] * (len(environments) * actors_per_world)
        sources = {}
        for environment in environments:
            course = environment.course
            key = (course["mode"], course["map_id"], course["tank_id"])
            if course["lesson"] != "combat":
                raise ValueError("Human control continuity rewards require ordinary combat")
            source = contexts.get(key, human["allContexts"])
            tables = []
            for head in ("move", "turn", "aim"):
                data = source["heads"][head]
                states = [data["sampledStateCounts"].get(str(value), 0) + .5 for value in (-1, 0, 1)]
                table = []
                for previous in (-1, 0, 1):
                    counts = [data["transitionCounts"].get(f"{previous}:{value}", 0) + .5
                              for value in (-1, 0, 1)]
                    table.append([math.log(count / sum(counts)) - math.log(state / sum(states))
                                  for count, state in zip(counts, states)])
                tables.append(table)
            self.tables.extend([tables] * actors_per_world)
            sources[key] = {"mode": key[0], "mapId": key[1], "tankId": key[2],
                            "reference": "matching context" if key in contexts else "all human contexts",
                            "pairs": source["continuousPairs"]}
        self.source = {"path": filename, "cadenceMs": 500, "history": human["source"],
                       "contexts": list(sources.values()), "smoothingCount": .5,
                       "reward": "mean conditional log probability relative to marginal state probability"}

    def rewards(self, before, after, actions):
        rewards = []
        for world, (old, new, selected) in enumerate(zip(before, after, actions)):
            for actor, (frame, next_frame, action) in enumerate(zip(old["frames"], new["frames"], selected)):
                index = world * len(selected) + actor
                at = frame["memory"]["at"]
                previous = self.history[index]
                reward = 0.
                if not frame["alive"] or not next_frame["alive"] \
                        or frame["metrics"]["deaths"] != next_frame["metrics"]["deaths"]:
                    self.history[index] = None
                elif previous is None or at - previous[0] >= 500:
                    if previous is not None and at - previous[0] <= 750:
                        reward = sum(table[previous[1][head]][action[head]]
                                     for head, table in enumerate(self.tables[index])) / 3
                    self.history[index] = (at, action[:3])
                if new["done"]:
                    self.history[index] = None
                rewards.append(reward)
        return rewards
