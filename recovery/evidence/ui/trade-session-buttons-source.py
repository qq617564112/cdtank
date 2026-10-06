"""Extract the new Trade receiver registration and same-owner button callers."""
import json
from pathlib import Path
import pefile
from capstone import Cs, CS_ARCH_X86, CS_MODE_32

ROOT = Path(__file__).resolve().parents[3]
pe = pefile.PE(str(ROOT / 'CDTank/CDTank.exe'))
image = pe.get_memory_mapped_image()
base = pe.OPTIONAL_HEADER.ImageBase
cs = Cs(CS_ARCH_X86, CS_MODE_32)
ranges = {
    'showBinding': (0x4fec1a, 0x4fec48),
    'exchangeBinding': (0x4fec54, 0x4fec82),
    'receiverRegistration': (0x503af5, 0x503b27),
    'receiverWrapper': (0x4fafdd, 0x4fb019),
    'receiverStore': (0x4917be, 0x4917dc),
    'receiverSessionLookup': (0x5030d8, 0x503141),
    'showRegistration': (0x503f1e, 0x503f5e),
    'exchangeRegistration': (0x503f73, 0x503fb3),
    'exchangeCallback': (0x4f9a2e, 0x4f9ac2),
    'exchangeSender': (0x494fe0, 0x49505f),
    'cancelBinding': (0x4fec8e, 0x4fecbc),
    'cancelRegistration': (0x503fc8, 0x504008),
    'cancelCallback': (0x4fd3ef, 0x4fd453),
    'cancelConfirmation': (0x4fd161, 0x4fd1a7),
    'sessionAttachIdentity': (0x4fd1a7, 0x4fd1e7),
    'sessionAttachSide': (0x4fd309, 0x4fd323),
    'exchangeRequestConstructor': (0x4930c7, 0x4930fa),
    'showOfferScalars': (0x5029f2, 0x502a9e),
    'showOfferSubmission': (0x502bc4, 0x502c3d),
}
source = {name: [{'va': hex(i.address), 'asm': f'{i.mnemonic} {i.op_str}'}
                 for i in cs.disasm(image[a-base:z-base], a)]
          for name, (a, z) in ranges.items()}
result = {
    'status': 'SOURCE_QUALIFIED_TRADE_SESSION_SHOW_EXCHANGE_CALLBACKS',
    'source': source,
    'newReceiverSource': 'recovery/output/pet-skill-point-acquisition-source.json',
    'receiver': {'callback': '0x5030d8', 'registration': '0x503af5',
                 'storedAt': 'game+134 callback+9c through4917be',
                 'lookup': 'argument1→game+118 manager+40+190→420ff8'},
    'controls': [
        {'name': 'Trade/btnShow', 'ownerField': '+548', 'registration': '0x503f2e',
         'callback': '0x5029f2', 'sameOwnerOffer': '+9c', 'sender': '0x494f56',
         'scalarCopies': {'owner+84': 'offer+18', 'owner+8c': 'offer+1c', 'owner+88': 'offer+20'},
         'afterSubmit': 'owner+20=1; peer+a0 nonzero and owner+21=0 gates exchange enable'},
        {'name': 'Trade/btnExchange', 'ownerField': '+54c', 'registration': '0x503f83',
         'callback': '0x4f9a2e', 'sender': '0x494fe0',
         'arguments': ['owner+94', 'owner+98'],
         'gate': 'control+38c true and owner+21 false',
         'afterSubmit': 'owner+21=1, Show control disabled'},
        {'name': 'Trade/btnCancel', 'ownerField': '+550', 'registration': '0x503fd8',
         'callback': '0x4fd3ef', 'confirmation': '0x4fd161 through4d90ae message120',
         'sender': '0x49505f', 'arguments': ['owner+94', 'owner+98'],
         'afterConfirm': 'owner parent vtable+8(2), sender, then4fcbe9 cleanup'},
    ],
    'sessionAttach': {'method': '0x4fd1a7', 'owner+94': 'argument1, same key420ff8 resolves session',
                      'owner+98': 'argument2 copied at4fd310; side/tag semantic pending'},
    'exchangeSender': {'modeGate': 2, 'requestConstructor': '0x4930c7',
                       'requestVtable': '0x5cb304', 'send': '0x413ec4',
                       'argumentWrite': 'arg2==1 writes arg1 to request+10, otherwise request+c; arg2 to request+14'},
    'remainingGap': ['Caller supplying sessionAttach arg2 side/tag; invite/accept lifecycle',
                     'Invite and peer acceptance authority',
                     'Request codec/type identity and authoritative two-party offer validation'],
    'limits': 'Static bounded instructions only; no native execution, codec qualification, transaction service or original framebuffer claim',
    'oldEntry104CallerRevisited': False,
    'productionChanged': False, 'typeExecuted': False, 'chromeStarted': False,
}
(ROOT / 'recovery/output/trade-session-buttons-source.json').write_text(json.dumps(result, ensure_ascii=False, indent=2)+'\n')
print(result['status'])
