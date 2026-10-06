"""Original role timer update, including flag8 and trap permission countdown."""
import itertools
import json
from pathlib import Path
import struct
import sys
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_EAX, UC_X86_REG_ECX, UC_X86_REG_EIP, UC_X86_REG_ESP

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'recovery'))
from effect_native import map_original_binaries
uc, images = map_original_binaries([ROOT / 'CDTank/CDTank.exe'])
pe = images['cdtank.exe']
assert pe.get_data(0x431cf0 - 0x400000, 7) == bytes.fromhex('c6860903000001')
assert pe.get_data(0x431cf7 - 0x400000, 10) == bytes.fromhex('c7860c03000000004040')
uc.mem_map(0x2000000, 0x20000)
ROLE, RECORD, VTABLE, STACK, RETURN, OBSERVER = 0x2001000, 0x2002000, 0x2003000, 0x2010000, 0x2011000, 0x2012000
notifications = []

def write(address, *values):
    uc.mem_write(address, struct.pack('<' + 'I' * len(values), *values))

def read(address):
    return struct.unpack('<I', uc.mem_read(address, 4))[0]

def observer(machine, address, size, data):
    stack = machine.reg_read(UC_X86_REG_ESP)
    notifications.append(read(stack + 4))
    machine.reg_write(UC_X86_REG_EIP, read(stack))
    machine.reg_write(UC_X86_REG_ESP, stack + 8)

uc.hook_add(UC_HOOK_CODE, observer, begin=OBSERVER, end=OBSERVER)
rows = []
for flag_time, trap_time, permission, delta in itertools.product([0, .125, .5], [0, .125, 3], [0, 1, 255], [0, .125, .5, 3.125]):
    uc.mem_write(ROLE, bytes(0x400))
    uc.mem_write(RECORD, bytes(0x200))
    write(ROLE + 0x2a0, RECORD)
    write(RECORD, VTABLE)
    write(VTABLE + 0x24, OBSERVER)
    uc.mem_write(RECORD + 0x124, b'\x01')
    uc.mem_write(ROLE + 0x304, struct.pack('<f', flag_time))
    uc.mem_write(ROLE + 0x309, bytes([permission]))
    uc.mem_write(ROLE + 0x30c, struct.pack('<f', trap_time))
    write(STACK, RETURN)
    uc.mem_write(STACK + 4, struct.pack('<f', delta))
    uc.reg_write(UC_X86_REG_ECX, ROLE)
    uc.reg_write(UC_X86_REG_ESP, STACK)
    notifications.clear()
    uc.emu_start(0x43210e, RETURN, count=1000)
    assert uc.reg_read(UC_X86_REG_EIP) == RETURN and uc.reg_read(UC_X86_REG_ESP) == STACK + 8
    result = dict(flag8Seconds=struct.unpack('<f', uc.mem_read(ROLE + 0x304, 4))[0],
        flag8=int(uc.mem_read(RECORD + 0x124, 1)[0]),
        trapPermission=int(uc.mem_read(ROLE + 0x309, 1)[0]),
        trapCountdown=struct.unpack('<f', uc.mem_read(ROLE + 0x30c, 4))[0], notifications=list(notifications))
    rows.append(dict(flagTime=flag_time, trapTime=trap_time, permission=permission, delta=delta, result=result))
# Original actor update42b563 passes its f32 relative-clock difference to role
# vtable+40 at42b604. Both supplied role vtables point that slot to43210e.
assert read(0x5c2c68) == read(0x5c41f8) == 0x43210e
assert pe.get_data(0x42b5f8 - 0x400000, 15) == bytes.fromhex('8b4e3cd945f08b0151d91c24ff5040')
SYSTEM, CONTROLLER, OUTPUT, WRAPPER = 0x2006000, 0x2007000, 0x2008000, 0x2013000
write(0x633588, SYSTEM)
uc.mem_write(SYSTEM + 0x10, bytes(24))
uc.mem_write(SYSTEM + 0x18, struct.pack('<Q', 1000))
uc.mem_write(SYSTEM + 0x20, b'\x01')
uc.mem_write(CONTROLLER + 0x30, struct.pack('<d', 10.5))
counter = 0

def performance_counter(machine, address, size, data):
    stack = machine.reg_read(UC_X86_REG_ESP)
    uc.mem_write(read(stack), struct.pack('<Q', counter))
    machine.reg_write(UC_X86_REG_EAX, 1)
    machine.reg_write(UC_X86_REG_ESP, stack + 4)
    machine.reg_write(UC_X86_REG_EIP, 0x406093)

uc.hook_add(UC_HOOK_CODE, performance_counter, begin=0x40608d, end=0x40608d)
uc.mem_write(WRAPPER, b'\x68' + struct.pack('<I', CONTROLLER)
    + b'\xe8' + struct.pack('<i', 0x422f0d - (WRAPPER + 10))
    + b'\xd9\x1d' + struct.pack('<I', OUTPUT) + b'\xc3')
clocks = []
for counter in [100000, 100125, 103000]:
    write(STACK, RETURN)
    uc.reg_write(UC_X86_REG_ESP, STACK)
    uc.emu_start(WRAPPER, RETURN, count=1000)
    seconds = struct.unpack('<f', uc.mem_read(OUTPUT, 4))[0]
    assert seconds == counter / 1000 - 10.5
    clocks.append(dict(counter=counter, frequency=1000, relativeSeconds=seconds))
(ROOT / 'recovery/output/role-item-timers-native.json').write_text(json.dumps(dict(
    scope='Original43210e/431dbf and422f0d/40607b QPC quotient minus instance epoch. Supplied record observer and performance counter. Actor-update float dispatch bytes verified.',
    rows=rows, clocks=clocks), indent=2))
print(f'PASS: {len(rows)} original flag8/trap timers and exact zero-boundary transitions')
