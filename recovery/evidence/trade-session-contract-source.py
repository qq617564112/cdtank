"""Capture the named original Trade session codecs and their consumers."""
import json
import struct
from pathlib import Path

import capstone
import pefile

ROOT = Path(__file__).resolve().parents[2]
image = pefile.PE(str(ROOT / 'CDTank/CDTank.exe')).get_memory_mapped_image()
decoder = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)

def capture(address, size):
    return [{'va': hex(i.address), 'bytes': i.bytes.hex(),
             'asm': f'{i.mnemonic} {i.op_str}'.rstrip()}
            for i in decoder.disasm(image[address - 0x400000:address - 0x400000 + size], address)]

tables = {
    'invite': (0x5cb2c8, 0x3f9a),
    'inviteReply': (0x5cbaf8, 0x3f9b),
    'acceptReject': (0x5cb2dc, 0x3f9c),
    'acceptRejectReply': (0x5cbb20, 0x3f9d),
    'offer': (0x5cb19c, 0x3f9e),
    'unshow': (0x5cb2f0, 0x3fa0),
    'showReply': (0x5cbb48, 0x3fa1),
    'confirm': (0x5cb304, 0x3fa2),
    'settlement': (0x5cbb70, 0x3fa3),
    'cancel': (0x5cb318, 0x3fad),
}
vtables = {}
for name, (address, message_id) in tables.items():
    slots = struct.unpack_from('<4I', image, address - 0x400000)
    getter = image[slots[1] - 0x400000:slots[1] - 0x400000 + 6]
    assert getter == b'\xb8' + struct.pack('<I', message_id) + b'\xc3', name
    vtables[name] = {'address': hex(address), 'messageId': hex(message_id),
                     'destructor': hex(slots[0]), 'getter': hex(slots[1]),
                     'reader': hex(slots[2]), 'writer': hex(slots[3])}

