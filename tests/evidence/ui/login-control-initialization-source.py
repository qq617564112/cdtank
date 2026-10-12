"""Record the original login's named input initialization and keyboard root."""
import json
from pathlib import Path

import capstone
import pefile

ROOT = Path(__file__).resolve().parents[3]
pe = pefile.PE(str(ROOT / 'CDTank/CDTank.exe'))
base = pe.OPTIONAL_HEADER.ImageBase
code = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)
start, end = 0x4c1361, 0x4c17c1
instructions = list(code.disasm(pe.get_data(start - base, end - start), start))
by_address = {i.address: i for i in instructions}


def expect(address, mnemonic, operands):
    instruction = by_address[address]
    assert (instruction.mnemonic, instruction.op_str) == (mnemonic, operands)


def string(address):
    return pe.get_data(address - base, 100).split(b'\0')[0].decode('ascii')


imports = {entry.address: entry.name.decode('ascii') for module in pe.DIRECTORY_ENTRY_IMPORT
           for entry in module.imports if entry.name}
expect(0x4c141b, 'push', '0x5cf984')
expect(0x4c1462, 'push', '0x5cf970')
expect(0x4c1444, 'mov', 'dword ptr [edi + 0x20], eax')
expect(0x4c148b, 'mov', 'dword ptr [edi + 0x24], eax')
expect(0x4c14ac, 'push', '1')
expect(0x4c14ae, 'call', 'dword ptr [0x5c0140]')
assert 'setTextMasked@Editbox' in imports[0x5c0140]
for address in [0x4c14b7, 0x4c14c2]:
    expect(address, 'push', '0x14')
for address in [0x4c14b9, 0x4c14c4]:
    expect(address, 'call', 'dword ptr [0x5c0268]')
assert 'setMaxTextLength@Editbox' in imports[0x5c0268]
expect(0x4c17bc, 'push', '0x5cf878')
assert string(0x5cf878) == 'data\\ui\\layouts\\keyboard.xml'
result = {
    'status': 'PASS_STATIC_NAMED_LOGIN_INPUT_INITIALIZATION',
    'initializer': hex(start), 'boundedEnd': hex(end),
    'inputs': [
        {'name': string(0x5cf984), 'member': 'this+0x20', 'maxTextLength': 20},
        {'name': string(0x5cf970), 'member': 'this+0x24', 'maxTextLength': 20, 'textMasked': True},
    ],
    'keyboardRoot': {'prefix': string(0x5cf898), 'layout': string(0x5cf878),
                     'pathPush': '0x4c17bc', 'scope': 'Loaded by login initialization; show/insertion routing unproven'},
    'imports': {hex(address): imports[address] for address in [0x5c0140, 0x5c0268]},
    'instructions': [{'va': hex(i.address), 'bytes': i.bytes.hex(),
                      'instruction': f'{i.mnemonic} {i.op_str}'} for i in instructions],
    'gaps': ['Original authentication callback and server contract',
             'Keyboard show and input-insertion routing', 'Channel/server directory producer'],
    'nativeExecution': False, 'webRuntime': False, 'parentCompletion': False,
}
(ROOT / 'recovery/output/login-control-initialization-source.json').write_text(
    json.dumps(result, ensure_ascii=False, indent=2) + '\n')
print('PASS_STATIC_NAMED_LOGIN_INPUT_INITIALIZATION: two max20 inputs, password masked, keyboard root loaded')
