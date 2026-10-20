import json
import pathlib
import sys

directory = pathlib.Path(sys.argv[1])
overview = {room['roomId']: room for room in json.load((directory / 'overview.json').open())}
for room in json.load((directory / 'reactions.json').open()):
    summary = overview[room['roomId']]
    print(room['roomId'], 'map', room['mapId'], 'rev', summary['revisions'],
          'hits', room['hits'], 'samples', summary['samples'], 'gaps', summary['gaps'],
          'drop', summary['dropped'], 'step', summary['timing']['meanStepMs'])
    rows = {cpu['id']: cpu for cpu in summary['cpus']}
    print('CPU tank hits reverseMax reverse% stall reversals ignoredCloseHit attackerSwitch localBreach')
    candidates = []
    for cpu in room['cpus']:
        missed = [response for response in cpu['hitResponses']
                  if response['survived'] and response['attackerDistance'] < 400
                  and not response.get('attackerConcealedAtHit')
                  and response['targetAtHit'] != response['attackerId']
                  and response['counterTargetSeconds'] is None and response['shots'] == 0]
        row = rows[cpu['id']]
        print(cpu['id'], cpu['tankId'], cpu['hitsReceived'], cpu['maxReverse'],
              round(100 * cpu['reverseSamples'] / max(1, cpu['liveSamples'])),
              row['maxStall'], row['reversals'], len(missed), cpu['attackerSwitches'],
              cpu['localBreachSelections'])
        for response in missed:
            candidates.append({'id': cpu['id'], **response})
    for candidate in sorted(candidates, key=lambda value: value['displacement'])[:3]:
        print('HIT', json.dumps(candidate, separators=(',', ':')))
    runs = [{'id': cpu['id'], **run} for cpu in room['cpus'] for run in cpu['reverseRuns']]
    for run in sorted(runs, key=lambda value: -value['seconds'])[:2]:
        print('REVERSE', json.dumps(run, separators=(',', ':')))
