"""Recover the original retained movement effect and its world-position caller."""
import json
from pathlib import Path
import struct
import sys
import capstone
import pefile
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_EAX, UC_X86_REG_ECX, UC_X86_REG_EIP, UC_X86_REG_ESP

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'recovery'))
from effect_native import map_original_binaries

pe = pefile.PE(str(ROOT / 'CDTank/CDTank.exe'))
base = pe.OPTIONAL_HEADER.ImageBase
decoder = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)
ranges = {
    'threePartRetain': (0x46a21a, 0x46a249),
    'fourPartRetain': (0x46d709, 0x46d738),
    'threePartMotionEmission': (0x46aaef, 0x46abcd),
    'fourPartMotionEmission': (0x46e0e3, 0x46e1c1),
    'motionCaller': (0x46753f, 0x4675a1),
    'pendingPositionGate': (0x4660a5, 0x46610f),
    'releaseRetainedEffects': (0x46995d, 0x4699b3),
    'worldPositionStart': (0x47eed3, 0x47eef0),
    'sootTagInitializer': (0x5be560, 0x5be56f),
}
source = {name: [dict(va=hex(i.address), bytes=i.bytes.hex(),
                     instruction=f'{i.mnemonic} {i.op_str}')
                 for i in decoder.disasm(pe.get_data(a-base, z-a), a)]
          for name, (a, z) in ranges.items()}
assert pe.get_data(0x5c8790-base, 17).split(b'\0')[0] == b'_root\\online\\001'
assert pe.get_data(0x5c85e0-base, 11) == b'tag_efsoot\0'
library = json.loads((ROOT / 'recovery/output/web-assets/effect-library.json').read_text())
root = next(n for n in library['nodes'] if n['name'] == '_root\\online\\001')
by_id = {n['id']: n for n in library['nodes']}
pending, nodes = [root], []
while pending:
    node = pending.pop()
    nodes.append(dict(index=node['index'], name=node['name'], type=node['type'],
                      texture=bytes.fromhex(node['resource']).split(b'\0')[0].decode('ascii')))
    pending.extend(by_id[identifier] for identifier in node['children'])

# Execute the newly identified emission branch with one retained effect.
# Spatial integration, attachment lookup and renderer start are explicit boundaries.
uc, _ = map_original_binaries([ROOT / 'CDTank/CDTank.exe', ROOT / 'CDTank/gbengine.dll'])
uc.mem_map(0x2000000, 0x20000)
ACTOR, MATRIX, PAIR, VECTOR, EFFECT, VTABLE, CALLBACK, STACK, STOP = [0x2001000 + i*0x1000 for i in range(9)]
def put(a, *values):
    uc.mem_write(a, struct.pack('<'+'I'*len(values), *values))
def uint(a):
    return struct.unpack('<I', uc.mem_read(a, 4))[0]
def finish(value=0, pop=0):
    s = uc.reg_read(UC_X86_REG_ESP)
    uc.reg_write(UC_X86_REG_EAX, value)
    uc.reg_write(UC_X86_REG_EIP, uint(s))
    uc.reg_write(UC_X86_REG_ESP, s+4+pop)
events = []
present, identity = True, False
def hook(machine, address, size, data):
    s = machine.reg_read(UC_X86_REG_ESP)
    if address == 0x4654f1:
        finish(0, 4)
    elif address == 0x466676:
        events.append(dict(kind='tagLookup', tagKeyAddress=hex(uint(s+4))))
        finish(int(present), 4)
    elif address == 0x46748f:
        finish(PAIR, 4)
    elif address == uint(0x5c08f0):
        finish(int(identity))
    elif address == uint(0x5c09e8):
        # Read the caller's world-position output, rather than inline OBB data.
        out = uint(s+8)
        uc.mem_write(out, struct.pack('<3f', 123, 7, -456))
        finish(0, 8)
    elif address == CALLBACK:
        events.append(dict(kind='startWorld', effect=hex(machine.reg_read(UC_X86_REG_ECX)),
                           position=list(struct.unpack('<3f', uc.mem_read(uint(s+4), 12)))))
        finish(0, 4)
for a in [0x4654f1, 0x466676, 0x46748f, uint(0x5c08f0), uint(0x5c09e8), CALLBACK]:
    uc.hook_add(UC_HOOK_CODE, hook, begin=a, end=a)
put(PAIR, MATRIX, 0)
put(EFFECT, VTABLE)
put(VTABLE+0x38, CALLBACK)
put(ACTOR+0x1fc, 0, VECTOR, VECTOR+4, VECTOR+4)
put(VECTOR, EFFECT)
rows = []
for entry, accumulator, phase in [(0x46aaef, 0x2c0, 0x2c4), (0x46e0e3, 0x350, 0x354)]:
    for label, present, identity, delta in [('emit', True, False, .10001),
                                          ('missing-tag', False, False, .10001),
                                          ('identity-tag', True, True, .10001),
                                          ('before-period', True, False, .05)]:
        uc.mem_write(ACTOR+accumulator, struct.pack('<f', 0))
        put(ACTOR+phase, 0)
        uc.mem_write(STACK, struct.pack('<If', STOP, delta))
        uc.reg_write(UC_X86_REG_ESP, STACK)
        uc.reg_write(UC_X86_REG_ECX, ACTOR)
        events.clear()
        uc.emu_start(entry, STOP, count=20000)
        assert uc.reg_read(UC_X86_REG_EIP) == STOP
        starts = [e for e in events if e['kind'] == 'startWorld']
        assert len(starts) == int(label == 'emit')
        if starts:
            assert starts[0]['position'] == [123, 7, -456]
        rows.append(dict(entry=hex(entry), scenario=label, events=list(events)))
output = dict(status='PASS_ORIGINAL_MOVEMENT_EMISSION_BOUNDARY', source=source,
              resourceRoot=root['name'], tag='tag_efsoot', nodes=nodes, execution=rows,
              scope='Original three/four-part emission bodies execute. Existing pending-position gate source is reused. Spatial integration, tag lookup/matrix point transform, retained-vector setup and effect v38 are supplied boundaries. No original loader, full effect start, player pixels, or low-HP trigger is asserted.')
(ROOT / 'recovery/output/role-movement-dust-source.json').write_text(json.dumps(output, indent=2)+'\n')
print('PASS: original three/four-part retained001 world-position emission; 8 boundary cases')
