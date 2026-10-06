"""Execute type2 original endpoint and local/world segment generation."""
import json
from pathlib import Path
import struct
import sys
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_ECX, UC_X86_REG_ESP, UC_X86_REG_EIP, UC_X86_REG_EAX, UC_X86_REG_FPCW
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'recovery'))
from effect_native import map_original_binaries
machine,_=map_original_binaries([ROOT/'CDTank'/name for name in ['CDTank.exe','gbengine.dll','msvcr71.dll']])
machine.mem_map(0,0x1000);machine.mem_map(0x2000000,0x80000)
OBJECT,DEFINITION,RESOURCE,SEGMENTS,STACK,STOP=0x2010000,0x2011000,0x2015000,0x2020000,0x2008000,0x203f000
library=json.loads((ROOT/'recovery/output/web-assets/effect-library.json').read_text())
random_values=[];random_index=0
random_seed=[8191,24575,16383,1000]
def uint(a):return struct.unpack('<I',machine.mem_read(a,4))[0]
def hook(uc,a,size,data):
    global random_index
    if a==0x57cbcb:
        v=random_seed[random_index%len(random_seed)];random_index+=1;random_values.append(v)
        stack=uc.reg_read(UC_X86_REG_ESP);uc.reg_write(UC_X86_REG_EAX,v);uc.reg_write(UC_X86_REG_EIP,uint(stack));uc.reg_write(UC_X86_REG_ESP,stack+4)
machine.hook_add(UC_HOOK_CODE,hook)
rows=[]
for node in library['nodes']:
    if node['type']!=2:continue
    raw=bytes.fromhex(node['resource'])
    for origin in [[0,0,0],[12.5,-3.75,21]]:
        machine.mem_write(OBJECT,bytes(0x100));machine.mem_write(DEFINITION,bytes(0x180));machine.mem_write(RESOURCE,bytes(0x200))
        machine.mem_write(OBJECT+12,struct.pack('<I',DEFINITION));machine.mem_write(DEFINITION+0x150,struct.pack('<I',RESOURCE))
        machine.mem_write(OBJECT+0x14,struct.pack('<3f',*origin));machine.mem_write(OBJECT+0x70,struct.pack('<I',SEGMENTS));machine.mem_write(OBJECT+0x80,struct.pack('<I',0x2030000));machine.mem_write(RESOURCE+0x148,raw[324:])
        random_index=0
        for _ in range(4):
            random_values.clear();machine.mem_write(STACK,struct.pack('<I',STOP))
            machine.reg_write(UC_X86_REG_ESP,STACK);machine.reg_write(UC_X86_REG_ECX,OBJECT);machine.reg_write(UC_X86_REG_FPCW,0x27f)
            machine.emu_start(0x47e161,STOP,count=1000000)
            count=uint(OBJECT+0x68)
            segments=[list(struct.unpack('<3f',machine.mem_read(SEGMENTS+i*12,12))) for i in range(count)]
            config=next(c for c in library['boltControls'] if c['node']==node['index'])
            rows.append(dict(node=node['index'],config=config,origin=origin,start=list(struct.unpack('<3f',machine.mem_read(OBJECT+0x40,12))),end=list(struct.unpack('<3f',machine.mem_read(OBJECT+0x4c,12))),randomValues=list(random_values),segments=segments,worldSegments=[list(struct.unpack('<10f',machine.mem_read(0x2030000+i*40,40))) for i in range(count)]))
(ROOT/'recovery/output/effect-bolt-segments-native.json').write_text(json.dumps(dict(rows=rows))+'\n')
print(f'PASS: {len(rows)} source type2 endpoint/random segment samples')
