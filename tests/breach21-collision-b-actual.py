"""Verify recorded ordinary0021 source destruction, released coverage and room ownership."""
import json
from pathlib import Path

OUTPUT = Path('recovery/output')
source_path = OUTPUT / 'browser-breach21-collision-b-2026-10-03T21-50-28-291Z.json'
source = json.loads(source_path.read_text())
assert source['status'] == 'FAIL'
rematches = [(path, json.loads(path.read_text())) for path in OUTPUT.glob('browser-breach21-collision-b-*.json')]
rematch_path, rematch = next((path, data) for path, data in rematches if data.get('rematchLeaveOnly') and data.get('status') == 'PASS')
placement_id = '62'
target_id = 'SCN:' + placement_id
records = [record for record in source['serverTrace'] if record.get('targetId', record.get('event', {}).get('targetId')) == target_id and record['round'] == 1]
phases = {record['phase']: record for record in records if record['kind'] == 'collisionPhase'}
assert set(phases) == {'INTACT', 'FADING', 'RELEASED'}
assert phases['INTACT']['hp'] > 0 and phases['FADING']['hp'] == phases['RELEASED']['hp'] == 0
assert phases['INTACT']['covered'] and phases['FADING']['covered'] and not phases['RELEASED']['covered']
assert not phases['INTACT']['navigation']['valid'] and not phases['FADING']['navigation']['valid'] and phases['RELEASED']['navigation']['valid']
assert phases['INTACT']['boxHit']['boxId'] == phases['FADING']['boxHit']['boxId'] == target_id
assert phases['RELEASED'].get('boxHit', {}).get('boxId') != target_id
assert phases['RELEASED']['navigationRevision'] > phases['FADING']['navigationRevision']
assert phases['INTACT']['tick'] < phases['FADING']['tick'] < phases['RELEASED']['tick']
impacts = [record for record in records if record['kind'] == 'ordinaryProjectileImpact']
assert {record['event']['type'] for record in impacts} >= {'objectiveHit', 'objectiveDestroyed'}
entry = next(record for record in records if record['kind'] == 'actorEnteredClearedFootprint' and record['isCpu'] and record['alive'])
projectile = next(record for record in records if record['kind'] == 'projectileCrossedClearedFootprint')
assert entry['tick'] > phases['RELEASED']['tick'] and projectile['tick'] > phases['RELEASED']['tick']
assert 0 <= projectile['fraction'] <= 1 and projectile['start'] != projectile['end']
scenes = json.loads((OUTPUT / 'web-assets/scene-placements.json').read_text())
placement = next(record for scene in scenes if scene['id'] == '0021' for record in scene['records'] if record['id'] == placement_id)
assert placement['model'] == 'obj05468'
assert phases['INTACT']['matrix'] == placement['matrix'] and phases['INTACT']['dimensions'] == placement['bounds']
# This chosen original placement has an identity basis; its horizontal footprint is exact.
assert placement['matrix'][:12] == [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0]
for axis, matrix_index, dimension_index in [('x', 12, 0), ('z', 14, 2)]:
    assert abs(entry['position'][axis] - placement['matrix'][matrix_index]) <= placement['bounds'][dimension_index] / 2
pages = []
for page, record in enumerate(source['observed'], 1):
    capture = record['captures'][placement_id]
    assert capture['model'] == 'obj05468' and 0 < capture['alpha'] <= 1
    assert {draw['node'] for draw in capture['draws']} == set(range(6))
    assert all(draw['vertices'] > 0 and draw['sourceModel'] == 'Data/scnobj/obj05468/c9.CVD' for draw in capture['draws'])
    objective = next(objective for objective in capture['world']['match']['objectives'] if objective['id'] == target_id)
    assert objective['hp'] == 0 and objective['destroyedAt'] == phases['FADING']['destroyedAt']
    assert any(draw['id'] == placement_id and not draw['broken'] and draw['vertices'] > 0 for draw in record['draws'])
    assert any(visual['id'] == placement_id and visual['hidden'] and not visual['intactEnabled'] for visual in record['visuals'])
    sound = next(sound for sound in record['sounds'] if sound['sourcePlacementId'] == placement_id and sound['reference'] == 'GA13' and sound['playing'] and sound['ended'])
    assert not sound['loop'] and sound['position'] == placement['position']
    png = source_path.with_name(source_path.stem + '-natural-' + str(page) + '.png')
    assert png.is_file()
    pages.append({'page': page, 'frame': capture['frame'], 'world': capture['world'], 'alpha': capture['alpha'], 'draws': capture['draws'], 'sound': sound, 'png': str(png)})
assert all(world['phase'] == 'FINISHED' and all(objective['hp'] == 0 for objective in world['match']['objectives']) for world in rematch['finished'])
for row in rematch['rematch']:
    assert row['world']['match']['round'] == 2 and row['world']['phase'] == 'PLAYING'
    assert row['intactEnabled'] and row['visual'] == {'fading': False, 'hidden': False, 'alpha': 1}
    assert not row['soundPlayed'] and all(not mesh['enabled'] for mesh in row['brokenMeshes'])
    assert all(objective['hp'] == objective['maxHp'] for objective in row['world']['match']['objectives'])
restored = next(record for record in rematch['serverTrace'] if record['kind'] == 'collisionPhase' and record['round'] == 2 and record['targetId'] == target_id and record['phase'] == 'INTACT')
assert restored['covered'] and not restored['navigation']['valid'] and restored['boxHit']['boxId'] == target_id
assert all(row == {'breakables': 0, 'brokenMeshes': 0, 'instances': 0, 'sceneVoices': 0, 'battleVoices': 0} for row in rematch['cleanup'])
assert any(record['kind'] == 'roomLeaveCleanup' and record['removed'] and record['activeDynamicBoxes'] == 0 for record in rematch['serverTrace'])
result = {'status': 'PASS', 'mapId': 21, 'placementId': placement_id, 'targetId': target_id,
          'destructionSource': str(source_path), 'destructionSourceStatus': source['status'],
          'normalRematchLeaveSource': str(rematch_path), 'phases': phases,
          'ordinaryImpacts': impacts, 'actualCpuEntry': entry, 'actualProjectileCrossing': projectile,
          'pages': pages, 'restoredCollision': restored, 'cleanup': rematch['cleanup'],
          'scope': 'Same original0021 placement62 dual visible c9/GA13, intact/fade OBB+NAV then release, ordinary surviving projectile crossing and CPU center entry, natural rematch restore and normal leave. Original NAV kernel/coverage policy remain rebuilt; old wall-clock observations do not establish exact source-clock timing.'}
(OUTPUT / 'breach21-collision-b-actual.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
print('PASS: ordinary0021 same62 dual c9/GA13, intact/fade/released collision, CPU entry/projectile crossing, natural rematch restoration and leave')
