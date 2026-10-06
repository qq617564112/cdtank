"""Execute original CVD empty-root construction, decoding and slot retention."""
import json
from pathlib import Path
import struct
import sys
import capstone
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_EAX, UC_X86_REG_ECX, UC_X86_REG_EIP, UC_X86_REG_ESP
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'recovery'))
from effect_native import map_original_binaries
from cvd import read_cvd
uc,images=map_original_binaries([ROOT/'CDTank/gbengine.dll'])
uc.mem_map(0,4096);uc.mem_map(0x2000000,0x10000)
STACK,STOP,NODE,SLOTS,INDEX=0x2001000,0x2002000,0x2003000,0x2004000,0x2005000
source=ROOT/'recovery/output/verified/assets/data/Data/scnobj/obj05442/c9.CVD'
raw=source.read_bytes();assert raw[:4]==b'cvdf' and struct.unpack_from('<I',raw,4)[0]==8
cursor=8;reads=[];executed=[]
def get(a):return struct.unpack('<I',uc.mem_read(a,4))[0]
def put(a,*values):uc.mem_write(a,struct.pack('<'+'I'*len(values),*values))
def finish(value=0,pop=0):
 s=uc.reg_read(UC_X86_REG_ESP);uc.reg_write(UC_X86_REG_EAX,value);uc.reg_write(UC_X86_REG_EIP,get(s));uc.reg_write(UC_X86_REG_ESP,s+4+pop)
def hook(machine,address,size,data):
 global cursor
 s=machine.reg_read(UC_X86_REG_ESP)
 if address==0x1003bcec:assert get(s+4)==0x148;finish(NODE)
 elif address==0x10034b10:finish(uc.reg_read(UC_X86_REG_ECX))
 elif address==0x1003c106:
  dst,src,n=[get(s+i) for i in [4,8,12]];uc.mem_write(dst,bytes(uc.mem_read(src,n)));finish(dst)
 elif address==0x10035a60:
  dst,n,stream=[get(s+i) for i in [4,8,12]];uc.mem_write(dst,raw[cursor:cursor+n]);reads.append(dict(offset=cursor,size=n,bytes=raw[cursor:cursor+n].hex()));cursor+=n;finish(n,12)
 elif address==0x1003c143:finish()
 else:executed.append(hex(address))
for a in [0x1003bcec,0x10034b10,0x1003c106,0x10035a60,0x1003c143,0x10011189,0x10011330,0x100115a3,0x100115b0]:uc.hook_add(UC_HOOK_CODE,hook,begin=a,end=a)
put(STACK,STOP,0x2006000,0x3ecccccd,SLOTS,INDEX);uc.reg_write(UC_X86_REG_ESP,STACK)
uc.emu_start(0x10011540,STOP,count=10000)
assert get(SLOTS)==NODE and get(INDEX)==1 and cursor==13
assert get(NODE+0x10c)==0 and all(get(NODE+i)==0 for i in [0xfc,0x100,0x104,0x12c,0x138])
identity=(1.,0.,0.,0.,0.,1.,0.,0.,0.,0.,1.,0.,0.,0.,0.,1.)
assert struct.unpack('<16f',uc.mem_read(NODE+0x7c,64))==identity
assert struct.unpack('<16f',uc.mem_read(NODE+0xbc,64))==identity
nodes=read_cvd(source)['nodes'];assert len(nodes)==8 and nodes[0]==dict(parent=None,present=0) and all(n['parent'] is None and len(n['frames'])==25 for n in nodes[1:])
pe=images['gbengine.dll'];decoder=capstone.Cs(capstone.CS_ARCH_X86,capstone.CS_MODE_32)
result=dict(status='PASS',sourceBytes=len(raw),serializedNodes=8,drawNodes=7,emptyRoot=dict(index=0,parent=None,present=0,consumedBytes=5,slotRetained=True,geometryPointers=0,matrix=list(identity)),reads=reads,executed=executed,substitutes=['allocator storage','base named-node constructor (no geom fields)','memcpy','gbVFile read provider','stack cookie check'],scope='Original gbGeomNode constructor/empty CVD body/recursive slot retention; populated geometry parsed from original c9, GPU not emulated',sources=[])
for a,b in [(0x1000fe70,0x1000ff2f),(0x10011150,0x1001118f),(0x10011330,0x10011348),(0x10011540,0x100115f4),(0x10031f30,0x10031f47)]:result['sources'].append(dict(start=hex(a),end=hex(b),instructions=[dict(address=hex(i.address),bytes=i.bytes.hex(),instruction=f'{i.mnemonic} {i.op_str}') for i in decoder.disasm(pe.get_data(a-0x10000000,b-a),a)]))
(ROOT/'recovery/output/scene-breach20-05442-empty-native.json').write_text(json.dumps(result,indent=2)+'\n')
print('PASS: original empty root has identity transforms, no geometry, retained slot0; source8 slots/seven draw roots')
