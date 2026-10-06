"""Execute the original pet-learning request and reply bit serializers."""
import json
import struct
import sys
from pathlib import Path
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_EAX, UC_X86_REG_ECX, UC_X86_REG_EIP, UC_X86_REG_ESP
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'recovery'))
from effect_native import map_original_binaries
uc, _ = map_original_binaries([ROOT / 'CDTank/CDTank.exe'])
uc.mem_map(0x2000000, 0x6000)
PACKET, STREAM, STACK, STOP = 0x2001000, 0x2002000, 0x2003000, 0x2004000
fields, incoming = [], []
def put(a, *v): uc.mem_write(a, struct.pack('<' + 'I' * len(v), *v))
def get(a): return struct.unpack('<I', uc.mem_read(a, 4))[0]
def terminal(machine, address, size, data):
    s = uc.reg_read(UC_X86_REG_ESP)
    assert uc.reg_read(UC_X86_REG_ECX) == STREAM
    bits, pointer = get(s + 8), get(s + 4)
    if address == 0x401c7a: fields.append({'bits': bits, 'value': get(pointer) & ((1 << bits) - 1)})
    else:
        row = incoming.pop(0); assert row['bits'] == bits; put(pointer, row['value'])
    uc.reg_write(UC_X86_REG_EAX, 1); uc.reg_write(UC_X86_REG_EIP, get(s)); uc.reg_write(UC_X86_REG_ESP, s + 12)
for a in (0x401c7a, 0x401d58): uc.hook_add(UC_HOOK_CODE, terminal, begin=a, end=a)
def call(a):
    put(STACK, STOP, STREAM); uc.reg_write(UC_X86_REG_ECX, PACKET); uc.reg_write(UC_X86_REG_ESP, STACK)
    uc.emu_start(a, STOP, count=10000)
    assert uc.reg_read(UC_X86_REG_ESP) == STACK + 8 and uc.reg_read(UC_X86_REG_EIP) == STOP
rows = []
for name, writer, reader, values, bits in [('0x3f92', 0x440c3f, 0x492987, [83, 4], [32, 8]),
                                         ('0x3f93', 0x498dd1, 0x498e2e, [83, 4, 123, 3], [32, 8, 16, 8])]:
    put(PACKET + 0xc, *values); fields.clear(); call(writer)
    assert fields == [{'bits': b, 'value': v} for b, v in zip(bits, values)]
    incoming[:] = fields; uc.mem_write(PACKET + 0xc, bytes(len(values) * 4)); call(reader)
    assert [get(PACKET + 0xc + i * 4) for i in range(len(values))] == values and not incoming
    rows.append({'type': name, 'writer': hex(writer), 'reader': hex(reader), 'fields': list(fields), 'payloadBits': sum(bits)})
output = {'status': 'PASS_ORIGINAL_PET_LEARN_REQUEST_REPLY_SERIALIZERS', 'rows': rows,
          'scope': 'One request and one reply roundtrip through original serializers with supplied bit-stream terminals; no original socket framing or server execution.'}
(ROOT / 'recovery/output/pet-skill-learn-codec-native.json').write_text(json.dumps(output, indent=2) + '\n')
print(output['status'])
