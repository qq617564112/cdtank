"""Locate trap flag consumers and execute the original flag9 observer branch."""
import json
from pathlib import Path
import struct
import sys
import capstone
from capstone.x86_const import X86_OP_MEM
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_EAX, UC_X86_REG_ECX, UC_X86_REG_ESI, UC_X86_REG_EIP, UC_X86_REG_ESP
ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'recovery'))
from effect_native import map_original_binaries
from inspect_assets import read_table
u, images = map_original_binaries([ROOT / 'CDTank/CDTank.exe'])
u.mem_map(0x2000000, 0x10000)
ROLE, RECORD, VTABLE, GAME, STACK = [0x2001000 + i * 0x1000 for i in range(5)]
HP, ID = 0x2008000, 0x2008100
w = lambda a, v: u.mem_write(a, struct.pack('<I', v & 0xffffffff))
r = lambda a: struct.unpack('<I', u.mem_read(a, 4))[0]
w(ROLE, VTABLE); w(ROLE + 0x2a0, RECORD)
w(VTABLE + 0x14, HP); w(VTABLE + 4, ID); w(0x633588, GAME); w(GAME + 0x128, 0x2007000)
observed = []
health = 100

def finish(value, pop):
    s = u.reg_read(UC_X86_REG_ESP)
    u.reg_write(UC_X86_REG_EAX, value)
    u.reg_write(UC_X86_REG_EIP, r(s))
    u.reg_write(UC_X86_REG_ESP, s + 4 + pop)

def boundary(machine, address, size, data):
    if address == HP:
        assert r(u.reg_read(UC_X86_REG_ESP) + 4) == 15
        finish(health, 4)
    elif address == ID: finish(73, 0)
    elif address == 0x4886aa:
        s = u.reg_read(UC_X86_REG_ESP)
        observed.append(dict(roleId=r(s + 4), skillId=r(s + 8), duration=r(s + 12)))
        finish(0, 12)
for a in [HP, ID, 0x4886aa]: u.hook_add(UC_HOOK_CODE, boundary, begin=a, end=a)
rows = []
for old, new in [(1, 0), (2, 1), (3, 2), (0, 1), (1, 2), (2, 3), (0, 0), (1, 1)]:
    for flag6 in [0, 1]:
        for health in [0, 100]:
            u.mem_write(RECORD + 0x125, bytes([new])); u.mem_write(RECORD + 0x122, bytes([flag6]))
            u.mem_write(ROLE + 0x369, bytes([old])); observed.clear()
            u.reg_write(UC_X86_REG_ESI, ROLE); u.reg_write(UC_X86_REG_ESP, STACK)
            # Execute the complete flag9 case inside the attribute33 observer.
            u.emu_start(0x42f624, 0x42f68d, count=100)
            assert u.reg_read(UC_X86_REG_EIP) == 0x42f68d
            assert u.reg_read(UC_X86_REG_ESP) == STACK
            expected = old != new and not flag6 and health > 0 and (new == 0 or old == new + 1)
            assert bool(observed) == expected
            if observed: assert observed == [dict(roleId=73, skillId=4001, duration=0)]
            rows.append(dict(old=old, new=new, flag6=flag6, hp=health, effectRequests=list(observed)))
pe = images['cdtank.exe']; image = pe.get_memory_mapped_image()
md = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32); md.detail = True; md.skipdata = True
calls, candidates = [], []
for section in pe.sections:
    if not section.Characteristics & 0x20000000: continue
    instructions = list(md.disasm(section.get_data(), pe.OPTIONAL_HEADER.ImageBase + section.VirtualAddress))
    for n, i in enumerate(instructions):
        if not i.id: continue
        if i.mnemonic == 'call' and i.op_str == '0x431dbf':
            calls.append(dict(address=hex(i.address), preceding=[f'{x.address:08x} {x.mnemonic} {x.op_str}'
                for x in instructions[max(0, n - 8):n + 1]]))
        if 0x420000 <= i.address < 0x490000 and any(o.type == X86_OP_MEM and o.mem.disp in
                [0x158, 0x15c, 0x160, 0x164, 0x168, 0x16c] for o in i.operands):
            candidates.append(dict(address=hex(i.address), instruction=f'{i.mnemonic} {i.op_str}'))
def block(start, end):
    return [f'{i.address:08x} {i.mnemonic} {i.op_str}' for i in md.disasm(image[start-0x400000:end-0x400000], start)]
metadata = [row['values'] for row in read_table(ROOT/'CDTank/Data/table/skill.dat')['rows']
            if int(row['values']['SkillTableID']) in [4001, 4002, 4003]]
result = dict(status='PASS_ORIGINAL_FLAG9_OBSERVER_CONTRACT', task='FUNC-03', metadata=metadata,
    observerRows=rows, directFlagSetterCallsites=calls, sameOffsetCandidates=candidates,
    disassembly={hex(a):block(a,b) for a,b in [(0x431dbf,0x431e22),(0x42f624,0x42f769),
        (0x43aee9,0x43af60),(0x432ecf,0x432f50),(0x43d1d0,0x43d2e3)]},
    executionBoundary='Original42f624–42f68d instructions; supplied HP/id virtual getters and recording4886aa effect boundary. Not the full observer or trap creation.',
    findings=['Flag9 nonzero means permitted straight movement; effect4001 branch detects decreasing count, not flag9=true as trap state.',
        '43aefa–43af57 loads FuncType/T/X/Y/Z into skill158/164/170/17c/188 plus slot4 strides; same offset accesses alone do not establish a skill consumer.',
        'Direct setter calls with9/10/11 found in role status lifecycle; full opcode scan is limited to direct calls and constant displacement operands.',
        '43d1d0 receives scene-name/parameter/XYZ and looks up existing scene object through virtual48, then effect/activate calls; it is not proved to allocate a player-owned trap.'],
    missingProducer=dict(field='skill4001 FuncType1=3 / FuncT1=5 -> record+125 count decrease / later restoration',
        nextEntrances=['Network array33/flags writer upstream server sender',
            'Indirect role virtual+28 callers with selector9 beyond direct-call scan',
            'Trap ground-object creation and ownership producer before scene-active3ca4'],
        notConfirmed=['FuncType3 executor','hit target authorization','trap placement/lifetime/consumption','5second count restoration']))
out = ROOT/'recovery/output/trap-function-entry-source.json';out.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(f'PASS: {len(rows)} original flag9 observer cases; {len(calls)} direct flag setter calls indexed; Func3 producer not established')
