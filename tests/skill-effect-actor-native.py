"""Execute actor skill attachment, manager start/stop, and visibility reset."""
import json
from pathlib import Path
import struct
import sys
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_EAX,UC_X86_REG_ECX,UC_X86_REG_EIP,UC_X86_REG_ESP
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'recovery'))
from effect_native import map_original_binaries
uc,images=map_original_binaries([ROOT/'CDTank/CDTank.exe'])
uc.mem_map(0,4096);uc.mem_map(0x2000000,0x40000)
ACTOR,ROLE,SYSTEM,GAME,MANAGER,EFFECT,PARENT,SHARED,VTABLE,VECTOR=[0x2001000+0x1000*i for i in range(10)]
STACK,STOP,HASH,CLIP,END,START=[0x2020000+0x1000*i for i in range(6)]
events=[];clipped=0;local=False;present=True
mode="actor";node_indices={}
AUDIO_SOURCE,AUDIO_OBJECT,AUDIO_OUTPUT,AUDIO_VECTOR=ROLE+0x500,ROLE+0x600,ROLE+0x700,ROLE+0x800
library=json.loads((ROOT/'recovery/output/web-assets/effect-library.json').read_text())
root=next(n for n in library['nodes'] if n['name']=='_root\\online\\019')
def put(a,*v):uc.mem_write(a,struct.pack('<'+'I'*len(v),*[x&0xffffffff for x in v]))
def uint(a):return struct.unpack('<I',uc.mem_read(a,4))[0]
def finish(pop=0,value=None):
 s=uc.reg_read(UC_X86_REG_ESP)
 if value is not None:uc.reg_write(UC_X86_REG_EAX,value)
 uc.reg_write(UC_X86_REG_EIP,uint(s));uc.reg_write(UC_X86_REG_ESP,s+4+pop)
def call(a,this,*args):
 put(STACK,STOP,*args);uc.reg_write(UC_X86_REG_ESP,STACK);uc.reg_write(UC_X86_REG_ECX,this)
 uc.emu_start(a,STOP,count=100000);assert uc.reg_read(UC_X86_REG_EIP)==STOP
 assert uc.reg_read(UC_X86_REG_ESP)==STACK+4+4*len(args)
 return uc.reg_read(UC_X86_REG_EAX)
def hook(machine,a,size,data):
 s=machine.reg_read(UC_X86_REG_ESP)
 if a==0x4269c4:finish(value=ROLE if local else ROLE+0x100)
 elif a==0x44ef01:finish(value=uint(s+4))
 elif a==CLIP:events.append({'kind':'clip'});finish(4,clipped)
 elif a==0x57c0d6:
  out,_,_,effect=[uint(s+i) for i in (4,8,12,16)];name=f'_root\\online\\{effect:03d}'
  uc.mem_write(out,name.encode()+b'\0');finish(value=len(name))
 elif a==0x40bd28:finish()
 elif a==HASH:
  name=bytes(uc.mem_read(uint(s+4),256)).split(b'\0')[0].decode()
  events.append({'kind':'name','value':name});finish(value=root['id'])
 elif a==0x466676:
  tag=(uint(s+4)-0x6d2258)//0x1c;events.append({'kind':'tagLookup','index':tag});finish(4,int(present))
 elif a==0x46748f:finish(4,SHARED)
 elif a==0x45bf6c:
  this=machine.reg_read(UC_X86_REG_ECX);put(this,PARENT,0);finish(4,this)
 elif a in [0x47b81b,0x571bd4,0x572f52]:finish(value=MANAGER)
 elif a==0x572fff:finish(4,1)
 elif a==0x5718e3:put(uint(s+4),AUDIO_SOURCE);finish(8)
 elif a==END+0x100:
  events.append({'kind':'source3f','parameter':uint(s+8),'value':list(struct.unpack('<3f',uc.mem_read(s+12,12)))});finish()
 elif a==END+0x200:
  events.append({'kind':'sourcef','parameter':uint(s+8),'value':struct.unpack('<f',uc.mem_read(s+12,4))[0]});finish()
 elif a==END+0x300:
  events.append({'kind':'sourcei','parameter':uint(s+8),'value':uint(s+12)});finish()
 elif a==END+0x400:events.append({'kind':'sourcePlay','handle':uint(s+4)});finish()
 elif a==END+0x500:put(uint(s+4),123,456);finish(4,1)
 elif a==END+0x600:finish()
 elif a==0x405805:events.append({'kind':'worldDropped'});finish()
 elif a==0x4792d8:finish(4,0)
 elif a==0x4795fa:
  events.append({'kind':'create','id':uint(s+4),'retain':uint(s+8)});finish(8,EFFECT)
 elif a==0x469ebd:events.append({'kind':'managerAdd'});finish(4)
 elif a==START:events.append({'kind':'startAttached','matrix':uint(s+4)});finish(8)
 elif a==0x44dd58:finish()
 elif a==END:
  events.append({'kind':'end',**({'node':node_indices[machine.reg_read(UC_X86_REG_ECX)]} if mode=='nested' else {})});finish()
 elif a==0x47ef3b:finish()
 elif a==0x47f262:
  node=machine.reg_read(UC_X86_REG_ECX)
  events.append({'kind':'releaseEffect',**({'node':node_indices[node]} if mode=='nested' else {})})
  if mode=='nested':
   parent=uint(node+0x28)
   if parent:
    begin,end=uint(parent+0x30),uint(parent+0x34)
    item=next(i for i in range(begin,end,4) if uint(i)==node)
    uc.mem_write(item,bytes(uc.mem_read(item+4,end-item-4)));put(parent+0x34,end-4)
   put(node+4,0)
  finish()
