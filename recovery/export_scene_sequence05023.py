"""Publish the original SYcScnObjSequence obj05023 library for maps 0008/0013."""
import configparser
import json
from pathlib import Path

from scene import read_scene

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'recovery/output/verified/assets/data'
WEB = ROOT / 'recovery/output/web-assets'

CLASS_NAME = 'SYcScnObjSequence'
MODEL = 'obj05023'
SOURCE_DELAY_VALUE = 100
SOURCE_DELAY_MULTIPLIER_F32 = 0.0010000000474974513
PLACEMENTS = (
    ('0008', '446'),
    ('0008', '447'),
    ('0013', '204'),
    ('0013', '205'),
)
BASE_REFERENCE = 'Data/scnobj/obj05023/obj05023.POL'
BASE_TEXTURE = 'Data/scnobj/obj05023/obj05023.png'
SCREEN_REFERENCE = 'Data/scnobj/obj05023/scr.POL'
FRAME_REFERENCES = tuple(
    f'Data/scnobj/obj05023/{index:03d}.dds' for index in range(1, 5))


def _read_placements():
    found = set()
    for map_id in ('0008', '0013'):
        records = read_scene(SOURCE / f'Data/scn/{map_id}/{map_id}.obj')
        for record in records:
            if record['className'] == CLASS_NAME and record['model'] == MODEL:
                found.add((map_id, record['id']))
    if found != set(PLACEMENTS):
        raise ValueError(f'Unexpected obj05023 placements: {sorted(found)}')
    return PLACEMENTS


def _read_delay():
    ini = configparser.ConfigParser()
    ini.read(SOURCE / 'Data/scnobj/obj05023/obj05023.ini', encoding='gbk')
    value = ini.getint('obj05023', 'delay')
    if value != SOURCE_DELAY_VALUE:
        raise ValueError(f'Unexpected obj05023 delay {value}')
    return value


def _published(lookup, reference):
    asset = lookup.get(reference.lower())
    if asset is None:
        raise ValueError(f'Missing published POL output for {reference}')
    if not (WEB / asset).is_file():
        raise ValueError(f'Missing published POL asset {asset}')
    return asset


def export():
    lookup = {entry['path'].lower(): entry['output']
              for entry in json.loads((WEB / 'pol-conversion.json').read_text())}
    placements = _read_placements()
    base_asset = _published(lookup, BASE_REFERENCE)
    screen_asset = _published(lookup, SCREEN_REFERENCE)
    if base_asset != 'Data/scnobj/obj05023/obj05023.glb':
        raise ValueError(f'Unexpected obj05023 base output {base_asset}')
    if screen_asset != 'Data/scnobj/obj05023/scr.glb':
        raise ValueError(f'Unexpected obj05023 screen output {screen_asset}')
    for asset in [BASE_TEXTURE, *(reference[:-4] + '.png' for reference in FRAME_REFERENCES)]:
        if not (WEB / asset).is_file():
            raise ValueError(f'Missing published Sequence texture {asset}')
    delay_value = _read_delay()
    result = dict(
        schemaVersion=1,
        className=CLASS_NAME,
        model=MODEL,
        source=dict(vtable='0x5c77e0', loader='0x460bcd', update='0x45f298',
                    screenNodes='0x44ef5e', textureAssign='0x5c09b8'),
        base=dict(reference=BASE_REFERENCE, asset=base_asset, texture=BASE_TEXTURE),
        screen=dict(reference=SCREEN_REFERENCE, asset=screen_asset),
        frames=[dict(reference=reference, asset=reference[:-4] + '.png')
                for reference in FRAME_REFERENCES],
        delay=dict(sourceValue=delay_value,
                   sourceMultiplierF32=SOURCE_DELAY_MULTIPLIER_F32,
                   seconds=delay_value * SOURCE_DELAY_MULTIPLIER_F32),
        placements=[dict(mapId=map_id, sourcePlacementId=source_id)
                    for map_id, source_id in placements])
    (WEB / 'scene-sequence05023.json').write_text(
        json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    return result['placements']


if __name__ == '__main__':
    placements = {(p['mapId'], p['sourcePlacementId']) for p in export()}
    path = WEB / 'scene-placements.json'
    scenes = json.loads(path.read_text())
    for scene in scenes:
        if scene['id'] in ('0008', '0013'):
            scene['resolved'] = sum(bool(r.get('asset') or r.get('animation') or r.get('special')
                or (scene['id'], r['id']) in placements) for r in scene['records'] + scene['castles'])
    path.write_text(json.dumps(scenes, ensure_ascii=False, indent=2) + '\n')
