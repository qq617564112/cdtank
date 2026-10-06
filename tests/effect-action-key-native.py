"""Execute supplied gbengine string identifiers for original link lookup keys."""
from hashlib import sha256
import json
from pathlib import Path
import struct
import sys
from unicorn.x86_const import UC_X86_REG_ESP, UC_X86_REG_EAX
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'recovery'))
from effect_native import map_original_binaries
from effect_action_keys import action_identifier
paths = [ROOT / 'CDTank/gbengine.dll', ROOT / 'CDTank/msvcr71.dll']
machine, _ = map_original_binaries(paths)
machine.mem_map(0x2000000, 0x20000)
INPUT, STACK, STOP = 0x2010000, 0x2008000, 0x201f000
links = json.loads((ROOT / 'recovery/output/web-assets/effect-links.json').read_text())
names = {'', '03', '09', 'goto_action', 'attack1', 'attack3', 'effect1'}
for source in links['files']:
    for group in source['groups']:
        for action in group['actions']:
            names.add(action['name'])
            for record in action['records']:
                names.update([record['field04String'], record['field148String']])
rows = []
for name in sorted(names):
    machine.mem_write(INPUT, name.encode('ascii') + b'\0')
    machine.mem_write(STACK, struct.pack('<II', STOP, INPUT))
    machine.reg_write(UC_X86_REG_ESP, STACK)
    machine.emu_start(0x10032700, STOP, count=20000)
    value = machine.reg_read(UC_X86_REG_EAX)
    assert value == action_identifier(name)
    rows.append({'name': name, 'id': value, 'idHex': f'0x{value:08x}'})
assert action_identifier('03') == 0x30330000
assert action_identifier('09') == 0x30390000
(ROOT / 'recovery/output/effect-action-key-native.json').write_text(json.dumps({
    'sources': {path.name: sha256(path.read_bytes()).hexdigest() for path in paths}, 'rows': rows}) + '\n')
print(f'PASS: {len(rows)} original link/string identifiers; source keys identify actions 03/09')
