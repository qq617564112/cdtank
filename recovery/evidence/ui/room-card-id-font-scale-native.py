"""Execute MediumHT Font notify, image autoscale, integer advances and vertical metrics."""
from pathlib import Path
import json
import math
ROOT = Path(__file__).resolve().parents[3]
base = (ROOT/'recovery/evidence/ui/room-card-id-font-native.py').read_text().split('# Execute static metrics scan')[0]
# Execute original CRT ftol; preserve the native1 map/text fixture providers.
start=base.index(' elif a==0x100fddb8:');end=base.index(' elif a==0x1000d250:',start)
exec(base[:start]+base[end:])
SET,HEADER,INODES,SIZE,VECTOR=0x2020000,0x2021000,0x2022000,0x2026000,0x2027000
rows=[]
for scale,auto in [(1,True),(1.8,True),(3,True),(1.07,True),(1.07,False),(3.6,True),(752/615,True),(920/321,True)]:
 u.mem_write(SET,bytes(0x200));u.mem_write(HEADER,bytes(0x200));u.mem_write(FONT,bytes(0x200))
 w(FONT+4,HEAD);fs(FONT+0xbc,14);w(HEAD,NODE);w(FONT+0xa8,VECTOR);w(FONT+0xac,VECTOR+4);w(VECTOR,SET)
 fs(FONT+0x174,800,600);u.mem_write(FONT+0x168,bytes([auto]));u.mem_write(SET+0xa8,b'\1');fs(SET+0xb4,800,600);w(SET+0x9c,HEADER)
 nodes=[INODES+i*0x300 for i in range(10)];w(HEADER,nodes[0],nodes[0],nodes[-1]);u.mem_write(HEADER+0x16d,b'\1')
 for i,g in enumerate(source['glyphs']):
  node=nodes[i];u.mem_write(node,bytes(0x300));w(node,HEADER,nodes[i-1]if i else HEADER,nodes[i+1]if i+1<10 else HEADER)
  image=node+0xa4;fs(image+8,0,g['height'],0,g['width']);fs(image+0x18,0,0)
  fontnode=NODE+i*0x100;w(fontnode+0x10,image,g['width'],g['width']);u.mem_write(fontnode+0x1c,b'\1');glyphs[g['codepoint']]=(fontnode,image,g)
 fs(SIZE,800*scale,600*scale)
 invoke(0x10012190,[SIZE])
 factors=[f(FONT+0x16c),f(FONT+0x170)];imagescale=[f(SET+0xac),f(SET+0xb0)]
 vectors=[]
 for cp,(node,image,g)in glyphs.items():
  values=[f(image+0x20),f(image+0x24),f(image+0x28),f(image+0x2c)];advance=r(node+0x14)
  expected=math.trunc(g['width']*(factors[0] if auto else 1));assert advance==expected,(scale,cp,advance,expected)
  vectors.append({'codepoint':cp,'asset':g['asset'],'nativeWidth':g['width'],'imageSize':values[:2],'advance':advance,'offset':values[2:]})
 assert f(FONT+0xc0)==0
 assert abs(f(FONT+0xbc)-(vectors[0]['imageSize'][1]*factors[1] if auto else 14))<.0001,(scale,auto,f(FONT+0xbc),vectors[0]['imageSize'],factors)
 texts=[]
 for text in ['R1','R10','R123','R9999']:
  lookup.clear();draws.clear();w(TEXT,len(text),32);w(TEXT+0x14,*map(ord,text));fs(POSITION,0,0,0)
  extent=invoke(0x10011130,[TEXT,0x3f800000],float_result=True);invoke(0x10011440,[TEXT,POSITION,CLIP,COLOUR,0x3f800000,0x3f800000])
  advance=0;expected=0
  for c in text:
   if not c.isdigit():continue
   node,image,g=glyphs[ord(c)];expected=max(expected,advance+f(image+0x20));advance+=r(node+0x14)
  expected=max(expected,advance);assert extent==expected,(scale,text,extent,expected)
  assert [d['codepoint']for d in draws]==[ord(c)for c in text if c.isdigit()]
  for d in draws:
   v=next(v for v in vectors if v['codepoint']==d['codepoint']);assert d['rect'][2]-d['rect'][0]==v['imageSize'][0];assert d['rect'][3]-d['rect'][1]==v['imageSize'][1]
  texts.append({'text':text,'extent':extent,'draws':list(draws)})
 rows.append({'scaleProvider':scale,'displayProvider':[800*scale,600*scale],'fontAutoScaled':auto,'fontFactors':factors,'imageFactors':imagescale,'glyphs':vectors,'lineSpacing':f(FONT+0xbc),'baseline':f(FONT+0xc0),'texts':texts})
centres=[]
for height,line in [(17,14),(30.6,45),(51,126),(17,18),(17,16),(17,17),(17,17.99),(17,16.01)]:
 fs(STACK+0xc,line,0,height);u.reg_write(UC_X86_REG_ESP,STACK)
 u.emu_start(0x100b0f2c,0x100b0fdf,count=10000)
 top=f(STACK+0x10);expected=math.floor((height-line)/2+.5)if height>=line else -math.floor((line-height)/2+.5)
 assert top==expected,(height,line,top,expected)
 centres.append({'heightProvider':height,'lineSpacingProvider':line,'top':top})
result={'status':'PASS','entries':{'fontNotify':'0x10012190','fontUpdate':'0x10011910','metrics':'0x1000ddd0','imagesetNotify':'0x10018de0','imagesetUpdate':'0x10018d40','extent':'0x10011130','drawLine':'0x10011440','crtFtol':'0x100fddb8'},'vectors':rows,'centering':{'entry':'0x100b0f2c..0x100b0fdf','vectors':centres},'scope':'Full original Font notify calls original imageset notify and image integer round, then original static advance and vertical metric update. Original CRT ftol executes. Font/image map fixtures and explicit Web sourceViewport supply data; renderer GPU and System display producer remain providers.'}
(ROOT/'recovery/output/room-card-id-font-scale-native.json').write_text(json.dumps(result,indent=2)+'\n');print('PASS',len(rows),'notify/AutoScaled/advance/metrics and 24 extent/draw vectors')
