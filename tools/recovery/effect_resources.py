"""Decode texture grids confirmed by original type-1/type-6 loader and UV code."""
from hashlib import sha256
from pathlib import Path, PurePosixPath
import struct

from PIL import Image


def atlas_uvs(width, height, cell_width, cell_height, count):
    # 0x482d74/0x48138e: index starts at 0, increments by cell width;
    # divide by texture width, multiply quotient by cell height for row offset.
    cell_width = cell_width or width
    cell_height = cell_height or height
    if width <= 0 or height <= 0:
        raise ValueError('invalid texture dimensions')
    return [[(frame * cell_width % width) / width,
             ((frame * cell_width // width) * cell_height) / height,
             (frame * cell_width % width + cell_width) / width,
             ((frame * cell_width // width + 1) * cell_height) / height]
            for frame in range(count)]


def decode_resource(node):
    if node['type'] not in (1, 2, 6, 7, 8):
        return None
    raw = bytes.fromhex(node['resource'])
    path_start = 1 if node['type'] == 8 else 0
    path = raw[path_start:path_start + 324].split(b'\0')[0].decode('gb18030')
    if node['type'] == 2:
        return {'sourceReference': path, 'cellWidth': 0, 'cellHeight': 0,
                'frameCount': 1, 'resourceOffset': 324, 'remainingFields': raw[324:].hex()}
    offset = 648 if node['type'] == 1 else 325 if node['type'] == 8 else 324
    cell_width, cell_height, count = struct.unpack_from('<III', raw, offset)
    return {'sourceReference': path, 'cellWidth': cell_width,
            'cellHeight': cell_height, 'frameCount': count,
            'resourceOffset': offset,
            'remainingFields': raw[offset + 12:].hex()}


def export_resources(nodes, source_root, web_root):
    source_paths = [p for p in source_root.rglob('*') if p.is_file()]
    exact = {p.relative_to(source_root).as_posix().lower(): p for p in source_paths}
    by_stem = {}
    for path in source_paths:
        if path.suffix.lower() in ('.tga', '.dds', '.bmp', '.jpg'):
            key = path.relative_to(source_root).with_suffix('').as_posix().lower()
            by_stem.setdefault(key, []).append(path)
    rows = []
    for node in nodes:
        decoded = decode_resource(node)
        if decoded is None:
            continue
        reference = decoded['sourceReference'].replace('\\', '/')
        relative = reference[5:] if reference.lower().startswith('data/') else reference
        key = 'Data/' + relative
        direct = exact.get(key.lower())
        candidates = [direct] if direct else by_stem.get(str(PurePosixPath(key).with_suffix('')).lower(), [])
        row = {'node': node['index'], 'type': node['type'], **decoded,
               'resolution': 'missing', 'candidates': [p.relative_to(source_root).as_posix()
                                                      for p in candidates]}
        if len(candidates) == 1:
            path = candidates[0]
            asset = path.relative_to(source_root).with_suffix('.png').as_posix()
            png = web_root / asset
            row.update(source=path.relative_to(source_root).as_posix(),
                       sourceSha256=sha256(path.read_bytes()).hexdigest(), asset=asset,
                       resolution='published' if png.is_file() else 'unpublished')
            if png.is_file():
                with Image.open(png) as image:
                    width, height = image.size
                row.update(width=width, height=height,
                           assetSha256=sha256(png.read_bytes()).hexdigest(),
                           uvFrames=atlas_uvs(width, height, row['cellWidth'],
                                             row['cellHeight'], row['frameCount']))
                row['uvWithinTexture'] = all(0 <= value <= 1 for uv in row['uvFrames'] for value in uv)
        elif len(candidates) > 1:
            row['resolution'] = 'ambiguous'
        rows.append(row)
    return rows
