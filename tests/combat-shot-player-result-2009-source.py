"""Check original2009/4007 victim effect011 resources and GA15 publication."""
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
catalog=json.loads((web/'combat-catalog.json').read_text())
item=next(r['values'] for r in read_table(ROOT/'CDTank/Data/table/item.dat')['rows'] if int(r['values']['ItemTableID'])==2009)
skill=next(r['values'] for r in read_table(ROOT/'CDTank/Data/table/skill.dat')['rows'] if int(r['values']['SkillTableID'])==4007)
published_item=next(r for r in catalog['items'] if r['itemTableId']==2009)
published_skill=next(r for r in catalog['skills'] if r['skillId']==4007)
assert published_item['skillIds']==[2009,4007,0]
assert int(skill['TriggerType'])==published_skill['triggerType']==8
assert int(skill['Target'])==published_skill['target']==5
assert (int(skill['Effect1']),skill['Sound1'],int(skill['EffectTag1']),int(skill['EffectMethod1']))==(11,'GA15',0,3)
assert published_skill['effects'][0]==dict(effectId=11,sound='GA15',tag=0,method=3)
original=read_library((base/'Data/effect/effect.sav').read_bytes())
published=json.loads((web/'effect-library.json').read_text())
nodes=[original['nodes'][i] for i in [2637,2643,2663,2664,2665,2666,2667,2830,2834]]
assert nodes[0]['name']=='_root\\online\\011'
assert set(i for n in nodes for i in n['children'])=={n['id'] for n in nodes[1:]} 
assert [n['type'] for n in nodes]==[0,0,0,1,1,0,1,6,6]
textures=[]
for node in nodes:
 assert node==published['nodes'][node['index']]
 assert all(i in {n['id'] for n in nodes} for i in node['children'])
 timing=next(r for r in published['nodeTimings'] if r['node']==node['index'])
 assert (timing['field14c'],timing['delay'],timing['lifetime'])==struct.unpack('<Iff',bytes.fromhex(node['fields']))
 if node['type']==0:continue
 grid=next(r for r in published['textureGrids'] if r['node']==node['index'])
 with Image.open(base/grid['source']) as source,Image.open(web/grid['asset']) as output:
  assert source.size==output.size
  assert source.convert('RGBA').tobytes()==output.convert('RGBA').tobytes()
  textures.append(dict(node=node['index'],source=grid['source'],asset=grid['asset'],size=source.size,identicalDecodedRGBA=True))
audio=json.loads((web/'audio.json').read_text())
sound=next(r for r in audio['sounds'] if r['name']=='GA15')
assert (ROOT/'CDTank/Data/sound/GA15.wav').read_bytes()==(web/sound['asset']).read_bytes()
with wave.open(str(web/sound['asset'])) as wav:duration=wav.getnframes()/wav.getframerate()
assert [next(t for t in published['nodeTimings'] if t['node']==n['index'])['lifetime'] for n in nodes if n['type']!=0]==[0.30000001192092896,0.3500000238418579,0.800000011920929,2.3299999237060547,.5]
out=dict(status='PASS_SOURCE_ONLY',item=published_item,skill=published_skill,nodes=nodes,textures=textures,
 sound=dict(name='GA15',asset=sound['asset'],duration=duration,identicalWAV=True),
 scope='Original item/skill table and effect.sav full011 nodes/fields/control records, exact original textures and WAV. Original dispatch terminal separately executed; no ordinary hit or pixels/audio output claim.')
(ROOT/'recovery/output/combat-shot-player-result-2009-source.json').write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n')
print('PASS_SOURCE_ONLY: original2009/4007 Trigger8/011, full9nodes, original rings/symbol/particle textures, spatialGA15 resource')
