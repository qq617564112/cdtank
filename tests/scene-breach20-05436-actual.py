"""Verify the recorded ordinary0020 same-source05436 destruction on both pages."""
import json
from pathlib import Path
import sys
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'recovery'))
from scene import read_scene
source = Path(sys.argv[1]).resolve()
run = json.loads(source.read_text())
assert run['status'] == 'PASS' and run['mapId'] == 20 and run['tankId'] == 1
assert len(run['initial']) == 2 and all(w['mode'] == 5 and w['mapId'] == 20 and len(w['players']) == 4 for w in run['initial'])
id = run['targetId'].removeprefix('SCN:')
placement = next(r for r in read_scene(ROOT / 'recovery/output/verified/assets/data/Data/scn/0020/0020.obj') if r['id'] == id)
assert placement['model'] == 'obj05436' and abs(placement['bounds'][2]) < 1e-10
resource = next(r for r in json.loads((ROOT / 'recovery/output/web-assets/scene-breach-0020.json').read_text())['resources'] if r['reference'] == 'Data/scnobj/obj05436/c9.CVD')
expected = [i for i, n in enumerate(resource['nodes']) if n['parts']]
assert expected == run['sourceGeometryNodes'] == list(range(13))
source_proof = json.loads((ROOT / 'recovery/output/scene-breach20-05436-source.json').read_text())
assert source_proof['status'] == 'PASS'
events, pages = [], []
for observed in run['observed']:
    relevant = [e for e in observed['events'] if e.get('targetId') == run['targetId']]
    assert len([e for e in relevant if e['type'] == 'objectiveDestroyed']) == 1
    hits = [e for e in relevant if e['type'] == 'objectiveHit']
    assert hits and all(e['value'] > 0 for e in hits) and sum(e['value'] for e in hits) == 200
    events.append(relevant)
    capture = observed['capture']
    assert capture['id'] == id and capture['model'] == 'obj05436'
    assert sorted(d['node'] for d in capture['draws']) == expected
    assert all(d['broken'] and d['sourceModel'] == resource['reference'] and d['vertices'] > 0 for d in capture['draws'])
    assert all(d['textures'] and any(t.endswith('/Data/scnobj/obj05436/obj05436.png') for t in d['textures']) for d in capture['draws'])
    assert any(d['id'] == id and not d['broken'] and d['vertices'] > 0 for d in observed['draws'])
    changed = [node for node in expected if len({json.dumps(d['positions']) for d in observed['draws'] if d['id'] == id and d['broken'] and d['node'] == node}) > 1]
    assert changed
    sounds = [s for s in observed['sounds'] if s['sourcePlacementId'] == id]
    assert len(sounds) == 1
    sound = sounds[0]
    assert sound['reference'] == 'GA12' and sound['selector'] == 1 and sound['playing'] and sound['ended'] and not sound['loop']
    assert sound['position'] == list(placement['position']) and sound['src'].endswith('/audio/sound/GA12.wav')
    visuals = [v for v in observed['visuals'] if v['id'] == id]
    assert any(v['fading'] and not v['hidden'] and not v['intactEnabled'] for v in visuals)
    assert any(v['hidden'] for v in visuals)
    pages.append(dict(frame=capture['frame'], alpha=capture['alpha'], nodes=expected, changedNodes=changed, sound=sound, visuals=visuals))
assert events[0] == events[1]
assert len(run['cleanup']) == 2 and all(all(value == 0 for value in row.values()) for row in run['cleanup'])
result = dict(status='PASS', browserEvidence=str(source.relative_to(ROOT)), targetId=run['targetId'],
              placement=dict(model=placement['model'], position=placement['position'], bounds=placement['bounds']),
              sameEvents=events[0], pages=pages, cleanup=run['cleanup'],
              scope='One original05436 ordinary destruction: dual intactPOL/c9 thirteen-node draws/changing pose, original GA12 once/ended, hidden and normal Leave; no collision/pass-through or rematch claim')
(ROOT / 'recovery/output/scene-breach20-05436-actual.json').write_text(json.dumps(result, indent=2) + '\n')
print('PASS: same ordinary05436 five hits/destruction, dual original13-node CVD animation/texture, GA12 once/ended, hidden and normal Leave')
