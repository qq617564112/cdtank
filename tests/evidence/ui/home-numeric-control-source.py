"""Locate five named Home numeric controls without inferring profile fields."""
import json
import struct
from pathlib import Path
import capstone
import pefile

ROOT = Path(__file__).resolve().parents[3]
pe = pefile.PE(str(ROOT / 'CDTank/CDTank.exe'))
base = pe.OPTIONAL_HEADER.ImageBase
rows = []
for name in ['txtPlayerScore', 'txtPlayerOriginality', 'txtPlayerTech', 'txtOriginality', 'txtTech']:
    hits = []
    for section in pe.sections:
        data = section.get_data()
        start = 0
        while (position := data.find(name.encode() + b'\0', start)) >= 0:
            begin = data.rfind(b'\0', 0, position) + 1
            address = base + section.VirtualAddress + begin
            references = []
            for code_section in pe.sections:
                if not code_section.Characteristics & 0x20000000:
                    continue
                code_data = code_section.get_data()
                cursor = 0
                while (reference := code_data.find(struct.pack('<I', address), cursor)) >= 0:
                    references.append(hex(base + code_section.VirtualAddress + reference))
                    cursor = reference + 1
            hits.append({'stringVA': hex(address), 'string': data[begin:position + len(name)].decode('ascii'),
                         'codeImmediateReferences': references})
            start = position + 1
    rows.append({'control': name, 'hits': hits})

code = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)
initialization = list(code.disasm(pe.get_data(0x4df07e - base, 0x4df120 - 0x4df07e), 0x4df07e))
by_address = {instruction.address: instruction for instruction in initialization}
for address, operand in [(0x4df0a6, 'dword ptr [ecx + 0x134], eax'),
                         (0x4df0e0, 'dword ptr [ecx + 0x138], eax'),
                         (0x4df11a, 'dword ptr [ecx + 0x13c], eax')]:
    assert by_address[address].mnemonic == 'mov' and by_address[address].op_str == operand

def record(instruction):
    return {'va': hex(instruction.address), 'bytes': instruction.bytes.hex(),
            'asm': instruction.mnemonic + ' ' + instruction.op_str}

code.skipdata = True
instructions = list(code.disasm(pe.get_data(0x4df17e - base, 0x4e1000 - 0x4df17e), 0x4df17e))
uses = []
for index, instruction in enumerate(instructions):
    if any(' + ' + hex(offset) + ']' in instruction.op_str for offset in [0x134, 0x138, 0x13c]):
        uses.append({'reference': hex(instruction.address),
                     'instructions': [record(item) for item in instructions[max(0, index - 8):index + 10]]})
result = {
    'status': 'NAMED_HOME_FIELD_INITIALIZATION_SOURCE', 'binary': 'CDTank/CDTank.exe',
    'controls': rows,
    'homePlayerControlMembers': {'txtPlayerOriginality': 'this+0x134',
                                 'txtPlayerTech': 'this+0x138', 'txtPlayerScore': 'this+0x13c'},
    'initialization': [record(instruction) for instruction in initialization],
    'boundedHomePlayerMemberUses': {'start': '0x4df17e', 'end': '0x4e1000', 'rows': uses},
    'limits': ['UI control member offsets are not profile payload offsets.',
               'Immediate references and initialization do not prove the value getter or producer.',
               'No native execution, Web runtime or production changes.'],
}
(ROOT / 'recovery/output/home-numeric-control-string-references.json').write_text(
    json.dumps(result, indent=2) + '\n')
print('Named Home control initialization recorded; profile field producers remain unconfirmed.')
