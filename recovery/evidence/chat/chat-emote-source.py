"""Execute bounded original battle emote selection, parsing and glyph encoding."""
import json
from pathlib import Path
import re
import struct
import sys
import xml.etree.ElementTree as ET
import capstone
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import *
ROOT=Path(__file__).resolve().parents[3]
sys.path.insert(0,str(ROOT/'recovery'))
from effect_native import map_original_binaries
uc,images=map_original_binaries([ROOT/'CDTank/CDTank.exe'])
uc.mem_map(0,0x1000)
uc.mem_map(0x2000000,0x50000)
HUD,EVENT,FRAME,STACK,RETURN,CHAR,INPUT,OUTPUT=[0x2001000+i*0x2000 for i in range(8)]
APPEND,ERASE,INSERT,FORMAT,CHILD,ADD,FRONT,REMOVE=[0x2030000+i*0x100 for i in range(8)]
def write(a,*v):uc.mem_write(a,struct.pack('<'+'I'*len(v),*v))
def read(a):return struct.unpack('<I',uc.mem_read(a,4))[0]
def finish(pop=0,value=0):
 sp=uc.reg_read(UC_X86_REG_ESP)
 uc.reg_write(UC_X86_REG_EAX,value);uc.reg_write(UC_X86_REG_EIP,read(sp));uc.reg_write(UC_X86_REG_ESP,sp+4+pop)
events=[]
def hook(machine,a,size,data):
 sp=machine.reg_read(UC_X86_REG_ESP)
 if a==0x57b224:
  value=int(bytes(machine.mem_read(read(sp+4),3)).split(b'\0')[0]);finish(value=value)
 elif a==0x57c0d6:
  dest,capacity,fmt,n=[read(sp+i*4) for i in range(1,5)]
  template=bytes(machine.mem_read(fmt,100)).split(b'\0')[0].decode();value=template.replace('%.3d','%03d')%n
  machine.mem_write(dest,value.encode()+b'\0');events.append(dict(kind='format',template=template,value=value));finish(value=len(value))
 elif a in [APPEND,ERASE,INSERT]:
  args=[read(sp+i*4) for i in range(1,({APPEND:1,ERASE:2,INSERT:3}[a])+1)]
  events.append(dict(kind={APPEND:'pushBack',ERASE:'erase',INSERT:'insert'}[a],arguments=args));finish({APPEND:4,ERASE:8,INSERT:12}[a])
 elif a==CHILD:finish(4,attached)
 elif a in [ADD,REMOVE]:events.append(dict(kind='add' if a==ADD else 'remove',control=machine.reg_read(UC_X86_REG_ECX),child=read(sp+4)));finish(4)
 elif a in [FRONT,0x4d650b]:finish()
for a in [0x57b224,0x57c0d6,APPEND,ERASE,INSERT,CHILD,ADD,REMOVE,FRONT,0x4d650b]:uc.hook_add(UC_HOOK_CODE,hook,begin=a,end=a)
for a,stub in [(0x5c021c,APPEND),(0x5c0234,ERASE),(0x5c0238,INSERT),(0x5c024c,CHILD),(0x5c0220,ADD),(0x5c0228,REMOVE),(0x5c0244,FRONT)]:write(a,stub)
write(HUD+0x84,0x2021000);write(HUD+0x698,0x2022000)
open_rows=[]
for attached in [0,1]:
 events.clear();write(STACK,RETURN,EVENT);uc.reg_write(UC_X86_REG_ESP,STACK);uc.reg_write(UC_X86_REG_ECX,HUD)
 uc.emu_start(0x4cc5cc,RETURN,count=300)
 assert [e['kind'] for e in events]==(['add'] if not attached else [])
 open_rows.append(dict(alreadyAttached=bool(attached),events=events[:]))
selection=[]
for i in range(30):
 write(HUD+0x69c+i*4,0x2023000+i*0x100)
for i in range(30):
 write(EVENT+8,read(HUD+0x69c+i*4));write(FRAME+8,EVENT)
 uc.reg_write(UC_X86_REG_EBP,FRAME);uc.reg_write(UC_X86_REG_ESI,HUD);uc.reg_write(UC_X86_REG_ESP,STACK)
 uc.emu_start(0x4cc2e7,0x4cc31a,count=200)
 assert uc.reg_read(UC_X86_REG_EBX)==i
 events.clear();uc.reg_write(UC_X86_REG_ESP,STACK);uc.reg_write(UC_X86_REG_EBX,i);uc.reg_write(UC_X86_REG_EBP,FRAME)
 uc.emu_start(0x4cc509,0x4cc51c,count=20)
 assert events==[dict(kind='pushBack',arguments=[0x2581+i])]
 selection.append(dict(button=i+1,codepoint=hex(0x2581+i),events=events[:]))
