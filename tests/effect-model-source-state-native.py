"""Original POL node construction and graphics ambient initialization evidence."""
import json
from pathlib import Path
import struct
import sys
import capstone
import pefile
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_EAX, UC_X86_REG_ECX, UC_X86_REG_EDI, UC_X86_REG_ESI, UC_X86_REG_ESP, UC_X86_REG_FPCW
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'recovery'))
from effect_native import map_original_binaries
machine, images=map_original_binaries([ROOT/'CDTank'/name for name in ['CDTank.exe','gbengine.dll','msvcr71.dll']])
machine.mem_map(0,4096); machine.mem_map(0x2000000,0x80000)
NODE,GFX,HEAP,STACK,STOP=0x2010000,0x2020000,0x2030000,0x2040000,0x2050000
DELTA,OUTPUT,WRAPPER=0x2060000,0x2061000,0x2062000
heap=HEAP
# Supply only the allocator boundary; both original node constructors execute.
def hook(uc,address,size,data):
 global heap
 if address==0x1003bcec:
  stack=uc.reg_read(UC_X86_REG_ESP)
  count=struct.unpack('<I',uc.mem_read(stack+4,4))[0]
  uc.reg_write(UC_X86_REG_EAX,heap);heap+=(count+15)&~15
  from unicorn.x86_const import UC_X86_REG_EIP
  uc.reg_write(UC_X86_REG_EIP,struct.unpack('<I',uc.mem_read(stack,4))[0]);uc.reg_write(UC_X86_REG_ESP,stack+4)
 elif address==0x10005060:
  from unicorn.x86_const import UC_X86_REG_EIP
  stack=uc.reg_read(UC_X86_REG_ESP);uc.reg_write(UC_X86_REG_EAX,DELTA)
  uc.reg_write(UC_X86_REG_EIP,struct.unpack('<I',uc.mem_read(stack,4))[0]);uc.reg_write(UC_X86_REG_ESP,stack+4)
machine.hook_add(UC_HOOK_CODE,hook)
machine.mem_write(STACK,struct.pack('<I',STOP));machine.reg_write(UC_X86_REG_ESP,STACK)
machine.reg_write(UC_X86_REG_ECX,NODE);machine.reg_write(UC_X86_REG_FPCW,0x27f)
machine.emu_start(0x1000fe70,STOP,count=100000)
identity=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]
matrices=[list(struct.unpack('<16f',machine.mem_read(NODE+offset,64))) for offset in [0x7c,0xbc]]
assert matrices==[identity,identity]
machine.reg_write(UC_X86_REG_ESP,STACK);machine.reg_write(UC_X86_REG_EDI,GFX);machine.reg_write(UC_X86_REG_ESI,0)
machine.emu_start(0x10027f97,0x10027fe7,count=100)
graphics=list(struct.unpack('<5f',machine.mem_read(GFX+0x1a8,20)))
assert graphics==[struct.unpack('<f',struct.pack('<f',.2))[0]]*3+[1,0]
machine.mem_write(WRAPPER,b'\xe8'+struct.pack('<i',0x10028030-WRAPPER-5)+b'\xdd\x1d'+struct.pack('<I',OUTPUT)+b'\xc3')
delta_rows=[]
for delta in [0,.0001,.016,.1,.125,.25,.499999999,.5,.6,1,2]:
 machine.mem_write(DELTA+8,struct.pack('<d',delta));machine.mem_write(STACK,struct.pack('<I',STOP))
 machine.reg_write(UC_X86_REG_ESP,STACK);machine.emu_start(WRAPPER,STOP,count=1000)
 actual=struct.unpack('<d',machine.mem_read(OUTPUT,8))[0]
 assert actual==(delta if delta<.5 else .1)
 delta_rows.append(dict(input=delta,output=actual))
setters=[0x100033b0,0x10003410,0x10003440]
pe=images['gbengine.dll'];calls=[]
for section in pe.sections:
 if not section.Characteristics&0x20000000:continue
 data=section.get_data();base=pe.OPTIONAL_HEADER.ImageBase+section.VirtualAddress
 for offset in range(len(data)-4):
  if data[offset]==0xe8:
   target=base+offset+5+struct.unpack_from('<i',data,offset+1)[0]
   if target in setters:calls.append(hex(base+offset))
assert calls==[]
exe=images['cdtank.exe']
imports=[(s.name or b'').decode() for e in exe.DIRECTORY_ENTRY_IMPORT for s in e.imports]
assert not any('AmbientLight' in name or 'Emissive' in name for name in imports)
assert all(s.name is not None for e in exe.DIRECTORY_ENTRY_IMPORT for s in e.imports)
decoder=capstone.Cs(capstone.CS_ARCH_X86,capstone.CS_MODE_32)
evidence={name:[dict(va=hex(i.address),instruction=f'{i.mnemonic} {i.op_str}') for i in decoder.disasm(pe.get_data(start-0x10000000,end-start),start)]
 for name,start,end in [('polMeshReader',0x1001cbb0,0x1001cdfa),('polNodeConstruction',0x10012904,0x10012a22),
  ('geomConstructor',0x1000fe70,0x1000ff2f),('ambientInitializer',0x10027f97,0x10027fe7),
  ('effectBeginEnd',0x10026400,0x10026444),('effectApply',0x10026450,0x100264a4),
  ('engineDelta',0x10028030,0x1002804e),
  ('defaultEffectInit',0x10027660,0x10027673),('defaultEffectReset',0x10020466,0x10020474)]}
(ROOT/'recovery/output/effect-model-source-state-native.json').write_text(json.dumps(dict(matrices=matrices,graphics=graphics,deltaRows=delta_rows,setterCallSites=calls,evidence=evidence))+'\n')
print('PASS: complete original geom/base constructors yield two identity matrices; original ambient/emissive initializer; no DLL setter calls or EXE setter/ordinal imports')
