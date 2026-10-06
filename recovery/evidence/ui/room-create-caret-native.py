"""Execute original Editbox caret rectangle, visibility and blink update."""
import runpy,json,struct
from pathlib import Path
from unicorn.x86_const import *
import capstone,pefile
ROOT=Path(__file__).resolve().parents[3]
ns=runpy.run_path(str(Path(__file__).with_name('room-create-password-native.py')))
Native,OBJ,END=ns['Native'],ns['OBJ'],ns['END']
ui=json.loads((ROOT/'recovery/output/web-assets/ui.json').read_text())
controls=next(l for l in ui['layouts'] if l['path'].endswith('createroom.xml'))['windows']
refs={w['name']:w['properties']['CaratImage'] for w in controls if 'CaratImage' in w['properties']}
assert set(refs)=={'edtRoomName','edtPassword'} and len(set(refs.values()))==1
image=next(i for s in ui['imagesets'] for i in s['images'] if i.get('asset')=='ui/regions/60/237.png')
assert (image['Width'],image['Height'])==('1','12')
rows=[]
for label,masked,selected,focus,readonly,visible,caret in [
 ('name',False,(0,0),1,0,1,3),('password',True,(0,0),1,0,1,3),
 ('selected',True,(1,4),1,0,1,4),('backward',True,(1,4),1,0,1,1),
 ('blurred',True,(1,4),0,0,1,4),('readonly',True,(1,4),1,1,1,4),('blinkHidden',True,(1,4),1,0,0,4)]:
 n=Native(136);n.setup('中文密码123',selected,focus)
 n.uc.mem_write(OBJ+0x329,bytes([masked]));n.uc.mem_write(OBJ+0x328,bytes([readonly]));n.uc.mem_write(OBJ+0x50c,bytes([visible]));n.write(OBJ+0x334,caret)
 n.uc.emu_start(0x1000a420,0x1000aede,count=100000)
 assert n.uc.reg_read(UC_X86_REG_EIP)==0x1000aede
 cs=[b for b in n.brushes if b['kind']=='caret'];assert bool(cs)==bool(focus and not readonly and visible)
 if cs:assert cs[0]['rect']==[caret*7,0,caret*7+1,16],cs
 rows.append({'label':label,'caretIndex':caret,'brushes':cs})
n=Native(136);n.setup('123',(0,0),1);n.fs(OBJ+0x508,0);n.fs(OBJ+0x510,.5)
blink=[]
for delta,want in [(.5,True),(.01,False),(.49,False),(.01,True)]:
 n.write(ns['rich'].STACK,END,struct.unpack('<I',struct.pack('<f',delta))[0]);n.uc.reg_write(UC_X86_REG_ESP,ns['rich'].STACK);n.uc.reg_write(UC_X86_REG_ECX,OBJ)
 n.uc.emu_start(0x1000b110,END,count=100)
 got=n.uc.mem_read(OBJ+0x50c,1)==b'\1';assert got==want
 blink.append({'delta':delta,'visible':got,'elapsed':n.f(OBJ+0x508)})
n.fs(OBJ+0x508,.5)
delta=1e-9
n.write(ns['rich'].STACK,END,struct.unpack('<I',struct.pack('<f',delta))[0]);n.uc.reg_write(UC_X86_REG_ESP,ns['rich'].STACK);n.uc.reg_write(UC_X86_REG_ECX,OBJ)
n.uc.emu_start(0x1000b110,END,count=100)
assert n.uc.mem_read(OBJ+0x50c,1)==b'\0' and n.f(OBJ+0x508)==.5
blink.append({'initialElapsed':.5,'delta':delta,'visible':False,'elapsed':n.f(OBJ+0x508)})
p=pefile.PE(str(ROOT/'CDTank/CEGUIWindowsLook.dll'));b=p.get_memory_mapped_image();md=capstone.Cs(capstone.CS_ARCH_X86,capstone.CS_MODE_32)
lines=[]
for a,z in [(0x1000a7f0,0x1000a8a4),(0x1000b110,0x1000b168),(0x1000b1e3,0x1000b200)]:
 lines.extend(f'{i.address:08x} {i.mnemonic} {i.op_str}' for i in md.disasm(b[a-0x10000000:z-0x10000000],a))
(ROOT/'recovery/output/room-create-caret-native.disasm.txt').write_text('\n'.join(lines)+'\n')
result={'status':'PASS','references':refs,'image':image,'drawVectors':rows,'blink':blink,'source':'Complete WLEditbox draw0x1000a420..0x1000aede; blink0x1000b110; constructor0x1000b1f6 default half-period0.5s','providers':'Font extent7 and line16, image width1, text rectangle136x16, focused/readOnly/blink bytes; source rectangle arithmetic and gates execute','boundary':'Browser measures current font/native caret index/scroll. Original OS font metrics, IME candidate UI and GPU/display remain outside this slice.'}
(ROOT/'recovery/output/room-create-caret-native.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print('PASS: 7 complete native caret draw vectors and 5 original blink updates')
