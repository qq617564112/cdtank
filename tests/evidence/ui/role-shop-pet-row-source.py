"""Named ShopPet layout and its original product row constructor contract."""
import json, struct
from pathlib import Path
import pefile, capstone
ROOT=Path(__file__).resolve().parents[3]
p=pefile.PE(str(ROOT/'CDTank/CDTank.exe'));base=p.OPTIONAL_HEADER.ImageBase
c=capstone.Cs(capstone.CS_ARCH_X86,capstone.CS_MODE_32)
def trace(a,z):
 return [{'va':hex(i.address),'asm':i.mnemonic+' '+i.op_str} for i in c.disasm(p.get_data(a-base,z-a),a)]
def string(a):return p.get_string_at_rva(a-base).decode('gb18030')
r={'status':'SOURCE_SHOP_PET_PRODUCT_FACTORY_ROW_GEOMETRY_READY_PROVIDER_GAPS','tasks':['UI56','M5-10'],
 'layoutIdentity':{'load':trace(0x4b0363,0x4b03cc),'list':trace(0x4b0440,0x4b046b),'path':string(0x5ce4d0),'listPath':string(0x5ce494),'ownerList':'this+0x50'},
 'productFactory':trace(0x4af876,0x4afa06),'ownedFactorySeparate':trace(0x4b1a36,0x4b1adf),
 'productArguments':{'name':'record+0x14 string through4d7e58','secondaryText':'4d8c0b(record), no originalprice semantic claimed','tertiaryText':'4d9bc1(record), no originalduration semantic claimed','constructor':'4bd110','id':'productrecord+0xc','owned':False,'insertion':'owner+50 vtable+10c'},
 'constructor':trace(0x4bd110,0x4bd280),'vtable':'5cef8c','getSize':'4b923b','getSizeTrace':trace(0x4b923b,0x4b9251),
 'size':[struct.unpack('<f',p.get_data(0x5cee00-base,4))[0],struct.unpack('<f',struct.pack('<I',0x42600000))[0]],
 'drawEntry':'4bd520','drawHead':trace(0x4bd520,0x4bd650),'textDraw':trace(0x4bd6db,0x4bd8b6),
 'textPositions':{'name':[44,4],'secondary':[44,18],'tertiary':[44,32]},'textMembers':{'name':'base+4','secondary':'this+174','tertiary':'this+20c'},
 'iconPathFormatter':{'format':string(0x5cef58),'directory':string(0x5cef6c),'productInput':'constructorarg+14 productrecord+c','ownedInput':'separate MyPet lookup->Petrecord+c'},
 'origin':[5,8],'selectedBackgroundHeight':struct.unpack('<f',p.get_data(0x5cedfc-base,4))[0],
 'gaps':['Originalfont service inherited by ListboxTextItem; fullfont/Windowsframebuffer fidelity unresolved.','ID/name loader and namegetter qualified byrole-shop-pet-name-provider-native.json; rawName+14 is inlinebuffer ofstdstring at+10.','Secondary/tertiary text getter output has no consumerprovider yet; no price/duration semantic or wirefield invented.'],
 'productionChanged':False,'chromeStarted':False}
(ROOT/'recovery/output/role-shop-pet-row-source.json').write_text(json.dumps(r,ensure_ascii=False,indent=2)+'\n')
print(r['status'])
