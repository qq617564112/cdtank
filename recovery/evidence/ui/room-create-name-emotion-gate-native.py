"""Execute room-name default EmotionFont and concrete CreateRoomDlg setup writes."""
import json
import struct
import sys
from pathlib import Path
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import *
ROOT=Path(__file__).resolve().parents[3]
sys.path.insert(0,str(ROOT/'recovery'))
from effect_native import map_original_binaries
O,NAME,PASSWORD,FRAME,STACK,RETURN,STUB=[0x2001000+n*0x2000 for n in range(7)]
u,images=map_original_binaries([ROOT/'CDTank/CEGUIBase.dll'])
u.mem_map(0,4096);u.mem_map(0x2000000,0x100000)
def word(p,*v):u.mem_write(p,struct.pack('<'+'I'*len(v),*v))
def read(p):return struct.unpack('<I',u.mem_read(p,4))[0]
u.reg_write(UC_X86_REG_ESI,NAME);u.reg_write(UC_X86_REG_EBX,0)
u.emu_start(0x1005812d,0x10058139,count=5)
assert read(NAME+0x3e4)==0
constructor={'entry':'0x1005812d..0x10058139','emotionFont':read(NAME+0x3e4),'provider':'Original constructor EBX=0 supplied; field writes executed.'}
initial=bytes(u.mem_read(NAME,0x600))
v,exe=map_original_binaries([ROOT/'CDTank/CDTank.exe'])
v.mem_map(0,4096);v.mem_map(0x2000000,0x100000);v.mem_write(NAME,initial)
imports={s.address:s.name.decode() for d in exe['cdtank.exe'].DIRECTORY_ENTRY_IMPORT for s in d.imports if s.name}
handlers={};events=[]
for index,a in enumerate([0x5c03b8,0x5c025c,0x5c0268,0x5c0140]):
 target=STUB+index*0x100;word_target=struct.pack('<I',target);v.mem_write(a,word_target);handlers[target]=imports[a]
handlers[STUB+0x1000]='getWindow';handlers[STUB+0x1100]='stringDestructor'
strings={};last_window=None
normal_font=0x200f000;v.mem_write(0x893124,struct.pack('<I',normal_font))
def vr(p):return struct.unpack('<I',v.mem_read(p,4))[0]
def finish(pop=0,result=0):
 sp=v.reg_read(UC_X86_REG_ESP);v.reg_write(UC_X86_REG_EAX,result);v.reg_write(UC_X86_REG_EIP,vr(sp));v.reg_write(UC_X86_REG_ESP,sp+4+pop)
def hook(machine,a,size,data):
 global last_window
 if a not in handlers:return
 n=handlers[a];sp=machine.reg_read(UC_X86_REG_ESP);this=machine.reg_read(UC_X86_REG_ECX)
 if 'String' in n and n.startswith('??0'):
  p=vr(sp+4);b=bytearray()
  while bytes(machine.mem_read(p,1))!=b'\0':b.extend(machine.mem_read(p,1));p+=1
  strings[this]=b.decode();finish(4,this)
 elif n=='getWindow':
  name=strings[vr(sp+4)];last_window=NAME if name.endswith('edtRoomName') else PASSWORD;events.append({'name':name,'window':hex(last_window)});finish(4,last_window)
 elif n=='stringDestructor':finish()
 elif 'setMaxTextLength' in n:events.append({'setter':n,'window':hex(this),'value':vr(sp+4)});finish(4)
 elif 'setTextMasked' in n:events.append({'setter':n,'window':hex(this),'value':vr(sp+4)});finish(4)
 else:
  # Imported return cast used after WindowManager::getWindow.
  events.append({'setter':n,'window':hex(this)});finish(result=this)
v.hook_add(UC_HOOK_CODE,hook)
v.reg_write(UC_X86_REG_ESI,O);v.reg_write(UC_X86_REG_EBP,FRAME);v.reg_write(UC_X86_REG_ESP,STACK);v.reg_write(UC_X86_REG_EBX,STUB+0x1000);v.reg_write(UC_X86_REG_EDI,STUB+0x1100)
v.emu_start(0x4a257f,0x4a262e,count=10000)
assert vr(O+0x48)==NAME
assert vr(NAME+0x104)==normal_font
assert vr(NAME+0x3e4)==0
ui=json.loads((ROOT/'recovery/output/web-assets/ui.json').read_text());layout=next(l for l in ui['layouts'] if l['path'].endswith('createroom.xml'));props=next(w for w in layout['windows'] if w['name']=='edtRoomName')['properties'];assert 'EmotionFont' not in props
result={'status':'PASS','constructor':constructor,'initialization':{'entry':'0x4a257f..0x4a262e','events':events,'normalFont104':hex(vr(NAME+0x104)),'emotionFont3e4':vr(NAME+0x3e4)},'sourceProperties':props,'scope':'Source default EmotionFont0 constructor field and actual bounded CreateRoomDlg name/password setup execute. Actual setup supplies ordinary font104 and max text length, preserving EmotionFont0. Gate draw consumes field separately.','providers':['XML-loaded source name object carries source ctor default; source edtRoomName has no EmotionFont property. Full layout loader/virtual hooks not executed.','CEGUI String and WindowManager lookup/window cast/setMaxTextLength/masked setter calls recorded; their unrelated effects are providers.','UI default normal font pointer and EBX/EDI getWindow/String destruction bound from surrounding setup.'],'boundary':'No global claim about arbitrary later font assignment; nonzero EmotionFont generic draw remains a separate explicit provider path. No OS glyph/GPU equivalence.'}
(ROOT/'recovery/output/room-create-name-emotion-gate-native.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print('PASS original constructor EmotionFont0 and concrete room-name setup normalFont/maxLength/masked fields')
