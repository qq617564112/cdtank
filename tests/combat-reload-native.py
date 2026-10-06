"""Execute original role duration bounds and final x87 conversion blocks."""
import json
from pathlib import Path
import struct
import sys
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_ESI, UC_X86_REG_ESP, UC_X86_REG_FPCW, UC_X86_REG_FPSW, UC_X86_REG_FPTAG, UC_X86_REG_EAX, UC_X86_REG_EBX, UC_X86_REG_EDI, UC_X86_REG_EBP, UC_X86_REG_EIP

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'recovery'))
from effect_native import map_original_binaries
from inspect_assets import read_table

machine, _ = map_original_binaries([ROOT / 'CDTank/CDTank.exe'])
machine.mem_map(0x2000000, 0x20000)
ROLE, STACK = 0x2001000, 0x2010000
rows = []
for base in [-4, 0, 5.99, 6, 6.25, 12, 29.99, 30, 40]:
    for factor in [-3, 0, 1, 10, 33, 100, 123.456]:
        machine.mem_write(ROLE, bytes(0x400))
        machine.mem_write(ROLE + 0x50, struct.pack('<2f', base, factor))
        for register, value in [(UC_X86_REG_ESI, ROLE), (UC_X86_REG_ESP, STACK),
                                (UC_X86_REG_FPCW, 0x27f), (UC_X86_REG_FPSW, 0),
                                (UC_X86_REG_FPTAG, 0xffff)]:
            machine.reg_write(register, value)
        # Upper/lower bounds and final conversion are disjoint original blocks.
        machine.emu_start(0x4338e7, 0x4338fe, count=100)
        machine.emu_start(0x433a4b, 0x433a62, count=100)
        machine.emu_start(0x433cc9, 0x433ce1, count=100)
        normal, special = struct.unpack('<2f', machine.mem_read(ROLE + 0x50, 8))
        input_base, input_factor = struct.unpack('<2f', struct.pack('<2f', base, factor))
        rows.append(dict(baseDuration=input_base, type1Factor=input_factor,
                         normalSeconds=normal, type1Seconds=special))
readiness = []
RECORD, RETURN = 0x2005000, 0x2011000
machine.mem_write(ROLE + 0x2a0, struct.pack('<I', RECORD))
for permitted in [False, True]:
    machine.mem_write(RECORD + 0x11c + 11, bytes([int(permitted)]))
    for deadline in [0, .6, 3, 1000]:
        for current in [deadline - .001, deadline, deadline + .001]:
            machine.mem_write(ROLE + 0x9c, struct.pack('<f', deadline))
            machine.mem_write(STACK, struct.pack('<II f', RETURN, ROLE, current))
            for register, value in [(UC_X86_REG_ESP, STACK), (UC_X86_REG_FPCW, 0x27f),
                                    (UC_X86_REG_FPSW, 0), (UC_X86_REG_FPTAG, 0xffff)]:
                machine.reg_write(register, value)
            machine.emu_start(0x435499, RETURN, count=100)
            readiness.append(dict(permitted=permitted, currentSeconds=current,
                                  nextAvailableSeconds=deadline,
                                  ready=bool(machine.reg_read(UC_X86_REG_EAX) & 255)))
skills = read_table(ROOT / 'CDTank/Data/table/skill.dat')
assert skills['columns'][34] == 'Delay' and skills['columns'][36] == 'LoadTime'
SOURCE, VALUE = 0x2006000, 0x2007000
current_values = None
columns = []


def provide_column(uc, address, size, data):
    stack = uc.reg_read(UC_X86_REG_ESP)
    return_address, column, mode = struct.unpack('<3I', uc.mem_read(stack, 12))
    assert mode == 0 and 19 <= column <= 61
    columns.append(column)
    value = int(current_values[skills['columns'][column]])
    uc.mem_write(VALUE, struct.pack('<i', value))
    uc.reg_write(UC_X86_REG_EAX, VALUE)
    uc.reg_write(UC_X86_REG_ESP, stack + 12)
    uc.reg_write(UC_X86_REG_EIP, return_address)


