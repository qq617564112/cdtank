"""Raster primitives for normalized 256-coordinate tank atlas details."""
import numpy as np
import cv2
from PIL import Image, ImageDraw
from shapely.geometry import Polygon
from shapely.geometry.polygon import orient
from shapely.ops import unary_union
SCALE = 8
SIZE = 2048

def triangle_mask(triangles, scale=1):
    mask = Image.new('L', (256 * scale, 256 * scale))
    draw = ImageDraw.Draw(mask)
    for triangle in triangles:
        draw.polygon([tuple(point * scale - 0.5) for point in triangle], fill=255)
    return mask

def polygon_mask(points, size=SIZE):
    mask = Image.new('L', (size, size))
    scale = size / 256
    ImageDraw.Draw(mask).polygon([(round(x * scale), round(y * scale))
                                  for x, y in points], fill=255)
    return mask


def geometry_mask(geometry, size=SIZE):
    mask = Image.new('L', (size, size))
    draw = ImageDraw.Draw(mask)
    scale = size / 256
    polygons = [geometry] if geometry.geom_type == 'Polygon' else geometry.geoms
    for polygon in polygons:
        draw.polygon([(round(x * scale - 0.5), round(y * scale - 0.5))
                      for x, y in polygon.exterior.coords], fill=255)
        for hole in polygon.interiors:
            draw.polygon([(round(x * scale - 0.5), round(y * scale - 0.5))
                          for x, y in hole.coords], fill=0)
    return mask


def uv_outline(triangles, indices):
    polygons = [Polygon(triangles[i]) for i in indices]
    geometry = unary_union([polygon for polygon in polygons if polygon.area > 0.00001])
    return orient(geometry.simplify(0.00001), sign=1)


def resolve_geometry(triangles, panel_definitions, feature_definitions):
    panels = []
    for item in panel_definitions:
        polygon = uv_outline(triangles, item['uvTriangles'])
        panels.append({**item, 'points': [list(point) for point in polygon.exterior.coords[:-1]]})
    features = []
    for item in feature_definitions:
        item = dict(item)
        if 'uvTriangles' in item:
            polygon = uv_outline(triangles, item['uvTriangles'])
            item['points'] = [list(point) for point in polygon.exterior.coords[:-1]]
        features.append(item)
    return triangles, panels, features


def inset(points, distance):
    points = np.asarray(points, dtype=float)
    directions = np.roll(points, -1, axis=0) - points
    normals = np.column_stack((-directions[:, 1], directions[:, 0]))
    normals /= np.linalg.norm(normals, axis=1)[:, None]
    shifted = points + normals * distance
    corners = []
    for i in range(len(points)):
        previous = (i - 1) % len(points)
        matrix = np.column_stack((directions[previous], -directions[i]))
        factors = np.linalg.solve(matrix, shifted[i] - shifted[previous])
        corners.append((shifted[previous] + directions[previous] * factors[0]).tolist())
    return corners


def octagon(cx, cy, radius):
    return [[cx + radius * np.cos(angle), cy + radius * np.sin(angle)]
            for angle in np.linspace(-np.pi * 3 / 4, np.pi * 5 / 4, 8, endpoint=False)]


