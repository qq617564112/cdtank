"""Execute source model recursive blend and AttachSelf material selection."""
import json
from pathlib import Path
import struct
import sys
import capstone
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_EAX, UC_X86_REG_EBX, UC_X86_REG_ECX, UC_X86_REG_EDI, UC_X86_REG_ESI, UC_X86_REG_ESP
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'recovery'))
from effect_native import map_original_binaries
from pol import read_pol
from cvd import read_cvd
machine, images = map_original_binaries([ROOT / 'CDTank/gbengine.dll', ROOT / 'CDTank/msvcr71.dll'])
machine.mem_map(0, 4096)
machine.mem_map(0x2000000, 0x100000)
GFX, MODEL, SECTION, STACK, STOP = [0x2010000 + i * 0x1000 for i in range(5)]
TREE = 0x2020000

def uint(address):
    return struct.unpack('<I', machine.mem_read(address, 4))[0]

def put(address, *values):
    machine.mem_write(address, struct.pack('<' + 'I' * len(values), *values))

# Native registration calls supply only the effect compiler boundary.
registrations = []
def hook(uc, address, size, data):
    if address == 0x10027070:
        stack = uc.reg_read(UC_X86_REG_ESP)
        pointer = uint(stack + 4)
        raw = bytearray()
        while machine.mem_read(pointer + len(raw), 1)[0]:
            raw.extend(machine.mem_read(pointer + len(raw), 1))
        registrations.append(dict(path=raw.decode(), flags=uint(stack + 8)))
        uc.reg_write(UC_X86_REG_EAX, 0x2040000 + len(registrations) * 0x100)
        uc.reg_write(UC_X86_REG_ESP, stack + 12)
        from unicorn.x86_const import UC_X86_REG_EIP
        uc.reg_write(UC_X86_REG_EIP, uint(stack))
machine.hook_add(UC_HOOK_CODE, hook)
machine.reg_write(UC_X86_REG_ESP, STACK)
machine.reg_write(UC_X86_REG_ESI, GFX)
machine.emu_start(0x100271fd, 0x100272a1, count=1000)
assert machine.reg_read(UC_X86_REG_ESP) == STACK
bindings = {row['flags']: Path(row['path'].replace('\\', '/')).stem for row in registrations}
assert all(flag in bindings for flag in (1, 0x81, 0x801, 0x881))

library = json.loads((ROOT / 'recovery/output/web-assets/effect-models.json').read_text())
draws = json.loads((ROOT / 'recovery/output/effect-model-draw-native.json').read_text())
blend_states = sorted({(row['blend'], row['alpha']) for row in draws['rows']})
put(0x10055d14, GFX)
put(GFX + 0x590, 0)  # Original no-fog mode, selected light count global is zero.
put(0x100534b4, 0)
rows = []
trees = []
asset_root = ROOT / 'recovery/output/verified/assets/data'
paths = {path.relative_to(asset_root).as_posix().lower(): path
    for path in asset_root.rglob('*') if path.suffix.lower() in ('.pol', '.cvd')}
for resource in library['resources']:
    if resource['resolution'] != 'published':
        continue
    path = paths[resource['reference'].replace('\\', '/').lower()]
    if path.suffix.lower() == '.pol':
        nodes = read_pol(path)['meshes']
    else:
        # Original animated mesh layout is XYZ/NORMAL/TEX1 (GB FVF 0x13).
        nodes = [dict(node, fvf=0x13) for node in read_cvd(path)['nodes'] if node['present']]
    assert len(nodes) == len(resource['nodes'])
    for source, published in zip(nodes, resource['nodes']):
        assert source['fvf'] == published['fvf']
        assert [part['kind'] for part in source['parts']] == [part['kind'] for part in published['parts']]
    # Original POL wrapper's child/next chain; the CVD source has a single node.
    addresses = [TREE + (index + 1) * 0x200 for index in range(len(nodes))]
    machine.mem_write(TREE, bytes(0x2000))
    put(TREE + 0xc, addresses[0])
    for index, address in enumerate(addresses):
        put(address + 4, addresses[index + 1] if index + 1 < len(addresses) else 0)
    for blend, alpha in blend_states:
        # Run the entire recursive setter; no callbacks substitute its recursion.
        put(STACK, STOP, blend)
        machine.mem_write(STACK + 8, struct.pack('<f', alpha))
        machine.reg_write(UC_X86_REG_ESP, STACK)
        machine.reg_write(UC_X86_REG_ECX, TREE)
        machine.emu_start(0x1001d980, STOP, count=10000)
        assert machine.reg_read(UC_X86_REG_ESP) == STACK + 12
        inherited = []
        for address in [TREE, *addresses]:
            inherited.append(dict(blend=uint(address + 0x50), alpha=struct.unpack('<f', machine.mem_read(address + 0x4c, 4))[0]))
        assert all(state == dict(blend=blend, alpha=alpha) for state in inherited)
        trees.append(dict(reference=resource['reference'], blend=blend, alpha=alpha, inherited=inherited))
        for index, node in enumerate(nodes):
            put(addresses[index] + 0x128, MODEL)
            put(MODEL + 0x38, node['fvf'])
            for part_index, part in enumerate(node['parts']):
                assert part['kind'] in (0, 1)
                put(SECTION, part['kind'], 0)  # Original section no-light flag.
                machine.reg_write(UC_X86_REG_ESI, addresses[index])
                machine.reg_write(UC_X86_REG_EDI, SECTION)
                machine.reg_write(UC_X86_REG_ESP, STACK)
                machine.emu_start(0x1001206d, 0x10012121, count=1000)
                assert machine.reg_read(UC_X86_REG_ESP) == STACK
                flags = machine.reg_read(UC_X86_REG_EBX)
                assert flags in bindings
                rows.append(dict(reference=resource['reference'], node=index, part=part_index,
                    fvf=node['fvf'], kind=part['kind'], blend=blend, alpha=alpha,
                    flags=flags, script=bindings[flags]))
pe = images['gbengine.dll']
c = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)
evidence = {name: [dict(va=hex(i.address), instruction=f'{i.mnemonic} {i.op_str}')
    for i in c.disasm(pe.get_data(start - 0x10000000, end - start), start)]
    for name, start, end in [('recursiveBlend', 0x1001d980, 0x1001d9ba),
        ('getBlend', 0x1001d970, 0x1001d97f),
        ('sectionSelection', 0x1001206d, 0x10012121),
        ('effectBindings', 0x100271fd, 0x100272a1)]}
output = dict(registrations=registrations, trees=trees, rows=rows, evidence=evidence)
(ROOT / 'recovery/output/effect-material-combo-sol-native.json').write_text(json.dumps(output) + '\n')
print(f'PASS: {len(trees)} complete recursive source model blends / {len(rows)} original section material selections')
