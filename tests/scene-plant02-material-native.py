"""Execute original Plant instancing material ambient producer to draw boundary."""
import json,struct,sys
from pathlib import Path
import capstone
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import *
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'recovery'))
from effect_native import map_original_binaries
from pol import read_pol
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

BACKEND=0x2050000
put(MESH,0x1003f594)
put(MESH+0x3c,PARTS)
put(MESH+0x70,GFX)
put(MESH+0x74,BACKEND)
put(MESH+8,BACKEND)
put(GFX,VTABLE+0x200)
put(VTABLE+0x230,STOP+64)
put(BACKEND,VTABLE+0x400)
put(VTABLE+0x410,STOP+80)
put(PARTS+0x90,1)
properties=read_pol(ROOT/'recovery/output/verified/assets/data/Data/scnobj/obj05413/obj05413.POL')['meshes'][0]['parts'][0]['properties']
machine.mem_write(PARTS+0x4c,struct.pack('<17f',*properties))
put(INFO,NODE)
put(INFO+0xc,EFFECT)
put(INFO+0x1c,0x100000)
textureBindings=[];draws=[]
def boundary(uc,address,size,data):
    stack=uc.reg_read(UC_X86_REG_ESP)
    if address==STOP+64:
        textureBindings.append(u32(stack+4));finish(4)
    elif address==STOP+80:
        draws.append([u32(stack+i*4) for i in range(1,7)]);finish(24)
for endpoint in [STOP+64,STOP+80]:machine.hook_add(UC_HOOK_CODE,boundary,begin=endpoint,end=endpoint)
rows=[]
for rgb in [[.2,.2,.2],[1,1,1],[.4,.6,.8]]:
    machine.mem_write(GFX+0x1a8,struct.pack('<5f',*rgb,1,0))
    events.clear();put(STACK,STOP,0,INFO,1,80)
    machine.reg_write(UC_X86_REG_ESP,STACK);machine.reg_write(UC_X86_REG_ECX,MESH)
    try: machine.emu_start(0x1001c200,STOP,count=100000)
    except Exception as error:
        failure=dict(status='INCOMPLETE_PLANT_AMBIENT_DRAW_NATIVE',
            sourceMaterial='Data/scnobj/obj05413/obj05413.POL',
            sourceCallPath=['gbPlantNode.LoadFromFile10019bd0→NewMesh100279f0(type0)→gbStaticMesh',
                'gbPlantNode.Render100187b0→gbStaticMesh.DrawSubSetInstancing1001c200→1001b6f0'],
            flags='0x100000',observedEvents=list(events),
            terminal=hex(machine.reg_read(UC_X86_REG_EIP)),
            stack=hex(machine.reg_read(UC_X86_REG_ESP)),error=str(error),
            completedRows=rows,
            scope='Reached ambient parameter only; instancing GPU dispatch terminal unresolved.')
        (ROOT/'recovery/output/scene-plant02-material-native.json').write_text(json.dumps(failure,indent=2)+'\n')
        print('terminal',failure['terminal'],'esp',failure['stack'],'events',events);raise
    ambient=[e for e in events if e.get('handle')==104]
    assert len(ambient)==1
    expected=[struct.unpack('<f',struct.pack('<f',a*b))[0] for a,b in zip(rgb,properties[4:7])]+[properties[7]]
    assert ambient[0]['values']==expected
    rows.append(dict(graphics=rgb,properties=properties,ambient=ambient[0]['values']))
assert len(draws)==3 and len(textureBindings)==3
binary=images['gbengine.dll'].get_memory_mapped_image();decoder=capstone.Cs(capstone.CS_ARCH_X86,capstone.CS_MODE_32)
ranges={'PlantLoadNewMesh':(0x19d9d,0x19ddf),'NewStaticMesh':(0x279f0,0x27a45),'PlantRenderInstancing':(0x188e6,0x1890d),'PlantFlags':(0x19666,0x196c8),'StaticInstancingMaterial':(0x1c200,0x1c265)}
source={name:[dict(address=hex(i.address),instruction=f'{i.mnemonic} {i.op_str}') for i in decoder.disasm(binary[a:b],0x10000000+a)] for name,(a,b) in ranges.items()}
result=dict(status='PASS_PLANT_AMBIENT_NATIVE_ONLY',rows=rows,draws=draws,source=source,shader=(ROOT/'recovery/output/verified/assets/data/Data/gfxscript/plant80.gbf').read_text(),scope='Original gbStaticMesh DrawSubSetInstancing and1001b6f0 ambient setup. Source PlantLoad NewMesh type0/static vtable and PlantRender vslot8 recorded; sourcePOL material supplied. Texture setter and GPU draw/D3DX COM endpoints recorded; not complete loader or GPU.')
(ROOT/'recovery/output/scene-plant02-material-native.json').write_text(json.dumps(result,indent=2)+'\n')
print('PASS_PLANT_AMBIENT_NATIVE_ONLY: three graphics ambient inputs reach original parameter4 and draw boundary')
