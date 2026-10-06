"""Execute original Mend serializers and the complete tank receipt receiver."""
import json
import struct
import sys
from pathlib import Path
from capstone import Cs, CS_ARCH_X86, CS_MODE_32
from unicorn import UC_HOOK_CODE, UC_HOOK_MEM_WRITE
from unicorn.x86_const import UC_X86_REG_EAX, UC_X86_REG_ECX, UC_X86_REG_EIP, UC_X86_REG_ESP
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'recovery'))
from effect_native import map_original_binaries
uc, images = map_original_binaries([ROOT / 'CDTank/CDTank.exe'])
uc.mem_map(0x2000000, 0x30000)
GAME, MODES, MODE, VT, MANAGER, PROFILE, PACKET, TANK, SHOP, CALLBACK, CVT, SENTINEL, NODE = [0x2001000+i*0x1000 for i in range(13)]
STACK, STOP, MODE_GETTER, NOTIFY, STREAM = [0x2020000+i*0x1000 for i in range(5)]
mode = 2
trace, writes, fields = [], [], []
input_fields = []
def put(a,*v): uc.mem_write(a, struct.pack('<'+'I'*len(v),*v))
def get(a): return struct.unpack('<I',uc.mem_read(a,4))[0]
def finish(value=0,pop=0):
 s=uc.reg_read(UC_X86_REG_ESP)
 uc.reg_write(UC_X86_REG_EAX,value);uc.reg_write(UC_X86_REG_EIP,get(s));uc.reg_write(UC_X86_REG_ESP,s+4+pop)
def boundary(machine,address,size,data):
 s=uc.reg_read(UC_X86_REG_ESP)
 if address==MODE_GETTER: finish(mode)
 elif address==NOTIFY:
  trace.append({'kind':get(s+4),'result':get(s+8),'remainingMinutes':get(TANK+0x34),'coin':get(PROFILE+0x94),'money':get(PROFILE+0x90)});finish(pop=8)
 elif address==0x401c7a:
  assert uc.reg_read(UC_X86_REG_ECX)==STREAM
  fields.append({'bits':get(s+8),'value':get(get(s+4)) & ((1<<get(s+8))-1)});finish(pop=8)
 else:
  assert address==0x401d58 and uc.reg_read(UC_X86_REG_ECX)==STREAM
  f=input_fields.pop(0);assert get(s+8)==f['bits'];put(get(s+4),f['value']);finish(pop=8)
def watch(machine,access,address,size,value,data):
 if PROFILE<=address<PROFILE+0x400 or TANK<=address<TANK+0x100:
  writes.append({'pc':hex(uc.reg_read(UC_X86_REG_EIP)),'target':'profile' if address<TANK else 'tank','offset':hex(address-(PROFILE if address<TANK else TANK)),'value':value,'size':size})
for a in (MODE_GETTER,NOTIFY,0x401c7a,0x401d58):uc.hook_add(UC_HOOK_CODE,boundary,begin=a,end=a)
uc.hook_add(UC_HOOK_MEM_WRITE,watch)
put(0x633588,GAME);put(GAME+0xac,0);put(GAME+0xe0,MODES);put(GAME+0x118,MANAGER)
put(MODES,MODE);put(MODE,VT);put(VT+4,MODE_GETTER);put(VT+0x30,0x420551)
put(MANAGER+0x40,PROFILE);put(PROFILE+0x20,VT)
put(PROFILE+8,SENTINEL,1);put(SENTINEL,NODE,NODE,NODE);uc.mem_write(SENTINEL+0x14,bytes([1,1]))
put(NODE,SENTINEL,SENTINEL,SENTINEL,83,TANK);uc.mem_write(NODE+0x14,bytes([1,0]))
put(TANK+0x1c,83);put(TANK+0x24,3);put(CALLBACK,CVT);put(CVT+8,NOTIFY);put(SHOP+0x68,CALLBACK)
def call(a,this,*args):
 put(STACK,STOP,*args);uc.reg_write(UC_X86_REG_ECX,this);uc.reg_write(UC_X86_REG_ESP,STACK)
 uc.emu_start(a,STOP,count=100000)
 assert uc.reg_read(UC_X86_REG_EIP)==STOP and uc.reg_read(UC_X86_REG_ESP)==STACK+4+len(args)*4
codec=[]
for currency in (0,1):
 put(PACKET+0xc,83,2,7,currency);fields.clear();call(0x492887,PACKET,STREAM)
 request=list(fields);assert request==[{'bits':32,'value':83},{'bits':8,'value':2},{'bits':8,'value':7},{'bits':8,'value':currency}]
 uc.mem_write(PACKET+0xc,bytes(16));input_fields[:]=request;call(0x4928e4,PACKET,STREAM)
 assert [get(PACKET+k) for k in (0xc,0x10,0x14,0x18)]==[83,2,7,currency]
 codec.append({'currency':currency,'requestType':'0x3f90','fields':request})
put(PACKET+0xc,83,19950,975000,7,2,4);fields.clear();call(0x498be9,PACKET,STREAM)
reply=list(fields);assert [f['bits'] for f in reply]==[32,32,32,8,8,8]
uc.mem_write(PACKET+0xc,bytes(24));input_fields[:]=reply;call(0x498c6c,PACKET,STREAM)
assert [get(PACKET+k) for k in (0xc,0x10,0x14,0x18,0x1c,0x20)]==[83,19950,975000,7,2,4]
rows=[]
for result,current_mode,instance in [(r,2,83) for r in range(6)]+[(4,1,83),(4,2,999)]:
 mode=current_mode;put(TANK+0x34,0);put(PROFILE+0x90,1000000,20000);put(PACKET+0xc,instance,19950,975000,7,2,result)
 trace.clear();writes.clear();call(0x495612,SHOP,PACKET,0,0)
 success=result==4 and mode==2
 assert get(TANK+0x34)==(10080 if success and instance==83 else 0)
 assert [get(PROFILE+0x94),get(PROFILE+0x90)]==([19950,975000] if success else [20000,1000000])
 assert len(trace)==(1 if mode==2 and (result!=4 or instance==83) else 0)
 rows.append({'result':result,'mode':mode,'instance':instance,'remainingMinutes':get(TANK+0x34),'coin':get(PROFILE+0x94),'money':get(PROFILE+0x90),'callback':list(trace),'writes':list(writes)})
decoder=Cs(CS_ARCH_X86,CS_MODE_32);image=images['cdtank.exe'].get_memory_mapped_image()
source={}
for a,n in [(0x495612,0xf2),(0x498be9,0xee),(0x492887,0xa9),(0x5183b3,0x70),(0x51983d,0x207),(0x43b5b3,0x75),(0x519ac5,0x238)]:
 source[hex(a)]=[{'va':hex(i.address),'bytes':i.bytes.hex(),'asm':i.mnemonic+' '+i.op_str} for i in decoder.disasm(image[a-0x400000:a-0x400000+n],a)]
output={'status':'PASS_ORIGINAL_MEND_REQUEST_REPLY_CODEC_AND_TANK_RECEIVER','codec':codec,'replyType':'0x3f91','replyFields':reply,'rows':rows,'source':source,'scope':'Original serializers with supplied bit-stream terminals; complete495612, actual4269c4/421f36 tree lookup/420551 profile setter. Mode and UI callbacks supplied. No original server debit/authorization/time decrement, wire framing or running-client session.'}
(ROOT/'recovery/output/tank-maintenance-receipt-native.json').write_text(json.dumps(output,ensure_ascii=False,indent=2)+'\n')
print(output['status'],len(rows),'receiver branches')
