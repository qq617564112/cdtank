"""Execute original camera shake activation, complete update dispatch and CRT rand."""
import json
from pathlib import Path
import struct
import sys
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_EAX, UC_X86_REG_ECX, UC_X86_REG_EIP, UC_X86_REG_ESP, UC_X86_REG_FPCW

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'recovery'))
from effect_native import map_original_binaries
machine, _ = map_original_binaries([ROOT / 'CDTank' / name for name in ['CDTank.exe', 'gbengine.dll', 'msvcr71.dll']])
machine.mem_map(0x2000000, 0x100000)
CAMERA, VTABLE, CHILDREN, CHILD, TLS, STACK, STOP = 0x2010000, 0x2011000, 0x2012000, 0x2013000, 0x2014000, 0x2008000, 0x202f000
events = []
pose = {}

def uint(address):
    return struct.unpack('<I', machine.mem_read(address, 4))[0]

def floats(address, count):
    return list(struct.unpack(f'<{count}f', machine.mem_read(address, count * 4)))

def finish(value=0, pop=0):
    stack = machine.reg_read(UC_X86_REG_ESP)
    machine.reg_write(UC_X86_REG_EAX, value)
    machine.reg_write(UC_X86_REG_EIP, uint(stack))
    machine.reg_write(UC_X86_REG_ESP, stack + 4 + pop)

def hook(uc, address, size, data):
    if address == 0x58139a:
        finish(TLS)
    elif address == 0x57cbec:
        events.append(dict(kind='random', value=uc.reg_read(UC_X86_REG_EAX)))
    elif address == STOP + 16:
        events.append(dict(kind='child', object=uc.reg_read(UC_X86_REG_ECX), delta=floats(uc.reg_read(UC_X86_REG_ESP) + 4, 1)[0]))
        finish(pop=4)
    elif address == 0x574ab6:
        events.append(dict(kind='base', delta=floats(uc.reg_read(UC_X86_REG_ESP) + 4, 1)[0]))
        for name, offset in [('eye', 0x18), ('target', 0x24), ('right', 0x30), ('up', 0x3c)]:
            uc.mem_write(CAMERA + offset, struct.pack('<3f', *pose[name]))
        finish(pop=4)

machine.hook_add(UC_HOOK_CODE, hook)
library = json.loads((ROOT / 'recovery/output/web-assets/effect-library.json').read_text())
rows = []
for config in library['screenControls']:
    if config['type'] != 11:
        continue
    timing = library['nodeTimings'][config['node']]
    if timing['lifetime'] <= 0:
        continue
    for basis in [dict(right=[1, 0, 0], up=[0, 1, 0]), dict(right=[.8, 0, -.6], up=[.18, .9539392, .24]),
                  dict(right=[-1, 0, 0], up=[0, 1, 0])]:
        machine.mem_write(CAMERA, bytes(0x200))
        for address, value in [(CAMERA, VTABLE), (VTABLE + 0x20, 0x45573f),
                               (CAMERA + 0xa8, CHILDREN), (CAMERA + 0xac, CHILDREN + 8),
                               (CHILDREN, CHILD), (CHILDREN + 4, CHILD + 16),
                               (CHILD, VTABLE + 0x100), (CHILD + 16, VTABLE + 0x100),
                               (VTABLE + 0x108, STOP + 16), (TLS + 0x14, 1)]:
            machine.mem_write(address, struct.pack('<I', value))
        pose = dict(eye=[12.5, 20, -40], target=[1, -3, 10], **basis)
        for name, offset in [('eye', 0x18), ('target', 0x24), ('right', 0x30), ('up', 0x3c)]:
            machine.mem_write(CAMERA + offset, struct.pack('<3f', *pose[name]))
        duration = timing['lifetime']
        machine.mem_write(STACK, struct.pack('<IIff', STOP, config['parameter'], duration, config['strength']))
        machine.reg_write(UC_X86_REG_ESP, STACK)
        machine.reg_write(UC_X86_REG_ECX, CAMERA)
        machine.reg_write(UC_X86_REG_FPCW, 0x27f)
        machine.emu_start(0x4556e2, STOP, count=10000)
        assert machine.reg_read(UC_X86_REG_ESP) == STACK + 16
        started = dict(parameter=uint(CAMERA + 0xc4), active=bool(machine.mem_read(CAMERA + 0xb4, 1)[0]), elapsed=floats(CAMERA + 0xcc, 1)[0])
        steps = []
        for index, delta in enumerate([0, .016, .1, duration, 0, .016]):
            target = [12.5 + index, 20, 10] if basis['right'] == [-1, 0, 0] else [1 + index, -3, 10]
            pose = dict(eye=[12.5 + index, 20, -40 + index * .5], target=target, **basis)
            events.clear()
            machine.mem_write(STACK, struct.pack('<If', STOP, delta))
            machine.reg_write(UC_X86_REG_ESP, STACK)
            machine.reg_write(UC_X86_REG_ECX, CAMERA)
            machine.emu_start(0x4558bc, STOP, count=100000)
            assert machine.reg_read(UC_X86_REG_ESP) == STACK + 8
            steps.append(dict(delta=delta, pose=pose, eye=floats(CAMERA + 0x18, 3), target=floats(CAMERA + 0x24, 3),
                              active=bool(machine.mem_read(CAMERA + 0xb4, 1)[0]), elapsed=floats(CAMERA + 0xcc, 1)[0],
                              seed=uint(TLS + 0x14), events=list(events)))
        rows.append(dict(node=config['node'], config=config, duration=duration, started=started, steps=steps,
                         browser=basis['right'] == [-1, 0, 0]))
(ROOT / 'recovery/output/effect-camera-shake-native.json').write_text(json.dumps(dict(rows=rows)) + '\n')
(ROOT / 'recovery/output/web-assets/effect-camera-shake-browser-native.json').write_text(json.dumps(dict(rows=[row for row in rows if row['browser'] and row['node'] in [384, 385, 671]])) + '\n')
print(f'PASS: {len(rows)} original source camera shake activations / {len(rows) * 6} complete camera updates / actual CRT random stream')
