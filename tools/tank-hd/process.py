"""Inspect UV atlases and composite reusable raster details across tank skins."""

import argparse
from collections import defaultdict
import json
from pathlib import Path
import struct

import numpy as np
import cv2
from PIL import Image, ImageDraw, ImageFont
from shapely import set_precision
from shapely.geometry import Polygon
from shapely.geometry.polygon import orient
from shapely.ops import unary_union

import raster

SOURCE_ROOT = Path(__file__).resolve().parents[2]
SIZE = 2048


def inventory():
    rows = []
    for folder in sorted((SOURCE_ROOT / 'art/original/tank-textures/role').iterdir()):
        files = sorted(folder.glob(f'{folder.name}[MU]_*.png'))
        rows.append({'tank': folder.name,
                     'parts': sorted({f.name[3] for f in files}),
                     'skins': sorted({f.stem.split('_')[1] for f in files}),
                     'textures': [f.name for f in files],
                     'sourceSizes': {f.name: list(Image.open(f).size) for f in files}})
    return rows


def read_uv(tank, part):
    data = (SOURCE_ROOT / f'apps/web/public/Data/role/{tank}/01{part}.glb').read_bytes()
    offset, chunks = 12, {}
    while offset < len(data):
        length, kind = struct.unpack_from('<II', data, offset)
        chunks[kind] = data[offset + 8:offset + 8 + length]
        offset += 8 + length
    document = json.loads(chunks[0x4E4F534A])
    binary = chunks[0x004E4942]

    def accessor_values(index, components):
        accessor = document['accessors'][index]
        view = document['bufferViews'][accessor['bufferView']]
        dtype = {5121: 'u1', 5123: '<u2', 5125: '<u4', 5126: '<f4'}[accessor['componentType']]
        stride = view.get('byteStride', np.dtype(dtype).itemsize * components)
        start = view.get('byteOffset', 0) + accessor.get('byteOffset', 0)
        return np.ndarray((accessor['count'], components), dtype=dtype, buffer=binary,
                          offset=start, strides=(stride, np.dtype(dtype).itemsize))

    triangles = []
    for mesh in document['meshes']:
        for primitive in mesh['primitives']:
            uv = accessor_values(primitive['attributes']['TEXCOORD_0'], 2)
            if 'indices' in primitive:
                uv = uv[accessor_values(primitive['indices'], 1).ravel()]
            triangles.extend(uv.reshape(-1, 3, 2) * 256)
    return np.asarray(triangles)


def uv_groups(triangles):
    parents = list(range(len(triangles)))

    def root(i):
        while parents[i] != i:
            parents[i] = parents[parents[i]]
            i = parents[i]
        return i

    edges = {}
    for i, triangle in enumerate(triangles):
        for j in range(3):
            a = tuple(np.round(triangle[j], 3))
            b = tuple(np.round(triangle[(j + 1) % 3], 3))
            if a == b:
                continue
            edge = tuple(sorted((a, b)))
            if edge in edges:
                parents[root(i)] = root(edges[edge])
            else:
                edges[edge] = i
    grouped = defaultdict(list)
    for i in range(len(triangles)):
        grouped[root(i)].append(i)
    rows = []
    for indices in grouped.values():
        points = triangles[indices].reshape(-1, 2)
        low, high = points.min(axis=0), points.max(axis=0)
        geometry = unary_union([Polygon(triangles[i]) for i in indices
                                if Polygon(triangles[i]).area > .00001])
        rows.append({'uvTriangles': indices, 'bounds': [*low.tolist(), *high.tolist()],
                     'area': geometry.area,
                     'drawable': bool(low.min() >= 0 and high.max() <= 256
                     and geometry.area >= 16 and np.prod(high - low) < 256 * 256 * .9)})
    return sorted(rows, key=lambda row: (row['bounds'][1], row['bounds'][0]))


def source_files(tank, part):
    return sorted((SOURCE_ROOT / f'art/original/tank-textures/role/{tank}').glob(f'{tank}{part}_*.png'))


