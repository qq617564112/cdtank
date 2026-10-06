"""Record bounded static probes of the two original exchange controls."""
import json
import struct
from pathlib import Path
import pefile
from capstone import Cs, CS_ARCH_X86, CS_MODE_32

ROOT = Path(__file__).resolve().parents[3]
pe = pefile.PE(str(ROOT / 'CDTank/CDTank.exe'))
image = pe.get_memory_mapped_image()
base = pe.OPTIONAL_HEADER.ImageBase
cs = Cs(CS_ARCH_X86, CS_MODE_32)
cs.skipdata = True

def references(address):
    needle = struct.pack('<I', address)
    result = []
    start = 0
    while True:
        offset = image.find(needle, start)
        if offset < 0:
            return result
        result.append(hex(base + offset))
        start = offset + 4

def uses(start, end, field):
    instructions = list(cs.disasm(image[start-base:end-base], start))
    return [{'va': hex(i.address), 'asm': f'{i.mnemonic} {i.op_str}'}
            for i in instructions if field in i.op_str]

result = {
    'status': 'BOUNDED_STATIC_CALLBACK_REQUEST_SESSION_GAP',
    'playerInfo': {
        'control': 'PlayerListSheet/btnExchange', 'ownerField': '+104',
        'nameAddress': '0x5d3474', 'nameAddressReferences': references(0x5d3474),
        'ownerUsesRange': ['0x4ee000', '0x4ef986'],
        'ownerUses': uses(0x4ee000, 0x4ef986, '0x104]'),
        'result': 'Control assignment and label302; no callback-to-request edge qualified by these probes',
        'sameCallerNoProgressProbes': 2,
        'furtherSameCallerSearchStopped': True,
    },
    'tradeSession': {
        'control': 'Trade/btnExchange', 'ownerField': '+54c',
        'nameAddress': '0x5d4328', 'nameAddressReferences': references(0x5d4328),
        'ownerUsesRange': ['0x4fd000', '0x502000'],
        'ownerUses': uses(0x4fd000, 0x502000, '0x54c]'),
        'result': 'Control assignment only in the bounded range; session callback remains unqualified',
    },
    'method': 'Offline mapped-image immediate-address references and bounded linear Capstone decode with skipdata; not a complete control-flow or dynamic-dispatch analysis',
    'businessGap': ['Invite request/receiver identity', 'Peer session and authoritative offer state', 'Confirm/cancel/settlement producer'],
    'providerBoundary': 'OwnedRoles and Inventory describe the local account; neither supplies peer session state',
    'productionChanged': False, 'typeExecuted': False, 'chromeStarted': False,
}
(ROOT / 'recovery/output/trade-entry-callback-bounded.json').write_text(
    json.dumps(result, ensure_ascii=False, indent=2) + '\n')
print(result['status'])
