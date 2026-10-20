import bisect
import collections
import json
import math
import pathlib
import sys


def distance(a, b):
    return math.hypot(a['x'] - b['x'], a['z'] - b['z'])


def summarize_run(pairs):
    first_record, first = pairs[0]
    last_record, last = pairs[-1]
    travel = sum(distance(a[1], b[1]) for a, b in zip(pairs, pairs[1:]))
    sources = dict(collections.Counter(tank['decision']['driveSource'] for _, tank in pairs))
    return dict(start=round((first_record['at'] - first_record['startedAt']) / 1000, 3),
                end=round((last_record['at'] - last_record['startedAt']) / 1000, 3),
                seconds=round((last_record['at'] - first_record['at']) / 1000, 3),
                travel=round(travel, 1), displacement=round(distance(first, last), 1),
                shots=last.get('shots', 0) - first.get('shots', 0),
                damageTaken=last.get('damageTaken', 0) - first.get('damageTaken', 0),
                damageDealt=last.get('damageDealt', 0) - first.get('damageDealt', 0),
                sources=sources, targetId=first['decision'].get('targetId'))


directory = pathlib.Path(sys.argv[1])
all_rooms = []
for room in sorted(directory.glob('A*')):
    if not (room / 'trace.ndjson').exists():
        continue
    records = [json.loads(line) for line in (room / 'trace.ndjson').open()]
    events = json.load((room / 'combat-events.json').open())
    times = [r['at'] for r in records]
    teams = {t['id']: t['team'] for t in records[0]['tanks']}
    hits = [e for e in events if e['type'] == 'hit' and e['value'] > 0
            and e['targetId'] in teams and e['playerId'] in teams
            and teams[e['targetId']] != teams[e['playerId']]]
    per_cpu = []
    for player_id in teams:
        pairs = [(r, next(t for t in r['tanks'] if t['id'] == player_id)) for r in records]
        runs = []
        run = []
        for pair in pairs:
            record, tank = pair
            if tank['alive'] and tank['input']['move'] < 0:
                if run and (tank['deaths'] != run[-1][1]['deaths']
                            or record['at'] - run[-1][0]['at'] > 1200):
                    runs.append(summarize_run(run))
                    run = []
                run.append(pair)
            elif run and (not tank['alive'] or tank['input']['move'] > 0
                          or record['at'] - run[-1][0]['at'] > 1000):
                runs.append(summarize_run(run))
                run = []
        if run:
            runs.append(summarize_run(run))
        responses = []
        for hit in hits:
            if hit['targetId'] != player_id:
                continue
            before_index = max(0, bisect.bisect_right(times, hit['at']) - 1)
            after_index = bisect.bisect_left(times, hit['at'] + 5000)
            if after_index >= len(pairs):
                continue
            before = pairs[before_index][1]
            attacker = next(t for t in records[before_index]['tanks'] if t['id'] == hit['playerId'])
            window = pairs[before_index + 1:after_index + 1]
            after = window[-1][1]
            same_life = before['alive'] and after['alive'] and before['deaths'] == after['deaths']
            life_window = [(r, t) for r, t in window
                           if t['alive'] and t['deaths'] == before['deaths']]
            counter = next(((r['at'] - hit['at']) / 1000 for r, t in life_window
                            if t['decision'].get('attackId') == hit['playerId']), None)
            first_fire = next(((e['at'] - hit['at']) / 1000 for e in events
                               if e['type'] == 'fire' and e['playerId'] == player_id
                               and hit['at'] < e['at'] <= (life_window[-1][0]['at']
                                                         if life_window else hit['at'])), None)
            responses.append(dict(seconds=round((hit['at'] - records[0]['startedAt']) / 1000, 3),
                                  attackerId=hit['playerId'], value=hit['value'], survived=same_life,
                                  attackerDistance=round(distance(before, attacker), 1),
                                  attackerConcealedAtHit=(attacker['camouflaged'] or attacker['disguised'])
                                  if 'camouflaged' in attacker else None,
                                  targetAtHit=before['decision'].get('targetId'),
                                  targetAfter=after['decision'].get('targetId') if same_life else None,
                                  counterTargetSeconds=round(max(0, counter), 3) if counter is not None else None,
                                  firstFireSeconds=round(first_fire, 3) if first_fire is not None else None,
                                  displacement=round(distance(before, after), 1) if same_life else None,
                                  reverseFraction=round(sum(t['input']['move'] < 0 for _, t in window)
                                                        / len(window), 2) if same_life else None,
                                  stationaryFraction=round(sum(t['input']['move'] == 0 for _, t in window)
                                                           / len(window), 2) if same_life else None,
                                  shots=after.get('shots', 0) - before.get('shots', 0),
                                  sources=dict(collections.Counter(t['decision']['driveSource'] for _, t in window))))
        per_cpu.append(dict(id=player_id, tankId=pairs[0][1]['tankId'],
                            localBreachSelections=max((t['decision']['localBreachSelections']
                                                       for _, t in pairs
                                                       if 'localBreachSelections' in t['decision']), default=None),
                            attackerSwitches=len({t['decision']['targetSelectedAt'] for _, t in pairs
                                                  if t['decision']['targetChangeReason'] == 'ATTACKER'}),
                            hitsReceived=sum(e['targetId'] == player_id for e in hits),
                            survivedWindows=sum(r['survived'] for r in responses),
                            reverseSamples=sum(t['alive'] and t['input']['move'] < 0 for _, t in pairs),
                            liveSamples=sum(t['alive'] for _, t in pairs),
                            maxReverse=max((r['seconds'] for r in runs), default=0),
                            reverseRuns=sorted(runs, key=lambda r: -r['seconds'])[:8],
                            hitResponses=responses))
    output = dict(roomId=room.name, mapId=records[0]['mapId'], hits=len(hits), cpus=per_cpu)
    (room / 'reactions.json').write_text(json.dumps(output, ensure_ascii=False, indent=2) + '\n')
    all_rooms.append(output)
    print(room.name, 'map', output['mapId'], 'enemy hits', len(hits))
    for cpu in per_cpu:
        top = cpu['reverseRuns'][0] if cpu['reverseRuns'] else {}
        print(cpu['id'], 'tank', cpu['tankId'], 'hit', cpu['hitsReceived'],
              'survived5s', cpu['survivedWindows'], 'reverseMax', cpu['maxReverse'],
              'at', top.get('start'), top.get('end'), 'travel', top.get('travel'),
              'shots', top.get('shots'), 'src', top.get('sources'))
(directory / 'reactions.json').write_text(json.dumps(all_rooms, ensure_ascii=False, indent=2) + '\n')
