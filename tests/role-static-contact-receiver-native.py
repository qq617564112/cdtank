"""Execute original static-contact type100 through Breach and Crush receivers."""
import json
from pathlib import Path
import struct
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_ECX, UC_X86_REG_ESP

ROOT = Path(__file__).resolve().parents[1]
# Reuse mapped image/device bindings without executing the existing loader suite.
fixture = ROOT / 'tests/scene-breach21-05466-native.py'
namespace = {'__file__': str(fixture)}
prefix = fixture.read_text().split("mode='loader';call(0x4610f1,0)")[0]
exec(compile(prefix, str(fixture), 'exec'), namespace)
uc = namespace['uc']
put, get, call = (namespace[key] for key in ['put', 'get', 'call'])
OBJ, INTACT, BROKEN = (namespace[key] for key in ['OBJ', 'INTACT', 'BROKEN'])
events = namespace['events']
namespace['mode'] = 'sound'
STUB, EFFECT, TABLE = 0x2038000, 0x2039000, 0x203a000


def hook(machine, address, size, data):
    stack = machine.reg_read(UC_X86_REG_ESP)
    if address == STUB:
        events.append(dict(kind='hideBoundary', hidden=bool(uc.mem_read(OBJ + 0x74, 1)[0]),
                           argument=get(stack + 4)))
        namespace['finish'](pop=4)
    elif address == STUB + 16:
        events.append(dict(kind='effectSlot34', receiver=machine.reg_read(UC_X86_REG_ECX),
                           argumentPair=[get(stack + 4), get(stack + 8)]))
        namespace['finish'](pop=8)


uc.hook_add(UC_HOOK_CODE, hook, begin=STUB, end=STUB + 16)
put(0x5c76e0 + 0x4c, STUB)
put(EFFECT, TABLE)
put(TABLE + 0x34, STUB + 16)
put(OBJ + 0x78, 0x12345678, 0)
rows = []
for class_name, vtable, model in [('Breach', 0x5c7450, 'obj05466'),
                                  ('Crush', 0x5c76e0, 'obj05420')]:
    put(OBJ, vtable)
    uc.mem_write(OBJ + 0x24, model.encode() + b'\0')
    namespace['strings'][OBJ + 0x20] = model
    put(OBJ + 0xfc, EFFECT)
    put(OBJ + 0xe0, BROKEN)
    for condition in ['fresh', 'repeat', 'hiddenFresh']:
        if condition != 'repeat':
            uc.mem_write(OBJ + 0x74, bytes([int(condition == 'hiddenFresh')]))
            uc.mem_write(OBJ + 0xe8, b'\0')
            put(OBJ + 0xe4, INTACT)
        events.clear()
        call(0x44e081, 100)
        accepted = condition == 'fresh'
        if class_name == 'Breach':
            assert get(OBJ + 0xe4) == (INTACT if condition == 'hiddenFresh' else BROKEN)
            assert bool(uc.mem_read(OBJ + 0xe8, 1)[0]) == (condition != 'hiddenFresh')
            assert [e['reference'] for e in events if e['kind'] == 'sound'] == (['GA13'] if accepted else [])
            assert sum(e['kind'] == 'navigationUpdate' for e in events) == int(accepted)
        else:
            assert uc.mem_read(OBJ + 0x74, 1)[0] == 1
            assert sum(e['kind'] == 'hideBoundary' for e in events) == int(accepted)
            effects = [e for e in events if e['kind'] == 'effectSlot34']
            assert effects == ([dict(kind='effectSlot34', receiver=EFFECT,
                                    argumentPair=[0x12345678, 0])] if accepted else [])
        if not accepted:
            assert events == []
        rows.append(dict(className=class_name, vtable=hex(vtable), condition=condition,
                         notification=100, hidden=bool(uc.mem_read(OBJ + 0x74, 1)[0]),
                         broken=bool(uc.mem_read(OBJ + 0xe8, 1)[0]), events=list(events)))

result = dict(status='PASS_SOURCE_RECEIVER_ONLY', rows=rows,
              callerReuse='recovery/output/role-movement-controller-native.json',
              receiverReuse=['recovery/output/scene-breach21-05466-native.json',
                             'recovery/output/scene-crush07-state-native.json'],
              substitutes=['supplied object/vtable/model identity and model handles',
                           'graphics blend boundary', 'Breach navigation update boundary',
                           'Crush scene teardown and effect slot34 endpoint'],
              scope='Six new type100 receiver conditions; original44e081 and subclass bodies execute. No loader/controller rerun, static membership provider, authority, network or rendering claim.')
(ROOT / 'recovery/output/role-static-contact-receiver-native.json').write_text(
    json.dumps(result, indent=2) + '\n')
print('PASS: type100 Breach destroy/navigation/GA13 and Crush hide/effect; repeat and hidden guards')
