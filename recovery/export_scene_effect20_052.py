"""Publish original0020 Effect052 map placements."""
import json
from pathlib import Path
from scene import read_scene
from mv3 import Reader

ROOT = Path(__file__).resolve().parents[1]


def export():
    source = ROOT/'recovery/output/verified/assets/data/Data/scn/0020/0020.obj'
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
        assert name == '_root\\online\\052' and not any([field04,field20,sound,gain,field88])
        effects.append(dict(id=record['id'], name=name, enabled=bool(record['enabled']), position=record['position'], matrix=record['matrix']))
    assert [row['id'] for row in effects] == ['269','270','271','272','273']
    result = dict(mapId=20, effects=effects)
    output = ROOT/'recovery/output/web-assets/scene-effects-0020.json'
    output.write_text(json.dumps(result,indent=2)+'\n')
    return result


if __name__ == '__main__':
    result = export()
    print(f"Published {len(result['effects'])} original0020 Effect052 placements")
