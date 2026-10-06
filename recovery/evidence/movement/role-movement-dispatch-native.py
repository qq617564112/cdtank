"""Execute original dispatch gates and selector-based movement argument preparation."""
from pathlib import Path
import json
import struct
import sys
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_ESP, UC_X86_REG_EIP, UC_X86_REG_ECX, UC_X86_REG_EAX, UC_X86_REG_FPCW, UC_X86_REG_FPSW, UC_X86_REG_FPTAG
ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'recovery'))
from effect_native import map_original_binaries
uc, _ = map_original_binaries([ROOT / 'CDTank/CDTank.exe'])
uc.mem_map(0x2000000, 0x20000)
STACK, STOP, ROLE, RECORD, VTABLE, TANK, CONTROLLER, MANAGER, STAGE, STAGEVTABLE, STAGES, STAGEGET, WORLD = [0x2001000 + i * 0x1000 for i in range(13)]
def put(address, *values): uc.mem_write(address, struct.pack('<' + 'I' * len(values), *values))
def read(address): return struct.unpack('<I', uc.mem_read(address, 4))[0]
def f32(value): return struct.unpack('<f', struct.pack('<f', value))[0]
def finish(arguments):
    stack = uc.reg_read(UC_X86_REG_ESP)
    uc.reg_write(UC_X86_REG_EIP, read(stack)); uc.reg_write(UC_X86_REG_ESP, stack + 4 + arguments)
calls = []
phase, result = 4, 1
mode = 'role'
def hook(machine, address, size, data):
    stack = uc.reg_read(UC_X86_REG_ESP)
    if address == 0x435088:
        args = struct.unpack('<5I3f3I', uc.mem_read(stack + 4, 44))
        calls.append(dict(kind='wrapper', arguments=list(args)))
        uc.reg_write(UC_X86_REG_EAX, result); finish(0)
    elif address == 0x433073:
        calls.append(dict(kind='matrix', arguments=list(struct.unpack('<3I', uc.mem_read(stack + 4, 12)))))
        finish(12)
    elif address == STAGEGET:
        uc.reg_write(UC_X86_REG_EAX, phase); finish(0)
    elif address == 0x426a54:
        calls.append(dict(kind='command', arguments=list(struct.unpack('<I2f', uc.mem_read(stack + 4, 12)))))
        finish(12)
    elif address == 0x4269f4:
        calls.append(dict(kind='stop', timestamp=struct.unpack('<f', uc.mem_read(stack + 4, 4))[0]))
        finish(4)
for address in [0x435088, 0x433073, STAGEGET, 0x426a54, 0x4269f4]:
    uc.hook_add(UC_HOOK_CODE, hook, begin=address, end=address)
def execute(entry, owner, arguments):
    calls.clear(); uc.mem_write(STACK, struct.pack('<I', STOP) + arguments)
    for register, value in [(UC_X86_REG_ESP, STACK), (UC_X86_REG_ECX, owner),
            (UC_X86_REG_FPCW, 0x27f), (UC_X86_REG_FPSW, 0), (UC_X86_REG_FPTAG, 0xffff)]: uc.reg_write(register, value)
    uc.emu_start(entry, STOP, count=3000)
    assert uc.reg_read(UC_X86_REG_EIP) == STOP
    assert uc.reg_read(UC_X86_REG_ESP) == STACK + 4 + len(arguments)
put(ROLE, VTABLE); put(VTABLE + 0x10, 0x4321e3); put(ROLE + 0x2a0, RECORD)
uc.mem_write(RECORD + 0x48, struct.pack('<2f', 37.5, .75))
put(ROLE + 0x258, 6)
rows = []
for delta in [-.05, 0, .05, .2, .20000002, 1, 1.5]:
    for present in [False, True]:
        for tank_type in [None, 1, 4]:
            for result in [0, 1]:
                put(ROLE + 0x2a0, RECORD if present else 0)
                put(ROLE + 0x2a8, TANK if tank_type is not None else 0)
                put(TANK + 0x50, tank_type or 1)
                execute(0x433190, ROLE, struct.pack('<fI', delta, WORLD))
                if delta <= 0:
                    assert calls == [] and uc.reg_read(UC_X86_REG_EAX) == 1
                else:
                    expected = [ROLE + 0x25c, ROLE + 0x274, ROLE + 0x280, 6, tank_type or 1,
                        37.5 if present else 0, .75 if present else 0, f32(min(delta, 1)),
                        ROLE + 0x2b8, ROLE + 0x28c, WORLD]
                    assert calls == [dict(kind='wrapper', arguments=expected), dict(kind='matrix',
                        arguments=[ROLE + 0x2b8, ROLE + 0x25c, ROLE + 0x280])]
                    assert uc.reg_read(UC_X86_REG_EAX) == result
                rows.append(dict(delta=delta, recordPresent=present, tankType=tank_type,
                    suppliedWrapperResult=result, calls=list(calls), returned=uc.reg_read(UC_X86_REG_EAX)))
put(0x633588, MANAGER); put(MANAGER + 0xac, 0); put(MANAGER + 0xe0, STAGES)
put(STAGES, STAGE); put(STAGE, STAGEVTABLE); put(STAGEVTABLE + 4, STAGEGET)
controller_rows = []
for phase in range(6):
    for present in [False, True]:
        for active in [False, True]:
            for command in [0, 1, 6]:
                put(CONTROLLER + 0x3c, ROLE if present else 0); put(ROLE + 0x234, int(active))
                execute(0x426fe3, CONTROLLER, struct.pack('<I2f', command, .05, 12.5))
                expected = []
                if phase == 4 and present:
                    expected = [dict(kind='stop', timestamp=12.5)] if command == 0 else [
                        dict(kind='command', arguments=[command, f32(.05) if active else 0, 12.5])]
                assert calls == expected
                controller_rows.append(dict(phase=phase, rolePresent=present, active=active,
                    command=command, calls=list(calls)))
(ROOT / 'recovery/output/movement-dispatch-native.json').write_text(json.dumps(dict(
    status='PASS', roleRows=rows, controllerRows=controller_rows,
    boundaries='Full433190/4321e3 and426fe3;435088/433073/426a54/4269f4 are capture endpoints. '
        'Stage virtual+4 is supplied. Matrix service/controller virtual+40/map collision not executed.'), indent=2) + '\n')
print(f'PASS: {len(rows)} original role dispatch samples: positive-delta, cap1, selector10/11, default TankType, wrapper return and matrix update')
print(f'PASS: {len(controller_rows)} original controller dispatch samples: stage4, role presence, inactive zero delta and stop/command routing')
