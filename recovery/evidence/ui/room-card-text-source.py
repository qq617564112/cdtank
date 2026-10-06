"""Bind room card text layouts to previously executed StaticText consumers."""
import json
from pathlib import Path
ROOT = Path(__file__).resolve().parents[3]
ui = json.loads((ROOT / 'recovery/output/web-assets/ui.json').read_text())
native = json.loads((ROOT / 'recovery/output/waiting-room-static-text-native.json').read_text())
assert native['status'] == 'PASS'
assert native['defaults'] == {'horizontal': 0, 'vertical': 2, 'cornersARGB': [[1, 1, 1, 1]] * 4}
layout = next(l for l in ui['layouts'] if l['path'].endswith('roomlist_icon.xml'))
names = ['txtRoomName', 'txtTeam0PlayerNumber', 'txtTeam1PlayerNumber', 'txtPlayerNumber']
rows = []
for name in names:
    control = next(c for c in layout['windows'] if c['name'] == name)
    properties = control['properties']
    assert control['type'] == 'WindowsLook/StaticText'
    assert 'Font' not in properties and 'TextColours' not in properties
    assert properties['HorzFormatting'] == 'HorzCentred'
    assert 'VertFormatting' not in properties
    rows.append({'name': name, 'parent': control['parent'], 'properties': properties,
                 'font': 'SIMSUN', 'cornersARGB': 'FFFFFFFF', 'horizontal': 'HorzCentred',
                 'vertical': 'VertCentred', 'clip': 'text-area-intersect-window'})
result = {'status': 'PASS', 'controls': rows, 'reusedOriginalExecution': 'waiting-room-static-text-native.json',
          'fontResource': 'ui-font-raster.json', 'scope': 'Four original card StaticText layouts consume executed global defaults; no new native execution.'}
(ROOT / 'recovery/output/room-card-text-source.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
print('PASS: four original card layouts bind to executed StaticText defaults')
