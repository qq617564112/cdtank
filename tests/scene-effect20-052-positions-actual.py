"""Qualify all five052 positions from preserved ordinary dual-browser draws."""
import base64
import io
import json
import math
from pathlib import Path
import sys
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
run = ROOT/'recovery/output/browser-scene-effect20-052-round-2026-10-04T01-54-54-541Z.json'
raw = json.loads(run.read_text())
source = json.loads((ROOT/'recovery/output/scene-effect20-052-source.json').read_text())
assert raw['status'] == 'FAIL' and raw['roundOnly']
assert 'Browser condition timeout' in raw['error']
assert len(raw['observed']) == 2
placements = {row['id']:row for row in source['placements']}
assert list(placements) == ['269','270','271','272','273']
for world in raw['initial']:
    assert world['mapLoaded'] and world['mapId']==20 and world['mode']==5 and world['phase']=='PLAYING'
    assert len(world['players'])==4
    assert all(player['tankId']==1 for player in world['players'])
    assert sum(player['isCpu'] for player in world['players'])==2
for world in raw['finishedWorld']:
    assert world['phase']=='FINISHED' and world['match']['round']==1
    assert all(player['isAutopilot'] for player in world['players'] if not player['isCpu'])
assert raw['serverTrace'] and all(row.get('mapId',20)==20 for row in raw['serverTrace'])
controls = {row['node']:row for row in source['controls']}
pngs = []
qualified = []
expected_uv = [0,0,1,0,0,1,0,1,1,0,1,1]

def verify_draw(draw, placement):
    node = draw['node']
    assert node in controls
    assert draw['textures']==['/Data/effect/xy/FlareBrightOrange_yellow3.png']
    assert draw['uvs']==expected_uv
    positions = draw['positions']
    assert len(positions)==18 and len(draw['colors'])==24
    centre = [sum(positions[axis::3])/6 for axis in range(3)]
    expected = [-placement['position'][0],placement['position'][1],placement['position'][2]]
    assert all(abs(a-b)<.001 for a,b in zip(centre,expected))
    points = [positions[index:index+3] for index in range(0,18,3)]
    side = controls[node]['appearance']['scale'][0]*2
    assert abs(math.dist(points[0],points[1])-side)<.001
    assert abs(math.dist(points[0],points[2])-side)<.001
    assert points[2]==points[3] and points[1]==points[4]
    alpha = int(controls[node]['appearance']['color'][3]*255)/255
    for index in range(6):
        assert draw['colors'][index*4:index*4+3]==[1,1,1]
        assert abs(draw['colors'][index*4+3]-alpha)<1e-7
    return dict(centre=centre,side=side,packedAlpha=alpha)

for page_index, page in enumerate(raw['observed']):
    assert len(page['spawns'])==5
    assert [row['id'] for row in page['spawns']]==list(placements)
    for row in page['spawns']:
        assert row['matrix']==placements[row['id']]['matrix']
        assert row['name']=='_root\\online\\052' and row['handle']>0
    page_rows = []
    for identifier, placement in placements.items():
        node_rows = []
        for node in [2988,2989]:
            draws = [row for row in page['draws'] if row['id']==identifier and row['node']==node]
            assert len(draws)==3 and len({tuple(row['positions']) for row in draws})==3
            assert all(a['frame']<b['frame'] for a,b in zip(draws,draws[1:]))
            checked = [verify_draw(row,placement) for row in draws]
            count = page['counts'][f'{identifier}:{node}']
            assert count>=3
            node_rows.append(dict(node=node,drawCount=count,frames=[row['frame'] for row in draws],
                                  distinctNaturalPoses=3,geometry=checked))
        capture = page['captures'][identifier]
        assert {row['node'] for row in capture['draws']}=={2988,2989}
        assert {row['id'] for row in capture['draws']}=={identifier}
        assert all(row['frame']==capture['frame']-1 for row in capture['draws'])
        for draw in capture['draws']:
            verify_draw(draw,placement)
        encoded = capture['canvas']
        assert encoded.startswith('data:image/png;base64,')
        pixels = base64.b64decode(encoded.split(',',1)[1],validate=True)
        with Image.open(io.BytesIO(pixels)) as image:
            assert image.format=='PNG' and image.size==(320,180)
            assert len(image.convert('RGB').getcolors(320*180) or [])>100
            image = image.convert('RGB')
        name = f'scene-effect20-052-positions-{identifier}-page{page_index+1}.png'
        (ROOT/'recovery/output'/name).write_bytes(pixels)
        pngs.append((identifier,page_index+1,image,name))
        page_rows.append(dict(id=identifier,nodes=node_rows,captureFrame=capture['frame'],png=name))
    qualified.append(dict(page=page_index+1,placements=page_rows))

sheet = Image.new('RGB',(640,5*204),'#171a1f')
labels = ImageDraw.Draw(sheet)
for identifier,page,image,name in pngs:
    row = list(placements).index(identifier)
    x,y = (page-1)*320,row*204
    labels.text((x+6,y+5),f'052 placement {identifier} / page {page}',fill='white')
    sheet.paste(image,(x,y+24))
sheet.save(ROOT/'recovery/output/scene-effect20-052-positions-contact-sheet.png')
worlds = {key:[dict(playerId=world['playerId'],phase=world['phase'],round=world['match']['round'],
    players=[{key:player[key] for key in ['id','tankId','x','y','z','yaw','isCpu','isAutopilot']} for player in world['players']])
    for world in raw[key]] for key in ['initial','finishedWorld']}
out = dict(status='PASS',sourceRun=str(run),sourceRunOverallStatus='FAIL',acceptedScope='Preserved real dual-browser five-position draw/capture segment',
    pages=qualified,sourceWorldSnapshots=worlds,
    ordinaryInput=dict(mapId=20,mode=5,humanTankId=1,cpuCount=2,ready=True,autopilot=True,
        browserScript='tests/browser-scene-effect20-052.mjs',serverTraceRows=len(raw['serverTrace']),
        traceTickRange=[min(row['tick'] for row in raw['serverTrace'] if 'tick'in row),max(row['tick'] for row in raw['serverTrace'] if 'tick'in row)],
        positionCameraTimeNotificationInjection=False),
    contactSheet='scene-effect20-052-positions-contact-sheet.png',
    limitations=['Per-capture player coordinates were not recorded; frame numbers are actual browser frames',
                 'Actual onBeforeRender submissions and canvas screenshots do not establish original GPU pixels or高清 performance'])
(ROOT/'recovery/output/scene-effect20-052-positions-actual.json').write_text(json.dumps(out,indent=2)+'\n')
print('PASS:269–273 dual original sprites,3 natural poses each,centre/scale/UV/alpha/texture and10 actual PNG captures')
