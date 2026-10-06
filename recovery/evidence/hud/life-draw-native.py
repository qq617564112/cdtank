"""Execute original WindowsLook progress tiling, colour bands and pixel clip."""
import json
import struct
import sys
from pathlib import Path
import capstone
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import *
ROOT=Path(__file__).resolve().parents[3]
sys.path.insert(0,str(ROOT/'recovery'))
from effect_native import map_original_binaries
uc,images=map_original_binaries([ROOT/'CDTank/CEGUIWindowsLook.dll'])
uc.mem_map(0,4096);uc.mem_map(0x2000000,0x100000)
OBJ,VTABLE,STACK,RETURN,SYSTEM,RENDERER,BACKGROUND,FILL= [0x2001000+n*0x1000 for n in range(8)]
STUB,TEMP=0x2020000,0x2030000

def word(a,*v):uc.mem_write(a,struct.pack('<'+'I'*len(v),*v))
def floating(a,*v):uc.mem_write(a,struct.pack('<'+'f'*len(v),*v))
def read(a):return struct.unpack('<I',uc.mem_read(a,4))[0]
def floats(a,n=4):return list(struct.unpack('<'+'f'*n,uc.mem_read(a,n*4)))
def f32(v):return struct.unpack('<f',struct.pack('<f',v))[0]
imports={s.address:s.name.decode() for e in images['ceguiwindowslook.dll'].DIRECTORY_ENTRY_IMPORT for s in e.imports if s.name}
handlers={};events=[];rect=[0,28,0,179];effective_alpha=1
for index,a in enumerate([0x1003d138,0x1003d154,0x1003d144,0x1003d150,0x1003d1a4,0x1003d148,0x1003d140,0x1003d1a0,0x1003d130,0x1003d17c]):
 t=STUB+index*0x100;word(a,t);handlers[t]=imports[a]
word(OBJ,VTABLE);word(VTABLE+4,STUB+0x1000);handlers[STUB+0x1000]='outerClip'
word(0x1003d134,TEMP+0x10);floating(TEMP+0x10,0)
word(SYSTEM+0x18,RENDERER);floating(RENDERER+0x14,0)
# The original compiler conversion truncates ST(0); execute its small FISTP body.
uc.mem_write(0x10036a5c,bytes.fromhex('83ec0cd93c24668b042480cc0c6689442402d96c2402db5c2404d92c248b44240483c40cc3'))

def finish(pop=0,value=0):
 sp=uc.reg_read(UC_X86_REG_ESP);uc.reg_write(UC_X86_REG_EAX,value);uc.reg_write(UC_X86_REG_EIP,read(sp));uc.reg_write(UC_X86_REG_ESP,sp+4+pop)
def hook(u,a,size,data):
 if a not in handlers:return
 n=handlers[a];sp=u.reg_read(UC_X86_REG_ESP);this=u.reg_read(UC_X86_REG_ECX)
 if n=='outerClip' or 'getUnclippedPixelRect' in n:
  out=read(sp+4);floating(out,*rect);finish(4,out)
 elif 'getSingleton' in n:finish(value=SYSTEM)
 elif 'getEffectiveAlpha' in n:
  floating(TEMP,effective_alpha);u.mem_write(a+0x20,b'\xd9\x05'+struct.pack('<I',TEMP)+b'\xc3');u.reg_write(UC_X86_REG_EIP,a+0x20)
 elif 'draw@RenderableElement' in n:finish(8)
 elif n=='??0colour@CEGUI@@QAE@I@Z':
  argb=read(sp+4);assert argb==0xffffff
  floating(this,1,1,1,0);finish(4,this)
 elif '??0ColourRect' in n or 'setColours' in n:
  colour=floats(read(sp+4));floating(this,*(colour*4));finish(4,this)
 elif 'setAlpha@ColourRect' in n:
  value=floats(sp+4,1)[0]
  for off in [12,28,44,60]:floating(this+off,value)
  finish(4)
 elif '??0Rect' in n:
  left,top,right,bottom=floats(sp+4);floating(this,top,bottom,left,right);finish(16,this)
 elif 'draw@Image' in n:
  dest,z,clip,colours=[read(sp+v*4) for v in range(1,5)]
  events.append({'part':'background' if this==BACKGROUND else 'fill','dest':floats(dest),'clip':floats(clip),'colours':floats(colours,16)})
  finish(28)
 else:raise AssertionError(n)
uc.hook_add(UC_HOOK_CODE,hook)
word(STACK,RETURN);uc.reg_write(UC_X86_REG_ESP,STACK)
uc.emu_start(0x1003ac20,RETURN,count=1000)
assert floats(0x10077084)==[1,1,1,0]
rows=[]
for vertical,width,height in [(False,179,28),(True,14,33)]:
 for scale in [1,1.8,3.6]:
  for progress in [0,.2,.33999997,.34,.5,.66999996,.67,.8,1]:
   for alpha in [1,.5]:
    rect=[0,f32(height*scale),0,f32(width*scale)]
    effective_alpha=alpha
    word(OBJ+0x37c,BACKGROUND);word(OBJ+0x380,FILL);word(OBJ+0x378,int(vertical));floating(OBJ+0x328,progress)
    floating(OBJ+0x424,0,0,0,0)
    colours=[[0,1,0,1],[1,0,0,1],[1,1,0,1]] if not vertical else [[1,1,1,1]]*3
    for offset,colour in zip([0x330,0x348,0x360],colours):floating(OBJ+offset,*colour)
    tilew=round(f32(width*f32(scale)));tileh=round(f32(height*f32(scale)))
    for img in [BACKGROUND,FILL]:floating(img+0x20,tilew,tileh)
    events.clear();word(STACK,RETURN,0);uc.reg_write(UC_X86_REG_ESP,STACK);uc.reg_write(UC_X86_REG_ECX,OBJ)
    uc.emu_start(0x1001bff0,RETURN,count=50000)
    assert uc.reg_read(UC_X86_REG_EIP)==RETURN
    fills=[e for e in events if e['part']=='fill'];assert fills
    band='low' if f32(progress)<f32(.34) else 'medium' if f32(progress)<f32(.67) else 'high'
    expected=colours[{'high':0,'low':1,'medium':2}[band]][:3]+[alpha]
    assert fills[0]['colours'][:4]==expected,(progress,fills[0],expected)
    extent=int((rect[1] if vertical else rect[3])*f32(progress)+.5)
    clip=[rect[1]-extent,rect[1],0,rect[3]] if vertical else [0,rect[1],0,extent]
    assert all(e['clip']==clip for e in fills),(fills,clip)
    rows.append({'vertical':vertical,'scale':scale,'progress':f32(progress),'alpha':alpha,'band':band,'tile':[tilew,tileh],'extent':extent,'draws':list(events)})
