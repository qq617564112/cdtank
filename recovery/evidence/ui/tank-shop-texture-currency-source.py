"""Read original LabPage Texture currency-window bindings and visibility branches."""
import json
from pathlib import Path
import pefile
from capstone import Cs, CS_ARCH_X86, CS_MODE_32
ROOT = Path(__file__).resolve().parents[3]
binary = (ROOT / 'CDTank/CDTank.exe').read_bytes()
pe = pefile.PE(data=binary)
base = pe.OPTIONAL_HEADER.ImageBase
cs = Cs(CS_ARCH_X86, CS_MODE_32)

def block(start, end):
    offset = pe.get_offset_from_rva(start - base)
    return [{'va': hex(i.address), 'asm': f'{i.mnemonic} {i.op_str}'}
            for i in cs.disasm(binary[offset:offset + end - start], start)]

def string(address):
    offset = pe.get_offset_from_rva(address - base)
    return binary[offset:offset + 100].split(b'\0')[0].decode('ascii')

result = {
    'status': 'SOURCE_TEXTURE_CURRENCY_VISIBILITY_BRANCH_WITH_CONFIG_PROVIDER_GAP',
    'task': 'UI59',
    'binding': block(0x4b3c71, 0x4b3dcf),
    'visibility': block(0x4b6a84, 0x4b6b4d),
    'predicate': {'object': '0x634ee8', 'getter': '0x4070e2', 'keys': {hex(a): string(a) for a in (0x5c1fbc, 0x5c2308)}},
    'import': {'address': '0x5c0260', 'name': '?setVisible@Window@CEGUI@@QAEX_N@Z'},
    'windows': {'daibi2': 'this+100', 'daibi3': 'this+104', 'daibi4': 'this+108',
                'xingdian1': 'this+f4', 'xingdian2': 'this+f8', 'xingdian3': 'this+fc'},
    'branches': {'Q getter returns0': 'daibi trio visible, xingdian trio hidden',
                 'Q nonzero and X returns0': 'xingdian trio visible, daibi trio hidden',
                 'Q and X nonzero': 'no visibility write in this branch'},
    'conclusion': 'Currency-image choice is a page-wide configuration branch, not proven per-offer rarity.',
    'remainingGap': 'Original Q/X configuration producer and its identity with current supported account/server state are unqualified.',
    'limits': ['No current rarity-to-Q/X mapping inferred', 'No BUY or SAVE price policy changes',
               'Original framebuffer and complete UI59 remain unverified'],
    'productionChanged': False, 'chromeStarted': False,
}
(ROOT / 'recovery/output/tank-shop-texture-currency-source.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
print(result['status'])
