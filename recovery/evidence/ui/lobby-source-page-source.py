"""Bind the formal full-page regions to the supplied original lobby layouts."""
import json,re
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3];ui=json.loads((ROOT/'recovery/output/web-assets/ui.json').read_text())
def layout(s):return {c['name']:c for l in ui['layouts'] if l['path'].endswith('/'+s) for c in l['windows']}
def rect(c):return list(map(float,re.findall(r'-?\d+\.\d+',c['properties']['AbsoluteRect'])))
def source(s,n):
 controls=layout(s);c=controls[n];b=rect(c);xy=b[:]
 p=c['parent']
 while p:
  parent=controls[p];r=rect(parent);xy=[xy[0]+r[0],xy[1]+r[1],xy[2]+r[0],xy[3]+r[1]];p=parent['parent']
 assets=[]
 for k,ref in c['properties'].items():
  if not ref.startswith('set:'):continue
  sn,name=ref[4:].split(' image:');sets=[s for s in ui['imagesets'] if s['attributes']['Name']==sn];s=next((s for s in sets if 'imagesets_dds/' in s['path']),sets[0]);i=next(i for i in s['images'] if i['Name']==name);assets.append({'property':k,'reference':ref,'asset':i['asset'],'size':[int(i['Width']),int(i['Height'])]})
 return {'layout':s,'name':n,'parent':c['parent'],'type':c['type'],'rectangle':xy,'properties':c['properties'],'assets':assets}
rows=[source(s,n) for s,n in [('default.xml','picMainBackground'),('roomlist.xml','all'),('roomlist.xml','ditu'),('playerlist.xml','haoyou'),('playerlist.xml','datingmingchengditu'),('playerlist.xml','PlayerList'),('chat.xml','lt'),('chat.xml','liaotiankuangditu'),('chat.xml','ChatTextBox'),('chat.xml','picNormalChat'),('chat.xml','edtNormalUserInput'),('chat.xml','paomadengditu')]]
expected={'picMainBackground':[0,0,800,600],'all':[0,84,615,405],'haoyou':[610,97,800,600],'lt':[9,426,603,558],'ChatTextBox':[20,437,594,551],'edtNormalUserInput':[66,571,570,588]}
for r in rows:
 if r['name'] in expected:assert r['rectangle']==expected[r['name']]
native=json.loads((ROOT/'recovery/output/waiting-room-frame-native.json').read_text());assert native['status']=='PASS'
result={'status':'PASS','regions':rows,'consumerEvidence':'waiting-room-frame-native.json; room-card-background-native.json; existing source buttons/text remain unchanged','scope':'Original XML source region/resources and reused Static frame/Image consumers. No new original lobby scene composition callback, renderer display pairing or Windows framebuffer claimed.'}
(ROOT/'recovery/output/lobby-source-page-source.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');print('PASS original full-page lobby regions/resources')
