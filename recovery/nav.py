"""Read the original NAV v2 grids and their indexed navigation geometry."""
import struct
from pathlib import Path
from mv3 import Reader


def read_nav(path):
    r = Reader(Path(path).read_bytes())
    signature, version, count, grid_offset, geometry_offset = r.unpack('4sBBII')
    if signature != b'NAV\0' or version != 2:
        raise ValueError('Unsupported observed NAV format')
    if r.position != grid_offset:
        raise ValueError('Unexpected NAV grid offset')
    layers = []
    for _ in range(count):
        description = r.take(128).hex()
        maximum = r.unpack('3f')
        minimum = r.unpack('3f')
        width, height = r.unpack('2I')
        cells = [r.unpack('fI') for _ in range(width * height)]
        layers.append(dict(description=description, maximum=maximum, minimum=minimum,
            width=width, height=height, cells=cells))
    if r.position != geometry_offset:
        raise ValueError('NAV grids do not end at geometry offset')
    for layer in layers:
        vertices, faces = r.unpack('2H')
        layer['vertices'] = [r.unpack('3f') for _ in range(vertices)]
        layer['faces'] = [r.unpack('3H') for _ in range(faces)]
        if any(index >= vertices for face in layer['faces'] for index in face):
            raise ValueError('NAV face index outside vertex data')
    if r.position != len(r.data):
        raise ValueError('Trailing NAV bytes')
    return dict(version=version, gridOffset=grid_offset, geometryOffset=geometry_offset,
        layers=layers, size=len(r.data))


if __name__ == '__main__':
    import collections
    import json
    entries = []
    for path in sorted(Path('recovery/output/verified/assets/data/Data/scn').rglob('*.nav')):
        model = read_nav(path)
        entries.append(dict(id=path.stem, size=model['size'], layers=[dict(
            width=layer['width'], height=layer['height'], minimum=layer['minimum'],
            maximum=layer['maximum'], vertices=len(layer['vertices']), faces=len(layer['faces']),
            flags=dict(collections.Counter(cell[1] for cell in layer['cells'])))
            for layer in model['layers']]))
    Path('recovery/output/nav-verification.json').write_text(json.dumps(entries, indent=2))
    print(f'{len(entries)} complete NAV files, '
          f'{sum(layer["width"] * layer["height"] for e in entries for layer in e["layers"])} cells, '
          f'{sum(layer["faces"] for e in entries for layer in e["layers"])} indexed triangles')
