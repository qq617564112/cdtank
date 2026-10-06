"""Execute original skill field loading and client target classification boundaries."""
import json
from pathlib import Path
import struct
import sys
import capstone
import pefile
from unicorn import UC_HOOK_CODE, UC_HOOK_MEM_READ
from unicorn.x86_const import UC_X86_REG_EAX, UC_X86_REG_EBP, UC_X86_REG_ECX, UC_X86_REG_EIP, UC_X86_REG_ESP

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'recovery'))
from effect_native import map_original_binaries
from inspect_assets import read_table

uc, _ = map_original_binaries([ROOT / 'CDTank/CDTank.exe'])
uc.mem_map(0x2000000, 0x30000)
GAME, OWNER, ROLE, OTHER, VTABLE = [0x2001000 + 0x1000*i for i in range(5)]
ITEM, SKILL, CELL, ARRAY, STACK, RETURN = [0x2007000 + 0x1000*i for i in range(6)]
ARRAY_GETTER = 0x200e000
uc.mem_map(0, 0x1000)
phase, source, calls, reads = '', None, [], []
team_other = 1
lookup_item = True
lookup_skill = True

def write(address, *values):
    uc.mem_write(address, struct.pack('<' + 'I'*len(values), *[v & 0xffffffff for v in values]))

def read(address):
    return struct.unpack('<I', uc.mem_read(address, 4))[0]

def hook(machine, address, size, data):
    stack = machine.reg_read(UC_X86_REG_ESP)
    pop = 0
    if address == 0x4391c4:
        column, kind = read(stack + 4), read(stack + 8)
        assert kind in [0,5]
        write(CELL, int(source[column]) if kind == 0 else 0)
        value, pop = CELL, 8
        calls.append(dict(va=hex(address), column=column, value=int(source[column]) if kind == 0 else source[column]))
    elif address == 0x42362c and phase == 'target':
        # The complete item resolver is exercised separately below.
        value, pop = ITEM if lookup_item else 0, 4
        calls.append(dict(va=hex(address), boundary='item definition', value=value))
    elif address == 0x411068:
        value, pop = SKILL if lookup_skill else 0, 4
        calls.append(dict(va=hex(address), skillId=read(stack+4), value=value))
    elif address == ARRAY_GETTER:
        assert read(stack+4) == 0
        value, pop = ARRAY, 4
    elif address == 0x43d728:
        assert read(stack+4) == 77
        value, pop = ITEM, 4
        calls.append(dict(va=hex(address), boundary='owned instance lookup', value=value))
    elif address == 0x43bdbd:
        raise AssertionError('default ammo branch is outside selected-instance fixture')
    else:
        return
    machine.reg_write(UC_X86_REG_EAX, value)
    machine.reg_write(UC_X86_REG_EIP, read(stack))
    machine.reg_write(UC_X86_REG_ESP, stack+4+pop)

uc.hook_add(UC_HOOK_CODE, hook)

def memread(machine, access, address, size, value, data):
    reads.append(dict(va=hex(machine.reg_read(UC_X86_REG_EIP)), offset=hex(address-SKILL), size=size))

uc.hook_add(UC_HOOK_MEM_READ, memread, begin=SKILL, end=SKILL+0x19f)

def execute(address, this, args):
    calls.clear(); reads.clear()
    write(STACK, RETURN, *args)
    uc.reg_write(UC_X86_REG_ESP, STACK)
    uc.reg_write(UC_X86_REG_EBP, 0x1234)
    uc.reg_write(UC_X86_REG_ECX, this)
    uc.emu_start(address, RETURN, count=20000)
    assert uc.reg_read(UC_X86_REG_EIP) == RETURN
    assert uc.reg_read(UC_X86_REG_ESP) == STACK+4+4*len(args)
    assert uc.reg_read(UC_X86_REG_EBP) == 0x1234
    return uc.reg_read(UC_X86_REG_EAX)

