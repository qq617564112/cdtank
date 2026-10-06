"""Execute the two original room sort button image consumers."""
import json
from pathlib import Path
import runpy
ROOT=Path(__file__).resolve().parents[3]
ns=runpy.run_path(str(ROOT/'recovery/evidence/ui/source-button-native.py'))
controls=next(l['windows']for l in ns['ui']['layouts']if l['path'].endswith('roomlist.xml'))
Native=ns['Native'];Native.setup.__globals__['controls']=controls
rows=[]
for name in ['btnSortByID','btnSortByEmpty']:
 control=next(c for c in controls if c['name']==name)
 assert control['type']=='WindowsLook/Button'
 assert control['properties']['StateColorBlend']=='False'and control['properties']['UseStandardImagery']=='False'
 assert 'DisabledImage'not in control['properties']
 for state,entry in [('Normal',0x10004d70),('Hover',0x10005070),('Pushed',0x10005370),('Disabled',0x10005670)]:
  for alpha in [1,.5]:
   n=Native(98);n.setup(name,alpha);n.invoke(entry,[0])
   assert [image['property']for image in n.images]==([]if state=='Disabled'else[state+'Image'])
   assert all(image['alpha']==[alpha]*4 for image in n.images)
   rows.append({'name':name,'state':state,'alpha':alpha,'images':n.images})
result={'status':'PASS','controls':[c for c in controls if c['name']in ['btnSortByID','btnSortByEmpty']],'imageVectors':rows,'capturedStatesReused':'room-card-button-native.json','producerBoundary':'EXE has both control-name strings at0x5d589e/0x5d587e; bounded direct code xref scan found no immediate callers. Original visibility/callback not recovered. Formal toggle target/ordering lifecycle uses explicit existing Web ID/EMPTY state and changeSort.'}
(ROOT/'recovery/output/room-card-sort-button-native.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');print('PASS: 16 original sort button image/alpha vectors, including disabled zero draw')
