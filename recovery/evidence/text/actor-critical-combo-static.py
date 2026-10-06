"""Extract the named Critical/Combo caller and attached-image contracts."""
import json
import struct
from pathlib import Path
import pefile
from capstone import Cs, CS_ARCH_X86, CS_MODE_32

ROOT = Path(__file__).resolve().parents[3]
pe = pefile.PE(str(ROOT / 'CDTank/CDTank.exe'))
base = pe.OPTIONAL_HEADER.ImageBase
cs = Cs(CS_ARCH_X86, CS_MODE_32)

def string(address):
    return pe.get_data(address - base, 96).split(b'\0')[0].decode('ascii')

def instructions(start, end):
    return {'start': hex(start), 'end': hex(end), 'instructions': [
        {'address': hex(i.address), 'bytes': i.bytes.hex(),
         'instruction': (i.mnemonic + ' ' + i.op_str).strip()}
        for i in cs.disasm(pe.get_data(start - base, end - start), start)]}

sets = json.loads((ROOT / 'recovery/output/catalog/imagesets.json').read_text())
images = []
for pointer in (0x5c82c0, 0x5c828c):
    name = string(pointer)
    for index, item in enumerate(sets):
        if item['attributes'].get('Name') != string(0x5c8264):
            continue
        for image_index, image in enumerate(item['images']):
            if image['Name'] == name:
                asset = f'ui/regions/{index}/{image_index}.png'
                images.append({'pointer': hex(pointer), 'imageset': item['path'],
                               'image': image, 'asset': asset,
                               'published': (ROOT / 'recovery/output/web-assets' / asset).is_file()})

result = {
    'status': 'STATIC_CALLER_AND_ATTACHED_IMAGE_CONTRACT_PRODUCER_GAP',
    'critical': {'caller': '0x424749', 'classification': 'message byte+0x14 !=0',
                 'value': 'message signed+0x20 negated by0x4228f1',
                 'selector': 2, 'font': 'Critical', 'imagePointer': 'record+0x38'},
    'combo': {'messageHandler': '0x4364c4', 'dispatcher': '0x429443',
              'arguments': ['message+0x10', 'message+0x0c', 'message+0x14'],
              'qualification': 'Both role lookups exist, third argument>1, local role state!=3',
              'target': 'Second role lookup', 'value': 'Third argument unchanged via0x422910',
              'selector': 3, 'font': 'Combo', 'imagePointer': 'record+0x38',
              'offsetConstants': {hex(p): struct.unpack('<f', pe.get_data(p-base, 4))[0]
                                  for p in (0x5cd00c, 0x5c8270, 0x5c8274)}},
    'images': images,
    'source': [instructions(a, z) for a, z in (
        (0x424749, 0x4247a8), (0x4228f1, 0x42292f),
        (0x4364c4, 0x436518), (0x429443, 0x4294a6),
        (0x465edc, 0x466065), (0x465270, 0x465458))],
    'gaps': ['Formal hit has no original Critical classification or source-qualified producer',
             'Formal destroy kills cannot substitute for original Combo third message argument',
             'Original image/font combined rendering is absent from the current digit-only renderer'],
    'scope': 'Named static original caller, constructor, draw instructions and image catalog extraction only. '
             'No emulated caller execution, production consumer, formal protocol, gameplay or GPU claim.'}
output = ROOT / 'recovery/output/actor-critical-combo-static.json'
output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
print(result['status'])
