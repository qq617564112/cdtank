"""Render original/HD asset pairs offline with Pillow and numpy.

Examples: --group tanks, --group pets, --map 0002 --size 1536.
Geometry comes from preserved GLBs; external textures follow runtime definitions.
"""
import argparse
from functools import lru_cache
import io
import json
import re
from pathlib import Path
import struct
import subprocess
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter


def accessor(meta, binary, index):
    spec = meta['accessors'][index]
    width = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}[spec['type']]
    dtype = np.dtype({5120: 'i1', 5121: 'u1', 5122: '<i2', 5123: '<u2',
                      5125: '<u4', 5126: '<f4'}[spec['componentType']])
    view = meta['bufferViews'][spec['bufferView']]
    values = np.ndarray((spec['count'], width), dtype=dtype, buffer=binary,
                        offset=view.get('byteOffset', 0) + spec.get('byteOffset', 0),
                        strides=(view.get('byteStride', dtype.itemsize * width), dtype.itemsize)).copy()
    if spec.get('normalized') and dtype.kind in 'iu':
        values = values.astype(float) / np.iinfo(dtype).max
        values = np.maximum(values, -1)
    return values


def node_matrix(node):
    if 'matrix' in node:
        return np.array(node['matrix']).reshape((4, 4), order='F')
    x, y, z, w = node.get('rotation', [0, 0, 0, 1])
    result = np.eye(4)
    result[:3, :3] = [[1-2*y*y-2*z*z, 2*x*y-2*z*w, 2*x*z+2*y*w],
                      [2*x*y+2*z*w, 1-2*x*x-2*z*z, 2*y*z-2*x*w],
                      [2*x*z-2*y*w, 2*y*z+2*x*w, 1-2*x*x-2*y*y]]
    result[:3, :3] *= node.get('scale', [1, 1, 1])
    result[:3, 3] = node.get('translation', [0, 0, 0])
    return result


