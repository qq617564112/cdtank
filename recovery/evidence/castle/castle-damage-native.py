"""Execute Castle45d16f with model, effect-manager and audio recording boundaries."""
import json, struct, sys
from pathlib import Path
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_EAX, UC_X86_REG_ECX, UC_X86_REG_EIP, UC_X86_REG_ESP
ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'recovery'))
from effect_native import map_original_binaries
u, images = map_original_binaries([ROOT / 'CDTank' / n for n in ['CDTank.exe', 'gbengine.dll', 'msvcr71.dll']])
u.mem_map(0, 4096)
u.mem_map(0x2000000, 0x100000)
OBJ, MODEL, TAGS, MANAGER, STACK, STOP, ACTION, SOUND = [0x2010000 + i * 0x1000 for i in range(8)]
def w(a, *v): u.mem_write(a, struct.pack('<' + 'I' * len(v), *[x & 0xffffffff for x in v]))
def r(a): return struct.unpack('<I', u.mem_read(a, 4))[0]
def text(a): return bytes(u.mem_read(a, 160)).split(b'\0')[0].decode('ascii')
def finish(value=0, pop=0):
    s = u.reg_read(UC_X86_REG_ESP)
    u.reg_write(UC_X86_REG_EAX, value)
    u.reg_write(UC_X86_REG_EIP, r(s))
    u.reg_write(UC_X86_REG_ESP, s + 4 + pop)
events = []
handle = 100
w(OBJ, 0x5c72b0)
w(OBJ + 0xd8, MODEL)
w(OBJ + 0x78, MODEL, 0)
u.mem_write(OBJ + 0x58, struct.pack('<3f', 12.5, 20, -77))
for i in range(5):
    tag = TAGS + i * 0x80
    w(OBJ + 0x110 + i * 8, tag, 0)
    u.mem_write(tag + 0x30, struct.pack('<3f', 100 + i, 30 + i, -50 - i))
