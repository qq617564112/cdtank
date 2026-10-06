"""Package the observed ground-model scope from ordinary browser evidence."""
import json
from pathlib import Path
out=Path('recovery/output')
first='browser-ground-trap3003-2026-10-05T01-37-55-035Z.json'
expiry='browser-ground-trap3003-visual-2026-10-05T01-40-42-370Z.json'
pixels='browser-ground-trap3003-pixel-tail-2026-10-05T01-43-08-680Z.json'
d=json.loads((out/expiry).read_text());p=json.loads((out/pixels).read_text())
assert d['status']=='INCOMPLETE' and p['status']=='INCOMPLETE'
assert len(p['captures'])==6
assert all(frame['match']['groundTraps']==[] for frame in d['afterRemoval'])
assert all(any(model['vertices']==618 and model['indices']==0 and model['draws']>0
               for model in f['observer']['models']) for f in p['failureScope'])
assert p['fixture']['newProfileOrInventoryImport'] is False
result={
 'status':'LIMITED_GROUND_MODEL_SCOPE_WITH_GAPS',
 'source':'trap3003-presentation-source.json',
 'modules':['trap3003-visual-module.json','ground-traps-presentation-module.json'],
 'webTypes':'trap3003-presentation-web-types.log',
 'raw':[first,expiry,pixels],
 'resource':{'model':'Data/scnobj/03003/03003.glb','mesh':'cylinder01/0','renderVertices':618,'renderIndices':0,'originalTriangles':206,'texture':'03003A.dds'},
 'actual':{'strictPurchasedCheckpoint':p['fixture']['source'],'dualOrdinaryPlacement':True,'dualOriginalModelDraw':True,'dualAuthoritativeRemovalTicks':[s['tick'] for s in d['afterRemoval']],'renderCallbackFrames':[c['file'] for c in p['captures']]},
 'pixelReview':{'host':'Object occluded by own tank; full model not discernible','guest':'Trap teeth locally visible beside the other tank; full geometry not independently discernible','fullModelAccepted':False,'dualPixelAccepted':False},
 'leave':{'hostWorldAbsent':not bool(p['failureScope'][0].get('state')),'guestWorldAbsent':not bool(p['failureScope'][1].get('state')),'dualNormalLeaveAccepted':False,'processCleanup':'ground-trap3003-process-cleanup.json'},
 'limitations':['Ground identity/yaw0/scale1 and gameplay parameters are explicit authority reconstruction','Full model pixels and guest normal Leave remain open','Trap4001 triggered visual/audio not covered by this ground-model slice'],
}
(out/'trap3003-ground-model-actual.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(result['status'])
