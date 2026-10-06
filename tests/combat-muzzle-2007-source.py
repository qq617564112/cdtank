"""Confirm original2007 item slot, full054 nodes, published textures and GA09."""
import json
from pathlib import Path
import struct
import sys
import wave
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'recovery'))
from inspect_assets import read_table
from effect_sav import read_library
base=ROOT/'recovery/output/verified/assets/data'
web=ROOT/'recovery/output/web-assets'
item=next(r['values'] for r in read_table(ROOT/'CDTank/Data/table/item.dat')['rows'] if int(r['values']['ItemTableID'])==2007)
catalog=json.loads((web/'combat-catalog.json').read_text())
publishedItem=next(i for i in catalog['items'] if i['itemTableId']==2007)
assert item['ItemName']==publishedItem['name']=='燃烧弹'
assert (int(item['Effect1']),item['Sound1'],int(item['EffectTag1']),int(item['EffectMethod1']))==(54,'GA09',0,3)
assert publishedItem['effects'][0]==dict(effectId=54,sound='GA09',tag=0,method=3)
original=read_library((base/'Data/effect/effect.sav').read_bytes())
published=json.loads((web/'effect-library.json').read_text())
nodes=[original['nodes'][i] for i in [3022,3023,3024,3025,3026,3044]]
assert nodes[0]['name']=='_root\\online\\054'
assert nodes[0]['children']==[n['id'] for n in nodes[1:]]
assert [n['type'] for n in nodes]==[0,6,1,1,6,7]
textures=[]
for node in nodes:
 assert node==published['nodes'][node['index']]
 assert not node['children'] or node is nodes[0]
 timing=next(r for r in published['nodeTimings'] if r['node']==node['index'])
 assert (timing['field14c'],timing['delay'],timing['lifetime'])==struct.unpack('<Iff',bytes.fromhex(node['fields']))
 if node is nodes[0]:continue
 grid=next(r for r in published['textureGrids'] if r['node']==node['index'])
 resource=bytes.fromhex(node['resource'])
 assert grid['sourceReference']==resource[:324].split(b'\0')[0].decode('ascii')
 with Image.open(base/grid['source']) as source,Image.open(web/grid['asset']) as output:
  assert source.size==output.size
  assert source.convert('RGBA').tobytes()==output.convert('RGBA').tobytes()
  textures.append(dict(node=node['index'],source=grid['source'],asset=grid['asset'],size=source.size,identicalDecodedRGBA=True))
audio=json.loads((web/'audio.json').read_text())
fire=next(r for r in audio['battleFire'] if r['skillId']==2007)
assert fire['soundId']==50 and fire['asset']=='audio/sound/GA09.wav'
assert (ROOT/'CDTank/Data/sound/GA09.wav').read_bytes()==(web/fire['asset']).read_bytes()
with wave.open(str(web/fire['asset'])) as wav:
 duration=wav.getnframes()/wav.getframerate()
visual=json.loads((ROOT/'recovery/output/role-ammo-visual-native.json').read_text())
assert visual['status']=='PASS'
assert any(r['action'] and r['event'] and r['count']==3 and r['written']==[99]*3 for r in visual['rows'])
out=dict(status='PASS',item=publishedItem,nodes=nodes,textures=textures,sound={**fire,'duration':duration,'identicalWAV':True},
 originalSelector='4661c9 virtual+a4 rewrites all03/attack1 records; existing native proof',
 authority='Explicit rebuilt server selection confirmation; not recovered original server ammo producer')
(ROOT/'recovery/output/combat-muzzle-2007-source.json').write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n')
print('PASS: original2007 Effect54/GA09,054 full six source nodes, five decoded original textures and original WAV')