class Hardware:
    def __init__(self, clean):
        self.clean = clean.convert('RGBA')
        self.layer = Image.new('RGBA', (SIZE, SIZE))
        self.draw = ImageDraw.Draw(self.layer)

    def polygon(self, points, color):
        self.draw.polygon([(round(x * SCALE), round(y * SCALE))
                           for x, y in points], fill=tuple(color))

    def rectangle(self, box, color):
        x0, y0, x1, y1 = box
        self.draw.rectangle((round(x0 * SCALE), round(y0 * SCALE),
                             round(x1 * SCALE) - 1, round(y1 * SCALE) - 1),
                            fill=tuple(color))

    def line(self, points, color, width):
        self.draw.line([(round(x * SCALE), round(y * SCALE))
                        for x, y in points], fill=tuple(color),
                       width=max(1, round(width * SCALE)), joint='curve')

    def ellipse(self, box, color):
        self.draw.ellipse(tuple(round(v * SCALE) for v in box), fill=tuple(color))

    def bevel(self, points, width, texture=None):
        geometry = Polygon(points)
        ring = geometry_mask(geometry.difference(geometry.buffer(-width, join_style=2)))
        texture = (texture or self.clean).convert('RGB')
        self.layer.paste(texture.convert('RGBA'), (0, 0), ring)
        for i in range(len(points)):
            j = (i + 1) % len(points)
            direction = np.asarray(points[j]) - points[i]
            normal = np.array([-direction[1], direction[0]])
            normal /= np.linalg.norm(normal)
            face = [points[i], points[j], (np.asarray(points[j]) + normal * width).tolist(),
                    (np.asarray(points[i]) + normal * width).tolist()]
            xs, ys = zip(*face)
            x0, y0 = max(0, int(min(xs) * SCALE)), max(0, int(min(ys) * SCALE))
            x1, y1 = min(SIZE, int(max(xs) * SCALE) + 2), min(SIZE, int(max(ys) * SCALE) + 2)
            array = np.asarray(texture.crop((x0, y0, x1, y1))).astype(float)
            illumination = np.clip(np.dot(normal, [0.55, 0.83]), -1, 1)
            shaded = np.clip(array * (0.85 + illumination * 0.18)
                            + max(0, illumination) * 25, 0, 255).astype('uint8')
            patch = Image.fromarray(shaded).convert('RGBA')
            mask = Image.new('L', patch.size)
            ImageDraw.Draw(mask).polygon([(round(x * SCALE) - x0, round(y * SCALE) - y0)
                                          for x, y in face], fill=255)
            mask = Image.fromarray(np.minimum(np.asarray(mask),
                                  np.asarray(ring.crop((x0, y0, x1, y1)))))
            patch.putalpha(mask)
            self.layer.alpha_composite(patch, (x0, y0))
        self.draw = ImageDraw.Draw(self.layer)

    def frame(self, points, width):
        self.line(points + [points[0]], (57, 83, 68, 255), width)
        inner = inset(points, width * 0.55)
        self.line(inner + [inner[0]], (151, 186, 135, 255), width * 0.42)
        for i in range(len(points)):
            j = (i + 1) % len(points)
            if points[j][1] < points[i][1] or points[j][0] > points[i][0]:
                self.line([points[i], points[j]], (126, 161, 122, 255), width * 0.28)

    def port(self, border, hole, color):
        color = np.asarray(color)
        dark = tuple(np.clip(color * 0.45, 0, 255).astype(int)) + (255,)
        face = tuple(color) + (255,)
        light = tuple(np.clip(color * 1.12 + 10, 0, 255).astype(int)) + (255,)
        shadow = tuple(np.clip(color * 0.76, 0, 255).astype(int)) + (255,)
        x0, y0, x1, y1 = border
        rim = min(0.7, (x1 - x0) / 7, (y1 - y0) / 7)
        self.rectangle(border, dark)
        self.rectangle([x0 + rim, y0 + rim, x1 - rim, y1 - rim], face)
        self.rectangle([x0 + rim, y0 + rim, x1 - rim, y0 + rim * 1.55], light)
        self.rectangle([x0 + rim, y0 + rim, x0 + rim * 1.55, y1 - rim], light)
        self.rectangle([x0 + rim, y1 - rim * 1.65, x1 - rim, y1 - rim], shadow)
        hx0, hy0, hx1, hy1 = hole
        lip = min(0.35, (hx1 - hx0) / 12, (hy1 - hy0) / 5)
        self.rectangle([hx0 - lip, hy0 - lip, hx1 + lip, hy1 + lip], shadow)
        self.rectangle([hx0 - lip, hy1, hx1 + lip, hy1 + lip], light)
        self.rectangle(hole, (0, 1, 7, 255))

    def bolt(self, center, radius, dark):
        cx, cy = center
        if dark:
            self.ellipse([cx - radius, cy - radius, cx + radius, cy + radius],
                         (19, 32, 25, 255))
            self.line([[cx - radius * 0.6, cy - radius * 0.85],
                       [cx + radius * 0.6, cy - radius * 0.85]],
                      (103, 136, 98, 255), 0.3)
            return
        self.polygon(octagon(cx, cy, radius), (51, 95, 81, 255))
        outer, inner = octagon(cx, cy, radius * 0.88), octagon(cx, cy, radius * 0.59)
        for i in range(8):
            j = (i + 1) % 8
            color = (104, 171, 139, 255) if i < 4 else (63, 121, 105, 255)
            self.polygon([outer[i], outer[j], inner[j], inner[i]], color)
        self.polygon(inner, (130, 190, 158, 255))
        self.rectangle([cx - radius * 0.34, cy - radius * 0.49,
                        cx + radius * 0.26, cy + radius * 0.05], (148, 207, 174, 255))

    def lamp(self, feature):
        points = feature['points']
        self.polygon(points, (72, 99, 64, 255))
        outer = inset(points, 0.55)
        lens = inset(points, 1.35)
        self.polygon(outer, (157, 167, 89, 255))
        xs, ys = zip(*lens)
        x0, y0, x1, y1 = min(xs), min(ys), max(xs), max(ys)
        width, height = round((x1 - x0) * SCALE), round((y1 - y0) * SCALE)
        xx, yy = np.meshgrid(np.linspace(x0, x1, width), np.linspace(y0, y1, height))
        cx, cy = feature['center']
        glow = np.exp(-(((xx - cx) / ((x1 - x0) * 0.39)) ** 2
                        + ((yy - cy) / ((y1 - y0) * 0.47)) ** 2) * 1.7)
        rgb = np.zeros((height, width, 3), dtype='uint8')
        rgb[:, :, 0] = np.clip(215 + glow * 40, 0, 255)
        rgb[:, :, 1] = np.clip(65 + glow * 190, 0, 255)
        rgb[:, :, 2] = np.clip(19 + glow * 118, 0, 255)
        colors = Image.new('RGBA', (SIZE, SIZE))
        colors.paste(Image.fromarray(rgb).convert('RGBA'), (round(x0 * SCALE), round(y0 * SCALE)))
        colors.putalpha(polygon_mask(lens))
        self.layer.alpha_composite(colors)
        guard = Image.new('RGBA', (SIZE, SIZE))
        gd = ImageDraw.Draw(guard)
        for x in feature['cellsX']:
            gd.line([(round(x * SCALE), round(y0 * SCALE)),
                     (round(x * SCALE), round(y1 * SCALE))],
                    fill=(127, 102, 45, 135), width=3)
        for y in feature['cellsY']:
            gd.line([(round(x0 * SCALE), round(y * SCALE)),
                     (round(x1 * SCALE), round(y * SCALE))],
                    fill=(127, 102, 45, 125), width=3)
        guard.putalpha(Image.fromarray((np.asarray(guard.getchannel('A')).astype(float)
                        * np.asarray(polygon_mask(lens)) / 255).astype('uint8')))
        self.layer.alpha_composite(guard)
        self.draw = ImageDraw.Draw(self.layer)
        self.line(lens + [lens[0]], (245, 165, 84, 255), 0.45)

    def feature(self, feature):
        kind = feature['type']
        if kind == 'frame':
            self.frame(feature['points'], feature['width'])
        elif kind == 'port':
            self.port(feature['border'], feature['hole'], feature['color'])
        elif kind == 'bolts':
            for center in feature['centers']:
                self.bolt(center, feature['radius'], feature['dark'])
        elif kind == 'solid':
            for box in feature.get('boxes', [feature.get('box')]):
                self.rectangle(box, tuple(feature['color']) + (255,))
        elif kind == 'line':
            self.line(feature['points'], tuple(feature['color']) + (255,), feature['width'])
        elif kind == 'seams':
            for path in feature['paths']:
                self.line(path, (77, 111, 85, 255), feature['width'])
                shifted = [[x + 0.5, y + 0.4] for x, y in path]
                self.line(shifted, (155, 184, 133, 255), feature['width'] * 0.65)
        elif kind == 'grille':
            for x in feature['positions']:
                box = [x - feature['width'] / 2, feature['top'],
                       x + feature['width'] / 2, feature['bottom']]
                self.rectangle([box[0] - 0.3, box[1] - 0.25,
                                box[2] + 0.35, box[3] + 0.25], (88, 122, 82, 255))
                self.rectangle([box[2], box[1], box[2] + 0.32, box[3]], (172, 196, 128, 255))
                self.rectangle(box, tuple(feature['color']) + (255,))
        elif kind == 'louvers':
            x0, y0, x1, y1 = feature['box']
            self.rectangle([x0, y0, x1, y1], (82, 116, 101, 255))
            for i, y in enumerate(feature['rows']):
                shade = 4 if i % 2 else 0
                self.rectangle([x0 + 0.7, y - 0.8, x1 - 0.7, y + 0.7],
                               (132 + shade, 213 + shade, 161 + shade, 255))
                self.rectangle([x0 + 1.6, y + 0.7, x1 - 1.6, y + 1.8], (104, 154, 125, 255))
                self.rectangle([x0 + 1.9, y + 1.8, x1 - 1.9, min(y + 2.9, y1)],
                               (88, 124, 109, 255))
        elif kind == 'clamps':
            for x0, y0, x1, y1 in feature['boxes']:
                cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
                self.rectangle([cx - 0.9, y0, cx + 0.9, y1], (86, 108, 78, 255))
                self.rectangle([cx - 0.35, y0 + 0.4, cx + 0.35, y1 - 0.4],
                               (164, 181, 122, 255))
                self.rectangle([x0, cy - 1.65, x1, cy + 1.65], (71, 89, 61, 255))
                self.rectangle([x0 + 0.55, cy - 1.0, x1 - 0.55, cy + 1.0],
                               (143, 170, 115, 255))
                self.rectangle([x0 + 0.85, cy - 0.25, x1 - 0.85, cy + 0.35],
                               (69, 86, 57, 255))
        elif kind in ('handles', 'locks', 'hinges'):
            for box in feature['boxes']:
                x0, y0, x1, y1 = box
                self.rectangle(box, (54, 88, 68, 255))
                self.rectangle([x0 + 0.6, y0 + 0.6, x1 - 0.6, y1 - 0.6],
                               (117, 160, 119, 255))
                self.rectangle([x0 + 0.85, y0 + 0.65, x1 - 0.85, y0 + 1.0],
                               (168, 198, 143, 255))
                if kind == 'handles':
                    self.rectangle([x0 + 1.3, y0 + 1.0, x0 + 2.3, y1 - 1.0],
                                   (118, 193, 151, 255))
                    self.rectangle([x1 - 2.3, y0 + 1.0, x1 - 1.3, y1 - 1.0],
                                   (71, 120, 99, 255))
                elif kind == 'hinges':
                    self.rectangle([x0 + 1, y0 + 1.1, x1 - 1, y1 - 1.1],
                                   (161, 195, 127, 255))
        elif kind == 'radiator':
            self.frame(feature['points'], 0.9)
            for box in feature['slots']:
                self.rectangle([box[0] - 0.1, box[1] - 0.35, box[2] + 0.1, box[1]],
                               (162, 191, 133, 255))
                self.rectangle(box, (0, 3, 8, 255))
        elif kind == 'ring':
            points = feature['points']
            self.bevel(points, 0.9)
            cx, cy = feature['center']
            radius = feature['radius']
            self.ellipse([cx - radius - 0.4, cy - radius - 0.4,
                          cx + radius + 0.4, cy + radius + 0.4], (118, 149, 101, 255))
            self.ellipse([cx - radius, cy - radius, cx + radius, cy + radius], (0, 0, 0, 255))
        elif kind == 'lamp':
            self.lamp(feature)


