"""MV3 v100 reader derived from gbengine.dll's original actor loader."""

from pathlib import Path
import struct


class Reader:
    def __init__(self, data):
        self.data = data
        self.position = 0

    def take(self, size):
        start = self.position
        self.position += size
        result = self.data[start:self.position]
        if len(result) != size:
            raise ValueError(f'Truncated MV3 at {start:#x}, size {size}')
        return result

    def unpack(self, format):
        return struct.unpack('<' + format, self.take(struct.calcsize('<' + format)))

    def integer(self):
        return self.unpack('I')[0]

    def name(self, size=64):
        return self.take(size).split(b'\0', 1)[0].decode('gbk')


def read_mv3(path):
    reader = Reader(Path(path).read_bytes())
    signature, version, duration, materials_count, tracks_count, meshes_count, tags_count = reader.unpack('7I')
    if signature != 0x0033564d or version != 100:
        raise ValueError(f'Unsupported MV3 version {version}')
    tags = [dict(id=reader.integer(), name=reader.name(16)) for _ in range(tags_count)]
    tracks = []
    for _ in range(tracks_count):
        name = reader.name()
        track_value, frames_count = reader.unpack('fI')
        frames = [dict(time=reader.integer(), matrix=reader.unpack('16f')) for _ in range(frames_count)]
        tracks.append(dict(name=name, value=track_value, frames=frames))
    materials = []
    for _ in range(materials_count):
        properties = reader.unpack('17f')
        textures = [reader.name(reader.integer()) for _ in range(4)]
        materials.append(dict(properties=properties, textures=textures))
    meshes = []
    for _ in range(meshes_count):
        name, vertices_count = reader.name(), reader.integer()
        bounds = reader.unpack('6f')
        frames = []
        for _ in range(reader.integer()):
            time = reader.integer()
            frames.append(dict(time=time, vertices=[reader.unpack('3hH') for _ in range(vertices_count)]))
        uv = reader.unpack(f'{reader.integer() * 2}f')
        parts = []
        for _ in range(reader.integer()):
            material = reader.integer()
            faces = [reader.unpack('6H') for _ in range(reader.integer())]
            extra = reader.unpack(f'{reader.integer()}I')
            parts.append(dict(material=material, faces=faces, extra=extra))
        meshes.append(dict(name=name, verticesCount=vertices_count, bounds=bounds,
                           frames=frames, uv=uv, parts=parts))
    return dict(version=version, duration=duration, tags=tags, tracks=tracks,
                materials=materials, meshes=meshes, consumed=reader.position,
                size=len(reader.data))


if __name__ == '__main__':
    import argparse
    import json
    parser = argparse.ArgumentParser()
    parser.add_argument('path', type=Path)
    args = parser.parse_args()
    model = read_mv3(args.path)
    print(json.dumps(model, ensure_ascii=False, indent=2))
