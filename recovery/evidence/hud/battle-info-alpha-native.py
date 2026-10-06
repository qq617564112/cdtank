"""Execute original battle-information text/alpha and frame/hover consumers."""
import json
import capstone
from pathlib import Path
import struct
import sys
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_EAX, UC_X86_REG_EBX, UC_X86_REG_ECX, UC_X86_REG_EDI, UC_X86_REG_EIP, UC_X86_REG_ESI, UC_X86_REG_ESP, UC_X86_REG_EBP

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'recovery'))
from effect_native import map_original_binaries
uc, images = map_original_binaries([ROOT / 'CDTank/CDTank.exe'])
uc.mem_map(0x2000000, 0x100000)
OWNER, PANEL, TEXT, FRAME, STACK, RETURN, CHARACTER = [0x2001000 + n * 0x2000 for n in range(7)]
STUB = 0x2020000
names = ['alpha', 'setText', 'at', 'substr', 'destruct']
handlers = {STUB+n*0x100: name for n, name in enumerate(names)}
addresses = dict(zip(names, handlers))
for imported, name in [(0x5c012c, 'alpha'), (0x5c0240, 'setText'), (0x5c034c, 'at'), (0x5c0338, 'substr')]:
    uc.mem_write(imported, struct.pack('<I', addresses[name]))
strings, events = {}, []
alpha = 1.0
text = ''

def word(address, *values):
    uc.mem_write(address, struct.pack('<'+'I'*len(values), *values))

def read(address):
    return struct.unpack('<I', uc.mem_read(address, 4))[0]

def f32(value):
    return struct.unpack('<f', struct.pack('<f', value))[0]

def floating(address, value):
    uc.mem_write(address, struct.pack('<f', value))

def read_float(address):
    return struct.unpack('<f', uc.mem_read(address, 4))[0]

def hook(machine, address, size, user):
    global alpha, text
    name = handlers.get(address)
    if not name:
        return
    sp = machine.reg_read(UC_X86_REG_ESP)
    this = machine.reg_read(UC_X86_REG_ECX)
    pop, result = 0, 0
    if name == 'alpha':
        assert this == PANEL
        alpha = read_float(sp+4)
        events.append({'kind': name, 'value': alpha})
        pop = 4
    elif name == 'setText':
        assert this == TEXT
        text = strings[read(sp+4)]
        word(TEXT+0x44, len(text))
        strings[TEXT+0x44] = text
        events.append({'kind': name, 'text': text})
        pop = 4
    elif name == 'at':
        word(CHARACTER, ord(strings[this][read(sp+4)]))
        result, pop = CHARACTER, 4
    elif name == 'substr':
        target, start, length = [read(sp+n*4) for n in [1,2,3]]
        assert length == 0xffffffff
        strings[target] = strings[this][start:]
        result, pop = target, 12
    machine.reg_write(UC_X86_REG_EAX, result)
    machine.reg_write(UC_X86_REG_EIP, read(sp))
    machine.reg_write(UC_X86_REG_ESP, sp+4+pop)

uc.hook_add(UC_HOOK_CODE, hook)
word(OWNER+0x628, PANEL)
word(OWNER+0x62c, TEXT)
word(0x5c0218, 0x2021000)
word(0x2021000, 0xffffffff)

def state(elapsed=0, opacity=1):
    global alpha
    floating(OWNER+0x95c, elapsed)
    alpha = f32(opacity)
    events.clear()
    uc.reg_write(UC_X86_REG_ESP, STACK)
    uc.reg_write(UC_X86_REG_ECX, OWNER)
    uc.reg_write(UC_X86_REG_EBX, addresses['alpha'])
    word(STACK, RETURN, 0)

def frame(elapsed, delta, opacity=1):
    state(elapsed, opacity)
    floating(OWNER+0x10, delta)
    uc.reg_write(UC_X86_REG_ESI, OWNER)
    uc.emu_start(0x4cae7a, 0x4caeb5, count=1000)
    assert uc.reg_read(UC_X86_REG_EIP) == 0x4caeb5
    return {'initial': f32(elapsed), 'delta': f32(delta), 'elapsed': read_float(OWNER+0x95c), 'alpha': alpha, 'events': list(events)}

