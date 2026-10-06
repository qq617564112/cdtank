"""Execute original type4 lifecycle with recorded supplied sound backend."""
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
finished = False
next_handle = 0

def uint(address): return struct.unpack('<I', machine.mem_read(address, 4))[0]
def finish(pop=0):
    stack = machine.reg_read(UC_X86_REG_ESP)
    machine.reg_write(UC_X86_REG_EIP, uint(stack))
    machine.reg_write(UC_X86_REG_ESP, stack + 4 + pop)
def hook(uc, address, size, data):
    global next_handle
    stack = uc.reg_read(UC_X86_REG_ESP)
    if address == 0x571bd4:
        uc.reg_write(UC_X86_REG_EAX, MANAGER)
        finish()
    elif address == 0x5702b0:
        handle = uint(uint(stack + 4))
        events.append(dict(kind='finished', handle=handle, result=finished))
        uc.reg_write(UC_X86_REG_EAX, int(finished))
        finish(4)
    elif address == 0x5705bb:
        events.append(dict(kind='stop', handle=uint(uint(stack + 4))))
        finish(4)
    elif address == 0x4858f2:
        output, reference, parameter = uint(stack + 4), uint(stack + 8), uint(stack + 12)
        raw = bytes(uc.mem_read(reference, 324)).split(b'\0')[0].decode('gb18030')
        next_handle += 1
        descriptor = struct.pack('<6I', next_handle, 12, 23, 34, 45, 56)
        uc.mem_write(output, descriptor)
        events.append(dict(kind='play', handle=next_handle, reference=raw, parameter=parameter))
        uc.reg_write(UC_X86_REG_EAX, output)
        finish()
    elif address == 0x47f262:
        events.append(dict(kind='release'))
        uc.mem_write(OBJECT + 4, bytes(8))
        finish()
machine.hook_add(UC_HOOK_CODE, hook)
rows = []
for node in library['nodes']:
    if node['type'] != 4: continue
    timing = next(t for t in library['nodeTimings'] if t['node'] == node['index'])
    resource = bytes.fromhex(node['resource'])
    for ending in ['duration', 'finished']:
        machine.mem_write(OBJECT, bytes(0x100))
        machine.mem_write(DEFINITION, bytes(0x180))
        machine.mem_write(RESOURCE, bytes(0x160))
        machine.mem_write(OBJECT, struct.pack('<I', 0x5c96d0))
        for address, value in [(OBJECT + 12, DEFINITION), (DEFINITION + 0x150, RESOURCE), (DEFINITION + 0x160, TABLE), (DEFINITION + 0x164, TABLE + len(timing['controllers']) * 4)]: machine.mem_write(address, struct.pack('<I', value))
        machine.mem_write(DEFINITION + 0x154, struct.pack('<ff', timing['delay'], timing['lifetime']))
        machine.mem_write(RESOURCE + 4, resource[:324])
        machine.mem_write(RESOURCE + 0x148, resource[324:329])
        for i, control in enumerate(timing['controllers']):
            machine.mem_write(TABLE + i * 4, struct.pack('<I', CONTROL + i * 32))
            machine.mem_write(CONTROL + i * 32 + 4, struct.pack('<ffB', control['start'], control['end'], control['flag']))
        machine.mem_write(ORIGIN, struct.pack('<3f', 12.5, -3.75, 21))
        machine.mem_write(STACK, struct.pack('<II', STOP, ORIGIN))
        machine.reg_write(UC_X86_REG_ESP, STACK)
        machine.reg_write(UC_X86_REG_ECX, OBJECT)
        machine.reg_write(UC_X86_REG_FPCW, 0x27f)
        machine.emu_start(0x474104, STOP, count=100000)
        steps = []
        for index, delta in enumerate([0, max(0, timing['delay']), .016, .1, max(0, timing['lifetime']) + 1, 0, 0]):
            finished = ending == 'finished' and index >= 3
            events.clear()
            machine.mem_write(STACK, struct.pack('<If', STOP, delta))
            machine.reg_write(UC_X86_REG_ESP, STACK)
            machine.reg_write(UC_X86_REG_ECX, OBJECT)
            machine.emu_start(0x47f61c, STOP, count=100000)
            assert machine.reg_read(UC_X86_REG_ESP) == STACK + 8
            steps.append(dict(delta=delta, finished=finished, events=list(events), phase=uint(OBJECT + 4), elapsed=struct.unpack('<f', machine.mem_read(OBJECT + 8, 4))[0], controller=struct.unpack('<i', machine.mem_read(OBJECT + 0x10, 4))[0], started=bool(machine.mem_read(OBJECT + 0x40, 1)[0]), handle=uint(OBJECT + 0x48)))
        rows.append(dict(node=node['index'], timing=timing, reference=resource[:324].split(b'\0')[0].decode('gb18030'), parameter=struct.unpack_from('<I',resource,324)[0], stopPrevious=bool(resource[328]), steps=steps))
(ROOT / 'recovery/output/effect-sound-lifecycles-native.json').write_text(json.dumps(dict(rows=rows))+'\n')
print(f'PASS: {len(rows)} source type4 sound lifecycles / {sum(len(r["steps"]) for r in rows)} ticks')
