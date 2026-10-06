"""Publish the original map 0018 General66–69 CVD geometry and animation tracks."""
import json
from pathlib import Path
import struct
import re
from cvd import read_cvd
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / 'recovery/output/web-assets'
SOURCE = ROOT / 'recovery/output/verified/assets/data'
REFERENCE = 'Data/scnobj/obj05018/obj05018.CVD'


def export():
    model = read_cvd(SOURCE / REFERENCE)
    texture = WEB / 'Data/scnobj/obj05018/obj05018.png'
    texture.parent.mkdir(parents=True, exist_ok=True)
    with Image.open(SOURCE / 'Data/scnobj/obj05018/obj05018.dds') as image:
        image.convert('RGBA').save(texture)
    nodes = []
    for node in model['nodes']:
        if not node['present']:
            nodes.append(dict(fvf=19, parent=node['parent'], parts=[]))
            continue
        parts = []
        for part in node['parts']:
            raw = bytes.fromhex(part['material'])
            properties = []
            for offset in range(0, 16, 4):
                b, g, r, a = raw[offset:offset+4]
                properties.extend([r/255, g/255, b/255, a/255])
            properties.append(struct.unpack_from('<f', raw, 16)[0])
            assert part['texture'].lower() == 'obj05018.tga'
            parts.append(dict(kind=part['kind'], properties=properties,
                asset='Data/scnobj/obj05018/obj05018.png',
                indices=[i for face in part['faces'] for i in face]))
        duration = max([*node['times'], *[node[key]['keys'][-1][0]-node[key]['keys'][0][0]
            for key in ['position', 'rotation', 'scale']]])
        nodes.append(dict(fvf=19, parent=node['parent'],
            animation={key:node[key] for key in ['position', 'rotation', 'scale', 'value']},
            duration=duration, frames=node['frames'], times=node['times'], parts=parts))
    scripts = []
    for name in ['default', 'newgeom', 'geom_t', 'geom_c1', 'geom_t_c1']:
        text = re.sub(r'//[^\n]*', '', (SOURCE / f'Data/gfxscript/{name}.gbf').read_text()).split('technique', 1)[1]
        states = [dict(name=match[1], value=re.sub(r'\s+', '', match[2]).upper())
            for match in re.finditer(r'(\w+(?:\[\d+\])?)\s*=\s*([\w|]+)\s*;', text)]
        scripts.append(dict(name=name, states=states))
    result = dict(resources=[dict(reference=REFERENCE, resolution='published', nodes=nodes)],
        scripts=scripts, graphics=dict(ambient=[.2,.2,.2,1], emissive=0))
    (WEB / 'scene-animation-0018.json').write_text(json.dumps(result, ensure_ascii=False)+'\n')
    print('Published map 0018 General66–69:', sum(bool(n['parts']) for n in nodes), 'geometry nodes')


if __name__ == '__main__':
    export()
