"""Verify original armor-ammo mapping; reuse accepted008/SE31 resources and dispatch."""
import json
from pathlib import Path
import sys
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'recovery'))
from inspect_assets import read_table
web=ROOT/'recovery/output/web-assets'
catalog=json.loads((web/'combat-catalog.json').read_text())
item=next(r['values'] for r in read_table(ROOT/'CDTank/Data/table/item.dat')['rows'] if int(r['values']['ItemTableID'])==2006)
skill=next(r['values'] for r in read_table(ROOT/'CDTank/Data/table/skill.dat')['rows'] if int(r['values']['SkillTableID'])==4021)
i=next(i for i in catalog['items'] if i['itemTableId']==2006)
s=next(s for s in catalog['skills'] if s['skillId']==4021)
assert i['skillIds']==[int(item['ItemSkill1']),int(item['ItemSkill2']),int(item['ItemSkill3'])]==[2006,4021,0]
assert int(skill['TriggerType'])==s['triggerType']==8
assert (int(skill['Effect1']),skill['Sound1'],int(skill['EffectTag1']),int(skill['EffectMethod1']))==(8,'SE31',0,3)
assert s['effects'][0]==dict(effectId=8,sound='SE31',tag=0,method=3)
source=json.loads((ROOT/'recovery/output/combat-shot-player-result-2002-source.json').read_text())
assert source
out=dict(status='PASS_SOURCE_MAPPING_ONLY',item=i,skill=s,
 reused=['combat-shot-player-result-native.json','combat-shot-player-result-2002-source.json','combat-shot-player-result-2002-actual.json'],
 scope='Original2006 maps to the same4021/008/SE31 victim result already restored for2002. No new008 resource/native/render acceptance; no ordinary2006 trigger claim.')
(ROOT/'recovery/output/combat-shot-player-result-2006-source.json').write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n')
print('PASS_SOURCE_MAPPING_ONLY original2006→4021 Trigger8/008/SE31; reuse accepted resource/dispatch')
