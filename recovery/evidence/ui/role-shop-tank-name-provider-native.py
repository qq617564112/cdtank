"""Original Tank ID/name loader and Shop row name getter identity."""
import json,struct,sys
from pathlib import Path
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_EAX,UC_X86_REG_EIP,UC_X86_REG_ESP
import pefile,capstone
ROOT=Path(__file__).resolve().parents[3];sys.path.insert(0,str(ROOT/'recovery'))
from effect_native import map_original_binaries
proof=json.loads((ROOT/'recovery/output/role-tank-base-native.json').read_text());assert proof['status']=='PASS'
p=pefile.PE(str(ROOT/'CDTank/CDTank.exe'));base=p.OPTIONAL_HEADER.ImageBase;c=capstone.Cs(capstone.CS_ARCH_X86,capstone.CS_MODE_32)
def trace(a,z):return [{'va':hex(i.address),'asm':i.mnemonic+' '+i.op_str} for i in c.disasm(p.get_data(a-base,z-a),a)]
u,_=map_original_binaries([ROOT/'CDTank/CDTank.exe']);u.mem_map(0x2000000,0x10000)
RECORD,OUTPUT,STACK,RETURN=0x2001000,0x2002000,0x2008000,0x2009000
captured=[]
def copy_boundary(machine,address,size,data):
 stack=machine.reg_read(UC_X86_REG_ESP);returnAddress,source,length,output=struct.unpack('<4I',machine.mem_read(stack,16))
 assert output==OUTPUT;assert source==RECORD+0x14
 captured.append(bytes(machine.mem_read(source,length)))
 machine.reg_write(UC_X86_REG_EAX,output);machine.reg_write(UC_X86_REG_EIP,returnAddress);machine.reg_write(UC_X86_REG_ESP,stack+4)
u.hook_add(UC_HOOK_CODE,copy_boundary,begin=0x412649,end=0x412649)
rows=[]
for row in proof['rows']:
 v=row['values'];assert row['result']['id']==int(v['ID']);assert row['strings']['16']==v['TankName'];assert row['columns'][0:2]==[[0,0],[1,5]]
 text=v['TankName'].encode('gb18030');assert len(text)<16
 u.mem_write(RECORD,bytes(0x80));u.mem_write(RECORD+0xc,struct.pack('<I',int(v['ID'])));u.mem_write(RECORD+0x14,text+b'\0');u.mem_write(RECORD+0x24,struct.pack('<II',len(text),15));u.mem_write(STACK,struct.pack('<III',RETURN,RECORD,OUTPUT));captured.clear();u.reg_write(UC_X86_REG_ESP,STACK)
 u.emu_start(0x4d7e58,RETURN,count=100)
 assert captured==[text];assert u.reg_read(UC_X86_REG_ESP)==STACK+4
 rows.append({'tankId':int(v['ID']),'name':v['TankName'],'loaderStoredId':row['result']['id'],'loaderNameStringObject':'record+0x10','getterTextBuffer':'record+0x14','nativeNameBytes':list(captured[0])})
r={'status':'PASS_SOURCE_TANK_ID_NAME_SHOP_GETTER_IDENTITY','tasks':['UI57','M5-10'],'loader':'43b62a','loaderIdNameTrace':trace(0x43b62a,0x43b65b),'existingCompleteLoaderProof':'recovery/output/role-tank-base-native.json','nameStringLayout':'stdstring object atrecord+10, inlinebuffer atrecord+14, length+24/capacity+28. +14 is textbuffer, not distinctTankNamefield offset.','getter':'4d7e58','getterTrace':trace(0x4d7e58,0x4d7e7c),'productCaller':'4b5da5 passes looked-up TankTable record to4d7e58;4b5dfb passesrecord+c to4bbd0a icon constructor','rows':rows,'formalProvider':'apps/server/src/accounts/tank-shop-catalog.ts reads sameTankTable.ID/TankName into product.tankId/name','boundary':'Reuse savedcompleteTankloader; execute originalnamegetter to412649 text-copy service boundary, suppliedC++stringstorage with actualGB18030names. No originalfontpixels/availability/purchaseauthority claim.','productionChanged':False,'chromeStarted':False}
(ROOT/'recovery/output/role-shop-tank-name-provider-native.json').write_text(json.dumps(r,ensure_ascii=False,indent=2)+'\n');print(f'PASS {len(rows)} originalTank ID/name rows and nativeShop namegetter')
