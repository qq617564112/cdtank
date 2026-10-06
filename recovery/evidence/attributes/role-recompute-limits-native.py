"""Execute actual all-field bounds and final conversion blocks with loaded source limits."""
import json
from pathlib import Path
import struct
import sys
from unicorn.x86_const import UC_X86_REG_ESI, UC_X86_REG_EBP, UC_X86_REG_ESP, UC_X86_REG_FPCW, UC_X86_REG_FPSW, UC_X86_REG_FPTAG

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'recovery'))
from effect_native import map_original_binaries
uc, _ = map_original_binaries([ROOT / 'CDTank/CDTank.exe'])
uc.mem_map(0x2000000, 0x20000)
ROLE, RECORD, STACK, FRAME = 0x2001000, 0x2002000, 0x2010000, 0x2010100
limits_evidence = json.loads((ROOT / 'recovery/output/role-data-scale-native.json').read_text())
limits = limits_evidence['rows'][-1]['after']
destinations = {1: (0x61e52c, 0x61e4a0, 'i'), 3: (0x635070, 0x61e4a8, 'f'),
    4: (0x635074, 0x61e4ac, 'f'), 5: (0x635078, 0x61e4b4, 'f'), 6: (0x63507c, 0x61e4bc, 'f'),
    7: (0x635080, 0x61e4c0, 'i'), 8: (0x61e530, 0x61e4cc, 'f'), 9: (0x635084, 0x61e4c4, 'i'),
    10: (0x635088, 0x61e4d0, 'f'), 11: (0x63508c, 0x61e4e4, 'i'), 12: (0x635090, 0x61e4d8, 'f'),
    13: (0x635094, 0x61e4e0, 'f'), 14: (0x61e534, 0x61e4f0, 'i'), 15: (0x61e538, 0x61e4f4, 'i'),
    16: (0x61e53c, 0x61e4fc, 'f'), 17: (0x61e540, 0x61e504, 'i'),
    20: (0x635098, 0x61e510, 'i'), 22: (0x63509c, 0x61e514, 'f')}
for identifier, (lower, upper, kind) in destinations.items():
    value = limits[str(identifier)]
    for address, key in [(lower, 'lower'), (upper, 'upper')]:
        uc.mem_write(address, struct.pack('<' + kind, value[key]))
source = json.loads((ROOT / 'recovery/output/role-recompute-base-native.json').read_text())
inputs = [row['values'] for row in source['combinations'] + source['itemRows']]
# Force each reachable bound below/equal/above in addition to real source combinations.
for value in [-100, 0, 1, 99, 999, 10000]:
    template = source['combinations'][0]['values']
    inputs.append({key: {offset: value for offset in fields} for key, fields in template.items() if key != 'accumulators'}
                  | {'accumulators': [value] * 6})


def write_state(state):
    for key, address, kind in [('recordFields', RECORD, 'i'), ('roleIntegers', ROLE, 'i'), ('roleFloats', ROLE, 'f')]:
        for offset, value in state[key].items():
            uc.mem_write(address + int(offset), struct.pack('<' + kind, value))
    for offset, value in zip([-0x10, 8, -8, -0xc, -4, 0x18], state['accumulators']):
        uc.mem_write(FRAME + offset, struct.pack('<i', value))


def read_state(template):
    result = {}
    for key, address, kind in [('recordFields', RECORD, 'i'), ('roleIntegers', ROLE, 'i'), ('roleFloats', ROLE, 'f')]:
        result[key] = {offset: struct.unpack('<' + kind, uc.mem_read(address + int(offset), 4))[0]
                       for offset in template[key]}
    result['accumulators'] = [struct.unpack('<i', uc.mem_read(FRAME + o, 4))[0] for o in [-0x10, 8, -8, -0xc, -4, 0x18]]
    return result


rows = []
for index, state in enumerate(inputs):
    write_state(state)
    uc.mem_write(ROLE + 0x2a0, struct.pack('<I', RECORD))
    uc.mem_write(RECORD + 0x54, struct.pack('<i', 777))
    for register, value in [(UC_X86_REG_ESI, ROLE), (UC_X86_REG_EBP, FRAME), (UC_X86_REG_ESP, STACK),
                            (UC_X86_REG_FPCW, 0x27f), (UC_X86_REG_FPSW, 0), (UC_X86_REG_FPTAG, 0xffff)]:
        uc.reg_write(register, value)
    uc.emu_start(0x4337d7, 0x433ad6, count=3000)
    bounded = read_state(state)
    # First movement accumulator is in EAX until movement calculation, rather than its stack local.
    from unicorn.x86_const import UC_X86_REG_EAX
    raw = uc.reg_read(UC_X86_REG_EAX)
    bounded['accumulators'][0] = raw if raw < 0x80000000 else raw - 0x100000000
    vip, multiplier = index % 3, index % 4
    uc.mem_write(RECORD + 0x50, bytes([vip]))
    uc.mem_write(ROLE + 0x98, struct.pack('<i', multiplier))
    uc.emu_start(0x433c55, 0x433cf4, count=1000)
    converted = read_state(state)
    converted['accumulators'][0] = bounded['accumulators'][0]
    assert struct.unpack('<i', uc.mem_read(RECORD + 0x54, 4))[0] == 777
    rows.append(dict(input=state, bounded=bounded, converted=converted, vip=vip, vipMultiplier=multiplier))
(ROOT / 'recovery/output/role-recompute-limits-native.json').write_text(json.dumps(dict(
    status='PASS', limits=limits, rows=rows,
    scope='Complete4337d7–433ad6 bounds and433c55–433cf4 conversion/VIP blocks; loaded limits from actual43928a evidence. '
          'Movement/mastery calculation433ad6–433c55 and notification tail not part of this fixture.'), indent=2) + '\n')
print(f'PASS: {len(rows)} all-field loaded bounds and percentage/reload/VIP conversions')
