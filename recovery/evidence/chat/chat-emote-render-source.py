"""Observe original SequenceImage clock/draw and retain RichEditbox consumer sources."""
import json
from pathlib import Path
import struct
import xml.etree.ElementTree as ET
import capstone
import pefile
from unicorn import Uc, UC_ARCH_X86, UC_MODE_32, UC_HOOK_CODE
from unicorn.x86_const import *
ROOT=Path(__file__).resolve().parents[3]
ASSETS=ROOT/'recovery/output/verified/assets/data/Data/ui'
base_pe=pefile.PE(str(ROOT/'CDTank/CEGUIBase.dll'))
base_binary=base_pe.get_memory_mapped_image()
uc=Uc(UC_ARCH_X86,UC_MODE_32)
uc.mem_map(0x10000000,(len(base_binary)+0xfff)&~0xfff);uc.mem_write(0x10000000,base_binary)
uc.mem_map(0x2000000,0x100000)
SEQ,FRAMES,STACK,RETURN=0x2001000,0x2004000,0x2080000,0x2090000

def write(a,*v):uc.mem_write(a,struct.pack('<'+'I'*len(v),*[n&0xffffffff for n in v]))
def read(a):return struct.unpack('<I',uc.mem_read(a,4))[0]
def f32(a,v):uc.mem_write(a,struct.pack('<f',v))
def float_at(a):return struct.unpack('<f',uc.mem_read(a,4))[0]
rendered=[]
def hook(machine,a,size,data):
 rendered.append((machine.reg_read(UC_X86_REG_ECX)-FRAMES)//0xcc)
 sp=machine.reg_read(UC_X86_REG_ESP)
 machine.reg_write(UC_X86_REG_EIP,read(sp));machine.reg_write(UC_X86_REG_ESP,sp+4+0x1c)
uc.hook_add(UC_HOOK_CODE,hook,begin=0x10018780,end=0x10018780)
def invoke(a,args=()):
 write(STACK,RETURN,*args);uc.reg_write(UC_X86_REG_ESP,STACK);uc.reg_write(UC_X86_REG_ECX,SEQ)
 uc.emu_start(a,RETURN,count=10000)
 assert uc.reg_read(UC_X86_REG_EIP)==RETURN

def draw():
 rendered.clear();invoke(0x10027410,(0,0,0,0,0,0,0));return rendered[:]
images={i.get('Name'):dict(i.attrib) for i in ET.parse(ASSETS/'imagesets/biaoqingfuhao_0.imageset').getroot().findall('Image')}
ui=json.loads((ROOT/'recovery/output/web-assets/ui.json').read_text())
webset=next(s for s in ui['imagesets'] if s['attributes']['Name']=='biaoqingfuhao0')
webimages={i['Name']:i.get('asset') for i in webset['images']}
rows=[]
for n in range(1,31):
 path=ASSETS/f'sequence_images/{n:03d}.seqimage';xml=ET.parse(path).getroot()
 frames=sorted([dict(i.attrib) for i in xml.findall('ImageFrame')],key=lambda i:int(i['Index']))
 assert len(frames)==int(xml.get('FrameCount'))
 write(SEQ+0x9c,FRAMES,FRAMES+len(frames)*0xcc)
 for i,frame in enumerate(frames):
  f32(FRAMES+i*0xcc+0xc8,float(frame['Duration']))
  frame['asset']=webimages[frame['Image']];frame['rectangle']=images[frame['Image']]
 invoke(0x100273c0)
 total=float_at(SEQ+0xb4)
 assert abs(total-sum(float(f['Duration']) for f in frames))<1e-5
 write(SEQ+0xac,0xffffffff);invoke(0x100270b0)
 assert draw()==[0]
 clock=[]
 for dt in [float(frames[0]['Duration']),0.0001,total,total*2]:
  invoke(0x100270c0,(struct.unpack('<I',struct.pack('<f',dt))[0],))
  clock.append(dict(delta=dt,elapsed=float_at(SEQ+0xa8),completedLoops=read(SEQ+0xb0),drawnFrameIndices=draw()))
 assert clock[0]['drawnFrameIndices']==[0]
 assert clock[1]['drawnFrameIndices']==([1] if len(frames)>1 else [0])
 # Finite resource-loop contract: RichEdit overrides this to -1.
 write(SEQ+0xac,1);invoke(0x100270b0)
 invoke(0x100270c0,(struct.unpack('<I',struct.pack('<f',total+0.001))[0],))
 assert read(SEQ+0xb0)==1 and draw()==[]
 rows.append(dict(id=n,name=xml.get('Name'),resourceLoopCount=int(xml.get('LoopCount')),
  richEditLoopCount=-1,totalDuration=total,frames=frames,clock=clock,finiteOneLoopDraws=[]))
md=capstone.Cs(capstone.CS_ARCH_X86,capstone.CS_MODE_32)
wl=pefile.PE(str(ROOT/'CDTank/CEGUIWindowsLook.dll')).get_memory_mapped_image()
exe=pefile.PE(str(ROOT/'CDTank/CDTank.exe')).get_memory_mapped_image()
ranges={'CEGUIBase.dll':[(0x100270b0,0x1002712f),(0x100273c0,0x10027402),(0x10027410,0x1002749e),(0x10028429,0x100284a6),(0x10029290,0x1002934b)],
 'CEGUIWindowsLook.dll':[(0x100263db,0x10026862),(0x10024920,0x100249a7),(0x100273c0,0x1002745b),(0x10024805,0x10024861)],
 'CDTank.exe':[(0x453951,0x453a18)]}
raw={'CEGUIBase.dll':base_binary,'CEGUIWindowsLook.dll':wl,'CDTank.exe':exe}
result=dict(status='PASS',sequences=rows,
 consumer=dict(elementStart='CEGUIWindowsLook.dll:0x100261a0',emoteNameLookup='0x100266cd',
  dimensions='SequenceImage+0xb8/+0xbc',loopOverride='0x10026735 writes -1 to SequenceImage+0xac',
  uniqueSequenceList='RichEditbox+0x478..+0x47c',update='0x10024920',draw='0x10024859'),
 execution='Original total-duration/reset/update/draw for all30 default sequences; ImageFrame rendering boundary supplied. RichEdit XML lookup/layout/lifetime paths retained as static instructions.',
 unproven=['Complete RichEditbox XML parse and mixed text/image layout execution',
  'Provider sharing phase across independently formatted controls and exact relayout reset behavior'],
 disassembly={name:{hex(a):[f'{i.address:08x} {i.mnemonic} {i.op_str}' for i in md.disasm(raw[name][a-(0x400000 if name=='CDTank.exe' else 0x10000000):z-(0x400000 if name=='CDTank.exe' else 0x10000000)],a)] for a,z in rs} for name,rs in ranges.items()})
(ROOT/'recovery/output/chat-emote-render-source.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print('PASS: all30 original sequence frame clocks, strict boundaries, single-step period subtraction and finite-loop stop')
