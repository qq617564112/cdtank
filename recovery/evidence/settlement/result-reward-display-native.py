"""Original result reward display fields and x87 display gate."""
import json
import struct
from pathlib import Path
import pefile
from capstone import Cs, CS_ARCH_X86, CS_MODE_32
from unicorn import Uc, UC_ARCH_X86, UC_MODE_32, UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_EBP, UC_X86_REG_ESP

ROOT = Path(__file__).resolve().parents[3]
pe = pefile.PE(str(ROOT / 'CDTank/CDTank.exe'))
BASE = pe.OPTIONAL_HEADER.ImageBase
decoder = Cs(CS_ARCH_X86, CS_MODE_32)
def original(start, end):
    return [{'va': hex(i.address), 'bytes': i.bytes.hex(),
             'instruction': f'{i.mnemonic} {i.op_str}'.strip()}
            for i in decoder.disasm(pe.get_data(start - BASE, end - start), start)]
def text(address):
    return pe.get_data(address - BASE, 100).split(b'\0')[0].decode('ascii')
assert struct.unpack('<f', pe.get_data(0x5ccffc - BASE, 4))[0] == 1
assert struct.unpack('<f', pe.get_data(0x5e6868 - BASE, 4))[0] == 0
assert text(0x5c83d4) == '%d'
assert text(0x5c7244) == '0'
fields = [
    dict(name='money', messageOffset=0xc0, ownerOffset=0x2bc, start=0x4acc53,
         end=0x4accb8, local=-0x30, formatter=0x4acc7c, zero=0x4accab, control=0x5cd37c),
    dict(name='coin', messageOffset=0xc4, ownerOffset=0x2c4, start=0x4accd3,
         end=0x4acd38, local=-0x1c, formatter=0x4accfc, zero=0x4acd2b, control=0x5cd340),
    dict(name='originality', messageOffset=0xc8, ownerOffset=0x2c0, start=0x4acbcc,
         end=0x4acc32, local=None, formatter=0x4acbf6, zero=0x4acc25, control=0x5cd35c),
    dict(name='tech', messageOffset=0xcc, ownerOffset=0x2c8, start=0x4acd53,
         end=0x4acdb8, local=-0x18, formatter=0x4acd7c, zero=0x4acdab, control=0x5cd324),
]
rows = []
for field in fields:
    for gate, value in [(1.5,123),(.5,-9),(1,0),(0,123),(-1,123),(1,0x80000001)]:
        machine = Uc(UC_ARCH_X86, UC_MODE_32)
        machine.mem_map(0x400000, 0x240000)
        machine.mem_write(0x400000, pe.get_memory_mapped_image()[:0x240000])
        machine.mem_map(0x700000, 0x30000)
        frame, message = 0x710000, 0x720000
        machine.reg_write(UC_X86_REG_EBP, frame)
        machine.reg_write(UC_X86_REG_ESP, frame - 0x800)
        machine.mem_write(frame + 8, struct.pack('<I', message))
        machine.mem_write(message + field['messageOffset'], struct.pack('<I', value & 0xffffffff))
        machine.mem_write(frame - 0x30, struct.pack('<f', gate))
        if field['local'] is not None:
            machine.mem_write(frame + field['local'], struct.pack('<f', gate))
        else:
            # Supply the creative multiplier left on the x87 stack by the preceding getter.
            machine.mem_write(0x700000, b'\xd9\x05' + struct.pack('<I', frame - 0x30))
            machine.emu_start(0x700000, 0x700006)
        observed = []
        def observe(uc, address, size, data):
            if address == field['formatter']:
                stack = uc.reg_read(UC_X86_REG_ESP)
                dest, length, fmt, raw = struct.unpack('<4I', uc.mem_read(stack,16))
                assert length == 32 and fmt == 0x5c83d4
                observed.append(dict(branch='message', rawUint32=raw,
                                     signedDecimal=struct.unpack('<i',struct.pack('<I',raw))[0]))
                uc.emu_stop()
            elif address == field['zero']:
                stack = uc.reg_read(UC_X86_REG_ESP)
                assert struct.unpack('<I',uc.mem_read(stack,4))[0] == 0x5c7244
                observed.append(dict(branch='literal', text='0'))
                uc.emu_stop()
        machine.hook_add(UC_HOOK_CODE, observe)
        machine.emu_start(field['start'], field['end'])
        expected = dict(branch='literal',text='0') if gate == 0 else dict(
            branch='message',rawUint32=value & 0xffffffff,
            signedDecimal=struct.unpack('<i',struct.pack('<I',value & 0xffffffff))[0])
        assert observed == [expected], (field['name'],gate,observed)
        rows.append(dict(field=field['name'], multiplier=gate, suppliedMessageUint32=value & 0xffffffff,
                         observed=observed[0]))
result = dict(
    status='PASS_ORIGINAL_REWARD_DISPLAY_FIELDS_AND_NONZERO_GATE',
    outcomeSourceReuse='recovery/output/result-music-semantics-source.json',
    callback='0x4ac736',
    fields=[dict(name=f['name'], messageOffset=hex(f['messageOffset']),ownerOffset=hex(f['ownerOffset']),
                 control=text(f['control']),format='%d',instructions=original(f['start'],f['end'])) for f in fields],
    rows=rows,
    rateRule='For each outcome-selected DataScale31..42 rate, add float32 1. Display the received field when that multiplier is nonzero; otherwise display literal 0. Finite native gates only.',
    rateGetter=original(0x439184,0x4391c4),
    callbackBinding=original(0x51c95f,0x51c991),
    callbackDispatch=original(0x49f571,0x49f579),
    scope='24 original field/gate instruction executions. Message and preceding rate inputs supplied; execution stops at original snprintf or literal CEGUI String boundary. No full result receiver, transport, account mutation or authoritative reward calculation.',
    exactGap=[
      'Server producer of message+c0/c4/c8/cc: base reward inputs, outcome/rate application, rounding and eligibility.',
      'Transport message type/codec identity and authoritative account growth/persistence linkage are not qualified by this bounded summary callback investigation.',
      'No original experience field or experience-to-level computation is established by these four display fields.'
    ])
(ROOT / 'recovery/output/result-reward-display-native.json').write_text(json.dumps(result,indent=2)+'\n')
print(result['status']+': 24 field/gate cases')
