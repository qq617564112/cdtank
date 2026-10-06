"""Execute original Editbox property colour and text draw colour consumers."""
import json
import struct
import sys
from pathlib import Path
import capstone
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_EAX, UC_X86_REG_ECX, UC_X86_REG_EIP, UC_X86_REG_ESI, UC_X86_REG_EBP, UC_X86_REG_ESP
ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'recovery'))
from effect_native import map_original_binaries
BASE = 0x10000000
OBJ, STR, COLOUR, SYSTEM, FONT = 0x2001000, 0x2003000, 0x2004000, 0x2005000, 0x2006000
STACK, END, LOCAL = 0x2078000, 0x2090000, 0x2080000
base, images = map_original_binaries([ROOT/'CDTank/CEGUIBase.dll'])
look, look_images = map_original_binaries([ROOT/'CDTank/CEGUIWindowsLook.dll'])
for uc in [base, look]:
    uc.mem_map(0, 4096)
    uc.mem_map(0x2000000, 0x100000)

def write(uc, p, *v): uc.mem_write(p, struct.pack('<'+'I'*len(v), *v))
def read(uc, p): return struct.unpack('<I',uc.mem_read(p,4))[0]
def fs(uc, p, v): uc.mem_write(p,struct.pack('<f',v))
def f(uc,p): return struct.unpack('<f',uc.mem_read(p,4))[0]
def ret(uc, cleanup=0, value=None):
    sp=uc.reg_read(UC_X86_REG_ESP)
    if value is not None: uc.reg_write(UC_X86_REG_EAX,value)
    uc.reg_write(UC_X86_REG_EIP,read(uc,sp));uc.reg_write(UC_X86_REG_ESP,sp+4+cleanup)
def invoke(uc, entry, obj, args=()):
    stack=STACK+0x2000 if uc is look else STACK
    write(uc,stack,END,*args)
    uc.reg_write(UC_X86_REG_ESP,stack);uc.reg_write(UC_X86_REG_ECX,obj)
    uc.emu_start(entry,END,count=10000)
    assert uc.reg_read(UC_X86_REG_EIP)==END

def base_hook(uc,p,size,user):
    sp=uc.reg_read(UC_X86_REG_ESP)
    if p==0x100315b0: ret(uc)
    elif p==0x1002a960: ret(uc,value=STR)
    elif p==0x2090100:
        # CRT sscanf is an external provider; the native property and colour
        # constructors consume the parsed unsigned hexadecimal value.
        raw=bytes(uc.mem_read(read(uc,sp+4),9)).split(b'\0')[0].decode()
        write(uc,read(uc,sp+12),int(raw,16));ret(uc,value=1)
base.hook_add(UC_HOOK_CODE,base_hook)
write(base,0x1010f100,0x2090100)
base.mem_write(STR,b'00FFFFFF\0')
invoke(base,0x10058820,0x2007000,(OBJ,STR))
stored=[f(base,OBJ+0x3e8+d) for d in (0,4,8,12)]
assert stored==[0,1,1,1],stored
write(base,0x10197ca8,SYSTEM);write(base,SYSTEM+0x20,FONT)
fonts=[]
for explicit in [0,FONT+0x100]:
    write(base,OBJ+0x40,explicit)
    invoke(base,0x10030e50,OBJ)
    actual=base.reg_read(UC_X86_REG_EAX)
    assert actual==(explicit or FONT)
    fonts.append({'explicitFont':hex(explicit),'result':hex(actual)})
# Restore absent Font and use the source default Window alpha 1.
write(base,OBJ+0x40,0);fs(base,OBJ+0xe0,1)
alpha_vectors=[]
for alpha in [1,0.5]:
    fs(base,OBJ+0xe0,alpha)
    invoke(base,0x10030e60,OBJ)
    base.mem_write(END,b'\xd9\x1d'+struct.pack('<I',COLOUR+0x100))
    base.emu_start(END,END+6,count=1)
    actual=f(base,COLOUR+0x100)
    assert actual==alpha
    alpha_vectors.append({'windowAlpha':alpha,'effectiveAlpha':actual})
look.mem_write(0x2000000,bytes(base.mem_read(0x2000000,0x100000)))
# Original imported ColourRect operations execute in the Base machine.
exports={s.name.decode():BASE+s.address for s in images['ceguibase.dll'].DIRECTORY_ENTRY_EXPORT.symbols if s.name}
bridge={}
for d in look_images['ceguiwindowslook.dll'].DIRECTORY_ENTRY_IMPORT:
    for i in d.imports:
        if i.address in [0x1003d130,0x1003d148,0x1003d17c]:
            target=0x2091000+len(bridge)*16;write(look,i.address,target)
            bridge[target]=(exports[i.name.decode()],4)