hook = machine.hook_add(UC_HOOK_CODE, provide_column, begin=0x4391c4, end=0x4391c4)
additions = []
multiplier_rows = []
VTABLE = 0x2008000
machine.mem_write(VTABLE + 0x14, struct.pack('<I', 0x432417))
machine.mem_write(ROLE, struct.pack('<I', VTABLE))
for skill in skills['rows']:
    current_values = skill['values']
    columns.clear()
    machine.mem_write(SOURCE, bytes(0x300))
    for register, value in [(UC_X86_REG_ESI, SOURCE), (UC_X86_REG_ESP, STACK),
                            (UC_X86_REG_EBX, 0), (UC_X86_REG_EDI, 19), (UC_X86_REG_EBP, STACK + 0x100)]:
        machine.reg_write(register, value)
    # Original sequential loader, with parsed table values supplied at its getter.
    machine.emu_start(0x43acf2, 0x43af5c, count=1000)
    assert columns == list(range(19, 62))
    delay, load_time = (struct.unpack('<i', machine.mem_read(SOURCE + offset, 4))[0]
                        for offset in [0x124, 0x12c])
    assert delay == int(current_values['Delay']) and load_time == int(current_values['LoadTime'])
    threshold = struct.unpack('<i', machine.mem_read(SOURCE + 0x188, 4))[0]
    assert threshold == int(current_values['FuncZ1'])
    trigger = int(current_values['TriggerType'])
    machine.mem_write(SOURCE + 0x2c, struct.pack('<i', trigger))
    for role_value in [1, 10, 50]:
        machine.mem_write(ROLE + 0x24, struct.pack('<i', role_value))
        machine.mem_write(STACK, struct.pack('<3I', RETURN, SOURCE, ROLE))
        machine.reg_write(UC_X86_REG_ESP, STACK)
        # Full prefix calls the actual role getter9 through its original vtable entry.
        machine.emu_start(0x432951, 0x432987, count=200)
        multiplier = machine.reg_read(UC_X86_REG_EAX)
        multiplier_rows.append(dict(triggerType=trigger, roleValue9=role_value, funcZ1=threshold,
                                    multiplier=multiplier))
        base, factor = -4.25, 3.125
        machine.mem_write(ROLE + 0x50, struct.pack('<2f', base, factor))
        for register, value in [(UC_X86_REG_ESI, ROLE), (UC_X86_REG_EDI, SOURCE),
                                (UC_X86_REG_EAX, multiplier), (UC_X86_REG_ESP, STACK),
                                (UC_X86_REG_EBP, STACK + 0x100), (UC_X86_REG_FPCW, 0x27f),
                                (UC_X86_REG_FPSW, 0), (UC_X86_REG_FPTAG, 0xffff)]:
            machine.reg_write(register, value)
        machine.emu_start(0x4329fd, 0x432a2d, count=100)
        result_base, result_factor = struct.unpack('<2f', machine.mem_read(ROLE + 0x50, 8))
        additions.append(dict(skillId=int(current_values['SkillTableID']), baseDuration=base,
                              type1Factor=factor, delay=delay, loadTime=load_time, multiplier=multiplier,
                              result=dict(baseDuration=result_base, type1Factor=result_factor)))
machine.hook_del(hook)
(ROOT / 'recovery/output/combat-reload-native.json').write_text(json.dumps({
    'scope': 'Original client role bounds/conversion blocks at explicit x87 53-bit precision; upstream equipment/skills and D3D precision state unresolved.',
    'limits': {key: struct.unpack('<f', machine.mem_read(address, 4))[0] for key, address in [('lower', 0x61e53c), ('upper', 0x61e4fc)]},
    'rows': rows, 'readiness': readiness, 'additions': additions, 'multipliers': multiplier_rows,
    'skillLoaderScope': '342 original sequential field-loader blocks with supplied parsed source values; 1026 multiplier prefixes with actual getter9 and accumulation blocks. Complete equipment traversal not included.'}) + '\n')
print(f'PASS: {len(rows)} original durations, {len(readiness)} full fire-readiness calls, {len(skills["rows"])} skill loaders and {len(additions)} additions')
