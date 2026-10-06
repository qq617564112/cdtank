"""Execute the original type8 full lifecycle with supplied manager release."""
import json
from pathlib import Path
import struct
import sys
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_ECX, UC_X86_REG_ESP, UC_X86_REG_EIP, UC_X86_REG_EAX, UC_X86_REG_FPCW
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'recovery'))
from effect_native import map_original_binaries
machine, _ = map_original_binaries([ROOT / 'CDTank' / name for name in ['CDTank.exe', 'gbengine.dll', 'msvcr71.dll']])
machine.mem_map(0, 0x1000)
machine.mem_map(0x2000000, 0x40000)
OBJECT, DEFINITION, TABLE, CONTROL, RESOURCE, STACK, STOP, ORIGIN, MANAGER = 0x2010000, 0x2011000, 0x2012000, 0x2013000, 0x2015000, 0x2008000, 0x203f000, 0x201d000, 0x201e000
library = json.loads((ROOT / 'recovery/output/web-assets/effect-library.json').read_text())
events = []
def uint(address): return struct.unpack('<I', machine.mem_read(address, 4))[0]
def hook(uc, address, size, data):
    if address == 0x47f262:
        events.append(dict(kind='release'))
        uc.mem_write(OBJECT + 4, bytes(8))
        stack = uc.reg_read(UC_X86_REG_ESP)
        uc.reg_write(UC_X86_REG_EIP, uint(stack))
        uc.reg_write(UC_X86_REG_ESP, stack + 4)
machine.hook_add(UC_HOOK_CODE, hook)
rows = []
for node in library['nodes']:
    if node['type'] != 8: continue
    timing = next(t for t in library['nodeTimings'] if t['node'] == node['index'])
    resource = bytes.fromhex(node['resource'])
    for ending in ['duration']:
        machine.mem_write(OBJECT, bytes(0x100))
        machine.mem_write(DEFINITION, bytes(0x180))
        machine.mem_write(RESOURCE, bytes(0x160))
        machine.mem_write(OBJECT, struct.pack('<I', 0x5c9c50))
        for address, value in [(OBJECT + 12, DEFINITION), (DEFINITION + 0x150, RESOURCE), (DEFINITION + 0x160, TABLE), (DEFINITION + 0x164, TABLE + len(timing['controllers']) * 4)]: machine.mem_write(address, struct.pack('<I', value))
        machine.mem_write(DEFINITION + 0x154, struct.pack('<ff', timing['delay'], timing['lifetime']))
        machine.mem_write(RESOURCE + 0x154, resource[-4:])
        for i, control in enumerate(timing['controllers']):
            machine.mem_write(TABLE + i * 4, struct.pack('<I', CONTROL + i * 96))
            machine.mem_write(CONTROL + i * 96 + 4, struct.pack('<ffB', control['start'], control['end'], control['flag']))
            machine.mem_write(CONTROL + i * 96 + 0x10, bytes.fromhex(node['modifiers'][i]['payload']))
        machine.mem_write(ORIGIN, struct.pack('<3f', 12.5, -3.75, 21))
        machine.mem_write(STACK, struct.pack('<II', STOP, ORIGIN))
        machine.reg_write(UC_X86_REG_ESP, STACK)
        machine.reg_write(UC_X86_REG_ECX, OBJECT)
        machine.reg_write(UC_X86_REG_FPCW, 0x27f)
        machine.emu_start(0x4835a4, STOP, count=100000)
        steps = []
        for index, delta in enumerate([0, max(0, timing['delay']), .016, .1, .124, .125, .25, .125, .251, .249, .125, .251, .249, .125, .126, .375, max(0, timing['lifetime']) + 1, 0, 0]):
            events.clear()
            machine.mem_write(STACK, struct.pack('<If', STOP, delta))
            machine.reg_write(UC_X86_REG_ESP, STACK)
            machine.reg_write(UC_X86_REG_ECX, OBJECT)
            machine.emu_start(0x47f61c, STOP, count=100000)
            assert machine.reg_read(UC_X86_REG_ESP) == STACK + 8
            steps.append(dict(delta=delta, events=list(events), phase=uint(OBJECT + 4), elapsed=struct.unpack('<f', machine.mem_read(OBJECT + 8, 4))[0], controller=struct.unpack('<i', machine.mem_read(OBJECT + 0x10, 4))[0], color=list(struct.unpack('<4f',machine.mem_read(OBJECT+0x40,16))),frame=uint(OBJECT+0x50),frameRemainder=struct.unpack('<f',machine.mem_read(OBJECT+0x54,4))[0]))
        controls=[]
        for modifier in node['modifiers']:
            payload=bytes.fromhex(modifier['payload'])
            controls.append(dict(baseFlag=bytes.fromhex(modifier['base'])[8],color=list(struct.unpack_from('<4f',payload)),colorAddRate=list(struct.unpack_from('<4f',payload,16)),frameCount=struct.unpack('<I',resource[-4:])[0],frameInterval=struct.unpack_from('<f',payload,32)[0],frameFlags=struct.unpack_from('<I',payload,36)[0]))
        rows.append(dict(node=node['index'],timing=timing,controls=controls,steps=steps))

(ROOT / 'recovery/output/effect-overlay-lifecycle-native.json').write_text(json.dumps(dict(rows=rows))+'\n')
print(f'PASS: {len(rows)} source type8 overlay lifecycles / {sum(len(r["steps"]) for r in rows)} ticks')
