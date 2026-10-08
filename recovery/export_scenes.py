"""Export original placements with resolved static model references."""
import json
import struct
import configparser
from pathlib import Path
from scene import read_scene
from scene_breach import decode_breach_tail
from export_scene_ambient import export as export_scene_ambient
from export_scene_animation_0007 import export as export_scene_animation
from export_scene_animation_0010 import export as export_scene_animation_0010
from export_scene_animation_0018 import export as export_scene_animation_0018
from export_scene_breach21 import export as export_scene_breach
from export_scene_breach20 import export as export_scene_breach20
from export_scene_breach18 import export as export_scene_breach18
from export_scene_breach22 import export as export_scene_breach22
from export_scene_breach07 import export as export_scene_breach07
from export_scene_breach17 import export as export_scene_breach17
from export_scene_breach14 import export as export_scene_breach14
from export_scene_breach02_05427 import export as export_scene_breach02_05427
from export_scene_breach04 import export as export_scene_breach04
from export_scene_breach05 import export as export_scene_breach05
from export_scene_breach06 import export as export_scene_breach06
from export_scene_breach10 import export as export_scene_breach10
from export_scene_breach11 import export as export_scene_breach11
from export_scene_breach_catalog import export as export_scene_breach_catalog
from export_scene_castle02 import export as export_scene_castle02
from export_scene_castle06 import export as export_scene_castle06
from export_scene_castle05 import export as export_scene_castle05
from export_scene_castle10 import export as export_scene_castle10
from export_scene_castle11 import export as export_scene_castle11
from export_scene_water02 import export as export_scene_water02
from export_scene_plant02 import export as export_scene_plant02
from export_scene_plant04 import export as export_scene_plant04
from export_scene_plant05 import export as export_scene_plant05
from export_scene_plant06 import export as export_scene_plant06
from export_scene_plant17 import export as export_scene_plant17
from export_scene_plant21 import export as export_scene_plant21
from export_scene_plant05413_material import export as export_scene_plant05413_material
from export_scene_remaining_maps import export as export_scene_remaining_maps
from export_scene_terrain02_material import export as export_scene_terrain02_material
from export_scene_terrain18_material import export as export_scene_terrain18_material
from export_scene_terrain11_material import export as export_scene_terrain11_material
from export_scene_terrain07_material import export as export_scene_terrain07_material
from export_scene_terrain20_material import export as export_scene_terrain20_material
from export_scene_terrain21_material import export as export_scene_terrain21_material
from export_scene_terrain22_material import export as export_scene_terrain22_material
from export_scene_terrain05_material import export as export_scene_terrain05_material
from export_scene_terrain10_material import export as export_scene_terrain10_material
from export_scene_terrain06_material import export as export_scene_terrain06_material
from export_scene_terrain14_material import export as export_scene_terrain14_material
from export_scene_terrain17_material import export as export_scene_terrain17_material
from export_scene_terrain04_material import export as export_scene_terrain04_material
from export_scene_extended_terrain_material import export as export_scene_extended_terrain_material
from export_scene_sequence05023 import export as export_scene_sequence05023
from export_scene_special_objects import export as export_scene_special_objects, PLACEMENTS as special_placements

root = Path('recovery/output/verified/assets/data')
out = Path('recovery/output/web-assets')
breach_catalog_models = ('obj05438', 'obj05440', 'obj05441', 'obj05446', 'obj05463')
models = json.loads((out / 'pol-conversion.json').read_text())
lookup = {Path(entry['path']).stem.lower(): entry['output'] for entry in models}
animated = {entry['path'].lower(): entry['output']
    for entry in json.loads((out / 'mv3-conversion.json').read_text())}
