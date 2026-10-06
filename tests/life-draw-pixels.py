"""Verify actual opaque source pixels in naturally reached 800x600 HP states."""
import json
import sys
from PIL import Image

rows = json.load(open(sys.argv[1]))
results = []
remote = False
for capture in rows:
    screenshot = Image.open(capture['file']).convert('RGBA')
    record = capture['record']
    assert record['scale'] == 1
    local = next(row for row in record['rows'] if row['name'] == 'prgLife')
    colour = local['colour']
    expected = tuple(int(colour[i:i+2], 16) for i in (2, 4, 6))
    point = (round(local['rect']['x'])+10, round(local['rect']['y'])+10)
    actual = screenshot.getpixel(point)[:3]
    assert actual == expected, (capture['file'], point, actual, expected)
    if 15 <= local['extent'] <= 160:
        edge = (round(local['rect']['x'])+local['extent']-1, round(local['rect']['y'])+14)
        outside = (edge[0]+1, edge[1])
        assert screenshot.getpixel(edge)[:3] == expected
        assert screenshot.getpixel(outside)[:3] != expected
        results.append({'consumer':'actual clip boundary','inside':edge,'outside':outside,'insideRgb':screenshot.getpixel(edge)[:3],'outsideRgb':screenshot.getpixel(outside)[:3]})
    results.append({'file':capture['file'], 'consumer':'local', 'point':point, 'source':[255,255,255,255], 'expected':expected, 'actual':actual, 'extent':local['extent']})
    for row in record['rows']:
        if remote or row['format'] != 'Vertical' or row['extent'] < 33 or '/77/105.png' not in row['image']['background']:
            continue
        point = (round(row['rect']['x'])+5, round(row['rect']['y'])+1)
        expected = (255,4,8)
        actual = screenshot.getpixel(point)[:3]
        assert actual == expected, (capture['file'], point, actual, expected)
        results.append({'file':capture['file'], 'consumer':'remote original RGB', 'point':point, 'source':[*expected,255], 'expected':expected, 'actual':actual})
        remote = True
        break
assert remote, 'One naturally full remote vertical bar must preserve its nonwhite source pixel'
print(json.dumps({'status':'PASS','samples':results,'scope':'Opaque local RGB three bands and remote nonwhite source RGB at native 800x600; screenshots at larger sizes separately establish actual geometry.'}))
