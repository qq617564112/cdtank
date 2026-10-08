"""Publish twelve terrain selectors and five adopted texture references."""
import json
from pathlib import Path
import struct

from convert_pol import TERRAIN_TEXTURE_ADOPTIONS
from pol import read_pol

ROOT = Path(__file__).resolve().parents[1]
MAP_PARTS = {
    '0001': 85, '0003': 90, '0008': 221, '0009': 32,
    '0012': 104, '0013': 224, '0015': 29, '0016': 97,
    '0019': 160, '0023': 159, '0024': 222, '0025': 391,
}
TEXTURE_MATERIALS = {'0009': [26, 30], '0016': [33], '0023': [32, 134]}


def publish_textures(output, map_id):
    relative = f'Data/map/{map_id}/{map_id}.POL'
    mapping = TERRAIN_TEXTURE_ADOPTIONS.get(relative.lower())
    if not mapping:
        return []
    path = output / f'Data/map/{map_id}/{map_id}.glb'
    blob = path.read_bytes()
    magic, version, total = struct.unpack_from('<III', blob)
    assert (magic, version, total) == (0x46546c67, 2, len(blob))
    text_size, text_kind = struct.unpack_from('<I4s', blob, 12)
    assert text_kind == b'JSON'
    document = json.loads(blob[20:20 + text_size])
    binary_offset = 20 + text_size
    binary_size, binary_kind = struct.unpack_from('<I4s', blob, binary_offset)
    assert binary_kind == b'BIN\0'
    binary = bytearray(blob[binary_offset + 8:binary_offset + 8 + binary_size])
    changes = []
    for reference, asset in mapping.items():
        materials = TEXTURE_MATERIALS[map_id]
        assert all(document['materials'][index]['name'].lower() == reference for index in materials)
        adoption = dict(reference=reference, asset=asset,
                        source=asset.removesuffix('.png') + '.dds',
                        resolution='same-map-substitute' if map_id == '0016' else 'cross-directory-same-name')
        # Reuse a previous publication's embedded texture rather than append again.
        existing = next((document['materials'][index]['pbrMetallicRoughness']['baseColorTexture']['index']
                         for index in materials
                         if document['materials'][index].get('extras', {}).get('terrainTextureAdoption') == adoption), None)
        if existing is None:
            payload = (output / asset).read_bytes()
            binary.extend(b'\0' * (-len(binary) % 4))
            view = len(document['bufferViews'])
            document['bufferViews'].append(dict(buffer=0, byteOffset=len(binary), byteLength=len(payload)))
            binary.extend(payload)
            image = len(document.setdefault('images', []))
            document['images'].append(dict(bufferView=view, mimeType='image/png'))
            existing = len(document.setdefault('textures', []))
            document['textures'].append(dict(source=image))
        for index in materials:
            material = document['materials'][index]
            material['pbrMetallicRoughness']['baseColorTexture'] = dict(index=existing)
            material.setdefault('extras', {})['terrainTextureAdoption'] = adoption
        changes.append(dict(materials=materials, **adoption))
    document['buffers'][0]['byteLength'] = len(binary)
    text = json.dumps(document, ensure_ascii=False, separators=(',', ':')).encode()
    text += b' ' * (-len(text) % 4)
    binary.extend(b'\0' * (-len(binary) % 4))
    total = 12 + 8 + len(text) + 8 + len(binary)
    path.write_bytes(struct.pack('<III', 0x46546c67, 2, total) +
                     struct.pack('<I4s', len(text), b'JSON') + text +
                     struct.pack('<I4s', len(binary), b'BIN\0') + binary)
    return changes


def export():
    original = ROOT / 'recovery/output/verified/assets/data'
    output = ROOT / 'recovery/output/web-assets'
    selectors, adoptions = [], []
    for map_id, count in MAP_PARTS.items():
        source = f'Data/map/{map_id}/{map_id}.POL'
        model = read_pol(original / source)
        parts = []
        occurrences = {}
        for mesh in model['meshes']:
            assert mesh['fvf'] == 21
            for index, part in enumerate(mesh['parts']):
                assert part['kind'] in (0, 1) and part['textures']
                assert not any(part['textures'][1:])
                shader = 'geom_t_c1.gbf' if part['kind'] == 1 else 'geom_c1.gbf'
                name = f"{mesh['name']}/{index}"
                occurrence = occurrences.get(name, 0)
                parts.append(dict(mesh=name, kind=part['kind'], occurrence=occurrence,
                                  shader=f'Data\\gfxscript\\{shader}', texture=part['textures'][0]))
                occurrences[name] = occurrence + 1
        assert len(parts) == count
        result = dict(mapId=int(map_id), source=source, parts=parts)
        (output / f'scene-terrain-material-{map_id}.json').write_text(
            json.dumps(result, indent=2) + '\n')
        selectors.append(result)
        changes = publish_textures(output, map_id)
        if changes:
            adoptions.append(dict(mapId=int(map_id), source=source, changes=changes))
    conversions_path = output / 'pol-conversion.json'
    conversions = json.loads(conversions_path.read_text())
    for entry in conversions:
        mapping = TERRAIN_TEXTURE_ADOPTIONS.get(entry['path'].lower())
        if mapping:
            entry['missingTextures'] = [name for name in entry['missingTextures'] if name.lower() not in mapping]
            entry['adoptedTextures'] = mapping
    conversions_path.write_text(json.dumps(conversions, ensure_ascii=False, indent=2) + '\n')
    (output / 'scene-terrain-texture-adoptions.json').write_text(
        json.dumps(dict(maps=adoptions), ensure_ascii=False, indent=2) + '\n')
    return selectors


if __name__ == '__main__':
    print(f"Published {sum(len(value['parts']) for value in export())} terrain material selectors")
