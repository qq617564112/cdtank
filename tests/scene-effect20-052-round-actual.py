"""Verify saved ordinary finish/rematch preserves live original052 owners."""
import json
from pathlib import Path
import sys
ROOT = Path(__file__).resolve().parents[1]
run = Path(sys.argv[1])
actual = json.loads(run.read_text())
assert actual['status'] == 'PASS' and actual['roundOnly']
common = actual['commonPlacementId']
assert all(world['phase']=='FINISHED' and world['match']['round']==1 for world in actual['finishedWorld'])
rows = []
for index, page in enumerate(actual['round2']):
    loaded, finished, rematch = [actual[key][index] for key in ['loaded','finished','rematch']]
    handles = [row['handle'] for row in loaded['instances']]
    assert len(handles)==5
    assert [row['handle'] for row in finished['instances']] == handles
    assert [row['handle'] for row in rematch['instances']] == handles
    assert [row['handle'] for row in page['instances']] == handles
    assert all(len(state['observed']['spawns'])==5 for state in [finished,rematch,page])
    for initial, end, new in zip(loaded['instances'], finished['instances'], page['instances']):
        assert initial['matrix'] == end['matrix'] == new['matrix']
        for start_node, end_node, new_node in zip(initial['nodes'],end['nodes'],new['nodes']):
            assert new_node['retain'] and new_node['phase']==2
            assert start_node['elapsed'] < end_node['elapsed'] < new_node['elapsed']
            if new_node['node'] in [2988,2989]:
                assert new_node['appearance']['angles'][2] != end_node['appearance']['angles'][2]
    counts = {str(node):page['observed']['counts'][f'{common}:{node}']-finished['observed']['counts'].get(f'{common}:{node}',0) for node in [2988,2989]}
    assert all(count>0 for count in counts.values())
    rows.append(dict(handles=handles,round2DrawsSinceFinish=counts,elapsedAtFinish=finished['instances'][0]['nodes'][0]['elapsed'],elapsedRound2=page['instances'][0]['nodes'][0]['elapsed']))
assert all(all(value==0 for value in row.values()) for row in actual['cleanup'])
out = dict(status='PASS',run=str(run),commonPlacementId=common,pages=rows,
    naturalFinished=True,sameRetainedMapTrees=True,noRestart=True,round2ActualDualDraws=True,leaveReleased=True,
    scope='Current reconstruction round lifecycle; original rematch business producer remains unverified')
(ROOT/'recovery/output/scene-effect20-052-round-actual.json').write_text(json.dumps(out,indent=2)+'\n')
print('PASS: natural finish/rematch same052 handles/matrices, continuous clocks/angles, dual round2 draws and Leave')
