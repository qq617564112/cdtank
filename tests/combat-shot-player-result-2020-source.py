"""Check original2020/4018 victim effect029 resources and SE23 publication."""
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
item=next(r['values'] for r in read_table(ROOT/'CDTank/Data/table/item.dat')['rows'] if int(r['values']['ItemTableID'])==2020)
skill=next(r['values'] for r in read_table(ROOT/'CDTank/Data/table/skill.dat')['rows'] if int(r['values']['SkillTableID'])==4018)
published_item=next(r for r in catalog['items'] if r['itemTableId']==2020)
published_skill=next(r for r in catalog['skills'] if r['skillId']==4018)
assert published_item['skillIds']==[2020,4018,0]
assert int(skill['TriggerType'])==published_skill['triggerType']==8
assert (int(skill['Effect1']),skill['Sound1'],int(skill['EffectTag1']),int(skill['EffectMethod1']))==(29,'SE23',0,3)
assert published_skill['effects'][0]==dict(effectId=29,sound='SE23',tag=0,method=3)
original=read_library((base/'Data/effect/effect.sav').read_bytes())
published=json.loads((web/'effect-library.json').read_text())
by_id={n['id']:n for n in original['nodes']}
root=next(n for n in original['nodes']if n['name']=='_root\\online\\029')
nodes=[]
def collect(node):
 nodes.append(node)
 for child in node['children']:collect(by_id[child])
collect(root)
assert [n['index']for n in nodes]==[2623,2624,2717,2813,2881]
textures=[]
for node in nodes:
 assert node==published['nodes'][node['index']]
 timing=next(r for r in published['nodeTimings'] if r['node']==node['index'])
 assert (timing['field14c'],timing['delay'],timing['lifetime'])==struct.unpack('<Iff',bytes.fromhex(node['fields']))
 if node['type'] not in [1,6,7]:continue
 grid=next(r for r in published['textureGrids'] if r['node']==node['index'])
 with Image.open(base/grid['source']) as source,Image.open(web/grid['asset']) as output:
  assert source.size==output.size
  assert source.convert('RGBA').tobytes()==output.convert('RGBA').tobytes()
  textures.append(dict(node=node['index'],source=grid['source'],asset=grid['asset'],size=source.size,identicalDecodedRGBA=True))
audio=json.loads((web/'audio.json').read_text())
sound=next(r for r in audio['sounds'] if r['name']=='SE23')
assert (ROOT/'CDTank/Data/sound/SE23.wav').read_bytes()==(web/sound['asset']).read_bytes()
with wave.open(str(web/sound['asset'])) as wav:duration=wav.getnframes()/wav.getframerate()
assert all(next(t for t in published['nodeTimings'] if t['node']==n['index'])['lifetime']>0 for n in nodes if n['type'] in [1,6,7])
assert not [r for r in published['soundControls'] if r['node'] in [n['index'] for n in nodes]]
out=dict(status='PASS_SOURCE_ONLY',item=published_item,skill=published_skill,nodes=nodes,textures=textures,
 sound=dict(name='SE23',asset=sound['asset'],duration=duration,identicalWAV=True),
 scope='Original item/skill table and effect.sav full029 nodes/fields/control records, exact original textures and WAV. Established424614/4886aa Trigger8 nonretained terminal reused; no ordinary hit or pixels/audio output claim.')
(ROOT/'recovery/output/combat-shot-player-result-2020-source.json').write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n')
print('PASS_SOURCE_ONLY: original2020/4018 Trigger8/029, full5nodes, original玫瑰/particle textures, spatialSE23 resource')
