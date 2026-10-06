"""Execute original MediumHT mapping, metrics and missing-ASCII text consumers."""
import json
from pathlib import Path
import struct
import sys
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import *
ROOT=Path(__file__).resolve().parents[3]
sys.path.insert(0,str(ROOT/'recovery'))
from effect_native import map_original_binaries
u,_=map_original_binaries([ROOT/'CDTank/CEGUIBase.dll']);u.mem_map(0,4096);u.mem_map(0x2000000,0x100000)
FONT,TEXT,HEAD,NODE,IMAGE,STACK,END,RESULT,POSITION,CLIP,COLOUR=[0x2001000+i*0x1000 for i in range(11)]
def w(p,*v):u.mem_write(p,struct.pack('<'+'I'*len(v),*v))
def r(p):return struct.unpack('<I',u.mem_read(p,4))[0]
def fs(p,*v):u.mem_write(p,struct.pack('<'+'f'*len(v),*v))
def f(p):return struct.unpack('<f',u.mem_read(p,4))[0]
def ret(pop=0,value=0):
 sp=u.reg_read(UC_X86_REG_ESP);u.reg_write(UC_X86_REG_EAX,value);u.reg_write(UC_X86_REG_EIP,r(sp));u.reg_write(UC_X86_REG_ESP,sp+4+pop)
def invoke(a,args=(),obj=FONT,float_result=False):
 w(STACK,END,*args);u.reg_write(UC_X86_REG_ESP,STACK);u.reg_write(UC_X86_REG_ECX,obj)
 if float_result:u.mem_write(END,b'\xd9\x1d'+struct.pack('<I',RESULT));u.emu_start(a,END+6,count=10000);return f(RESULT)
 
 try:u.emu_start(a,END,count=10000)
 except Exception:
  print('EIP',hex(u.reg_read(UC_X86_REG_EIP)), 'ESP',hex(u.reg_read(UC_X86_REG_ESP)));raise
ui=json.loads((ROOT/'recovery/output/web-assets/ui-fonts.json').read_text());source=next(f for f in ui['fonts']if f['name']=='MediumHT')
glyphs={};lookup=[];draws=[];current_key=0
for i,g in enumerate(source['glyphs']):
 node=NODE+i*0x100;image=IMAGE+i*0x100;w(node+0x10,image);w(node+0x14,g['width']);u.mem_write(node+0x1c,b'\1');fs(image+0x20,g['width'],g['height'],0,0);glyphs[g['codepoint']]=(node,image,g)
w(FONT+4,HEAD);fs(FONT+0xbc,14);fs(POSITION,0,0,0);fs(CLIP,0,17,0,32)
def hook(machine,a,size,data):
 global current_key
 sp=machine.reg_read(UC_X86_REG_ESP)
 if a==0x1000dea0:
  current_key=r(r(sp+8));lookup.append(current_key);w(r(sp+4),glyphs.get(current_key,(HEAD,))[0]);ret(8,r(sp+4))
 elif a==0x100fddb8:
  # Original CRT float-to-integer endpoint for appendCharacter advance.
  u.mem_write(RESULT+0x200,b'\xdb\x1d'+struct.pack('<I',RESULT+0x300)+b'\xa1'+struct.pack('<I',RESULT+0x300)+b'\xc3');u.reg_write(UC_X86_REG_EIP,RESULT+0x200)
 elif a==0x1000d250:
  iterator=u.reg_read(UC_X86_REG_ECX);old=r(iterator);w(iterator,old+0x100 if old<NODE+9*0x100 else HEAD);ret()
 elif a==0x1000fc80:ret(4,NODE+0xf00)
 elif a==0x10018780:
  box=r(sp+4);draws.append({'codepoint':current_key,'rect':[f(box+8),f(box),f(box+12),f(box+4)],'clip':hex(r(sp+8)),'colour':hex(r(sp+12))});ret(28)
u.hook_add(UC_HOOK_CODE,hook)
# Execute static metrics scan over actual supplied image bounds; map iterator endpoint is explicit.
# Image offset0 makes baseline0; maximum source image height14 yields line spacing14.
metric_rows=[]
for c in source['glyphs']:
 invoke(0x10010d60,[c['codepoint'],glyphs[c['codepoint']][1],1]);node=NODE+0xf00
 assert r(node)==glyphs[c['codepoint']][1] and r(node+4)==c['width'] and r(node+8)==c['width']
 metric_rows.append({'codepoint':c['codepoint'],'image':c['asset'],'width':c['width'],'height':c['height'],'advance':r(node+4)})
# Original static font image-bound metrics scan, ending before its caller epilogue.
w(HEAD,NODE);u.reg_write(UC_X86_REG_ESI,FONT);u.reg_write(UC_X86_REG_EAX,0);u.reg_write(UC_X86_REG_ESP,STACK);fs(STACK+8,1)
u.emu_start(0x1000de03,0x1000de94,count=10000)
assert f(FONT+0xc0)==0 and f(FONT+0xbc)==14
rows=[]
for text in ['R1','R10','R123','R9999','R','A1','123']:
 lookup.clear();draws.clear();w(TEXT,len(text),32);w(TEXT+0x14,*map(ord,text))
 extent=invoke(0x10011130,[TEXT,0x3f800000],float_result=True)
 invoke(0x10011440,[TEXT,POSITION,CLIP,COLOUR,0x3f800000,0x3f800000])
 expected=[ord(c)for c in text if c.isdigit()];assert [d['codepoint']for d in draws]==expected
 advance=sum(glyphs[c][2]['width']for c in expected);assert extent==advance
 assert all(d['rect'][1]==0 and d['rect'][3]==14 for d in draws)
 rows.append({'text':text,'extent':extent,'draws':list(draws),'lookup':list(lookup),'unknownASCII':'zero draw and zero advance'})
result={'status':'PASS','font':source,'mappingVectors':metric_rows,'textVectors':rows,'entries':{'append':'0x10010d60','extent':'0x10011130','drawLine':'0x10011440'},'metrics':{'baseline':0,'lineSpacing':14,'source':'Original executed Static image height/offset scan 0x1000de20..0x1000de89; image glyph bounds supplied from original imageset'},'providers':'Glyph map lookup/insert, source image objects, empty colour/render endpoint and CRT ftol; original append, missing-ASCII branches, extent/advance and draw rectangles execute.'}
(ROOT/'recovery/output/room-card-id-font-native.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');print('PASS: ten original mapping advances and seven original text extent/draw vectors')
