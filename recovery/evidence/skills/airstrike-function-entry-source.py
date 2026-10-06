"""Record item13's original function chain and its unresolved authority entrance."""
import json
from pathlib import Path
import sys

import capstone
import pefile

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'recovery'))
from inspect_assets import read_table

item_table = read_table(ROOT / 'CDTank/Data/table/item.dat')
skill_table = read_table(ROOT / 'CDTank/Data/table/skill.dat')
item = next(r for r in item_table['rows'] if int(r['values']['ItemTableID']) == 13)
skills = [next(r for r in skill_table['rows'] if int(r['values']['SkillTableID']) == n)
          for n in [13, 3013, 3012]]
pe = pefile.PE(str(ROOT / 'CDTank/CDTank.exe'))
base = pe.OPTIONAL_HEADER.ImageBase
binary = pe.get_memory_mapped_image()
md = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)

def block(start, end):
    return [f'{i.address:08x} {i.mnemonic} {i.op_str}'
            for i in md.disasm(binary[start-base:end-base], start)]

old = json.loads((ROOT / 'recovery/output/trap-function-entry-source.json').read_text())
receiver = json.loads((ROOT / 'recovery/output/skill-bomb-entry-native.json').read_text())
fields = ['TriggerType', 'Target', 'Range', 'HP', 'FuncType1', 'FuncT1', 'FuncX1',
          'FuncY1', 'FuncZ1', 'Effect1', 'EffectTag1', 'EffectMethod1', 'Sound1']
result = dict(
    status='SOURCE_ONLY_AUTHORITY_ENTRANCE_NOT_CONFIRMED', tasks=['FUNC-16', 'FUNC-15'],
    item=dict(recordId=item['recordId'], values=item['values']),
    skills=[dict(recordId=r['recordId'], values={k:r['values'][k] for k in fields},
                 skillId=int(r['values']['SkillTableID'])) for r in skills],
    columns={k:skill_table['columns'].index(k) for k in fields},
    disassembly={hex(a):block(a,b) for a,b in
                 [(0x432b29,0x432b80),(0x43aee9,0x43af60),(0x486a09,0x486b48)]},
    sameOffsetIndexReuse='recovery/output/trap-function-entry-source.json',
    sameOffsetCandidates=old['sameOffsetCandidates'],
    receiverReuse=dict(path='recovery/output/skill-bomb-entry-native.json',
                       status=receiver['status'], callback=receiver['callback']),
    confirmedChain=[
        'item13 ItemSkill1 -> skill13 FuncType16 -> FuncY1 skill3013 -> FuncType15 -> FuncY1 skill3012',
        '43aee9..43af57 reads function slots into skill+158/+164/+170/+17c/+188 with four-byte slot stride',
        '432b29 checks type1 and T for passive selection; it is not a Func16/15 executor',
        'UMsgSkBomb type416f -> registered486a09 -> message+c skillId/+10 effectSlot/+14 XZ vector -> selected skill+70 effect -> truncation/world sample ->45afc2 effect submission'],
    missing=[
        dict(field='skill13 FuncX1/Range -> point count and placement', readAddress=None,
             writeAddress=None, nextEntrance='Original type416f sender constructing message+14 point vector; no sender identified by the existing receiver contract'),
        dict(field='skill3013 FuncY1 -> skill3012 application/HP', readAddress=None,
             writeAddress=None, nextEntrance='Original authoritative Func15 dispatcher consuming the actual skill record; same displacement candidates have no established skill13/3013 identity'),
        dict(field='Func16/15 scheduling and time base', readAddress=None,
             writeAddress=None, nextEntrance='Original authority invocation before UMsgSkBomb emission; receiver has no delay, target HP or inventory writes')],
    units=dict(pointVector='two float32 values, eight bytes per XZ point',
               receiverCoordinates='signed32 truncation then world sample, submitted Y=0',
               functionTime='not confirmed', placementScale='producer not confirmed'),
    limits='One targeted static source pass and reuse of existing execution evidence. No emulation, broad opcode scan, original client behavior measurement, policy or normal-player acceptance.')
(ROOT / 'recovery/output/airstrike-function-entry-source.json').write_text(
    json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(result['status'])
for r in result['skills']:
    print(r['skillId'], r['values'])