parsed=[]
for n in [0,1,9,10,30,31,39]:
 text=f'{n:02d}';uc.mem_write(CHAR,struct.pack('<II',ord(text[0]),ord(text[1])))
 write(FRAME-0x14,CHAR-4);write(FRAME-0x20,CHAR+8);write(FRAME-0x1c,HUD)
 uc.reg_write(UC_X86_REG_EBP,FRAME);uc.reg_write(UC_X86_REG_ESI,CHAR);uc.reg_write(UC_X86_REG_EBX,CHAR+4);uc.reg_write(UC_X86_REG_ESP,STACK)
 events.clear();uc.emu_start(0x4cb223,0x4cb277,count=100)
 assert [e['kind'] for e in events]==(['erase','insert'] if 1<=n<=30 else [])
 if events:assert events[-1]['arguments'][-1]==0x2580+n
 parsed.append(dict(typedToken='/'+text,events=events[:]))
# Run original glyph-specific send encoding; no locale conversion supplied.
encoded=[]
for n in range(1,31):
 write(INPUT,1,0x20);write(INPUT+0x14,0x2580+n)
 write(STACK,RETURN,INPUT,OUTPUT,256);uc.reg_write(UC_X86_REG_ESP,STACK)
 uc.emu_start(0x4119b0,RETURN,count=200)
 raw=bytes(uc.mem_read(OUTPUT,3));assert raw==bytes([0xa2,0x61+n,0])
 encoded.append(dict(emote=n,wire=raw[:2].hex()))
# Original font naming block formats the glyph id to its exact source image.
font=[]
for n in range(1,31):
 events.clear();uc.reg_write(UC_X86_REG_EBX,0x2580+n);uc.reg_write(UC_X86_REG_EBP,FRAME);uc.reg_write(UC_X86_REG_ESP,STACK)
 uc.emu_start(0x45449a,0x4544b7,count=40)
 assert events[0]['value']==f'data\\ui\\biaoqingfuhao\\{n:03d}.tga'
 font.append(dict(emote=n,codepoint=hex(0x2580+n),image=events[0]['value']))
binary=images['cdtank.exe'].get_memory_mapped_image();md=capstone.Cs(capstone.CS_ARCH_X86,capstone.CS_MODE_32)
ranges=[(0x4c9c2e,0x4c9c68),(0x4ca597,0x4ca62f),(0x4d54a2,0x4d54d4),(0x4d555c,0x4d55aa),
 (0x4cc5cc,0x4cc620),(0x4cc2c2,0x4cc31a),(0x4cc471,0x4cc5cc),(0x4cb169,0x4cb2f5),
 (0x4119b0,0x411a6b),(0x45448e,0x4544ff),(0x4124ab,0x412589),(0x4127e4,0x412806),(0x48ea66,0x48ead4)]
imageset_path=ROOT/'recovery/output/verified/assets/data/Data/ui/imagesets/biaoqingfuhao_0.imageset'
assets=[dict(i.attrib) for i in ET.parse(imageset_path).getroot().findall('Image')]
result=dict(status='PASS',open=open_rows,selection=selection,typedParsing=parsed,glyphWire=encoded,fontImages=font,
 sourceImages=assets,richEditNextEntries=dict(binary='CDTank/CEGUIWindowsLook.dll',onTextChanged='0x10027980',formatText='0x10027370',formatTextImpl='0x10026c10',renderTextLines='0x100243e0',updateSelf='0x10024920'),displayTag=dict(prefix='<emote name=',format='%.3d',suffix=' red=255 green=255 blue=255 alpha=255/>'),
 execution='Bounded original open callback, all30 button search/append blocks, typed-token conversion block, complete glyph-only send conversion and font image naming. CEGUI imports supplied. Received markup expansion is static disassembly.',
 unproven=['CEGUIWindowsLook RichEditbox emote parser/frame scheduler and exact animated frame timing',
 'Original Editbox max-length rejection when emote is inserted into a full field',
 'Complete mixed locale text byte conversion and original server emote handling'],
 disassembly={hex(a):[f'{i.address:08x} {i.mnemonic} {i.op_str}' for i in md.disasm(binary[a-0x400000:z-0x400000],a)] for a,z in ranges})
(ROOT/'recovery/output/chat-emote-source.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print('PASS: 30 selected glyphs, typed /NN, original glyph wire and exact source image mapping')
