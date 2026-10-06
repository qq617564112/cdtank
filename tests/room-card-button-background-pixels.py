"""Verify missing disabled custom image reveals the panel through the button."""
import json
import re
import sys
from PIL import Image
rows = []
for capture in json.load(open(sys.argv[1])):
    expected = tuple(map(int, re.findall(r'\d+', capture['parentBackground'])))
    point = tuple(capture['point'][axis] for axis in ['x', 'y'])
    actual = Image.open(capture['file']).convert('RGB').getpixel(point)
    assert capture['cardBackground'] == 'rgba(0, 0, 0, 0)'
    assert actual == expected, (point, actual, expected)
    rows.append({'file': capture['file'], 'point': point, 'actual': actual, 'expectedParentRGB': expected})
print(json.dumps({'status': 'PASS', 'samples': rows, 'scope': 'An actual child-free area of each disabled card has no UA substitute background.'}))
