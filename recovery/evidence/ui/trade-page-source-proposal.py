"""Inventory original trade layouts and their bounded load instructions."""
import json
from pathlib import Path
import re
import pefile
from capstone import Cs, CS_ARCH_X86, CS_MODE_32

ROOT = Path(__file__).resolve().parents[3]
ui = json.loads((ROOT / 'recovery/output/web-assets/ui.json').read_text())
binary = (ROOT / 'CDTank/CDTank.exe').read_bytes()
pe = pefile.PE(data=binary)
base = pe.OPTIONAL_HEADER.ImageBase
disassembler = Cs(CS_ARCH_X86, CS_MODE_32)
loads = {'trade.xml': (0x4fd940, 0x4fd97f),
         'trade_partdesc.xml': (0x4fed2f, 0x4fed70),
         'trade_petdesc.xml': (0x4feeba, 0x4feefb),
         'trade_tankdesc.xml': (0x4ffa40, 0x4ffa81)}

def original_control(control, windows):
    rectangle = lambda item: list(map(float, re.findall(r'-?\d+(?:\.\d+)?', item['properties']['AbsoluteRect'])))
    box = rectangle(control)
    left, top = box[:2]
    parent = control['parent']
    while parent:
        owner = next(window for window in windows if window['name'] == parent)
        position = rectangle(owner)
        left += position[0]
        top += position[1]
        parent = owner['parent']
    assets = []
    for property_name, reference in control['properties'].items():
        match = re.fullmatch(r'set:(\S+) image:(.+)', reference)
        if not match:
            continue
        sets = [item for item in ui['imagesets'] if item['attributes']['Name'] == match[1]]
        selected = next((item for item in sets if 'imagesets_dds/' in item['path']), sets[0] if sets else None)
        image = next((item for item in selected['images'] if item['Name'] == match[2]), None) if selected else None
        assets.append({'property': property_name, 'reference': reference,
                       'imageset': selected['path'] if selected else None,
                       'asset': image.get('asset') if image else None})
    return {'name': control['name'], 'type': control['type'], 'parent': control['parent'],
            'sourceRectangle': box, 'layoutRelativeRectangle': [left, top, box[2]-box[0], box[3]-box[1]],
            'sourceProperties': control['properties'], 'sourceEvents': control.get('events', []),
            'webAtlasReferences': assets}

layouts = []
for suffix, (start, end) in loads.items():
    layout = next(item for item in ui['layouts'] if item['path'].endswith(suffix))
    offset = pe.get_offset_from_rva(start-base)
    instructions = [{'va': hex(item.address), 'asm': f'{item.mnemonic} {item.op_str}'}
                    for item in disassembler.disasm(binary[offset:offset+end-start], start)]
    layouts.append({'layout': layout['path'], 'controlCount': len(layout['windows']),
                    'loadInstructions': instructions,
                    'controls': [original_control(control, layout['windows']) for control in layout['windows']]})
protocols = sorted(path.name for path in (ROOT / 'apps/shared/protocols').glob('*.ts'))
result = {
    'tasks': ['UI-60', 'UI-61', 'UI-62', 'UI-63'],
    'status': 'SOURCE_LAYOUT_INVENTORY_READY_BUSINESS_SESSION_UNAVAILABLE',
    'layouts': layouts,
    'baseResolution': {'sharedSourceReference': [800, 600], 'tradeRootRectangle': [0, 0, 615, 403],
                       'rootPlacement': 'Original trade attachment/centering caller not yet qualified'},
    'currentBusiness': {
        'playerInfoEntry': 'apps/web/src/interface/lobby/player-info.tsx btnExchange is disabled with no handler',
        'protocolFiles': protocols,
        'tradeSessionContract': None,
        'existingOwnedReadProviders': ['OwnedRoles', 'Inventory'],
        'missing': ['Normal player invitation/accept entry and peer session identity',
                    'Authoritative two-party offered-record and currency state',
                    'Show/exchange/cancel lifecycle and ownership settlement'],
    },
    'qualified': ['Four original XML loadWindowLayout instructions and owner-relative destinations',
                  '148/6/47/52 XML control identities and layout-relative geometry',
                  'Current DDS-preferred exact atlas references'],
    'limits': ['No native execution or original screenshot comparison',
               'No source trade callback, list factories or transaction protocol qualification',
               'Atlas mapping is the current source provider, not original framebuffer equivalence',
               'No usable trade page or parent completion claim'],
    'productionChanged': False, 'chromeStarted': False,
}
(ROOT / 'recovery/output/trade-page-source-proposal.json').write_text(json.dumps(result, ensure_ascii=False, indent=2)+'\n')
print(result['status'])
print('Source controls:', '/'.join(str(item['controlCount']) for item in layouts))
