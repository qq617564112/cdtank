"""Execute original unmasked room-name selection text and background consumers."""
import runpy,json
from pathlib import Path
from unicorn.x86_const import *
from unicorn import UC_HOOK_CODE
ROOT=Path(__file__).resolve().parents[3]
ns=runpy.run_path(str(Path(__file__).with_name('room-create-password-native.py')))
OBJ=ns['OBJ']
class Native(ns['Native']):
    def area(self):
        p=self.arg()
        for d,v in [(0,0),(4,16),(8,0),(12,120)]:self.fs(p+d,v)
        self.ret(4,value=p)
rows=[]
for label,text,selection,focus in [('Chinese','中文房名123',(1,4),1),('Inactive','中文房名123',(1,4),0),('Long','中文长房名'*6,(20,25),1),('Ordinary','中文房名123',(0,0),1),('SpecialPrefixFontZero','AB━中文房名',(4,6),1),('SpecialPrefixFontProvider','AB━中文房名',(4,6),1)]:
 n=Native(120);n.setup(text,selection,focus);n.uc.mem_write(OBJ+0x329,b'\0')
 if label=='SpecialPrefixFontProvider':n.write(OBJ+0x3e4,ns['FONT']+0x100)
 branch=[]
 def hit(uc,p,size,user):
  if p in (0x1000aa16,0x1000aab9,0x1000ab64):branch.append(hex(p))
 n.uc.hook_add(UC_HOOK_CODE,hit)
 n.uc.emu_start(0x1000a420,0x1000aede,count=100000);assert n.uc.reg_read(UC_X86_REG_EIP)==0x1000aede
 if label!='SpecialPrefixFontProvider':
  assert ''.join(d['text'] for d in n.draws)==text,(label,n.draws)
  if selection[1]>selection[0]:
   assert n.draws[1]['text']==text[selection[0]:selection[1]]
   bg=next(b for b in n.brushes if b['kind']=='selection')
   assert bg['rect'][0]==n.draws[0]['rect'][0]+selection[0]*7
   assert bg['rect'][2]==n.draws[0]['rect'][0]+selection[1]*7
 else:assert branch==['0x1000aa16','0x1000aab9','0x1000ab64']
 rows.append({'label':label,'text':text,'selection':selection,'focused':focus,'emotionFont':hex(n.read(OBJ+0x3e4)),'draws':n.draws,'extentInputs':n.extents,'brushes':n.brushes,'specialPrefixBranches':branch})
result={'status':'PASS','scope':'Complete original WLEditbox draw0x1000a420..0x1000aede with masked=false; EmotionFont0 draws complete ordinary prefix/selected/suffix at cumulative source extent; EmotionFont0 skips all special-prefix draws; explicit nonzero Font provider enters U2501..U251E prefix path','vectors':rows,'providers':'Font extent7,line16 and text area120x16; Font drawText and String providers explicit; source substring/branches/background/caret arithmetic execute','boundary':'Nonzero EmotionFont is an explicit fixture provider, not source CreateRoomDlg state. Actual EmotionFont glyph renderer, font OS and GPU/display remain unexecuted.'}
(ROOT/'recovery/output/room-create-name-selection-native.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print('PASS: 6 full original unmasked name vectors, EmotionFont zero gate and explicit font provider branch')
