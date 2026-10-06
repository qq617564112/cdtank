"""Execute original room card button state image consumers."""
import json
from pathlib import Path
import runpy
ROOT = Path(__file__).resolve().parents[3]
ns = runpy.run_path(str(ROOT / 'recovery/evidence/ui/source-button-native.py'))
controls = next(l['windows'] for l in ns['ui']['layouts'] if l['path'].endswith('roomlist_icon.xml'))
control = next(c for c in controls if c['name'] == 'btnRoom')
assert control['type'] == 'WindowsLook/Button'
assert control['properties']['StateColorBlend'] == 'False'
assert control['properties']['UseStandardImagery'] == 'False'
assert 'DisabledImage' not in control['properties'] and 'CheckMarkImage' not in control['properties']
Native = ns['Native']
Native.setup.__globals__['controls'] = controls
rows = []
for state, entry in [('Normal', 0x10004d70), ('Hover', 0x10005070), ('Pushed', 0x10005370), ('Disabled', 0x10005670)]:
    for alpha in [1, .5]:
        n = Native(98)
        n.setup('btnRoom', alpha)
        n.invoke(entry, [0])
        expected = [] if state == 'Disabled' else [state + 'Image']
        assert [i['property'] for i in n.images] == expected
        assert all(image['alpha'] == [alpha] * 4 for image in n.images)
        rows.append({'state': state, 'effectiveAlpha': alpha, 'images': n.images})
result = {'status': 'PASS', 'control': control, 'vectors': rows, 'pointerVectors': ns['pointerRows'],
          'providers': 'Original shared harness window rectangle/effective alpha and image draw endpoints; state/custom image consumers execute original code.',
          'selectedProducer': {'status': 'UNPROVEN', 'lookup': '0x507b6e..0x507b9c RoomIcon0/btnRoom -> controller+0x60', 'directoryImageProducer': '0x5071d6..0x5071e3 -> 0x4d92fd three image keys', 'scope': 'No RadioButton or permanent selected-image rule inferred.'}}
(ROOT / 'recovery/output/room-card-button-native.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
print('PASS: eight original card custom-image vectors and five captured-state vectors')
