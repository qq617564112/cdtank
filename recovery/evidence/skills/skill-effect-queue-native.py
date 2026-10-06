"""Execute original revival, cyclic queue selection and one-shot scheduler countdown."""
import json
from pathlib import Path
import struct
import sys
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_EAX, UC_X86_REG_ECX, UC_X86_REG_EIP, UC_X86_REG_ESP
ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'recovery'))
from effect_native import map_original_binaries
uc, _ = map_original_binaries([ROOT / 'CDTank/CDTank.exe'])
uc.mem_map(0, 4096)
uc.mem_map(0x2000000, 0x40000)
MANAGER, SYSTEM, ROLE, SKILL, TABLE = [0x2001000 + 0x1000 * i for i in range(5)]
QUEUE, NODE, VECTOR, VTABLE, ACTOR = [0x2006000 + 0x1000 * i for i in range(5)]
STACK, STOP, ATTACH, ID, CLOCK, TIMER, TIMER_NODE, TIMER_CB = [0x2020000 + 0x1000 * i for i in range(8)]
events = []
clock_value = 100.0
handles = 100
mode = 'queue'
def put(a, *v): uc.mem_write(a, struct.pack('<' + 'I' * len(v), *[x & 0xffffffff for x in v]))
def uint(a): return struct.unpack('<I', uc.mem_read(a, 4))[0]
def finish(pop=0, value=None):
    s = uc.reg_read(UC_X86_REG_ESP)
    if value is not None: uc.reg_write(UC_X86_REG_EAX, value)
    uc.reg_write(UC_X86_REG_EIP, uint(s))
    uc.reg_write(UC_X86_REG_ESP, s + 4 + pop)
def call(a, this, *args):
    put(STACK, STOP, *args)
    uc.reg_write(UC_X86_REG_ESP, STACK)
    uc.reg_write(UC_X86_REG_ECX, this)
    uc.emu_start(a, STOP, count=100000)
    assert uc.reg_read(UC_X86_REG_EIP) == STOP
    assert uc.reg_read(UC_X86_REG_ESP) == STACK + 4 + 4 * len(args)
def hook(machine, a, size, data):
    global handles
    s = machine.reg_read(UC_X86_REG_ESP)
    if a == 0x4501fa:
        out, key = uint(s+4), uint(uint(s+8))
        put(out, NODE if key == 47 else uint(MANAGER+0x20)); finish(8, out)
    elif a == 0x48a226: finish(4, ROLE)
    elif a == 0x413c65: finish(value=TABLE)
    elif a == 0x411068:
        key = uint(s+4); events.append({'kind':'skill','id':key}); finish(4, SKILL)
    elif a == ATTACH:
        handles += 1
        events.append({'kind':'attach','args':[uint(s+i) for i in (4,8,12,16)],'handle':handles})
        finish(16, handles)
    elif a == ID: finish(value=47)
    elif a == ID+0x100: finish(4)
    elif a == CLOCK: finish(value=123456)
    elif a == 0x431fe0:
        events.append({'kind':'position','selector':uint(s+4),'offset':list(struct.unpack('<3f',uc.mem_read(uint(s+8),12)))})
        finish(8, ROLE+0x400)
    elif a == 0x485b1b:
        out = uint(s+4); events.append({'kind':'sound'})
        put(out, handles, 0, 0, 0, 0, 0); finish(value=out)
    elif a == 0x487c36: finish(value=uint(s+4))
    elif a == 0x411c2c: finish(value=uint(s+4))
    elif a == 0x401171: finish(8)
    elif a == 0x40bd28: finish()
    elif a == 0x4041fb:
        events.append({'kind':'cancel'})
        # The caller pops ST(0), so retain the native floating return convention.
        uc.mem_write(TIMER+0x500, b'\xd9\xee\xc2\x04\x00')
        machine.reg_write(UC_X86_REG_EIP,TIMER+0x500)
    elif a == 0x48894f:
        args = [uint(s+i) for i in range(4,32,4)]
        events.append({'kind':'schedule','delay':struct.unpack('<f',struct.pack('<I',args[1]))[0],
                       'context':args[2], 'callback':args[3], 'adjustment':args[4], 'role':args[5], 'skill':args[6]})
        finish(28)
    elif a == 0x47b81b: events.append({'kind':'lookupEffect','handle':uint(s+4)}); finish(4, ACTOR)
    elif a == 0x4791de: events.append({'kind':'stopEffect'}); finish()
    elif a == 0x48568d: events.append({'kind':'stopSound','token':uint(uint(s+4))}); finish()
    elif a == 0x42a527: events.append({'kind':'roleReset','id':uint(s+4)}); finish(4)
    elif a == 0x4f14f5:
        out,item=uint(s+4),uint(s+8); end=uint(QUEUE+8)
        uc.mem_write(item,bytes(uc.mem_read(item+4,end-item-4))); put(QUEUE+8,end-4); put(out,item); finish(8,out)
    elif a == 0x57a6c7: events.append({'kind':'free','pointer':uint(s+4)}); finish()
    elif a == 0x4593e5: events.append({'kind':'deleteVector'}); finish()
    elif a == 0x42de86: put(machine.reg_read(UC_X86_REG_ECX),uint(MANAGER+0x20)); finish()
    elif a == 0x486f6b: events.append({'kind':'eraseRole'}); finish(8)
    elif a == 0x40607b:
        uc.mem_write(CLOCK+0x500,struct.pack('<d',clock_value))
        uc.mem_write(CLOCK+0x600,b'\xdd\x05'+struct.pack('<I',CLOCK+0x500)+b'\xc3')
        machine.reg_write(UC_X86_REG_EIP,CLOCK+0x600)
    elif a == TIMER_CB: events.append({'kind':'timerCallback'}); finish()
