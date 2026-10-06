"""Verify original rapid-ammo mapping; reuse accepted007/SE30 resources and dispatch."""
import json
from pathlib import Path
import sys
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'recovery'))
from inspect_assets import read_table
web=ROOT/'recovery/output/web-assets'
catalog=json.loads((web/'combat-catalog.json').read_text())
item=next(r['values'] for r in read_table(ROOT/'CDTank/Data/table/item.dat')['rows'] if int(r['values']['ItemTableID'])==2004)
skill=next(r['values'] for r in read_table(ROOT/'CDTank/Data/table/skill.dat')['rows'] if int(r['values']['SkillTableID'])==4020)
i=next(i for i in catalog['items'] if i['itemTableId']==2004)
s=next(s for s in catalog['skills'] if s['skillId']==4020)
assert i['skillIds']==[int(item['ItemSkill1']),int(item['ItemSkill2']),int(item['ItemSkill3'])]==[2004,4020,0]
assert int(skill['TriggerType'])==s['triggerType']==8
assert (int(skill['Effect1']),skill['Sound1'],int(skill['EffectTag1']),int(skill['EffectMethod1']))==(7,'SE30',0,3)
assert s['effects'][0]==dict(effectId=7,sound='SE30',tag=0,method=3)
source=json.loads((ROOT/'recovery/output/combat-shot-player-result-accepted.json').read_text())
assert source
out=dict(status='PASS_SOURCE_MAPPING_ONLY',item=i,skill=s,
 reused=['combat-shot-player-result-native.json','combat-shot-player-result-accepted.json','ordinary2001-immediate-accepted.json'],
 scope='Original2004 maps to the same4020/007/SE30 victim result already accepted for2001. No new007 resource/native/render acceptance; no ordinary2004 trigger claim.')
(ROOT/'recovery/output/combat-shot-player-result-2004-source.json').write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n')
print('PASS_SOURCE_MAPPING_ONLY original2004→4020 Trigger8/007/SE30; reuse accepted resource/dispatch')
