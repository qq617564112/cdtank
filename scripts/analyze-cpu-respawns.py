import bisect
import json
import pathlib
import sys


directory = pathlib.Path(sys.argv[1])
rooms = []
for room in sorted(directory.glob('A*')):
    if not (room / 'trace.ndjson').exists():
        continue
    records = [json.loads(line) for line in (room / 'trace.ndjson').open()]
    times = [record['at'] for record in records]
    events = json.load((room / 'combat-events.json').open())
    cpus = []
    for player in records[0]['tanks']:
        pairs = [(record, next(tank for tank in record['tanks'] if tank['id'] == player['id']))
                 for record in records]
        respawns = []
        for event in events:
            if event['type'] != 'respawn' or event['playerId'] != player['id']:
                continue
            index = bisect.bisect_left(times, event['at'])
            end = bisect.bisect_left(times, event['at'] + 6000)
            before = pairs[max(0, index - 1)][1]
            window = [(record, tank) for record, tank in pairs[index:end] if tank['alive']]
            starts_before = before['decision'].get('forwardCruiseStarts', 0)
            starts_after = max((tank['decision'].get('forwardCruiseStarts', 0)
                                for _, tank in window), default=starts_before)
            active = [round((record['at'] - event['at']) / 1000, 3)
                      for record, tank in window
                      if tank['decision']['driveSource'] == 'CRUISE_TURN']
            respawns.append(dict(
                seconds=round((event['at'] - records[0]['startedAt']) / 1000, 3),
                liveSamples=len(window), earlyStarts=starts_after - starts_before,
                earlyActiveSeconds=active,
                firstLiveSeconds=round((window[0][0]['at'] - event['at']) / 1000, 3)
                if window else None))
        row = dict(id=player['id'], tankId=player['tankId'], respawns=respawns)
        cpus.append(row)
        print(room.name, row['id'], 'respawns', len(respawns), 'earlyStarts',
              sum(event['earlyStarts'] for event in respawns), 'earlyActive',
              sum(bool(event['earlyActiveSeconds']) for event in respawns))
    rooms.append(dict(roomId=room.name, cpus=cpus))
all_respawns = [event for room in rooms for cpu in room['cpus'] for event in cpu['respawns']]
summary = dict(respawns=len(all_respawns),
               sampled=sum(event['liveSamples'] > 0 for event in all_respawns),
               earlyStarts=sum(event['earlyStarts'] for event in all_respawns),
               earlyActiveRespawns=sum(bool(event['earlyActiveSeconds']) for event in all_respawns))
(directory / 'respawns.json').write_text(json.dumps(dict(summary=summary, rooms=rooms),
                                                 ensure_ascii=False, indent=2) + '\n')
print(json.dumps(summary, ensure_ascii=False))