uc.hook_add(UC_HOOK_CODE,hook)
put(0x633588,SYSTEM); put(SYSTEM+0x118,MANAGER); put(SYSTEM+0x110,TIMER)
put(0x5c05d8,ID+0x100); put(0x5c0828,CLOCK); put(MANAGER+0x20,NODE+0x100); put(NODE+0x10,QUEUE)
put(ROLE,VTABLE); put(VTABLE+4,ID); put(ROLE+0x310,ACTOR); put(ACTOR,VTABLE); put(VTABLE+0xa8,ATTACH)
put(SKILL+0x70,19,23,31); put(SKILL+0xd0,7,8,9)
records = [VECTOR+0x100+0x100*i for i in range(3)]
for i,r in enumerate(records): put(r,47,13501+i,i,99,0,0,0,0,0,0,0)
put(VECTOR,*records); put(QUEUE+4,VECTOR,VECTOR+12,VECTOR+12)
rows=[]
def capture(action, a, *args):
    events.clear(); call(a,MANAGER,*args)
    rows.append({'action':action,'events':list(events),'handles':[uint(r+0x10) for r in records],
                 'durations':[uint(r+0xc) for r in records], 'count':(uint(QUEUE+8)-uint(QUEUE+4))//4})
capture('revive',0x488f73,47)
for skill in [13501,13502,13503,13501]: capture('alternate',0x488cad,47,skill)
assert [next(e['id'] for e in row['events'] if e['kind']=='skill') for row in rows] == [13501,13502,13503,13501,13502]
for row in rows:
    assert row['count']==3 and row['durations']==[99,99,99]
    assert next(e['args'] for e in row['events'] if e['kind']=='attach') in [[19,3,7,0],[23,3,8,0],[31,3,9,0]]
    assert next(e for e in row['events'] if e['kind']=='position') == {'kind':'position','selector':0xffffffff,'offset':[0.0,0.0,-1.0]}
    timer = next(e for e in row['events'] if e['kind']=='schedule')
    assert timer['delay']==5 and timer['callback']==0x488cad and timer['context']==MANAGER and timer['role']==47 and timer['adjustment']==0
for row in rows[1:]:
    assert [e['kind'] for e in row['events'][:4]] == ['lookupEffect','stopEffect','stopSound','cancel']
put(QUEUE+8,VECTOR+4)
capture('singleRevive',0x488f73,47)
assert not any(e['kind']=='schedule' for e in rows[-1]['events'])
put(QUEUE+8,VECTOR)
capture('emptyRevive',0x488f73,47)
assert not rows[-1]['events']
capture('absentRevive',0x488f73,48)
assert not rows[-1]['events']
# Execute one-shot scheduler 4046a5: a five-second interval expires once elapsed time exceeds five seconds.
put(TIMER+0x10,TIMER_NODE); put(TIMER+0x14,1); put(TIMER+4,TIMER_NODE+0x100); put(TIMER+8,0)
put(TIMER_NODE,TIMER_NODE); put(TIMER_NODE+0x24,0x40a00000); put(TIMER_NODE+0x28,TIMER_CB+0x100)
put(TIMER_CB+0x100,VTABLE+0x100); put(VTABLE+0x108,TIMER_CB)
countdown=[]
for delta in [4.75,.25,.01]:
    events.clear(); call(0x4046a5,TIMER,struct.unpack('<I',struct.pack('<f',delta))[0])
    countdown.append({'delta':delta,'remaining':struct.unpack('<f',uc.mem_read(TIMER_NODE+0x24,4))[0],
                      'expired':uc.mem_read(TIMER_NODE+0x2c,1)[0], 'events':list(events)})
assert countdown[0]['remaining']==.25 and countdown[0]['expired']==0 and countdown[0]['events']==[]
assert countdown[1]['remaining']==0 and countdown[1]['expired']==0 and countdown[1]['events']==[]
assert countdown[2]['expired']==1 and countdown[2]['events']==[{'kind':'timerCallback'}]
# Native role cleanup cancels the timer and releases every record and the queue.
put(QUEUE+8,VECTOR+12); put(0x635830,SYSTEM); put(SYSTEM+0x60,0)
events.clear(); call(0x487edc,MANAGER,47); cleanup=list(events)
assert cleanup[0]=={'kind':'roleReset','id':47} and cleanup[1]=={'kind':'cancel'}
assert [e['pointer'] for e in cleanup if e['kind']=='free']==records+[QUEUE]
assert sum(e['kind']=='stopEffect' for e in cleanup)==3 and sum(e['kind']=='stopSound' for e in cleanup)==3
assert cleanup[-1]=={'kind':'eraseRole'} and uint(NODE+0x10)==0
# Native full-queue cleanup traverses the map and releases the same records.
put(MANAGER+0x20,NODE+0x100); put(NODE+0x100,NODE); put(NODE+0xc,47); put(NODE+0x10,QUEUE)
put(VECTOR,*records); put(QUEUE+4,VECTOR,VECTOR+12,VECTOR+12)
events.clear(); call(0x487d9d,MANAGER); all_cleanup=list(events)
assert all_cleanup == cleanup[1:]
# Native frame clock returns fixed simulation steps, capped at three.
frame_steps=[]
for elapsed,expected in [(1/30,1),(.05,2),(.2,3)]:
    ticker=TIMER+0x600; put(ticker+0x60,3); uc.mem_write(ticker+0x64,b'\x01')
    uc.mem_write(ticker+0x48,struct.pack('<d',1/30)); uc.mem_write(ticker+0x68,bytes(8))
    uc.mem_write(0x630a60,struct.pack('<d',100)); clock_value=100+elapsed
    call(0x406154,ticker); steps=uc.reg_read(UC_X86_REG_EAX)
    assert steps==expected; frame_steps.append({'elapsedSeconds':elapsed,'steps':steps})
# Active-game virtual dispatch forwards those integers through the skill-system thunk.
state=TIMER+0x800; root=TIMER+0x900; list_begin=TIMER+0xa00
put(state+4,root); put(state+0xc,1); put(state+0x2c,1)
put(root+0x98,list_begin,list_begin+4); put(list_begin,MANAGER)
put(MANAGER,0x5ca124); put(MANAGER+0x10,VECTOR); put(MANAGER+0x14,VECTOR)
put(0x892b4c,0); call(0x442af0,state,3); assert uint(0x892b4c)==3
out={'queues':rows,'cleanup':cleanup,'allCleanup':all_cleanup,'frameSteps':frame_steps,'activeGameAccumulatedTicks':uint(0x892b4c),'scheduler':countdown,'evidence':{'revive':'0x488f73','alternate':'0x488cad','schedule':'0x48894f','schedulerUpdate':'0x4046a5','clockSeconds':'0x40607b','frameScheduler':'0x415da6'}}
path=ROOT/'recovery/output/skill-effect-queue-native.json'; path.write_text(json.dumps(out,indent=2)+'\n')
print(json.dumps({'cases':len(rows),'schedulerSteps':len(countdown),'output':str(path)}))