def erase_mask(features):
    mask = Image.new('L', (512, 512))
    draw = ImageDraw.Draw(mask)
    def box(bounds, margin=1.2):
        x0, y0, x1, y1 = bounds
        draw.rectangle(((x0 - margin) * 2, (y0 - margin) * 2,
                        (x1 + margin) * 2, (y1 + margin) * 2), fill=255)
    def path(points, width, closed=False):
        if closed:
            points = points + [points[0]]
        draw.line([(round(x * 2), round(y * 2)) for x, y in points],
                  fill=255, width=round((width + 1.8) * 2), joint='curve')
    for feature in features:
        kind = feature['type']
        if kind == 'frame':
            path(feature['points'], feature['width'], True)
        elif kind == 'port':
            box(feature['border'])
        elif kind == 'bolts':
            r = feature['radius'] + 0.9
            for x, y in feature['centers']:
                draw.ellipse(((x - r) * 2, (y - r) * 2,
                              (x + r) * 2, (y + r) * 2), fill=255)
        elif kind in ('handles', 'locks', 'hinges', 'clamps'):
            for bounds in feature['boxes']:
                box(bounds)
        elif kind in ('line', 'seams'):
            for points in feature.get('paths', [feature.get('points')]):
                path(points, feature['width'])
        elif kind == 'grille':
            box([min(feature['positions']) - 1, feature['top'],
                 max(feature['positions']) + 1, feature['bottom']])
        elif kind == 'radiator':
            path(feature['points'], 1.0, True)
            for bounds in feature['slots']:
                box(bounds, 0.45)
        elif kind == 'solid':
            for bounds in feature.get('boxes', [feature.get('box')]):
                box(bounds)
        elif kind == 'louvers':
            box(feature['box'])
    return mask


