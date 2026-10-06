"""Execute MV3 render-info selection and shader parameters for source materials."""
import json
from pathlib import Path
import struct
import sys
import capstone
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_EAX, UC_X86_REG_ECX, UC_X86_REG_EIP, UC_X86_REG_ESP, UC_X86_REG_FPCW

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'recovery'))
from effect_native import map_original_binaries
from mv3 import read_mv3
machine, images = map_original_binaries([ROOT / 'CDTank/gbengine.dll', ROOT / 'CDTank/msvcr71.dll'])
machine.mem_map(0, 4096)
machine.mem_map(0x2000000, 0x100000)
GFX, ACTOR, MESH, PARTS, MATERIALS, INFO, NODE, MATRIX_STACK, MATRIX, EFFECT, D3DX, VTABLE, STACK, STOP = [0x2010000+i*0x2000 for i in range(14)]
def u32(address):
    return struct.unpack('<I', machine.mem_read(address, 4))[0]
def put(address, *values):
    machine.mem_write(address, struct.pack('<'+'I'*len(values), *values))
def finish(pop=0):
    stack = machine.reg_read(UC_X86_REG_ESP)
    machine.reg_write(UC_X86_REG_EIP, u32(stack))
    machine.reg_write(UC_X86_REG_ESP, stack+4+pop)
