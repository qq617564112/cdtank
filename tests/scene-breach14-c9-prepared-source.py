"""Verify new map14 prepared c9 node/track/material data and named sound branches."""
import json
from pathlib import Path
import struct
import sys
import pefile
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'recovery'))
from cvd import read_cvd

base = ROOT / 'recovery/output/verified/assets/data'
prepared = ROOT / 'recovery/prepared/scene-breach14-assets'
library = json.loads((prepared / 'scene-breach-0014.json').read_text())
placements = next(v for v in json.loads((ROOT / 'recovery/output/web-assets/scene-placements.json').read_text()) if v['id'] == '0014')
pe = pefile.PE(str(ROOT / 'CDTank/CDTank.exe'))
image_base = pe.OPTIONAL_HEADER.ImageBase
instructions = next(v['instructions'] for v in json.loads((ROOT / 'recovery/output/scene-breach18-05424-native.json').read_text())['sources'] if v['start'] == '0x44e081')
def text(address):
    return pe.get_data(address-image_base, 64).split(b'\0')[0].decode('ascii')
rows = []
for model, count, compare, target, sound_pointer, cue in [
    ('obj05425', 47, '0x44e224', '0x44e36a', 0x5c66c8, 'GA32'),
    ('obj05426', 40, '0x44e238', '0x44e36a', 0x5c66c8, 'GA32'),
    ('obj05428', 33, '0x44e1ac', '0x44e37b', 0x5c66c0, 'GA30'),
]:
    resource = next(v for v in library['resources'] if v['reference'] == f'Data/scnobj/{model}/c9.CVD')
    source = read_cvd(base / resource['reference'])
    assert resource['resolution'] == 'published' and len(resource['nodes']) == len(source['nodes'])
    for original, output in zip(source['nodes'], resource['nodes']):
        assert original['parent'] == output['parent']
        if not original['present']:
            assert not output['parts']
            continue
        assert json.loads(json.dumps(original['frames'])) == output['frames']
        assert list(original['times']) == output['times']
        assert output['animation'] == {key: original[key] for key in ('position','rotation','scale','value')}
        for part, published in zip(original['parts'], output['parts']):
            assert part['kind'] == published['kind']
            assert published['indices'] == [v for face in part['faces'] for v in face]
            raw = bytes.fromhex(part['material'])
            values = []
            for offset in range(0, 16, 4):
                b,g,r,a = raw[offset:offset+4]
                values.extend([r/255,g/255,b/255,a/255])
            assert published['properties'] == values + [struct.unpack_from('<f',raw,16)[0]]
            with Image.open(base / f'Data/scnobj/{model}/{Path(part["texture"]).stem}.dds') as dds, Image.open(prepared / published['asset']) as png:
                assert dds.convert('RGBA').tobytes() == png.convert('RGBA').tobytes()
    index = next(i for i,v in enumerate(instructions) if v['address'] == compare)
    pointer = int(instructions[index]['instruction'].split()[-1],16)
    assert text(pointer) == model and instructions[index+4]['instruction'] == f'je {target}'
    branch = next(i for i,v in enumerate(instructions) if v['address'] == target)
    assert instructions[branch+5]['instruction'] == f'push {hex(sound_pointer)}' and text(sound_pointer) == cue
    assert (ROOT / f'recovery/output/web-assets/audio/sound/{cue}.wav').is_file()
    records = [v for v in placements['records'] if v['model'] == model and v['enabled']]
    assert len(records) == count
    rows.append({'model':model,'nodes':len(resource['nodes']),'placements':count,'sound':cue,'compare':compare,'branch':target,'cuePointer':hex(sound_pointer),'sourceExact':True})
result = {'status':'PASS_PREPARED_MAP14_C9_SOURCE_NAMED_CUE','models':rows,'scope':'Isolated new c9 resources and source sound branches; no production permission or ordinary destruction output.'}
(ROOT / 'recovery/output/scene-breach14-c9-prepared-source.json').write_text(json.dumps(result,indent=2)+'\n')
print(result['status'])
