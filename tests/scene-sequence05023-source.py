"""Save the original Sequence vtable, loader and texture-clock source."""
import json
from pathlib import Path
import struct
import sys
import capstone
import pefile
sys.path.insert(0, str(Path('recovery').resolve()))
from scene import read_scene

pe = pefile.PE('CDTank/CDTank.exe')
decoder = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)
def bytes_at(address, size):
    return pe.get_data(address - 0x400000, size)
def text(address):
    return bytes_at(address, 256).split(b'\0')[0].decode('ascii')
def instructions(start, end):
    return [{'address': hex(row.address), 'instruction': f'{row.mnemonic} {row.op_str}'}
            for row in decoder.disasm(bytes_at(start, end - start), start)]
vtable = {hex(offset): hex(struct.unpack('<I', bytes_at(0x5c77e0 + offset, 4))[0])
          for offset in [0xc, 0x18, 0x34]}
assert vtable == {'0xc': '0x45f811', '0x18': '0x45f298', '0x34': '0x460bcd'}
assert text(0x5c7874) == 'SYcScnObjSequence'
assert bytes_at(0x45f823, 5) == b'\x68' + struct.pack('<I', 0x5c7874)
assert text(0x5c7904) == '%s/%s/%03d'
assert text(0x5c78fc) == '.dds'
assert text(0x5c78ec) == '%s\\%s\\scr.pol'
unit = struct.unpack('<f', bytes_at(0x5c472c, 4))[0]
asset_dir = Path('recovery/output/verified/assets/data/Data/scnobj/obj05023')
ini = (asset_dir / 'obj05023.ini').read_text()
assert 'delay = 100' in ini
placements = []
for scene in ['0008', '0013']:
    for record in read_scene(Path('recovery/output/verified/assets/data/Data/scn') / scene / (scene + '.obj')):
        if record['className'] == 'SYcScnObjSequence':
            assert record['model'] == 'obj05023'
            placements.append({'map': scene, **record})
result = {
    'status': 'STATIC_SEQUENCE_LOADER_CLOCK_SOURCE_PLAYER_ENTRY_GAP',
    'className': text(0x5c7874),
    'vtable': {'address': '0x5c77e0', 'slots': vtable},
    'sources': [{'start': hex(a), 'end': hex(b), 'instructions': instructions(a, b)}
                for a, b in [(0x45f811, 0x45f843), (0x460bcd, 0x4610c0),
                             (0x45f298, 0x45f355), (0x574dfe, 0x574e5e)]],
    'loader': {'sequencePattern': text(0x5c7904), 'suffix': text(0x5c78fc),
               'screenMeshPattern': text(0x5c78ec), 'textures': [f'{index:03d}.dds' for index in range(1, 5)],
               'delayINI': ini, 'delayMultiplierF32': unit, 'delayField': 'object+10c',
               'initialIndex': 'object+108=0 at461029'},
    'clock': {'guard': 'object+f0 nonnull', 'comparison': 'elapsed must be strictly greater than object+10c',
              'timer': 'object+f8→574e1e reads original performance-counter clock, not passed delta',
              'advance': 'reset clock once, increment one texture index, wrap at vector+dc size',
              'assign': '44ef5e finds screen-model nodes;5c09b8 texture assignment uses vector+e0[index]',
              'catchUp': False},
    'placements': placements,
    'scope': 'Static original direct-byte source only; no full loader/native/render/player claim. Maps8/13 lack formal MAPS qualification. No map registration or imported renderer change. Timer unit/provider, initial material assignment and full POL screen binding need module contract before legal player delivery.',
}
Path('recovery/output/scene-sequence05023-source.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
print(result['status'])
