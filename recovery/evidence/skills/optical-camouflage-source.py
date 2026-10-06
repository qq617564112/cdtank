"""Recover skill9 metadata and execute the original candidate team predicate."""
import json
from pathlib import Path
import struct
import sys
import capstone
from unicorn.x86_const import UC_X86_REG_EAX, UC_X86_REG_ECX, UC_X86_REG_EIP, UC_X86_REG_ESP

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'recovery'))
from effect_native import map_original_binaries
from inspect_assets import read_table

machine, images = map_original_binaries([ROOT / 'CDTank/CDTank.exe'])
machine.mem_map(0x2000000, 0x20000)
CONTROLLER, TARGET, SOURCE = 0x2001000, 0x2002000, 0x2003000
TARGET_RECORD, SOURCE_RECORD, VTABLE = 0x2004000, 0x2005000, 0x2006000
STACK, RETURN = 0x2010000, 0x2011000
write = lambda addr, value: machine.mem_write(addr, struct.pack('<I', value & 0xffffffff))
write(CONTROLLER + 0x10, 0x43538e)
write(CONTROLLER + 0x14, 0)
write(TARGET, VTABLE)
write(SOURCE, VTABLE)
write(TARGET + 0x2a0, TARGET_RECORD)
write(SOURCE + 0x2a0, SOURCE_RECORD)
write(VTABLE + 0x14, 0x422b64)
rows = []
for status in [0, 1, 2, 3]:
    for target_team, source_team in [(0, 0), (0, 1), (1, 1), (1, 0)]:
        for flag_fill in [0, 1, 255]:
            write(TARGET_RECORD + 0x90, status)
            write(TARGET_RECORD + 0x5c, target_team)
            write(SOURCE_RECORD + 0x5c, source_team)
            machine.mem_write(TARGET_RECORD + 0x11c, bytes([flag_fill] * 16))
            machine.mem_write(SOURCE_RECORD + 0x11c, bytes([flag_fill] * 16))
            machine.mem_write(STACK, struct.pack('<3I', RETURN, TARGET, SOURCE))
            machine.reg_write(UC_X86_REG_ESP, STACK)
            machine.reg_write(UC_X86_REG_ECX, CONTROLLER)
            machine.emu_start(0x43535e, RETURN, count=200)
            assert machine.reg_read(UC_X86_REG_EIP) == RETURN
            assert machine.reg_read(UC_X86_REG_ESP) == STACK + 12
            accepted = bool(machine.reg_read(UC_X86_REG_EAX) & 255)
            assert accepted == (status == 2 and target_team != source_team)
            rows.append(dict(status=status, targetTeam=target_team, sourceTeam=source_team,
                             flagFill=flag_fill, accepted=accepted))
metadata = {}
for name, key in [('item', 'ItemTableID'), ('skill', 'SkillTableID')]:
    metadata[name] = next(row['values'] for row in read_table(ROOT / f'CDTank/Data/table/{name}.dat')['rows']
                          if int(row['values'][key]) == 9)
assert [int(metadata['item'][f'ItemSkill{i}']) for i in range(1, 4)] == [9, 0, 0]
assert int(metadata['item']['BattleUseMax']) == 2
assert int(metadata['skill']['FuncType1']) == 7 and int(metadata['skill']['FuncT1']) == 10
assert all(int(metadata[name][f'{field}{i}']) == 0
           for name in ['item', 'skill'] for field in ['Effect', 'Sound'] for i in range(1, 4))
pe = images['cdtank.exe']
image = pe.get_memory_mapped_image()
md = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)
ranges = [(0x43535e, 0x4353b2), (0x431d92, 0x431e22), (0x42f624, 0x42f769),
          (0x427d95, 0x427e31), (0x436078, 0x436192)]
disassembly = {hex(start): [f'{i.address:08x} {i.mnemonic} {i.op_str}' for i in
                          md.disasm(image[start - 0x400000:end - 0x400000], start)]
               for start, end in ranges}
result = dict(status='PASS', metadata=metadata, targetPredicateRows=rows,
              execution='Original43535e and43538e including original status/team getters; supplied object layouts and configured callback.',
              unproven=['Controller callback configuration producer', 'FuncType7 to actor visibility state',
                        'Actor draw visibility consumer and own/team/enemy distinctions',
                        'Any hidden-specific target filtering outside this predicate'],
              disassembly=disassembly)
out = ROOT / 'recovery/output/optical-camouflage-source.json'
out.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
print(f'PASS: skill9 metadata; {len(rows)} original candidate predicate cases; visibility source remains unproven')
