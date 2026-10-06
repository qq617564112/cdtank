"""Verify the recorded ordinary0020 same-placement destruction and passage."""
import json
import sys
from pathlib import Path

output = Path('recovery/output')
path = Path(sys.argv[1])
data = json.loads(path.read_text())
rematch_path = Path(sys.argv[2]) if len(sys.argv) > 2 else path
rematch = json.loads(rematch_path.read_text())
assert rematch['status'] == 'PASS', 'Natural rematch/leave evidence must pass'
if path != rematch_path:
    assert data['status'] == 'FAIL'
    assert data['error'] == 'AssertionError [ERR_ASSERTION]: Ordinary natural mode5 match finishes'
    assert rematch['rematchLeaveOnly'] and rematch['mapId'] == 20
assert data['mapId'] == 20 and not data['rematchLeaveOnly']
target = data['targetId']
placement_id = target.removeprefix('SCN:')
scenes = json.loads((output / 'web-assets/scene-placements.json').read_text())
placement = next(p for s in scenes if s['id'] == '0020'
                 for p in s['records'] if p['id'] == placement_id)
model = placement['model']
assert model in {'obj05460', 'obj05461', 'obj05462', 'obj05442'}
sound_reference = {'obj05460': 'GA12', 'obj05461': 'GA41', 'obj05462': 'GA41', 'obj05442': 'GA41'}[model]
node_count = {'obj05460': 10, 'obj05461': 6, 'obj05462': 7, 'obj05442': 8}[model]
records = [r for r in data['serverTrace'] if r.get('round') == 1
           and r.get('targetId', r.get('event', {}).get('targetId')) == target]
phases = {r['phase']: r for r in records if r['kind'] == 'collisionPhase'}
assert set(phases) == {'INTACT', 'FADING', 'RELEASED'}
intact, fading, released = (phases[p] for p in ['INTACT', 'FADING', 'RELEASED'])
assert intact['matrix'] == placement['matrix']
assert intact['dimensions'] == placement['bounds']
assert intact['hp'] > 0 and fading['hp'] == released['hp'] == 0
assert intact['covered'] and fading['covered'] and not released['covered']
assert not intact['navigation']['valid'] and not fading['navigation']['valid']
assert released['navigation']['valid']
assert intact['boxHit']['boxId'] == fading['boxHit']['boxId'] == target
assert (released.get('boxHit') or {}).get('boxId') != target
assert intact['tick'] < fading['tick'] < released['tick']
assert released['navigationRevision'] > fading['navigationRevision']
assert released['serverTime'] - released['destroyedAt'] > 2000
impacts = [r for r in records if r['kind'] == 'ordinaryProjectileImpact']
assert {r['event']['type'] for r in impacts} >= {'objectiveHit', 'objectiveDestroyed'}
entries = [r for r in records if r['kind'] == 'actorEnteredClearedFootprint' and r['alive']]
assert entries, 'A live actor must actually enter the released footprint'
projectile = next(r for r in records if r['kind'] == 'projectileCrossedClearedFootprint')
assert projectile['tick'] >= released['tick']
assert 0 <= projectile['fraction'] <= 1 and projectile['start'] != projectile['end']
# Original scene bases are orthogonal rotations. Project into each original OBB axis.
matrix = placement['matrix']
for entry in entries:
    assert entry['tick'] >= released['tick']
    delta = [entry['position']['x'] - matrix[12], 0,
             entry['position']['z'] - matrix[14]]
    for axis in (0, 2):
        basis = matrix[axis * 4:axis * 4 + 3]
        local = sum(a * b for a, b in zip(delta, basis)) / sum(b * b for b in basis)
        assert abs(local) <= placement['bounds'][axis] / 2 + 0.0001