class Renderer:
    def __init__(self, root):
        self.root = root
        self.assets = root / 'recovery/output/web-assets'
        self.art = root / 'art/hd-assets'
        manifest = json.loads((self.art / 'inventory.json').read_text())
        self.textures = {entry['source'].lower(): entry for entry in manifest['textures']}

    def local_path(self, value):
        path = self.root / value
        return path if path.exists() else self.art / value

    @lru_cache(maxsize=256)
    def model(self, path):
        source = self.art / 'original-models' / path
        if not source.exists():
            source = self.assets / path
        data = source.read_bytes()
        chunks = {}
        offset = 12
        while offset < len(data):
            length, kind = struct.unpack_from('<II', data, offset)
            chunks[kind] = data[offset+8:offset+8+length]
            offset += 8 + length
        return json.loads(chunks[0x4E4F534A]), chunks.get(0x004E4942, b'')

    @lru_cache(maxsize=256)
    def image(self, source, hd):
        entry = self.textures.get(source.lower())
        path = None
        if entry:
            candidate = self.local_path(entry['png' if hd else 'original'])
            if candidate.exists():
                path = candidate
            elif hd:
                candidate = self.local_path(entry['original'])
                if candidate.exists():
                    path = candidate
        if path is None:
            path = self.assets / source
        return np.asarray(Image.open(path).convert('RGBA'), dtype=np.float32) / 255

    def material_image(self, path, meta, binary, material, overrides, hd):
        name = material.get('name', '')
        source = overrides.get(name.lower()) or overrides.get('*')
        if source:
            return self.image(source, hd)
        adopted = material.get('extras', {}).get('terrainTextureAdoption', {}).get('asset')
        if adopted:
            return self.image(adopted, hd)
        candidate = str(Path(path).parent / (Path(name).stem + '.png'))
        if candidate.lower() in self.textures or (self.assets / candidate).exists():
            return self.image(candidate, hd)
        pbr = material.get('pbrMetallicRoughness', {})
        if 'baseColorTexture' in pbr:
            image_spec = meta['images'][meta['textures'][pbr['baseColorTexture']['index']]['source']]
            if 'uri' in image_spec:
                return self.image(str(Path(path).parent / image_spec['uri']), hd)
            view = meta['bufferViews'][image_spec['bufferView']]
            offset = view.get('byteOffset', 0)
            return np.asarray(Image.open(io.BytesIO(binary[offset:offset+view['byteLength']])).convert('RGBA'), dtype=np.float32) / 255
        return np.ones((1, 1, 4), dtype=np.float32)

    def geometry(self, entries, excluded=None):
        primitives = []
        for path, placement, overrides in entries:
            meta, binary = self.model(path)

            def visit(index, parent):
                node = meta['nodes'][index]
                if excluded and node.get('name') == excluded:
                    return
                transform = parent @ node_matrix(node)
                if 'mesh' in node:
                    mesh = meta['meshes'][node['mesh']]
                    for primitive in mesh['primitives']:
                        if primitive.get('mode', 4) != 4:
                            continue
                        attrs = primitive['attributes']
                        positions = accessor(meta, binary, attrs['POSITION']).astype(float)
                        weights = node.get('weights', mesh.get('weights', []))
                        for weight, target in zip(weights, primitive.get('targets', [])):
                            if weight and 'POSITION' in target:
                                positions += weight * accessor(meta, binary, target['POSITION'])
                        positions = (np.column_stack((positions, np.ones(len(positions)))) @ transform.T)[:, :3]
                        uv = accessor(meta, binary, attrs['TEXCOORD_0']) if 'TEXCOORD_0' in attrs else np.zeros((len(positions), 2))
                        colors = accessor(meta, binary, attrs['COLOR_0']) if 'COLOR_0' in attrs else np.ones((len(positions), 4))
                        if colors.shape[1] == 3:
                            colors = np.column_stack((colors, np.ones(len(colors))))
                        material = meta.get('materials', [])[primitive['material']] if 'material' in primitive else {}
                        colors = colors * material.get('pbrMetallicRoughness', {}).get('baseColorFactor', [1, 1, 1, 1])
                        indices = accessor(meta, binary, primitive['indices']).ravel() if 'indices' in primitive else np.arange(len(positions))
                        primitives.append((positions, uv, colors, indices.reshape(-1, 3), path, meta, binary, material, overrides))
                for child in node.get('children', []):
                    visit(child, transform)

            for index in meta['scenes'][meta.get('scene', 0)]['nodes']:
                visit(index, placement)
        return primitives

    def render(self, primitives, size, hd=False, top=False, transparent=False, bounds=None, padding=None):
        if top:
            camera = np.array([[1, 0, 0], [0, 0, 1], [0, 1, 0]])
        else:
            direction = np.array([1., .8, 1.])
            direction /= np.linalg.norm(direction)
            right = np.cross([0, 1, 0], direction)
            right /= np.linalg.norm(right)
            camera = np.array([right, np.cross(direction, right), direction])
        projected = [p[0] @ camera.T for p in primitives]
        vertices = np.concatenate(projected)
        if bounds is None:
            center = (vertices[:, :2].min(0) + vertices[:, :2].max(0)) / 2
            span = max(np.ptp(vertices[:, :2], axis=0).max(), 1e-6)
            scale = size * (padding if padding is not None else (.98 if top else .84)) / span
        else:
            min_x, max_x, min_z, max_z = bounds
            center = np.array([(min_x+max_x)/2, (min_z+max_z)/2])
            scale = np.array([size/(max_x-min_x), size/(max_z-min_z)])
        pixels = np.zeros((size, size, 4), dtype=np.float32)
        if not transparent:
            pixels[..., :3] = [.25, .36, .44] if top else [.16, .20, .24]
            pixels[..., 3] = 1
        depth = np.full((size, size), -np.inf)
        triangles = []
        for primitive, positions in zip(primitives, projected):
            world, uv, colors, indices, path, meta, binary, material, overrides = primitive
            screen = positions.copy()
            screen[:, :2] = (positions[:, :2] - center) * scale + size / 2
            screen[:, 1] = size - screen[:, 1]
            image = self.material_image(path, meta, binary, material, overrides, hd)
            for vertices in indices:
                triangles.append((positions[vertices, 2].mean(), screen[vertices], world[vertices], uv[vertices], colors[vertices], image, material))
        # Far-to-near order preserves alpha blending without opaque transparent texels.
        triangles.sort(key=lambda item: item[0])
        for _, points, world, uv, colors, image, material in triangles:
            lo = np.maximum(np.floor(points[:, :2].min(0)).astype(int), 0)
            hi = np.minimum(np.ceil(points[:, :2].max(0)).astype(int), size-1)
            if np.any(hi < lo):
                continue
            a, b, c = points[:, :2]
            determinant = (b[1]-c[1])*(a[0]-c[0]) + (c[0]-b[0])*(a[1]-c[1])
            if abs(determinant) < 1e-6:
                continue
            yy, xx = np.mgrid[lo[1]:hi[1]+1, lo[0]:hi[0]+1]
            xx, yy = xx+.5, yy+.5
            first = ((b[1]-c[1])*(xx-c[0]) + (c[0]-b[0])*(yy-c[1])) / determinant
            second = ((c[1]-a[1])*(xx-c[0]) + (a[0]-c[0])*(yy-c[1])) / determinant
            weights = np.stack((first, second, 1-first-second), axis=-1)
            z = weights @ points[:, 2]
            target_depth = depth[lo[1]:hi[1]+1, lo[0]:hi[0]+1]
            visible = (weights.min(-1) >= -1e-6) & (z >= target_depth)
            if not visible.any():
                continue
            coords = np.mod(weights @ uv, 1)
            th, tw = image.shape[:2]
            tx, ty = coords[..., 0]*(tw-1), coords[..., 1]*(th-1)
            ix, iy = tx.astype(int), ty.astype(int)
            fx, fy = (tx-ix)[..., None], (ty-iy)[..., None]
            rgba = ((image[iy, ix]*(1-fx) + image[iy, (ix+1) % tw]*fx)*(1-fy)
                    + (image[(iy+1) % th, ix]*(1-fx) + image[(iy+1) % th, (ix+1) % tw]*fx)*fy)
            rgba *= np.clip(weights @ colors, 0, 1)
            mode = material.get('alphaMode', 'OPAQUE')
            if mode == 'MASK':
                visible &= rgba[..., 3] >= material.get('alphaCutoff', .5)
                rgba[..., 3] = 1
            elif mode == 'OPAQUE':
                rgba[..., 3] = 1
            else:
                visible &= rgba[..., 3] > .001
            normal = np.cross(world[1]-world[0], world[2]-world[0])
            normal /= max(np.linalg.norm(normal), 1e-9)
            light = 1 if top else .8 + .2 * abs(normal @ np.array([.3, .9, .3]))
            target = pixels[lo[1]:hi[1]+1, lo[0]:hi[0]+1]
            alpha = rgba[..., 3:4]
            out_alpha = alpha + target[..., 3:4]*(1-alpha)
            rgb = (rgba[..., :3]*light*alpha + target[..., :3]*target[..., 3:4]*(1-alpha))
            rgb /= np.maximum(out_alpha, 1e-9)
            target[visible, :3] = rgb[visible]
            target[visible, 3] = out_alpha[..., 0][visible]
            if mode != 'BLEND':
                target_depth[visible] = z[visible]
        return Image.fromarray(np.uint8(np.clip(pixels, 0, 1)*255))

    def items(self, group):
        definitions = self.root / 'apps/shared/content/definitions' / group
        for path in sorted(definitions.glob('*.json'), key=lambda p: int(p.stem)):
            definition = json.loads(path.read_text())
            resources = definition['resources']
            if group == 'pets':
                overrides = {'*': resources['textures'][0]} if resources.get('textures') else {}
                entries = [(resources['model'], np.eye(4), overrides)]
            else:
                overrides = {name.lower(): value for name, value in resources['textures'].items()}
                # Native idle supplies track texture A to both track actors.
                track = resources.get('trackTextures', {})
                if 'A' in track and 'B' in track:
                    overrides[track['B'].lower()] = resources['textures'][track['A']]
                entries = []
                for component in resources['components']:
                    action = next((a for a in component['actions'] if a['fields']['name'] == '01'), None)
                    if action and action.get('model'):
                        entries.append((action['model'], np.eye(4), overrides))
            yield f"{group} {definition['id']}", entries

    def map_bounds(self, map_id):
        source = (self.root / 'apps/web/src/interface/battle/hud-minimap-bounds.ts').read_text()
        match = re.search(r'\b' + str(int(map_id)) + r':\s*\{([^}]+)\}', source)
        if match is None:
            raise ValueError(f'Map {map_id} has no authored HUD bounds')
        values = dict(re.findall(r'(minX|maxX|minZ|maxZ):\s*([-\d.]+)', match[1]))
        return tuple(float(values[key]) for key in ('minX', 'maxX', 'minZ', 'maxZ'))

    def publish(self, group, label, entries, geometry, map_id=None):
        assets = self.root / 'apps/web/src/assets'
        published = []
        if map_id:
            destination = assets / 'maps/minimaps' / (map_id+'.png')
            destination.parent.mkdir(parents=True, exist_ok=True)
            self.render(geometry, 1024, hd=True, top=True,
                        bounds=self.map_bounds(map_id)).save(destination)
            return [destination]
        code = f"{int(label.split()[-1]):03d}"
        destination = assets / group / 'thumbnails' / (code+'.png')
        destination.parent.mkdir(parents=True, exist_ok=True)
        portrait = self.render(geometry, 1024, hd=True, transparent=True)
        portrait.save(destination)
        published.append(destination)
        inventory = json.loads((self.art / 'inventory.json').read_text())
        textures = {entry['source']: entry for entry in inventory['textures']}
        ui = json.loads((self.assets / 'ui.json').read_text())
        for imageset in ui['imagesets']:
            for image in imageset['images']:
                name = image['Name'].replace('\\', '/').lower()
                match = re.search(r'/tanke/(\d+)\.tga$', name) if group == 'tanks' else re.search(r'/gy/maogou_(\d+)\.tga$', name)
                if not match or int(match[1]) != int(code):
                    continue
                entry = textures[image['asset']]
                delivered = self.root / entry['png']
                delivered.parent.mkdir(parents=True, exist_ok=True)
                portrait.resize(tuple(size * 4 for size in entry['size']), Image.Resampling.LANCZOS).save(delivered)
                installed = self.assets / image['asset']
                installed.write_bytes(delivered.read_bytes())
        if group == 'tanks':
            definition = json.loads((self.root / 'apps/shared/content/definitions/tanks' / (str(int(code))+'.json')).read_text())
            components = definition['resources']['components']
            separate = any(c['part'] == 'U' and c['actions'] for c in components)
            mini_entries = []
            for path, transform, overrides in entries:
                component = next(c for c in components if any(a.get('model') == path and a['fields']['name'] == '01' for a in c['actions']))
                transform = transform.copy()
                if not separate or component['part'] == 'U':
                    transform[:3, :3] *= 1.5
                    if separate:
                        action = next(a for a in component['actions'] if a['fields']['name'] == '01')
                        pivot = action.get('turretPivot', [0, 0, 0])
                        transform[:3, 3] = np.array(pivot) * -.5
                        transform[1, 3] = 0
                mini_entries.append((path, transform, overrides))
            image = self.render(self.geometry(mini_entries), 1024, hd=True, top=True,
                                transparent=True, padding=1/1.12)
            bounds = image.getchannel('A').getbbox()
            if bounds is None:
                raise ValueError(f'Tank {code} has no visible minimap pixels')
            image = image.crop(bounds)
            image.thumbnail((896, 896), Image.Resampling.LANCZOS)
            canvas = Image.new('RGBA', (1024, 1024))
            canvas.alpha_composite(image, ((1024-image.width)//2, (1024-image.height)//2))
            mask = canvas.getchannel('A').point(lambda value: 255 if value >= 128 else 0)
            outer = mask.filter(ImageFilter.MaxFilter(97))
            for side, colour in {'self': (255, 255, 255), 'enemy': (255, 80, 80), 'friend': (80, 160, 255)}.items():
                icon = Image.new('RGBA', canvas.size, (*colour, 0))
                icon.putalpha(outer)
                icon.alpha_composite(canvas)
                destination = assets / 'tanks/minimap-icons' / (code+'-'+side+'.png')
                destination.parent.mkdir(parents=True, exist_ok=True)
                icon.resize((256, 256), Image.Resampling.LANCZOS).save(destination)
                published.append(destination)
        return published

    def map_items(self, map_id):
        scenes = json.loads((self.assets / 'scene-placements.json').read_text())
        scene = next(scene for scene in scenes if scene['id'] == map_id)
        entries = [(scene['terrain'], np.eye(4), {})]
        water = f'Data/map/{map_id}/water.glb'
        if (self.assets / water).exists():
            entries.append((water, np.eye(4), {}))
        for record in scene['records'] + scene.get('castles', []):
            if not record.get('enabled', 1):
                continue
            path = record.get('asset')
            if record in scene.get('castles', []):
                path = f"Data/scnobj/{record['model']}/n1.glb"
            if path:
                transform = np.array(record['matrix']).reshape((4, 4), order='F').copy()
                transform[:3, 3] = record['position']
                entries.append((path, transform, {}))
        yield f'map {map_id}', entries


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parent.parent)
    parser.add_argument('--group', default='tanks', help='tanks, pets, or map-ID')
    parser.add_argument('--publish', action='store_true', help='refresh native model thumbnails and minimap images from HD textures')
    parser.add_argument('--map', dest='map_id', help='scene-placements map ID')
    parser.add_argument('--size', type=int, default=512, help='pixels per original/HD view')
    args = parser.parse_args()
    renderer = Renderer(args.root.resolve())
    map_id = args.map_id or (args.group[4:] if args.group.startswith('map-') else None)
    group = 'map-' + map_id if map_id else args.group
    if not map_id and group not in ('tanks', 'pets'):
        parser.error('--group must be tanks, pets, or map-ID')
    items = list(renderer.map_items(map_id) if map_id else renderer.items(group))
    sheet = Image.new('RGB', (args.size*2, (args.size+28)*len(items)), '#29333d')
    draw = ImageDraw.Draw(sheet)
    for row, (label, entries) in enumerate(items):
        excluded = {'0009': 'plane02/1', '0015': 'plane01/23', '0018': 'plane01/19'}.get(map_id)
        geometry = renderer.geometry(entries, excluded=excluded)
        for column, hd in enumerate((False, True)):
            image = renderer.render(geometry, args.size, hd=hd, top=bool(map_id),
                                    bounds=renderer.map_bounds(map_id) if map_id else None)
            x, y = column*args.size, row*(args.size+28)
            draw.text((x+8, y+8), label + (' / HD' if hd else ' / Original'), fill='white')
            sheet.paste(image, (x, y+28))
        if args.publish:
            for path in renderer.publish(group, label, entries, geometry, map_id):
                print(path, flush=True)
        print(label, flush=True)
    destination = renderer.art / 'previews' / (group+'.png')
    destination.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(destination)
    print(destination, flush=True)
    if args.publish:
        subprocess.run([sys.executable, str(renderer.root / 'scripts/render-hd-asset-gallery.py'),
                        '--root', str(renderer.root)], check=True)


if __name__ == '__main__':
    main()
