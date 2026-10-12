"""Read GameBox POLY static geometry using gbengine.dll's mesh readers."""
from pathlib import Path
import struct
from mv3 import Reader


def stride(fvf):
    if fvf & 0x80000000:
        return fvf & 0x7fffffff
    return sum(size for flag, size in [(1, 12), (0x100, 16), (2, 12), (4, 4), (8, 4),
                                      (16, 8), (32, 8), (64, 8), (128, 8)] if fvf & flag)


def read_pol(path):
    reader = Reader(Path(path).read_bytes())
    magic, version, count = reader.unpack('3I')
    if magic != 0x594c4f50:
        raise ValueError('Not POLY')
    descriptions = [reader.take(52) for _ in range(count)]
    attachments = []
    if version > 100:
        for _ in range(reader.integer()):
            name = reader.name(32)
            matrix = reader.unpack('16f')
            value = reader.integer()
            text = reader.name(reader.integer())
            attachments.append(dict(name=name, matrix=matrix, value=value, text=text))
    meshes = []
    for description in descriptions:
        bounds = reader.unpack('6f')
        fvf, vertex_count = reader.unpack('2I')
        step = stride(fvf)
        vertices = [reader.take(step) for _ in range(vertex_count)]
        parts = []
        for _ in range(reader.integer()):
            kind = reader.integer()
            properties = reader.unpack('17f')
            textures = [reader.name() for _ in range(reader.integer())]
            fields = reader.unpack('4I')
            faces = [reader.unpack('3H') for _ in range(fields[3])]
            if any(index >= vertex_count for face in faces for index in face):
                raise ValueError(f'Invalid face index at {reader.position}')
            parts.append(dict(kind=kind, properties=properties, textures=textures, fields=fields, faces=faces))
        meshes.append(dict(name=description[:32].split(b'\0')[0].decode('gbk'),
            description=description.hex(), bounds=bounds, fvf=fvf, stride=step, vertices=vertices, parts=parts))
    if reader.position != len(reader.data):
        raise ValueError(f'Trailing POL data: {reader.position}/{len(reader.data)}')
    return dict(version=version, attachments=attachments, meshes=meshes)


if __name__ == '__main__':
    import collections
    counts = collections.Counter()
    failures = []
    for path in Path('recovery/output/verified/assets/data').rglob('*'):
        if path.suffix.lower() != '.pol':
            continue
        try:
            model = read_pol(path)
            counts.update((model['version'], mesh['fvf'], mesh['stride']) for mesh in model['meshes'])
        except Exception as error:
            failures.append((str(path), str(error)))
    print(counts)
    print('failures', len(failures), failures[:8])
