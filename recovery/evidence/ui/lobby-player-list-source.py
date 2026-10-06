"""Execute original list render area and row size with source layout providers."""
import json,struct,sys
from pathlib import Path
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_EAX,UC_X86_REG_ECX,UC_X86_REG_EIP,UC_X86_REG_ESP
ROOT=Path(__file__).resolve().parents[3];sys.path.insert(0,str(ROOT/'recovery'))
from effect_native import map_original_binaries
BASE,OBJ,VERT,HORZ,STACK,RETURN,OUT=0x2000000,0x2001000,0x2002000,0x2003000,0x2080000,0x2090000,0x2091000
uc,_=map_original_binaries([ROOT/'CDTank/CEGUIWindowsLook.dll']);uc.mem_map(BASE,0x100000)
def ints(a,*v):uc.mem_write(a,struct.pack('<'+'I'*len(v),*v))
def floats(a,*v):uc.mem_write(a,struct.pack('<'+'f'*len(v),*v))
def read(a):return struct.unpack('<I',uc.mem_read(a,4))[0]
def ret(n,value=0):
 sp=uc.reg_read(UC_X86_REG_ESP);uc.reg_write(UC_X86_REG_EAX,value);uc.reg_write(UC_X86_REG_EIP,read(sp));uc.reg_write(UC_X86_REG_ESP,sp+4+n)
ints(0x1003d370,0x2092000);ints(0x1003d36c,0x2092100)
visible={}
def hook(uc,a,size,user):
 if a==0x2092000:floats(uc.reg_read(UC_X86_REG_ECX),0,0,0,0);ret(0,uc.reg_read(UC_X86_REG_ECX))
 elif a==0x2092100:ret(0,int(visible[uc.reg_read(UC_X86_REG_ECX)]))
uc.hook_add(UC_HOOK_CODE,hook);rows=[]
for v,h in [(False,False),(True,False),(False,True),(True,True)]:
 floats(OBJ+0xe4,0,420,0,170);floats(OBJ+0x47c,0,0,0,0);ints(OBJ+0x32c,VERT,HORZ);floats(VERT+0xe4,0,420,0,8.5);floats(HORZ+0xe4,0,8.5,0,170);visible={VERT:v,HORZ:h};ints(STACK,RETURN,OUT);uc.reg_write(UC_X86_REG_ESP,STACK);uc.reg_write(UC_X86_REG_ECX,OBJ);uc.emu_start(0x1000ffd0,RETURN,count=1000);r=list(struct.unpack('<4f',uc.mem_read(OUT,16)));assert r==[0,420-(8.5 if h else 0),0,170-(8.5 if v else 0)];rows.append({'vertical':v,'horizontal':h,'renderArea':r})
ui=json.loads((ROOT/'recovery/output/web-assets/ui.json').read_text());layout=next(l for l in ui['layouts']if l['path'].endswith('/playerlist.xml'));c=next(c for c in layout['windows']if c['name']=='PlayerList');assert all(c['properties'].get(n+'FrameImage','')=='' for n in ['Top','Bottom','Left','Right','TopLeft','TopRight','BottomLeft','BottomRight'])
ref=c['properties']['SelectionImage'];sn,name=ref[4:].split(' image:');sets=[s for s in ui['imagesets']if s['attributes']['Name']==sn];s=next((s for s in sets if 'imagesets_dds/'in s['path']),sets[0]);image=next(i for i in s['images']if i['Name']==name)
result={'status':'PASS','control':c,'screenRectangle':[619,155,789,575],'selectionImage':image,'renderAreaVectors':rows,'originalConsumers':{'renderArea':'WLListbox::getListRenderArea 0x1000ffd0','font':'ListboxTextItem::getFont 0x1006b0c0 explicit font / owner Window / System default','size':'ListboxTextItem::getPixelSize 0x1006b110 uses rounded Font lineSpacing and extent','draw':'ListboxTextItem::draw 0x1006b210 selection flag+image gates Image::draw; Font text format LeftAligned0'},'scope':'Original render area executed; XML no frames means zero source insets; renderer/scrollbar visibility and dimensions providers. Font and selected item draw branches directly inspected, not executed. Current row14, white text, TTF raster and browser scrollbar are explicit Web projection.'}
(ROOT/'recovery/output/lobby-player-list-source.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');print('PASS4 original list area / source selection image')
