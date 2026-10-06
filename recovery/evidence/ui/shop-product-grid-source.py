"""Original ConvenientPage two-column product list source."""
import json,struct
from pathlib import Path
import pefile,capstone
ROOT=Path(__file__).resolve().parents[3];p=pefile.PE(str(ROOT/'CDTank/CDTank.exe'));base=p.OPTIONAL_HEADER.ImageBase
cs=capstone.Cs(capstone.CS_ARCH_X86,capstone.CS_MODE_32)
def trace(a,z):return [{'va':hex(i.address),'asm':i.mnemonic+' '+i.op_str} for i in cs.disasm(p.get_data(a-base,z-a),a)]
imports={x.address:x.name.decode() for d in p.DIRECTORY_ENTRY_IMPORT for x in d.imports if x.name}
assert 'insertColumn@MultiColumnList' in imports[0x5c01ac]
assert 'setItem@MultiColumnList' in imports[0x5c0190]
width=struct.unpack('<f',p.get_data(0x5cc120-base,4))[0];assert width==171
strings=json.loads((ROOT/'recovery/output/verified/tables/gamestring.json').read_text())['rows'];strings={r['recordId']:r['values']['String'] for r in strings}
r={'status':'ORIGINAL_SHOP_TWO_COLUMN_PRODUCT_REGION_CONFIRMED','tasks':['UI53','M5-10'],'layout':'shop_itempage.xml','control':'ConvenientPage/lstShopItem','ownerMember':'0x44','initialize':trace(0x49ea82,0x49eb49),'importedFunctions':{hex(a):imports[a] for a in [0x5c01ac,0x5c0190,0x5c01a8]},'columns':{'count':2,'width':width,'order':'rowmajor','insertColumnCalls':['49eaf5','49eb37'],'placement':trace(0x4a08e4,0x4a0927)},'contentInputs':trace(0x4a04ad,0x4a05d0),'weaponInputs':trace(0x4a0631,0x4a0758),'valuableInputs':trace(0x4a07ab,0x4a0927),'itemConstructor':'4b9251','itemRowSize':[161,56],'ownedFlag':False,'drawSource':'recovery/output/shop-owned-item-row-source.json','itemDraw':{'originX':10,'icon':[14,8],'name':[53,4],'type':[53,18],'quantityAnchor':[46,40]},'typeGetter':trace(0x4d8429,0x4d849e),'countGetter':trace(0x439950,0x439967),'priceGetter':trace(0x4d96ba,0x4d99cb),'priceStrings':{str(a):strings[a] for a in [78,81,721,722]},'currentProvider':'ShopQUERY itemTableId/name/info/iconId/moneyPrice/tokenPrice','missing':['Original record+f8 purchasecount getter identity is not present in currentShop QUERY; do not label an Inventory quantity as offered quantity.','Original record+f4 determines price text branch; currentShop QUERY exposes both prices without confirmed f4 identity.'],'radioInitialization':trace(0x49ebfc,0x49ec6c),'radioCallback':trace(0x4a03c7,0x4a04bc),'weaponRadioBranch':trace(0x4a05eb,0x4a063c),'radioFactoryIdentity':{'Item':{'member':'0x54','string':'ConvenientPage/rdoShopItemPage','compare':'4a0466','factoryKind':1},'Weapon':{'member':'0x58','string':'ConvenientPage/rdoShopWeaponPage','compare':'4a05eb','factoryKinds':[3,4]}},'productionChanged':False,'chromeStarted':False}
(ROOT/'recovery/output/shop-product-grid-source.json').write_text(json.dumps(r,ensure_ascii=False,indent=2)+'\n');print(r['status'])
