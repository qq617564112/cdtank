"""Verify recorded ordinary map05 retained particle draws and cleanup."""
import json
import math
from pathlib import Path
import struct
import sys
run=json.loads(Path(sys.argv[1]).read_text())
source=json.loads(Path('recovery/output/scene-effect05-042-source.json').read_text())
assert run['status']==source['status']=='PASS'
assert all(w['mode']==1 and w['mapId']==5 and len(w['players'])==4 for w in run['initial'])
placements={r['id']:r for r in source['placements']}
common=run['commonPlacementId']
f32=lambda value:struct.unpack('<f',struct.pack('<f',value))[0]
rows=[]
for page_index,page in enumerate(run['observed']):
 assert len(page['spawns'])==4
 for spawn in page['spawns']:
  placement=placements[spawn['id']]
  assert spawn['name']==placement['name'] and spawn['matrix']==placement['matrix'] and spawn['handle']>0
 node_rows=[]
 for node,texture,uv in [(2454,'yan1.png',[0,0,1,1]),(2797,'a.png',[0,0,.5,.5])]:
  draws=[d for d in page['draws'] if d['id']==common and d['node']==node]
  assert len(draws)>=2 and len({json.dumps(d['positions']) for d in draws})>=2
  max_error=0
  for draw in draws:
   assert draw['matrix']==placements[common]['matrix']
   assert draw['textures'] and all(t.endswith('/Data/effect/effect/'+texture) for t in draw['textures'])
   particles=draw['particles'];assert 0<len(particles)<=100
   assert len(draw['positions'])==len(particles)*18 and len(draw['colors'])==len(particles)*24
   expected_uv=[uv[0],uv[1],uv[2],uv[1],uv[0],uv[3],uv[0],uv[3],uv[2],uv[1],uv[2],uv[3]]
   for index,particle in enumerate(particles):
    pos=draw['positions'][index*18:(index+1)*18]
    centre=[sum(pos[axis::3])/6 for axis in range(3)]
    expected=[-particle['position'][0],*particle['position'][1:]]
    error=max(abs(a-b) for a,b in zip(centre,expected));max_error=max(max_error,error)
    assert error<.001
    # Scalar half-size preserves the square diagonal under camera rotation.
    assert abs(math.dist(pos[:3],pos[6:9])-2*particle['scale'])<.002
    colors=draw['colors'][index*24:(index+1)*24]
    quantized=[(math.trunc(f32(c)*255)&255)/255 for c in particle['color']]
    assert all(abs(colors[v*4+c]-quantized[c])<1e-7 for v in range(6) for c in range(4))
    assert draw['uvs'][index*12:(index+1)*12]==expected_uv
  node_rows.append(dict(node=node,drawSamples=len(draws),maxCentreError=max_error))
 capture=page['captures'][common]
 assert {d['node'] for d in capture['draws']}=={2454,2797}
 rows.append(dict(page=page_index+1,sourcePlacementId=common,nodes=node_rows,captureFrame=capture['frame']))
for states in [run['leave'],run['finalLeave']]:
 assert all(s==dict(instances=0,handles=0,meshes=0) for s in states)
for states in [run['loaded'],run['active'],run['reentry']]:
 assert all(len(s['instances'])==len(s['handles'])==4 for s in states)
 for state in states:
  for instance in state['instances']:
   assert instance['matrix']==placements[instance['id']]['matrix']
   assert all(node['retain'] for node in instance['nodes'])
for page in run['finalObserved']:
 assert len(page['spawns'])==8 and len(page['releases'])==8
 assert sorted(page['releases'])==sorted(spawn['handle'] for spawn in page['spawns'])
result=dict(status='PASS',input=sys.argv[1],rows=rows,ownedTrees=4,leaveAndFinalCounts=0,
            scope='Ordinary dual source213 two type6 meshes actually drawn with original texture/UV/particle centres/scales/packed colors and changing geometry; four retained placement owners and Leave/reentry/release')
Path('recovery/output/scene-effect05-042-actual.json').write_text(json.dumps(result,indent=2)+'\n')
print('PASS: map05 dual042 source particle actual draw/material/geometry and four retained owners/cleanup')
