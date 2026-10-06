"""Execute original geom attachment, vector growth, recursive cleanup and destruction."""
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
live = {}
events = []
MODEL_DESTROY = PLANES + 0x100
current_phase = "setup"
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
        live[allocation] = count
        events.append(dict(kind="allocate", address=allocation, size=count, phase=current_phase))
        returned(uc, stack, value=allocation)
    elif address in (0x1003bf8c, 0x1003bf98):
        pointer = uint(stack + 4)
        if pointer:
            assert pointer in live, f"unknown/double free {pointer:#x}"
            size = live.pop(pointer)
            events.append(dict(kind="free", address=pointer, size=size, phase=current_phase))
        returned(uc, stack)
    elif address == MODEL_DESTROY:
        assert uc.reg_read(UC_X86_REG_ECX) == MODEL
        assert uint(MODEL + 4) == 0
        assert uint(stack + 4) == 1
        events.append(dict(kind="modelLastRelease", address=MODEL, phase=current_phase))
        returned(uc, stack, 4)
    elif address == 0x10034e90:
        events.append(dict(kind="modelRelease", address=uc.reg_read(UC_X86_REG_ECX),
            before=uint(uc.reg_read(UC_X86_REG_ECX) + 4), phase=current_phase))
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
def call(address, *arguments, node=NODE):
    put(STACK, STOP, *arguments)
    machine.reg_write(UC_X86_REG_ESP, STACK)
    machine.reg_write(UC_X86_REG_ECX, node)
    machine.emu_start(address, STOP, count=100000)
    assert machine.reg_read(UC_X86_REG_ESP) == STACK + 4 + 4 * len(arguments)

library = json.loads((ROOT / 'recovery/output/web-assets/effect-models.json').read_text())
rows = []
OTHER = NODE + 0x2000
put(VTABLE + 0x100, MODEL_DESTROY)
for resource in library['resources']:
    if resource['resolution'] != 'published':
        continue
    for node_index, source in enumerate(resource['nodes']):
        assert not live
        start = len(events)
        machine.mem_write(MODEL, bytes(0x1000))
        machine.mem_write(SECTIONS, bytes(0x1000))
        put(MODEL, VTABLE + 0x100, 2)
        put(MODEL + 0x38, source['fvf'], SECTIONS, len(source['parts']))
        model_name = Path(resource['reference'].replace('\\', '/')).stem.encode()
        machine.mem_write(MODEL + 0x18, model_name + b'\0')
        for index, part in enumerate(source['parts']):
            section = SECTIONS + index * 0xbc
            put(section, part['kind'], 0)
            floats(section + 8, part['properties'])
            floats(section + 0x9c, [0, 0, 0])
        for address in (NODE, OTHER):
            machine.mem_write(address, bytes(0x1000))
            # Supplied node storage is tracked so deleting destructors must release it.
            live[address] = 0x148
            current_phase = 'construct'
            call(0x1000fe70, node=address)
            assert [uint(address + offset) for offset in (0x70, 0x74, 0x78)] == [0, 0, 0]
            put(address + 0x128, MODEL)
        def attach(address, alpha):
            global current_phase
            current_phase = 'attach'
            call(0x1001d980, int(alpha < 1), struct.unpack('<I', struct.pack('<f', alpha))[0], node=address)
            put(MANAGER + 0x4004, 0)
            call(0x100107d0, 0, node=address)
            assert uint(MANAGER + 0x4004) == len(source['parts'])
            assert (uint(address + 0x74) - uint(address + 0x70)) // 4 == len(source['parts'])
            caches = [uint(uint(address + 0x70) + index * 4) for index in range(len(source['parts']))]
            for index, part in enumerate(source['parts']):
                expected = (0x801 if source['fvf'] & 4 else 1) | (0x80 if part['kind'] == 1 or alpha < 1 else 0)
                assert uint(caches[index] + 0x1c) == expected
                assert uint(caches[index]) == address
                assert uint(caches[index] + 0x10) == SECTIONS + index * 0xbc + 8
                assert uint(caches[index] + 0xc) == 0x2250000 + expected * 0x10
                assert live[caches[index]] == 0xf4
            return caches
        first = attach(NODE, 1)
        second = attach(OTHER, .375)
        assert set(first).isdisjoint(second)
        # Original child-list link drives recursive cleanup and deleting destruction.
        put(NODE + 0xc, OTHER, OTHER, 1)
        put(OTHER + 8, NODE)
        pointers = {address: [uint(address + offset) for offset in (0x70, 0x74, 0x78)] for address in (NODE, OTHER)}
        current_phase = 'cleanup'
        lookup_count = len(lookups)
        allocation_count = len(allocations)
        before = len(events)
        call(0x1001e4a0)
        freed = [event['address'] for event in events[before:] if event['kind'] == 'free']
        assert freed == first + [pointers[NODE][0]] + second + [pointers[OTHER][0]]
        assert uint(MODEL + 4) == 2
        assert len(lookups) == lookup_count and len(allocations) == allocation_count
        for address in (NODE, OTHER):
            assert [uint(address + offset) for offset in (0x70, 0x74, 0x78)] == [0, 0, 0]
        current_phase = 'repeatedCleanup'
        before = len(events)
        call(0x1001e4a0)
        assert len(events) == before
        # Reattach after cleanup uses current blend and rebuilds each cache.
        put(NODE + 0xc, 0, 0, 0)
        rebuilt_first = attach(NODE, .375)
        rebuilt_second = attach(OTHER, 1)
        assert set(first + second).isdisjoint(rebuilt_first + rebuilt_second)
        vector_first, vector_second = uint(NODE + 0x70), uint(OTHER + 0x70)
        put(NODE + 0xc, OTHER, OTHER, 1)
        current_phase = 'destroy'
        before = len(events)
        call(uint(uint(NODE)), 1)
        destroyed = events[before:]
        expected = [('modelRelease', MODEL)]
        expected += [('free', p) for p in rebuilt_first + [vector_first] + rebuilt_second + [vector_second]]
        expected += [('modelRelease', MODEL), ('modelLastRelease', MODEL), ('free', OTHER), ('free', NODE)]
        assert [(event['kind'], event['address']) for event in destroyed] == expected, (destroyed, expected)
        assert [event['before'] for event in destroyed if event['kind'] == 'modelRelease'] == [2, 1]
        assert not live
        rows.append(dict(reference=resource['reference'], node=node_index, sectionCount=len(source['parts']),
            firstCaches=first, secondCaches=second, rebuiltFirst=rebuilt_first, rebuiltSecond=rebuilt_second,
            events=events[start:], modelReferencesAfterCleanup=2, modelReferencesAfterDestruction=uint(MODEL + 4)))
