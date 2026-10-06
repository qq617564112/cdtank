"""Verify recorded original001 death visuals, respawn, and room resource ownership."""
import base64
import json
from pathlib import Path

OUTPUT = Path('recovery/output')
visual_path = OUTPUT / 'browser-combat-death-t01-2026-10-03T21-37-41-627Z.json'
respawn_path = OUTPUT / 'browser-combat-death-t01-2026-10-03T21-32-08-035Z.json'
visual = json.loads(visual_path.read_text())
respawn = json.loads(respawn_path.read_text())
reentries = [(path, json.loads(path.read_text())) for path in OUTPUT.glob('browser-combat-death-t01-*.json')]
reentry_path, reentry = next((path, data) for path, data in reentries if data.get('reentry') and data.get('status') == 'PASS')
assert visual['status'] == 'FAIL'
assert respawn['status'] == reentry['status'] == 'PASS'
victim = respawn['victimId']
parts = {'M', 'U', 'X', 'Y'}
observed = visual['observed']
shared = [event for event in observed[0]['events'] if event['type'] == 'destroy' and event['targetId'] == victim and event in observed[1]['events']]
assert shared
rows = []
for page, record in enumerate(observed, 1):
    tail = [draw for draw in record['draws'] if draw['id'] == victim and draw['action'] == '09' and draw['overMessage'] == 0]
    assert {draw['part'] for draw in tail} == parts
    for draw in tail:
        assert draw['time'] == 5501 and draw['vertices'] > 0
        assert draw['asset'] == 'Data/role/001/09' + draw['part'] + '.glb'
        assert len(record['tailFrames'][victim + ':' + draw['part']]) >= 2
    assert not record['effectStarts']
    messages = [message for message in record['messages'] if message['owner'] == 'player-' + victim and message['identifier'] == 1416378268]
    assert {message['part'] for message in messages} == {'M', 'U'}
    assert all(message['identifier'] == 1416378268 and message['before'] == message['after'] for message in messages)
    assert all(sound.get('message', {}).get('action') != '09' for sound in record['sounds'] if sound.get('message'))
    assert not any(sound['reference'] in ('GA12', 'ww154') for sound in record['sounds'])
    assert any(sound['event'] in shared and sound['soundId'] == 55 and sound['started'] and sound['ended'] for sound in record['killSounds'])
    captures = {}
    for stage in ('lastDraw', 'lastTail'):
        capture = record['captures'][victim + ':' + stage]
        player = next(player for player in capture['world']['players'] if player['id'] == victim)
        assert not player['alive'] and player['tankId'] == 1 and player['deaths'] == 1
        assert all(clock['duration'] == 5601 for clock in capture['clocks'])
        if stage == 'lastTail':
            assert all(clock['time'] == 5501 and clock['overMessage'] == 0 for clock in capture['clocks'])
        path = visual_path.with_name(visual_path.stem + '-' + stage + '-' + str(page) + '.png')
        path.write_bytes(base64.b64decode(capture['canvas'].split(',')[1]))
        captures[stage] = {'frame': capture['frame'], 'world': capture['world'], 'clocks': capture['clocks'], 'png': str(path)}
    rows.append({'page': page, 'tailDraws': tail, 'captures': captures})
for record in respawn['observed']:
    assert {draw['part'] for draw in record['draws'] if draw['id'] == victim and draw['action'] == '01'} == parts
    assert any(life['id'] == victim and life['alive'] and life['action'] == '01' and life['hp'] == life['maxHp'] and life['deaths'] > 0 for life in record['lives'])
    assert record['captures'][victim + ':lastRevive']
zero = {'instances': 0, 'effectMeshes': 0, 'effectVoices': 0, 'battleVoices': 0, 'players': 0}
assert all(row == zero for row in respawn['cleanup'] + reentry['cleanup'] + reentry['finalCleanup'])
assert reentry['reentry']['mapId'] == 7 and reentry['reentry']['renderedPlayers'] == 1
assert reentry['reentry']['players'][0]['tankId'] == 1
result = {'status': 'PASS', 'tankId': 1, 'mapId': 7, 'victimId': victim,
          'deathVisualSource': str(visual_path), 'deathVisualSourceStatus': visual['status'],
          'respawnAndCleanupSource': str(respawn_path), 'reentrySource': str(reentry_path),
          'sameDestroy': shared[0], 'pages': rows, 'cleanup': respawn['cleanup'],
          'reentry': reentry['reentry'], 'finalCleanup': reentry['finalCleanup'],
          'scope': 'Same ordinary destroy dual visible original09/tail; independent ordinary dual01 respawn and cleanup; normal reentry and cleanup. Original001 death ELK empty; attacker GA14 separate.'}
(OUTPUT / 'combat-death-t01-actual.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
print('PASS: original001 same destroy dual09/tail, dual natural01, death silence / separate GA14, leave/reentry cleanup')
