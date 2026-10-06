"""Link the original page vtables' activation and root-layout slots."""
import json
from pathlib import Path

import capstone
import pefile

ROOT = Path(__file__).resolve().parents[1]
pe = pefile.PE(str(ROOT / 'CDTank/CDTank.exe'))
base = pe.OPTIONAL_HEADER.ImageBase
decoder = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)

rows = []
for table, activate, initialize, path_push, path_address, root_store, root, music_id in [
    (0x5cfa70, 0x4c51f1, 0x4c1361, 0x4c13b2, 0x5cf998, 0x4c13ee, 'login.xml', 183),
    (0x5d4ae8, 0x5095a1, 0x507503, 0x50754f, 0x5d58b8, 0x50758b, 'roomlist.xml', 183),
    (0x5d6640, 0x50ea9c, 0x50a117, 0x50a163, 0x5d65b8, 0x50a19f, 'room_main.xml', 184),
]:
    assert int.from_bytes(pe.get_data(table + 0x18 - base, 4), 'little') == activate
    assert int.from_bytes(pe.get_data(table + 0x38 - base, 4), 'little') == initialize
    path = pe.get_data(path_address - base, 100).split(b'\0')[0].decode('ascii')
    assert path == 'data\\ui\\layouts\\' + root
    instructions = list(decoder.disasm(pe.get_data(initialize - base, root_store + 3 - initialize), initialize))
    push = next(i for i in instructions if i.address == path_push)
    assert (push.mnemonic, push.op_str) == ('push', hex(path_address))
    store = next(i for i in instructions if i.address == root_store)
    assert store.mnemonic == 'mov' and store.op_str in (
        'dword ptr [edi + 8], eax', 'dword ptr [esi + 8], eax')
    rows.append({'vtable': hex(table), 'activationSlot': hex(table + 0x18),
                 'activation': hex(activate), 'initializerSlot': hex(table + 0x38),
                 'initializer': hex(initialize), 'pathPush': hex(path_push),
                 'pathAddress': hex(path_address), 'rootStore': hex(root_store),
                 'layout': path, 'musicId': music_id,
                 'instructions': [{'va': hex(i.address), 'bytes': i.bytes.hex(),
                                   'instruction': f'{i.mnemonic} {i.op_str}'} for i in instructions]})

out = {'status': 'PASS_STATIC_PAGE_ROOT_MUSIC_MAPPING', 'rows': rows,
       'activationEvidence': 'page-music-source.json',
       'scope': 'The same original vtable binds root initialization and activation. '
                'Initialization loads the exact XML path and stores the returned root at this+8. '
                'Static original instructions, not a native execution or Web playback claim.'}
(ROOT / 'recovery/output/page-music-root-source.json').write_text(json.dumps(out, indent=2) + '\n')
print('PASS_STATIC_PAGE_ROOT_MUSIC_MAPPING: login/roomlist183, room_main184')
