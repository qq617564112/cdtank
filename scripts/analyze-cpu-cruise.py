import json
import math
import pathlib
import sys


def summarize_episode(pairs):
    first_record, first = pairs[0]
    last_record, last = pairs[-1]
    return dict(
        start=round((first_record['at'] - first_record['startedAt']) / 1000, 3),
        end=round((last_record['at'] - last_record['startedAt']) / 1000, 3),
        seconds=round((last_record['at'] - first_record['at']) / 1000, 3),
        travel=round(sum(math.hypot(a['x'] - b['x'], a['z'] - b['z'])
                         for (_, a), (_, b) in zip(pairs, pairs[1:])), 1),
        forwardSamples=sum(t['input']['move'] > 0 for _, t in pairs),
        reverseSamples=sum(t['input']['move'] < 0 for _, t in pairs),
        stationarySamples=sum(t['input']['move'] == 0 for _, t in pairs),
        maxStopped=max((t['decision'].get('forwardCruiseStoppedSeconds', 0)
                        for _, t in pairs), default=0))


directory = pathlib.Path(sys.argv[1])
rooms = []
for room in sorted(directory.glob('A*')):
    trace = room / 'trace.ndjson'
    if not trace.exists():
        continue
    records = [json.loads(line) for line in trace.open()]
    cpus = []
    reactions = {cpu['id']: cpu for cpu in json.load((room / 'reactions.json').open())['cpus']}
    for player in records[0]['tanks']:
        pairs = [(r, next(t for t in r['tanks'] if t['id'] == player['id'])) for r in records]
        episodes = []
        episode = []
        for pair in pairs:
            r, t = pair
            active = t['alive'] and t['decision']['driveSource'] == 'CRUISE_TURN'
            if episode and (not active or t['deaths'] != episode[-1][1]['deaths']
                            or r['at'] - episode[-1][0]['at'] > 1200):
                episodes.append(summarize_episode(episode))
                episode = []
            if active:
                episode.append(pair)
        if episode:
            episodes.append(summarize_episode(episode))
        counters = {key: max(t['decision'].get(key, 0) for _, t in pairs)
                    for key in ['forwardCruiseStarts', 'forwardCruiseCompletions', 'forwardCruiseAborts']}
        strict_runs = []
        for run in reactions[player['id']]['reverseRuns']:
            if run['seconds'] < 10:
                continue
            window = [(r, t) for r, t in pairs if run['start'] - .00001
                      <= (r['at'] - r['startedAt']) / 1000 <= run['end'] + .00001]
            reversals = (window[-1][1]['decision']['driveReversals']
                         - window[0][1]['decision']['driveReversals'])
            if reversals == 0:
                strict_runs.append(run)
        row = dict(id=player['id'], tankId=player['tankId'], **counters,
                   episodes=episodes, strictLongReverseRuns=strict_runs)
        cpus.append(row)
        print(room.name, row['id'], 'starts', counters['forwardCruiseStarts'],
              'complete', counters['forwardCruiseCompletions'], 'abort', counters['forwardCruiseAborts'],
              'activeMax', max((e['seconds'] for e in episodes), default=0),
              'stopMax', round(max((e['maxStopped'] for e in episodes), default=0), 3),
              'longReverse', [r['seconds'] for r in strict_runs])
    rooms.append(dict(roomId=room.name, mapId=records[0]['mapId'], cpus=cpus))
summary = dict(rooms=len(rooms), cpuParticipations=sum(len(r['cpus']) for r in rooms))
for key in ['forwardCruiseStarts', 'forwardCruiseCompletions', 'forwardCruiseAborts']:
    summary[key] = sum(cpu[key] for room in rooms for cpu in room['cpus'])
summary['strictLongReverseRuns'] = sum(len(cpu['strictLongReverseRuns']) for room in rooms for cpu in room['cpus'])
print(json.dumps(summary, ensure_ascii=False))
(directory / 'cruise.json').write_text(json.dumps(dict(summary=summary, rooms=rooms),
                                               ensure_ascii=False, indent=2) + '\n')
