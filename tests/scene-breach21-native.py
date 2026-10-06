"""Execute the original obj05467 loader, destroy sound, and navigation callbacks."""
import json
from pathlib import Path
import struct
import sys
import capstone
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_EAX, UC_X86_REG_ECX, UC_X86_REG_EIP, UC_X86_REG_ESP
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'recovery'))
from effect_native import map_original_binaries
uc,images=map_original_binaries([ROOT/'CDTank/CDTank.exe'])
uc.mem_map(0,4096);uc.mem_map(0x2000000,0x40000)
OBJ,SUB,INTACT,BROKEN,VTABLE,GLOBAL,MAP,MAPVT,STACK,STOP=[0x2001000+i*0x2000 for i in range(10)]
ALLOC=0x2030000
strings={};events=[];allocation=0

def put(a,*v):uc.mem_write(a,struct.pack('<'+'I'*len(v),*v))
def get(a):return struct.unpack('<I',uc.mem_read(a,4))[0]
def rawstring(a):return bytes(uc.mem_read(a,1024)).split(b'\0')[0].decode('ascii')
def text(a):return strings[a] if a in strings else rawstring(a)
def finish(value=0,pop=0):
 s=uc.reg_read(UC_X86_REG_ESP);uc.reg_write(UC_X86_REG_EAX,value);uc.reg_write(UC_X86_REG_EIP,get(s));uc.reg_write(UC_X86_REG_ESP,s+4+pop)
def call(a,*args):
 put(STACK,STOP,*args);uc.reg_write(UC_X86_REG_ESP,STACK);uc.reg_write(UC_X86_REG_ECX,OBJ);uc.emu_start(a,STOP,count=200000)
 assert uc.reg_read(UC_X86_REG_EIP)==STOP
 assert uc.reg_read(UC_X86_REG_ESP)==STACK+4+4*len(args)

# Imported graphics methods are recording resource/device boundaries.
imports={}
pe=images['cdtank.exe']
for entry in pe.DIRECTORY_ENTRY_IMPORT:
 for symbol in entry.imports:
  if symbol.address in [0x5c0a58,0x5c0a5c,0x5c0a60,0x5c0a68,0x5c09dc,0x5c09d8,0x5c0af8,0x5c0af4,0x5c0afc,0x5c0af0,0x5c09c4,0x5c0ba0]:
   sink=ALLOC+0x1000+len(imports)*16;imports[sink]=symbol.name.decode();put(symbol.address,sink)
for i in range(0,0x80,4):put(VTABLE+i,ALLOC+0x2000+i)
for a in [INTACT,BROKEN]:put(a,VTABLE)
for a in [0x5c7148,0x5c7920]:
 for off in [0x14,0x1c]:put(a+off,ALLOC+0x2000+off)

def hook(machine,address,size,data):
 global allocation
 s=machine.reg_read(UC_X86_REG_ESP);c=machine.reg_read(UC_X86_REG_ECX)
 if address in imports:
  name=imports[address]
  if 'LoadFromFile@gbPlantNode' in name:
   events.append(dict(kind='loadIntact',reference=rawstring(get(s+4))));finish(1,8)
  elif 'LoadFromFile@gbGeomNode' in name:
   events.append(dict(kind='loadBroken',reference=rawstring(get(s+4))));finish(1,12)
  elif 'GetTotalOBBox' in name:finish(get(s+4),4)
  elif 'SetBlendRecursive' in name:
   events.append(dict(kind='blend',object=hex(c),mode=get(s+4),alpha=struct.unpack('<f',uc.mem_read(s+8,4))[0]));finish(0,8)
  elif 'SetRenderPriority' in name:events.append(dict(kind='priority',value=struct.unpack('<i',uc.mem_read(s+4,4))[0]));finish(0,4)
  elif 'SetTimeScale' in name or 'SetParameter' in name or 'SetRotationY' in name or 'SetAnimLoop' in name:finish(0,4)
  else:finish(c)
 elif ALLOC+0x2000<=address<ALLOC+0x2080:
  if address==ALLOC+0x201c:finish(0,4)
  else:finish()
 elif address==0x578620:
  allocation+=1;finish(INTACT if allocation==1 else BROKEN)
 elif address in [0x44ea07,0x44ddc0]:finish(0,4)
 elif address==0x40fa48:
  strings[c]=rawstring(get(s+4));finish(c,4)
 elif address==0x45ce4e:
  target=get(s+4);strings[target]=strings[target].replace('%s',rawstring(get(s+8)),1);finish(target)
 elif address==0x40f17c:
  target=get(s+4);strings[target]=strings[target].replace('%s',text(get(s+8)),1);finish(target)
 elif address==0x40e10e:
  target=get(s+4);value=strings[c];pointer=ALLOC+0x5000+allocation*0x200;uc.mem_write(pointer,value.encode()+b'\0');put(target+0x14,len(value));put(target+0x18,1024);put(target+4,pointer);finish(target,4)
 elif address in [0x401171]:finish(c,8)
 elif address in [0x40f4c9,0x457fb5]:finish()
 elif address==0x485b1b:
  events.append(dict(kind='sound',reference=rawstring(get(s+8)),position=list(struct.unpack('<3f',uc.mem_read(get(s+12),12))),selector=get(s+16),direction=list(struct.unpack('<3f',uc.mem_read(get(s+20),12)))))
  finish()
 elif address==0x462846 and mode=='sound':
  events.append(dict(kind='navigationUpdate',current=get(OBJ+0xe4)));finish()
 elif address==0x462846:return
 elif address in [0x417b49,0x459f05,0x459771]:finish(0,4 if address==0x459f05 else 0)
 elif address in [0x4624cd,0x4624a2]:
  events.append(dict(kind='collectCoverage',address=hex(address),current=get(OBJ+0xe4)));finish()
 elif address==0x4489f8:
  events.append(dict(kind='dispatchCoverage',current=get(OBJ+0xe4)))
  # Native dispatcher uses a collected object range; supply its one object.
  put(s+4,OBJ);uc.reg_write(UC_X86_REG_ECX,OBJ);uc.reg_write(UC_X86_REG_EIP,0x461ded)
 elif address==ALLOC+0x3008:
  events.append(dict(kind='queryCoverage',coverage=get(s+4),bounds=get(s+8),current=get(OBJ+0xe4)));finish(0,8)
 elif address==ALLOC+0x3000:
  events.append(dict(kind='clearCoverage',minimum=get(s+8),maximum=get(s+12)));finish(0,12)
 elif address==ALLOC+0x3004:
  events.append(dict(kind='applyCoverage',coverage=get(s+4),value=get(s+8)));finish(0,8)
 else:
  raise AssertionError(hex(address))