def inspect(tank, output):
    output.mkdir(parents=True, exist_ok=True)
    parts = [part for part in 'MU' if source_files(tank, part)]
    font = ImageFont.load_default(size=16)
    for part in parts:
        files = source_files(tank, part)
        triangles = read_uv(tank, part)
        groups = uv_groups(triangles)
        (output / f'{part}-uv.json').write_text(json.dumps(
            {'coordinateSize': 256, 'triangles': triangles.tolist(), 'groups': groups}, indent=2) + '\n')
        original = Image.open(files[0]).convert('RGB').resize((1536, 1536), Image.Resampling.NEAREST)
        grid = original.copy()
        draw = ImageDraw.Draw(grid)
        for value in range(0, 256, 16):
            draw.line([(value * 6, 0), (value * 6, 1535)], fill=(160, 160, 160), width=1)
            draw.line([(0, value * 6), (1535, value * 6)], fill=(160, 160, 160), width=1)
            draw.text((value * 6 + 2, 2), str(value), fill='white', font=font, stroke_width=1, stroke_fill='black')
            draw.text((2, value * 6 + 2), str(value), fill='white', font=font, stroke_width=1, stroke_fill='black')
        grid.save(output / f'{part}-source-grid.png')
        draw = ImageDraw.Draw(original)
        for i, triangle in enumerate(triangles):
            if triangle.min() < 0 or triangle.max() > 256 or Polygon(triangle).area < .02:
                continue
            points = [(float(x) * 6, float(y) * 6) for x, y in triangle]
            draw.line(points + [points[0]], fill='#ff9d51', width=2)
            cx, cy = triangle.mean(axis=0) * 6
            draw.text((cx, cy), str(i), fill='white', font=font, stroke_width=1, stroke_fill='black')
        original.save(output / f'{part}-uv-triangles.png')
        sheet = Image.new('RGB', (1024, ((len(files) + 3) // 4) * 280), '#20252b')
        draw = ImageDraw.Draw(sheet)
        for i, file in enumerate(files):
            x, y = (i % 4) * 256, (i // 4) * 280
            sheet.paste(Image.open(file).convert('RGB').resize((256, 256), Image.Resampling.BILINEAR), (x, y + 24))
            draw.text((x + 4, y + 4), file.stem, fill='white', font=font)
        sheet.save(output / f'{part}-skins.jpg', quality=94)
    return parts


class ReusableHardware(raster.Hardware):
    """Paint neutral shading onto a transparent layer, retaining the skin below."""

    literal = False

    def color(self, color):
        color = tuple(color)
        if self.literal:
            return color if len(color) == 4 else color + (255,)
        rgb = np.asarray(color[:3], dtype=float)
        brightness = float(rgb @ [0.2126, .7152, .0722])
        original_alpha = color[3] if len(color) == 4 else 255
        if brightness < 25:
            return (*[round(brightness)] * 3, original_alpha)
        if brightness < 128:
            return (0, 0, 0, round((1 - brightness / 160) * original_alpha))
        return (255, 255, 255, round(min(.62, (brightness - 110) / 190) * original_alpha))

    def polygon(self, points, color):
        super().polygon(points, self.color(color))

    def rectangle(self, box, color):
        if box[2] > box[0] and box[3] > box[1]:
            super().rectangle(box, self.color(color))

    def line(self, points, color, width):
        super().line(points, self.color(color), width)

    def ellipse(self, box, color):
        super().ellipse(box, self.color(color))

    def bevel(self, points, width, texture=None):
        geometry = Polygon(points)
        ring = raster.geometry_mask(geometry.difference(geometry.buffer(-width, join_style=2)))
        shade = Image.new('RGBA', (SIZE, SIZE))
        draw = ImageDraw.Draw(shade)
        for i, a in enumerate(points):
            b = points[(i + 1) % len(points)]
            direction = np.asarray(b) - a
            if np.linalg.norm(direction) < .00001:
                continue
            normal = np.array([-direction[1], direction[0]]) / np.linalg.norm(direction)
            illumination = float(np.clip(normal @ [.55, .83], -1, 1))
            color = (255, 255, 255, round(illumination * 50)) if illumination > 0 else (0, 0, 0, round(35 - illumination * 60))
            face = [a, b, np.asarray(b) + normal * width, np.asarray(a) + normal * width]
            draw.polygon([(round(x * 8), round(y * 8)) for x, y in face], fill=color)
        shade.putalpha(Image.fromarray((np.asarray(shade.getchannel('A')).astype(float)
                       * np.asarray(ring) / 255).astype('uint8')))
        self.layer.alpha_composite(shade)
        self.draw = ImageDraw.Draw(self.layer)

    def feature(self, feature):
        self.literal = feature.get('literal', False)
        kind = feature['type']
        if kind == 'ellipse':
            self.ellipse(feature['box'], feature['color'])
        elif kind == 'polygon':
            self.polygon(feature['points'], feature['color'])
        elif kind == 'ellipse-frame':
            box = [round(v * 8) for v in feature['box']]
            self.draw.ellipse(box, outline=self.color(feature.get('color', [55, 82, 67])),
                              width=max(1, round(feature['width'] * 8)))
        elif kind == 'bevel':
            self.bevel(feature['points'], feature['width'])
        else:
            super().feature(feature)
        self.literal = False


def resolve(triangles, definition):
    panels = []
    for item in definition.get('panels', []):
        geometry = unary_union([set_precision(Polygon(triangles[i]), .001) for i in item['uvTriangles']
                                if Polygon(triangles[i]).area > .00001]).simplify(.00001)
        polygons = [geometry] if geometry.geom_type == 'Polygon' else geometry.geoms
        for polygon in polygons:
            if polygon.geom_type != 'Polygon' or polygon.is_empty:
                continue
            points = orient(polygon, sign=1).exterior.coords[:-1]
            panels.append({**item, 'points': [list(point) for point in points]})
    features = []
    for item in definition.get('features', []):
        if 'uvTriangles' in item:
            geometry = unary_union([set_precision(Polygon(triangles[i]), .001) for i in item['uvTriangles']
                                    if Polygon(triangles[i]).area > .00001]).simplify(.00001)
            polygons = [geometry] if geometry.geom_type == 'Polygon' else geometry.geoms
            polygon = max((p for p in polygons if p.geom_type == 'Polygon'), key=lambda p: p.area)
            item = {**item, 'points': [list(p) for p in orient(polygon, sign=1).exterior.coords[:-1]]}
        features.append(item)
    return panels, features


def cleanup_mask(features):
    selected = [f for f in features if f.get('erase', True)]
    legacy = [f for f in selected if f['type'] not in ('ellipse', 'polygon', 'ellipse-frame', 'bevel')]
    mask = raster.erase_mask(legacy)
    draw = ImageDraw.Draw(mask)
    for feature in selected:
        if 'eraseBox' in feature:
            draw.rectangle([round(v * 2) for v in feature['eraseBox']], fill=255)
        elif feature['type'] == 'ellipse':
            draw.ellipse([round(v * 2) for v in feature['box']], fill=255)
        elif feature['type'] == 'ellipse-frame':
            draw.ellipse([round(v * 2) for v in feature['box']], outline=255,
                         width=max(1, round((feature['width'] + 1.2) * 2)))
        elif feature['type'] == 'polygon':
            draw.polygon([(round(x * 2), round(y * 2)) for x, y in feature['points']], fill=255)
    return mask


def prepare(base, panels, mask):
    array = cv2.inpaint(np.asarray(base.convert('RGB')), np.asarray(mask), 5, cv2.INPAINT_TELEA)
    clean = Image.fromarray(array)
    extended = clean.copy()
    for panel in panels:
        geometry = Polygon(panel['points'])
        inner = np.asarray(raster.geometry_mask(geometry.buffer(-panel.get('bevel', .65) - 1.3,
                                                               join_style=2), 512)) > 0
        if not inner.any():
            continue
        outer = np.asarray(raster.geometry_mask(geometry, 512)) > 0
        _, labels = cv2.distanceTransformWithLabels((~inner).astype('uint8'), cv2.DIST_L2, 5,
                                                   labelType=cv2.DIST_LABEL_PIXEL)
        samples = np.zeros((int(labels.max()) + 1, 3), dtype='uint8')
        samples[labels[inner]] = array[inner]
        extended.paste(Image.fromarray(samples[labels]), (0, 0),
                       Image.fromarray(((outer & ~inner) * 255).astype('uint8')))
    return clean, extended


def preserved_mask(definition, part_definition, part, skin, size, triangles):
    mask = Image.new('L', (size, size))
    draw = ImageDraw.Draw(mask)
    scale = size / 256
    regions = []
    for source in [definition.get('preservedRegions', []), part_definition.get('preservedRegions', [])]:
        if isinstance(source, dict):
            regions.extend(source.get(f"{definition['tank']}{part}_{skin}.png", []))
        else:
            regions.extend(source)
    for region in regions:
        if part not in region.get('part', part) or skin not in region.get('skins', [skin]):
            continue
        if 'box' in region:
            draw.rectangle([round(v * scale) for v in region['box']], fill=255)
        elif 'points' in region:
            draw.polygon([(round(x * scale), round(y * scale)) for x, y in region['points']], fill=255)
        elif 'uvTriangles' in region:
            geometry = unary_union([Polygon(triangles[i]) for i in region['uvTriangles']
                                    if Polygon(triangles[i]).area > .00001])
            uv_mask = raster.geometry_mask(geometry, size)
            mask = Image.fromarray(np.maximum(np.asarray(mask), np.asarray(uv_mask)))
            draw = ImageDraw.Draw(mask)
    return mask


def render(tank, workspace):
    output = workspace / f'output/tank-hd/{tank}'
    public = workspace / f'apps/web/public/tank-audit/hd/{tank}'
    output.mkdir(parents=True, exist_ok=True)
    public.mkdir(parents=True, exist_ok=True)
    definition = json.loads((output / 'details.json').read_text())
    manifest = {'tank': tank, 'coordinateSize': 256, 'baseSize': 512, 'drawSize': 2048,
                'outputSize': 1024, 'baseResampling': 'BILINEAR', 'upscaling': 'BILINEAR',
                'downsampling': 'LANCZOS', 'parts': {}, 'textures': []}
    comparison_rows = []
    for part, part_definition in definition['parts'].items():
        triangles = read_uv(tank, part)
        panels, features = resolve(triangles, part_definition)
        mask = cleanup_mask(features)
        mask.save(output / f'{part}-cleanup-mask-512.png')
        hardware = ReusableHardware(Image.new('RGB', (SIZE, SIZE)))
        for panel in panels:
            points = panel['points']
            hardware.bevel(points, panel.get('bevel', .65))
            hardware.line(points + [points[0]], (55, 82, 67, 255), .22)
        for feature in features:
            hardware.feature(feature)
        hardware.layer.save(output / f'{part}-details-2048.png')
        hardware.layer.resize((1024, 1024), Image.Resampling.LANCZOS).save(output / f'{part}-details-1024.png')
        files = source_files(tank, part)
        for i, file in enumerate(files):
            original = Image.open(file)
            base = original.convert('RGB').resize((512, 512), Image.Resampling.BILINEAR)
            skin = file.stem.split('_')[1]
            protected_512 = preserved_mask(definition, part_definition, part, skin, 512, triangles)
            skin_mask = Image.fromarray(np.minimum(np.asarray(mask), 255 - np.asarray(protected_512)))
            clean, extended = prepare(base, panels, skin_mask)
            result = extended.resize((SIZE, SIZE), Image.Resampling.BILINEAR).convert('RGBA')
            protected = preserved_mask(definition, part_definition, part, skin, SIZE, triangles)
            result.paste(base.resize((SIZE, SIZE), Image.Resampling.BILINEAR).convert('RGBA'), (0, 0), protected)
            layer = hardware.layer.copy()
            layer.putalpha(Image.fromarray(np.minimum(np.asarray(layer.getchannel('A')), 255 - np.asarray(protected))))
            result = Image.alpha_composite(result, layer)
            result, uv_mask = raster.extrude_uv(result, triangles)
            final = result.resize((1024, 1024), Image.Resampling.LANCZOS)
            final.save(public / file.name)
            manifest['textures'].append({'filename': file.name, 'part': part,
                                         'skin': file.stem.split('_')[1], 'sourceSize': list(original.size)})
            if i == 0:
                base.save(output / f'{part}-base-512.png')
                clean.save(output / f'{part}-clean-512.png')
                result.save(output / f'{part}-composite-2048.png')
                uv_mask.save(output / f'{part}-uv-mask-2048.png')
                comparison_rows.append((part, base, final))
        manifest['parts'][part] = {'panels': len(panels), 'featureGroups': len(features),
                                   'detailLayer': f'{part}-details-2048.png', 'skins': len(files)}
        print(f'{tank}{part}: {len(files)} skins, {len(panels)} panels, {len(features)} detail groups', flush=True)
    canvas = Image.new('RGB', (1536, 548 * len(comparison_rows)), '#20252b')
    draw = ImageDraw.Draw(canvas)
    font = ImageFont.load_default(size=18)
    for row, (part, base, final) in enumerate(comparison_rows):
        layer = Image.open(output / f'{part}-details-2048.png')
        check = Image.new('RGBA', layer.size, '#919191')
        check = Image.alpha_composite(check, layer)
        for column, (label, image) in enumerate([('Original / 512', base), ('Details on gray', check), ('Composite / 1024', final)]):
            x, y = column * 512, row * 548
            draw.text((x + 8, y + 8), f'{tank}{part} / {label}', fill='white', font=font)
            canvas.paste(image.convert('RGB').resize((512, 512), Image.Resampling.LANCZOS), (x, y + 36))
    canvas.save(output / 'comparison.jpg', quality=94)
    manifest['preservedRegions'] = definition.get('preservedRegions', [])
    (output / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    return manifest


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('command', choices=['inventory', 'inspect', 'render'])
    parser.add_argument('tank', nargs='?')
    parser.add_argument('--output', type=Path)
    parser.add_argument('--workspace', type=Path, default=SOURCE_ROOT)
    args = parser.parse_args()
    if args.command == 'inventory':
        value = inventory()
        if args.output:
            args.output.write_text(json.dumps(value, indent=2) + '\n')
        else:
            print(json.dumps(value, indent=2))
    elif args.command == 'inspect':
        inspect(args.tank, args.output)
    else:
        render(args.tank, args.workspace)


if __name__ == '__main__':
    main()