draws=[]
def look_hook(uc,p,size,user):
    sp=uc.reg_read(UC_X86_REG_ESP)
    if p in bridge:
        entry,cleanup=bridge[p]
        args=(read(uc,sp+4),)
        destination=uc.reg_read(UC_X86_REG_ECX)
        base.mem_write(0x2000000,bytes(uc.mem_read(0x2000000,0x100000)))
        invoke(base,entry,uc.reg_read(UC_X86_REG_ECX),args)
        uc.mem_write(0x2000000,bytes(base.mem_read(0x2000000,0x100000)))
        if destination<0x2000000 or destination>=0x2100000:
            uc.mem_write(destination,bytes(base.mem_read(destination,24)))
        ret(uc,cleanup)
    elif p==0x2092000:
        colour=read(uc,sp+24)
        draws.append({'entry':'WLEditbox→Font::drawText','cornersARGB':[[f(uc,colour+i*24+d) for d in (0,4,8,12)] for i in range(4)]})
        uc.emu_stop()
look.hook_add(UC_HOOK_CODE,look_hook)
write(look,0x1003d128,0x2092000);write(look,0x1003d134,0x2093000)
fs(look,0x2093000,0)
# Execute actual WindowsLook static colour initializers and constructor copies.
for entry in [0x1003a400,0x1003a410,0x1003a430,0x1003a450]: invoke(look,entry,OBJ)
defaults={name:read(look,p+0x10) for name,p in [('normal',0x1007569c),('selected',0x1007566c),('activeSelection',0x10075654),('inactiveSelection',0x10075684)]}
look.reg_write(UC_X86_REG_ESI,OBJ)
look.emu_start(0x1000b4a9,0x1000b5c2,count=10000)
assert [f(look,OBJ+0x400+d) for d in (0,4,8,12)]==[0,1,1,1]
assert read(look,OBJ+0x428)==0x607fff
assert read(look,OBJ+0x440)==0x808080
# Layout property is applied after the WindowsLook constructor.
look.mem_write(OBJ+0x3e8,bytes(base.mem_read(OBJ+0x3e8,24)))
rows=[]
for name,entry,alpha in [('normal',0x1000a979,1),('selected',0x1000ac0a,1),('normalParentAlpha',0x1000a979,0.5),('selectedParentAlpha',0x1000ac0a,0.5)]:
    write(look,OBJ+0x3e4,0)
    fs(look,LOCAL+0x4c,alpha);write(look,LOCAL+0x24,SYSTEM)
    fs(look,SYSTEM+0x18+0x14,1)
    look.reg_write(UC_X86_REG_ESP,LOCAL)
    look.reg_write(UC_X86_REG_ESI,OBJ);look.reg_write(UC_X86_REG_EBP,FONT)
    look.reg_write(UC_X86_REG_EIP,entry)
    look.emu_start(entry,END,count=10000)
    row=draws[-1];row.update(state=name,effectiveAlpha=alpha)
    expected=[alpha,1,1,1]
    assert row['cornersARGB']==[expected]*4,row
    rows.append(row)
# Source text renderer has no isDisabled consumer; disabled still consumes the
# normal text branch. Preserve its complete source for the static boundary.
md=capstone.Cs(capstone.CS_ARCH_X86,capstone.CS_MODE_32)
parts=[]
for dll,ranges in [('CEGUIBase.dll',[(0x10058820,0x10058843),(0x1001caa0,0x1001cadc),(0x100556e0,0x10055770),(0x10030e50,0x10030e60),(0x10030e60,0x10030e89),(0x10002040,0x10002062)]),('CEGUIWindowsLook.dll',[(0x1003a400,0x1003a461),(0x1000b170,0x1000b5de),(0x1000a420,0x1000af47)])]:
    pe=(images if dll=='CEGUIBase.dll' else look_images)[dll.lower()]
    binary=pe.get_memory_mapped_image();parts.append(dll)
    for a,z in ranges: parts.extend(f'{i.address:08x} {i.mnemonic} {i.op_str}' for i in md.disasm(binary[a-BASE:z-BASE],a))
result={'status':'PASS','property':'NormalTextColour=00FFFFFF','storedARGB':stored,'defaults':{k:f'{v:08X}' for k,v in defaults.items()},'fontVectors':fonts,'alphaVectors':alpha_vectors,'drawVectors':rows,'scope':'Original property setter, native colour construction, WindowsLook static initializers/constructor colour copies, Window absent/explicit font lookup/effective alpha, and bounded original normal/selected text draw colour consumers through Font::drawText arguments.','providers':['CEGUI String C-string and CRT sscanf','System singleton/default font pointer','text/rect/layout locals and effectiveAlpha draw local; no glyph layout or GPU execution'],'disabled':'Complete WLEditbox draw source contains no disabled text colour branch; normal/selected colour paths use effective Window alpha.','boundary':'Font OS resolution/advance, selection geometry, native glyph rendering, original framebuffer and GPU remain unexecuted.'}
(ROOT/'recovery/output/room-create-input-native.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
(ROOT/'recovery/output/room-create-input-native.disasm.txt').write_text('\n'.join(parts)+'\n')
print('PASS: property, 2 font vectors, 4 original text colour draw vectors')
