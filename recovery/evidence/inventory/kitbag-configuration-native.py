"""Original kitbag request gates and confirmation callbacks, with real role setter."""
import itertools
import json
from pathlib import Path
import struct
import sys
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_EAX, UC_X86_REG_ECX, UC_X86_REG_EIP, UC_X86_REG_ESP
ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'recovery'))
from effect_native import map_original_binaries
from inspect_assets import read_table
uc, _ = map_original_binaries([ROOT / 'CDTank/CDTank.exe'])
uc.mem_map(0, 4096); uc.mem_map(0x2000000, 0x30000)
GAME, MANAGER, ROLE, PROFILE, UI, RVT, PVT, UVT = [0x2001000 + i * 0x1000 for i in range(8)]
VECTOR, ITEM, MESSAGE = 0x2009000, 0x200a000, 0x200b000
STACK, STOP, UI_CALLBACK, ROLE_CALLBACK = 0x2010000, 0x2011000, 0x2012000, 0x2013000
has_role = True
sent, notices = [], []
def put(address, *values):
    uc.mem_write(address, struct.pack('<' + 'I' * len(values), *[v & 0xffffffff for v in values]))
def read(address): return struct.unpack('<I', uc.mem_read(address, 4))[0]
def state():
    return dict(hotkeys=list(struct.unpack('<7i', uc.mem_read(PROFILE + 0x94, 28))),
                dirty=bool(uc.mem_read(ROLE + 0x2b4, 1)[0]))
def hook(machine, address, size, data):
    stack = machine.reg_read(UC_X86_REG_ESP); pop = 0; value = 0
    if address == 0x4269c4: value = ROLE if has_role else 0
    elif address == 0x413ec4:
        packet = read(stack + 4); pop = 4
        if read(packet) == 0x5c4f60:
            sent.append(dict(kind='assign', instanceId=read(packet + 16), slot=read(packet + 20)))
        else:
            assert read(packet) == 0x5c4f74
            sent.append(dict(kind='cancel', slot=read(packet + 12)))
    elif address == UI_CALLBACK:
        pop = 4; notices.append(dict(kind='ui', code=read(stack + 4), state=state()))
    elif address == ROLE_CALLBACK:
        pop = 4; notices.append(dict(kind='role', code=read(stack + 4), state=state()))
    elif address == 0x43d781: pop = 4  # diagnostic logger's formatting boundary
    elif address != 0x40bd28: raise AssertionError(hex(address))
    machine.reg_write(UC_X86_REG_EAX, value)
    machine.reg_write(UC_X86_REG_EIP, read(stack)); machine.reg_write(UC_X86_REG_ESP, stack + 4 + pop)
for address in [0x4269c4, 0x413ec4, UI_CALLBACK, ROLE_CALLBACK, 0x43d781, 0x40bd28]:
    uc.hook_add(UC_HOOK_CODE, hook, begin=address, end=address)
def reset(role=True, array=True, ui=True):
    global has_role
    has_role = role
    uc.mem_write(GAME, bytes(0xb000)); put(0x633588, GAME)
    put(ROLE, RVT); put(RVT + 0x20, 0x4327ac); put(RVT + 0x38, 0x432826)
    put(ROLE + 0x2a0, PROFILE if array else 0); put(PROFILE, PVT); put(PVT + 0x24, ROLE_CALLBACK)
    put(PROFILE + 0x94, 1, 2, 3, 4, 5, 6, 7)
    put(UI, UVT); put(UVT + 8, UI_CALLBACK)
    put(MANAGER + 0xb8, UI if ui else 0); put(MANAGER + 0xbc, UI if ui else 0)
    sent.clear(); notices.clear()
def call(address, *args):
    put(STACK, STOP, *args); uc.reg_write(UC_X86_REG_ECX, MANAGER); uc.reg_write(UC_X86_REG_ESP, STACK)
    uc.emu_start(address, STOP, count=10000)
    assert uc.reg_read(UC_X86_REG_EIP) == STOP and uc.reg_read(UC_X86_REG_ESP) == STACK + 4 * (len(args) + 1)
    return bool(uc.reg_read(UC_X86_REG_EAX) & 255)
requests = []
ids = [int(row['values']['ItemTableID']) for row in read_table(ROOT / 'CDTank/Data/table/item.dat')['rows']]
for n, (item_id, slot) in enumerate(itertools.product(ids, range(1, 8))):
    group = [0, 1, 2, 3, 5, 6][n % 6]; reset()
    put(MANAGER + 0x10 + group * 16, VECTOR, VECTOR + 4); put(VECTOR, ITEM)
    put(ITEM + 4, 77); put(ITEM + 12, item_id, 0); put(ITEM + 32, 0)
    accepted = call(0x43dcc3, 77, slot)
    assert read(ITEM + 16) == read(ITEM + 32) == 0
    requests.append(dict(itemId=item_id, group=group, instanceId=77, slot=slot,
                         result=dict(accepted=accepted, sent=list(sent), notices=list(notices), state=state())))
