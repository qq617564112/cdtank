"""Record the named scene classifier and execute Plant type100 receiver gates."""
import json
from pathlib import Path
import struct
import capstone

ROOT = Path(__file__).resolve().parents[1]
fixture = ROOT / 'tests/role-static-contact-receiver-native.py'
namespace = {'__file__': str(fixture)}
prefix = fixture.read_text().split('rows = []')[0]
exec(compile(prefix, str(fixture), 'exec'), namespace)
uc, put, call = (namespace[key] for key in ['uc', 'put', 'call'])
OBJ, INTACT = (namespace[key] for key in ['OBJ', 'INTACT'])
events = namespace['events']
put(OBJ, 0x5c7760)
put(0x5c7760 + 0x4c, namespace['STUB'])
put(OBJ + 0xfc, 0)
uc.mem_write(OBJ + 0x24, b'obj05413\0')
namespace['namespace']['strings'][OBJ + 0x20] = 'obj05413'
rows = []
for condition in ['fresh', 'repeat', 'hiddenFresh']:
    if condition != 'repeat':
        uc.mem_write(OBJ + 0x74, bytes([int(condition == 'hiddenFresh')]))
        put(OBJ + 0xe4, INTACT)
    events.clear()
    call(0x44e081, 100)
    assert uc.mem_read(OBJ + 0x74, 1)[0] == 1
    assert events == ([dict(kind='hideBoundary', hidden=True, argument=0)]
                      if condition == 'fresh' else [])
    rows.append(dict(className='SYcScnObjPlant', condition=condition,
                     notification=100, hidden=True, events=list(events)))

pe = namespace['namespace']['pe']
decoder = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)
ranges = [(0x45b858, 0x45b92e), (0x45b170, 0x45b1d6),
          (0x45911a, 0x45917d), (0x45a98d, 0x45a9cd),
          (0x42745e, 0x4274c6), (0x44dbc4, 0x44dbcb),
          (0x45efb3, 0x45efff), (0x461dd9, 0x461de5)]
sources = [dict(start=hex(start), end=hex(end), instructions=[
    dict(address=hex(i.address), bytes=i.bytes.hex(), instruction=f'{i.mnemonic} {i.op_str}')
    for i in decoder.disasm(pe.get_data(start - 0x400000, end - start), start)])
    for start, end in ranges]
classes = [('SYcScnObjBreach', 0x5c7050, 0x1d8, 0x5c7450),
           ('SYcScnObjPlant', 0x5c7040, 0x1e8, 0x5c7760),
           ('SYcScnObjCrush', 0x5c7224, 0x1e8, 0x5c76e0)]
classification = []
for name, address, offset, vtable in classes:
    assert pe.get_data(address - 0x400000, 32).split(b'\0')[0].decode() == name
    classification.append(dict(className=name, classNameAddress=hex(address),
                               containerOffset=hex(offset), vtable=hex(vtable),
                               receiver=hex(struct.unpack('<I', pe.get_data(
                                   vtable + 0x14 - 0x400000, 4))[0])))
result = dict(status='PASS_SOURCE_CLASSIFIER_AND_PLANT_RECEIVER_ONLY',
              classification=classification, plantRows=rows, sources=sources,
              predicate='45911a obtains object virtual+c class name and compares with4037cf;45b170 appends only matching original 8-byte object reference pairs.',
              caller='4272d7 reads scene+1e8, intersects object+80 OBB with predicted role OBB, calls44e081(100), then allows movement.',
              substitutes=['supplied Plant identity/model and null optional effect pointer',
                           'scene teardown slot4c endpoint'],
              limitations=['Classifier observed as original instructions, not complete scene loader execution.',
                           'No authority/gameplay/network/Plant-render claim; no original container-to-published string-id binding.',
                           'Plant hides through original461dd9; no Plant optional effect resource qualification.'])
(ROOT / 'recovery/output/role-static-contact-provider-source.json').write_text(
    json.dumps(result, indent=2) + '\n')
print('PASS: source+1e8 is Plant/Crush, Breach+1d8; Plant type100 hides once, repeat/hidden guarded')