binary=images['ceguiwindowslook.dll'].get_memory_mapped_image();md=capstone.Cs(capstone.CS_ARCH_X86,capstone.CS_MODE_32)
result={'status':'PASS','entry':'0x1001bff0','rows':rows,'scope':'Complete original WindowsLook drawSelf executes to return: tiling, integer clip extent and low/medium/high selection. Window outer/unclipped rectangle, original image auto-scaled pixel sizes, effective alpha, original static initializer1003ac20 with Colour(00FFFFFF) constructor provider, ColourRect/Rect and final Image draw are providers; no GPU/display execution. Compiler conversion provider truncates positive adjusted float.'}
(ROOT/'recovery/output/life-draw-native.json').write_text(json.dumps(result,indent=2)+'\n')
print('PASS',len(rows),'original progress draw vectors')
# EXE ratio arguments feed the actual CEGUI setter and its range clamp.
u,pe=map_original_binaries([ROOT/'CDTank/CDTank.exe',ROOT/'CDTank/CEGUIBase.dll'])
u.mem_map(0,4096);u.mem_map(0x2000000,0x100000)
O,R,V,F,S,P,C= [0x2001000+n*0x2000 for n in range(7)]
GETTER,EVENT=0x2020000,0x2020100
maximum=300;setter_events=[]
def w(a,*v):u.mem_write(a,struct.pack('<'+'I'*len(v),*v))
def rf(a):return struct.unpack('<f',u.mem_read(a,4))[0]
def h(machine,a,size,data):
 sp=machine.reg_read(UC_X86_REG_ESP)
 if a==GETTER:
  assert struct.unpack('<I',machine.mem_read(sp+4,4))[0]==16
  machine.reg_write(UC_X86_REG_EAX,maximum);machine.reg_write(UC_X86_REG_EIP,struct.unpack('<I',machine.mem_read(sp,4))[0]);machine.reg_write(UC_X86_REG_ESP,sp+8)
 elif a==EVENT:
  setter_events.append('changed');machine.reg_write(UC_X86_REG_EIP,struct.unpack('<I',machine.mem_read(sp,4))[0]);machine.reg_write(UC_X86_REG_ESP,sp+8)
u.hook_add(UC_HOOK_CODE,h)
w(R,V);w(V+0x14,GETTER);w(P,V);w(V+0x14c,EVENT,EVENT);w(R+0x14,R);w(R+0x18,P);w(O+0xcc,P)
ratio_rows=[]
for maximum in [300,777]:
 for hp in [0,1,102,150,201,299,maximum,maximum+100]:
  for local in [False,True]:
   u.mem_write(P+0x328,struct.pack('<f',-.5));setter_events.clear()
   w(F+0xc,hp);w(F-0x10,hp) # f32 HP supplied only for the isolated local tail.
   u.mem_write(F-0x10,struct.pack('<f',hp))
   w(S,C);u.reg_write(UC_X86_REG_ESP,S);u.reg_write(UC_X86_REG_EBP,F);u.reg_write(UC_X86_REG_ESI,R);u.reg_write(UC_X86_REG_EDI,O)
   entry,end=(0x4cee89,0x4ceeac) if local else (0x4ced39,0x4ced5f)
   u.emu_start(entry,end,count=10000)
   fraction=rf(P+0x328);expected=min(1,max(0,f32(f32(hp)/maximum)))
   assert fraction==expected
   ratio_rows.append({'hp':hp,'maxHp':maximum,'local':local,'fraction':fraction,'events':list(setter_events)})
# Original constructor tail sets all three ProgressBar colours to ARGB FFFFFFFF.
w(S,C);u.reg_write(UC_X86_REG_ESP,S);u.reg_write(UC_X86_REG_ESI,P);u.reg_write(UC_X86_REG_EBX,P+0x330);u.reg_write(UC_X86_REG_EBP,P+0x348)
u.emu_start(0x10096974,0x10096993,count=1000)
defaults=[list(struct.unpack('<4f',u.mem_read(P+off,16))) for off in [0x330,0x348,0x360]]
assert defaults==[[1,1,1,1]]*3
result['ratioRows']=ratio_rows;result['defaultColours']=defaults
result['ratioScope']='Original remote4ced39..4ced5f and local4cee89..4ceeac tails execute actual CEGUI setProgress10096620 including clamp. Role maximum getter and change/completion observers are providers; raw current HP callback/local earlier conversion are supplied. Original ProgressBar constructor colour initialization tail10096974..10096993 executes.'
(ROOT/'recovery/output/life-draw-native.json').write_text(json.dumps(result,indent=2)+'\n')
print('PASS',len(ratio_rows),'HP ratio/setProgress vectors and original white default colours')
