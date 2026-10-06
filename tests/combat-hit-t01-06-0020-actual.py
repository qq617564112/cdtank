"""Verify ordinary00106 source sampling, timed silence and natural completion."""
import base64
import json
import struct
import sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'recovery'))
from mv3 import read_mv3
source = Path(sys.argv[1]).resolve()
run = json.loads(source.read_text())
metadata = json.loads((ROOT / 'recovery/output/combat-hit-t01-06-0020-source.json').read_text())
assert run['status'] == metadata['status'] == 'PASS'
assert len(run['initial']) == 2 and all(w['mapId'] == 20 and w['mode'] == 5 and len(w['players']) == 4 for w in run['initial'])
target, attacker = run['victimId'], run['attackerId']
owner = 'player-' + target
assert run['inputs'] and any('Space' in r['attackerKeys'] for r in run['inputs'])
assert any('KeyS' in r['attackerKeys'] for r in run['inputs'])
parts = ['M', 'U', 'X', 'Y']
assert sorted(r['part'] for r in metadata['components']) == parts
assert all(r['duration'] == 2561 and r['stopTime'] == 2461 for r in metadata['components'])
assert metadata['hurtEffect'] is None and metadata['hurtSound'] is None
pages, hits = [], []
for index, observed in enumerate(run['observed'], 1):
    events = [e for e in observed['events'] if e['type'] == 'hit' and e['playerId'] == attacker and e['targetId'] == target]
    assert events and all(e['hurtSelector'] == 2 and e['value'] > 0 for e in events)
    hits.append(events)
    assert any(h['owner'] == owner and h['selector'] == 2 and h['alive'] for h in observed['hurts'])
    capture = next(c for c in observed['captures'] if c['id'] == target)
    assert sorted({d['part'] for d in capture['draws']}) == parts
    assert capture['world']['players'][0]['tankId'] == 1
    victim = next(p for p in capture['world']['players'] if p['id'] == target)
    assert victim['alive'] and 0 < victim['hp'] < victim['maxHp']
    assert all(d['asset'] == f"Data/role/001/06{d['part']}.glb" and d['vertices'] > 0 and d['action'] == '06' for d in capture['draws'])
    assert not any(e['type'] == 'destroy' and e['targetId'] == target for e in observed['events'])
    timed = [m for m in observed['messages'] if m['owner'] == owner and m['identifier'] == 1416378268]
    complete = [m for m in observed['messages'] if m['owner'] == owner and m['identifier'] == 1870030194]
    assert sorted({m['part'] for m in timed}) == ['M', 'U']
    # time160 is the source event keyframe; callbacks carry the current clock after crossing it.
    assert timed and all(m['action'] == '06' and 160 <= m['time'] < 2561 for m in timed)
    assert sorted({m['part'] for m in complete}) == parts and all(m['time'] == 2461 for m in complete)
    assert all(m['before'] == m['after'] and m['voicesBefore'] == m['voicesAfter'] and m['skillBefore'] == m['skillAfter'] for m in [*timed, *complete])
    states = [s for s in observed['states'] if s['id'] == target]
    finished = next(i for i, s in enumerate(states) if s['action'] == '06' and s['alive'] and sorted(c['part'] for c in s['clocks']) == parts and all(c['time'] == 2461 and c['overMessage'] == 0 for c in s['clocks']))
    restored = next(s for s in states[finished + 1:] if s['action'] == '01' and s['alive'])
    assert restored['hp'] > 0
    pose_changes = {}
    for part in parts:
        draws = [d for d in observed['draws'] if d['owner'] == owner and d['part'] == part]
        morphs = len({json.dumps(d['morphs']) for d in draws})
        assert morphs > 1 and any(any(w > 0 for w in d['morphs']) for d in draws)
        model = read_mv3(ROOT / f'recovery/output/verified/assets/data/Data/role/001/06{part}.MV3')
        meshes = {mesh['name']: mesh for mesh in model['meshes']}
        assert {d['mesh'].split('/')[0] for d in draws} == set(meshes)
        source_times = {name: [struct.unpack('<f', struct.pack('<f', f['time'] / 1000))[0] for f in mesh['frames']] for name, mesh in meshes.items()}
        maximum_error = 0
        for draw in draws:
            times = source_times[draw['mesh'].split('/')[0]]
            weights = draw['morphs']
            assert len(weights) == len(times) - 1 and draw['clock']['duration'] == 2561
            time = draw['clock']['time'] / 1000
            low = max(i for i, t in enumerate(times) if t <= time)
            high = min(low + 1, len(times) - 1)
            fraction = (time - times[low]) / (times[high] - times[low]) if high != low else 0
            expected = [(1 - fraction if i == low else 0) + (fraction if i == high else 0) for i in range(1, len(times))]
            error = max(abs(a - b) for a, b in zip(weights, expected))
            assert error < 1e-5, (part, time, error)
            maximum_error = max(maximum_error, error)
        pose_changes[part] = dict(draws=len(draws), morphStates=morphs, sourceMeshes=len(meshes), sourceFramesByMesh={name: len(times) for name, times in source_times.items()}, maximumSourceWeightError=maximum_error)
    png = ROOT / f'recovery/output/combat-hit-t01-06-0020-accepted-{index}.png'
    png.write_bytes(base64.b64decode(capture['canvas'].split(',', 1)[1]))
    pages.append(dict(frame=capture['frame'], hp=victim['hp'], poseChanges=pose_changes,
                      draws=capture['draws'], timedMessages=timed, completionMessages=complete,
                      completeState=states[finished], restored=restored, png=str(png.relative_to(ROOT))))
assert hits[0] == hits[1]
assert len(run['cleanup']) == 2 and all(all(v == 0 for v in row.values()) for row in run['cleanup'])
output = dict(status='PASS', scope='Ordinary0020 nonlethal001 selector2/06: same target, dual four-source-component actual draws and sampled original weights, M/U time160 source silence, four over2461 and natural01 restoration.',
              sourceBrowser=str(source.relative_to(ROOT)), sourceBrowserStatus=run['status'],
              sourceMetadata='recovery/output/combat-hit-t01-06-0020-source.json', targetId=target,
              attackerId=attacker, hits=hits[0], inputSamples=len(run['inputs']), pages=pages,
              cleanup=run['cleanup'], lifecycleReferences=run['lifecycleReferences'],
              eventClockContract=dict(sourceKeyframe=160, initialClock=1, crossing='previous < eventTime <= current', callbackTime='Current action clock; no pre-crossing06 frame was captured', source='Existing original actor clock execution and EffectActorActionClock/queryEffectActionEvents'),
              limitations='Original GPU pixels, other selectors/roles and original damage rules remain outside this local slice.')
(ROOT / 'recovery/output/combat-hit-t01-06-0020-actual.json').write_text(json.dumps(output, indent=2) + '\n')
print('PASS: same ordinary00106 dual four-part draws/source weights, M/U timed silence, four over2461/natural01 and normal Leave')
