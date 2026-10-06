"""Verify ordinary4003 short GA20 waveform captured on its audio thread."""
import json
from pathlib import Path
import sys

raw = Path(sys.argv[1])
data = json.loads(raw.read_text())
assert data['status'] == 'PASS_TRAP118_AUDIO_WORKLET_SCOPE'
assert data['triggered']['skillId'] == 4003
assert data['triggered']['targetId'] == 'P2'
pages = []
for page in data['observed']:
    assert page['audioWorkletReady']
    assert len(page['sounds']) == len(page['effects']) == 1
    sound = page['sounds'][0]
    assert sound['event'] == data['triggered']
    assert sound['reference'] == 'GA20' and sound['selector'] == 1
    assert sound['played'] and sound['ended'] and not sound['loop']
    assert sound['postGainPeak'] > 0 and sound['blocks'] > 0 and sound['samples'] > 0
    assert sound['contextAtPlay'] == sound['contextAtPlaying'] == sound['contextAtEnd'] == 'running'
    assert sound['gainAtPlaying'] > 0 and sound['masterAtPlay'] > 0
    assert sound['reports'] and any(row['peak'] > 0 for row in sound['reports'])
    assert all(a['time'] <= b['time'] for a, b in zip(sound['reports'], sound['reports'][1:]))
    assert page['effects'][0]['expired']
    assert any(event['type'] == 'trapRestraintEnded' and event.get('skillId') == 4003 for event in page['events'])
    pages.append({'sound': sound, 'effect': page['effects'][0]})
assert data['inventoryAfterLeave']['itemTableId'] == 3005
assert data['inventoryAfterLeave']['ownedQuantity'] == 0
for row in data['cleanup']:
    assert row['world'] is None
    assert row['instances'] == row['meshes'] == row['voices'] == row['treeVoices'] == 0
result = {'status': 'PASS_DUAL_ORDINARY4003_GA20_AUDIO_THREAD_WAVE_END_LEAVE',
          'raw': str(raw), 'firstRaw': 'recovery/output/browser-trap4003-presentation-2026-10-05T03-43-17-501Z.json',
          'pages': pages, 'cleanup': data['cleanup'], 'inventory': data['inventoryAfterLeave'],
          'scope': 'Read-only audio-thread original voice postgain samples, with context/master observed. Normal placement/contact via genuine purchased3005 checkpoint; first118 visible canvases reused. No alteration of gain, time, pose or business. No new pixels or speaker-output capture claimed.'}
Path('recovery/output/trap4003-audio-actual.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
print(result['status'])
