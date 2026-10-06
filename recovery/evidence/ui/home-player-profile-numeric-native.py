"""Execute named Home profile getters and record their source text update paths."""
import json
import struct
import sys
from pathlib import Path
import capstone
import pefile
from unicorn.x86_const import UC_X86_REG_EAX, UC_X86_REG_ECX, UC_X86_REG_ESP
ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'recovery'))
from effect_native import map_original_binaries
pe = pefile.PE(str(ROOT / 'CDTank/CDTank.exe'))
base = pe.OPTIONAL_HEADER.ImageBase
code = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)
def instructions(start, end):
    return [{'va': hex(i.address), 'bytes': i.bytes.hex(), 'asm': i.mnemonic + ' ' + i.op_str}
            for i in code.disasm(pe.get_data(start - base, end - start), start)]
assert struct.unpack('<I', pe.get_data(0x5d26a8 + 0x18 - base, 4))[0] == 0x4e333b
assert pe.get_data(0x5c83d4 - base, 3) == b'%d\0'
assert struct.unpack('<I', pe.get_data(0x5c4118 + 0x14 - base, 4))[0] == 0x42fdda
assert struct.unpack('<I', pe.get_data(0x5c4118 + 0x18 - base, 4))[0] == 0x42fdc5
uc, _ = map_original_binaries([ROOT / 'CDTank/CDTank.exe'])
uc.mem_map(0x2000000, 0x20000)
PROFILE, STACK, RETURN = 0x2001000, 0x2010000, 0x2011000
fields = [('score', 'txtPlayerScore', 0x13c, 0x16, 0x42fdda, 0x5c),
          ('originality', 'txtPlayerOriginality', 0x134, 0x1f, 0x42fdc5, 0x9c),
          ('tech', 'txtPlayerTech', 0x138, 0x26, 0x42fdc5, 0xa0)]
rows = []
for name, control, member, selector, getter, offset in fields:
    for value in [0, 17, 123456789, 0x7fffffff, 0x80000000, 0xffffffff]:
        payload = bytearray((index * 37 + 11) & 255 for index in range(0x170))
        struct.pack_into('<I', payload, offset, value)
        uc.mem_write(PROFILE, bytes(payload))
        uc.mem_write(STACK, struct.pack('<II', RETURN, selector))
        uc.reg_write(UC_X86_REG_ECX, PROFILE)
        uc.reg_write(UC_X86_REG_ESP, STACK)
        uc.emu_start(getter, RETURN, count=100)
        assert uc.reg_read(UC_X86_REG_EAX) == value
        assert uc.reg_read(UC_X86_REG_ESP) == STACK + 8
        assert bytes(uc.mem_read(PROFILE, 0x170)) == payload
        signed = value if value < 0x80000000 else value - 0x100000000
        rows.append({'field': name, 'selector': selector, 'payloadOffset': hex(offset),
                     'bits': value, 'getterBits': uc.reg_read(UC_X86_REG_EAX),
                     'signedDecimalText': str(signed), 'profileUnchanged': True})
result = {'status': 'PASS_NAMED_HOME_PROFILE_NUMERIC_GETTERS',
          'fields': [{'name': name, 'control': control, 'ownerMember': hex(member),
                      'selector': selector, 'getter': hex(getter), 'payloadOffset': hex(offset),
                      'format': 'signed int32 decimal (%d)'}
                     for name, control, member, selector, getter, offset in fields],
          'nativeGetterRows': rows,
          'source': {'currentProfile': instructions(0x4e338f, 0x4e33a2),
                     'currentProfileSelection': instructions(0x4269c4, 0x4269f4),
                     'updateText': instructions(0x4e378b, 0x4e3878),
                     'getterForwarding': instructions(0x42fdc5, 0x42fde2),
                     'scoreGetter': instructions(0x420521, 0x420551),
                     'scalarGetterCases': instructions(0x420416, 0x420428),
                     'payloadCopyBoundary': instructions(0x42493b, 0x424947)},
          'limits': ['Getters executed from original binary; text update path is static source, not native GUI execution.',
                     'No claim for earning or changing these values, original authority, whole page or pixel equivalence.',
                     'Values must come from confirmed RoleProfile payload; absent profile stays blank.']}
(ROOT / 'recovery/output/home-player-profile-numeric-native.json').write_text(
    json.dumps(result, indent=2) + '\n')
print('PASS named Home score/originality/tech getters: 18 original executions, payload unchanged')
