"""Check scene record boundaries and original matrix fields against exported data."""
import json
from pathlib import Path
import struct
import sys
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'recovery'))
from scene import read_scene
root=Path('recovery/output/verified/assets/data/Data/scn')
entries=json.loads(Path('recovery/output/web-assets/scene-placements.json').read_text())
count=0
for entry in entries:
    path=root/entry['id']/(entry['id']+'.obj')
    raw=path.read_bytes()
    records=read_scene(path)
    assert len(records)==struct.unpack_from('<I',raw)[0]==len(entry['records'])
    for record, exported in zip(records,entry['records']):
        pos=record['offset']+4
        size=struct.unpack_from('<I',raw,pos)[0];pos+=4+size+4
        for _ in range(2):
            size=struct.unpack_from('<I',raw,pos)[0];pos+=4+size
        assert tuple(exported['position'])==struct.unpack_from('<3f',raw,pos)
        assert tuple(exported['matrix'])==struct.unpack_from('<16f',raw,pos+25)
        if exported.get('asset'):
            assert (Path('recovery/output/web-assets')/exported['asset']).exists()
        count+=1
print(f'{len(entries)} scenes, {count} records: declared counts, source matrices and resolved GLB files verified')

for entry in entries:
    for extension, key in [('cas', 'castles'), ('box', 'collisionBoxes')]:
        path=root/entry['id']/(entry['id']+'.'+extension)
        records=read_scene(path)
        assert len(records)==len(entry[key])==struct.unpack_from('<I',path.read_bytes())[0]
        for source, exported in zip(records,entry[key]):
            assert source['position']==tuple(exported['position'])
            assert source['matrix']==tuple(exported['matrix'])
            assert source['tail']==exported['tail']
            if extension=='cas':
                assert (Path('recovery/output/web-assets')/exported['asset']).exists()
                assert exported['previewAction']=={'obj05447':'c1', 'obj05448':'c1', 'obj05449':'c2', 'obj05450':'c1'}[source['model']]
            else:
                raw=bytes.fromhex(source['tail'])
                assert tuple(exported['shapeMatrix'])==struct.unpack_from('<16f',raw,4)
                assert tuple(exported['dimensions'])==struct.unpack_from('<3f',raw,68)==source['bounds']
print(f'{sum(len(e["castles"]) for e in entries)} castles and {sum(len(e["collisionBoxes"]) for e in entries)} virtual boxes: complete source records verified')
