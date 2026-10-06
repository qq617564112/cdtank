"""Read cvdf GameBox node tracks, vertex frames and animated material records."""
from pathlib import Path
import math
import struct
from mv3 import Reader


def read_cvd(path):
    r = Reader(Path(path).read_bytes())
    signature = r.take(4)
    if signature not in (b'cvdf', b'cvds'):
        raise ValueError(f'Unsupported CVD signature {signature}')
    version = 0.4 if signature == b'cvdf' else 0.5
    nodes = []
    def track(size):
        count = r.integer()
        mode = r.unpack('B')[0] if count else None
        raw = [r.take(size) for _ in range(count)]
        keys = [[value if math.isfinite(value) else None for value in struct.unpack('<' + str(size // 4) + 'f', key)] for key in raw]
        return dict(mode=mode, keys=keys, rawKeys=[key.hex() for key in raw])
    def node(parent):
        index = len(nodes)
        entry = dict(parent=parent, present=r.unpack('B')[0])
        nodes.append(entry)
        if entry['present']:
            entry['position'] = track(44)
            entry['rotation'] = track(44)
            entry['scale'] = track(60)
            entry['value'] = r.integer()
            frame_count, vertex_count = r.unpack('2I')
            entry['frames'] = [[r.unpack('8f') for _ in range(vertex_count)] for _ in range(frame_count)]
            entry['times'] = r.unpack(f'{frame_count}f')
            parts = []
            for _ in range(r.integer()):
                part = dict(kind=r.unpack('B')[0], material=r.take(20).hex(), texture=r.name())
                part['faces'] = [r.unpack('3H') for _ in range(r.integer())]
                if any(i >= vertex_count for face in part['faces'] for i in face):
                    raise ValueError('Invalid CVD vertex index')
                if version >= 0.5:
                    count = r.integer()
                    part['materialTimes'] = r.unpack(f'{count}f')
                    part['materialKeys'] = [r.take(20).hex() for _ in range(count)]
                parts.append(part)
            entry['parts'] = parts
            entry['matrix'] = r.unpack('16f')
        children = r.integer()
        for _ in range(children):
            node(index)
    roots = r.integer()
    for _ in range(roots):
        node(None)
    if r.position != len(r.data):
        raise ValueError(f'Trailing CVD bytes {r.position}/{len(r.data)}')
    return dict(signature=signature.decode(), version=version, nodes=nodes)


if __name__ == '__main__':
    import json
    results, failures = [], []
    for path in Path('recovery/output/verified/assets/data').rglob('*'):
        if path.suffix.lower() == '.cvd':
            try:
                model = read_cvd(path)
                results.append(dict(path=str(path), nodes=len(model['nodes']),
                    frames=sum(len(n.get('frames', [])) for n in model['nodes'])))
            except Exception as error:
                failures.append(dict(path=str(path), error=str(error)))
    print('parsed', len(results), 'failures',len(failures));print(json.dumps(failures[:8],indent=2))
