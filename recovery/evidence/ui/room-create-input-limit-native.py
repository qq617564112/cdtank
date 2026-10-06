"""Execute original UTF32 count, typed insertion rejection and new-text truncation."""
import json
import struct
import sys
from pathlib import Path
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import *
ROOT=Path(__file__).resolve().parents[3]
sys.path.insert(0,str(ROOT/'recovery'))
from effect_native import map_original_binaries
u,images=map_original_binaries([ROOT/'CDTank/CEGUIBase.dll'])
u.mem_map(0,4096);u.mem_map(0x2000000,0x100000)
OBJ,VT,EVENT,STACK,END,FONT,STREAM=[0x2001000+n*0x2000 for n in range(7)]
notifications=[]
def write(p,*v):u.mem_write(p,struct.pack('<'+'I'*len(v),*v))
def read(p):return struct.unpack('<I',u.mem_read(p,4))[0]
def string(p,s):
 write(p,len(s),32,0,0,0);u.mem_write(p+0x14,struct.pack('<'+'I'*(len(s)+1),*[ord(c) for c in s],0))
def text(p):return ''.join(chr(read(p+0x14+i*4)) for i in range(read(p)))
def finish(cleanup=0,value=0):
 sp=u.reg_read(UC_X86_REG_ESP);u.reg_write(UC_X86_REG_EAX,value);u.reg_write(UC_X86_REG_EIP,read(sp));u.reg_write(UC_X86_REG_ESP,sp+4+cleanup)
def arg(i=0):return read(u.reg_read(UC_X86_REG_ESP)+4+i*4)
def hook(machine,a,size,data):
 this=machine.reg_read(UC_X86_REG_ECX)
 if a in [0x10032a10,0x100323f0]:finish(4)
 elif a==0x10030d70:finish(value=1)
 elif a==0x10030e50:finish(value=FONT)
 elif a==0x1000e510:finish(4,1) # Glyph availability provider; count semantics independent.
 elif a==0x10008480:string(this,text(arg()));finish(4,this)
 elif a==0x10007310:
  s=text(this);start,count=arg(),arg(1);string(this,s[:start]+s[start+count:]);finish(8,this)
 elif a==0x1002a770:assert arg()<=32;finish(4,this) # Existing small-buffer reserve.
 elif a==0x2090000:
  destination,source,count=arg(),arg(1),arg(2);machine.mem_write(destination,bytes(machine.mem_read(source,count)));finish(value=destination)
 elif a==0x10054f10:finish(4,1)
 elif a==0x100559e0:write(OBJ+0x338,0,0);finish(4)
 elif a==0x10034d60:string(OBJ+0x44,text(arg()));finish(4)
 elif a==0x1002a740:finish()
 elif a==0x2091000:notifications.append('full');finish(4)
 elif a==0x10054d60:write(OBJ+0x338,0,0);finish(8)
 elif a==0x10054cf0:write(OBJ+0x334,arg());finish(4)
u.hook_add(UC_HOOK_CODE,hook)
write(OBJ,VT);write(VT+0x168,0x2091000);write(0x1010f0ec,0x2090000)
rows=[]
for s in ['ABC','中文房','A😀中','😀😀😀']:
 write(STREAM,*[ord(c) for c in s],0);write(STACK,END,STREAM);u.reg_write(UC_X86_REG_ESP,STACK);u.reg_write(UC_X86_REG_ECX,OBJ);u.emu_start(0x10002870,END,count=1000);actual=u.reg_read(UC_X86_REG_EAX);assert actual==len(s)
 rows.append({'kind':'UTF32count','text':s,'count':actual,'utf16Units':len(s.encode('utf-16-le'))//2})
for limit in [8,20]:
 for label,s,selected,c in [('Below','中'*(limit-1),(limit-1,limit-1),'文'),('Full','A'*limit,(limit,limit),'B'),('Replace','中'*limit,(1,3),'国'),('NonBMP','😀'*(limit-1),(limit-1,limit-1),'😀')]:
  string(OBJ+0x44,s);write(OBJ+0x330,limit,selected[1],*selected);u.mem_write(OBJ+0x328,b'\0');write(EVENT+0xc,ord(c));write(STACK,END,EVENT);notifications.clear();u.reg_write(UC_X86_REG_ESP,STACK);u.reg_write(UC_X86_REG_ECX,OBJ)
  u.emu_start(0x10058210,END,count=100000);assert u.reg_read(UC_X86_REG_EIP)==END
  actual=text(OBJ+0x44);expected=s if label=='Full' else s[:selected[0]]+c+s[selected[1]:];assert actual==expected,(label,actual,expected);assert bool(notifications)==(label=='Full')
  rows.append({'kind':'onCharacter','label':label,'limit':limit,'before':s,'selection':selected,'insert':c,'after':actual,'notifications':list(notifications)})
 for s in ['A'*(limit+3),'中'*(limit+3),'😀'*(limit+3)]:
  string(OBJ+0x44,s);write(OBJ+0x330,limit,0,0,0);write(STACK,END,EVENT);u.reg_write(UC_X86_REG_ESP,STACK);u.reg_write(UC_X86_REG_ECX,OBJ);u.emu_start(0x10056010,END,count=10000);assert u.reg_read(UC_X86_REG_EIP)==END;actual=text(OBJ+0x44);assert actual==s[:limit];assert read(OBJ+0x44+0x14+limit*4)==0
  rows.append({'kind':'onTextChanged','limit':limit,'before':s,'after':actual,'count':read(OBJ+0x44)})
result={'status':'PASS','rows':rows,'entries':{'count':'0x10002870','onCharacter':'0x10058210..return','onTextChanged':'0x10056010..return'},'contract':'UTF32 codepoint count. Ordinary single-character input first removes selection then rejects if remaining count>=limit; accepted uint32 codepoint inserts once. New-text event truncates to first limit codepoints and terminates buffer.','providers':['Window active/read-only and Font available codepoint=true; source supported font availability for nonBMP not proven.','String copy/erase/destruct, reserve existing small-buffer, CRT memmove, validation=true and Window text assignment/event notifications; actual String insert10006e90/count/truncation execute.','Original current text, source8/20 limit, KeyEventArgs uint32 codepoint, selection/caret supplied.'],'boundary':'No original Windows clipboard producer or OS IME transport executed. Web pasted/committed new value follows original onTextChanged truncation as explicit Web input projection; supported nonBMP glyph availability remains a provider.'}
(ROOT/'recovery/output/room-create-input-limit-native.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print('PASS',len(rows),'UTF32count/ordinaryinsert/selectionreplace/newtexttruncate vectors')
