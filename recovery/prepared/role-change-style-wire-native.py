"""Original 4173/4174 notification body codecs and receiver projection."""
import json
import struct
import sys
from pathlib import Path
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import *
ROOT=Path(__file__).resolve().parents[3]
sys.path.insert(0,str(ROOT/'recovery'))
from effect_native import map_original_binaries
uc,_=map_original_binaries([ROOT/'CDTank/CDTank.exe'])
uc.mem_map(0x2000000,0x20000)
PACKET,STREAM,BUFFER,GAME,MANAGER,ROLE,ACTOR=[0x2000000+x for x in [0x1000,0x2000,0x3000,0x4000,0x5000,0x6000,0x7000]]
STACK,RETURN=0x2010000,0x2011000
put=lambda a,*v:uc.mem_write(a,struct.pack('<'+'I'*len(v),*v))
put(0x633588,GAME);put(GAME+0x118,MANAGER);put(ROLE+0x310,ACTOR)
def call(a,*args):
 put(STACK,RETURN,*args);uc.reg_write(UC_X86_REG_ESP,STACK);uc.reg_write(UC_X86_REG_ECX,PACKET)
 uc.emu_start(a,RETURN,count=10000)
 assert uc.reg_read(UC_X86_REG_EIP)==RETURN
 assert uc.reg_read(UC_X86_REG_ESP)==STACK+4*(len(args)+1)
rows=[]
for kind,writer,reader,bits in [('change',0x4898e2,0x492a08,40),('original',0x42571f,0x425ba6,32)]:
 for style in ([1,2] if kind=='change' else [0]):
  for alignment in range(8):
   uc.mem_write(PACKET,b'\0'*24)
   put(PACKET+0xc,style if kind=='change' else 73,73)
   uc.mem_write(BUFFER,b'\0'*16);put(STREAM,alignment,0,BUFFER,16)
   call(writer,STREAM)
   payload=bytes(uc.mem_read(BUFFER,(alignment+bits+7)//8))
   assert int.from_bytes(payload,'little')==((style|(73<<8)) if kind=='change' else 73)<<alignment
   uc.mem_write(PACKET+0xc,b'\xaa'*8);put(STREAM,alignment,0,BUFFER,16)
   call(reader,STREAM)
   values=struct.unpack('<2I',uc.mem_read(PACKET+0xc,8))
   assert values==(style,73) if kind=='change' else values[0]==73
   assert struct.unpack('<I',uc.mem_read(STREAM,4))[0]==alignment+bits
   observed=[]
   def hook(m,a,n,d):
    sp=m.reg_read(UC_X86_REG_ESP)
    if a==0x48a226:
     ret,role_id=struct.unpack('<2I',m.mem_read(sp,8));assert role_id==73
     m.reg_write(UC_X86_REG_EAX,ROLE);m.reg_write(UC_X86_REG_ESP,sp+8);m.reg_write(UC_X86_REG_EIP,ret)
    elif a in [0x42a9dd,0x42a527]:
     count=2 if a==0x42a9dd else 1
     values=struct.unpack('<'+'I'*(count+1),m.mem_read(sp,4*(count+1)))
     observed.append(list(values[1:]));m.reg_write(UC_X86_REG_ESP,sp+4*(count+1));m.reg_write(UC_X86_REG_EIP,values[0])
   h=uc.hook_add(UC_HOOK_CODE,hook)
   call(0x4860a7 if kind=='change' else 0x4860e6,PACKET,0,0)
   uc.hook_del(h)
   assert observed==([[73,style]] if kind=='change' else [[73]])
   rows.append(dict(kind=kind,style=style,roleId=73,bitOffset=alignment,bodyBits=bits,payload=payload.hex(),managerArguments=observed[0]))
result=dict(status='PASS_ORIGINAL_STYLE_WIRE_TO_RECEIVER',rows=rows,
 scope='24 original writer401c7a/reader401d58 codec bodies through original4173/4174 receivers; eight bit alignments. Role lookup and final manager application supplied. No message header/transport/full object renderer/authority policy.',
 receiverSource='recovery/output/role-change-style-receiver-native.json')
(ROOT/'recovery/output/role-change-style-wire-native.json').write_text(json.dumps(result,indent=2)+'\n')
print(result['status']+': 24 original bodycodec→receiver projections')