ranges = {
    0x494cf0: 379, 0x494e6b: 233, 0x494f56: 136,
    0x494fe0: 125, 0x49505f: 115, 0x4933c0: 73,
    0x49328d: 304, 0x493262: 43,
    0x42571f: 28, 0x445ab5: 55, 0x425ca4: 70,
    0x440c3f: 50, 0x43c76f: 43, 0x499757: 50,
    0x4998fc: 268, 0x499a8c: 393,
    0x491836: 150, 0x4918cc: 189, 0x495704: 124,
    0x495782: 65, 0x4957f7: 210,
    0x4eff0e: 54, 0x4eff81: 22,
    0x5029f2: 478, 0x502bd0: 76, 0x4f9a2e: 146,
    0x4fca10: 471, 0x4fd13e: 35, 0x4fd161: 70,
    0x4fd309: 23, 0x5030d8: 112, 0x5037e2: 45,
    0x503af5: 50, 0x49340b: 352,
    0x41e42e: 449, 0x42195e: 416, 0x42dddd: 167,
    0x41f1cc: 110, 0x422640: 88, 0x43eb4e: 175,
}
result = {
    'status': 'SOURCE_QUALIFIED_TRADE_SESSION_CODECS_AND_CLIENT_STATE',
    'vtables': vtables,
    'source': {hex(a): capture(a, n) for a, n in ranges.items()},
    'messages': {
        '3f9a': {'sender': '494cf0', 'fields': ['peerId32']},
        '3f9b': {'receiver': '491836', 'fields': ['peerId32', 'result8'],
                 'dispatch': {'4': 'Shop+84(peer)', '0,2,3,5,6': 'Shop+80(result)'}},
        '3f9c': {'sender': '494e6b', 'fields': ['peerId32', 'accept1'],
                 'acceptCaller': '4eff28 literal1', 'rejectCaller': '4eff91 literal0'},
        '3f9d': {'receiver': '4918cc', 'fields': ['peerId32', 'result8'],
                 'dispatch': 'Shop+88(peer,result); other result branch uses local profile ID'},
        '3f9e': {'sender': '494f56', 'fields': ['offer', 'result8'],
                 'receiver': '495704', 'dispatch': {'4': 'Shop+8c(offer)', '3': 'Shop+90(3)'}},
        '3fa0': {'sender': '4933c0', 'fields': ['side32'], 'caller': '502c15 SHOW off branch'},
        '3fa1': {'receiver': '495782', 'fields': ['side8', 'result8'],
                 'dispatch': 'Shop+94(side,result)→4fca10'},
        '3fa2': {'sender': '494fe0', 'fields': ['participantA32', 'participantB32', 'side8'],
                 'direction': 'side1 fills packet+10 with peer; other side fills packet+c',
                 'caller': '4f9a2e CONFIRM local lock; no separate action field'},
        '3fa3': {'receiver': '4957f7', 'fields': ['participantA32', 'participantB32',
                 'side8', 'status8', 'petCount16+petRecords', 'tankCount16+tankRecords',
                 'itemCount16+itemRecords'],
                 'direction': 'side1 callback(packet+10,status); side2 callback(packet+c,status)',
                 'status19': 'insert received owned records before session callback/49340b scalar settlement'},
        '3fad': {'sender': '49505f', 'fields': ['peerId32', 'side8'],
                 'caller': '4fd161 sends before local clear/close'},
    },
    'offer': {'writer': '49328d',
              'header': ['participantA32', 'participantB32', 'side8', 'listCount8'],
              'entries': {'0': 'pet record via41e42e', '1': 'tank record via42195e',
                          '2..8': 'item record via42dddd'},
              'tail': ['money32', 'originality16', 'skillPoints16'],
              'pet': 'instance0; base/type8; six base44..58 and rank5c..70 serialized',
              'tank': 'instance1c; type24; remainingMinutes34 serialized',
              'item': 'instance4; owner8; base/typec; quantity10 encoded24bits; additional state20/24/28/2c serialized',
              'construction': '502aab..502bca: pet/tank and kind4..8 reference original owned records; kind2/3 allocate new0x30/43bcb5, copy only instance4/owner8/basec, and set quantity10 from offered UI quantity entry+4'},
    'clientState': {
        'show': '5029f2 requires enabled SHOW and page+20false; sends own offer then sets+20=1',
        'confirm': '4f9a2e requires enabled CONFIRM and+21false; sends3fa2 then sets+21=1 and disables SHOW',
        'showReply': '4fca10 compares incoming side with page+98; opposite side clears peer offer, resets+21, disables CONFIRM and enables SHOW',
        'cancel': '4fd161 sends3fad then4fcbe9 clears both offers;4fd13e local close sends no message',
        'peerIdentity': 'page+94 is peer profile ID; page+98 is side;3fa3 feeds resolved peer ID to manager40+190/420ff8',
    },
    'settlement': {
        'scalarEvidence': 'pet-skill-point-transfer-native.json',
        'formula': 'current + peerOffer - ownOffer; no earning',
        'petRemove': '49349a→41f05a with instance0',
        'tankRemove': '4934ba→422565 with instance1c',
        'itemRemove': '493524..493553→43d583 with instance4; kind2/3 quantity10; kind4..8 count1; same-base2/3 in peer offer skips removal here',
        'receivedIdentity': 'decoded new record pointer inserted using received pet instance0 or tank instance1c; no client re-numbering in receiver',
        'receivedItemQuantity': '43eb4e same-base existing item branch replaces existing+10 with received+10, not an additive local transfer',
    },
    'limitations': [
        'Original server validation, dual-confirm atomic transaction and received instance-ID allocation are not supplied by these client codecs.',
        'Complete server status names and all invitation eligibility gates are not assigned here.',
        'Offer modification resets and both-shown authority gating require explicit Web policy; current client slice does not contradict that policy.',
        'Skill-point transfer does not qualify point earning or result awards.',
    ],
    'scope': 'Named static source capture; reuses the existing scalar native execution; no native matrix, production, service or browser execution.',
}
(ROOT / 'recovery/output/trade-session-contract-source.json').write_text(json.dumps(result, indent=2) + '\n')
print(result['status'])