# Nodes disposed before their first Attach have no cache/model to release.
empty_rows = []
for deleting in (0, 1):
    machine.mem_write(NODE, bytes(0x1000))
    live[NODE] = 0x148
    call(0x1000fe70)
    before = len(events)
    current_phase = 'emptyCleanup'
    call(0x1001e4a0)
    call(0x1001e4a0)
    assert len(events) == before
    current_phase = 'emptyDestroy'
    call(uint(uint(NODE)), deleting)
    assert events[before:] == ([dict(kind='free', address=NODE, size=0x148, phase='emptyDestroy')] if deleting else [])
    if not deleting:
        assert live.pop(NODE) == 0x148
    empty_rows.append(dict(deleting=deleting, events=events[before:]))
    assert not live
pe = images['gbengine.dll']
decoder = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)
evidence = {name: [dict(va=hex(i.address), instruction=f'{i.mnemonic} {i.op_str}')
    for i in decoder.disasm(pe.get_data(start-0x10000000, end-start), start)]
    for name, start, end in [('constructor', 0x1000fe70, 0x1000ff2f),
        ('attach', 0x100107d0, 0x100107f5), ('attachSelf', 0x10011d70, 0x10012316),
        ('cacheCleanup', 0x1001e4a0, 0x1001e505), ('geomDestructor', 0x10011700, 0x100117e3),
        ('baseDestructor', 0x1001e530, 0x1001e5ed), ('deletingDestructor', 0x10003670, 0x100036c5),
        ('resourceRelease', 0x10034e90, 0x10034e9c), ('childDestruction', 0x10034b20, 0x10034b38),
        ('vectorGrowth', 0x10011a30, 0x10011d70)]}
(ROOT / 'recovery/output/effect-attach-cleanup-sol-native.json').write_text(json.dumps(dict(rows=rows, emptyRows=empty_rows, evidence=evidence)) + '\n')
print(f'PASS: {len(rows)} original two-instance lifecycle pairs / {sum(r["sectionCount"] * 4 for r in rows)} source section submissions; vector growth, recursive/repeated cleanup, reattach, ordered node destruction and resource refcounts')
