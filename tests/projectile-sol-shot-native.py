"""Execute original shot notification, role gate, actor action and completion source."""
import json
from pathlib import Path
import struct
import sys
from capstone import Cs, CS_ARCH_X86, CS_MODE_32
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_EAX, UC_X86_REG_ECX, UC_X86_REG_EIP, UC_X86_REG_ESP
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'recovery'))
from effect_native import map_original_binaries
machine, images = map_original_binaries([ROOT / 'CDTank/CDTank.exe'])
machine.mem_map(0x2000000, 0x20000)
OWNER, ROLE, RECORD, ACTOR, MESSAGE, GLOBAL, STACK, STOP, OBSERVER, VTABLE, CALLBACK = [0x2001000 + i * 0x1000 for i in range(11)]
def put(a, *values):
    machine.mem_write(a, struct.pack('<' + 'I' * len(values), *[v & 0xffffffff for v in values]))
def get(a):
    return struct.unpack('<I', machine.mem_read(a, 4))[0]
def finish(value=0, pop=0):
    stack = machine.reg_read(UC_X86_REG_ESP)
    machine.reg_write(UC_X86_REG_EAX, value)
    machine.reg_write(UC_X86_REG_EIP, get(stack))
    machine.reg_write(UC_X86_REG_ESP, stack + 4 + pop)
present = True
events = []
def hook(uc, address, size, data):
    stack = uc.reg_read(UC_X86_REG_ESP)
    if address == 0x48a226:
        events.append(dict(kind='lookup', roleId=get(stack + 4)))
        finish(ROLE if present else 0, 4)
    elif address == 0x4269c4:
        finish(0)
    elif address in [0x46888f, 0x46c2ab]:
        events.append(dict(kind='action', index=get(stack + 4), flags=get(stack + 8)))
        finish(0, 8)
    elif address == CALLBACK:
        events.append(dict(kind='completed', roleId=get(stack + 4), savedRoleId=get(ACTOR + 0x298)))
        finish(0, 4)
for address in [0x48a226, 0x4269c4, 0x46888f, 0x46c2ab, CALLBACK]:
    machine.hook_add(UC_HOOK_CODE, hook, begin=address, end=address)
put(0x633588, GLOBAL)
put(ROLE, 0x5c2c28)
put(ROLE + 0x2a0, RECORD)
put(RECORD + 0xc, 73)
put(MESSAGE + 0xc, 73)
rows = []
for actor_vtable, state_offset, parts in [(0x5c8688, 0x2b4, 3), (0x5c88c8, 0x2b8, 4)]:
    assert get(actor_vtable + 0x84) == 0x464e53
    for present in [False, True]:
        for local in [False, True]:
            for role_state in [0, 1, 2, 3]:
                for actor_present in [False, True]:
                    for action_state in [0, 2, 9]:
                        for blocked in [False, True]:
                            machine.mem_write(ACTOR, bytes(0x400))
                            put(ACTOR, actor_vtable)
                            put(ACTOR + 0x258, ROLE)
                            put(ACTOR + state_offset, *([action_state] * parts))
                            machine.mem_write(ACTOR + 0x19c, bytes([int(blocked)]))
                            put(ACTOR + 0x298, 0x12345678)
                            put(OWNER + 0x3c, ROLE if local else 0)
                            put(ROLE + 0x310, ACTOR if actor_present else 0)
                            put(RECORD + 0x90, role_state)
                            before_record = bytes(machine.mem_read(RECORD, 0x140))
                            before_actor = bytes(machine.mem_read(ACTOR, 0x400))
                            events.clear()
                            put(STACK, STOP, MESSAGE, 0x11111111, 0x22222222)
                            machine.reg_write(UC_X86_REG_ECX, OWNER)
                            machine.reg_write(UC_X86_REG_ESP, STACK)
                            machine.emu_start(0x422f25, STOP, count=10000)
                            assert machine.reg_read(UC_X86_REG_EIP) == STOP
                            assert machine.reg_read(UC_X86_REG_ESP) == STACK + 16
                            accepted = present and not local and role_state != 3 and actor_present and action_state != 2 and not blocked
                            expected = [dict(kind='lookup', roleId=73)]
                            if accepted:
                                expected.append(dict(kind='action', index=2, flags=4))
                            assert events == expected
                            assert bytes(machine.mem_read(RECORD, 0x140)) == before_record
                            expected_actor = bytearray(before_actor)
                            if accepted:
                                struct.pack_into('<I', expected_actor, 0x298, 73)
                            assert bytes(machine.mem_read(ACTOR, 0x400)) == expected_actor
                            rows.append(dict(vtable=hex(actor_vtable), present=present, local=local, roleState=role_state,
                                             actorPresent=actor_present, actionState=action_state, blocked=blocked,
                                             events=list(events), savedRoleId=get(ACTOR + 0x298)))
completion = []
put(OBSERVER, VTABLE)
put(VTABLE + 8, CALLBACK)
for observer_present in [False, True]:
    for role_id in [0, 73, 0xffffffff]:
        put(ACTOR + 0x2a0, OBSERVER if observer_present else 0)
        put(ACTOR + 0x298, role_id)
        events.clear()
        put(STACK, STOP)
        machine.reg_write(UC_X86_REG_ECX, ACTOR)
        machine.reg_write(UC_X86_REG_ESP, STACK)
        machine.emu_start(0x4647df, STOP, count=1000)
        assert machine.reg_read(UC_X86_REG_EIP) == STOP
        assert get(ACTOR + 0x298) == (0 if observer_present else role_id)
        assert events == ([dict(kind='completed', roleId=role_id, savedRoleId=role_id)] if observer_present else [])
        completion.append(dict(observerPresent=observer_present, roleId=role_id, savedRoleId=get(ACTOR + 0x298), events=list(events)))
tables = {}
for name, ids in [('item', [2001]), ('skill', [2001, 4020])]:
    source = json.loads((ROOT / f'recovery/output/verified/tables/{name}.json').read_text())
    tables[name] = dict(columns=source['columns'], rows=[r for r in source['rows'] if r['recordId'] in ids])
cs = Cs(CS_ARCH_X86, CS_MODE_32)
source_ranges = [(0x422f25, 0x422f48), (0x42282e, 0x422877), (0x464e53, 0x464e72),
                 (0x4647df, 0x4647fe), (0x468a53, 0x468aa2), (0x46c42e, 0x46c438)]
source = {hex(start): [dict(address=hex(i.address), instruction=f'{i.mnemonic} {i.op_str}'.rstrip())
                      for i in cs.disasm(bytes(machine.mem_read(start, end - start)), start)]
          for start, end in source_ranges}
output = dict(status='PASS', rows=rows, completion=completion, tables=tables, source=source,
              scope='Full422f25 ->42282e -> actual actor getter/464e53 -> derived468a53/46c42e. Role lookup, actor action application46888f/46c2ab and current-local-role lookup are supplied boundaries. Full4647df observer forwarding/clear. This is shooting animation dispatch, not an identified projectile creation/update or ballistic parameter contract.')
(ROOT / 'recovery/output/projectile-sol-shot-native.json').write_text(json.dumps(output, ensure_ascii=False, indent=2) + '\n')
print(f'PASS: {len(rows)} full shot notifications, {len(completion)} completion forwards; no ballistic parameter inferred')
