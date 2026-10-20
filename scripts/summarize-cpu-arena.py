import collections
import json
import math
import pathlib
import sys

directory = pathlib.Path(sys.argv[1])
overview = []
for room in sorted(directory.glob('A*')):
    trace = room / 'trace.ndjson'
    if not trace.exists():
        continue
    records = [json.loads(line) for line in trace.open()]
    analysis = json.load((room / 'analysis.json').open())['rounds'][0]
    participants = {}
    for record in records:
        for tank in record['tanks']:
            participants.setdefault(tank['id'], []).append((record, tank))
    rows = []
    for player_id, pairs in participants.items():
        alive = [(record, tank) for record, tank in pairs if tank['alive']]
        if not alive:
            continue
        record, tank = max(alive, key=lambda pair: pair[1]['decision']['stalledSeconds'])
        last = pairs[-1][1]['decision']
        rows.append(dict(id=player_id, name=tank['name'], tankId=tank['tankId'],
                         maxStall=tank['decision']['stalledSeconds'],
                         at=round((record['at']-record['startedAt'])/1000, 3),
                         source=tank['decision']['driveSource'],
                         reversals=last['driveReversals'], replans=last['recoveryReplans'],
                         targetChanges=last['targetChanges'],
                         sources=dict(collections.Counter(t['decision']['driveSource'] for _, t in alive))))
    (room / 'per-cpu.json').write_text(json.dumps(rows, ensure_ascii=False, indent=2)+'\n')
    overview.append(dict(roomId=analysis['roomId'], mapId=analysis['mapId'],
                         revisions=sorted({t['decision']['policyRevision'] for r in records for t in r['tanks']}),
                         samples=len(records), gaps=analysis['gaps'], dropped=analysis['droppedSamples'],
                         timing=analysis['timing'], cpus=rows,
                         incidents=[{k: episode[k] for k in ['playerId', 'kind', 'fromBattleSeconds',
                                    'toBattleSeconds', 'seconds']} for episode in analysis['incidents']]))
    print('\n', analysis['roomId'], 'map', analysis['mapId'], 'timing', analysis['timing'])
    for row in rows:
        print(row['id'], row['tankId'], 'stall', row['maxStall'], 'at', row['at'],
              row['source'], 'reverse', row['reversals'], 'replan', row['replans'])
    print('incidents', overview[-1]['incidents'][:6])
(directory / 'overview.json').write_text(json.dumps(overview, ensure_ascii=False, indent=2)+'\n')
