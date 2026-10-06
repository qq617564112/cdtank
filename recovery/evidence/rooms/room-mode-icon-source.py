"""Execute the original room directory mode-image producer and mode selectors."""
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
uc.mem_map(0x2000000, 0x50000)
CONTROLLER, ENTRY, RECORD, IMAGE, MANAGER, IMAGESET = [0x2001000 + n * 0x1000 for n in range(6)]
FRAME, STACK, RETURN, EVENT, RADIO = [0x2020000 + n * 0x1000 for n in range(5)]
strings, calls = {}, []

def write(address, value):
    uc.mem_write(address, struct.pack('<I', value & 0xffffffff))

def read(address):
    return struct.unpack('<I', uc.mem_read(address, 4))[0]

def cstring(address):
    return bytes(uc.mem_read(address, 256)).split(b'\0')[0].decode('ascii')

def finish(pop=0, value=0):
    sp = uc.reg_read(UC_X86_REG_ESP)
    uc.reg_write(UC_X86_REG_EAX, value)
    uc.reg_write(UC_X86_REG_EIP, read(sp))
    uc.reg_write(UC_X86_REG_ESP, sp + 4 + pop)

imports = [0x5c0340, 0x5c03ec, 0x5c039c, 0x5c03cc, 0x5c0330, 0x5c013c]
stubs = {0x2030000 + n * 0x100: address for n, address in enumerate(imports)}
for stub, address in stubs.items():
    write(address, stub)
    uc.mem_write(stub, b'\xc3')

def hook(machine, address, size, data):
    sp = machine.reg_read(UC_X86_REG_ESP)
    this = machine.reg_read(UC_X86_REG_ECX)
    if address == 0x57c0d6:
        dest, capacity, fmt, raw = [read(sp + n * 4) for n in range(1, 5)]
        value = cstring(fmt) % raw
        assert len(value) < capacity
        machine.mem_write(dest, value.encode() + b'\0')
        calls.append(dict(kind='format', rawMode=raw, image=value))
        finish(value=len(value))
    elif address in stubs:
        imported = stubs[address]
        if imported == 0x5c0340:
            strings[this] = cstring(read(sp + 4))
            finish(4, this)
        elif imported == 0x5c03ec:
            finish(value=MANAGER)
        elif imported == 0x5c039c:
            assert this == MANAGER
            calls.append(dict(kind='imageset', name=strings[read(sp + 4)]))
            finish(4, IMAGESET)
        elif imported == 0x5c03cc:
            assert this == IMAGESET
            calls.append(dict(kind='image', name=strings[read(sp + 4)]))
            finish(4, IMAGE)
        elif imported == 0x5c013c:
            calls.append(dict(kind='setImage', control=this, imagePointer=read(sp + 4)))
            finish(4)
        else:
            finish()
    elif address == 0x4d650b:
        finish()
    elif address == 0x4a5c12:
        calls.append(dict(kind='modeSelectionUpdate', rawMode=read(this + 0x24)))
        finish()

uc.hook_add(UC_HOOK_CODE, hook)
producer_rows = []
for raw in range(5):
    for slot in range(10):
        calls.clear()
        strings.clear()
        write(ENTRY + 4, RECORD)
        write(RECORD + 0x38, raw)
        control = CONTROLLER + 0x800 + slot * 0x40
        write(CONTROLLER + (slot + 2) * 0x34, control)
        write(FRAME - 0x20, slot)
        write(FRAME - 0x14, CONTROLLER)
        uc.reg_write(UC_X86_REG_ESP, STACK)
        uc.reg_write(UC_X86_REG_EBP, FRAME)
        uc.reg_write(UC_X86_REG_EDI, ENTRY)
        # EBX is the original destructor import, used twice in the region.
        destructor = next(stub for stub, address in stubs.items() if address == 0x5c0330)
        uc.reg_write(UC_X86_REG_EBX, destructor)
        uc.emu_start(0x5070b9, 0x507168, count=300)
        assert uc.reg_read(UC_X86_REG_EIP) == 0x507168
        assert uc.reg_read(UC_X86_REG_ESP) == STACK
        assert calls == [dict(kind='format', rawMode=raw, image=f'data\\ui\\gy\\{raw}.tga'),
                         dict(kind='imageset', name='gy0'),
                         dict(kind='image', name=f'data\\ui\\gy\\{raw}.tga'),
                         dict(kind='setImage', control=control, imagePointer=IMAGE)]
        producer_rows.append(dict(rawMode=raw, slot=slot, controlOffset=hex((slot + 2) * 0x34), calls=list(calls)))

selectors = [('team', 0, 0x88, 0x4a60e8), ('conquer', 1, 0x94, 0x4a6134),
             ('vip', 2, 0x90, 0x4a6183), ('melee', 3, 0x8c, 0x4a61d2),
             ('destroy', 4, 0x98, 0x4a6221)]
selector_rows = []
for name, raw, offset, address in selectors:
    calls.clear()
    write(CONTROLLER + offset, RADIO)
    write(CONTROLLER + 0x24, 99)
    write(EVENT + 8, RADIO)
    uc.mem_write(RADIO + 0x38c, b'\x01')
    write(STACK, RETURN)
    write(STACK + 4, EVENT)
    uc.reg_write(UC_X86_REG_ESP, STACK)
    uc.reg_write(UC_X86_REG_ECX, CONTROLLER)
    uc.emu_start(address, RETURN, count=150)
    assert uc.reg_read(UC_X86_REG_EIP) == RETURN
    assert read(CONTROLLER + 0x24) == raw
    assert calls == [dict(kind='modeSelectionUpdate', rawMode=raw)]
    selector_rows.append(dict(name=name, rawMode=raw, callback=hex(address), radioOffset=hex(offset)))

pe = images['cdtank.exe']
image = pe.get_memory_mapped_image()
md = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)
ranges = [(0x5070b9, 0x507168), (0x507ff6, 0x508021), (0x4a4776, 0x4a4898),
          (0x4a60e8, 0x4a626e)]
result = dict(status='PASS', producerRows=producer_rows, selectorRows=selector_rows,
    execution='Original EXE instructions; bounded GUI imports and printf observed through hooks; no full CEGUI execution.',
    mapping=[dict(webMode=raw+1, originalMode=raw, name=name, imageset='gy0', image=f'data\\ui\\gy\\{raw}.tga')
             for name, raw, _, _ in selectors],
    unproven=['Upstream network record +0x38 construction/receipt', 'Full directory and pagination callbacks'],
    disassembly={hex(a): [f'{i.address:08x} {i.mnemonic} {i.op_str}' for i in md.disasm(image[a-0x400000:z-0x400000],a)] for a,z in ranges})
out = ROOT / 'recovery/output/room-mode-icon-source.json'
out.write_text(json.dumps(result, ensure_ascii=False, indent=2)+'\n')
print('PASS: 50 original directory image selections; five original named mode radio callbacks')
