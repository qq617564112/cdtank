"""Execute original Crush45efb3 hide and optional effect-handle dispatch."""
import json
from pathlib import Path
import struct
import sys
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_EAX, UC_X86_REG_ECX, UC_X86_REG_EIP, UC_X86_REG_ESP

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'recovery'))
from effect_native import map_original_binaries

uc, _ = map_original_binaries([ROOT / 'CDTank/CDTank.exe'])
uc.mem_map(0, 4096)
uc.mem_map(0x2000000, 0x20000)
OBJ, EFFECT, TABLE, STUB, STACK, STOP = [0x2001000 + i * 0x2000 for i in range(6)]
events = []


def put(address, *values):
    uc.mem_write(address, struct.pack('<' + 'I' * len(values), *values))


def get(address):
    return struct.unpack('<I', uc.mem_read(address, 4))[0]


def finish(value=0, pop=0):
    stack = uc.reg_read(UC_X86_REG_ESP)
    uc.reg_write(UC_X86_REG_EAX, value)
    uc.reg_write(UC_X86_REG_EIP, get(stack))
    uc.reg_write(UC_X86_REG_ESP, stack + 4 + pop)


def hook(machine, address, size, data):
    stack = machine.reg_read(UC_X86_REG_ESP)
    if address == STUB:
        events.append(dict(kind='hideBoundary', hidden=bool(uc.mem_read(OBJ + 0x74, 1)[0]),
                           argument=get(stack + 4)))
        finish(pop=4)
    elif address == STUB + 16:
        events.append(dict(kind='effectSlot34', receiver=machine.reg_read(UC_X86_REG_ECX),
                           argumentPair=[get(stack + 4), get(stack + 8)]))
        finish(pop=8)
    else:
        raise AssertionError(hex(address))


# Original461dd9 executes the hide flag; only scene teardown and effect-vtable
# endpoints are recording boundaries. The 45bf6c/458600 pair copy executes.
uc.hook_add(UC_HOOK_CODE, hook, begin=STUB, end=STUB + 16)
put(OBJ, 0x5c76e0)
put(0x5c76e0 + 0x4c, STUB)
put(EFFECT, TABLE)
put(TABLE + 0x34, STUB + 16)
put(OBJ + 0x78, 0x12345678, 0)
rows = []
for effect in [0, EFFECT]:
    uc.mem_write(OBJ + 0x74, b'\0')
    put(OBJ + 0xfc, effect)
    for repeat in range(2):
        events.clear()
        put(STACK, STOP, 99)
        uc.reg_write(UC_X86_REG_ESP, STACK)
        uc.reg_write(UC_X86_REG_ECX, OBJ)
        uc.emu_start(0x45efb3, STOP, count=10000)
        assert uc.reg_read(UC_X86_REG_EIP) == STOP
        assert uc.reg_read(UC_X86_REG_ESP) == STACK + 8
        assert uc.reg_read(UC_X86_REG_EAX) & 255 == 1
        assert uc.mem_read(OBJ + 0x74, 1)[0] == 1
        assert events[0] == dict(kind='hideBoundary', hidden=True, argument=0)
        assert len(events) == (2 if effect else 1)
        if effect:
            assert events[1] == dict(kind='effectSlot34', receiver=EFFECT,
                                    argumentPair=[0x12345678, 0])
        rows.append(dict(effectPresent=bool(effect), repeat=repeat,
                         returned=True, hidden=True, events=list(events)))
result = dict(status='PASS', entry='45efb3', className='SYcScnObjCrush', rows=rows,
              scope='Original hide flag/order, optional effect slot34 dispatch, 8-byte handle-pair copy and return/stack. Scene teardown/effect endpoint are recorded boundaries. No original loader/resource/handle-to-world conversion, authority or player claim.')
(ROOT / 'recovery/output/scene-crush07-state-native.json').write_text(json.dumps(result, indent=2) + '\n')
print('PASS: original Crush immediate hide and optional handle-pair effect dispatch; repeated calls remain accepted')