library = json.loads((output / 'web-assets/scene-breach-0020.json').read_text())
reference = 'Data/scnobj/' + model + '/c9.CVD'
resource = next(r for r in library['resources'] if r['reference'] == reference)
assert len(resource['nodes']) == node_count
draw_nodes = {index for index, node in enumerate(resource['nodes']) if node['parts']}
if model == 'obj05442':
    assert not resource['nodes'][0]['parts'] and draw_nodes == set(range(1, 8))
pages = []
assert len(data['observed']) == 2
for index, observed in enumerate(data['observed'], 1):
    capture = observed['capture']
    assert capture['id'] == placement_id and capture['model'] == model
    assert 0 < capture['alpha'] <= 1
    assert {d['node'] for d in capture['draws']} == draw_nodes
    assert all(d['vertices'] > 0 and d['sourceModel'] == reference for d in capture['draws'])
    objective = next(o for o in capture['world']['match']['objectives'] if o['id'] == target)
    assert objective['hp'] == 0 and objective['destroyedAt'] == fading['destroyedAt']
    assert any(d['id'] == placement_id and not d['broken'] and d['vertices'] > 0
               for d in observed['draws'])
    assert len({tuple(d['positions']) for d in observed['draws']
                if d['id'] == placement_id and d['broken'] and d['node'] == min(draw_nodes)}) > 1
    assert any(v['id'] == placement_id and v['hidden'] and not v['intactEnabled']
               for v in observed['visuals'])
    sound = next(s for s in observed['sounds'] if s['sourcePlacementId'] == placement_id
                 and s['reference'] == sound_reference and s['playing'] and s['ended'])
    assert not sound['loop'] and sound['position'] == placement['position']
    png = path.with_name(path.stem + '-natural-' + str(index) + '.png')
    assert png.is_file()
    pages.append({'page': index, 'frame': capture['frame'], 'alpha': capture['alpha'],
                  'nodes': len(capture['draws']), 'sound': sound, 'png': str(png)})
assert len(rematch['finished']) == 2
assert all(w['phase'] == 'FINISHED' for w in rematch['finished'])
for row in rematch['rematch']:
    assert row['world']['phase'] == 'PLAYING' and row['world']['match']['round'] == 2
    assert row['intactEnabled'] and row['visual'] == {'fading': False, 'hidden': False, 'alpha': 1}
    assert not row['soundPlayed'] and all(not m['enabled'] for m in row['brokenMeshes'])
    assert all(o['hp'] == o['maxHp'] for o in row['world']['match']['objectives'])
restored = next(r for r in rematch['serverTrace'] if r['kind'] == 'collisionPhase'
                and r['round'] == 2 and r['targetId'] == target and r['phase'] == 'INTACT')
assert restored['covered'] and not restored['navigation']['valid']
assert restored['boxHit']['boxId'] == target
assert all(r == {'breakables': 0, 'brokenMeshes': 0, 'instances': 0,
                 'sceneVoices': 0, 'battleVoices': 0} for r in rematch['cleanup'])
assert any(r['kind'] == 'roomLeaveCleanup' and r['removed'] and r['activeDynamicBoxes'] == 0
           for r in rematch['serverTrace'])
result = {'status': 'PASS', 'source': str(path), 'mapId': 20, 'targetId': target,
          'sourceStatus': data['status'], 'rematchSource': str(rematch_path),
          'phases': phases, 'ordinaryImpacts': impacts, 'actualEntries': entries,
          'actualSurvivingProjectile': projectile, 'pages': pages,
          'restoredCollision': restored, 'cleanup': rematch['cleanup'],
          'scope': f'Original {model} {node_count}-slot c9 with {len(draw_nodes)} drawable nodes and {sound_reference} actually rendered/heard on both normal pages; ordinary keyboard AI passage and surviving projectile crossing; natural rematch and leave. Two-second dynamic collision policy remains reconstructed.'}
(output / ('breach20-' + model.removeprefix('obj') + '-actual.json')).write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
print(f'PASS: ordinary0020 same {model} target dual c9/{sound_reference}, actor AND projectile passage, rematch and leave')