uc.hook_add(UC_HOOK_CODE,hook)
put(0x633588,SYSTEM);put(SYSTEM+0x118,MANAGER);put(0x635830,GAME);put(GAME+8,VTABLE)
put(ACTOR+0x258,ROLE);put(0x5c0954,HASH);put(0x5c09e4,CLIP)
put(MANAGER+4,VECTOR);put(MANAGER+8,VECTOR+4);put(MANAGER+0x44,VECTOR+0x100);put(VECTOR+0x100,VECTOR+0x100)
uc.mem_write(MANAGER+0x64,b'\x01');put(EFFECT,VTABLE);put(VTABLE+0x34,START);put(VTABLE+0x2c,END)
rows=[]
for tag in range(7):
 for oneShot in [0,1]:
  events.clear();clipped=0;local=False;present=True
  result=call(0x467a08,ACTOR,19,3,tag,oneShot)
  assert result==EFFECT
  assert next(e for e in events if e['kind']=='create')['retain']==0
  rows.append({'tag':tag,'oneShot':oneShot,'clipped':False,'local':False,'present':True,'result':result,'events':list(events)})
for oneShot,clipped,local,present in [(1,1,False,True),(1,1,True,True),(0,1,False,True),(0,0,False,False)]:
 events.clear();result=call(0x467a08,ACTOR,19,3,0,oneShot)
 assert bool(result)==(present and (not oneShot or not clipped or local))
 rows.append({'tag':0,'oneShot':oneShot,'clipped':bool(clipped),'local':local,'present':present,'result':result,'events':list(events)})
