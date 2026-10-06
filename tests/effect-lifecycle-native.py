"""Execute original node dispatch/controller selection and child update order."""
from hashlib import sha256
import json
from pathlib import Path
import struct
import pefile
from unicorn import Uc, UC_ARCH_X86, UC_MODE_32, UC_HOOK_CODE
from unicorn.x86_const import (UC_X86_REG_ECX, UC_X86_REG_ESP, UC_X86_REG_EIP,
                               UC_X86_REG_EAX, UC_X86_REG_FPCW)

ROOT = Path(__file__).resolve().parents[1]
exe = ROOT / 'CDTank/CDTank.exe'
pe = pefile.PE(str(exe))
machine = Uc(UC_ARCH_X86, UC_MODE_32)
machine.mem_map(0x400000, (pe.OPTIONAL_HEADER.SizeOfImage + 4095) & ~4095)
machine.mem_write(0x400000, pe.get_memory_mapped_image())
machine.mem_map(0, 0x1000)
machine.mem_map(0x2000000, 0x40000)
OBJECT, DEFINITION, CONTROL_TABLE, CONTROLS, VTABLE, STUBS, STACK, STOP = (
    0x2010000, 0x2011000, 0x2012000, 0x2013000, 0x2014000,
    0x2015000, 0x2008000, 0x203f000)
events = []
tree_mode = False
tree_nodes = []


def uint(address):
    return struct.unpack('<I', machine.mem_read(address, 4))[0]


def finish(pop):
    stack = machine.reg_read(UC_X86_REG_ESP)
    machine.reg_write(UC_X86_REG_EIP, uint(stack))
    machine.reg_write(UC_X86_REG_ESP, stack + 4 + pop)


def log_event(value):
    if tree_mode:
        value['node'] = tree_nodes.index(machine.reg_read(UC_X86_REG_ECX))
    events.append(value)


def hook(uc, address, size, data):
    if STUBS <= address < STUBS + 0x100:
        offset = address - STUBS
        if offset == 0x10:
            delta = struct.unpack('<f', uc.mem_read(uc.reg_read(UC_X86_REG_ESP) + 4, 4))[0]
            log_event({'event': 'update', 'delta': delta})
            finish(4)
        elif offset == 0x28:
            log_event({'event': 'activate'})
            finish(0)
        elif offset == 0x2c:
            log_event({'event': 'end'})
            finish(0)
        elif offset == 0x38:
            log_event({'event': 'start'})
            node = uc.reg_read(UC_X86_REG_ECX)
            uc.mem_write(node + 4, struct.pack('<II', 1, 0))
            uc.mem_write(node + 0x10, bytes(4))
            finish(4)
        elif offset == 0x30:
            log_event({'event': 'reset', 'controller': uint(uc.reg_read(UC_X86_REG_ECX) + 0x10)})
            finish(0)
    elif address == 0x47f262:
        log_event({'event': 'release'})
        node = uc.reg_read(UC_X86_REG_ECX)
        uc.mem_write(node + 4, bytes(8))
        if tree_mode and node != tree_nodes[0]:
            parent = tree_nodes[0]
            first, end = uint(parent + 0x30), uint(parent + 0x34)
            children = [uint(index) for index in range(first, end, 4)]
            children.remove(node)
            uc.mem_write(first, struct.pack('<' + 'I' * len(children), *children))
            uc.mem_write(parent + 0x34, struct.pack('<I', first + len(children) * 4))
        finish(0)


machine.hook_add(UC_HOOK_CODE, hook)
machine.mem_write(VTABLE, bytes(0x44))
for offset in [0x10, 0x28, 0x2c, 0x30, 0x38]:
    machine.mem_write(VTABLE + offset, struct.pack('<I', STUBS + offset))
