"""Check published audio bytes against original archive and loose source files."""
import json
from hashlib import sha256
from pathlib import Path
import pefile
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'recovery'))
from export_audio_events import export

root = Path(__file__).resolve().parents[1]
out = root / 'recovery/output/web-assets'
catalog = json.loads((out / 'audio.json').read_text())
assert len(catalog['music']) == 14
assert len(catalog['sounds']) == 174
for item in catalog['music'] + catalog['sounds']:
    assert sha256(Path(item['source']).read_bytes()).hexdigest() == item['sha256']
    assert sha256((out / item['asset']).read_bytes()).hexdigest() == item['sha256']
pe = pefile.PE(str(root / 'CDTank/CDTank.exe'))
assert pe.get_data(0x4D0592 - 0x400000, 5) == bytes.fromhex('05bf000000')
assert pe.get_data(0x4D0597 - 0x400000, 2) == bytes.fromhex('6aff')
assert pe.get_data(0x5C9F20 - 0x400000, 11) == b'data\\music\0'
strings = {int(row['values']['ID']): row['values']['String'] for row in
           json.loads((root / 'recovery/output/verified/tables/musicstring.json').read_text())['rows']}
expected = []
for mode in range(1, 6):
    table = json.loads((root / f'recovery/output/verified/tables/m00{mode}.json').read_text())
    for row in table['rows']:
        values = row['values']
        expected.append((mode, int(values['MapID']), int(values['MusicFile']) + 191))
assert [(row['mode'], row['mapId'], row['musicId']) for row in catalog['maps']] == expected
for row in catalog['maps']:
    assert row['name'] == strings[row['musicId']]
    assert Path(row['asset']).stem == row['name']
assert catalog['defaultMusicVolume'] == 0.5
assert catalog['defaultSoundVolume'] == 0.5
sounds = {item['name']: item for item in catalog['sounds']}
expected_ids = [{'id': key, 'name': name, 'asset': sounds[name]['asset']}
                for key, name in strings.items() if name in sounds]
assert catalog['soundIds'] == expected_ids
evidence = json.loads((root / 'recovery/output/audio-events.json').read_text())
assert evidence == export()
assert catalog['battleKill']['spatial'] == evidence['spatial']
assert catalog['battleKill']['selections'] == evidence['killSound']['selections']
assert catalog['battleFire'] == evidence['fireSound']['selections']
assert len(catalog['battleFire']) == 21
assert catalog['battleFire'][0]['skillId'] == 2001
assert catalog['battleFire'][0]['name'] == 'GA07'
for selected in catalog['battleFire']:
    assert next(r for r in catalog['soundIds'] if r['id'] == selected['soundId'])['asset'] == selected['asset']
for selected in evidence['killSound']['selections']:
    assert sounds[selected['name']]['sha256'] == selected['sha256']
    assert next(r for r in catalog['soundIds'] if r['id'] == selected['soundId'])['asset'] == selected['asset']
print('PASS: 14 MP3/174 WAV unchanged source bytes, 26 source map mappings and EXE selector constants')
print(f'PASS: {len(expected_ids)} original sound IDs and reproducible attacker/OpenAL PE evidence')
