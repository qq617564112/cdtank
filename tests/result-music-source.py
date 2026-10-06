"""Original game_summary result-message music branch and controller identity."""
import json
import sys
from pathlib import Path
import capstone
import pefile
from unicorn import Uc, UC_ARCH_X86, UC_MODE_32, UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_ESI, UC_X86_REG_ESP

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'recovery'))
from inspect_assets import read_table

pe = pefile.PE(str(ROOT / 'CDTank/CDTank.exe'))
base = pe.OPTIONAL_HEADER.ImageBase
decoder = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)
def instructions(start, end):
    return [{'va': hex(i.address), 'bytes': i.bytes.hex(),
             'instruction': f'{i.mnemonic} {i.op_str}'}
            for i in decoder.disasm(pe.get_data(start - base, end - start), start)]
def u32(address):
    return int.from_bytes(pe.get_data(address - base, 4), 'little')

assert u32(0x5cde80 + 0x38) == 0x4a8760
# Derive the initializer's exact layout operand from its original push.
initial = list(decoder.disasm(pe.get_data(0x4a8760 - base, 0x100), 0x4a8760))
push = next(i for i in initial if i.address == 0x4a87ac)
assert push.mnemonic == 'push'
layout_address = int(push.op_str, 16)
layout = pe.get_data(layout_address - base, 100).split(b'\0')[0].decode('ascii')
assert layout == 'data\\ui\\layouts\\game_summary.xml'
branch = instructions(0x4ac867, 0x4ac88a)
assert next(i for i in branch if i['va'] == '0x4ac883')['instruction'] == 'call 0x4d9517'
register = instructions(0x51c95f, 0x51c991)
assert any(i['instruction'] == 'push 0x4ac736' for i in register)
assert any(i['instruction'] == 'add eax, 0x2500' for i in register)

names = {int(r['values']['ID']): r['values']['String']
         for r in read_table(ROOT / 'CDTank/Data/table/musicstring.dat')['rows']}
rows = []
for flag in [0, 1, 2, 3, -1]:
    uc = Uc(UC_ARCH_X86, UC_MODE_32)
    uc.mem_map(0x4ac000, 0x2000)
    uc.mem_write(0x4ac867, pe.get_data(0x4ac867 - base, 0x23))
    uc.mem_map(0x700000, 0x2000)
    uc.mem_map(0x800000, 0x2000)
    uc.reg_write(UC_X86_REG_ESI, 0x700000)
    uc.reg_write(UC_X86_REG_ESP, 0x801000)
    uc.mem_write(0x7000d4, (flag & 0xffffffff).to_bytes(4, 'little'))
    calls = []
    def observe(machine, address, size, data):
        if address == 0x4ac883:
            stack = machine.reg_read(UC_X86_REG_ESP)
            values = bytes(machine.mem_read(stack, 8))
            music_id = int.from_bytes(values[:4], 'little')
            calls.append({'musicId': music_id, 'name': names[music_id],
                          'loopCount': int.from_bytes(values[4:], 'little', signed=True)})
            machine.emu_stop()
    uc.hook_add(UC_HOOK_CODE, observe)
    uc.emu_start(0x4ac867, 0x4ac88a)
    expected = [{'musicId': 190 if flag == 1 else 191,
                 'name': names[190 if flag == 1 else 191], 'loopCount': 1}] if flag in [1, 2] else []
    assert calls == expected
    rows.append({'messageFieldD4': flag, 'calls': calls})

out = {'status': 'PASS_ORIGINAL_RESULT_MUSIC_BRANCH_ONLY',
       'controllerVtable': '0x5cde80', 'initializer': '0x4a8760',
       'layoutPush': '0x4a87ac', 'layoutAddress': hex(layout_address), 'layout': layout,
       'callback': '0x4ac736', 'controllerOffset': '0x2500',
       'registration': register, 'branch': branch, 'rows': rows,
       'scope': 'Actual original branch instructions, five supplied result-field values. Music service is recorded at the direct call boundary; complete result receiver and audio playback are not executed.',
       'missing': ['Semantic producer mapping of result message+d4 values 1/2 to formal per-player outcome',
                   'Formal consumer and ordinary natural-finish playback']}
(ROOT / 'recovery/output/result-music-source.json').write_text(json.dumps(out, indent=2) + '\n')
print('PASS_ORIGINAL_RESULT_MUSIC_BRANCH_ONLY: field1 UIM08/190 once, field2 UIM09/191 once, other fields silent')
