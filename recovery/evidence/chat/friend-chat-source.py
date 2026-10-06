"""Execute the original friend selector and retain its static send chain."""
import json
from pathlib import Path
import struct
import sys
import capstone
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import *

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'recovery'))
from effect_native import map_original_binaries
uc, images = map_original_binaries([ROOT / 'CDTank/CDTank.exe'])
uc.mem_map(0, 0x1000)
uc.mem_map(0x2000000, 0x50000)
HUD, EVENT, OBSERVER, VTABLE, STACK, RETURN = [0x2001000 + i * 0x2000 for i in range(6)]
VISIBLE, CHILD, REMOVE, NOTIFY, SOUND, MUTE, SELECTED, ADD, FRONT = [0x2030000+i*0x100 for i in range(9)]
controls = {offset: 0x2020000+i*0x100 for i, offset in enumerate(
    [0x84, 0x94, 0x98, 0x9c, 0xa0, 0xa4, 0xa8, 0xac, 0xb0, 0xb4, 0xb8, 0xbc,
     0x678, 0x67c, 0x680, 0x684, 0x688, 0x68c])}

def write(address, *values):
    uc.mem_write(address, struct.pack('<'+'I'*len(values), *values))
def read(address):
    return struct.unpack('<I', uc.mem_read(address,4))[0]
def finish(pop=0, value=0):
    sp=uc.reg_read(UC_X86_REG_ESP)
    uc.reg_write(UC_X86_REG_EAX,value)
    uc.reg_write(UC_X86_REG_EIP,read(sp))
    uc.reg_write(UC_X86_REG_ESP,sp+4+pop)

events=[]
def hook(machine,address,size,data):
    sp=machine.reg_read(UC_X86_REG_ESP)
    this=machine.reg_read(UC_X86_REG_ECX)
    if address==0x4d650b:
        finish()
    elif address==CHILD:
        finish(4,1)
    elif address in [VISIBLE, REMOVE, NOTIFY, MUTE, SELECTED, ADD]:
        events.append(dict(kind={VISIBLE:'visible',REMOVE:'remove',NOTIFY:'channelNotify',
            MUTE:'eventMute',SELECTED:'selected',ADD:'add'}[address],control=this,value=read(sp+4)))
        finish(4)
    elif address==FRONT:
        finish()
for address in [0x4d650b,VISIBLE,CHILD,REMOVE,NOTIFY,MUTE,SELECTED,ADD,FRONT]:
    uc.hook_add(UC_HOOK_CODE,hook,begin=address,end=address)
for offset,control in controls.items():write(HUD+offset,control)
write(HUD+0x904,OBSERVER)
write(OBSERVER,VTABLE)
write(VTABLE+8,NOTIFY)
for address,stub in [(0x5c0260,VISIBLE),(0x5c024c,CHILD),(0x5c0228,REMOVE),
    (0x5c0248,MUTE),(0x5c0210,SELECTED),(0x5c0220,ADD),(0x5c0244,FRONT)]:write(address,stub)

def invoke(callback):
    write(STACK,RETURN,EVENT)
    uc.reg_write(UC_X86_REG_ESP,STACK)
    uc.reg_write(UC_X86_REG_ECX,HUD)
    uc.emu_start(callback,RETURN,count=5000)
    assert uc.reg_read(UC_X86_REG_EIP)==RETURN
    assert uc.reg_read(UC_X86_REG_ESP)==STACK+8

selector=[]
for offset,channel in [(0x684,3)]:
    for selected in [False,True]:
        events.clear()
        write(HUD+0x908,1)
        write(EVENT+8,controls[offset])
        uc.mem_write(controls[offset]+0x38c,bytes([int(selected)]))
        invoke(0x4cbe44)
        assert read(HUD+0x908)==(channel if selected else 1)
        if selected:
            assert dict(kind='channelNotify',control=OBSERVER,value=channel) in events
            expected_button=controls[0xa0]
            assert dict(kind='visible',control=expected_button,value=1) in events
            assert dict(kind='visible',control=controls[0xb8],value=1) in events
            assert dict(kind='visible',control=controls[0xbc],value=0) in events
            assert events[-1]==dict(kind='remove',control=controls[0x84],value=controls[0x678])
        else: assert not events
        selector.append(dict(controlOffset=hex(offset),selected=selected,channelAfter=read(HUD+0x908),events=events[:]))
events.clear()
write(HUD+0x908,3)
invoke(0x4cb05d)
assert read(HUD+0x908)==3
assert len([e for e in events if e['kind']=='selected'])==5

binary=images['cdtank.exe'].get_memory_mapped_image()
md=capstone.Cs(capstone.CS_ARCH_X86,capstone.CS_MODE_32)
ranges=[(0x4c9a15,0x4c9a4f),(0x4c9ad4,0x4c9b0e),(0x4ca300,0x4ca33a),
    (0x4ca3ae,0x4ca3e8),(0x4d4667,0x4d4699),(0x4d47bb,0x4d47ed),
    (0x4d48ba,0x4d48ec),(0x4d49b9,0x4d49eb),(0x4cb05d,0x4cb169),
    (0x4cbe44,0x4cbf55),(0x4cc0ca,0x4cc17a),(0x4cc223,0x4cc295),
    (0x4d4a40,0x4d4ba2),(0x4d332f,0x4d339f),(0x4d35a5,0x4d3613),
    (0x49139e,0x4913f9),(0x48dcc5,0x48ddc0),(0x48d338,0x48d33e),(0x48d3e3,0x48d3e9),(0x4cc023,0x4cc0ca),(0x48da02,0x48da48),(0x48e34b,0x48e384),(0x490983,0x4909bc)]
result=dict(status='PASS',selectors=selector,buttonCallbackEvents=events,
    callbacks=dict(btnFriend='0x4cb05d',rdoFriend='0x4cbe44',inputAccept='0x4d332f'),
    channelField='HUD +0x908',channels=dict(friend=3),messageChannelField='+0x48',
    sendPaths=dict(friend='0x4d332f -> 0x4912c5 channel3 -> 0x48da02 -> 0x413ec4'),
    execution='Complete original selector/open callbacks; CEGUI/button-event/channel observer boundaries supplied. Input acceptance and sending are static original disassembly evidence.',
    unproven=['Full original input conversion/message serialization and server recipient routing',
        'Native friend recipients and full message filtering channel scope'],
    disassembly={hex(a):[f'{i.address:08x} {i.mnemonic} {i.op_str}' for i in md.disasm(binary[a-0x400000:z-0x400000],a)] for a,z in ranges})
out=ROOT/'recovery/output/friend-chat-source.json'
out.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print('PASS: original friend3 selector and static friend send chain')
