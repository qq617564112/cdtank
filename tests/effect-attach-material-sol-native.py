"""Execute complete original geom AttachSelf with source sections and cache reuse."""
import json
from pathlib import Path
import struct
import sys
import capstone
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_EAX, UC_X86_REG_ECX, UC_X86_REG_EIP, UC_X86_REG_ESP, UC_X86_REG_FPCW
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'recovery'))
from effect_native import map_original_binaries
machine, images = map_original_binaries([ROOT / 'CDTank/gbengine.dll', ROOT / 'CDTank/msvcr71.dll'])
machine.mem_map(0, 4096)
machine.mem_map(0x2000000, 0x400000)
GFX, MANAGER, NODE, MODEL, SECTIONS = 0x2010000, 0x2020000, 0x2030000, 0x2040000, 0x2050000
STACK, STOP, HEAP = 0x2060000, 0x2070000, 0x2100000
QUEUE, MATRIX, BUFFER, VTABLE, PLANES = 0x2200000, 0x2210000, 0x2220000, 0x2230000, 0x2240000
identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
heap = HEAP
lookups = []
allocations = []
def uint(address):
    return struct.unpack('<I', machine.mem_read(address, 4))[0]
def put(address, *values):
    machine.mem_write(address, struct.pack('<' + 'I' * len(values), *values))
def floats(address, values):
    machine.mem_write(address, struct.pack('<' + 'f' * len(values), *values))
def returned(uc, stack, cleanup=0, value=0):
    uc.reg_write(UC_X86_REG_EAX, value)
    uc.reg_write(UC_X86_REG_EIP, uint(stack))
    uc.reg_write(UC_X86_REG_ESP, stack + 4 + cleanup)
def hook(uc, address, size, data):
    global heap
    stack = uc.reg_read(UC_X86_REG_ESP)
    if address in (0x10037140, 0x10036f70):
        # Original profiling entry/exit has no geometry or queue responsibility.
        returned(uc, stack)
    elif address == 0x1003bcec:
        count = uint(stack + 4)
        allocation = heap
        heap += (count + 15) & ~15
        allocations.append(count)
        returned(uc, stack, value=allocation)
    elif address == PLANES:
        # Camera interface supplies six valid planes; the original AABB test runs.
        pointer = uint(stack + 4)
        floats(pointer, [0, 0, 0, 1] * 6)
        returned(uc, stack, 8)
    elif address == 0x10026d70:
        flags = uint(stack + 4)
        lookups.append(flags)
        returned(uc, stack, 4, 0x2250000 + flags * 0x10)
machine.hook_add(UC_HOOK_CODE, hook)
put(0x10055d14, GFX)
put(0x10055d10, MANAGER)
put(GFX, VTABLE)
put(VTABLE + 0x44, PLANES)
for offset, address in [(0xd4, MATRIX), (0xd8, MATRIX + 0x100), (0xdc, MATRIX + 0x200)]:
    put(GFX + offset, address)
    put(address, BUFFER + (offset - 0xd4) * 0x100, 8, 0, 0)
    floats(uint(address), identity)
put(MANAGER + 0x4000, QUEUE, 0)
put(MANAGER + 0x4414, GFX)
put(0x100534b4, 0)
put(GFX + 0x590, 0)
machine.reg_write(UC_X86_REG_FPCW, 0x27f)
def call(address, *arguments):
    put(STACK, STOP, *arguments)
    machine.reg_write(UC_X86_REG_ESP, STACK)
    machine.reg_write(UC_X86_REG_ECX, NODE)
    machine.emu_start(address, STOP, count=100000)
    assert machine.reg_read(UC_X86_REG_ESP) == STACK + 4 + 4 * len(arguments)

