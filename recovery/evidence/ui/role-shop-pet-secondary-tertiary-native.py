"""Original PetShop secondary branches and tertiary numeric formatter input."""
import json
from pathlib import Path
import struct
import sys
import pefile
from capstone import Cs, CS_ARCH_X86, CS_MODE_32
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_EAX, UC_X86_REG_EBP, UC_X86_REG_EBX, UC_X86_REG_EDI, UC_X86_REG_EIP, UC_X86_REG_ESP

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'recovery'))
from effect_native import map_original_binaries
from inspect_assets import read_table

proof = json.loads((ROOT / 'recovery/output/role-pet-base-native.json').read_text())
assert proof['status'] == 'PASS'
table = read_table(ROOT / 'CDTank/Data/table/pet.dat')
assert table['columns'][2:4] == ['PetType', 'PetSize']
assert table['columns'][6] == 'PetCoin'
strings = {int(row['values']['ID']): row['values']['String'] for row in
           read_table(ROOT / 'CDTank/Data/table/gamestring.dat')['rows']}
machine, _ = map_original_binaries([ROOT / 'CDTank/CDTank.exe'])
machine.mem_map(0x2000000, 0x20000)
RECORD, FRAME, STACK, OUTPUT = [0x2001000 + index * 0x3000 for index in range(4)]
stage, ids, numbers = '', [], []


def read(address):
    return struct.unpack('<I', machine.mem_read(address, 4))[0]


def hook(uc, address, size, data):
    stack = uc.reg_read(UC_X86_REG_ESP)
    if address in [0x4d8cf7, 0x4d8d8a]:
        if (address == 0x4d8cf7 and stage == 'size') or address == 0x4d8d8a:
            uc.emu_stop()
        return
    if address == 0x401626:
        uc.reg_write(UC_X86_REG_EAX, OUTPUT)
        uc.reg_write(UC_X86_REG_EIP, read(stack))
        uc.reg_write(UC_X86_REG_ESP, stack + 8)
    elif address == 0x417e17:
        ids.append(read(stack + 4))
        # Capture the original gamestring lookup, then stop this branch before
        # CEGUI conversion. String construction/rendering are supplied boundaries.
        uc.reg_write(UC_X86_REG_ESP, stack + 12)
        uc.emu_stop()
    else:
        assert address == 0x4b4ad2
        numbers.append(struct.unpack('<d', uc.mem_read(stack + 8, 8))[0])
        uc.reg_write(UC_X86_REG_ESP, stack + 4)
        uc.emu_stop()


for address in [0x401626, 0x417e17, 0x4b4ad2, 0x4d8cf7, 0x4d8d8a]:
    machine.hook_add(UC_HOOK_CODE, hook, begin=address, end=address)


def secondary(pet_type, pet_size):
    global stage
    machine.mem_write(RECORD + 0x2c, struct.pack('<2I', pet_type, pet_size))
    machine.mem_write(FRAME + 8, struct.pack('<I', RECORD))
    ids.clear()
    for stage, start, end in [('size', 0x4d8c3e, 0x4d8cf7),
                             ('type', 0x4d8cf7, 0x4d8d8a)]:
        machine.reg_write(UC_X86_REG_EBP, FRAME)
        machine.reg_write(UC_X86_REG_ESP, STACK)
        machine.reg_write(UC_X86_REG_EDI, 16)
        machine.reg_write(UC_X86_REG_EBX, 685)
        machine.emu_start(start, end, count=100)
    expected = ([{0: 685, 1: 677, 2: 676, 3: 675}[pet_size]] if pet_size <= 3 else [])
    expected += ([{0: 685, 1: 678, 2: 679}[pet_type]] if pet_type <= 2 else [])
    assert ids == expected, (pet_type, pet_size, ids, expected)
    return dict(petType=pet_type, petSize=pet_size, gamestringIds=list(ids),
                text=''.join(strings[value] for value in ids))


rows = []
for row in proof['rows']:
    values = row['values']
    assert row['columns'][2:4] == [[2, 0], [3, 0]] and row['columns'][6] == [6, 0]
    result = secondary(int(values['PetType']), int(values['PetSize']))
    machine.mem_write(RECORD + 0x54, struct.pack('<i', int(values['PetCoin'])))
    machine.mem_write(FRAME + 8, struct.pack('<I', RECORD))
    machine.reg_write(UC_X86_REG_EBP, FRAME)
    machine.reg_write(UC_X86_REG_ESP, STACK)
    numbers.clear()
    machine.emu_start(0x4d9bd1, 0x4d9bee, count=100)
    expected = int(values['PetCoin']) * .1
    assert numbers == [expected]
    assert expected == int(expected), 'Actual PetCoin values format as whole numbers'
    result.update(petId=int(values['ID']), petCoin=int(values['PetCoin']),
                  formatterDouble=numbers[0], actualNumericText=str(int(expected)))
    rows.append(result)
boundaries = [secondary(0, 0), secondary(3, 4)]

pe = pefile.PE(str(ROOT / 'CDTank/CDTank.exe'))
base = pe.OPTIONAL_HEADER.ImageBase
cs = Cs(CS_ARCH_X86, CS_MODE_32)


def trace(start, end):
    return [dict(va=hex(item.address), asm=item.mnemonic + ' ' + item.op_str)
            for item in cs.disasm(pe.get_data(start - base, end - start), start)]


result = dict(status='PASS_SOURCE_PETSHOP_SECONDARY_AND_TERTIARY_INPUT',
    tasks=['UI56', 'M5-10'], existingLoader='role-pet-base-native.json',
    fields={'secondary': {'+0x30': 'PetSize/column3', '+0x2c': 'PetType/column2'},
            'tertiary': {'+0x54': 'PetCoin/column6'}}, rows=rows, boundaries=boundaries,
    secondaryFormat='Size string followed by Type string, CEGUI String+String, no delimiter; unknown0 uses gamestring685, unmatched values leave that local string empty.',
    tertiaryFormat={'numeric': 'signed32 PetCoin -> x87 FILD -> multiply double0.1 -> stored double ->4b4ad2',
                    'formatter': '4b4774 constructs ostream, clears flag1 and sets precision16;4b47be calls double insertion4b4396;4b4a4e extracts string. Full locale formatter not executed.',
                    'prefix': strings[78], 'currency': strings[722], 'separator': '  ',
                    'composition': '((gamestring78 + two spaces) + gamestring722) + formatted numeric output',
                    'actualRowsNumericText': 'All actual PetCoin values produce exact integral doubles0/35/40/45/50; no duration or payment policy.'},
    traces={'loaderIdentity': trace(0x43a94d, 0x43a9a2),
            'secondary': trace(0x4d8c3e, 0x4d8dce),
            'tertiary': trace(0x4d9bd1, 0x4d9d55),
            'formatterSetup': trace(0x4b4774, 0x4b47e4)},
    limits=['Native execution covers selection branches and formatter double input; C++/CEGUI lookup, conversion and rendering boundaries supplied.',
            'String concatenation and precision contract come from direct instructions/import identities, not original font pixels or full locale execution.',
            'No purchase pricing, role numeric formula, availability, production, protocol, browser or old loader rerun.'])
(ROOT / 'recovery/output/role-shop-pet-secondary-tertiary-native.json').write_text(
    json.dumps(result, ensure_ascii=False, indent=2) + '\n')
print(f'PASS: {len(rows)} actual pet secondary branches/tertiary double inputs and2 source boundaries')
