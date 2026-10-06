"""Execute original waiting StaticText defaults and draw consumers."""
import json, re, struct, sys
from pathlib import Path
import capstone
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_EAX, UC_X86_REG_ECX, UC_X86_REG_EIP, UC_X86_REG_ESI, UC_X86_REG_EBP, UC_X86_REG_ESP
ROOT=Path(__file__).resolve().parents[3]
sys.path.insert(0,str(ROOT/'recovery'))
from effect_native import map_original_binaries
uc,images=map_original_binaries([ROOT/'CDTank/CDTank.exe',ROOT/'CDTank/CEGUIBase.dll'])
uc.mem_map(0,4096);uc.mem_map(0x2000000,0x100000)
OBJ,VTABLE,SYSTEM,FONT,AREA,CLIP,LOCAL=0x2001000,0x2003000,0x2004000,0x2005000,0x2006000,0x2006100,0x2007000
STACK,END=0x2080000,0x2090000
captures=[];default_names=[]
def w(p,*v):uc.mem_write(p,struct.pack('<'+'I'*len(v),*v))
def r(p):return struct.unpack('<I',uc.mem_read(p,4))[0]
def fs(p,*v):uc.mem_write(p,struct.pack('<'+'f'*len(v),*v))
def fr(p,n=4):return list(struct.unpack('<'+'f'*n,uc.mem_read(p,4*n)))
def ret(n=0,value=None):
 sp=uc.reg_read(UC_X86_REG_ESP)
 if value is not None:uc.reg_write(UC_X86_REG_EAX,value)
 uc.reg_write(UC_X86_REG_EIP,r(sp));uc.reg_write(UC_X86_REG_ESP,sp+4+n)
def call(a,obj=OBJ,args=()):
 w(STACK,END,*args);uc.reg_write(UC_X86_REG_ECX,obj);uc.reg_write(UC_X86_REG_ESP,STACK)
 uc.emu_start(a,END,count=50000);assert uc.reg_read(UC_X86_REG_EIP)==END
base=images['ceguibase.dll'];exports={s.name.decode():0x10000000+s.address for s in base.DIRECTORY_ENTRY_EXPORT.symbols if s.name}
string_ctor=exports['??0String@CEGUI@@QAE@PBE@Z'];font_get=exports['?getFont@FontManager@CEGUI@@QBEPAVFont@2@ABVString@2@@Z']
def hook(_uc,p,size,user):
 sp=uc.reg_read(UC_X86_REG_ESP)
 if p==string_ctor:
  pointer=r(sp+4);raw=bytes(uc.mem_read(pointer,32)).split(b'\0')[0].decode();default_names.append(raw)
  w(uc.reg_read(UC_X86_REG_ECX),pointer);ret(4,uc.reg_read(UC_X86_REG_ECX))
 elif p==font_get:
  assert default_names[-1]=='SIMSUN';ret(4,FONT)
 elif p==0x2091200:ret(12)
 elif p in [0x100ada30,0x100b10d0]:ret(8 if p==0x100ada30 else 0)
 elif p==0x100ad480:ret(4)
 elif p in [0x2091000,0x2091100]:
  dest=r(sp+4);uc.mem_write(dest,bytes(uc.mem_read(AREA if p==0x2091000 else CLIP,16)));ret(4,dest)
 elif p==0x100119c0:ret(16,1)
 elif p==0x10013030:
  captures.append({'textArea':fr(r(sp+8)),'clip':fr(r(sp+16)),'format':r(sp+20),'cornersARGB':[fr(r(sp+24)+24*i) for i in range(4)],'scale':[fr(sp+28,1)[0],fr(sp+32,1)[0]],'font':hex(uc.reg_read(UC_X86_REG_ECX))});ret(32)