library = json.loads((ROOT / 'recovery/output/web-assets/effect-models.json').read_text())
rows = []
# Both orderings use the same source model sections without clearing the native cache.
for resource in library['resources']:
    if resource['resolution'] != 'published':
        continue
    for node_index, node in enumerate(resource['nodes']):
        for order in [(1, .375), (.375, 1)]:
            machine.mem_write(NODE, bytes(0x1000))
            machine.mem_write(MODEL, bytes(0x1000))
            machine.mem_write(SECTIONS, bytes(0x1000))
            call(0x1000fe70)
            assert uint(NODE + 0x70) == 0
            assert uint(NODE + 0x74) == 0
            assert uint(NODE + 0x78) == 0
            put(NODE + 0x38, 1)
            put(NODE + 0x128, MODEL)
            put(MODEL + 0x38, node['fvf'], SECTIONS, len(node['parts']))
            # Source model names and source section kind/diffuse/centroid are provided.
            model_name = Path(resource['reference'].replace('\\', '/')).stem.encode()
            machine.mem_write(MODEL + 0x18, model_name + b'\0')
            for part_index, part in enumerate(node['parts']):
                section = SECTIONS + part_index * 0xbc
                put(section, part['kind'], 0)
                floats(section + 8, part['properties'])
                # The current POL/CVD section bounding centroid defaults to zero here.
                floats(section + 0x9c, [0, 0, 0])
            cache = HEAP - 0x10000
            put(NODE + 0x6c, 0, cache, cache, cache + len(node['parts']) * 4)
            initial_lookup = len(lookups)
            initial_allocations = len(allocations)
            steps = []
            for step_index, alpha in enumerate([*order, order[0]]):
                blend = int(alpha < 1)
                call(0x1001d980, blend, struct.unpack('<I', struct.pack('<f', alpha))[0])
                # Queue is per-frame; node cache persists across the three submissions.
                put(MANAGER + 0x4004, 0)
                incoming = identity[:]
                incoming[12:15] = [step_index * 3, -2, 5]
                floats(BUFFER, incoming)
                before_lookup = len(lookups)
                before_allocations = len(allocations)
                call(0x100107d0, 0)  # Complete Attach dispatch + complete AttachSelf.
                count = uint(MANAGER + 0x4004)
                assert count == len(node['parts'])
                assert uint(MATRIX + 8) == 0
                assert list(struct.unpack('<16f', machine.mem_read(BUFFER, 64))) == incoming
                submissions = []
                for part_index, part in enumerate(node['parts']):
                    submission = QUEUE + part_index * 0xf4
                    flags = uint(submission + 0x1c)
                    expected = (0x801 if node['fvf'] & 4 else 1) | (0x80 if part['kind'] == 1 or order[0] < 1 else 0)
                    assert flags == expected
                    assert uint(submission) == NODE
                    assert uint(submission + 8) == part_index
                    assert uint(submission + 0x10) == SECTIONS + part_index * 0xbc + 8
                    matrix = list(struct.unpack('<16f', machine.mem_read(submission + 0x24, 64)))
                    assert matrix == incoming
                    submissions.append(dict(part=part_index, kind=part['kind'], flags=flags, matrix=matrix,
                        effect=uint(submission + 0xc), opaque=uint(submission + 0x18)))
                assert len(lookups) - before_lookup == (len(node['parts']) if step_index == 0 else 0)
                assert len(allocations) - before_allocations == (len(node['parts']) if step_index == 0 else 0)
                steps.append(dict(alpha=alpha, blend=blend, lookups=len(lookups)-before_lookup,
                    allocations=len(allocations)-before_allocations, submissions=submissions))
            assert len(lookups) - initial_lookup == len(node['parts'])
            assert allocations[initial_allocations:] == [0xf4] * len(node['parts'])
            rows.append(dict(reference=resource['reference'], node=node_index, fvf=node['fvf'], firstAlpha=order[0], steps=steps))
pe = images['gbengine.dll']
decoder = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)
evidence = {name: [dict(va=hex(i.address), instruction=f'{i.mnemonic} {i.op_str}')
    for i in decoder.disasm(pe.get_data(start-0x10000000, end-start), start)]
    for name, start, end in [('attach', 0x100107d0, 0x100107f5),
        ('attachSelf', 0x10011d70, 0x10012316), ('recursiveBlend', 0x1001d980, 0x1001d9ba),
        ('queueAllocate', 0x1001a110, 0x1001a1c3), ('cachedCopy', 0x1001d790, 0x1001d7ab),
        ('aabbCull', 0x10027ac0, 0x10027bc0)]}
(ROOT / 'recovery/output/effect-attach-material-sol-native.json').write_text(json.dumps(dict(rows=rows, evidence=evidence)) + '\n')
print(f'PASS: {len(rows)} complete original source node attach sequences / {sum(len(s["submissions"]) for r in rows for s in r["steps"])} source section submissions; first-attach material cache and fresh matrix snapshots')
