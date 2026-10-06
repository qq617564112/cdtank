"""Execute original room-create button image and alpha consumers."""
import runpy,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3]
ns=runpy.run_path(str(Path(__file__).with_name('source-button-native.py')))
Native,VT=ns['Native'],ns['VT']
rows=[]
for name in ['btnOK','btnIncLowBound','rdoFriendlyFireOff','rdoCatVsDog']:
 for state,entry in [('Normal',0x10004d70),('Hover',0x10005070),('Pushed',0x10005370),('Disabled',0x10005670)]:
  for selected in ([False,True] if name.startswith('rdo') else [False]):
   for alpha in [1,.5]:
    n=Native(98);n.setup(name,alpha,selected)
    if name.startswith('rdo'):
     entry={'Normal':0x1001cf30,'Hover':0x1001d270,'Pushed':0x1001d5b0,'Disabled':0x1001d8c0}[state]
     n.write(VT+0xec,0x1001d5b0)
    n.invoke(entry,[0]);assert all(i['alpha']==[alpha]*4 for i in n.images),n.images
    expected=state+'Image' if state!='Normal' else 'NormalImage'
    if state=='Pushed':expected='PushedImage'
    if name.startswith('rdo') and selected and state in ['Normal','Hover']:expected='PushedImage'
    expectedImages=([expected] if n.control['properties'].get(expected) else [])+(['CheckMarkImage'] if selected else [])
    assert [i['property'] for i in n.images]==expectedImages,(name,state,selected,n.images,expectedImages)
    rows.append({'control':name,'state':state,'selected':selected,'effectiveAlpha':alpha,'images':n.images})
pointerRows=ns['pointerRows']
result={'status':'PASS','vectors':rows,'pointerVectors':pointerRows,'source':'ButtonBase drawSelf0x1003fba0 and updateInternalState0x1003f9e0 complete; four complete WLButton/WLRadioButton draw entries','providers':'Window outer/text rectangle, effectiveAlpha, Font label draw/extent and empty String, colour constructors/copy/setAlpha and Image/RenderableImage draw endpoints; native state/image branch and geometry arithmetic execute','boundary':'Web pointer capture/hit test and keyboard activation adapt DOM events. Original OS events, font and GPU framebuffer remain outside this slice.'}
(ROOT/'recovery/output/room-create-button-native.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');print('PASS: 48 complete button state/image/alpha vectors and 5 original pointer dispatcher vectors')
