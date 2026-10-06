"""Check original terrain packed colour/UV inputs against published GLB."""
import json,struct,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'recovery'))
from pol import read_pol
map_id=int(sys.argv[1]) if len(sys.argv)>1 else 2
map_name=f'{map_id:04d}'
source=ROOT/'recovery/output/verified/assets/data'
pol=read_pol(source/f'Data/map/{map_name}/{map_name}.POL')
b=(ROOT/f'recovery/output/web-assets/Data/map/{map_name}/{map_name}.glb').read_bytes();n=struct.unpack_from('<I',b,12)[0];glb=json.loads(b[20:20+n]);start=28+n
parts={mesh['name']:mesh['primitives'][0] for mesh in glb['meshes']}
def values(accessor):
 a=glb['accessors'][accessor];v=glb['bufferViews'][a['bufferView']];count=a['count']*{'VEC2':2,'VEC4':4}[a['type']]
 return struct.unpack_from('<'+'f'*count,b,start+v.get('byteOffset',0)+a.get('byteOffset',0))
vertices=0;different=0;material_factors=[];material_mismatches=[]
library_path=ROOT/f'recovery/output/web-assets/scene-terrain-material-{map_name}.json'
withheld={part['mesh'] for part in json.loads(library_path.read_text()).get('withheldParts',[])} if library_path.exists() else set()
for mesh in pol['meshes']:
 for i,part in enumerate(mesh['parts']):
  primitive=parts[f"{mesh['name']}/{i}"];colors=values(primitive['attributes']['COLOR_0']);uv=values(primitive['attributes']['TEXCOORD_0'])
  for k,index in enumerate([index for face in part['faces'] for index in face]):
   raw=mesh['vertices'][index];bb,g,r,a=raw[12:16]
   expected=[struct.unpack('<f',struct.pack('<f',x/255))[0] for x in (r,g,bb,a)]
   assert list(colors[k*4:k*4+4])==expected
   assert uv[k*2:k*2+2]==struct.unpack_from('<2f',raw,16)
   vertices+=1;different+=expected[:3]!=[1,1,1]
  factor=glb['materials'][primitive['material']]['pbrMetallicRoughness']['baseColorFactor']
  expected_factor=list(part['properties'][:4])
  if factor!=expected_factor:
   name=f"{mesh['name']}/{i}"
   assert name in withheld, f'Published material factor differs for textured consumer {name}'
   material_mismatches.append(dict(mesh=name,sourceFactor=expected_factor,publishedFactor=factor,withheld=True))
  material_factors.append(dict(mesh=f"{mesh['name']}/{i}",factor=factor))
contracts=[]
for name in ['geom_c1.gbf','geom_t_c1.gbf','default.gbf']:
 text=(source/'Data/gfxscript'/name).read_text();contracts.append(dict(source='Data/gfxscript/'+name,text=text))
result=dict(status='PASS_TEXTURED_SOURCE_INPUTS_WITH_WITHHELD_GAPS' if material_mismatches else 'PASS_SOURCE_INPUTS_ONLY',mapId=map_id,parts=len(parts),expandedVertices=vertices,nonwhiteDiffuseVertices=different,sourceUVAndPackedRGBAExact=True,sourceMaterialFactorsExact=not material_mismatches,texturedConsumerMaterialFactorsExact=True,withheldMaterialFactorMismatches=material_mismatches,baseColorFactorsAllWhite=all(row['factor']==[1,1,1,1] for row in material_factors),nonwhiteMaterialFactors=[row for row in material_factors if row['factor']!=[1,1,1,1]],shaderContracts=contracts,limitations=['No original GPU raster, filtering/precision or ordinary player pixels.','Current module preserves imported double-sided geometry; original CullMode CW has not been restored.'])
(ROOT/f'recovery/output/scene-terrain{map_id:02d}-material-source.json').write_text(json.dumps(result,indent=2)+'\n')
print(f"{result['status']}: {len(parts)} parts/{vertices} original UV+packedRGBA vertices, {different} nonwhite diffuse; {len(material_mismatches)} withheld factor gaps")
