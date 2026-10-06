"""Record original page-activation music calls and their direct source IDs."""
import json
from pathlib import Path
import sys

import capstone
import pefile

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'recovery'))
from inspect_assets import read_table

pe = pefile.PE(str(ROOT / 'CDTank/CDTank.exe'))
base = pe.OPTIONAL_HEADER.ImageBase
decoder = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)
names = {int(row['values']['ID']): row['values']['String']
         for row in read_table(ROOT / 'CDTank/Data/table/musicstring.dat')['rows']}
rows = []
for entry, call, music_id, vtable in [
    (0x4c51f1, 0x4c5293, 183, 0x5cfa70),
    (0x5095a1, 0x5095f3, 183, 0x5d4ae8),
    (0x50ea9c, 0x50eae6, 184, 0x5d6640),
]:
    instructions = list(decoder.disasm(pe.get_data(entry - base, call + 7 - entry), entry))
    call_index = next(index for index, i in enumerate(instructions) if i.address == call)
    assert instructions[call_index].mnemonic == 'call'
    assert instructions[call_index].op_str == '0x4d9517'
    assert [(i.mnemonic, i.op_str) for i in instructions[call_index - 2:call_index]] == [
        ('push', '-1'), ('push', hex(music_id))]
    assert int.from_bytes(pe.get_data(vtable + 0x18 - base, 4), 'little') == entry
    rows.append({'activationEntry': hex(entry), 'activationVtableSlot': hex(vtable + 0x18),
                 'call': hex(call), 'musicId': music_id, 'name': names[music_id],
                 'loopCount': -1,
                 'instructions': [{'va': hex(i.address), 'bytes': i.bytes.hex(),
                                   'instruction': f'{i.mnemonic} {i.op_str}'} for i in instructions]})
out = {'status': 'PASS_STATIC_PAGE_MUSIC_CALLS_ONLY', 'rows': rows,
       'reuse': 'audio-runtime.md / original4d9517 shared music selection and published MP3',
       'missing': ['exact page factory/layout identity', 'ordinary Web lifecycle integration'],
       'scope': 'Direct original activation branches select UIM01/UIM02 with loopCount-1; no native execution or page identity claimed.'}
(ROOT / 'recovery/output/page-music-source.json').write_text(
    json.dumps(out, indent=2) + '\n')
print('PASS_STATIC_PAGE_MUSIC_CALLS_ONLY: activation IDs183/184 →UIM01/02 loop-1')
