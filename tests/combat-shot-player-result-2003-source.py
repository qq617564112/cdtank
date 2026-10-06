"""Check original2003/4022 victim effect009 resources and SE32 publication."""
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
item=next(r['values'] for r in read_table(ROOT/'CDTank/Data/table/item.dat')['rows'] if int(r['values']['ItemTableID'])==2003)
skill=next(r['values'] for r in read_table(ROOT/'CDTank/Data/table/skill.dat')['rows'] if int(r['values']['SkillTableID'])==4022)
published_item=next(r for r in catalog['items'] if r['itemTableId']==2003)
published_skill=next(r for r in catalog['skills'] if r['skillId']==4022)
assert published_item['skillIds']==[2003,4022,0]
assert int(skill['TriggerType'])==published_skill['triggerType']==8
assert (int(skill['Effect1']),skill['Sound1'],int(skill['EffectTag1']),int(skill['EffectMethod1']))==(9,'SE32',0,3)
assert published_skill['effects'][0]==dict(effectId=9,sound='SE32',tag=0,method=3)
original=read_library((base/'Data/effect/effect.sav').read_bytes())
published=json.loads((web/'effect-library.json').read_text())
nodes=[original['nodes'][i] for i in [3047,3048,3049,3050,3051,3052]]
assert nodes[0]['name']=='_root\\online\\009'
assert nodes[0]['children']==[n['id'] for n in nodes[1:]]
assert [n['type'] for n in nodes]==[0,1,6,7,6,7]
textures=[]
for node in nodes:
 assert node==published['nodes'][node['index']]
 assert not node['children'] or node is nodes[0]
 timing=next(r for r in published['nodeTimings'] if r['node']==node['index'])
 assert (timing['field14c'],timing['delay'],timing['lifetime'])==struct.unpack('<Iff',bytes.fromhex(node['fields']))
 if node is nodes[0]:continue
 grid=next(r for r in published['textureGrids'] if r['node']==node['index'])
 with Image.open(base/grid['source']) as source,Image.open(web/grid['asset']) as output:
  assert source.size==output.size
  assert source.convert('RGBA').tobytes()==output.convert('RGBA').tobytes()
  textures.append(dict(node=node['index'],source=grid['source'],asset=grid['asset'],size=source.size,identicalDecodedRGBA=True))
audio=json.loads((web/'audio.json').read_text())
sound=next(r for r in audio['sounds'] if r['name']=='SE32')
assert (ROOT/'CDTank/Data/sound/SE32.wav').read_bytes()==(web/sound['asset']).read_bytes()
with wave.open(str(web/sound['asset'])) as wav:duration=wav.getnframes()/wav.getframerate()
assert all(next(t for t in published['nodeTimings'] if t['node']==n['index'])['lifetime']>0 for n in nodes[1:])
out=dict(status='PASS_SOURCE_ONLY',item=published_item,skill=published_skill,nodes=nodes,textures=textures,
 sound=dict(name='SE32',asset=sound['asset'],duration=duration,identicalWAV=True),
 scope='Original item/skill table and effect.sav full009 nodes/fields/control records, exact original textures and WAV. Original dispatch terminal separately executed; no ordinary hit or pixels/audio output claim.')
(ROOT/'recovery/output/combat-shot-player-result-2003-source.json').write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n')
print('PASS_SOURCE_ONLY: original2003/4022 Trigger8/009, full6nodes, original explosion/fire/strip textures, spatialSE32 resource')
