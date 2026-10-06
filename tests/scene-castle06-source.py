"""Verify Castle06 actions against original CAS/INI/MV3 and published GLB data."""
import configparser
from io import BytesIO
import json
from pathlib import Path
import struct
import sys
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'recovery'))
from mv3 import read_mv3
from scene import read_scene

SOURCE = ROOT / 'recovery/output/verified/assets/data'
WEB = ROOT / 'recovery/output/web-assets'
records = read_scene(SOURCE / 'Data/scn/0006/0006.cas')
library = json.loads((WEB / 'scene-castle-0006.json').read_text())
assert library['mapId'] == 6 and len(records) == len(library['castles']) == 2
assert [(r['id'], r['model']) for r in records] == [('81', 'obj05449'), ('82', 'obj05450')]
native = json.loads((ROOT / 'recovery/output/castle-damage-native.json').read_text())
assert native['status'] == 'PASS'
attachment_names = [tag['name'] for tag in native['tags']]
assert attachment_names == ['tag_spout1', 'tag_spout2', 'tag_spout3', 'tag_spout4', 'tag_spout5']
rows = []
for record, entry in zip(records, library['castles']):
    assert entry['sourcePlacementId'] == record['id'] and entry['model'] == record['model']
    assert entry['position'] == list(record['position']) and entry['matrix'] == list(record['matrix'])
    ini = configparser.ConfigParser()
    model_dir = SOURCE / 'Data/scnobj' / record['model']
    ini.read(model_dir / (record['model'] + '.ini'), encoding='gbk')
    assert [a['name'] for a in entry['actions']] == [ini[s]['name'] for s in ini.sections()]
    assert {a['name'] for a in entry['actions']} == {'c1', 'c2', 'c3', 'n1', 'n2'}
    action_rows = []
    for section, action in zip(ini.sections(), entry['actions']):
        reference = (model_dir / ini[section]['file']).relative_to(SOURCE).as_posix()
        assert action['name'] == ini[section]['name'] and action['file'] == reference and action['available']
        model = read_mv3(SOURCE / reference)
        assert model['consumed'] == model['size']
        assert action['durationMs'] == model['duration']
        assert action['tracks'] == json.loads(json.dumps(model['tracks'])) and action['tags'] == model['tags']
        assert action['sourceBounds'] == json.loads(json.dumps([
            dict(name=m['name'], bounds=m['bounds']) for m in model['meshes']]))
        blob = (WEB / action['asset']).read_bytes()
        size = struct.unpack_from('<I', blob, 12)[0]
        document = json.loads(blob[20:20 + size])
        binary = blob[28 + size:]
        assert {track['name'] for track in action['tracks']} == set(attachment_names)
        assert document['extras']['attachmentTracks'] == action['tracks']
        assert document['extras']['tags'] == action['tags']
        assert document['extras']['mv3Duration'] == model['duration']

        def values(index):
            accessor = document['accessors'][index]
            view = document['bufferViews'][accessor['bufferView']]
            count = accessor['count'] * {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3}[accessor['type']]
            return list(struct.unpack_from(f'<{count}f', binary, view.get('byteOffset', 0)))

        parts = [(m, p) for m in model['meshes'] if m['frames']
                 for p in m['parts'] if p['faces']]
        assert len(parts) == len(document['meshes'])
        vertices = 0
        for (mesh, part), published in zip(parts, document['meshes']):
            primitive = published['primitives'][0]
            references = [(face[i], face[i + 3]) for face in part['faces'] for i in range(3)]
            base = [v / 64 for vertex, _ in references for v in mesh['frames'][0]['vertices'][vertex][:3]]
            assert values(primitive['attributes']['POSITION']) == base
            assert values(primitive['attributes']['TEXCOORD_0']) == [
                mesh['uv'][uv * 2 + axis] for _, uv in references for axis in range(2)]
            targets = primitive.get('targets', [])
            assert len(targets) == len(mesh['frames']) - 1
            for target, frame in zip(targets, mesh['frames'][1:]):
                positions = [v / 64 for vertex, _ in references for v in frame['vertices'][vertex][:3]]
                assert values(target['POSITION']) == [p - b for p, b in zip(positions, base)]
            vertices += len(references) * len(mesh['frames'])
        for source_material, material in zip(model['materials'], document['materials']):
            assert material['extras']['originalMV3']['properties'] == list(source_material['properties'])
            assert material['extras']['originalMV3']['textures'] == source_material['textures']
            texture_index = material['pbrMetallicRoughness']['baseColorTexture']['index']
            image = document['images'][document['textures'][texture_index]['source']]
            view = document['bufferViews'][image['bufferView']]
            png = binary[view.get('byteOffset', 0):view.get('byteOffset', 0) + view['byteLength']]
            source_texture = model_dir / Path(source_material['textures'][0]).with_suffix('.dds').name
            with Image.open(source_texture) as original, Image.open(BytesIO(png)) as published:
                assert original.size == published.size
                assert original.convert('RGBA').tobytes() == published.convert('RGBA').tobytes()
        action_rows.append(dict(name=action['name'], asset=action['asset'], durationMs=action['durationMs'],
                                geometryParts=len(parts), frameVertices=vertices,
                                attachmentTracks=[dict(name=t['name'], keys=len(t['frames'])) for t in model['tracks']]))
    rows.append(dict(sourcePlacementId=record['id'], model=record['model'], actions=action_rows))
result = dict(status='PASS', mapId=6, rows=rows, attachmentSlots=native['tags'],
              attachmentEvidence='castle-damage-native.json',
              scope='Original CAS placement and INI action mapping; ten MV3 full-frame geometry, UV, material, embedded DDS pixels and attachment tracks. No HP action-selection or actual battle claim.')
(ROOT / 'recovery/output/scene-castle06-source.json').write_text(json.dumps(result, indent=2) + '\n')
print('PASS: Castle81/82 ten original actions/geometry/UV/material/texture/attachment tracks')
