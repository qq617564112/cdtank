"""Execute supplied original screen-manager initialization and type10 selection."""
import json
from pathlib import Path
import struct
import sys
import pefile
import capstone
from unicorn import UC_HOOK_CODE, UC_HOOK_MEM_READ
from unicorn.x86_const import UC_X86_REG_EAX, UC_X86_REG_ECX, UC_X86_REG_EIP, UC_X86_REG_ESP
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'recovery'))
from effect_native import map_original_binaries
from inspect_assets import read_table
machine,images=map_original_binaries([ROOT/'CDTank'/n for n in ['CDTank.exe','gbengine.dll','msvcr71.dll']])
machine.mem_map(0,4096);machine.mem_map(0x2000000,0x80000)
MANAGER,HEAP,STACK,STOP=0x2010000,0x2020000,0x2040000,0x2050000
heap=HEAP;reads=[]
def uint(address):return struct.unpack('<I',machine.mem_read(address,4))[0]
def finish(pop=0):
 stack=machine.reg_read(UC_X86_REG_ESP)
 machine.reg_write(UC_X86_REG_EIP,uint(stack));machine.reg_write(UC_X86_REG_ESP,stack+4+pop)
def hook(uc,address,size,data):
 global heap
 if address==0x578620:
  count=uint(uc.reg_read(UC_X86_REG_ESP)+4);uc.reg_write(UC_X86_REG_EAX,heap);heap+=(count+15)&~15;finish()
 elif address==0x47341d:
  # Actor registration is supplied; screen manager fields execute in original.
  finish()
 elif address==0x4853dd:
  # Render-target/device ownership is supplied; no subeffect list is provided.
  target=uc.reg_read(UC_X86_REG_ECX);uc.reg_write(UC_X86_REG_EAX,target);finish()
def memory(uc,access,address,size,value,data):
 if uc.reg_read(UC_X86_REG_EIP)==0x4854a9:
  reads.append(dict(address=address,size=size,instruction=hex(uc.reg_read(UC_X86_REG_EIP))))
  uc.emu_stop()
machine.hook_add(UC_HOOK_CODE,hook);machine.hook_add(UC_HOOK_MEM_READ,memory)
machine.mem_write(STACK,struct.pack('<I',STOP));machine.reg_write(UC_X86_REG_ESP,STACK);machine.reg_write(UC_X86_REG_ECX,MANAGER)
machine.emu_start(0x4854c4,STOP,count=100000)
vector=[uint(MANAGER+offset) for offset in [0x3c,0x40,0x44]]
assert vector==[0,0,0]
assert uint(MANAGER+0x20)==0xffffffff
machine.mem_write(STACK,struct.pack('<3I',STOP,5,0));machine.reg_write(UC_X86_REG_ESP,STACK);machine.reg_write(UC_X86_REG_ECX,MANAGER)
machine.emu_start(0x485484,STOP,count=10000)
assert reads==[dict(address=20,size=4,instruction='0x4854a9')]
pe=images['cdtank.exe'];decoder=capstone.Cs(capstone.CS_ARCH_X86,capstone.CS_MODE_32);decoder.skipdata=True
references=[];getterCalls=[]
for section in pe.sections:
 if not section.Characteristics&0x20000000:continue
 data=section.get_data();base=pe.OPTIONAL_HEADER.ImageBase+section.VirtualAddress
 for instruction in decoder.disasm(data,base):
  if any(token in instruction.op_str for token in ['0x6d2958','0x5c9e70','0x5c9e90']):
   references.append(dict(va=hex(instruction.address),instruction=f'{instruction.mnemonic} {instruction.op_str}'))
 for offset in range(len(data)-4):
  if data[offset]==0xe8 and base+offset+5+struct.unpack_from('<i',data,offset+1)[0]==0x4855ec:
   getterCalls.append(hex(base+offset))
assert getterCalls==['0x47ee9a','0x47eea7']
vt=list(struct.unpack('<5I',pe.get_data(0x5c9e70-0x400000,20)))
library=json.loads((ROOT/'recovery/output/web-assets/effect-library.json').read_text())
skills=read_table(ROOT/'CDTank/Data/table/skill.dat')
effect_ids={int(row['values'][f'Effect{i}']) for row in skills['rows'] for i in range(1,4)}
roots={f'_root\\online\\{identifier:03d}' for identifier in effect_ids if identifier>0}
by_id={};reached={}
for node in library['nodes']:by_id.setdefault(node['id'],node)
def visit(node):
 if node['index'] in reached:return
 reached[node['index']]=node
 for identifier in node['children']:
  if identifier in by_id:visit(by_id[identifier])
for node in library['nodes']:
 if node['name'] in roots or any(node['name'].startswith(root+'\\') for root in roots):visit(node)
type10=[dict(node=n['index'],name=n['name']) for n in library['nodes'] if n['type']==10]
reachable_type10=[n['index'] for n in reached.values() if n['type']==10]
assert reachable_type10==[]
evidence={name:[dict(va=hex(i.address),instruction=f'{i.mnemonic} {i.op_str}') for i in decoder.disasm(pe.get_data(start-0x400000,end-start),start)]
 for name,start,end in [('constructor',0x4854c4,0x485560),('selectAndClear',0x48543e,0x4854c4),
 ('getter',0x4855ec,0x485644),('create',0x485560,0x485565),('update',0x46888b,0x46888f),('next',0x49cc05,0x49cc06)]}
(ROOT/'recovery/output/effect-postprocess-manager-native.json').write_text(json.dumps(dict(vector=vector,select5Reads=reads,
 vtable=[hex(v) for v in vt],singletonReferences=references,getterCalls=getterCalls,evidence=evidence,
 type10Sources=type10,currentSkillCoverage=dict(skills=len(skills['rows']),effectIds=sorted(effect_ids),
 reachedNodes=len(reached),type10=reachable_type10)))+'\n')
print('PASS: original screen-manager vector empty; select(5,0) reads null+0x14; only two singleton getter callers are type10 start/end')
