"""Capture the three death-countdown UI bindings; no scheduler execution."""
import json
from pathlib import Path
import xml.etree.ElementTree as ET
import pefile
from capstone import Cs, CS_ARCH_X86, CS_MODE_32
ROOT = Path(__file__).resolve().parents[3]
pe = pefile.PE(str(ROOT / 'CDTank/CDTank.exe'))
decoder = Cs(CS_ARCH_X86, CS_MODE_32)
ranges = [(0x4d457d, 0x4d4607), (0x49162a, 0x491660),
          (0x4363bb, 0x4363db), (0x4cc99e, 0x4cca4e),
          (0x4cca4e, 0x4ccac7), (0x4c7aa9, 0x4c7ae3)]
sources = [dict(start=hex(a), end=hex(b), instructions=[
    dict(address=hex(i.address), bytes=i.bytes.hex(), instruction=f'{i.mnemonic} {i.op_str}')
    for i in decoder.disasm(pe.get_data(a - 0x400000, b - a), a)]) for a, b in ranges]
layout_path = ROOT / 'recovery/output/verified/assets/data/Data/ui/layouts/game_main.xml'
window = next(w for w in ET.parse(layout_path).iter('Window') if w.attrib['Name'] == 'txtCountdown')
properties = {p.attrib['Name']: p.attrib['Value'] for p in window.findall('Property')}
imports = {hex(i.address): i.name.decode() for entry in pe.DIRECTORY_ENTRY_IMPORT
           for i in entry.imports if i.name and i.address in (0x5c0240, 0x5c0260)}
font = next(f for f in json.loads((ROOT / 'recovery/output/web-assets/ui-fonts.json').read_text())['fonts']
            if f['name'] == 'Countdown')
result = dict(status='SOURCE_CAPTURED', scope='Static original registrations/setters/UI targets only; existing72 death bridge cases not rerun; no scheduler/server authorization or browser claim',
              bindings=[dict(offset='0x60', registration='0x4d457d', setter='0x49162a', target='0x4cc99e', behavior='n>0 setText %d then show; n<=0 no UI call'),
                        dict(offset='0x68', registration='0x4d45a9', setter='0x4363bb', target='0x4cca3f', behavior='hide countdown'),
                        dict(offset='0x64', registration='0x4d45db', setter='0x491646', target='0x4cca4e', behavior='hide countdown and update other battle start UI')],
              control=dict(pointer='UI owner+0x728', lookup='0x4c7aa9', name=pe.get_data(0x5d0e08-0x400000,40).split(b'\0')[0].decode(),
                           format=pe.get_data(0x5c83d4-0x400000,8).split(b'\0')[0].decode(), layout=str(layout_path.relative_to(ROOT)), properties=properties),
              imports=imports, font=font, sources=sources)
(ROOT / 'recovery/output/death-countdown-observers-source.json').write_text(json.dumps(result, indent=2)+'\n')
print('SOURCE_CAPTURED: owner60 positive integer countdown; owner68/64 hide GameMain/txtCountdown')
