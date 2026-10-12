"""Capture the original kind3 stack sale quantity and inventory lifecycle."""
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

vtables = {}
for name, address, message in [('request', 0x5cb264, 0x3f86), ('reply', 0x5cb968, 0x3f87)]:
    slots = struct.unpack_from('<4I', image, address - 0x400000)
    assert image[slots[1] - 0x400000:slots[1] - 0x400000 + 6] == b'\xb8' + struct.pack('<I', message) + b'\xc3'
    vtables[name] = {'address': hex(address), 'messageId': hex(message),
                     'getter': hex(slots[1]), 'reader': hex(slots[2]), 'writer': hex(slots[3])}
ranges = {0x4945f7: 364, 0x492d38: 152, 0x498439: 93, 0x498aa2: 75,
          0x495346: 161, 0x496e5d: 75, 0x43bd09: 10, 0x43ccac: 70,
          0x43ce40: 220, 0x43cf1c: 220, 0x42fe3f: 8, 0x4208b7: 96}
instructions = {hex(address): capture(address, size) for address, size in ranges.items()}
asm = lambda address: [row['asm'] for row in instructions[hex(address)]]
assert 'mov dword ptr [esi], 0x5cb264' in asm(0x492d38)
assert 'push 0x18' in asm(0x492d38)
assert 'cmp dword ptr [esi + 0x14], 2' in asm(0x495346)
assert 'push dword ptr [esi + 0x10]' in asm(0x495346)
assert 'call 0x43d583' in asm(0x495346)
assert 'imul eax, esi' in asm(0x4945f7)
for address in [0x43ce40, 0x43cf1c]:
    assert 'sub eax, dword ptr [ebp + 0xc]' in asm(address)
    assert 'mov dword ptr [ecx + 0x10], eax' in asm(address)
    assert 'mov dword ptr [ecx + 0x20], eax' in asm(address)
    assert 'cmp ecx, 7' in asm(address) and 'mov dword ptr [eax + ecx*4], edi' in asm(address)
result = {
    'status': 'SOURCE_QUALIFIED_KIND3_STACK_ITEM_QUANTITY_SALE',
    'binary': 'CDTank/CDTank.exe', 'vtables': vtables,
    'dispatcherReuse': '495e90(kind3,instance,quantity)→4945f7; durable-item-sale-contract-source.json',
    'request': {'messageId':'0x3f86', 'constructor':'492d38',
                'fields':[{'name':'instanceId','offset':'0xc','bits':32},
                          {'name':'quantity','offset':'0x10','bits':24}],
                'quoteTransmitted':False},
    'sender': {'inventoryCategories':[1,2], 'definitionRanges':[[1,1000],[2001,4000]],
               'mode':2, 'localProfileAndItemProviderRequired':True,
               'ownedRecordLookup':'category1→43ccac or category2→43cccf, both compare MyItem+4 instance in respective vectors',
               'quantityGate':'unsigned requested quantity <=MyItem+10 ownedquantity; excess feedbackresult0',
               'zeroQuantityGate':False,
               'fee':'uint32(low32((uint32(ItemMoney)>>>1)*quantity)) via439947 andimul',
               'moneyGate':'uint32(money+fee)<=999999999; overflow feedbackresult1',
               'stateOrHotkeyProhibition':False},
    'reply': {'messageId':'0x3f87', 'successResult':2,
              'fields':[{'name':'instanceId','offset':'0xc','bits':32},
                        {'name':'quantity','offset':'0x10','bits':24},
                        {'name':'result','offset':'0x14','bits':8},
                        {'name':'money','offset':'0x18','bits':32}],
              'registration':'496e5d→491b14/48baff binds495346',
              'receiver':'success2 writes complete money selector26;43d186(instance)→43bd09 category→43d583(instance,replyquantity,category)',
              'callback':'owner+54 virtual+8(result)',
              'otherResults':'No balance or inventory write in this receiver'},
    'inventoryLifecycle': {'category1':'43ce40 vector+c', 'category2':'43cf1c vector+1c',
                           'partial':'When ownedquantity>replyquantity, owned+10 subtracts replyquantity; Battlequantity+20=min(newowned,Itemrecord+104 BattleUseMax) if definitionprovider exists; other fields retained.',
                           'whole':'When ownedquantity<=replyquantity, profile selector0 sevenhotkeys scan clears firstmatching instance, thenMyItem deletingdestructor andvectorerase4f14f5.',
                           'hotkeyPointerIdentity': 'Profilevirtual+20→42fe3f adds20→4208b7 selector0 returnsdataobject+100; not guessedpayload+11c. Webhotkeys separate persistence mapping.',
                           'partReferences':'No selector2 or profilepart slot cleanup; those belong to durable whole-instance sale.',
                           'definitionMissing':'Partialownedquantity still subtracts; battlequantity remains unchanged whenItemdefinitionprovider absent.'},
    'reuse':['durable-item-sale-contract-source.json439947 unsignedhalf andMyItem destructor',
             'account-inventory.md selector0 sevenhotkeys andBattleUseMax provenance'],
    'limits':['Original server authorization, successful quantity selection, payout and atomic persistence remain reconstructed.',
               'Client allows zeroquantity and uses low32 arithmetic; positivequantity and safe-money authority require explicit policy.',
               'This new kind3 stack lifecycle is separate from kind4 durableminutes; no duration sale conversion.',
               'No service, protocol, production or native matrix executed.'],
    'instructions':instructions}
(ROOT / 'recovery/output/stack-item-sale-contract-source.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(result['status'])
