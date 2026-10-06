"""Complete original433466 movement with identical owned inputs across VIP tail values."""
import contextlib
import io
import json
from pathlib import Path
import runpy
import struct
from unittest.mock import patch
from unicorn.x86_const import UC_X86_REG_ECX, UC_X86_REG_EIP, UC_X86_REG_ESP, UC_X86_REG_FPCW, UC_X86_REG_FPSW, UC_X86_REG_FPTAG

ROOT = Path(__file__).resolve().parents[3]
# Reuse the full source-execution fixture without rewriting its evidence artifacts.
with patch.object(Path, 'write_text', lambda self, text, **kwargs: len(text)), contextlib.redirect_stdout(io.StringIO()):
    g = runpy.run_path(str(ROOT / 'recovery/evidence/attributes/role-recompute-native.py'))
uc, write, read = g['uc'], g['write'], g['read']
ROLE, BASE, EQUIPMENT, TANK, PET, RECORD, STACK, RETURN, VTABLE = [g[key] for key in
    ['ROLE', 'BASE', 'EQUIPMENT', 'TANK', 'PET', 'RECORD', 'STACK', 'RETURN', 'VTABLE']]
rows = []
parts = [0, 13001, 14001, 15001, 16001, 17001]
for index, tank_row in enumerate(g['tank_rows']):
    tank = tank_row['result']
    pet = g['pet_rows'][index % len(g['pet_rows'])]['result']
    base = dict(g['g']['base_rows'][0]['result'])
    equipment = dict(g['g']['equipment_rows'][0]['result'])
    base.update({'0': 73, '8': pet['id'], '44': 200, '52': 5, '60': 10})
    equipment.update({'28': 74, '36': tank['id'], '52': 1, '88': 0, '92': 0, '96': 0})
    for record, fields in [(BASE, base), (EQUIPMENT, equipment)]:
        for offset, value in fields.items():
            write(record + int(offset), value)
    for key, offset in [('field84', 0x84), ('field88', 0x88), ('field90', 0x90), ('fieldA4', 0xa4), ('fieldA8', 0xa8)]:
        write(TANK + offset, tank[key])
    uc.mem_write(TANK + 0x8c, struct.pack('<f', tank['reloadDuration']))
    write(TANK + 0x50, tank['tankType'])
    for key, offset in [('field7c', 0x7c), ('field80', 0x80), ('field84', 0x84), ('field88', 0x88)]:
        write(PET + offset, pet[key])
    for part in parts:
        write(ROLE, VTABLE)
        write(ROLE + 0x24, 0)
        write(ROLE + 0xa0, 0)
        write(ROLE + 0x2a0, RECORD, PET, TANK)
        write(RECORD, g['RECORD_VTABLE'], g['MANAGER'])
        write(VTABLE + 0x20, 0x4327ac)
        write(RECORD + 0xd0, *([0] * 16))
        write(RECORD + 0x88, 0, 0)
        write(RECORD + 0x6c, 0, 0)
        write(RECORD + 0xbc, part, 0, 0, 0, 0)
        write(RECORD + 0x54, 777)
        # Every variant starts from these identical role/record bytes.
        initial_role = bytes(uc.mem_read(ROLE, 0x400))
        initial_record = bytes(uc.mem_read(RECORD, 0x200))
        variants = []
        for vip in [0, 1, 2]:
            for multiplier in [0, 1, 3]:
                uc.mem_write(ROLE, initial_role)
                uc.mem_write(RECORD, initial_record)
                uc.mem_write(RECORD + 0x50, bytes([vip]))
                write(ROLE + 0x98, multiplier)
                uc.mem_write(ROLE + 0x2b4, b'\1')
                g['events'].clear()
                g['g']['applied'].clear()
                write(g['MANAGER'] + 0x40, *([0] * 8))
                write(STACK, RETURN, BASE, EQUIPMENT, g['SKILL_MANAGER'], g['ITEM_MANAGER'], g['NULL_ARRAY'])
                for register, value in [(UC_X86_REG_ECX, ROLE), (UC_X86_REG_ESP, STACK), (UC_X86_REG_FPCW, 0x27f),
                                        (UC_X86_REG_FPSW, 0), (UC_X86_REG_FPTAG, 0xffff)]:
                    uc.reg_write(register, value)
                uc.emu_start(0x433466, RETURN, count=30000)
                assert uc.reg_read(UC_X86_REG_EIP) == RETURN
                assert uc.reg_read(UC_X86_REG_ESP) == STACK + 24
                assert read(RECORD + 0x54) == 777
                assert uc.mem_read(ROLE + 0x2b4, 1) == b'\0'
                movement_events = [dict(event) for event in g['events'] if event['kind'] == 'movement']
                assert [event['selector'] for event in movement_events] == [10, 11]
                row = dict(base=base, equipment=equipment, tank=tank, pet=pet, part=part,
                           vip=vip, vipMultiplier=multiplier, movement=movement_events,
                           maxHp=read(RECORD + 0x58), hp=777, values=g['values'](),
                           selected=list(g['g']['applied']))
                variants.append(row)
                rows.append(row)
        baseline = variants[0]
        assert baseline['maxHp'] > 0
        for variant in variants:
            assert variant['movement'] == baseline['movement']
            assert variant['selected'] == baseline['selected']
            assert variant['values']['roleFloats'] == baseline['values']['roleFloats']
            assert variant['values']['roleIntegers'] == baseline['values']['roleIntegers']
            assert variant['values']['recordFields']['56'] == baseline['values']['recordFields']['56']
            expected_hp = baseline['maxHp'] if variant['vip'] == 0 else baseline['maxHp'] * variant['vipMultiplier']
            assert variant['maxHp'] == expected_hp
        assert len({variant['maxHp'] for variant in variants}) == 3
assert len(g['tank_rows']) == 21 and len(rows) == 21 * 6 * 3 * 3
output = dict(status='PASS', rows=rows, scales=g['scales'], groups=21 * 6,
              scope='Complete original433466 executes all21 loaded tank definitions and10 rotating pet definitions, '
                    'six resolved part choices and VIP0/1/2 × supplied multiplier0/1/3. Each group has identical '
                    'imported owned records, empty initial skill slots, counter0 and no boundGear. '
                    'Actual432658 movement setters and original VIP MaxHP tail execute. Resource lookups use '
                    'the existing full recompute fixture. Multipliers are controlled native inputs; account VIP '
                    'multiplier provenance and original ownership transfer are outside this evidence.')
(ROOT / 'recovery/output/vip-movement-native.json').write_text(json.dumps(output, indent=2) + '\n')
print(f'PASS: {len(rows)} complete original433466 calls; {output["groups"]} identical-input groups preserve move/turn across VIP tails while MaxHP varies')
