"""Publish map0014's original Sound224/225/226 BG06/BG11/BG12 placement and audio parameters."""
import json
from pathlib import Path
from scene import read_scene
from scene_sound import decode_sound_tail
from export_audio_events import export as export_audio_events

ROOT = Path(__file__).resolve().parents[1]


def export():
    source = ROOT / 'recovery/output/verified/assets/data/Data/scn/0014/0014.obj'
    sounds = []
    for record in read_scene(source):
        if record['className'] != 'SYcScnObjSound':
            continue
        fields = decode_sound_tail(bytes.fromhex(record['tail']))
        sounds.append(dict(id=record['id'], name=fields['field24'],
            position=record['position'], enabled=bool(record['enabled']),
            gain=fields['field5c'], intervalMs=fields['intervalMs'],
            randomGate=bool(fields['randomGate']), selector=-1, spatial=True,
            direction=[0, 0, -1]))
    evidence = export_audio_events()
    output = ROOT / 'recovery/output/web-assets/scene-environment-sound-0014.json'
    output.write_text(json.dumps(dict(mapId=14, sounds=sounds,
        spatial=evidence['spatial']), ensure_ascii=False, indent=2) + '\n')
    return sounds


if __name__ == '__main__':
    print(f'Published {len(export())} map0014 environment sounds')
