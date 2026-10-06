"""Original style notification routing and tank actor visibility gates."""
import json
import struct
import sys
from pathlib import Path
from capstone import Cs, CS_ARCH_X86, CS_MODE_32
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import *
ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0,str(ROOT/'recovery'))
from effect_native import map_original_binaries
machine, images = map_original_binaries([ROOT/'CDTank/CDTank.exe'])
machine.mem_map(0x2000000,0x20000)
GAME, MANAGER, MESSAGE, ROLE, ACTOR = [0x2000000+x for x in [0x1000,0x2000,0x3000,0x4000,0x5000]]
STACK, RETURN = 0x2010000,0x2011000
put=lambda a,v:machine.mem_write(a,struct.pack('<I',v))
put(0x633588,GAME);put(GAME+0x118,MANAGER)
rows=[]; context={}
def hook(uc,address,size,data):
    if address == 0x48a226:
        sp=uc.reg_read(UC_X86_REG_ESP)
        ret,role_id=struct.unpack('<2I',uc.mem_read(sp,8))
        context['lookups'].append(role_id)
        uc.reg_write(UC_X86_REG_EAX,ROLE if context['present'] else 0)
        uc.reg_write(UC_X86_REG_ESP,sp+8);uc.reg_write(UC_X86_REG_EIP,ret)
    elif address in [0x42a9dd,0x42a527]:
        sp=uc.reg_read(UC_X86_REG_ESP)
        count=2 if address==0x42a9dd else 1
        vals=struct.unpack('<'+str(count+1)+'I',uc.mem_read(sp,4*(count+1)))
        context['calls'].append(dict(function=hex(address),manager=uc.reg_read(UC_X86_REG_ECX),arguments=list(vals[1:])))
        uc.reg_write(UC_X86_REG_ESP,sp+4*(count+1));uc.reg_write(UC_X86_REG_EIP,vals[0])
handle=machine.hook_add(UC_HOOK_CODE,hook)
for kind,entry in [('change',0x4860a7),('original',0x4860e6)]:
    for present,actor_present in [(False,False),(True,False),(True,True)]:
        for style in ([1,2] if kind=='change' else [0]):
            context=dict(present=present,lookups=[],calls=[])
            put(ROLE+0x310,ACTOR if actor_present else 0)
            put(MESSAGE+0xc,style if kind=='change' else 73);put(MESSAGE+0x10,73)
            machine.mem_write(STACK,struct.pack('<4I',RETURN,MESSAGE,0,0))
            machine.reg_write(UC_X86_REG_ESP,STACK)
            machine.emu_start(entry,RETURN,count=100)
            assert machine.reg_read(UC_X86_REG_EIP)==RETURN
            expected=[]
            if present and actor_present:
                expected=[dict(function='0x42a9dd' if kind=='change' else '0x42a527',manager=MANAGER,arguments=[73,style] if kind=='change' else [73])]
            assert context['calls']==expected
            rows.append(dict(kind=kind,rolePresent=present,actorPresent=actor_present,style=style,**context))
machine.hook_del(handle)
# Execute the actual hidden-state setter call at the original change-style site.
put(ROLE+0x310,ACTOR);machine.mem_write(ACTOR+0x23d,b'\x01')
machine.reg_write(UC_X86_REG_ESI,ROLE);machine.reg_write(UC_X86_REG_EBX,0)
machine.reg_write(UC_X86_REG_ESP,STACK)
machine.emu_start(0x42aa42,0x42aa4e,count=30)
assert bytes(machine.mem_read(ACTOR+0x23d,1))==b'\x00'
# Both original tank renderers return without submitting anything when hidden.
render_rows=[]
for entry,visible_gate in [(0x4695bf,0x4695d5),(0x46cec7,0x46cedd)]:
    for visible in [0,1]:
        machine.mem_write(ACTOR+0x23d,bytes([visible]))
        put(STACK,RETURN);machine.reg_write(UC_X86_REG_ESP,STACK);machine.reg_write(UC_X86_REG_ECX,ACTOR)
        seen=[]
        def gate(uc,a,n,d):
            if a==visible_gate:seen.append('continued');uc.emu_stop()
        h=machine.hook_add(UC_HOOK_CODE,gate)
        machine.emu_start(entry,RETURN,count=30);machine.hook_del(h)
        assert seen==(['continued'] if visible else [])
        if not visible:assert machine.reg_read(UC_X86_REG_EIP)==RETURN
        render_rows.append(dict(entry=hex(entry),visible=visible,reachedDrawBody=bool(seen)))
# The existing restore setter is supplied with the same actual caller's value1.
machine.mem_write(STACK,struct.pack('<2I',RETURN,1));machine.reg_write(UC_X86_REG_ESP,STACK)
machine.reg_write(UC_X86_REG_ECX,ACTOR);machine.emu_start(0x464950,RETURN,count=20)
assert bytes(machine.mem_read(ACTOR+0x23d,1))==b'\x01'
pe=images['cdtank.exe'];base=pe.OPTIONAL_HEADER.ImageBase;c=Cs(CS_ARCH_X86,CS_MODE_32)
def code(a,b):return [{'va':hex(i.address),'instruction':f'{i.mnemonic} {i.op_str}'.strip(),'bytes':i.bytes.hex()} for i in c.disasm(pe.get_data(a-base,b-a),a)]
def text(a):return pe.get_data(a-base,100).split(b'\0')[0].decode()
result=dict(status='PASS_ORIGINAL_CHANGE_STYLE_RECEIVER_AND_VISIBILITY_GATES',receiverRows=rows,renderRows=render_rows,
    messageTypes={'change':0x4173,'original':0x4174},
    changeFields={'0xc':'style uint8 serialized by4898e2','0x10':'roleId uint32 serialized by4898e2'},
    models={'1':text(0x5c3a74),'2':text(0x5c3a68)},
    source={hex(a):code(a,b) for a,b in [(0x488b43,0x488bc8),(0x4860a7,0x486120),(0x42a9dd,0x42ab07),(0x42a527,0x42a5b9),(0x464950,0x46495d),(0x4898e2,0x48991c),(0x4695bf,0x4695d5),(0x46cec7,0x46cedd)]},
    scope='9 original receiver routing cases with role lookup and manager application supplied at boundaries; actual42aa42 hide setter call; four original render gates; actual visible setter. No complete world object allocation/draw, transport socket, Func8 authority or ordinary battle.',
    missing=['Func8 authority for activation/expiry/fire cancellation and consumption','Full replacement world object pose/update/render lifecycle and notification codec read remain to qualify before a formal consumer','No Func7/skill9 invisibility producer or self/team/enemy visibility policy proven'])
(ROOT/'recovery/output/role-change-style-receiver-native.json').write_text(json.dumps(result,indent=2)+'\n')
print(result['status']+': 9 routes, 4 draw gates, hide/restore setters')