machine.mem_write(VTABLE + 0x24, struct.pack('<I', 0x47eef0))
library = json.loads((ROOT / 'recovery/output/web-assets/effect-library.json').read_text())
rows = []
for timing in library['nodeTimings']:
    for retain in [False, True]:
        machine.mem_write(OBJECT, bytes(0x100))
        machine.mem_write(OBJECT, struct.pack('<III', VTABLE, 1, 0))
        machine.mem_write(OBJECT + 0xc, struct.pack('<I', DEFINITION))
        machine.mem_write(OBJECT + 0x3c, bytes([retain]))
        machine.mem_write(DEFINITION, bytes(0x180))
        machine.mem_write(DEFINITION + 0x154, struct.pack('<ff', timing['delay'], timing['lifetime']))
        count = len(timing['controllers'])
        machine.mem_write(DEFINITION + 0x160, struct.pack('<II', CONTROL_TABLE, CONTROL_TABLE + count * 4))
        for index, control in enumerate(timing['controllers']):
            machine.mem_write(CONTROL_TABLE + index * 4, struct.pack('<I', CONTROLS + index * 16))
            machine.mem_write(CONTROLS + index * 16 + 4, struct.pack('<ffB', control['start'], control['end'], control['flag']))
        deltas = [0, max(0, timing['delay']) / 2, max(0, timing['delay']) / 2,
                  .02, .2, .5, max(0, timing['lifetime']) + 1, 0, .03]
        steps = []
        for delta in deltas:
            events.clear()
            machine.mem_write(STACK, struct.pack('<If', STOP, delta))
            machine.reg_write(UC_X86_REG_ECX, OBJECT)
            machine.reg_write(UC_X86_REG_ESP, STACK)
            machine.reg_write(UC_X86_REG_FPCW, 0x27f)
            machine.emu_start(0x47f61c, STOP, count=50000)
            assert machine.reg_read(UC_X86_REG_ESP) == STACK + 8
            phase = uint(OBJECT + 4)
            elapsed = struct.unpack('<f', machine.mem_read(OBJECT + 8, 4))[0]
            controller = struct.unpack('<i', machine.mem_read(OBJECT + 0x10, 4))[0]
            steps.append({'delta': delta, 'events': list(events), 'phase': phase,
                          'elapsed': elapsed, 'controller': controller})
        rows.append({'timing': timing, 'retain': retain, 'steps': steps})
tree_rows = []
tree_mode = True
tree_nodes = [0x2020000, 0x2021000, 0x2022000]
for root_delay in [0, .05]:
    for retained_root in [False, True]:
        timings = [{'delay': root_delay, 'lifetime': .05, 'controllers': [{'start': 0, 'end': 0, 'flag': 0}]},
                   {'delay': 0, 'lifetime': .1, 'controllers': [{'start': 0, 'end': 0, 'flag': 0}]},
                   {'delay': .05, 'lifetime': .15, 'controllers': [{'start': 0, 'end': .075, 'flag': 0},
                                                                {'start': .075, 'end': .2, 'flag': 0}]}]
        for index, (node, timing) in enumerate(zip(tree_nodes, timings)):
            definition, table, controls, children = node + 0x100, node + 0x400, node + 0x300, node + 0x500
            machine.mem_write(node, bytes(0x1000))
            machine.mem_write(node, struct.pack('<III', VTABLE, 1 if index == 0 else 0, 0))
            machine.mem_write(node + 0xc, struct.pack('<I', definition))
            machine.mem_write(node + 0x3c, bytes([retained_root if index == 0 else False]))
            machine.mem_write(definition + 0x154, struct.pack('<ff', timing['delay'], timing['lifetime']))
            count = len(timing['controllers'])
            machine.mem_write(definition + 0x160, struct.pack('<II', table, table + count * 4))
            for ci, control in enumerate(timing['controllers']):
                machine.mem_write(table + ci * 4, struct.pack('<I', controls + ci * 16))
                machine.mem_write(controls + ci * 16 + 4, struct.pack('<ffB', control['start'], control['end'], control['flag']))
            if index == 0:
                machine.mem_write(node + 0x30, struct.pack('<II', children, children + 8))
                machine.mem_write(children, struct.pack('<2I', *tree_nodes[1:]))
        steps = []
        for delta in [0, .025, .025, .05, .05, .05, .05, 0, 0, .01]:
            events.clear()
            machine.mem_write(STACK, struct.pack('<If', STOP, delta))
            machine.reg_write(UC_X86_REG_ECX, tree_nodes[0])
            machine.reg_write(UC_X86_REG_ESP, STACK)
            machine.emu_start(0x47f61c, STOP, count=50000)
            steps.append({'delta': delta, 'events': list(events),
                          'states': [{'phase': uint(node + 4),
                                      'elapsed': struct.unpack('<f', machine.mem_read(node + 8, 4))[0],
                                      'controller': struct.unpack('<i', machine.mem_read(node + 0x10, 4))[0]}
                                     for node in tree_nodes],
                          'childCount': (uint(tree_nodes[0] + 0x34) - uint(tree_nodes[0] + 0x30)) // 4})
        tree_rows.append({'timings': timings, 'retainedRoot': retained_root, 'steps': steps})
(ROOT / 'recovery/output/effect-lifecycle-native.json').write_text(json.dumps({
    'exeSha256': sha256(exe.read_bytes()).hexdigest(), 'rows': rows, 'trees': tree_rows}) + '\n')
print(f'PASS: {len(rows)} complete native lifetime/dispatch sequences, {len(rows) * 9} ticks')
