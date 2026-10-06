"""Recover the original reflected battle bulletin fields from PE instructions.

These are in-memory field offsets and ObjNet registration codes, not packet offsets.
The original server's interpretation of the two Info fields remains unresolved.
"""
from hashlib import sha256
import json
from pathlib import Path

import capstone
import pefile

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'CDTank/CDTank.exe'


def export():
    raw = SOURCE.read_bytes()
    pe = pefile.PE(data=raw)
    base = pe.OPTIONAL_HEADER.ImageBase
    start, end = 0x521F0F, 0x52201E
    decoder = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)
    instructions = list(decoder.disasm(pe.get_data(start - base, end - start), start))
    properties = []
    current = None
    for index, instruction in enumerate(instructions):
        if instruction.mnemonic == 'push' and instruction.op_str.startswith('0x'):
            value = int(instruction.op_str, 16)
            if base <= value < base + pe.OPTIONAL_HEADER.SizeOfImage:
                name = pe.get_data(value - base, 80).split(b'\0')[0].decode('ascii')
                if name.startswith('m_i'):
                    previous = instructions[index - 1]
                    assert previous.mnemonic == 'push'
                    type_code = int(previous.op_str, 16)
                    if type_code == 14:
                        count = instructions[index - 2]
                        assert count.mnemonic == 'push'
                        element_count = int(count.op_str, 16)
                    else:
                        assert type_code == 5
                        # EDI is set to one at 0x521f15/0x521f1b.
                        assert instructions[index - 2].op_str == 'edi'
                        element_count = 1
                    current = {'name': name, 'nameVa': hex(value),
                               'registrationVa': hex(instruction.address),
                               'registrationTypeCode': type_code, 'elementCount': element_count}
                    properties.append(current)
        if current is not None and instruction.mnemonic == 'call':
            if instruction.op_str in ('dword ptr [eax + 0x34]', 'dword ptr [eax + 0x40]'):
                current['registrationMethod'] = instruction.op_str
        if current is not None and instruction.mnemonic in ('lea', 'add'):
            if instruction.op_str.startswith('ecx, [esi + ') or instruction.op_str.startswith('esi, '):
                offset = instruction.op_str.split('0x')[-1].rstrip(']')
                current['objectOffset'] = int(offset, 16)
                current['bindingVa'] = hex(instruction.address)
                current = None
    expected = [('m_iCatsInfo', 12), ('m_iDogsInfo', 16), ('m_iDogTankNumb', 20),
                ('m_iCatTankNumb', 24), ('m_iCatPlayer', 28), ('m_iDogPlayer', 52)]
    assert [(p['name'], p['objectOffset']) for p in properties] == expected
    assert pe.get_data(0x521F15 - base, 2) == bytes.fromhex('33ff')
    assert pe.get_data(0x521F1B - base, 1) == bytes.fromhex('47')
    assert pe.get_data(0x522029 - base, 2) == bytes.fromhex('6a4c')
    assert pe.get_data(0x5C4AE0 - base, 22).split(b'\0')[0] == b'OdlBattlefieldBulletin'
    return {'source': str(SOURCE), 'sha256': sha256(raw).hexdigest(),
            'class': 'OdlBattlefieldBulletin', 'classRegistrationVa': '0x522060',
            'objectSize': 76, 'properties': properties,
            'registrationDisassembly': [{'va': hex(i.address), 'bytes': i.bytes.hex(),
                                        'instruction': f'{i.mnemonic} {i.op_str}'}
                                       for i in instructions],
            'limits': ['Object offsets are not network packet offsets.',
                       'Type codes 5/14 require separate ObjNet type-table decoding.',
                       'CatsInfo/DogsInfo mode semantics are not established.',
                       'Class wire ID is assigned dynamically; no fixed opcode inferred.']}


if __name__ == '__main__':
    result = export()
    target = ROOT / 'recovery/output/bulletin-schema.json'
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    print(f"Recovered {len(result['properties'])} source bulletin properties: {target}")
