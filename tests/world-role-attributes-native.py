"""Full original433466 with production initial counter/scalars/empty skill slots and resolved parts."""
import json
from pathlib import Path
import runpy
import struct
from unicorn.x86_const import UC_X86_REG_ECX, UC_X86_REG_ESP, UC_X86_REG_FPCW, UC_X86_REG_FPSW, UC_X86_REG_FPTAG
ROOT = Path(__file__).resolve().parents[1]
g = runpy.run_path(str(ROOT / 'recovery/evidence/attributes/role-recompute-native.py'))
uc, write, read = g['uc'], g['write'], g['read']
ROLE, BASE, EQUIPMENT, TANK, PET, RECORD, STACK, RETURN, VTABLE = [g[k] for k in
    ['ROLE', 'BASE', 'EQUIPMENT', 'TANK', 'PET', 'RECORD', 'STACK', 'RETURN', 'VTABLE']]
rows = []
for index, tank_row in enumerate(g['tank_rows']):
    tank = tank_row['result']; pet = g['pet_rows'][index % len(g['pet_rows'])]['result']
    base = dict(g['g']['base_rows'][0]['result']); equipment = dict(g['g']['equipment_rows'][0]['result'])
    base.update({'0': 73, '8': pet['id'], '44': 200, '52': 5, '60': 10})
    equipment.update({'28': 74, '36': tank['id'], '52': 1, '88': 0, '92': 0, '96': 0})
    for record, fields in [(BASE, base), (EQUIPMENT, equipment)]:
        for offset, value in fields.items(): write(record + int(offset), value)
    for key, offset in [('field84', 0x84), ('field88', 0x88), ('field90', 0x90), ('fieldA4', 0xa4), ('fieldA8', 0xa8)]:
        write(TANK + offset, tank[key])
    uc.mem_write(TANK + 0x8c, struct.pack('<f', tank['reloadDuration'])); write(TANK + 0x50, tank['tankType'])
    for key, offset in [('field7c', 0x7c), ('field80', 0x80), ('field84', 0x84), ('field88', 0x88)]:write(PET + offset, pet[key])
    for part in [0, 13001, 14001, 15001, 16001, 17001]:
        write(ROLE, VTABLE); write(ROLE + 0x24, 0); write(ROLE + 0xa0, 0)
        write(ROLE + 0x2a0, RECORD, PET, TANK)
        write(RECORD, g['RECORD_VTABLE'], g['MANAGER'])
        write(VTABLE + 0x20, 0x4327ac)
        write(RECORD + 0xd0, *([0]*16)); write(RECORD + 0x88, 0, 0)
        write(RECORD + 0x6c, 0, 0); write(RECORD + 0xbc, part, 0, 0, 0, 0)
        write(RECORD + 0x54, 777); uc.mem_write(RECORD + 0x50, b'\0')
        uc.mem_write(ROLE + 0x2b4, b'\1'); g['events'].clear();g['g']['applied'].clear()
        write(g['MANAGER'] + 0x40, *([0]*8))
        write(STACK, RETURN, BASE, EQUIPMENT, g['SKILL_MANAGER'], g['ITEM_MANAGER'], g['NULL_ARRAY'])
        for reg, value in [(UC_X86_REG_ECX, ROLE), (UC_X86_REG_ESP, STACK), (UC_X86_REG_FPCW, 0x27f), (UC_X86_REG_FPSW, 0), (UC_X86_REG_FPTAG, 0xffff)]:uc.reg_write(reg,value)
        uc.emu_start(0x433466, RETURN, count=30000)
        assert uc.reg_read(UC_X86_REG_ESP)==STACK+24 and read(RECORD+0x54)==777
        assert uc.mem_read(ROLE+0x2b4,1)==b'\0'
        rows.append(dict(base=base,equipment=equipment,tankId=tank['id'],petId=pet['id'],part=part,
            values=g['values'](), selected=list(g['g']['applied'])))
(ROOT/'recovery/output/world-role-attributes-native.json').write_text(json.dumps(dict(status='PASS',rows=rows,
    scope='Full original433466 with all21 loaded tanks,10 pet definitions, supplied imported owned records and production initial counter/copied skill/hat/balloon/16slots/boundGear absent. Parts table IDs supplied. Native movement setter/dirty execute; resource lookup supplied as existing full recompute fixture. Not original server ownership/transfer or damage formula.'),indent=2)+'\n')
print(f'PASS: {len(rows)} full original role recomputations using production initial source state')
