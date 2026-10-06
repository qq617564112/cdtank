"""Index Func8 records and the separate role+308 byte without assigning a disguise policy."""
import json
from pathlib import Path
import sys

import capstone
from capstone.x86_const import X86_OP_MEM
import pefile

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'recovery'))
from inspect_assets import read_table

skills = read_table(ROOT / 'CDTank/Data/table/skill.dat')
items = read_table(ROOT / 'CDTank/Data/table/item.dat')
records = [r for r in skills['rows'] if any(int(r['values'][f'FuncType{i}']) == 8
                                         for i in range(1, 4))]
ids = {int(r['values']['SkillTableID']) for r in records}
linked = [r for r in items['rows'] if any(int(r['values'][f'ItemSkill{i}']) in ids
                                        for i in range(1, 4))]
pe = pefile.PE(str(ROOT / 'CDTank/CDTank.exe'))
base = pe.OPTIONAL_HEADER.ImageBase
image = pe.get_memory_mapped_image()
md = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)
md.detail = True
md.skipdata = True
references = []
for section in pe.sections:
    if not section.Characteristics & 0x20000000:
        continue
    start = section.VirtualAddress
    for ins in md.disasm(image[start:start + section.Misc_VirtualSize], base + start):
        if ins.id and any(op.type == X86_OP_MEM and op.mem.disp == 0x308 for op in ins.operands):
            references.append(dict(address=hex(ins.address), instruction=f'{ins.mnemonic} {ins.op_str}'))

def block(start, end):
    return [f'{i.address:08x} {i.mnemonic} {i.op_str}'
            for i in md.disasm(image[start-base:end-base], start)]

result = dict(
    status='SOURCE_ONLY_FUNC08_ACTOR_PRODUCER_NOT_CONFIRMED', task='FUNC-08',
    skills=records, items=linked,
    sourceColumns={k:skills['columns'].index(k) for k in
                   ['FuncType1', 'FuncT1', 'FuncX1', 'FuncY1', 'FuncZ1']},
    displacement308Candidates=references,
    candidateScope='Static executable-section displacement index; operands alone do not establish role identity or a disguise consumer.',
    disassembly={hex(a):block(a,b) for a,b in
                 [(0x431d92,0x431e22),(0x427d95,0x427e31),(0x43aee9,0x43af60)]},
    confirmedChain=[
        'item10 -> skill10 FuncType8/T10/X1; item11 -> skill11 FuncType8/T10/X2',
        '43aee9..43af57 loads FuncType/T/X/Y/Z into skill+158/+164/+170/+17c/+188, with four-byte slot stride',
        '431d92 index12 reads role+308 independently of record+11c action flags',
        '427d95..427e31 labels flag12 OnFire in diagnostics',
        '4288fe clears flag12 before local fire eligibility; 432528 selector11 clears it after current bullet field notification'],
    reuse=['recovery/output/optical-camouflage-source.json',
           'recovery/docs/combat-field-inventory.md',
           'recovery/output/role-actor-global-clock-sol-native.json'],
    missing=[
        dict(field='Func8 X1/X2 -> disguise identity and actor/model state',
             readAddress='43aee9 table loader only; no established Func8 execution reader',
             writeAddress='No established disguise actor/model writer; role+308 writer431dbf does not establish Func8 identity',
             nextEntrance='Func8 target executor or its network receive observer leading to role+310 actor; distinguish X1 and X2'),
        dict(field='Func8 T10 -> disguise expiry and restore',
             readAddress='43aee9 table loader only; no established Func8 timer reader',
             writeAddress='No established disguise timer/restore writer',
             nextEntrance='The same identified Func8 actor producer and its expiry callback'),
        dict(field='Firing/bullet selection -> disguise restore',
             readAddress='431d92 index12 reads role+308; diagnostic names it OnFire',
             writeAddress='4288fe ->431dbf(12,0);432528 selector11 -> role+308 clear',
             nextEntrance='A proved disguise-state consumer upstream of actor model replacement; clearing this byte alone is insufficient')],
    limits='One static source pass. No native execution, producer policy, purchase, runtime or player acceptance.')
(ROOT / 'recovery/output/pumpkin-function-entry-source.json').write_text(
    json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(result['status'])
for r in records:
    v=r['values']
    print(v['SkillTableID'],v['SkillName'],v['FuncT1'],v['FuncX1'])
print(f'{len(references)} displacement candidates; no disguise identity assigned')
