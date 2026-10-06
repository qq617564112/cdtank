"""Publish original Sound and Effect placements for all installed maps."""
import json
from pathlib import Path

from export_audio_events import export as export_audio_events
from mv3 import Reader
from scene import read_scene
from scene_sound import decode_sound_tail

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'recovery/output/verified/assets/data'
WEB = ROOT / 'recovery/output/web-assets'


def effect_placement(record):
    reader = Reader(bytes.fromhex(record['tail']))
    if reader.integer() != 0x778346a2:
        raise ValueError(f"Unsupported scene Effect stamp: {record['id']}")
    field04 = reader.name(reader.integer())
    field20 = reader.unpack('B')[0]
    sound = reader.name(reader.integer())
    gain = reader.unpack('f')[0]
    name = reader.name(reader.integer())
    field88 = reader.unpack('B')[0]
    if reader.integer() != 0x77834705 or reader.position != len(reader.data):
        raise ValueError(f"Unsupported scene Effect extension: {record['id']}")
    return dict(id=record['id'], name=name, enabled=bool(record['enabled']),
        position=record['position'], matrix=record['matrix'], soundName=sound,
        soundGain=gain, field04=field04, field20=field20, field88=field88)


def export():
    spatial = export_audio_events()['spatial']
    WEB.mkdir(parents=True, exist_ok=True)
    maps = []
    for source in sorted((SOURCE / 'Data/scn').rglob('*.obj')):
        map_id = int(source.stem)
        records = read_scene(source)
        sounds, effects = [], []
        for record in records:
            if record['className'] == 'SYcScnObjSound':
                fields = decode_sound_tail(bytes.fromhex(record['tail']))
                sounds.append(dict(id=record['id'], name=fields['field24'],
                    position=record['position'], enabled=bool(record['enabled']),
                    gain=fields['field5c'], intervalMs=fields['intervalMs'],
                    randomGate=bool(fields['randomGate']), selector=-1, spatial=True,
                    direction=[0, 0, -1], fields=fields))
            elif record['className'] == 'SYcScnObjEffect':
                effects.append(effect_placement(record))
        origin = source.relative_to(SOURCE).as_posix()
        for prefix, document in [
            ('scene-environment-sound', dict(mapId=map_id, source=origin, sounds=sounds, spatial=spatial)),
            ('scene-effects', dict(mapId=map_id, source=origin, effects=effects)),
        ]:
            (WEB / f'{prefix}-{map_id:04}.json').write_text(
                json.dumps(document, ensure_ascii=False, indent=2) + '\n')
        maps.append(dict(mapId=map_id, source=origin, sounds=len(sounds), effects=len(effects)))
    return maps


if __name__ == '__main__':
    maps = export()
    print(f"Published {len(maps)} map ambient catalogs: "
          f"{sum(row['sounds'] for row in maps)} Sound, {sum(row['effects'] for row in maps)} Effect")