for instance, slot, found in [(0, 1, True), (77, 0, True), (77, 8, True), (77, 0xffffffff, True), (77, 1, False)]:
    reset()
    if found: put(MANAGER + 0x10, VECTOR, VECTOR + 4); put(VECTOR, ITEM); put(ITEM + 4, 77); put(ITEM + 12, 1)
    accepted = call(0x43dcc3, instance, slot)
    requests.append(dict(itemId=1, group=0, instanceId=instance, slot=slot, found=found,
                         result=dict(accepted=accepted, sent=list(sent), notices=list(notices), state=state())))
cancellations = []
for slot, assigned in itertools.product(range(8), [False, True]):
    reset(); put(PROFILE + 0x94, *([77 if assigned else 0] * 7))
    initial = state(); accepted = call(0x43cbe3, slot)
    cancellations.append(dict(slot=slot, initial=initial,
        result=dict(accepted=accepted, sent=list(sent), notices=list(notices), state=state())))
confirmations = []
for kind, result, role, array, ui in itertools.product(['assign', 'cancel'], range(6), [False, True], [True], [False, True]):
    reset(role, array, ui); put(MESSAGE + 12, result if kind == 'assign' else 3,
                                  77 if kind == 'assign' else result, 2)
    put(MESSAGE + 24, 77, 0, 0xffffffff, 4, 5, 6, 7)
    call(0x43bf59 if kind == 'assign' else 0x43bfd2, MESSAGE, 0, 0)
    confirmations.append(dict(kind=kind, result=result, role=role, array=array, ui=ui,
        resultState=dict(sent=list(sent), notices=list(notices), state=state())))
STREAM, BUFFER = 0x200c000, 0x200d000
wire = []
for kind, vtable, getter, writer, reader, widths in [
    ('assign', 0x5c4f60, 0x43c531, 0x43c657, 0x43c6c1, [8, 32, 8] + [32] * 7),
    ('cancel', 0x5c4f74, 0x43c56a, 0x499757, 0x43c76f, [8, 8])]:
    for boundary in [0, 1, 255, 0xffffffff]:
        values = [boundary, 77, boundary, 77, 0, 0xffffffff, 4, 5, 6, 7] if kind == 'assign' else [boundary, boundary]
        for alignment in range(8):
            put(MESSAGE, vtable); put(MESSAGE + 12, *values)
            put(STACK, STOP); uc.reg_write(UC_X86_REG_ESP, STACK); uc.reg_write(UC_X86_REG_ECX, MESSAGE)
            uc.emu_start(getter, STOP, count=100)
            message_type = uc.reg_read(UC_X86_REG_EAX)
            assert message_type == (0x3c91 if kind == 'assign' else 0x3c9a)
            uc.mem_write(BUFFER, bytes(64)); put(STREAM, alignment, 0, BUFFER, 64)
            put(STACK, STOP, STREAM); uc.reg_write(UC_X86_REG_ESP, STACK); uc.reg_write(UC_X86_REG_ECX, MESSAGE)
            uc.emu_start(writer, STOP, count=10000)
            assert uc.reg_read(UC_X86_REG_EIP) == STOP and uc.reg_read(UC_X86_REG_ESP) == STACK + 8
            payload = bytes(uc.mem_read(BUFFER, (alignment + sum(widths) + 7) // 8))
            packed = 0; cursor = alignment
            for value, width in zip(values, widths):
                packed |= (value & ((1 << width) - 1)) << cursor; cursor += width
            assert int.from_bytes(payload, 'little') == packed
            uc.mem_write(MESSAGE + 12, b'\xaa' * 40); put(STREAM, alignment, 0, BUFFER, 64)
            put(STACK, STOP, STREAM); uc.reg_write(UC_X86_REG_ESP, STACK); uc.reg_write(UC_X86_REG_ECX, MESSAGE)
            uc.emu_start(reader, STOP, count=10000)
            assert uc.reg_read(UC_X86_REG_EIP) == STOP and uc.reg_read(UC_X86_REG_ESP) == STACK + 8
            actual = [read(MESSAGE + 12 + i * 4) for i in range(len(values))]
            assert actual == [value & ((1 << width) - 1) for value, width in zip(values, widths)]
            wire.append(dict(kind=kind, messageType=message_type, values=values, actual=actual,
                             bitOffset=alignment, payload=payload.hex()))
(ROOT / 'recovery/output/kitbag-configuration-native.json').write_text(json.dumps(dict(
    scope='Original43dcc3/43cbe3, real inventory lookups/classifiers/packet ctor+dtor/SEH; original43bf59/43bfd2 confirmations and432826 array copy/notify/dirty. Role lookup/send/UI/log boundaries supplied. No server confirmation generation.',
    requests=requests, cancellations=cancellations, confirmations=confirmations, wire=wire), indent=2))
print(f'PASS: {len(requests)} assignments, {len(cancellations)} cancellations, {len(confirmations)} confirmations and {len(wire)} original packets')
