"""Record the concrete actor target argument and supported action-record inventory."""
import json
from collections import Counter
from pathlib import Path
import struct
import sys
from capstone import Cs, CS_ARCH_X86, CS_MODE_32
from unicorn.x86_const import UC_X86_REG_ESI, UC_X86_REG_EBX
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'recovery'))
from effect_native import map_original_binaries
machine,_=map_original_binaries([ROOT/'CDTank'/n for n in ['CDTank.exe','gbengine.dll','msvcr71.dll']])
machine.mem_map(0x2000000,4096)
OBJECT=0x2000000
machine.mem_write(OBJECT,bytes([0xa5])*0x400)
machine.reg_write(UC_X86_REG_ESI,OBJECT);machine.reg_write(UC_X86_REG_EBX,0)
machine.emu_start(0x468656,0x468668,count=10)
assert struct.unpack('<3I',machine.mem_read(OBJECT+0x20c,12))==(0,0,0)
getters=[]
for vtable in [0x5c8468,0x5c8688,0x5c88c8]:
 getter=struct.unpack('<I',machine.mem_read(vtable+0x1c,4))[0]
 assert getter==0x464836
 getters.append(dict(vtable=hex(vtable),getter=hex(getter),positionOffset='0x180'))
links=json.loads((ROOT/'recovery/output/web-assets/effect-links.json').read_text())
records=[r for f in links['files'] for g in f['groups'] for a in g['actions'] for r in a['records']]
counts=Counter(r['bindingMode'] for r in records)
assert counts[4]==0
instructions=[]
for start,length in [(0x468656,0x12),(0x464836,7),(0x46910b,0x4e),(0x468f3a,0x10),(0x468fea,0x10),
                     (0x46c88a,0x10),(0x46c93a,0x10),(0x467736,0x37),(0x47b36d,0x28)]:
 instructions.extend(dict(address=hex(i.address),mnemonic=i.mnemonic,operands=i.op_str)
  for i in Cs(CS_ARCH_X86,CS_MODE_32).disasm(bytes(machine.mem_read(start,length)),start))
(ROOT/'recovery/output/effect-sol-entity-provider-source.json').write_text(json.dumps(dict(
 getters=getters,actorTargetInitialized=0,actorTargetOffset='0x214',records=len(records),bindingModes=counts,
 instructions=instructions))+'\n')
print(f'PASS: 3 concrete actor getter vtables; actor target initializes0; {len(records)} source action records, mode4={counts[4]}')
