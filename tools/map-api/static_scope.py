"""Select static map structures separately from original ground and sky meshes."""

from collections import defaultdict
import io
import json
from pathlib import Path

from PIL import Image

from assets import ROOT, glb, inventory, texture_name

GROUND_GROUPS = {
    '0001': ['plane14'], '0002': ['plane01'], '0003': ['plane03'],
    '0004': ['plane03'], '0005': ['plane04'], '0006': ['plane1134'],
    '0007': ['ground01', 'plane02'], '0008': ['plane02'], '0009': ['plane02'],
    '0010': ['plane04'], '0011': ['plane09'], '0012': ['plane05'],
    '0013': ['plane11'], '0014': ['plane02'], '0015': ['plane01'],
    '0016': ['plane02', 'object03'], '0017': ['plane02'], '0018': ['plane01'],
    '0019': ['plane01'], '0020': ['plane15'], '0021': ['plane04', 'object09'],
    '0022': ['plane02'], '0023': ['plane1134'], '0024': ['ddd'], '0025': ['plane03'],
}

EXCLUDED_MESHES = {
    '0007': {'object02/0'},
    '0011': {'btree06/1'},
    '0021': {'object02/0'},
}


def static_objects():
    result = []
    for mid, ground_groups in GROUND_GROUPS.items():
        relative = f'Data/map/{mid}/{mid}.glb'
        source = ROOT / 'art/original' / relative
        document, binary = glb(source)
        ground_textures = {texture_name(document['materials'][primitive.get('material', 0)]).lower()
            for mesh in document['meshes'] if mesh['name'].split('/')[0] in ground_groups
            for primitive in mesh['primitives']}
        groups = defaultdict(lambda: {'meshes': [], 'textures': set()})
        textures = {}
        selected = []
        for mesh in document['meshes']:
            if mesh['name'] in EXCLUDED_MESHES.get(mid, set()):
                continue
            group = mesh['name'].split('/')[0]
            for primitive in mesh['primitives']:
                material = document['materials'][primitive.get('material', 0)]
                if not material.get('pbrMetallicRoughness', {}).get('baseColorTexture'):
                    continue
                filename = texture_name(material)
                stem = Path(filename).stem.lower()
                if stem.startswith(('sky', 'cloud', 'beijing')):
                    continue
                wall = stem.startswith(('qiang', 'zhuangqiang'))
                if group in ground_groups and not wall:
                    continue
                if filename.lower() in ground_textures and not wall:
                    continue
                if filename not in textures:
                    path = source.parent / filename
                    provenance = str(path.relative_to(ROOT))
                    if not path.exists():
                        texture_index = material['pbrMetallicRoughness']['baseColorTexture']['index']
                        image_index = document['textures'][texture_index]['source']
                        view = document['bufferViews'][document['images'][image_index]['bufferView']]
                        start = view.get('byteOffset', 0)
                        image = Image.open(io.BytesIO(binary[start:start + view['byteLength']])).convert('RGBA')
                        path = ROOT / 'output/imagegen/map-api4k' / ('map-' + mid) / 'original-embedded' / filename
                        path.parent.mkdir(parents=True, exist_ok=True)
                        image.save(path)
                        provenance = str(source.relative_to(ROOT)) + '#image-' + str(image_index)
                    with Image.open(path) as image:
                        textures[filename] = {'filename': filename, 'reference': str(path.relative_to(ROOT)),
                            'originalSource': provenance, 'sourceSize': list(image.size),
                            'alphaRange': list(image.convert('RGBA').getchannel('A').getextrema())}
                selected.append(mesh['name'])
                groups[group]['meshes'].append(mesh['name'])
                groups[group]['textures'].add(filename)
        # Repeated placements use one representative complete object per material.
        reviewed, covered = [], set()
        for name, group in sorted(groups.items(), key=lambda item: (-len(item[1]['textures']), item[0])):
            if group['textures'] <= covered:
                continue
            reviewed.append({'name': name, 'meshes': sorted(set(group['meshes'])),
                             'textures': sorted(group['textures'])})
            covered.update(group['textures'])
        result.append({'model': 'map-' + mid, 'kind': 'static-map-objects',
            'sourceFolder': str(source.parent.relative_to(ROOT / 'art/original')),
            'maps': [mid] + (['1002'] if mid == '0002' else []),
            'classes': ['StaticMapObject'], 'publishedAssets': [relative], 'models': [relative],
            'excludedGroundGroups': ground_groups, 'meshNames': sorted(set(selected)),
            'excludedMeshes': sorted(EXCLUDED_MESHES.get(mid, set())),
            'reviewGroups': reviewed, 'textures': [textures[name] for name in sorted(textures)]})
    return result


if __name__ == '__main__':
    value = inventory()
    static = static_objects()
    value['objects'].extend(static)
    value.update(objectCount=len(value['objects']),
                 textureCount=sum(len(row['textures']) for row in value['objects']))
    (ROOT / 'tools/map-api/inventory.json').write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'mapCount': value['mapCount'], 'objectCount': value['objectCount'],
                     'textureCount': value['textureCount'],
                     'staticReviewGroups': sum(len(row['reviewGroups']) for row in static)}))
