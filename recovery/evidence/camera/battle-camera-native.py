"""Original third-person camera config assembly and complete follow update."""
import configparser,json,struct,sys,math
from pathlib import Path
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_EAX,UC_X86_REG_ECX,UC_X86_REG_ESP,UC_X86_REG_EIP,UC_X86_REG_FPCW
ROOT=Path(__file__).resolve().parents[3];sys.path.insert(0,str(ROOT/'recovery'))
from effect_native import map_original_binaries
u,_=map_original_binaries([ROOT/'CDTank'/n for n in ['CDTank.exe','gbengine.dll','msvcr71.dll']]);u.mem_map(0,4096);u.mem_map(0x2000000,0x100000)
CAM,CTRL,ACTOR,PROJ,VTABLE,STACK,STOP,STUB,VALUE=[0x2010000+i*0x1000 for i in range(9)]
config=configparser.ConfigParser();source='recovery/output/verified/assets/data/config/ClientRender.ini';config.read(ROOT/source);cfg={k:float(v) for k,v in config['ThirdPersonCamera'].items()}
def w(a,*v):u.mem_write(a,struct.pack('<'+'I'*len(v),*v))
def f(a,*v):u.mem_write(a,struct.pack('<'+'f'*len(v),*v))
def r(a):return struct.unpack('<I',u.mem_read(a,4))[0]
def vec(a):return list(struct.unpack('<3f',u.mem_read(a,12)))
def finish(pop=0,value=0):
 s=u.reg_read(UC_X86_REG_ESP);u.reg_write(UC_X86_REG_EAX,value);u.reg_write(UC_X86_REG_EIP,r(s));u.reg_write(UC_X86_REG_ESP,s+4+pop)
def string(a):
 out=b''
 while (ch:=bytes(u.mem_read(a,1)))!=b'\0':out+=ch;a+=1
 return out.decode()
reads=[]
def hook(uc,a,size,data):
 if a in [0x5734a1,0x57399d]:finish()
 elif a==0x573f35:assert string(r(u.reg_read(UC_X86_REG_ESP)+4))=='Config\\ClientRender.ini';finish(4)
 elif a==0x573ee5:
  s=u.reg_read(UC_X86_REG_ESP);section,key=string(r(s+4)),string(r(s+8));assert section=='ThirdPersonCamera';reads.append(key);f(VALUE,cfg[key]);u.reg_write(UC_X86_REG_EIP,STUB)
u.mem_write(STUB,b'\xd9\x05'+struct.pack('<I',VALUE)+b'\xc2\x0c\x00');u.hook_add(UC_HOOK_CODE,hook)
def execute(a,obj,args=[]):
 w(STACK,STOP,*args);u.reg_write(UC_X86_REG_ESP,STACK);u.reg_write(UC_X86_REG_ECX,obj);u.reg_write(UC_X86_REG_FPCW,0x27f);u.emu_start(a,STOP,count=100000);assert u.reg_read(UC_X86_REG_EIP)==STOP
w(CAM,0x5c6dd0);w(CAM+0xd4,0x5c6dc8);w(CAM+0x94,PROJ);w(CTRL+8,CAM)
execute(0x45654d,CTRL)
initial=dict(distance=struct.unpack('<f',u.mem_read(CAM+0xd8,4))[0],angles=list(struct.unpack('<2f',u.mem_read(CAM+0xdc,8))),fov=struct.unpack('<f',u.mem_read(PROJ,4))[0],offset=vec(CTRL+0xc))
assert set(reads)==set(cfg)
w(ACTOR,VTABLE);w(VTABLE+0x14,0x468b23);w(VTABLE+0x1c,0x464836);w(CAM+0xa0,ACTOR)
headingRows=[]
for radians in [-3,-1,0,.7,3]:
 f(ACTOR+0x1c,math.sin(radians),0,math.cos(radians));w(STACK,STOP);u.reg_write(UC_X86_REG_ESP,STACK);u.reg_write(UC_X86_REG_ECX,ACTOR);u.emu_start(0x46903d,0x469103,count=10000)
 degrees=struct.unpack('<f',u.mem_read(ACTOR+0xbc,4))[0];expected=math.degrees(radians)%360;assert abs(degrees-expected)<.001, (radians,degrees,expected)
 headingRows.append(dict(bodyYaw=radians,actorYawDegrees=degrees))
rows=[]
for yaw in [0,45,90,180,270,359]:
 for position in [[0,0,0],[100,12,-70]]:
  f(ACTOR+0xbc,yaw);f(ACTOR+0x180,*position);execute(0x456674,CTRL,[0x3c888889]);rows.append(dict(actorYawDegrees=yaw,position=position,eye=vec(CAM+0x18),target=vec(CAM+0x24),up=vec(CAM+0x3c)))
# Original dimensions/projection binding executes (no graphics device required).
w(CTRL+0x14,CAM);w(CTRL+0x1c,PROJ,800,600);execute(0x455ef1,CTRL)
planes=list(struct.unpack('<2f',u.mem_read(PROJ+0x10,8)));assert planes==[10,5000]
projections=[]
for width,height in [(800,600),(1920,1080),(2560,1440),(3840,2160)]:
 f(PROJ,60);w(PROJ+0x20,width,height);execute(0x1002c430,PROJ,[VALUE+16,VALUE+20]);half=list(struct.unpack('<2f',u.mem_read(VALUE+16,8)));projections.append(dict(width=width,height=height,nearHalfWidth=half[0],nearHalfHeight=half[1]))
assert abs(projections[0]['nearHalfWidth']-5.77350269)<1e-5
out=dict(headingRows=headingRows,projections=projections,status='PASS',source=source,config=cfg,initial=initial,clipPlanes=planes,rows=rows,scope='Original45654d config assembly with supplied INI service values; full456674 follow update, real actor getters468b23/464836, native orbit/rotation/normalization; original455ef1 projection binding and gbCamera dimensions. Actor position/yaw are supplied, graphics framebuffer not executed.')
(ROOT/'recovery/output/battle-camera-native.json').write_text(json.dumps(out,indent=2)+'\n');print('PASS: original third-person assembly, 12 complete camera poses, projection binding');print(json.dumps(rows[:4]))
