"""Bind the original result field branches to named DataScale outcome records."""
import json
import sys
from pathlib import Path
import capstone
import pefile
from unicorn import Uc, UC_ARCH_X86, UC_MODE_32, UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_EBX, UC_X86_REG_EBP, UC_X86_REG_ESP

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'recovery'))
from inspect_assets import read_table
pe = pefile.PE(str(ROOT / 'CDTank/CDTank.exe'))
base = pe.OPTIONAL_HEADER.ImageBase
decoder = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)
def code(start, end):
    return [{'va': hex(i.address), 'bytes': i.bytes.hex(),
             'instruction': f'{i.mnemonic} {i.op_str}'}
            for i in decoder.disasm(pe.get_data(start - base, end - start), start)]

rows = {int(r['values']['ID']): r['values'] for r in read_table(ROOT / 'CDTank/Data/table/datascale.dat')['rows']}
provider_name = pe.get_data(0x5c4c20 - base, 100).split(b'\0')[0].decode('ascii')
assert provider_name == 'ERROR <SYDataScaleTable::GetRateOfTheGame>'
branches = {1: (0x4acb4b, '胜利', 'WIN', [31, 32, 33, 34], 190),
            2: (0x4acada, '失败', 'LOSE', [39, 40, 41, 42], 191),
            3: (0x4aca76, '平局', 'DRAW', [35, 36, 37, 38], None)}
branch_code = code(0x4aca52, 0x4acbbe)
records = []
for flag, (destination, chinese, outcome, ids, music_id) in branches.items():
    for record_id in ids:
        assert rows[record_id]['Name'].startswith(chinese)
    finish = 0x4acbba if flag != 1 else 0x4acbbe
    selected = code(destination, finish)
    immediate_ids = [int(i['instruction'].split(' ', 1)[1], 16)
                     for i in selected if i['instruction'].startswith('push 0x')]
    assert all(record_id in immediate_ids for record_id in ids)
    uc = Uc(UC_ARCH_X86, UC_MODE_32)
    uc.mem_map(0x4ac000, 0x2000)
    uc.mem_write(0x4aca52, pe.get_data(0x4aca52 - base, 0x178))
    uc.mem_map(0x700000, 0x2000)
    uc.mem_map(0x800000, 0x2000)
    uc.reg_write(UC_X86_REG_EBX, 0x700000)
    uc.reg_write(UC_X86_REG_EBP, 0x800800)
    uc.reg_write(UC_X86_REG_ESP, 0x801000)
    uc.mem_write(0x700510, flag.to_bytes(4, 'little'))
    reached = []
    def observe(machine, address, size, data):
        if address in {0x4acb4b, 0x4acada, 0x4aca76, 0x4acc1a}:
            reached.append(address)
            machine.emu_stop()
    uc.hook_add(UC_HOOK_CODE, observe)
    uc.emu_start(0x4aca52, 0x4acc1a)
    assert reached == [destination]
    records.append({'originalResultFlag': flag, 'outcome': outcome,
                    'actualBranch': hex(destination), 'dataScaleIds': ids,
                    'originalNamedRecords': [rows[record_id] for record_id in ids],
                    'musicId': music_id, 'instructions': selected})
out = {'status': 'PASS_ORIGINAL_RESULT_FIELD_OUTCOME_MAPPING',
       'fieldTransfer': code(0x4ac8a0, 0x4ac8ac),
       'field': 'message+d4 is saved at the same game_summary controller+510',
       'providerGetter': code(0x413d4e, 0x413d60),
       'provider': {'nameAddress': '0x5c4c20', 'name': provider_name,
                    'lookup': code(0x439184, 0x4391c4)},
       'selection': branch_code, 'rows': records,
       'musicBranchEvidence': 'recovery/output/result-music-source.json',
       'scope': 'Three actual original outcome-selection branches plus exact original DataScale record names and provider identity. No reward policy, account mutation, full summary receiver or browser audio execution.'}
(ROOT / 'recovery/output/result-music-semantics-source.json').write_text(json.dumps(out, ensure_ascii=False, indent=2) + '\n')
print('PASS_ORIGINAL_RESULT_FIELD_OUTCOME_MAPPING: 1/胜利/WIN/190, 2/失败/LOSE/191, 3/平局/DRAW/no result song')
