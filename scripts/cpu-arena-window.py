import json
import math
import pathlib
import sys

room = pathlib.Path(sys.argv[1])
player_id = sys.argv[2]
start, end = map(float, sys.argv[3:5])
stride = int(sys.argv[5]) if len(sys.argv) > 5 else 1
records = [json.loads(line) for line in (room / 'trace.ndjson').open()]
selected = []
for record in records:
    seconds = (record['at']-record['startedAt'])/1000
    if not start <= seconds <= end:
        continue
    tank = next(tank for tank in record['tanks'] if tank['id'] == player_id)
    decision = tank['decision']
    waypoint = decision.get('waypoint')
    distance = math.hypot(waypoint['x']-tank['x'], waypoint['z']-tank['z']) if waypoint else None
    delta = math.atan2(waypoint['x']-tank['x'], waypoint['z']-tank['z'])-tank['yaw'] if waypoint else None
    error = round(math.degrees(math.atan2(math.sin(delta), math.cos(delta))), 1) if waypoint else None
    neighbours = [(other['id'], other['team'], round(math.hypot(other['x']-tank['x'], other['z']-tank['z'])))
                  for other in record['tanks'] if other['alive'] and other['id'] != player_id
                  and abs(other['y']-tank['y']) < 24
                  and math.hypot(other['x']-tank['x'], other['z']-tank['z']) < 144]
    selected.append(dict(seconds=round(seconds, 3), tank=tank, neighbours=neighbours))
    if (len(selected)-1) % stride:
        continue
    command = tank['input']
    print(round(seconds, 2), 'pos', tuple(round(tank[key], 1) for key in ['x', 'z', 'yaw']),
          'wp', tuple(round(waypoint[key], 1) for key in ['x', 'z']) if waypoint else None,
          'dist', round(distance, 1) if waypoint else None, 'err', error,
          'in', tuple(command[key] for key in ['move', 'turn', 'aim', 'fire']),
          'src', decision['driveSource'], 'stall', decision['stalledSeconds'],
          'rev', decision['driveReversals'], 'replan', decision['recoveryReplans'],
          'path', decision['pathLength'], 'search', decision['searching'],
          'breach', tank.get('breach', {}).get('hp'), 'target', decision.get('targetId'),
          'visible', decision['targetVisible'], 'near', neighbours)
if '--save' in sys.argv:
    (room / f'{player_id}-{start:g}-{end:g}.json').write_text(json.dumps(selected, ensure_ascii=False, indent=2)+'\n')
