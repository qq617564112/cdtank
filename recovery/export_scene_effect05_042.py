"""Publish original0005 Effect042 map placements."""
import json
from pathlib import Path
from scene import read_scene
from mv3 import Reader

ROOT = Path(__file__).resolve().parents[1]


def export():
    source = ROOT/'recovery/output/verified/assets/data/Data/scn/0005/0005.obj'
    effects = []
    for record in read_scene(source):
        if record['className'] != 'SYcScnObjEffect':
            continue
        reader = Reader(bytes.fromhex(record['tail']))
        assert reader.integer() == 0x778346a2
        field04 = reader.name(reader.integer())
        field20 = reader.unpack('B')[0]
        sound = reader.name(reader.integer())
        gain = reader.unpack('f')[0]
        name = reader.name(reader.integer())
        field88 = reader.unpack('B')[0]
        assert reader.integer() == 0x77834705 and reader.position == len(reader.data)
        assert name == '_root\\online\\042' and not any([field04,field20,sound,field88])
        effects.append(dict(id=record['id'], name=name, enabled=bool(record['enabled']), position=record['position'], matrix=record['matrix'], soundName=sound, soundGain=gain))
    assert [row['id'] for row in effects] == ['213','214','215','216']
    result = dict(mapId=5, effects=effects)
    output = ROOT/'recovery/output/web-assets/scene-effects-0005.json'
    output.write_text(json.dumps(result,indent=2)+'\n')
    return result


if __name__ == '__main__':
    result = export()
    print(f"Published {len(result['effects'])} original0005 Effect042 placements")