export_scene_ambient()
export_scene_animation()
export_scene_animation_0010()
export_scene_animation_0018()
export_scene_breach()
export_scene_breach20()
export_scene_breach18()
export_scene_breach22()
export_scene_breach07()
export_scene_breach17()
export_scene_breach14()
export_scene_breach02_05427()
export_scene_breach04()
export_scene_breach05()
export_scene_breach06()
export_scene_breach10()
export_scene_breach11()
export_scene_castle02()
export_scene_castle06()
export_scene_castle05()
export_scene_castle10()
export_scene_castle11()
export_scene_water02()
export_scene_plant02()
export_scene_plant04()
export_scene_plant05()
export_scene_plant06()
export_scene_plant17()
export_scene_plant21()
export_scene_plant05413_material()
export_scene_remaining_maps()
export_scene_terrain02_material()
export_scene_terrain18_material()
export_scene_terrain11_material()
export_scene_terrain07_material()
export_scene_terrain20_material()
export_scene_terrain21_material()
export_scene_terrain22_material()
export_scene_terrain05_material()
export_scene_terrain10_material()
export_scene_terrain06_material()
export_scene_terrain14_material()
export_scene_terrain17_material()
export_scene_terrain04_material()
export_scene_extended_terrain_material()
sequence_placements = {(placement['mapId'], placement['sourcePlacementId'])
    for placement in export_scene_sequence05023()}
export_scene_special_objects()
scenes = []
for path in sorted((root / 'Data/scn').rglob('*.obj')):
    records = read_scene(path)
    castles = read_scene(path.with_suffix('.cas'))
    collision_boxes = read_scene(path.with_suffix('.box'))
    for box in collision_boxes:
        raw = bytes.fromhex(box['tail'])
        box['shapeStamp'] = struct.unpack_from('<I', raw)[0]
        box['shapeMatrix'] = struct.unpack_from('<16f', raw, 4)
        box['dimensions'] = struct.unpack_from('<3f', raw, 68)
    for record in records + castles:
        special = special_placements.get((path.stem, record['id']))
        if special:
            record['special'] = special
        if record['className'] == 'SYcScnObjBreach':
            record['breachFields'] = decode_breach_tail(bytes.fromhex(record['tail']))
        if record['className'] in ('SYcScnObjPlant', 'SYcScnObjBreach', 'SYcScnObjGeneral', 'SYcScnObjCrush', 'SYcCastle'):
            record['asset'] = lookup.get(record['model'].lower())
        if path.stem in ('0007', '0021') and record['className'] == 'SYcScnObjGeneral' and record['model'] == 'obj05025':
            record['animation'] = dict(library='scene-animation-0007.json',
                reference='Data/scnobj/obj05025/obj05025.CVD')
        if ((path.stem, record['id']) in (('0003', '146'), ('0010', '106'))
                and record['className'] == 'SYcScnObjGeneral' and record['model'] == 'obj05015'):
            record['animation'] = dict(library='scene-animation-0010.json',
                reference='Data/scnobj/obj05015/obj05015.CVD')
        if ((path.stem, record['id']) in (('0009', '111'), ('0009', '112'), ('0015', '103'),
                ('0015', '108'), ('0018', '66'), ('0018', '67'), ('0018', '68'), ('0018', '69'))
                and record['className'] == 'SYcScnObjGeneral' and record['model'] == 'obj05018'):
            record['animation'] = dict(library='scene-animation-0018.json',
                reference='Data/scnobj/obj05018/obj05018.CVD')
        if record['className'] == 'SYcCastle':
            model_dir = root / 'Data/scnobj' / record['model']
            actions = configparser.ConfigParser()
            actions.read(model_dir / (record['model'] + '.ini'), encoding='gbk')
            record['previewAction'] = actions['action_1']['name']
            model_path = model_dir / actions['action_1']['file']
            record['asset'] = animated[model_path.relative_to(root).as_posix().lower()]
    entry = dict(id=path.stem, terrain=f'Data/map/{path.stem}/{path.stem}.glb',
        records=records, castles=castles, collisionBoxes=collision_boxes,
        resolved=sum(bool(r.get('asset') or r.get('animation') or r.get('special')
            or (path.stem, r['id']) in sequence_placements) for r in records + castles))
    scenes.append(entry)
export_scene_breach_catalog(scenes, root, out, breach_catalog_models)
(out / 'scene-placements.json').write_text(json.dumps(scenes,ensure_ascii=False,indent=2),encoding='utf-8')
print(f'{len(scenes)} scenes, {sum(len(s["records"]) for s in scenes)} records, {sum(s["resolved"] for s in scenes)} static model references resolved')
print(f'{sum(len(s["castles"]) for s in scenes)} castles, {sum(len(s["collisionBoxes"]) for s in scenes)} virtual boxes preserved')