skills = read_table(ROOT / 'CDTank/Data/table/skill.dat')
fields = {'Target':0x30, 'TriggerType':0x2c, 'HP':0xec,
          **{f'FuncType{i+1}':0x158+4*i for i in range(3)},
          **{f'Func{p}{i+1}':offset+4*i for p,offset in [('T',0x164),('X',0x170),('Y',0x17c),('Z',0x188)] for i in range(3)}}
loader_rows = []
# Begin at the TriggerType load; the preceding ID/name/string header is not needed.
for row in skills['rows']:
    source = [row['values'][name] for name in skills['columns']]
    phase = 'loader'
    uc.mem_write(SKILL, bytes(0x1a0))
    # Start after the header prologue; supply its saved frame and registers.
    calls.clear(); reads.clear()
    write(STACK-0x20, 0, 0, 0)
    write(STACK, 0x1234, RETURN, 0)
    uc.reg_write(UC_X86_REG_EBP, STACK)
    uc.reg_write(UC_X86_REG_ESP, STACK-0x14)
    uc.reg_write(UC_X86_REG_ECX, SKILL)
    from unicorn.x86_const import UC_X86_REG_ESI, UC_X86_REG_EBX, UC_X86_REG_EDI
    uc.reg_write(UC_X86_REG_ESI, SKILL)
    uc.reg_write(UC_X86_REG_EBX, 0)
    uc.reg_write(UC_X86_REG_EDI, 5)
    # Numeric loader is interrupted at string calls, preserving their return contract.
    string_hook = uc.hook_add(UC_HOOK_CODE, lambda m,a,s,d: (m.reg_write(UC_X86_REG_EIP,read(m.reg_read(UC_X86_REG_ESP))),m.reg_write(UC_X86_REG_ESP,m.reg_read(UC_X86_REG_ESP)+8)), begin=0x401609,end=0x401609)
    uc.emu_start(0x43ac31, RETURN, count=20000)
    uc.hook_del(string_hook)
    assert uc.reg_read(UC_X86_REG_EIP) == RETURN
    observed = {name:read(SKILL+offset) for name,offset in fields.items()}
    assert observed == {name:int(row['values'][name]) & 0xffffffff for name in fields}, (observed, {name:row['values'][name] for name in fields})
    phase = 'passive'
    accepted = bool(execute(0x432b29, 0, [SKILL]) & 255)
    expected = observed['TriggerType']==0 and any(observed[f'FuncType{i}']==1 and observed[f'FuncT{i}']==65535 for i in range(1,4))
    assert accepted == expected
    loader_rows.append(dict(skillId=int(row['values']['SkillTableID']), fields=observed, passive=accepted, predicateReads=list(reads)))

write(0x633588,GAME); write(GAME+0x118,OWNER);write(GAME+0x120,OWNER)
write(ROLE,VTABLE);write(OTHER,VTABLE)
write(VTABLE+0x14,0x422b64);write(VTABLE+0x18,0x432349);write(VTABLE+0x20,ARRAY_GETTER)
write(ROLE+0x2a0,CELL);write(OTHER+0x2a0,CELL+0x100);write(CELL+0x3c,2);write(CELL+0x5c,1);write(ARRAY,77)
phase='resolver'
resolver_rows=[]
for item_id in [1,2,2001,2002]:
    write(ITEM+0xc,item_id)
    result=execute(0x42362c, OWNER, [ROLE])
    assert (result==0) == (item_id in [1,2])
    resolver_rows.append(dict(itemId=item_id,result=hex(result),calls=list(calls)))

phase='target'
target_rows=[]
for target in range(1,7):
    for team_other in [1,2]:
        write(ITEM+0x108,1,0,0);write(SKILL+0x30,target);write(CELL+0x15c,team_other)
        result=bool(execute(0x4363db, OWNER, [ROLE,OTHER])&255)
        assert result == (target==5 or team_other!=1)
        target_rows.append(dict(target=target,teamIds=[1,team_other],result=result,calls=list(calls),skillReads=list(reads)))

