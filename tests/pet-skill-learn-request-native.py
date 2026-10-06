"""Execute complete original learning qualification with source Pet2 and PetSkill rows."""
import json
import struct
import sys
from pathlib import Path
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_EAX, UC_X86_REG_ECX, UC_X86_REG_EIP, UC_X86_REG_ESP
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'recovery'))
from effect_native import map_original_binaries
uc, _ = map_original_binaries([ROOT / 'CDTank/CDTank.exe'])
uc.mem_map(0, 0x1000)  # Original SEH prologue reads fs:[0].
uc.mem_map(0x2000000, 0x30000)
GAME, MODES, MODE, VT, MANAGER, CONTAINER, CATALOG, PET_MANAGER, PRICE_MANAGER, OWNED, PET, PRICE, SHOP, CALLBACK, CVT, SENTINEL, NODE = [0x2001000+i*0x1000 for i in range(17)]
STACK, STOP, MODE_GETTER, NOTIFY = [0x2020000+i*0x1000 for i in range(4)]
pet = next(row['values'] for row in json.loads((ROOT/'recovery/output/verified/tables/pet.json').read_text())['rows'] if row['values']['ID']=='2')
priceRows = {int(row['values']['技能ID']): row['values'] for row in json.loads((ROOT/'recovery/output/verified/tables/petskill.json').read_text())['rows']}
mode, sent, feedback, lookups = 2, [], [], []
def put(a,*v):uc.mem_write(a,struct.pack('<'+'I'*len(v),*v))
def get(a):return struct.unpack('<I',uc.mem_read(a,4))[0]
def finish(value=0,pop=0):
 s=uc.reg_read(UC_X86_REG_ESP);uc.reg_write(UC_X86_REG_EAX,value);uc.reg_write(UC_X86_REG_EIP,get(s));uc.reg_write(UC_X86_REG_ESP,s+4+pop)
def terminal(machine,address,size,data):
 s=uc.reg_read(UC_X86_REG_ESP);this=uc.reg_read(UC_X86_REG_ECX)
 if address==MODE_GETTER:finish(mode)
 elif address==NOTIFY:feedback.append(get(s+4));finish(pop=4)
 elif address==0x411068:
  key=get(s+4);lookups.append({'manager':'pet' if this==PET_MANAGER+0xc else 'price','key':key})
  if this==PET_MANAGER+0xc:assert key==2;finish(PET,pop=4)
  else:
   assert this==PRICE_MANAGER+0xc
   row=priceRows.get(key)
   if row:put(PRICE+0xc,key,int(row['技能类别']),int(row['技能等级']),int(row['花费技能点数']))
   finish(PRICE if row else 0,pop=4)
 else:
  assert address==0x413ec4 and this==GAME
  packet=get(s+4);sent.append({'vtable':hex(get(packet)),'instance':get(packet+0xc),'slot':get(packet+0x10)});finish(pop=4)
for a in (MODE_GETTER,NOTIFY,0x411068,0x413ec4):uc.hook_add(UC_HOOK_CODE,terminal,begin=a,end=a)
put(0x633588,GAME);put(GAME+0xac,0);put(GAME+0xe0,MODES);put(GAME+0x118,MANAGER);put(GAME+0x114,CATALOG)
put(MODES,MODE);put(MODE,VT);put(VT+4,MODE_GETTER)
put(MANAGER+0x40,CONTAINER);put(CONTAINER+0x20,0x5c4118)
put(CATALOG+0x80,PET_MANAGER);put(CATALOG+0x8c,PRICE_MANAGER)
put(CONTAINER+0x18,SENTINEL,1);put(SENTINEL,NODE,NODE,NODE);uc.mem_write(SENTINEL+0x14,bytes([1,1]))
put(NODE,SENTINEL,SENTINEL,SENTINEL,83,OWNED);uc.mem_write(NODE+0x14,bytes([1,0]))
put(OWNED,83);put(OWNED+8,2);put(PET+0xc,2)
for i in range(6):put(OWNED+0x44+i*4,int(pet[f'Skill{i}']));put(PET+0xa4+i*4,int(pet[f'SkillLv{i}']))
put(CALLBACK,CVT);put(CVT+8,NOTIFY);put(SHOP+0x6c,CALLBACK)
rows=[]
for name,slot,rank,points,instance,currentMode in [('exactCost',0,1,20,83,2),('insufficient',0,1,19,83,2),('zeroCap',5,0,200,83,2),('maxRankMissingNext',0,5,200,83,2),('missingOwned',0,1,200,999,2),('wrongMode',0,1,200,83,1)]:
 mode=currentMode;put(OWNED+0x5c+slot*4,rank);put(CONTAINER+0xc0,points)
 sent.clear();feedback.clear();lookups.clear();put(STACK,STOP,instance,slot)
 uc.reg_write(UC_X86_REG_ECX,SHOP);uc.reg_write(UC_X86_REG_ESP,STACK);uc.emu_start(0x49380b,STOP,count=100000)
 assert uc.reg_read(UC_X86_REG_EIP)==STOP and uc.reg_read(UC_X86_REG_ESP)==STACK+12
 assert get(OWNED+0x5c+slot*4)==rank and get(CONTAINER+0xc0)==points
 assert bool(sent)==(name=='exactCost')
 assert feedback==({'insufficient':[2],'zeroCap':[0]}.get(name,[]))
 rows.append({'name':name,'slot':slot,'rank':rank,'points':points,'instance':instance,'mode':mode,'returnValue':uc.reg_read(UC_X86_REG_EAX),'sent':list(sent),'feedback':list(feedback),'lookups':list(lookups)})
output={'status':'PASS_ORIGINAL_PET_LEARN_REQUEST_QUALIFICATION','rows':rows,'petDefinition':pet,'scope':'Complete49380b with original profile getter/owned tree/next-ID/packet constructor and source table definitions. Mode, catalog lookup terminals and transport/UI supplied. Explicit owned-rank fixtures, not ordinary purchases or original server settlement.'}
(ROOT/'recovery/output/pet-skill-learn-request-native.json').write_text(json.dumps(output,ensure_ascii=False,indent=2)+'\n');print(output['status'])