uc.hook_add(UC_HOOK_CODE,hook)
w(0x10197ca8,SYSTEM);w(SYSTEM,LOCAL+0x800);w(LOCAL+0x800+0x14,0x2091200);w(SYSTEM+0x18,LOCAL);fs(LOCAL+0x14,1);fs(FONT+0xbc,16)
# Execute the actual application call sequence to its original System setter.
uc.reg_write(UC_X86_REG_EBP,LOCAL+0x400);w(LOCAL+0x400-0x44,LOCAL+0x500);uc.reg_write(UC_X86_REG_ESP,STACK)
uc.emu_start(0x454202,0x454236,count=10000)
assert r(SYSTEM+0x20)==FONT
# Static base construction is a provider; StaticText defaults/colour construction are original.
call(0x100b1580,args=(0,0));defaults={'horizontal':r(OBJ+0x4a4),'vertical':r(OBJ+0x4a8),'cornersARGB':[fr(OBJ+0x4ac+i*24) for i in range(4)]}
assert defaults=={'horizontal':0,'vertical':2,'cornersARGB':[[1,1,1,1]]*4},defaults
w(OBJ,VTABLE);w(VTABLE+0xe8,0x2091000);w(VTABLE+4,0x2091100);w(OBJ+0x40,0)
font_rows=[]
for explicit in [0,FONT+0x100]:
 w(OBJ+0x40,explicit);call(0x10030e50);actual=uc.reg_read(UC_X86_REG_EAX);assert actual==(explicit or FONT);font_rows.append({'explicit':hex(explicit),'actual':hex(actual)})
w(OBJ+0x40,0)
ui=json.loads((ROOT/'recovery/output/web-assets/ui.json').read_text());layout=next(l for l in ui['layouts'] if l['path'].endswith('room_main.xml'))
rows=[];formats={'LeftAligned':0,'RightAligned':1,'HorzCentred':2};verticals={'TopAligned':0,'BottomAligned':1,'VertCentred':2}
for control in [c for c in layout['windows'] if c['type']=='WindowsLook/StaticText']:
 props=control['properties'];assert 'Font' not in props and 'TextColours' not in props,control['name']
 box=list(map(float,re.findall(r'-?\d+(?:\.\d+)?',props['AbsoluteRect'])));width,height=box[2]-box[0],box[3]-box[1]
 w(OBJ+0x4a4,formats[props.get('HorzFormatting','LeftAligned')]);w(OBJ+0x4a8,verticals[props.get('VertFormatting','VertCentred')]);w(OBJ+0x50c,0,0)
 for alpha in [1,.5]:
  for clipped in [False,True]:
   fs(OBJ+0xe0,alpha);fs(AREA,0,height,0,width);fs(CLIP,*( [1,height-1,2,width-2] if clipped else [0,height,0,width]))
   call(0x100b0db0,args=(struct.unpack('<I',struct.pack('<f',1))[0],));row=captures[-1]
   expected=[1,height-1,2,width-2] if clipped else [0,height,0,width]
   assert row['clip']==expected and row['cornersARGB']==[[alpha,1,1,1]]*4 and row['font']==hex(FONT),row
   row.update(control=control['name'],outer=[0,0,width,height],effectiveAlpha=alpha,clipped=clipped,horizontal=props.get('HorzFormatting','LeftAligned'),vertical=props.get('VertFormatting','VertCentred'))
   rows.append(row)
output={'status':'PASS','defaultFont':'SIMSUN','applicationDefaultEntry':'0x454202..0x454236','defaults':defaults,'fontRows':font_rows,'drawRows':rows,'scope':'Original application default-font call sequence, StaticText defaults, colour constructors, Window font getter and complete StaticText drawSelf through Font::drawText boundary. Static background/rectangles, String construction and FontManager name lookup, lineCount=1/lineSpacing=16 and System font-change event callback are providers; original font glyph layout/OS/GPU are not executed.'}
(ROOT/'recovery/output/waiting-room-static-text-native.json').write_text(json.dumps(output,indent=2)+'\n')
md=capstone.Cs(capstone.CS_ARCH_X86,capstone.CS_MODE_32);parts=[]
for dll,ranges in [('CDTank.exe',[(0x454202,0x454236)]),('CEGUIBase.dll',[(0x100b1580,0x100b1632),(0x100b0db0,0x100b10aa),(0x10030e50,0x10030e60),(0x1002c880,0x1002c8b0)])]:
 pe=images[dll.lower()];binary=pe.get_memory_mapped_image();base=pe.OPTIONAL_HEADER.ImageBase;parts.append(dll)
 for a,z in ranges:parts.extend(f'{i.address:08x} {i.mnemonic} {i.op_str}' for i in md.disasm(binary[a-base:z-base],a))
(ROOT/'recovery/output/waiting-room-static-text-native.disasm.txt').write_text('\n'.join(parts)+'\n')
print('PASS:',len(rows),'original waiting StaticText draw vectors/default SIMSUN')
