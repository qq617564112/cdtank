"""Execute original full attachment sampler, quaternion interpolation and matrix."""
from hashlib import sha256
import json
from pathlib import Path
import struct
import sys
from unicorn.x86_const import UC_X86_REG_ECX, UC_X86_REG_ESP, UC_X86_REG_FPCW

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'recovery'))
from effect_native import map_original_binaries
def source_tracks():
    tanks = json.loads((ROOT / 'recovery/output/web-assets/tanks.json').read_text())
    for tank in tanks:
        for component in tank['components']:
            for action in component['actions']:
                tracks = list(action['primaryTags'])
                if action['fields']['name'] == '01' and component['part'] in ['M', 'U'] and action['turretPivotFrames']:
                    tracks.append({'name': 'tag_c', 'frames': action['turretPivotFrames']})
                for track in tracks:
                    yield dict(tankId=tank['id'], part=component['part'], action=action['fields']['name'],
                               asset=action['asset'], **track)

paths = [ROOT / 'CDTank/gbengine.dll', ROOT / 'CDTank/msvcr71.dll']
machine, _ = map_original_binaries(paths)
machine.mem_map(0x2000000, 0x40000)
TRACK, FRAMES, OUTPUT, STACK, STOP = (
    0x2010000, 0x2011000, 0x2020000, 0x2008000, 0x203f000)
rows = []
for source in source_tracks():
    frames = source['frames']
    assert len(frames) > 1 and frames[-1]['time'] > 0
    machine.mem_write(TRACK, bytes(0x48))
    machine.mem_write(TRACK + 0x40, struct.pack('<II', len(frames), FRAMES))
    for index, frame in enumerate(frames):
        machine.mem_write(FRAMES + index * 68, struct.pack('<I16f', frame['time'], *frame['matrix']))
    end = frames[-1]['time']
    times = {1, end // 2, end - 1, end + 1}
    times = sorted(times)
    steps = []
    for precision in [0x27f, 0x37f]:
        for time in times:
            machine.mem_write(OUTPUT, bytes(64))
            machine.mem_write(STACK, struct.pack('<III', STOP, OUTPUT, time))
            machine.reg_write(UC_X86_REG_ESP, STACK)
            machine.reg_write(UC_X86_REG_ECX, TRACK)
            machine.reg_write(UC_X86_REG_FPCW, precision)
            machine.emu_start(0x1000b800, STOP, count=20000)
            assert machine.reg_read(UC_X86_REG_ESP) == STACK + 12
            matrix = list(struct.unpack('<16f', machine.mem_read(OUTPUT, 64)))
            steps.append({'time': time, 'precision': precision, 'matrix': matrix})
    rows.append({'track': source, 'steps': steps})
(ROOT / 'recovery/output/tank-tags-native.json').write_text(json.dumps({
    'sources': {p.name: sha256(p.read_bytes()).hexdigest() for p in paths}, 'rows': rows}) + '\n')
print(f'PASS: {len(rows)} real attachment tracks / {sum(len(r["steps"]) for r in rows)} original matrix samples')
