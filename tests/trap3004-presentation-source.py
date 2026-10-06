"""Read original3004 model data and its two distinct presentation skill records."""
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'recovery'))
from inspect_assets import read_table
from pol import read_pol

item = next(row['values'] for row in read_table(ROOT / 'CDTank/Data/table/item.dat')['rows']
            if int(row['values']['ItemTableID']) == 3004)
assert int(item['D3']) == 3004
skills = [row['values'] for row in read_table(ROOT / 'CDTank/Data/table/skill.dat')['rows']
          if int(row['values']['SkillTableID']) in (3004, 4002)]
model_path = ROOT / 'recovery/output/verified/assets/data/Data/scnobj/03004/03004.POL'
model = read_pol(model_path)
meshes = [dict(name=mesh['name'], bounds=list(mesh['bounds']),
               vertices=len(mesh['vertices']), triangles=sum(len(part['faces']) for part in mesh['parts']),
               textureReferences=[reference for part in mesh['parts'] for reference in part['textures']])
          for mesh in model['meshes']]
assert meshes[0]['textureReferences'] == ['03004A.tga']
texture_path = model_path.parent / '03004A.dds'
assert texture_path.is_file()
published = next(row for row in json.loads((ROOT / 'recovery/output/web-assets/pol-conversion.json').read_text())
                 if row['path'] == 'Data/scnobj/03004/03004.POL')
assert published['missingTextures'] == []
assert (ROOT / 'recovery/output/web-assets' / published['output']).is_file()
output = dict(status='PASS_ORIGINAL3004_DATA_AND_MODEL_ONLY',
              item={key: item[key] for key in ['ItemTableID', 'ItemName', 'D3', 'ItemType', 'ItemSkill1']},
              skills=[{key: skill[key] for key in ['SkillTableID', 'Effect1', 'Sound1', 'Effect2', 'Sound2',
                                                  'FuncType1', 'FuncT1', 'FuncX1', 'FuncY1', 'FuncZ1']}
                      for skill in skills],
              model=dict(reference='Data/scnobj/03004/03004.POL', version=model['version'], meshes=meshes,
                         texture='Data/scnobj/03004/03004A.dds', existingPublishedAsset=published['output']),
              scope='Original itemD3=3004, skill fields and complete03004 POL parse with76 triangles. Existing published conversion reused without re-export. Numeric ID to model path is a pending explicitly rebuilt ground identity; no original client trap factory, placement semantics, active duration or player pixels claimed.')
(ROOT / 'recovery/output/trap3004-presentation-source.json').write_text(json.dumps(output, ensure_ascii=False, indent=2)+'\n')
print('PASS: original3004 D3/model76 triangles/texture; skill3004 and4002 presentation remain distinct')
