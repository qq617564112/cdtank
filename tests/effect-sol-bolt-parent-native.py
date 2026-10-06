"""Original type2 endpoint rebuild/update with a changing attached matrix."""
import json
from pathlib import Path
import struct
import sys
from capstone import Cs, CS_ARCH_X86, CS_MODE_32
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_ECX, UC_X86_REG_ESP, UC_X86_REG_EIP, UC_X86_REG_EAX, UC_X86_REG_FPCW
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'recovery'))
from effect_native import map_original_binaries
machine, _ = map_original_binaries([ROOT / 'CDTank' / n for n in ['CDTank.exe', 'gbengine.dll', 'msvcr71.dll']])
machine.mem_map(0, 0x1000)
machine.mem_map(0x2000000, 0x80000)
OBJECT, DEFINITION, RESOURCE, SEGMENTS, WORLD = 0x2010000, 0x2011000, 0x2015000, 0x2020000, 0x2030000
PARENT, STACK, STOP = 0x201a000, 0x2008000, 0x203f000
library = json.loads((ROOT / 'recovery/output/web-assets/effect-library.json').read_text())
random_values = []
random_index = 0
freed = []
def uint(a): return struct.unpack('<I', machine.mem_read(a, 4))[0]
def hook(uc, a, size, data):
    global random_index
    if a == 0x57cbcb or a == 0x57a6c7:
        stack = uc.reg_read(UC_X86_REG_ESP)
        if a == 0x57cbcb:
            value = [8191, 24575, 16383, 1000][random_index % 4]
            random_index += 1
            random_values.append(value)
            uc.reg_write(UC_X86_REG_EAX, value)
        else:
            freed.append(uint(stack + 4))
        uc.reg_write(UC_X86_REG_EIP, uint(stack))
        uc.reg_write(UC_X86_REG_ESP, stack + 4)
machine.hook_add(UC_HOOK_CODE, hook)
identity = [1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]
matrices = [identity, [0,1,0,0,-1,0,0,0,0,0,1,0,12.5,-3.75,21,1],
            [1.25,0,0,0,0,.5,0,0,0,0,2,0,-8,4,13,1], [0]*16, identity]
rows = []
for node in library['nodes']:
    if node['type'] != 2: continue
    raw = bytes.fromhex(node['resource'])
    config = next(c for c in library['boltControls'] if c['node'] == node['index'])
    machine.mem_write(OBJECT, bytes(0x100))
    machine.mem_write(DEFINITION, bytes(0x180))
    machine.mem_write(RESOURCE, bytes(0x200))
    machine.mem_write(OBJECT + 12, struct.pack('<I', DEFINITION))
    machine.mem_write(DEFINITION + 0x150, struct.pack('<I', RESOURCE))
    machine.mem_write(OBJECT + 0x20, struct.pack('<I', PARENT))
    machine.mem_write(OBJECT + 0x80, struct.pack('<I', WORLD))
    machine.mem_write(RESOURCE + 0x148, raw[324:])
    machine.mem_write(OBJECT + 0x14, struct.pack('<3f', 99, -42, 31))
    random_index = 0
    samples = []
    for index, matrix in enumerate(matrices):
        # Original storage allocation/free is supplied; endpoint and matrix code execute unchanged.
        machine.mem_write(OBJECT + 0x70, struct.pack('<I', SEGMENTS))
        machine.mem_write(PARENT, struct.pack('<16f', *matrix))
        random_values.clear()
        freed.clear()
        delta = 0 if index == 0 else max(config['interval'], .125)
        machine.mem_write(STACK, struct.pack('<If', STOP, delta))
        machine.reg_write(UC_X86_REG_ESP, STACK)
        machine.reg_write(UC_X86_REG_ECX, OBJECT)
        machine.reg_write(UC_X86_REG_FPCW, 0x27f)
        machine.emu_start(0x47e161 if index == 0 else 0x47e40a, STOP, count=1000000)
        count = uint(OBJECT + 0x68)
        samples.append(dict(matrix=matrix, delta=delta, randomValues=list(random_values), frees=list(freed),
            state=dict(start=list(struct.unpack('<3f', machine.mem_read(OBJECT + 0x40, 12))),
                       end=list(struct.unpack('<3f', machine.mem_read(OBJECT + 0x4c, 12))),
                       segments=[list(struct.unpack('<3f', machine.mem_read(SEGMENTS+i*12,12))) for i in range(count)],
                       worldSegments=[list(struct.unpack('<10f', machine.mem_read(WORLD+i*40,40))) for i in range(count)],
                       remainder=struct.unpack('<f', machine.mem_read(OBJECT+0x64,4))[0])))
    rows.append(dict(node=node['index'], config=config, samples=samples))
evidence=[]
for start, length in [(0x47dadc, 0xd5), (0x47e40a, 0x33), (uint(0x5c08f0), 0x30)]:
    evidence.extend(dict(address=hex(i.address), mnemonic=i.mnemonic, operands=i.op_str)
                    for i in Cs(CS_ARCH_X86,CS_MODE_32).disasm(bytes(machine.mem_read(start,length)),start))
(ROOT/'recovery/output/effect-sol-bolt-parent-native.json').write_text(json.dumps(dict(rows=rows, instructions=evidence))+'\n')
print(f'PASS: {len(rows)} source nodes / {sum(len(r["samples"]) for r in rows)} attached matrix rebuild/update samples')
