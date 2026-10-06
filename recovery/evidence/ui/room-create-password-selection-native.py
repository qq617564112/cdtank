"""Verify source password selection text/background/caret coordinate contract."""
import json
import runpy
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3]
runpy.run_path(str(Path(__file__).with_name('room-create-password-native.py')))
result=json.loads((ROOT/'recovery/output/room-create-password-native.json').read_text())
for row in result['vectors']:
    start,end=row['selection'];draws=[d for d in row['draws'] if d['text']]
    if start<end:
        assert draws[0]['text']=='*'*start
        assert draws[1]['text']=='*'*(end-start)
        assert len(''.join(d['text'] for d in draws))==row['inputCodepointCount']
        textLeft=draws[0]['rect'][0]
        background=next(b for b in row['brushes'] if b['kind']=='selection')
        assert background['rect'][0]==textLeft+start*7
        assert background['rect'][2]==textLeft+end*7
        assert draws[1]['rect'][0]==textLeft+start*7
        assert draws[2]['rect'][0]==textLeft+end*7
        if row['focused']:
            caret=next(b for b in row['brushes'] if b['kind']=='caret')
            assert caret['rect'][0]==textLeft+end*7
result['scope']='Complete original draw entry: EmotionFont0 prefix+selected+suffix text at cumulative extent; background at original range; caret at selection end. Font advance7 is a provider, not source OS width.'
(ROOT/'recovery/output/room-create-password-selection-native.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print('PASS: source selection text origin, background range, caret and scroll contract')
