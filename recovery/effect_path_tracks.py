"""Read source 3DS vertex paths referenced by type6 particle controllers."""
import json
from pathlib import Path
import struct
ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / 'recovery/output/verified/assets/data'


def vertex_tracks(path):
    data = path.read_bytes()
    tracks = []
    def walk(begin, end, name=''):
        offset = begin
        while offset < end:
            kind, size = struct.unpack_from('<HI', data, offset)
            if size < 6 or offset + size > end:
                raise ValueError(f'Invalid 3DS chunk in {path}')
            payload = offset + 6
            child_name = name
            if kind == 0x4000:
                nul = data.index(0, payload)
                child_name = data[payload:nul].decode('cp1252')
                payload = nul + 1
            if kind in [0x4d4d, 0x3d3d, 0x4000, 0x4100]:
                walk(payload, offset + size, child_name)
            elif kind == 0x4110:
                count = struct.unpack_from('<H', data, payload)[0]
                vertices = [list(struct.unpack_from('<3f', data, payload + 2 + i * 12)) for i in range(count)]
                tracks.append(dict(name=name, vertices=[[x, z, -y] for x, y, z in vertices]))
            offset += size
    walk(0, len(data))
    return tracks


def export():
    library = json.loads((ROOT / 'recovery/output/web-assets/effect-library.json').read_text())
    files = {str(p.relative_to(ASSETS)).lower(): p for p in ASSETS.rglob('*') if p.is_file()}
    rows = []
    for control in library['particleControls']:
        if not control['pathEnabled']:
            continue
        payload = bytes.fromhex(library['nodes'][control['node']]['modifiers'][control['modifier']]['payload'])
        reference = payload[81:341].split(b'\0')[0].decode('cp1252').replace('\\', '/')
        path = files[reference.lower()]
        rows.append(dict(node=control['node'], modifier=control['modifier'], source=str(path.relative_to(ASSETS)),
            tracks=vertex_tracks(path), mode=struct.unpack_from('<I', payload, 77)[0], rate=struct.unpack_from('<f', payload, 405)[0]))
    sprite_rows = []
    for node in library['nodes']:
        if node['type'] != 1:
            continue
        resource = bytes.fromhex(node['resource'])
        if not resource[660]:
            continue
        reference = resource[324:648].split(b'\0')[0].decode('gb18030').replace('\\', '/')
        path = files[reference.lower()]
        sprite_rows.append(dict(node=node['index'], source=str(path.relative_to(ASSETS)),
            tracks=vertex_tracks(path), mode=struct.unpack_from('<I', resource, 661)[0],
            rate=struct.unpack_from('<f', resource, 665)[0]))
    output = dict(rows=rows, spriteRows=sprite_rows)
    (ROOT / 'recovery/output/web-assets/effect-path-tracks.json').write_text(json.dumps(output) + '\n')
    return output

if __name__ == '__main__':
    output = export()
    print(f"Exported {len(output['rows'])} original type6 path references")