# Install only explicit boundary hooks; MSVC string comparison executes natively.
addresses=[0x578620,0x44ea07,0x44ddc0,0x40fa48,0x45ce4e,0x40f17c,0x40e10e,0x401171,0x40f4c9,0x457fb5,0x485b1b,0x462846,0x417b49,0x459f05,0x459771,0x4624cd,0x4624a2,0x4489f8,ALLOC+0x3000,ALLOC+0x3004,ALLOC+0x3008,*imports,*range(ALLOC+0x2000,ALLOC+0x2080,4)]
for a in addresses:uc.hook_add(UC_HOOK_CODE,hook,begin=a,end=a)
put(OBJ,0x5c7450);put(OBJ+0xd8,SUB);uc.mem_write(OBJ+0x24,b'obj05467\0');strings[OBJ+0x20]='obj05467';put(OBJ+0x34,8);put(OBJ+0x38,15)
uc.mem_write(OBJ+0x58,struct.pack('<3f',1,2,3))
mode='loader';call(0x4610f1,0)
assert get(OBJ+0xdc)==INTACT and get(OBJ+0xe0)==BROKEN and get(OBJ+0xe4)==INTACT
assert [e['reference'] for e in events if e['kind'].startswith('load')]==['data\\scnobj\\obj05467\\obj05467.pol','data\\scnobj\\obj05467\\c9.cvd']
loader=list(events);events.clear();mode='sound';call(0x44e081,0)
assert get(OBJ+0xe4)==BROKEN
assert [e['reference'] for e in events if e['kind']=='sound']==['GA13']
assert events[-1]['position']==[1,2,3] and events[-1]['selector']==1
sound=list(events)
# Repeated original destroy dispatch emits no second cue.
events.clear();call(0x44e081,0);assert not events
# Direct native coverage callback: execute 462846/461ded, substitute collector/device map operations.
mode='navigation';put(0x635830,GLOBAL);put(GLOBAL+0x60,MAP);put(MAP,MAPVT);put(MAPVT+0x20,ALLOC+0x3008);put(MAPVT+0x24,ALLOC+0x3000);put(MAPVT+0x2c,ALLOC+0x3004);put(MAP+0x21c,MAPVT);put(MAP+0x18c,0);put(MAP+0x190,0)
put(SUB,1);put(SUB+0x88,1);put(SUB+0x8c,1);events.clear();call(0x462846)
nav=list(events)
assert [e['kind'] for e in nav]==['collectCoverage','collectCoverage','queryCoverage','dispatchCoverage','clearCoverage','applyCoverage']
assert nav[-1]['value']==1 and nav[-1]['coverage']==SUB+0x90
assert uc.mem_read(SUB,1)==b'\0'
result=dict(status='PASS',loader=loader,destroy=sound,repeat=[],navigation=nav,substitutes=['string formatting/storage','allocator','graphics loaders and device methods','coverage collectors/dispatcher','map virtual24/2c'],scope='Native loader/destroy/sound dispatch and coverage callbacks; collector geometry/map kernel not recovered')
decoder=capstone.Cs(capstone.CS_ARCH_X86,capstone.CS_MODE_32)
result['sources']=[dict(start=hex(a),end=hex(b),instructions=[dict(address=hex(i.address),bytes=i.bytes.hex(),instruction=f'{i.mnemonic} {i.op_str}') for i in decoder.disasm(pe.get_data(a-0x400000,b-a),a)]) for a,b in [(0x4610f1,0x4613dd),(0x45e7b0,0x45e7f2),(0x44e081,0x44e3cd),(0x462846,0x462934),(0x461db9,0x461e39),(0x462934,0x46299d)]]
(ROOT/'recovery/output/scene-breach21-native.json').write_text(json.dumps(result,indent=2)+'\n')
print('PASS: obj05467 POL/c9 source loader, immediate broken selection, GA13 once, coverage clear then apply value1')
