"""Export original terrain triangles, virtual boxes and respawn slots."""
import json
import base64
import struct
from pathlib import Path
from pol import read_pol
from nav import read_nav

root = Path('recovery/output/verified/assets/data')
out = Path('recovery/output/web-assets')
scenes = json.loads((out / 'scene-placements.json').read_text())
fields = []
for scene in scenes:
    identifier = scene['id']
    terrain = read_pol(root / f'Data/map/{identifier}/{identifier}.POL')
    triangles = []
    for mesh in terrain['meshes']:
        vertices = [struct.unpack_from('<3f', vertex) for vertex in mesh['vertices']]
        for part in mesh['parts']:
            triangles.extend([vertices[index] for index in face] for face in part['faces'])
    raw = (root / f'Data/scn/{identifier}/{identifier}.rpt').read_bytes()
    stamp = struct.unpack_from('<I', raw)[0]
    if stamp != 2005102301 or len(raw) != 388:
        raise ValueError(f'Unsupported respawn record {identifier}')
    groups = [[dict(position=struct.unpack_from('<3f', raw, 4 + group * 192 + slot * 16),
                    heading=struct.unpack_from('<f', raw, 16 + group * 192 + slot * 16)[0],
                    slot=slot)
               for slot in range(12)] for group in range(2)]
    navigation = read_nav(root / f'Data/scn/{identifier}/{identifier}.nav')
    layers = [dict(minimum=layer['minimum'], maximum=layer['maximum'],
                   width=layer['width'], height=layer['height'],
                   cells=base64.b64encode(b''.join(struct.pack('<fI', *cell)
                       for cell in layer['cells'])).decode('ascii'))
              for layer in navigation['layers']]
    fields.append(dict(id=identifier, terrainTriangles=triangles,
        collisionBoxes=[dict(id=box['id'], matrix=box['matrix'], dimensions=box['dimensions'])
                        for box in scene['collisionBoxes']],
        respawnStamp=stamp, respawnGroups=groups, navigationLayers=layers))
(out / 'battlefields.json').write_text(json.dumps(fields, separators=(',', ':')), encoding='utf-8')
print(f'{len(fields)} battlefields: {sum(len(f["terrainTriangles"]) for f in fields)} terrain triangles, '
      f'{sum(len(f["collisionBoxes"]) for f in fields)} boxes, 600 respawn slots')
