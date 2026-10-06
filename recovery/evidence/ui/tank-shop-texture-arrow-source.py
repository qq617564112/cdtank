"""Read original Texture arrow click bindings and finite candidate-index guards."""
import json
from pathlib import Path
import pefile
from capstone import Cs, CS_ARCH_X86, CS_MODE_32
ROOT = Path(__file__).resolve().parents[3]
b = (ROOT / 'CDTank/CDTank.exe').read_bytes()
p = pefile.PE(data=b)
c = Cs(CS_ARCH_X86, CS_MODE_32)

def block(start, length):
    offset = p.get_offset_from_rva(start - p.OPTIONAL_HEADER.ImageBase)
    return [{'va': hex(i.address), 'asm': f'{i.mnemonic} {i.op_str}'} for i in c.disasm(b[offset:offset+length], start)]

callbacks = {'DecTurret': 0x4b4f03, 'IncTurret': 0x4b5106, 'DecBody': 0x4b5316,
             'IncBody': 0x4b5538, 'DecTread': 0x4b5767, 'IncTread': 0x4b5989}
result = {'status': 'SOURCE_TEXTURE_ARROWS_FINITE_INDEX_NO_WRAP', 'task': 'UI59',
          'clickBindings': block(0x4b8308, 0x1d0),
          'callbacks': {name: block(address, 0x65) for name,address in callbacks.items()},
          'imports': {'5c01c0': 'PushButton.EventClicked', '5c0138': 'Window.setEnabled'},
          'contract': 'Mode2 only. Dec stops at index<=0; Inc stops when index+1>=candidate count. No modulo wrap.',
          'currentConsumer': 'tank-shop-texture.tsx uses modulo for both directions, allowing first/last wrap on normal clicks',
          'remainingGap': 'Exact original candidate-vector membership/order is not qualified by these guards.',
          'scope': 'Direction bounds on current supported candidates only; no change to candidate producer, SAVE or price policy',
          'productionChanged': False, 'chromeStarted': False}
(ROOT/'recovery/output/tank-shop-texture-arrow-source.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(result['status'])
