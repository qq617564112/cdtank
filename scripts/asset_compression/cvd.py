"""Publish per-model CVD/POL metadata and contiguous float32 vertices and tracks."""

import json
from pathlib import Path
import struct


def publish_model_libraries(root):
    root = Path(root)
    libraries = 0
    models = 0
    source_bytes = 0
    published_bytes = 0
    for path in sorted((root / 'data').rglob('*.json')):
        if path.name.endswith('.models.json') or path.parent.name.endswith('-models'):
            continue
        library = json.loads(path.read_text())
        if not isinstance(library, dict) or 'graphics' not in library or 'scripts' not in library \
                or not library.get('resources') or 'nodes' not in library['resources'][0]:
            continue
        directory = path.with_name(path.stem + '-models')
        directory.mkdir(parents=True, exist_ok=True)
        entries = []
        for index, resource in enumerate(library['resources']):
            data = bytearray()
            nodes = []
            for node in resource['nodes']:
                packed = {key: value for key, value in node.items()
                    if key not in ('vertices', 'frames', 'colors', 'animation')}
                frames = node.get('frames') or ([node['vertices']] if node.get('vertices') else [])
                if frames:
                    animated = 'animation' in node
                    offset = len(data)
                    vertices = bytearray()
                    for frame in frames:
                        for vertex in frame:
                            values = (*vertex[5:8], *vertex[:2]) if animated else (*vertex[:3], *vertex[6:8])
                            vertices.extend(struct.pack('<5f', *values))
                    frame_count = len(frames)
                    if animated and frame_count > 1:
                        frame_size = len(frames[0]) * 5 * 4
                        first_frame = vertices[:frame_size]
                        if all(vertices[start:start + frame_size] == first_frame
                                for start in range(frame_size, len(vertices), frame_size)):
                            vertices = first_frame
                            frame_count = 1
                    data.extend(vertices)
                    packed['vertexData'] = dict(offset=offset, vertexCount=len(frames[0]), frameCount=frame_count)
                    if node.get('colors'):
                        packed['vertexData']['colorOffset'] = len(data)
                        for color in node['colors']:
                            data.extend(struct.pack('<4f', *color))
                if node.get('animation'):
                    animation = dict(node['animation'])
                    # Mode 3 reads time, XYZ and the rotation/scale quaternion.
                    for kind, end in (('position', 5), ('rotation', 6), ('scale', 9)):
                        track = animation[kind]
                        if track['mode'] != 3:
                            raise ValueError(f"Unrecovered CVD track mode {track['mode']}")
                        stride = end - 1
                        animation[kind] = dict(mode=track['mode'], offset=len(data),
                            keyCount=len(track['keys']), stride=stride)
                        for key in track['keys']:
                            data.extend(struct.pack(f'<{stride}f', key[0], *key[2:end]))
                    packed['animation'] = animation
                nodes.append(packed)
            name = f'{index:03}'
            metadata_path = directory / f'{name}.json'
            binary_path = directory / f'{name}.bin'
            metadata = {key: value for key, value in resource.items() if key != 'nodes'}
            metadata.update(nodes=nodes, binary='/' + binary_path.relative_to(root).as_posix())
            metadata_path.write_text(json.dumps(metadata, ensure_ascii=False, separators=(',', ':')) + '\n')
            binary_path.write_bytes(data)
            entries.append(dict(reference=resource['reference'], asset='/' + metadata_path.relative_to(root).as_posix()))
            published_bytes += metadata_path.stat().st_size + len(data)
            models += 1
        index_path = path.with_suffix('.models.json')
        index = {key: value for key, value in library.items() if key != 'resources'}
        index['resources'] = entries
        index_path.write_text(json.dumps(index, ensure_ascii=False, separators=(',', ':')) + '\n')
        published_bytes += index_path.stat().st_size
        source_bytes += path.stat().st_size
        libraries += 1
    return dict(libraries=libraries, models=models, source_bytes=source_bytes, published_bytes=published_bytes)
