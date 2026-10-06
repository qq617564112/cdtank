"""Execute original terrain material selector for the actual map0002 parts."""
import json,struct,sys
from pathlib import Path
from collections import Counter
import capstone
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_EAX,UC_X86_REG_EBX,UC_X86_REG_EDI,UC_X86_REG_ESI,UC_X86_REG_ESP,UC_X86_REG_EIP
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'recovery'))
from effect_native import map_original_binaries
from pol import read_pol
uc,images=map_original_binaries([ROOT/'CDTank/gbengine.dll'])
uc.mem_map(0x2000000,0x10000)
NODE,MODEL,PART,GFX,STACK,STOP=[0x2000000+i*0x1000 for i in range(6)]
def put(a,*v):uc.mem_write(a,struct.pack('<'+'I'*len(v),*v))
def get(a):return struct.unpack('<I',uc.mem_read(a,4))[0]
def string(a):
 b=bytearray()
 while uc.mem_read(a,1)!=b'\0':b.extend(uc.mem_read(a,1));a+=1
 return bytes(b)
def hook(machine,a,size,data):
 s=machine.reg_read(UC_X86_REG_ESP)
 if a==0x1001d970:machine.reg_write(UC_X86_REG_EAX,0);pop=4
 elif a==STOP:
  p,n=get(s+4),get(s+8);index=string(p).find(string(n));machine.reg_write(UC_X86_REG_EAX,p+index if index>=0 else 0);pop=0
 else:pop=0
 machine.reg_write(UC_X86_REG_EIP,get(s));machine.reg_write(UC_X86_REG_ESP,s+4+pop)
for a in [0x10037140,0x1001d970,STOP]:uc.hook_add(UC_HOOK_CODE,hook,begin=a,end=a)
put(0x1003f308,STOP);put(0x10055d14,GFX);put(GFX+0x590,0);put(0x100534b4,0);put(NODE+0x128,MODEL)
model=read_pol(ROOT/'recovery/output/verified/assets/data/Data/map/0002/0002.POL');rows=[]
for mesh in model['meshes']:
 for index,part in enumerate(mesh['parts']):
  put(MODEL+0x38,mesh['fvf']);uc.mem_write(MODEL+0x18,mesh['name'].encode()+b'\0');put(PART,part['kind'],0)
  uc.reg_write(UC_X86_REG_ESP,STACK);uc.reg_write(UC_X86_REG_ESI,NODE);uc.reg_write(UC_X86_REG_EDI,PART)
  uc.emu_start(0x1001206d,0x10012164,count=10000)
  assert uc.reg_read(UC_X86_REG_EIP)==0x10012164
  rows.append(dict(mesh=mesh['name'],part=index,fvf=mesh['fvf'],kind=part['kind'],flags=hex(uc.reg_read(UC_X86_REG_EBX)),texture=part['textures'][0]))
binary=images['gbengine.dll'].get_memory_mapped_image();cs=capstone.Cs(capstone.CS_ARCH_X86,capstone.CS_MODE_32)
instructions=[dict(address=hex(i.address),instruction=f'{i.mnemonic} {i.op_str}') for i in cs.disasm(binary[0x27240:0x27400],0x10027240)]
registrations={hex(flags):binary[pointer-0x10000000:].split(b'\0')[0].decode() for flags,pointer in [(0x801,0x10040ee0),(0x881,0x10040ec0)]}
assert Counter((r['kind'],r['flags']) for r in rows)==Counter({(0,'0x801'):58,(1,'0x881'):18})
result=dict(registrations=registrations,status='PASS_SELECTOR_NATIVE_ONLY',mapId=2,rows=rows,registration=instructions,scope='Original shader selector only, actual source mesh names/FVF/material kind; profiling/fog/string endpoints supplied. No GPU or player pixels.')
(ROOT/'recovery/output/scene-terrain02-material-native.json').write_text(json.dumps(result,indent=2)+'\n')
print(Counter((r['kind'],r['flags']) for r in rows))
for i in instructions:print(i['address'],i['instruction'])
