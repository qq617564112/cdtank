"""Check saved ordinary Plant draw poses against original vertex inputs."""
import json
import math
from pathlib import Path
import struct
import sys

ROOT = Path(__file__).resolve().parents[1]
raw_path = Path(sys.argv[1])
raw = json.loads(raw_path.read_text())
assert raw['status'] in ('PASS', 'FAIL')
partial = raw['status'] != 'PASS'
map_id = raw['mapId']
assert map_id in (4, 5, 17)
map_name = f'{map_id:04d}'
resource = json.loads((ROOT / f'recovery/output/web-assets/scene-plant-{map_name}.json').read_text())
plants = {plant['sourcePlacementId']: plant for plant in resource['plants']}
scene = next(scene for scene in json.loads((ROOT / 'recovery/output/web-assets/scene-placements.json').read_text()) if scene['id'] == map_name)
records = {record['id']: record for record in scene['records']}
def f32(value): return struct.unpack('<f', struct.pack('<f', value))[0]
sides = []
for side, observed in enumerate(raw['observed'], 1):
    draw = observed['draws'][observed['target']]
    plant = plants[draw['id']]
    record = records[draw['id']]
    assert plant['enabled'] and record['className'] == 'SYcScnObjPlant'
    glb_raw = (ROOT / f"recovery/output/web-assets/Data/scnobj/{plant['model']}/{plant['model']}.glb").read_bytes()
    size = struct.unpack_from('<I', glb_raw, 12)[0]
    glb = json.loads(glb_raw[20:20+size])
    accessor = glb['accessors'][glb['meshes'][0]['primitives'][0]['attributes']['POSITION']]
    view = glb['bufferViews'][accessor['bufferView']]
    expected_source = list(struct.unpack_from('<'+'f'*(accessor['count']*3), glb_raw,
        28+size+view.get('byteOffset', 0)+accessor.get('byteOffset', 0)))
    assert draw['sourcePositions'] == expected_source
    poses = draw['poses']
    assert len(poses) in (1, 2, 3)
    if not partial: assert len(poses) == 3
    assert len({pose['parameter'] for pose in poses}) == len(poses)
    assert all(a['frame'] < b['frame'] for a,b in zip(poses,poses[1:]))
    changed = 0
    for i, pose in enumerate(poses):
        assert pose['height'] == plant['height']
        assert pose['parameter'] == f32(math.cos(pose['phase'])/pose['height']*f32(.15))
        assert len(pose['positions']) == len(expected_source)
        for k in range(0,len(expected_source),3):
            x,y,z = expected_source[k:k+3]
            expected = f32(x+f32(f32(pose['parameter']*y)*y))
            assert pose['positions'][k:k+3] == [expected,y,z]
            changed += expected != x
        px,py,pz = record['position']
        expected_matrix = [-1,0,0,0,0,1,0,0,0,0,1,0,-px,py,pz,1]
        assert max(abs(a-b) for a,b in zip(pose['matrix'],expected_matrix)) < .001
        capture = observed['captures']['natural' if i == 0 else f'pose-{i+1}']
        assert capture['frame'] == pose['frame'] and capture['target'] == observed['target']
    assert changed > 0
    sides.append(dict(page=side, sourcePlacementId=draw['id'], model=plant['model'],
                      actualDraws=draw['count'], naturalPoses=len(poses), changedVertices=changed,
                      frames=[pose['frame'] for pose in poses],
                      parameters=[pose['parameter'] for pose in poses],
                      sourceVerticesExact=True, sourceWorldMatrixExact=True))
if not partial:
    assert all(not side['owner'] and side['meshes'] == 0 for side in raw['leave'])
assert all(not side['owner'] and side['meshes'] == 0 for side in raw['finalCleanup'])
result = dict(status='PASS_AVAILABLE_DRAW_CONTRACT_PLAYER_GAP' if partial else 'PASS_LIMITED_ACTUAL_DRAW_CONTRACT', mapId=map_id, rawStatus=raw['status'], raw=raw_path.name, sides=sides,
              leave=raw.get('leave'), normalLeaveCaptured='leave' in raw, finalCleanup=raw['finalCleanup'],
              limitations=['Saved draw/vertex/capture contract does not prove independent visible pixel changes.',
                           'All placements, original ambient/material/GPU and HD parents remain open.'])
(ROOT / f'recovery/output/scene-plant{map_id:02d}-sway-actual.json').write_text(json.dumps(result,indent=2)+'\n')
print(result['status']+': saved Plant source vertices/available poses/world matrix/final cleanup')
