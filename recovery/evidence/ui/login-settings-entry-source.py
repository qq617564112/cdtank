"""Record the named login settings control and its assigned tooltip resource."""
import json
from pathlib import Path
import capstone
import pefile

ROOT = Path(__file__).resolve().parents[3]
pe = pefile.PE(str(ROOT / 'CDTank/CDTank.exe'))
base = pe.OPTIONAL_HEADER.ImageBase
code = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)
imports = {entry.address: entry.name.decode('ascii') for module in pe.DIRECTORY_ENTRY_IMPORT
           for entry in module.imports if entry.name}

def instructions(start, end):
    return [{'va': hex(i.address), 'bytes': i.bytes.hex(), 'asm': i.mnemonic + ' ' + i.op_str}
            for i in code.disasm(pe.get_data(start - base, end - start), start)]

assert pe.get_data(0x5cf8f0 - base, 30).split(b'\0')[0] == b'Login/btnSettings'
init = instructions(0x4c163d, 0x4c1675)
assert any(i['va'] == '0x4c1666' and i['asm'] == 'mov dword ptr [edi + 0x40], eax' for i in init)
identifier = instructions(0x4c301f, 0x4c302c)
assert identifier[0]['asm'] == 'push 0x142'
helper = instructions(0x4d925c, 0x4d92fd)
subscription = instructions(0x4c69e2, 0x4c6a31)
callback = instructions(0x4bfefe, 0x4bff2b)
assert any(i['va'] == '0x4c69ef' and i['asm'] == 'push 0x4bfefe' for i in subscription)
assert 'EventClicked@PushButton' in imports[0x5c01c0]
assert any(i['va'] == '0x4bff1a' and i['asm'] == 'push 0x40000001' for i in callback)
result = {'status': 'NAMED_LOGIN_SETTINGS_CLICK_SUBSCRIPTION_CONFIRMED',
          'control': 'Login/btnSettings', 'ownerMember': 'login owner+0x40',
          'tooltipResourceId': '0x142', 'initialization': init, 'tooltipAssignment': identifier,
          'helper': helper, 'terminalImport': imports.get(0x5c006c),
          'subscription': subscription, 'clickedEventImport': imports[0x5c01c0],
          'callbackAddress': '0x4bfefe', 'callback': callback,
          'loginVtable': {'address':'0x5cfa70','initializeSlot38':'0x4c1361','subscribeSlot2c':'0x4c678f'},
          'loginConstructor': {'address':'0x4c642f','base':'0x4d7e8b','baseParentStartsNull':instructions(0x4d7ea7,0x4d7eb6)},
          'containingOwner': {'constructor':'0x51a856','loginMember':'owner+0xc80','construction':instructions(0x51a89a,0x51a8a9)},
          'callbackBehavior': 'UI click sound through4d650b/4859d1, then owner+4 vtable slot8 with40000001, returns true',
          'soundPath': {'range': instructions(0x4d650b,0x4d6524), 'lookup': '4859d1 builds data/sound/<localized resource>.wav'},
          'scope': 'Original login button has a confirmed clicked callback; parent dispatcher destination is not yet established',
          'missing': ['Parent controller owner+4 and vtable slot8 dispatch of40000001', 'Post-login settings mount context'],
          'productionChanged': False, 'runtimeClaim': False}
(ROOT / 'recovery/output/login-settings-entry-source.json').write_text(json.dumps(result, indent=2)+'\n')
print(result['status'], result['terminalImport'])
