"""Original maintenance Part row construction, geometry and duration formatting."""
import json, struct
from pathlib import Path
import capstone, pefile
from unicorn import Uc, UC_ARCH_X86, UC_MODE_32
from unicorn.x86_const import UC_X86_REG_ESP, UC_X86_REG_EBP, UC_X86_REG_EAX
ROOT=Path(__file__).resolve().parents[3]
pe=pefile.PE(str(ROOT/'CDTank/CDTank.exe'));base=pe.OPTIONAL_HEADER.ImageBase
code=capstone.Cs(capstone.CS_ARCH_X86,capstone.CS_MODE_32)
def source(start,end):
 return [{'va':hex(i.address),'bytes':i.bytes.hex(),'asm':i.mnemonic+' '+i.op_str} for i in code.disasm(pe.get_data(start-base,end-start),start)]
def number(address):return struct.unpack('<f',pe.get_data(address-base,4))[0]
assert struct.unpack('<I',pe.get_data(0x5ceee4-base,4))[0]==0x4b923b
uc=Uc(UC_ARCH_X86,UC_MODE_32)
for address in [0x4b9000,0x5ce000,0x4d8000,0x2000000]:uc.mem_map(address,0x1000)
uc.mem_write(0x4b923b,pe.get_data(0x4b923b-base,0x17));uc.mem_write(0x5cee00,pe.get_data(0x5cee00-base,4))
stack,out,done=0x2000100,0x2000200,0x2000300
uc.mem_write(stack,struct.pack('<II',done,out));uc.reg_write(UC_X86_REG_ESP,stack)
uc.emu_start(0x4b923b,done,count=20);pixel=list(struct.unpack('<2f',uc.mem_read(out,8)));assert pixel==[161,56]
uc.mem_write(0x4d84f1,pe.get_data(0x4d84f1-base,0x14));frame,record=0x2000400,0x2000500
uc.mem_write(frame+8,struct.pack('<I',record));vectors=[]
for quantity in [0,1,1439,1440,1441]:
 uc.mem_write(record+0x10,struct.pack('<I',quantity));uc.reg_write(UC_X86_REG_EBP,frame);uc.emu_start(0x4d84f1,0x4d8505,count=20)
 days=uc.reg_read(UC_X86_REG_EAX);assert days==(quantity+1439)//1440;vectors.append({'recordOffset10':quantity,'days':days})
rows=json.loads((ROOT/'recovery/output/verified/tables/gamestring.json').read_text())['rows'];strings={r['recordId']:r['values']['String'] for r in rows}
result={'status':'PASS_ORIGINAL_MEND_PART_ROW_GEOMETRY_AND_TEXT_SOURCE','tasks':['UI54','M5-10'],'binary':'CDTank/CDTank.exe','layoutString':'0x5d735c','initializeReference':'0x5177a0','partControl':{'lookup':'0x517959','string':'0x5d72a4','name':'ShopMendPage/lstPart','ownerMember':'0x5c'},'partColumnWidth':number(0x5d6f38),'partBranches':source(0x518fb5,0x5195f0),'rowConstructor':source(0x4b9e77,0x4ba194),'rowVtable':'0x5ceee0','pixelSizeGetter':source(0x4b923b,0x4b924f),'nativePixelSize':pixel,'draw':source(0x4ba194,0x4ba4d1),'drawConstants':{'selectionHeight':number(0x5cedfc),'iconLeft':number(0x5ccfe0),'iconTop':number(0x5e68b0),'iconSize':number(0x5cee3c),'textLeft':number(0x5cee80),'nameTop':number(0x5c8280),'detailTop':number(0x5cee7c),'durationLeft':number(0x5ceef4)},'nameHelper':source(0x4d8366,0x4d838a),'typeHelper':source(0x4d83b3,0x4d8429),'typeRecordBase':685,'typeLabels':{str(i):strings[685+i] for i in range(5,13)},'durationHelper':source(0x4d849e,0x4d8549),'durationRecordId':624,'durationFormat':strings[624],'durationNativeVectors':vectors,'iconReference':{'format':'%s%.5d.tga','prefix':'data\\ui\\daoju\\','tableField':'0x4c','ownedLookup':'0x43d753','lookupThenTable':'0x411068'},'limits':['Original Part owned record field10 is formatted as ceil(unsigned/1440) days; this is a display decoder, not earned, expiry or repair authority.','Original row pixel size is161x56; responsive page scaling is an explicit Web provider.','Tank row producer is independent and remains outside this Part-row evidence.','Native text/image renderer and framebuffer equivalence not executed.']}
(ROOT/'recovery/output/mend-owned-row-source.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(result['status'],pixel,vectors)
