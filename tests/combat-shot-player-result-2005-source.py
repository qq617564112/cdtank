"""Verify original burst-ammo mapping; reuse accepted009/SE32 resources and dispatch."""
import json
from pathlib import Path
import sys
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'recovery'))
from inspect_assets import read_table
web=ROOT/'recovery/output/web-assets'
catalog=json.loads((web/'combat-catalog.json').read_text())
item=next(r['values'] for r in read_table(ROOT/'CDTank/Data/table/item.dat')['rows'] if int(r['values']['ItemTableID'])==2005)
skill=next(r['values'] for r in read_table(ROOT/'CDTank/Data/table/skill.dat')['rows'] if int(r['values']['SkillTableID'])==4004)
i=next(i for i in catalog['items'] if i['itemTableId']==2005)
s=next(s for s in catalog['skills'] if s['skillId']==4004)
assert i['skillIds']==[int(item['ItemSkill1']),int(item['ItemSkill2']),int(item['ItemSkill3'])]==[2005,4004,0]
assert int(skill['TriggerType'])==s['triggerType']==8
assert (int(skill['Effect1']),skill['Sound1'],int(skill['EffectTag1']),int(skill['EffectMethod1']))==(9,'SE32',0,3)
assert s['effects'][0]==dict(effectId=9,sound='SE32',tag=0,method=3)
source=json.loads((ROOT/'recovery/output/combat-shot-player-result-2003-source.json').read_text())
assert source
out=dict(status='PASS_SOURCE_MAPPING_ONLY',item=i,skill=s,
 reused=['combat-shot-player-result-native.json','combat-shot-player-result-2003-source.json','combat-shot-player-result-2003-actual.json'],
 scope='Original2005 maps to the same4004/009/SE32 victim result already restored for2003. No new009 resource/native/render acceptance; no ordinary2005 trigger claim.')
(ROOT/'recovery/output/combat-shot-player-result-2005-source.json').write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n')
print('PASS_SOURCE_MAPPING_ONLY original2005→4004 Trigger8/009/SE32; reuse accepted resource/dispatch')
