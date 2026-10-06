"""Check saved ordinary dual-browser052 draws against original scene/resource data."""
import json
from pathlib import Path
import sys
ROOT = Path(__file__).resolve().parents[1]
run = Path(sys.argv[1]) if len(sys.argv)>1 else ROOT/'recovery/output/browser-scene-effect20-052-2026-10-04T01-52-08-527Z.json'
actual = json.loads(run.read_text())
source = json.loads((ROOT/'recovery/output/scene-effect20-052-source.json').read_text())
assert actual['status'] == source['status'] == 'PASS'
by_id = {r['id']:r for r in source['placements']}
controls = {r['node']:r for r in source['controls']}
common = actual['commonPlacementId']
pages = []
for page in actual['observed']:
    assert [r['id'] for r in page['instances']] == list(by_id)
    assert len(page['observed']['spawns']) == 5
    for instance in page['instances']:
        assert instance['matrix'] == by_id[instance['id']]['matrix']
        assert [n['node'] for n in instance['nodes']] == [2987,2988,2989]
        for node in instance['nodes']:
            assert node['retain'] and node['phase'] == 2 and node['elapsed'] > 0
            if node['node'] in controls:
                control = controls[node['node']]
                state = node['appearance']
                assert state['scale'] == control['appearance']['scale']
                assert state['color'] == control['appearance']['color']
                assert abs(state['angles'][2]-node['elapsed']*control['appearance']['angleRate'][2]) < .0001
    counts = {}
    for node in [2988,2989]:
        draws = [d for d in page['observed']['draws'] if d['id']==common and d['node']==node]
        assert len({tuple(d['positions']) for d in draws}) >= 2
        for draw in draws:
            assert draw['textures'] == ['/Data/effect/xy/FlareBrightOrange_yellow3.png']
            assert len(draw['positions']) == 18 and len(draw['colors']) == 24
            alpha = int(controls[node]['appearance']['color'][3]*255)/255
            for index in range(6):
                assert draw['colors'][index*4:index*4+3] == [1,1,1]
                assert abs(draw['colors'][index*4+3]-alpha) < 1e-7
            centre = [sum(draw['positions'][axis::3])/6 for axis in range(3)]
            target = list(by_id[common]['position']);target[0] *= -1
            assert all(abs(a-b)<.001 for a,b in zip(centre,target))
        counts[str(node)] = page['observed']['counts'][f'{common}:{node}']
    assert all(r['reference'] and r['reference'] != '052' for r in page['observed']['sounds'])
    pages.append(dict(drawCounts=counts, retainedPlacements=5, sourceMatrix=True,naturalAngleRate=True))
for key in ['cleanup','reentryCleanup']:
    assert all(all(value==0 for value in row.values()) for row in actual[key])
for index, page in enumerate(actual['reentry']):
    assert len(page['instances']) == 5 and len(page['observed']['spawns']) == 10
    assert not {r['handle'] for r in page['instances']} & {r['handle'] for r in actual['loaded'][index]['instances']}
out = dict(status='PASS',run=str(run),commonPlacementId=common,pages=pages,leaveAndReentryReleased=True,
    scope='Five source matrices/retained clocks; common269 actual dual sprite draws; other placements not individually qualified; round retention is rule evidence')
(ROOT/'recovery/output/scene-effect20-052-actual.json').write_text(json.dumps(out,indent=2)+'\n')
print('PASS: dual052 original matrices/scale/color/angular rates, actual269 texture/vertices/alpha, Leave and reentry')
