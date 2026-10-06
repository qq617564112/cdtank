"""Execute original multiline layout and scrollbar constructor defaults."""
import json
from pathlib import Path
import struct
import sys
import capstone
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import *
ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0,str(ROOT/'recovery'))
from effect_native import map_original_binaries
OBJ,VERT,HORIZ,STACK,RETURN = 0x2001000,0x2002000,0x2003000,0x2080000,0x2090000
uc,images=map_original_binaries([ROOT/'CDTank/CEGUIWindowsLook.dll'])
uc.mem_map(0x2000000,0x100000)
def put(a,*v):uc.mem_write(a,struct.pack('<'+'I'*len(v),*v))
def read(a):return struct.unpack('<I',uc.mem_read(a,4))[0]
def f(a):return struct.unpack('<f',uc.mem_read(a,4))[0]
def fs(a,v):uc.mem_write(a,struct.pack('<f',v))
def arg(i=0):return read(uc.reg_read(UC_X86_REG_ESP)+4+4*i)
def ret(cleanup,eax=None):
 sp=uc.reg_read(UC_X86_REG_ESP)
 if eax is not None:uc.reg_write(UC_X86_REG_EAX,eax)
 uc.reg_write(UC_X86_REG_EIP,read(sp));uc.reg_write(UC_X86_REG_ESP,sp+4+cleanup)
sizeCalls=[];positions=[];width=724;height=379
hooks={}
def setsize():
 child=uc.reg_read(UC_X86_REG_ECX);ptr=arg(1);w,h=f(ptr),f(ptr+4)
 sizeCalls.append({'child':'vertical' if child==VERT else 'horizontal','metricsMode':arg(),'relative':[w,h]})
 for off,val in [(0xe4,0),(0xe8,h*height),(0xec,0),(0xf0,w*width)]:fs(child+off,val)
 ret(8)
def convert():
 out,source=arg(),arg(1);fs(out,f(source)/width);fs(out+4,f(source+4)/height);ret(8,out)
def visible():ret(0,int(uc.reg_read(UC_X86_REG_ECX)==VERT))
def position():
 ptr=arg(1);positions.append({'child':'vertical' if uc.reg_read(UC_X86_REG_ECX)==VERT else 'horizontal','relative':[f(ptr),f(ptr+4)],'metricsMode':arg()});ret(8)
for address,callback in [(0x1003d4f4,setsize),(0x1003d37c,convert),(0x1003d36c,visible),(0x1003d4dc,position)]:
 target=0x2091000+len(hooks)*16;put(address,target);hooks[target]=callback
uc.hook_add(UC_HOOK_CODE,lambda u,a,s,d:hooks[a]() if a in hooks else None)
put(OBJ+0x35c,VERT,HORIZ)
vectors=[]
for scale in [1,1.8,3.6]:
 width,height=724*scale,379*scale
 for off,val in [(0xe4,0),(0xe8,height),(0xec,0),(0xf0,width)]:fs(OBJ+off,val)
 sizeCalls.clear();positions.clear();put(STACK,RETURN)
 uc.reg_write(UC_X86_REG_ECX,OBJ);uc.reg_write(UC_X86_REG_ESP,STACK)
 uc.emu_start(0x1001a750,RETURN,count=10000)
 assert uc.reg_read(UC_X86_REG_EIP)==RETURN
 assert abs(sizeCalls[0]['relative'][0]-.05)<1e-7 and sizeCalls[0]['relative'][1]==1
 assert abs(positions[0]['relative'][0]-.95)<1e-7 and positions[0]['relative'][1]==0, positions
 vectors.append({'scale':scale,'providerPixelBody':[width,height],'sizes':sizeCalls[:],'positions':positions[:]})
# Execute only the original constructor's default assignment block.
base,baseImages=map_original_binaries([ROOT/'CDTank/CEGUIBase.dll'])
base.mem_map(0x2000000,0x100000)
base.reg_write(UC_X86_REG_ESI,OBJ);base.reg_write(UC_X86_REG_ESP,STACK);base.reg_write(UC_X86_REG_EBP,STACK+128)
base.emu_start(0x1009f2af,0x1009f2f8,count=1000)
def defaults(offset):return struct.unpack('<f',base.mem_read(OBJ+offset,4))[0]
assert defaults(0x33c)==10 and defaults(0x330)==1
source=json.loads((ROOT/'recovery/output/history-intro-content-source.json').read_text())
properties=next(w for w in source['layout']['windows'] if w['name']=='edtMainText')['properties']
assert 'VertScrollbarThumbMinExtent' not in properties
pe=images['ceguiwindowslook.dll'];code=capstone.Cs(capstone.CS_ARCH_X86,capstone.CS_MODE_32)
assembly=[{'va':hex(i.address),'asm':i.mnemonic+' '+i.op_str,'bytes':i.bytes.hex()} for i in code.disasm(pe.get_data(0x1001a750-pe.OPTIONAL_HEADER.ImageBase,0x17e),0x1001a750)]
result={'status':'PASS_ORIGINAL_MULTILINE_SCROLL_LAYOUT_DEFAULTS','tasks':['UI-23','M5-15'],'layout':'history.xml/edtMainText','nativeLayout':'CEGUIWindowsLook.dll 0x1001a750','nativeDefaultBlock':'CEGUIBase.dll 0x1009f2af..0x1009f2f8','bodyLogicalSize':[724,379],'defaultMinimumThumbPhysicalPixels':defaults(0x33c),'defaultStep':defaults(0x330),'relativeVerticalSize':[.05,1],'relativeVerticalPosition':[.95,0],'vectors':vectors,'sourceProperties':properties,'assembly':assembly,'providers':['Window setSize/absoluteToRelative/visibility/position and pixel dimensions are explicit providers','Constructor block executes default assignments only; parent constructor and child creation are not claimed'],'limits':['DOM text extent and selected attachment font are Web presentation providers','Original framebuffer and full event scheduling remain unverified']}
(ROOT/'recovery/output/history-intro-scroll-native.json').write_text(json.dumps(result,indent=2)+'\n')
print(result['status'],'minimum10','3scales')
