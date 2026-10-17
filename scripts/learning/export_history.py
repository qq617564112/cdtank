"""Export settled human-labelled trajectories without account credentials."""

import argparse
import collections
import gzip
import json
from pathlib import Path
import sqlite3
import sys


def load_matches(database):
    matches = {}
    for match_id, round_number, ended_at, record in database.execute(
        "SELECT match_id, round, ended_at, record FROM match_history ORDER BY ended_at"
    ):
        record = json.loads(record)
        key = (match_id, round_number)
        match = matches.setdefault(key, {
            "matchId": match_id, "round": round_number,
            "roomId": record.get("roomId", match_id.rsplit(":", 1)[-1]),
            "mapId": record["mapId"], "mode": record["mode"],
            "endedAt": ended_at, "reason": record["reason"], "participants": [],
        })
        result = record["result"]
        match["participants"].append({key: result[key] for key in (
            "id", "team", "kills", "deaths", "objectivesDestroyed", "outcome"
        ) if key in result})
    return list(matches.values())


def read_traces(directory):
    groups = collections.defaultdict(dict)
    malformed = 0
    for path in sorted(directory.glob("*.ndjson*")):
        with path.open(encoding="utf-8") as source:
            for line in source:
                try:
                    row = json.loads(line)
                except ValueError:
                    malformed += 1
                    continue
                if row.get("type") != "sample":
                    continue
                key = (row["session"], row["roomId"], row["round"],
                       row["mapId"], row["mode"], row["startedAt"])
                groups[key][row["tick"]] = row
    return groups, malformed


def export(args):
    with sqlite3.connect(Path(args.database).resolve().as_uri() + "?mode=ro", uri=True) as db:
        db.execute("BEGIN")
        matches = load_matches(db)
    groups, malformed = read_traces(Path(args.traces))
    summary = {"schema": 1, "settledMatches": len(matches), "matchedSessions": 0,
               "humanFrames": 0, "humanAliveFrames": 0, "unmatchedMatches": 0,
               "malformedLines": malformed, "controls": collections.Counter(),
               "provenance": "HUMAN control label; manual client origin is not recorded",
               "sampleMs": 500, "labelTiming": "post_step"}
    raw = sys.stdout.buffer if args.output == "-" else open(args.output, "xb")
    with gzip.GzipFile(fileobj=raw, mode="wb", mtime=0) as output:
        def emit(row):
            output.write((json.dumps(row, ensure_ascii=False, separators=(",", ":")) + "\n").encode())
        emit({"type": "metadata", "schema": 1, "sampleMs": 500,
              "labelTiming": "post_step", "provenance": summary["provenance"]})
        used = set()
        for match in matches:
            candidates = []
            for key, by_tick in groups.items():
                session, room, round_number, map_id, mode, started_at = key
                if (room, round_number, map_id, mode) != (
                    match["roomId"], match["round"], match["mapId"], match["mode"]
                ) or started_at >= match["endedAt"]:
                    continue
                rows = sorted((r for r in by_tick.values() if r["at"] <= match["endedAt"]),
                              key=lambda r: r["at"])
                if rows and 0 <= match["endedAt"] - rows[-1]["at"] <= 3000:
                    candidates.append((rows[-1]["at"], key, rows))
            if not candidates:
                summary["unmatchedMatches"] += 1
                continue
            _, key, rows = max(candidates, key=lambda value: value[0])
            if key in used:
                raise ValueError("A trace session matched multiple settlements")
            used.add(key)
            summary["matchedSessions"] += 1
            emit({"type": "match", **match, "session": key[0], "startedAt": key[-1]})
            player_ids = {p["id"] for p in match["participants"]}
            for row in rows:
                tanks = []
                for tank in row["tanks"]:
                    summary["controls"][tank["control"]] += 1
                    if tank["control"] != "HUMAN" or tank["id"] not in player_ids:
                        continue
                    summary["humanFrames"] += 1
                    summary["humanAliveFrames"] += bool(tank["alive"])
                    tanks.append({key: tank[key] for key in (
                        "id", "team", "tankId", "control", "x", "y", "z", "yaw",
                        "bodyYaw", "aim", "alive", "hp", "deaths", "status",
                        "movementFlags", "movementCommand", "disguised", "input"
                    ) if key in tank})
                if tanks:
                    emit({"type": "frame", "matchId": match["matchId"],
                          **{k: row[k] for k in ("session", "roomId", "round", "mapId",
                             "mode", "startedAt", "at", "tick", "navigationRevision")},
                          "tanks": tanks})
        emit({"type": "summary", **summary})
    if args.output != "-":
        raw.close()
    print(json.dumps(summary, ensure_ascii=False), file=sys.stderr)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--database", required=True)
    parser.add_argument("--traces", required=True)
    parser.add_argument("--output", required=True, help="New .jsonl.gz path, or - for stdout")
    export(parser.parse_args())