def prepare_base(base, panels, features):
    mask = erase_mask(features)
    clean_array = cv2.inpaint(np.asarray(base.convert('RGB')),
                             np.asarray(mask), 5, cv2.INPAINT_TELEA)
    clean = Image.fromarray(clean_array)
    extended = clean.copy()
    for item in panels:
        geometry = Polygon(item['points'])
        outer = geometry_mask(geometry, 512)
        inner = geometry_mask(geometry.buffer(-item['bevel'] - 1.3, join_style=2), 512)
        inside = np.asarray(inner) > 0
        _, labels = cv2.distanceTransformWithLabels((~inside).astype('uint8'),
                    cv2.DIST_L2, 5, labelType=cv2.DIST_LABEL_PIXEL)
        samples = np.zeros((int(labels.max()) + 1, 3), dtype='uint8')
        samples[labels[inside]] = clean_array[inside]
        color = Image.fromarray(samples[labels])
        rim = (np.asarray(outer) > 0) & ~inside
        extended.paste(color, (0, 0), Image.fromarray((rim * 255).astype('uint8')))
    return clean, extended, mask


def extrude_uv(result, triangles):
    references = []
    for triangle in triangles:
        minimum, maximum = triangle.min(axis=0), triangle.max(axis=0)
        if minimum.min() < 0 or maximum.max() > 256:
            continue
        if np.prod(maximum - minimum) > 256 * 256 * 0.9:
            continue
        references.append(triangle)
    valid_mask = triangle_mask(np.asarray(references), SCALE)
    valid = np.asarray(valid_mask) > 0
    distance, labels = cv2.distanceTransformWithLabels((~valid).astype('uint8'),
            cv2.DIST_L2, 5, labelType=cv2.DIST_LABEL_PIXEL)
    pixels = np.asarray(result)
    samples = np.zeros((int(labels.max()) + 1, 4), dtype='uint8')
    samples[labels[valid]] = pixels[valid]
    padding = (~valid) & (distance <= 2 * SCALE)
    result.paste(Image.fromarray(samples[labels]), (0, 0),
                 Image.fromarray((padding * 255).astype('uint8')))
    return result, valid_mask