pe=pefile.PE(str(ROOT/'CDTank/CDTank.exe'))
base=pe.OPTIONAL_HEADER.ImageBase
decoder=capstone.Cs(capstone.CS_ARCH_X86,capstone.CS_MODE_32)
decoder.detail=True
static={}
for name,start,end in [('loader',0x43ac31,0x43af61),('passive',0x432b29,0x432b78),('itemResolver',0x42362c,0x4236aa),('targetFilter',0x4363db,0x436444),('selector17Comparator',0x43538e,0x4353b4),('networkGetter',0x422b64,0x422b88),('baseGetter',0x432417,0x4324d4),('itemClass',0x439762,0x4397c6)]:
    static[name]=[dict(va=hex(i.address),bytes=i.bytes.hex(),instruction=f'{i.mnemonic} {i.op_str}') for i in decoder.disasm(pe.get_data(start-base,end-start),start)]
refs={}
for section in pe.sections:
    data=section.get_data()
    for va in [0x4363db,0x42362c,0x432b29]:
        needle=struct.pack('<I',va)
        pos=data.find(needle)
        while pos>=0:
            refs.setdefault(hex(va),[]).append(hex(base+section.VirtualAddress+pos))
            pos=data.find(needle,pos+1)
# Reuse only the existing fixture definitions, without its execution/export section.
request_env = {'__file__': str(ROOT/'tests/item-use-native.py')}
request_source = (ROOT/'tests/item-use-native.py').read_text().split('rows = []')[0]
exec(compile(request_source, str(ROOT/'tests/item-use-native.py'), 'exec'), request_env)
request_uc = request_env['uc']
request_trace, profile_reads = [], []
def request_code(machine,address,size,data):
    request_trace.append(address)
def request_read(machine,access,address,size,value,data):
    profile_reads.append(dict(va=hex(machine.reg_read(UC_X86_REG_EIP)),offset=hex(address-request_env['PROFILE']),size=size))
request_uc.hook_add(UC_HOOK_CODE,request_code)
request_uc.hook_add(UC_HOOK_MEM_READ,request_read,begin=request_env['PROFILE'],end=request_env['PROFILE']+0x13f)
request_rows=[]
for item_id in [1,2]:
    for hp in [100,1000]:
        for permission in [0,1]:
            request_trace.clear();profile_reads.clear()
            # Existing execute clears its role/profile fixture; initialize HP immediately after that clear.
            def seed_hp(machine,address,size,data):
                request_env['write'](request_env['PROFILE']+0x54,hp,1000)
            seed_hook=request_uc.hook_add(UC_HOOK_CODE,seed_hp,begin=0x43d4dc,end=0x43d4dc)
            request_result=request_env['execute']('use',item_id,3,permission=permission)
            request_uc.hook_del(seed_hook)
            assert request_result['accepted'] and request_result['trapPermission']==permission
            assert all(row['offset']=='0x90' for row in profile_reads)
            assert 0x413c65 not in request_trace and 0x432b29 not in request_trace and 0x433250 not in request_trace
            request_rows.append(dict(itemId=item_id,hp=hp,maxHp=1000,permission=permission,result=request_result,
                                     profileReads=list(profile_reads),executedAddresses=[hex(v) for v in sorted(set(request_trace))]))

asm_lines=(ROOT/'recovery/output/current-exe.asm').read_text().splitlines()
getter_sites=[dict(va=line.split()[0],context=asm_lines[max(0,index-4):index+24]) for index,line in enumerate(asm_lines) if line.endswith('call 0x413c65')]
result=dict(status='PASS',scope='Original numeric table loader and passive predicate for342 skills; complete selected-instance item resolver with supplied instance lookup; complete Target filter with supplied item/skill definitions and real network role/team getter. No authority producer or healing dispatch claimed.',directSkillGetterSites=getter_sites,fieldOffsets={k:hex(v) for k,v in fields.items()},loaderRows=loader_rows,requestRows=request_rows,resolverRows=resolver_rows,targetRows=target_rows,instructions=static,absolutePointerReferences=refs)
(ROOT/'recovery/output/healing-dispatch-sol-native.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print('PASS:342 original field loads/passive predicates;4 selected-instance item resolutions;12 Target filter branches;8 traced feed requests')
