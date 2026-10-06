"""Execute only PetMoney column5 copy and original owned-price signed half."""
from pathlib import Path
import json, struct, sys
import pefile
from capstone import Cs, CS_ARCH_X86, CS_MODE_32
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_EAX, UC_X86_REG_EBP, UC_X86_REG_EDI, UC_X86_REG_EIP, UC_X86_REG_ESI, UC_X86_REG_ESP
ROOT=Path(__file__).resolve().parents[3]
sys.path.insert(0,str(ROOT/'recovery'))
from effect_native import map_original_binaries
from inspect_assets import read_table
b=(ROOT/'CDTank/CDTank.exe').read_bytes();pe=pefile.PE(data=b);cs=Cs(CS_ARCH_X86,CS_MODE_32)
def block(start,end):
 o=pe.get_offset_from_rva(start-pe.OPTIONAL_HEADER.ImageBase)
 return [{'va':hex(i.address),'asm':f'{i.mnemonic} {i.op_str}'} for i in cs.disasm(b[o:o+end-start],start)]
table=read_table(ROOT/'CDTank/Data/table/pet.dat');assert table['columns'][5]=='PetMoney'
strings={int(r['values']['ID']):r['values']['String'] for r in read_table(ROOT/'CDTank/Data/table/gamestring.dat')['rows']}
u,_=map_original_binaries([ROOT/'CDTank/CDTank.exe']);u.mem_map(0x2000000,0x10000)
RECORD,VALUE,FRAME,STACK=0x2001000,0x2002000,0x2003000,0x2005000
read=lambda a:struct.unpack('<I',u.mem_read(a,4))[0]
columns=[]
def getter(machine,address,size,data):
 stack=machine.reg_read(UC_X86_REG_ESP)
 columns.append((read(stack+4),read(stack+8)))
 machine.reg_write(UC_X86_REG_EAX,VALUE)
 machine.reg_write(UC_X86_REG_EIP,read(stack))
 machine.reg_write(UC_X86_REG_ESP,stack+12)
u.hook_add(UC_HOOK_CODE,getter,begin=0x4391c4,end=0x4391c4)
rows=[]
for row in table['rows']:
 v=int(row['values']['PetMoney']);columns.clear();u.mem_write(VALUE,struct.pack('<i',v))
 u.reg_write(UC_X86_REG_ESI,RECORD);u.reg_write(UC_X86_REG_EDI,0);u.reg_write(UC_X86_REG_ESP,STACK)
 u.emu_start(0x43a97f,0x43a993,count=30)
 assert columns==[(5,0)] and read(RECORD+0x50)==v
 u.mem_write(FRAME+8,struct.pack('<I',RECORD));u.reg_write(UC_X86_REG_EBP,FRAME)
 u.emu_start(0x4d8ead,0x4d8eb8,count=10)
 half=struct.unpack('<i',struct.pack('<I',u.reg_read(UC_X86_REG_EAX)))[0];assert half==int(v/2)
 rows.append({'petId':int(row['values']['ID']),'petMoney':v,'originalHalf':half})
def normalized_tail(start,end):
 instructions=block(start,end)
 first=next(i for i,item in enumerate(instructions) if item['asm']=='call 0x57dccf')+2
 instructions=instructions[first:]
 addresses={int(item['va'],16):index for index,item in enumerate(instructions)}
 normalized=[]
 for item in instructions:
  mnemonic,_,operand=item['asm'].partition(' ')
  if mnemonic.startswith('j') and operand.startswith('0x') and int(operand,16) in addresses:
   operand='local:'+str(addresses[int(operand,16)])
  normalized.append((mnemonic,operand))
 return normalized
item_tail=normalized_tail(0x4d85e8,0x4d87bb)
pet_tail=normalized_tail(0x4d8e82,0x4d9055)
assert item_tail==pet_tail and len(pet_tail)==124
result={'task':'UI56','status':'PASS_SOURCE_PET_OWNED_PRICE_COLUMN5_SIGNED_HALF',
 'wrapper':block(0x4d9657,0x4d967b),'loader':block(0x43a97f,0x43a993),
 'formatterInput':block(0x4d8ead,0x4d8eb9),'formatterLabels':block(0x4d8eef,0x4d8f66),
 'field':{'table':'PetTable same selected owned+8','column':5,'name':'PetMoney','recordOffset':'+50'},
 'labels':{'81':strings[81],'721':strings[721]},'rows':rows,
 'sameFormatterTail':{'reference':'recovery/output/shop-owned-sale-display-source.json','referenceGetter':'4d85e8','petGetter':'4d8e82','normalizedInstructions':124,'identical':True},
 'originalOutputOrder':'出售价 + two spaces + 金钱 + signed32(PetMoney)/2 toward-zero decimal',
 'scope':'Original named column copy and signed integer half executed for all10 actual PetTable rows; existing full loader reused',
 'limits':['CEGUI final string concatenation/rendering not executed here','Catalog petTypes lacks petMoney; root producer needed','No selling authority or transaction qualification'],
 'productionChanged':False,'chromeStarted':False}
(ROOT/'recovery/output/pet-shop-owned-price-native.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(result['status'],len(rows))
