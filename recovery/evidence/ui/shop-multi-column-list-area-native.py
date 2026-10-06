"""Execute original MultiColumnList render area for source shop rectangles."""
import json, struct, sys
from pathlib import Path
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_EAX,UC_X86_REG_ECX,UC_X86_REG_EIP,UC_X86_REG_ESP
ROOT=Path(__file__).resolve().parents[3]
sys.path.insert(0,str(ROOT/'recovery'))
from effect_native import map_original_binaries
uc,_=map_original_binaries([ROOT/'CDTank/CEGUIWindowsLook.dll'])
uc.mem_map(0x2000000,0x100000)
OBJ,VERT,HORZ,HEADER,STACK,RETURN,OUT=0x2001000,0x2002000,0x2003000,0x2004000,0x2080000,0x2090000,0x2091000
read=lambda a:struct.unpack('<I',uc.mem_read(a,4))[0]
def ints(a,*v):uc.mem_write(a,struct.pack('<'+'I'*len(v),*v))
def floats(a,*v):uc.mem_write(a,struct.pack('<'+'f'*len(v),*v))
def ret(n,value=0):
 sp=uc.reg_read(UC_X86_REG_ESP);uc.reg_write(UC_X86_REG_EAX,value);uc.reg_write(UC_X86_REG_EIP,read(sp));uc.reg_write(UC_X86_REG_ESP,sp+4+n)
ints(0x1003d370,0x2092000);ints(0x1003d36c,0x2092100)
visible={}
def hook(uc,a,size,user):
 if a==0x2092000:floats(uc.reg_read(UC_X86_REG_ECX),0,0,0,0);ret(0,uc.reg_read(UC_X86_REG_ECX))
 elif a==0x2092100:ret(0,int(visible[uc.reg_read(UC_X86_REG_ECX)]))
uc.hook_add(UC_HOOK_CODE,hook)
vectors=[]
for width,height in [(376,279),(192,279)]:
 for v,h in [(False,False),(True,False),(False,True),(True,True)]:
  floats(OBJ+0xe4,0,height,0,width);floats(OBJ+0x498,0,0,0,0);uc.mem_write(OBJ+0x360,b'\0');ints(OBJ+0x328,VERT,HORZ,HEADER)
  floats(VERT+0xe4,0,height,0,8.5);floats(HORZ+0xe4,0,8.5,0,width);visible={VERT:v,HORZ:h}
  ints(STACK,RETURN,OUT);uc.reg_write(UC_X86_REG_ESP,STACK);uc.reg_write(UC_X86_REG_ECX,OBJ);uc.emu_start(0x10019530,RETURN,count=1000)
  rect=list(struct.unpack('<4f',uc.mem_read(OUT,16)));expected=[0,height-(8.5 if h else 0),0,width-(8.5 if v else 0)];assert rect==expected,(rect,expected)
  vectors.append({'width':width,'height':height,'verticalVisible':v,'horizontalVisible':h,'renderArea':rect})
result={'status':'PASS','source':'CEGUIWindowsLook.dll WLMultiColumnList::getListRenderArea 0x10019530','vectors':vectors,'providers':'shop_itempage.xml list376x279/192x279, HeaderVisibleFalse; source empty frames zero inset. Existing scrollbar width/height8.5 explicitly supplied, initial factory dimensions unproven.','limits':['Original row column count/width/draw not executed','Initial scrollbar factory dimensions not established','Font, document extent, framebuffer and event scheduler not restored']}
(ROOT/'recovery/output/shop-multi-column-list-area-native.json').write_text(json.dumps(result,indent=2)+'\n')
print('PASS8 original shop MultiColumnList render area')