# Original sourceFlag1 world notification skips allocation when its point is clipped.
put(0x5c0980,END+0x600);put(0x5c097c,END+0x600);clipped=1;events.clear()
call(0x45afc2,MANAGER,ROLE+0x900,PARENT,0x47c35000,0,0,1)
world_clip=list(events);assert world_clip==[{'kind':'clip'},{'kind':'worldDropped'}]
# Manager stop matches a real handle in its active vector and executes the native node end/release.
put(VECTOR,EFFECT);put(EFFECT+4,2);put(EFFECT+0x30,VECTOR+0x200);put(EFFECT+0x34,VECTOR+0x200)
events.clear();call(0x4791de,MANAGER,EFFECT);stop=list(events)
assert stop==[{'kind':'end'},{'kind':'releaseEffect'}]
assert uint(EFFECT+4)==3 and struct.unpack('<f',uc.mem_read(EFFECT+8,4))[0]==0
call(0x464950,ACTOR,1);assert uc.mem_read(ACTOR+0x23d,1)==b'\x01'
pe=images['cdtank.exe'];image=pe.get_memory_mapped_image()
tags=[image[a-0x400000:a-0x400000+32].split(b'\0')[0].decode() for a in [0x5c861c,0x5c8610,0x5c8604,0x5c85f8,0x5c85ec,0x5c85e0,0x5c85d0]]
for table in [0x5c8468,0x5c8688,0x5c88c8]:assert uint(table+0xa8)==0x467a08
# Execute explicit end on the actual online019 source graph, supplying pool release/unlink only.
creation=next(r for r in json.loads((ROOT/'recovery/output/effect-tree-create-native.json').read_text())['rows'] if r['node']==2469 and not r['retain'])
source_nodes={r['node']:VECTOR+0x400+0x100*i for i,r in enumerate(creation['created'])}
node_indices={pointer:index for index,pointer in source_nodes.items()}
for i,(index,pointer) in enumerate(source_nodes.items()):
 put(pointer,VTABLE,2);begin=VECTOR+0x2000+0x80*i;put(pointer+0x30,begin,begin)
for link in creation['attached']:
 parent,child=source_nodes[link['parent']],source_nodes[link['child']]
 end=uint(parent+0x34);put(end,child);put(parent+0x34,end+4);put(child+0x28,parent)
mode='nested';events.clear();call(0x47f3c4,source_nodes[2469]);nested_stop=list(events);mode='actor'
assert len(nested_stop)==2*len(source_nodes)
assert all(uint(pointer+4)==0 for pointer in source_nodes.values())
# Execute the role-position OpenAL wrapper, including the original selector-1 loop switch.
put(0x5c0738,END+0x100);put(0x5c073c,END+0x200);put(0x5c0740,END+0x300)
put(0x5c0708,END+0x400);put(0x5c05dc,END+0x500)
uc.mem_write(MANAGER+8,b'\x01');put(MANAGER+0xc,0x42c80000,0x40000000,0x44c80000)
put(MANAGER+0x84,0x3f000000);put(MANAGER+0x30,MANAGER+0x600)
put(AUDIO_SOURCE,AUDIO_OBJECT);put(AUDIO_SOURCE+0xc,77);put(AUDIO_OBJECT,77)
uc.mem_write(AUDIO_VECTOR,struct.pack('<3f',12.5,0,-4));uc.mem_write(AUDIO_VECTOR+0x10,struct.pack('<3f',0,0,-1))
audio=[]
for selector in [1,-1]:
 events.clear();call(0x571d14,MANAGER,AUDIO_OUTPUT,PARENT,AUDIO_VECTOR,selector,AUDIO_VECTOR+0x10,AUDIO_VECTOR+0x10)
 assert [e['value'] for e in events if e['kind']=='sourcei' and e['parameter']==0x1007]==([0,1] if selector==-1 else [0])
 assert next(e['value'] for e in events if e['kind']=='source3f' and e['parameter']==0x1004)==[12.5,0,-4]
 assert [e['value'] for e in events if e['kind']=='sourcef' and e['parameter'] in [0x1020,0x1021,0x1023]]==[100,2,1600]
 assert events[-1]=={'kind':'sourcePlay','handle':77}
 audio.append({'selector':selector,'events':list(events)})
out={'worldClip':world_clip,'nestedStop':nested_stop,'audio':audio,'root':{'id':root['id'],'name':root['name']},'tags':tags,'rows':rows,'stop':stop,'visibilityReset':True,'effectHandle':EFFECT,
 'evidence':{'actor':'0x467a08','managerAttached':'0x47b29e','stop':'0x4791de','nodeEnd':'0x47f3c4','visible':'0x464950'}}
path=ROOT/'recovery/output/skill-effect-actor-native.json';path.write_text(json.dumps(out,indent=2)+'\n')
print(f'PASS: {len(rows)} actor attachment cases / native manager stop and visibility reset')
