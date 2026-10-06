"""Recover the four original introduction strings and their radio callback."""
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

def source(start, end):
    return [{'va': hex(i.address), 'bytes': i.bytes.hex(), 'asm': i.mnemonic+' '+i.op_str}
            for i in code.disasm(pe.get_data(start-base,end-start),start)]

callback = source(0x4c39e6,0x4c3b73)
by_address = {int(i['va'],16): i for i in callback}
assert by_address[0x4c3a61]['asm'] == 'push 0x2e1'
assert by_address[0x4c3a71]['asm'] == 'push 0x2e2'
assert by_address[0x4c3a81]['asm'] == 'push 0x2e3'
assert by_address[0x4c3a91]['asm'] == 'push 0x2e4'
assert by_address[0x4c3b27]['asm'] == 'call dword ptr [0x5c0240]'
assert 'setText@Window' in imports[0x5c0240]
assert 'setReadOnly' in imports[0x5c01b0]
assert 'EventSelectStateChanged' in imports[0x5c01c4]
rows = json.loads((ROOT/'recovery/output/verified/tables/gamestring.json').read_text())['rows']
records = {r['recordId']: r['values']['String'] for r in rows}
controls = ['rdoTuntown','rdoCharacters','rdoCompany','rdoStaff']
labels = [records[i] for i in [193,194,195,196]]
contents=[]
for index,(control,label) in enumerate(zip(controls,labels)):
    record=737+index
    assert records[record] == records[100000+record]
    contents.append({'control':control,'label':label,'member':hex(0x24+4*index),
                     'recordId':record,'alternateLanguageRecordId':100000+record,
                     'sourceText':records[record],'text':records[record].replace('\\n','\n'),
                     'length':len(records[record]),'displayCharacters':len(records[record].replace('\\n','\n'))})
ui=json.loads((ROOT/'recovery/output/web-assets/ui.json').read_text())
layout=next(l for l in ui['layouts'] if l['path'].endswith('/history.xml'))
result={'status':'SOURCE_FOUR_INTRODUCTION_CONTENT_CALLBACK_CONFIRMED','tasks':['UI-23','M5-15'],
        'binary':'CDTank/CDTank.exe','table':'CDTank/Data/table/gamestring.dat',
        'decodedTable':'recovery/output/verified/tables/gamestring.json','layout':layout,
        'contents':contents,'readOnlyImport':imports[0x5c01b0],'selectionEvent':imports[0x5c01c4],
        'vtable':'0x5cf200','initialize':'0x4c08eb','subscribe':'0x4c3d9e',
        'subscription':source(0x4c3db9,0x4c3ef1),'callback':callback,
        'lookup':source(0x417e17,0x417e51),'showDefaultFirst':source(0x4c0b5d,0x4c0b94),
        'newlines':{'from':repr('\\n'),'to':'LF','replacementCall':'0x411c88'},
        'originalLoginEntry':{'name':'Login/btnHistory','ownerMember':'login+0x44','subscription':source(0x4c6a31,0x4c6a80),'callback':'0x4bff2b','callbackSource':source(0x4bff2b,0x4bff58),'parentEvent':'0x40000002','parentDispatcherDestinationConfirmed':False},
        'containingOwner':{'member':'controller+0xfb8','constructor':'0x4c11ed','constructorSource':source(0x4c11ed,0x4c1223)},
        'productionImported':False,'runtimeClaim':False,
        'limits':['Use the original stored strings exactly, including incomplete endings and punctuation',
                  'This source informational page is independent of account match history',
                  'Formal original opener and native scroll/font precision remain to be integrated']}
(ROOT/'recovery/output/history-intro-content-source.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(result['status'],[(x['recordId'],x['displayCharacters']) for x in contents])
