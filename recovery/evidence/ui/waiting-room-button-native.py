"""Execute room_main actual source button types/images and alpha consumption."""
import runpy,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3]
ns=runpy.run_path(str(Path(__file__).with_name('source-button-native.py')))
controls=next(l['windows'] for l in ns['ui']['layouts'] if l['path'].endswith('room_main.xml'))
ns['Native'].setup.__globals__['controls']=controls
Native,VT=ns['Native'],ns['VT'];rows=[]
for name in ['btnReady','btnCancel','btnInvite','btnClose','btnCatTeam','btnDogTeam']:
 c=next(c for c in controls if c['name']==name);radio=c['type']=='WindowsLook/RadioButton';p=c['properties']
 assert p['StateColorBlend']=='False' and (radio or p['UseStandardImagery']=='False')
 assert all(k not in p for k in ['Text','Font','Alpha'])
 for state in ['Normal','Hover','Pushed','Disabled']:
  for selected in ([False,True] if radio else [False]):
   for alpha in [1,.5]:
    n=Native(183);n.setup(name,alpha,selected)
    entry=({'Normal':0x1001cf30,'Hover':0x1001d270,'Pushed':0x1001d5b0,'Disabled':0x1001d8c0} if radio else {'Normal':0x10004d70,'Hover':0x10005070,'Pushed':0x10005370,'Disabled':0x10005670})[state]
    if radio:n.write(VT+0xec,0x1001d5b0)
    n.invoke(entry,[0]);expected=('Pushed' if radio and selected and state in ['Normal','Hover'] else state)+'Image'
    keys=([expected] if p.get(expected) else [])+(['CheckMarkImage'] if selected else [])
    assert [i['property'] for i in n.images]==keys
    assert all(i['alpha']==[alpha]*4 for i in n.images)
    rows.append({'control':name,'type':c['type'],'state':state,'selected':selected,'effectiveAlpha':alpha,'images':n.images})
result={'status':'PASS','vectors':rows,'controls':[{k:c[k] for k in ['name','type','properties']} for c in controls if c['name'] in ['btnReady','btnCancel','btnInvite','btnClose','btnCatTeam','btnDogTeam']],'pointerVectors':ns['pointerRows'],'source':'Complete original WLButton/WLRadioButton consumers and ButtonBase dispatcher reused from source-button-native.py; room_main actual type/property/image inputs','providers':'Window rectangle and effectiveAlpha, empty label/font endpoint, colour operations and image draw endpoint; source type/state/draw branching execute','boundary':'Team selected follows current authoritative team projection; original room callback/OS events/frame/font/GPU/display remain outside this slice.'}
(ROOT/'recovery/output/waiting-room-button-native.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print('PASS: 64 complete room_main button image/alpha vectors and shared pointer dispatcher')