append_rows = []
for supplied in ['', '消息', '\n', '\n消息', '消息\n']:
    state(9, .2)
    strings[FRAME-0xd4] = supplied
    uc.reg_write(UC_X86_REG_EBP, FRAME)
    uc.reg_write(UC_X86_REG_EDI, OWNER)
    uc.reg_write(UC_X86_REG_EBX, addresses['destruct'])
    uc.emu_start(0x4d03a8, 0x4d042c, count=1000)
    expected = supplied[1:] if len(supplied)>1 and supplied.startswith('\n') else supplied
    assert text == expected and read_float(OWNER+0x95c) == 0 and alpha == 1
    append_rows.append({'suppliedText': supplied, 'text': text, 'elapsed': 0, 'alpha': alpha, 'events': list(events)})

frame_rows = []
for elapsed, delta in [(0,0), (0,.01), (7,.99), (7,1), (7,1.01), (7.99,.01), (7.9999995,.00000025), (8,0), (8,.01), (8.1,.01)]:
    row = frame(elapsed, delta)
    initial, delta = f32(elapsed), f32(delta)
    active = initial < 8
    exact_sum = initial+delta
    assert row['elapsed'] == (f32(exact_sum) if active else initial)
    expected = [{'kind':'alpha','value':f32(.2)}] if active and exact_sum>=8 else []
    assert row['events'] == expected, row
    frame_rows.append(row)

hover_rows = []
for elapsed in [0, 7.99, 8, 8.1]:
    for entry, name in [(0x4ccac7, 'enter'), (0x4ccade, 'leave')]:
        state(elapsed, .2 if name=='enter' else 1)
        uc.emu_start(entry, RETURN, count=1000)
        assert uc.reg_read(UC_X86_REG_EIP) == RETURN and uc.reg_read(UC_X86_REG_ESP) == STACK+8
        expected = [{'kind':'alpha','value':1.0 if name=='enter' else f32(.2)}] if name=='enter' or f32(elapsed)>=8 else []
        assert events == expected
        assert read_float(OWNER+0x95c) == f32(elapsed)
        hover_rows.append({'event':name,'elapsed':f32(elapsed),'alpha':alpha,'events':list(events)})

state(7.9, .2)
uc.emu_start(0x4ccac7, RETURN, count=1000)
hover_then_frame = frame(7.9,.2,alpha)
assert hover_then_frame['alpha']==f32(.2)
state(hover_then_frame['elapsed'],hover_then_frame['alpha'])
uc.emu_start(0x4ccac7, RETURN, count=1000)
late_hover = {'alpha':alpha,'elapsed':read_float(OWNER+0x95c),'events':list(events)}
assert alpha==1 and late_hover['elapsed']==hover_then_frame['elapsed']
stable_late = frame(late_hover['elapsed'],1,alpha)
assert stable_late['alpha']==1 and stable_late['events']==[]

binary=images['cdtank.exe'].get_memory_mapped_image()
md=capstone.Cs(capstone.CS_ARCH_X86,capstone.CS_MODE_32)
disassembly={hex(a):[f'{i.address:08x} {i.mnemonic} {i.op_str}' for i in md.disasm(binary[a-0x400000:z-0x400000],a)] for a,z in [(0x4d03a8,0x4d042c),(0x4cae7a,0x4caeb5),(0x4ccac7,0x4ccb0c),(0x4d5d2e,0x4d5dbe)]}
result={'status':'PASS','disassembly':disassembly,'eventBindings':{'control':'GameMain/edtBattleInfo','controllerOffset':'0x62c','enter':{'registration':'0x4d5d3e','callback':'0x4ccac7','eventImport':'0x5c01d4 EventMouseEnters'},'leave':{'registration':'0x4d5d93','callback':'0x4ccade','eventImport':'0x5c01d8 EventMouseLeaves'}},'appendRows':append_rows,'frameRows':frame_rows,'hoverRows':hover_rows,'ordering':{'enterBeforeThresholdCrossing':hover_then_frame,'enterAfterCrossing':late_hover,'frameAfterLateEnter':stable_late},'clock':{'elapsedField':'owner+0x95c','deltaField':'owner+0x10','unit':'seconds','storedPrecision':'float32','frameCondition':'Only elapsed<8 enters accumulation; >=8 leaves time and alpha unchanged. Compare the exact sum of float32 elapsed+delta to8 before float32 storage rounding.'},'scope':'Original text consumption/leading-newline removal/reset/alpha slice 4d03a8..4d042c, entire two hover callbacks, complete isolated frame consumer4cae7a..4caeb5. Formatted message assembly, CEGUI string/setText/setAlpha and frame dt are explicit providers. Full text parser, frame dispatcher and GPU drawing are not executed.'}
(ROOT/'recovery/output/battle-info-alpha-native.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print('PASS: 5 text/reset rows, 10 original clock rows, 8 full hover callbacks and event ordering')
