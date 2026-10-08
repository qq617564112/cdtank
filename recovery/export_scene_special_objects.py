"""Publish the Hook and WaterFall source resources and their exact placements."""
import configparser
import json
import re
import struct
from pathlib import Path

from mv3 import read_mv3
from pol import read_pol
from scene import read_scene

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'recovery/output/verified/assets/data'
WEB = ROOT / 'recovery/output/web-assets'
PLACEMENTS = {
    ('0012', '321'): dict(kind='hook', library='scene-hook-0012.json'),
    ('0016', '328'): dict(kind='waterfall', library='scene-waterfall-0016.json'),
}


def placement(map_id, identifier, class_name, model):
    record = next(r for r in read_scene(SOURCE / f'Data/scn/{map_id}/{map_id}.obj')
                  if r['id'] == identifier)
    if record['className'] != class_name or record['model'] != model:
        raise ValueError(f'Unexpected special scene object {map_id}/{identifier}')
    return record


def published(asset):
    if not (WEB / asset).is_file():
        raise ValueError(f'Missing special scene asset {asset}')
    return asset


def export():
    hook = placement('0012', '321', 'SYcScnObjHook', 'obj05027')
    ini = configparser.ConfigParser()
    ini.read(SOURCE / 'Data/scnobj/obj05027/obj05027.ini', encoding='gbk')
    reference = 'Data/scnobj/obj05027/' + ini['action_1']['file']
    converted = {r['path'].lower(): r['output']
                 for r in json.loads((WEB / 'mv3-conversion.json').read_text())}
    model = read_mv3(SOURCE / reference)
    track = next(t for t in model['tracks'] if t['name'] == 'tag_spout1')
    tail = bytes.fromhex(hook['tail'])
    effect_length = struct.unpack_from('<I', tail, 17)[0]
    effect = tail[21:21 + effect_length].decode('ascii').rstrip('\0')
    result = dict(mapId='0012', sourcePlacementId='321', model=hook['model'],
                  className=hook['className'], reference=reference,
                  asset=published(converted[reference.lower()]),
                  action=ini['action_1']['name'], durationMs=model['duration'],
                  track=track, effect=effect)
    (WEB / 'scene-hook-0012.json').write_text(
        json.dumps(result, ensure_ascii=False, indent=2) + '\n')

    fall = placement('0016', '328', 'SYcScnObjWaterFall', 'obj05202')
    reference = 'Data/scnobj/obj05202/obj05202.POL'
    nodes = []
    for mesh in read_pol(SOURCE / reference)['meshes']:
        vertices, colors = [], []
        for raw in mesh['vertices']:
            position = struct.unpack_from('<3f', raw)
            normal = struct.unpack_from('<3f', raw, 12) if mesh['fvf'] & 2 else (0, 0, 0)
            offset = 24 if mesh['fvf'] & 2 else 12
            if mesh['fvf'] & 4:
                b, g, r, a = raw[offset:offset + 4]
                colors.append([r / 255, g / 255, b / 255, a / 255])
                offset += 4
            vertices.append([*position, *normal, *struct.unpack_from('<2f', raw, offset)])
        parts = [dict(kind=p['kind'], properties=p['properties'],
                      asset=published('Data/scnobj/obj05202/obj052021.png'),
                      indices=[i for face in p['faces'] for i in face]) for p in mesh['parts']]
        nodes.append(dict(fvf=mesh['fvf'], vertices=vertices, colors=colors or None, parts=parts))
    scripts = []
    for name in ('default', 'newgeom', 'geom_t', 'geom_c1', 'geom_t_c1'):
        text = re.sub(r'//[^\n]*', '', (SOURCE / f'Data/gfxscript/{name}.gbf').read_text())
        states = [dict(name=m[1], value=re.sub(r'\s+', '', m[2]).upper())
                  for m in re.finditer(r'(\w+(?:\[\d+\])?)\s*=\s*([\w|]+)\s*;',
                                       text.split('technique', 1)[1])]
        scripts.append(dict(name=name, states=states))
    result = dict(mapId='0016', sourcePlacementId='328', model=fall['model'],
                  className=fall['className'], frameSeconds=0.1,
                  frames=[published(f'Data/scnobj/obj05202/obj05202{i}.png') for i in range(1, 6)],
                  resources=[dict(reference=reference, resolution='published', nodes=nodes)],
                  scripts=scripts, graphics=dict(ambient=[1, 1, 1, 1], emissive=0))
    (WEB / 'scene-waterfall-0016.json').write_text(
        json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    return PLACEMENTS


def apply_placements(scenes):
    for scene in scenes:
        for record in scene['records']:
            special = PLACEMENTS.get((scene['id'], record['id']))
            if special:
                record['special'] = special


if __name__ == '__main__':
    export()
    path = WEB / 'scene-placements.json'
    scenes = json.loads(path.read_text())
    for scene in scenes:
        added = sum((scene['id'], r['id']) in PLACEMENTS and not r.get('special')
                    and not r.get('asset') and not r.get('animation') for r in scene['records'])
        scene['resolved'] += added
    apply_placements(scenes)
    path.write_text(json.dumps(scenes, ensure_ascii=False, indent=2) + '\n')