w(0x5c09f4, ACTION)
w(0x6d218c, 7)
# Existing manager IDs are supplied names; their lookup itself is not under test.
names = [text(a) for a in [0x5c7370, 0x5c735c, 0x5c7348]]
for a, ident in zip([0x6d2188, 0x6d2184, 0x6d2180], [1, 2, 3]): w(a, ident)
def hook(machine, a, size, data):
    global handle
    s = u.reg_read(UC_X86_REG_ESP)
    c = u.reg_read(UC_X86_REG_ECX)
    if a == ACTION:
        events.append(dict(kind='action', name=text(r(s + 4)), mode=r(s + 8)))
        finish(pop=8)
    elif a == 0x45bf6c:
        source = r(s + 4)
        u.mem_write(c, bytes(u.mem_read(source, 8)))
        finish(c, 4)
    elif a == 0x47b81b: finish(MANAGER)
    elif a == 0x47b29e:
        handle += 1
        tag = r(s + 8)
        events.append(dict(kind='effectStart', name=names[r(s + 4) - 1], tag=('root' if tag == MODEL else (tag - TAGS) // 0x80), handle=handle))
        finish(handle, 12)
    elif a == 0x4791de:
        events.append(dict(kind='effectStop', handle=r(s + 4)))
        finish(pop=4)
    elif a == 0x485b1b:
        result = r(s + 4)
        handle += 1
        u.mem_write(result, bytes(24))
        w(result, handle)
        events.append(dict(kind='sound', name=text(r(s + 8)), position=list(struct.unpack('<3f', u.mem_read(r(s + 12), 12))), selector=struct.unpack('<i', u.mem_read(s + 16, 4))[0]))
        finish(result)
    elif a == 0x48568d:
        target = r(s + 4)
        events.append(dict(kind='soundStop', slot=(target - OBJ - 0x150) // 24))
        u.mem_write(target, bytes(24))
        finish()
    elif a == 0x45cc99:
        events.append(dict(kind='damageText', delta=struct.unpack('<i', u.mem_read(s + 4, 4))[0]))
        finish(pop=4)
    elif a == 0x45bd30:
        events.append(dict(kind='destroyCallback'))
        finish()
for a in [ACTION, 0x45bf6c, 0x47b81b, 0x47b29e, 0x4791de, 0x485b1b, 0x48568d, 0x45cc99, 0x45bd30]:
    u.hook_add(UC_HOOK_CODE, hook, begin=a, end=a)
# The Castle +68 virtual method is recorded without supplying an unrelated role.
w(0x5c72b0 + 0x68, 0x45bd30)
def execute(delta):
    events.clear()
    w(STACK, STOP, delta)
    u.reg_write(UC_X86_REG_ECX, OBJ)
    u.reg_write(UC_X86_REG_ESP, STACK)
    u.emu_start(0x45d16f, STOP, count=100000)
    assert u.reg_read(UC_X86_REG_EIP) == STOP
    assert u.reg_read(UC_X86_REG_ESP) == STACK + 8
    return dict(delta=delta, hp=r(OBJ + 0xdc), maxHP=r(OBJ + 0xe0), stage=r(OBJ + 0x108), mask=r(OBJ + 0x138), events=list(events))
rows=[]
for hp in [2000,1601,1600,1201,1200,801,800,667,666,665,401,400,1,0]:
    w(OBJ + 0xdc, 2000, 2000)
    w(OBJ + 0x108, 2, 0)
    w(OBJ + 0x138, 0)
    w(OBJ + 0x13c, 0,0,0,0,0)
    row=execute(2000-hp)
    assert row['hp']==hp
    smoke = [e for e in row['events'] if e['kind']=='effectStart' and e['name']==names[0]]
    expected_slot = 3 if 0 < hp <= 400 else 2 if 400 < hp <= 800 else 1 if 800 < hp <= 1200 else 0 if 1200 < hp <= 1600 else None
    assert [e['tag'] for e in smoke] == ([] if expected_slot is None else [expected_slot])
    loops = [e for e in row['events'] if e['kind']=='sound' and e['selector']==-1]
    assert len(loops) == len(smoke) and all(e['name']=='se03' for e in loops)
    assert row['stage']==(0 if hp==0 else 1 if hp<666 else 2)
    assert [e['name'] for e in row['events'] if e['kind']=='sound'][0]==text(0x5c7384)
    rows.append(row)
w(OBJ + 0xdc, 2000,2000);w(OBJ + 0x108,2,0);w(OBJ + 0x138,0);w(OBJ + 0x13c,0,0,0,0,0)
sequence=[execute(d) for d in [400,0,400,400,400,400,0,-2200]]
assert not [e for e in sequence[1]['events'] if e['kind']=='effectStart']
assert sequence[-1]['hp']==sequence[-1]['maxHP']==2200
tag_events=[]
GETTAG, SETPARENT = STOP+0x100, STOP+0x200
w(0x5c09f0,GETTAG);w(0x5c096c,SETPARENT)
def tag_hook(machine,a,size,data):
    s=u.reg_read(UC_X86_REG_ESP)
    if a==GETTAG:
        tag_events.append(dict(slot=(r(s+4)-TAGS)//0x80,name=text(r(s+8))))
        finish(pop=8)
    else: finish(pop=4)
for a in [GETTAG,SETPARENT]: u.hook_add(UC_HOOK_CODE,tag_hook,begin=a,end=a)
w(STACK,STOP);u.reg_write(UC_X86_REG_ESP,STACK);u.reg_write(UC_X86_REG_ECX,OBJ);u.emu_start(0x45bdcb,STOP,count=10000)
assert [e['name'] for e in tag_events]==[f'tag_spout{i}' for i in range(1,6)]
# GotoAction mode bit4 is tested in the original slot selector, without graphics allocation.
ACTOR, SLOT, DEFINITION, VT, DEFHOOK = STOP+0x300, STOP+0x500, STOP+0x600, STOP+0x700, STOP+0x800
w(ACTOR+0x7c,DEFINITION,SLOT,1);w(DEFINITION,VT)
for offset in [0x58,8,0x38]:w(VT+offset,DEFHOOK)
def action_hook(machine,a,size,data):
    if a==DEFHOOK: finish(3201,4)
    elif a==0x100099f0: finish()
for a in [DEFHOOK,0x100099f0]:u.hook_add(UC_HOOK_CODE,action_hook,begin=a,end=a)
action_modes=[]
for mode in [0,4]:
    w(SLOT,0,11,0,0,0,0,3201,0,0)
    w(STACK,STOP,11,mode,1,0,0x6f766572)
    u.reg_write(UC_X86_REG_ESP,STACK);u.reg_write(UC_X86_REG_ECX,ACTOR)
    u.emu_start(0x10009af0,STOP,count=20000)
    assert u.reg_read(UC_X86_REG_EIP)==STOP
    assert r(SLOT+0xc)==0 and r(ACTOR+0xb0)==(mode>>2)
    action_modes.append(dict(mode=mode,time=r(SLOT+0xc),stopAtEnd=r(ACTOR+0xb0)))
out=dict(actionModes=action_modes,tags=tag_events,status='PASS',entry='45d16f',names=names,rows=rows,sequence=sequence,scope='Original full Castle damage branch, integer clamp/thresholds and mask execute; supplied initial Castle fields/tag positions; model action, effect-manager lookup/start/stop, audio and damage-text services are recording boundaries. No original GPU/audio output or authoritative server attack is exercised.')
(ROOT/'recovery/output/castle-damage-native.json').write_text(json.dumps(out,indent=2)+'\n')
print('PASS: original Castle HP boundaries, action/effect/audio order, repeated stage and recovery')
