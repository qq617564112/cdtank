"""Verify original Sound268 fields and the published BG08 WAV."""
import json
from pathlib import Path
import sys
import wave
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'recovery'))
from scene import read_scene
from scene_sound import decode_sound_tail
records = read_scene(ROOT / 'recovery/output/verified/assets/data/Data/scn/0020/0020.obj')
sounds = [r for r in records if r['className'] == 'SYcScnObjSound']
assert len(sounds) == 1
record = sounds[0]
assert record['id'] == '268' and record['enabled'] == 1
raw = bytes.fromhex(record['tail'])
assert raw.hex() == 'a2468377000000000004000000424730380000803f0000000000a14683770000000000'
fields = decode_sound_tail(raw)
assert fields == dict(stamp=2005092002, field04='', field20=0, field24='BG08', field5c=1.0,
                     field60='', field88=0, extensionStamp=2005092001, intervalMs=0, randomGate=0)
asset = json.loads((ROOT / 'recovery/output/web-assets/scene-environment-sound-0020.json').read_text())
expected = dict(id='268', name='BG08', position=list(record['position']), enabled=True, gain=1.0,
                intervalMs=0, randomGate=False, selector=-1, spatial=True, direction=[0, 0, -1])
assert asset['mapId'] == 20 and asset['sounds'] == [expected]
assert list(record['position']) == [325.9649963378906, -7.629389983776491e-06, -309.72601318359375]
native = json.loads((ROOT / 'recovery/output/scene-environment-sound20-native.json').read_text())
assert native['status'] == 'PASS' and len(native['rows']) == 1
assert native['rows'][0]['id'] == '268' and native['rows'][0]['fields'] == fields
for key in ['referenceDistance', 'rolloffFactor', 'maxDistance']:
    assert asset['spatial'][key] == native['spatial'][key]
audio = json.loads((ROOT / 'recovery/output/web-assets/audio.json').read_text())
entry = next(s for s in audio['sounds'] if s['name'] == 'BG08')
assert entry['asset'] == 'audio/sound/BG08.wav'
original = ROOT / 'CDTank/Data/sound/BG08.wav'
published = ROOT / 'recovery/output/web-assets' / entry['asset']
assert published.read_bytes() == original.read_bytes()
with wave.open(str(original), 'rb') as wav:
    duration = wav.getnframes() / wav.getframerate()
output = dict(status='PASS', source='Data/scn/0020/0020.obj', placement=expected,
              tailBytes=len(raw), tail=raw.hex(), fields=fields, spatial=asset['spatial'],
              native='scene-environment-sound20-native.json', wav=dict(asset=entry['asset'], identicalBytes=True, duration=duration))
(ROOT / 'recovery/output/scene-environment-sound20-source.json').write_text(json.dumps(output, indent=2) + '\n')
print('PASS: exact original Sound268 tail/position/native contract and unchanged BG08 WAV')
