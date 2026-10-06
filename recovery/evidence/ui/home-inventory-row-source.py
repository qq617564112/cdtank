"""Original MyPlayer inventory list row construction and draw inputs."""
import json,struct
from pathlib import Path
import pefile,capstone
ROOT=Path(__file__).resolve().parents[3];pe=pefile.PE(str(ROOT/'CDTank/CDTank.exe'));base=pe.OPTIONAL_HEADER.ImageBase
cs=capstone.Cs(capstone.CS_ARCH_X86,capstone.CS_MODE_32)
def trace(a,z):return [{'va':hex(i.address),'asm':i.mnemonic+' '+i.op_str} for i in cs.disasm(pe.get_data(a-base,z-a),a)]
def f(a):return struct.unpack('<f',pe.get_data(a-base,4))[0]
assert pe.get_data(0x5d2450-base,30).split(b'\0')[0]==b'MyPlayer/lstPlayerItem'
assert struct.unpack('<II',pe.get_data(0x5cee60-base,8))==(0x4b923b,0x4b8bc4)
strings={r['recordId']:r['values']['String'] for r in json.loads((ROOT/'recovery/output/verified/tables/gamestring.json').read_text())['rows']}
result={'status':'SOURCE_HOME_ITEM_ROW_FACTORY_GEOMETRY_TEXT_CONFIRMED','tasks':['UI36','M5-09'],'control':{'name':'MyPlayer/lstPlayerItem','lookup':'4df288','ownerMember':'1f4','initialization':trace(0x4df288,0x4df2d3)},'factory':trace(0x4e2ea7,0x4e305b),'rowConstructor':trace(0x4b886d,0x4b8bc4),'vtable':'5cee5c','sizeGetter':'4b923b','sizeEvidenceReused':'recovery/output/mend-owned-row-source.json','dimensions':[161,56],'draw':trace(0x4b8bc4,0x4b8f2d),'nameGetter':trace(0x4d8366,0x4d838a),'typeGetter':trace(0x4d83b3,0x4d8429),'quantityGetter':trace(0x4d5f95,0x4d5fd1),'typeLabels':{str(i):strings[685+i] for i in range(1,13)},'geometry':{'columnWidth':f(0x5d1d70),'selectionHeight':f(0x5cedfc),'iconLeft':f(0x5ccfe0),'iconTop':f(0x5e68b0),'iconSize':32,'nameLeft':f(0x5cee80),'nameTop':f(0x5c8280),'typeLeft':f(0x5cee80),'typeTop':f(0x5cee7c),'quantityRightFromIconOrigin':f(0x5cee78),'quantityBottomFromIconOrigin':f(0x5cee78)},'confirmed':'MyPlayer item list filters original owned kind1 and positive MyItem+10. Factory passes name helper4d8366, type helper4d83b3, quantity helper4d5f95 to row4b886d. Quantity is base10 raw MyItem+10, independently positioned over icon; not a name suffix or duration.', 'remaining':['Original font extent/height feeds quantity position; selected global Web font remains its explicit provider.','Weapon list factory has a separate source chain; not covered here.','Later overlay states in draw beyond4b8f2d are not covered; existing inventory drag/slots/selection/transactions are preserved.'],'productionChanged':False,'runtimeClaim':False}
(ROOT/'recovery/output/home-inventory-row-source.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(result['status'],result['geometry'])
