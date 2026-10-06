"""Execute the original UMsgSkBomb receiver and record its world-effect calls."""
import json, struct, sys
from pathlib import Path
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_EAX, UC_X86_REG_ECX, UC_X86_REG_ESP, UC_X86_REG_EIP
ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT/'recovery'))
from effect_native import map_original_binaries
u, images = map_original_binaries([ROOT/'CDTank/CDTank.exe'])
u.mem_map(0,4096);u.mem_map(0x2000000,0x30000)
MSG, SKILL, TABLE, WORLD, VTABLE, POINTS, STACK, STOP, SAMPLE = [0x2001000+i*0x1000 for i in range(9)]
def w(a,*values):u.mem_write(a,struct.pack('<'+'I'*len(values),*[v&0xffffffff for v in values]))
def r(a):return struct.unpack('<I',u.mem_read(a,4))[0]
def finish(value=0,pop=0):
 s=u.reg_read(UC_X86_REG_ESP);u.reg_write(UC_X86_REG_EAX,value);u.reg_write(UC_X86_REG_EIP,r(s));u.reg_write(UC_X86_REG_ESP,s+4+pop)
lookups=[];samples=[];effects=[];present=True
w(0x635830,TABLE);w(TABLE+0x60,WORLD);w(WORLD,VTABLE);w(VTABLE+0x1c,SAMPLE)
def boundary(machine,a,size,data):
 s=u.reg_read(UC_X86_REG_ESP)
 if a==0x413c65:finish(TABLE)
 elif a==0x411068:
  lookups.append(r(s+4));finish(SKILL if present else 0,4)
 elif a==0x57c0d6:
  dest,size,fmt,value=[r(s+i) for i in [4,8,12,16]]
  assert size==256
  pattern=bytes(u.mem_read(fmt,80)).split(b'\0')[0].decode('ascii')
  u.mem_write(dest,(pattern%value).encode()+b'\0');finish()
 elif a==SAMPLE:
  x,z,dest=[r(s+i) for i in [4,8,12]]
  x=struct.unpack('<i',struct.pack('<I',x))[0];z=struct.unpack('<i',struct.pack('<I',z))[0]
  samples.append([x,z]);u.mem_write(dest,struct.pack('<3f',x+0.25,77,z+0.5));finish(0,12)
 elif a==0x45afc2:
  result,name=[r(s+i) for i in [4,8]]
  xyz=list(struct.unpack('<3f',u.mem_read(s+12,12)));flag=r(s+24)
  effects.append(dict(name=bytes(u.mem_read(name,80)).split(b'\0')[0].decode(),xyz=xyz,flag=flag))
  u.mem_write(result,bytes(28));finish(result,24)
 elif a==0x401171:finish(pop=8)
for a in [0x413c65,0x411068,0x57c0d6,SAMPLE,0x45afc2,0x401171]:u.hook_add(UC_HOOK_CODE,boundary,begin=a,end=a)
rows=[]
for present,slot,effect,points in [(True,0,10,[]),(True,0,10,[(12.75,-9.5)]),
 (True,1,113,[(-3.9,7.99),(0.5,-0.5),(100.1,200.8)]),(True,2,0,[(1.,2.)]),(False,0,10,[(1.,2.)])]:
 lookups.clear();samples.clear();effects.clear();w(MSG+0xc,13,slot);w(SKILL+0x70,10,113,0)
 w(SKILL+0x70+slot*4,effect)
 if points:
  u.mem_write(POINTS,b''.join(struct.pack('<2f',*p) for p in points));w(MSG+0x14,0,POINTS,POINTS+len(points)*8,POINTS+len(points)*8)
 else:w(MSG+0x14,0,0,0,0)
 w(STACK,STOP,MSG,0,0);u.reg_write(UC_X86_REG_ESP,STACK);u.reg_write(UC_X86_REG_ECX,0x200b000)
 u.emu_start(0x486a09,STOP,count=20000)
 assert u.reg_read(UC_X86_REG_EIP)==STOP and u.reg_read(UC_X86_REG_ESP)==STACK+16
 expected=[[int(x),int(z)] for x,z in points] if present and effect else []
 assert samples==expected and len(effects)==len(expected)
 for call,(x,z) in zip(effects,expected):assert call==dict(name=f'_root\\online\\{effect:03d}',xyz=[x+.25,0.,z+.5],flag=1)
 rows.append(dict(skillPresent=present,slot=slot,effect=effect,points=points,lookups=list(lookups),samples=list(samples),effects=list(effects)))
out=ROOT/'recovery/output/skill-bomb-entry-native.json'
out.write_text(json.dumps(dict(status='PASS_ORIGINAL_SK_BOMB_WORLD_EFFECT_RECEIVER',messageType='0x416f',callback='0x486a09',rows=rows,
 boundaries='Supplied skill lookup/formatting/world sampling/effect creation and string disposal; original callback, vector count417b49, x87 conversion57bb64, field reads and loop executed.',
 findings=['message+c skillId, +10 zero-based effect slot, +14 vector of8-byte float32 X/Z pairs',
 '57bb64 converts each float32 coordinate to signed integer by truncation toward zero before world virtual1c sampling',
 'The sampled X/Z are used but effect Y is explicitly0; flag1 passed to world effects',
 'No FuncType read, targetHP write, trap allocation or durable inventory consumption in this receiver'],
 nextEntrances=['Original0x416f sender/coordinates producer','Relationship between Func16 skill13 and0x416f authorization is unconfirmed']),ensure_ascii=False,indent=2)+'\n')
print('PASS: five original486a09 message cases; world-only receiver, not damage or trap executor')
