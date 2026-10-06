"""Execute original renderer display storage, System fanout and absolute ID layout."""
from pathlib import Path
import json
import pefile
ROOT=Path(__file__).resolve().parents[3]
s=(ROOT/'recovery/evidence/ui/room-card-id-font-scale-native.py').read_text();exec(s[:s.index('rows=[]')])
# GameBoxRenderer shares the DLL preferred base; relocate its original image.
pe=pefile.PE(str(ROOT/'CDTank/GameBoxRenderer.dll'));pe.relocate_image(0x11000000);blob=pe.get_memory_mapped_image();u.mem_map(0x11000000,(len(blob)+4095)&~4095);u.mem_write(0x11000000,blob)
SYSTEM,RENDER,RVT,FM,FH,FN,IM,IH,IN,WINDOW,WVT,EVENT,ROOTWIN= [0x2030000+i*0x1000 for i in range(13)]
u.mem_map(0x2100000,0x300000)
exports={x.name:0x10000000+x.address for x in pefile.PE(str(ROOT/'CDTank/CEGUIBase.dll')).DIRECTORY_ENTRY_EXPORT.symbols if x.name}
w(0x11004010,exports[b'??9Size@CEGUI@@QBE_NABV01@@Z']);w(0x11004028,0x1002ce10);w(0x11004150,0x209a000)
w(0x10197ca8,SYSTEM);w(SYSTEM+0x18,RENDER);w(RENDER,RVT);w(RVT+0x48,0x11001140);w(RVT+0x14,0x209a100)
w(0x10197c8c,FM);w(0x10197c94,IM)
for manager,head,node,value in [(FM,FH,FN,FONT),(IM,IH,IN,SET)]:
 w(manager+4,head);w(head,node,node,node);u.mem_write(head+0xa9,b'\1');w(node,head,head,head);w(node+0xa4,value);u.mem_write(node+0xa9,b'\0')
w(WINDOW,WVT);w(WVT+0x7c,0x10033f40);w(WINDOW+0x10,WVT);w(WVT+0x14,0x209a200);w(WINDOW+0x34,1);w(WINDOW+0x3c,ROOTWIN);w(SYSTEM+0x2c,WINDOW)
viewport=[800,600];events=[]
def pairing_hook(machine,a,size,data):
 sp=machine.reg_read(UC_X86_REG_ESP)
 if a==0x209a000:
  p=r(sp+4);w(p,0,0,*viewport,0,0);ret(4)
 elif a==0x209a100:events.append({'event':'renderer DisplaySizeChanged','rendererSize':[f(RENDER+0x28),f(RENDER+0x20)]});ret(12,1)
 elif a==0x209a200:events.append({'event':'Window ParentSized','absolute':[f(WINDOW+0xe4+4*i)for i in range(4)],'relative':[f(WINDOW+0xf4+4*i)for i in range(4)]});ret(12,1)
u.hook_add(UC_HOOK_CODE,pairing_hook)
rows=[]
for width,height in [(800,600),(1920,1080),(3840,2160)]:
 viewport[:]=[width,height];events.clear();fs(RENDER+0x1c,0,600,0,800)
 # Initialize the already verified original glyph/image map fixture at baseline.
 u.mem_write(SET,bytes(0x200));u.mem_write(HEADER,bytes(0x200));u.mem_write(FONT,bytes(0x200))
 w(FONT+4,HEAD);fs(FONT+0xbc,14);w(HEAD,NODE);w(FONT+0xa8,VECTOR);w(FONT+0xac,VECTOR+4);w(VECTOR,SET);fs(FONT+0x174,800,600);u.mem_write(FONT+0x168,b'\1');u.mem_write(SET+0xa8,b'\1');fs(SET+0xb4,800,600);w(SET+0x9c,HEADER)
 nodes=[INODES+i*0x300 for i in range(10)];w(HEADER,nodes[0],nodes[0],nodes[-1]);u.mem_write(HEADER+0x16d,b'\1')
 for i,g in enumerate(source['glyphs']):
  node=nodes[i];u.mem_write(node,bytes(0x300));w(node,HEADER,nodes[i-1]if i else HEADER,nodes[i+1]if i+1<10 else HEADER)
  image=node+0xa4;fs(image+8,0,g['height'],0,g['width']);fs(image+0x18,0,0)
  fontnode=NODE+i*0x100;w(fontnode+0x10,image,g['width'],g['width']);u.mem_write(fontnode+0x1c,b'\1');glyphs[g['codepoint']]=(fontnode,image,g)
 fs(WINDOW+0xe4,8,25,-1,31);fs(ROOTWIN+0xe4,0,120,0,120)
 invoke(0x11001c50,obj=RENDER)
 assert [f(RENDER+0x28),f(RENDER+0x20)]==viewport
 # Actual renderer event dispatcher is the explicit callback bridge provider.
 invoke(0x1002c5a0,[EVENT],obj=SYSTEM)
 absolute=[f(WINDOW+0xe4+4*i)for i in range(4)];assert absolute==[8,25,-1,31]
 assert invoke(0x10031ae0,[1],obj=WINDOW,float_result=True)==17
 assert any(e['event']=='Window ParentSized'for e in events)
 rows.append({'viewportProvider':list(viewport),'rendererSize':[f(RENDER+0x28),f(RENDER+0x20)],'fontFactors':[f(FONT+0x16c),f(FONT+0x170)],'digit1Size':[f(glyphs[49][1]+0x20),f(glyphs[49][1]+0x24)],'lineSpacing':f(FONT+0xbc),'absoluteIDRect':absolute,'height':17,'events':list(events)})
result={'status':'PASS','rows':rows,'entries':{'rendererPostReset':'GameBoxRenderer.dll relocated0x11001c50/preferred0x10001c50','rendererSetDisplay':'0x11001480','rendererGetSize':'0x11001140','systemHandler':'0x1002c5a0','fontManagerNotify':'0x10014c80','imagesetManagerNotify':'0x1001a680','windowParentSized':'0x10033f40','windowGetHeight':'0x10031ae0'},'scope':'Original renderer integer viewport-to-display storage, original System renderer getSize, actual manager map traversals and full static font/image notify consumers, full Window onParentSized Absolute branch and getHeight. gbGfx viewport values, renderer event callback bridge and Window event dispatcher are explicit providers. Supported source XML ID Absolute rectangle/parent120 bounds supplied; app live layout overrides and real D3D viewport upstream remain unproven.'}
(ROOT/'recovery/output/room-card-id-display-pairing-native.json').write_text(json.dumps(result,indent=2)+'\n');print('PASS: three original renderer/System/manager/Absolute Window display pairing vectors')