events = []
def hook(uc, address, size, data):
    stack = uc.reg_read(UC_X86_REG_ESP)
    if address == 0x1001a110:
        uc.reg_write(UC_X86_REG_EAX, INFO)
        finish(4)
    elif address == 0x1001a250:
        finish(12)
    elif address == 0x10026d70:
        events.append(dict(kind='effectLookup', flag=u32(stack+4)))
        uc.reg_write(UC_X86_REG_EAX, EFFECT)
        finish(4)
    elif address == STOP+16:
        handle, pointer, raw_count = u32(stack+8), u32(stack+12), u32(stack+16)
        count = 64 if handle == 100 else 16
        events.append(dict(kind='D3DXSetValue', handle=handle, byteCountArgument=raw_count,
            values=list(struct.unpack('<'+'f'*(count//4), uc.mem_read(pointer, count)))))
        finish(16)
    elif address == STOP+32:
        events.append(dict(kind='D3DXCommitChanges'))
        finish(4)
machine.hook_add(UC_HOOK_CODE, hook)
identity=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]
put(0x10053380,GFX)
put(GFX+0xd4,MATRIX_STACK)
put(GFX+0xd0,MATRIX_STACK)
put(MATRIX_STACK,MATRIX,1,0,0)
machine.mem_write(MATRIX,struct.pack('<16f',*identity))
# This slice is the original initialization of ambient RGB/alpha/emissive.
from unicorn.x86_const import UC_X86_REG_EDI, UC_X86_REG_ESI
machine.reg_write(UC_X86_REG_EDI,GFX)
machine.reg_write(UC_X86_REG_ESI,0)
machine.emu_start(0x10027f97,0x10027fe7,count=100)
graphics=list(struct.unpack('<5f',machine.mem_read(GFX+0x1a8,20)))
put(ACTOR+0x190,1)
put(ACTOR+0x1bc,MESH)
put(ACTOR+0x1c0,MATERIALS)
put(MESH+0x44,1)
put(MESH+0x68,PARTS)
put(PARTS,0)
put(NODE+0x4c,0x3f800000,0)
put(EFFECT+0x14,D3DX)
for index in range(10):put(EFFECT+0x20+index*4,index+100)
put(D3DX,VTABLE)
put(VTABLE+0x50,STOP+16)
put(VTABLE+0x104,STOP+32)
rows=[]
asset_root=ROOT/'recovery/output/verified/assets/data/Data'
fixtures=[str(p.relative_to(asset_root)) for p in sorted(asset_root.rglob('*')) if p.suffix.lower()=='.mv3']
for relative in fixtures:
    source=read_mv3(ROOT/'recovery/output/verified/assets/data/Data'/relative)
    for index,material in enumerate(source['materials']):
        machine.mem_write(MATERIALS,struct.pack('<17f',*material['properties']))
        # Source actor visibility/transparency flag is provided explicitly;
        # ordinary no-light/no-fog scenarios retain the source alpha decision.
        for alpha_test_enabled in (0,1):
            for opacity in (1,.45):
                machine.mem_write(NODE+0x4c,struct.pack('<fI',opacity,int(opacity<1)))
                put(STACK,STOP,alpha_test_enabled)
                machine.reg_write(UC_X86_REG_ESP,STACK)
                machine.reg_write(UC_X86_REG_ECX,ACTOR)
                machine.emu_start(0x1000ae70,STOP,count=100)
                assert machine.mem_read(ACTOR+0x198,1)==bytes([alpha_test_enabled])
                machine.mem_write(INFO,bytes(0x200))
                put(STACK,STOP,NODE,0,0)
                machine.reg_write(UC_X86_REG_ESP,STACK)
                machine.reg_write(UC_X86_REG_ECX,ACTOR)
                machine.reg_write(UC_X86_REG_FPCW,0x37f)
                events.clear()
                machine.emu_start(0x1000d570,STOP,count=100000)
                flags=u32(INFO+0x1c)
                assert flags in (1,0x81), (relative,index,flags)
                assert u32(INFO+0xc)==EFFECT
                assert u32(INFO+0x10)==MATERIALS+0x44
                # Preserve the selected original RenderInfo when executing the
                # material setup. Only its node pointer is filled here.
                put(INFO,NODE)
                put(STACK,STOP,INFO,GFX,MATERIALS)
                machine.reg_write(UC_X86_REG_ESP,STACK)
                machine.emu_start(0x1001b6f0,STOP,count=100000)
                ambient=[e for e in events if e['kind']=='D3DXSetValue' and e['handle']==104]
                assert len(ambient)==1
                expected=[graphics[i]*material['properties'][4+i]+graphics[4]*material['properties'][12+i] for i in range(3)]
                assert abs(ambient[0]['values'][3]-opacity*material['properties'][7])<1e-7
                assert all(abs(a-b)<1e-7 for a,b in zip(ambient[0]['values'][:3],expected))
                rows.append(dict(asset=relative,material=index,properties=material['properties'],
                    actorAlphaTestEnabled=alpha_test_enabled,nodeOpacity=opacity,graphics=graphics,flags=flags,
                    sourceBinding='geom_t.gbf' if flags==0x81 else 'newgeom.gbf',events=list(events)))
image=images['gbengine.dll'].get_memory_mapped_image()
c=capstone.Cs(capstone.CS_ARCH_X86,capstone.CS_MODE_32)
ranges={'mv3RenderInfo':(0xd570,0xd81c),'mv3Submission':(0xe741,0xe7c0),
        'effectInitBindings':(0x271fd,0x2724c),'effectFileCompiler':(0x266c0,0x26750),
        'effectBeginEnd':(0x26400,0x26444),'effectBeginPass':(0x26890,0x268c2),
        'materialSetup':(0x1b6f0,0x1c193),'defaultApplyInit':(0x27660,0x27673),
        'defaultApplyReset':(0x20466,0x20474),'actorByteSetter':(0xae70,0xae7b),
        'actorIndexedSetter':(0xd3c0,0xd3d7),'emptyTextureLoader':(0xb980,0xb9b5),
        'whiteTextureInit':(0x271b0,0x271e4),'whiteTextureGetter':(0x26750,0x26754)}
disassembly={name:[f'{i.address:08x} {i.mnemonic} {i.op_str}' for i in c.disasm(image[a:b],0x10000000+a)] for name,(a,b) in ranges.items()}
scripts={name:(ROOT/'recovery/output/verified/assets/data/Data/gfxscript'/name).read_text() for name in ['default.gbf','newgeom.gbf','geom_t.gbf']}
assert 'NormalizeNormals = False' in scripts['default.gbf']
for name in ['newgeom.gbf','geom_t.gbf']:
    assert 'output.Diffuse = ambient;' in scripts[name]
    assert 'VertexShader = compile vs_1_1 mainvs();' in scripts[name]
    assert scripts[name].count('normal')==1
output=dict(rows=rows,disassembly=disassembly,scripts=scripts,
    boundary='ID3DXEffect SetValue/CommitChanges executed to COM boundary; original D3DX BeginPass and D3D SetRenderState not emulated',
    scope='All 745 MV3 / 816 source materials with original initialized ambient, zero selected lights, no fog, actor alpha-test flag 0/1 and node opacity 1/.45')
(ROOT/'recovery/output/mv3-normal-d3d-state-sol-native.json').write_text(json.dumps(output,indent=2)+'\n')
print(f'PASS: {len(rows)} MV3 material/flag original render-info and COM parameter executions; '
      f'flags {sorted({r["flags"] for r in rows})}, original ambient {graphics}')
