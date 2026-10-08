"""Reconstruct missing type5 effect models as runtime model JSON.

The original source archive has no ``bat/bianfu.cvd`` or ``bing_1..13.pol``
entities.  This module builds those missing entries in the published
``effect-models.json`` shape and writes their RGBA textures below
``reconstructed/battle``.  It never writes a POL or CVD file into the
verified source tree.
"""
from __future__ import annotations

import math
import re
import struct
from pathlib import Path

from PIL import Image, ImageDraw

BAT_REFERENCE = r"data\effect\effect\bat\bianfu.cvd"
BING_REFERENCE = re.compile(r"^data/effect/effect/bing/bing_(\d+)\.pol$")

BAT_TEXTURE_ASSET = "reconstructed/battle/bianfu.png"
BING_TEXTURE_ASSET = "reconstructed/battle/bing.png"

BAT_DURATION = 1.0
BAT_FLAP = [0.18, 0.72, 1.0, 0.38, -0.62, -1.0, -0.48, 0.20, 0.18]


def _key(reference: str) -> str:
    return reference.replace("\\", "/").casefold()


def _source_bing(source_root: Path | None) -> dict:
    fallback = {
        "bounds": (-3.3871, -3.2289, -3.1832, 3.4008, 3.2289, 3.1764),
        "properties": [1.0] * 8 + [0.0, 0.0, 0.0, 1.0, 1.0, 1.0, 1.0, 1.0, 12.8],
        "triangles": 60,
    }
    if source_root is None:
        return fallback
    path = source_root / "Data/effect/effect/bing.POL"
    if not path.is_file():
        return fallback
    try:
        from pol import read_pol

        mesh = read_pol(path)["meshes"][0]
        part = mesh["parts"][0]
        return {
            "bounds": tuple(float(value) for value in mesh["bounds"]),
            "properties": [float(value) for value in part["properties"]],
            "triangles": len(part["faces"]),
        }
    except Exception:
        return fallback


def _write_texture(web_root: Path, asset: str, renderer) -> None:
    destination = web_root / asset
    destination.parent.mkdir(parents=True, exist_ok=True)
    image = Image.new("RGBA", (256, 256), (0, 0, 0, 255))
    renderer(ImageDraw.Draw(image, "RGBA"), image)
    image.save(destination)


def _ice_texture(web_root: Path) -> None:
    asset = BING_TEXTURE_ASSET

    def draw(drawer: ImageDraw.ImageDraw, _image: Image.Image) -> None:
        for y in range(256):
            amount = y / 255.0
            color = (
                int(36 + 34 * amount),
                int(112 + 54 * amount),
                int(158 + 48 * amount),
                255,
            )
            drawer.line((0, y, 256, y), fill=color)

        facets = [
            ([(0, 174), (58, 130), (116, 170), (74, 226)], (98, 190, 218, 255)),
            ([(58, 130), (126, 70), (180, 114), (116, 170)], (66, 157, 205, 255)),
            ([(126, 70), (210, 32), (236, 106), (180, 114)], (154, 220, 232, 255)),
            ([(116, 170), (180, 114), (236, 106), (196, 196), (148, 246)], (78, 170, 210, 255)),
            ([(74, 226), (116, 170), (148, 246), (84, 256)], (50, 137, 190, 255)),
            ([(180, 114), (236, 106), (256, 172), (196, 196)], (118, 201, 224, 255)),
            ([(0, 56), (52, 18), (104, 62), (42, 104)], (78, 166, 204, 255)),
            ([(104, 62), (164, 10), (222, 54), (178, 102)], (138, 214, 229, 255)),
            ([(42, 104), (104, 62), (178, 102), (126, 154), (58, 130)], (58, 151, 201, 255)),
            ([(178, 102), (222, 54), (256, 82), (256, 156), (236, 106)], (168, 226, 236, 255)),
        ]
        for polygon, fill in facets:
            drawer.polygon(polygon, fill=fill, outline=(224, 248, 249, 190))

        highlights = [
            ((20, 226), (92, 154), (146, 104)),
            ((92, 244), (154, 190), (220, 142)),
            ((166, 34), (198, 84), (228, 132)),
            ((32, 92), (76, 68), (122, 104)),
        ]
        for line in highlights:
            drawer.line(line, fill=(238, 253, 252, 220), width=3, joint="curve")
        for x in range(0, 256, 32):
            drawer.line((x, 0, x + 64, 256), fill=(216, 246, 247, 45), width=1)
        for y in range(18, 256, 46):
            drawer.line((0, y, 256, max(0, y - 38)), fill=(30, 104, 160, 72), width=1)

    _write_texture(web_root, asset, draw)


def _bat_texture(web_root: Path) -> None:
    asset = BAT_TEXTURE_ASSET

    def draw(drawer: ImageDraw.ImageDraw, _image: Image.Image) -> None:
        drawer.rectangle((0, 0, 255, 255), fill=(44, 25, 62, 255))
        drawer.rectangle((0, 0, 159, 127), fill=(58, 30, 78, 255))
        drawer.rectangle((160, 0, 255, 127), fill=(73, 31, 82, 255))
        drawer.rectangle((0, 128, 255, 255), fill=(42, 24, 54, 255))

        body_facets = [
            ([(0, 8), (70, 0), (128, 54), (62, 96), (0, 70)], (74, 39, 96, 255)),
            ([(70, 0), (158, 0), (158, 62), (128, 54)], (54, 28, 74, 255)),
            ([(0, 70), (62, 96), (128, 54), (158, 112), (70, 126)], (88, 47, 108, 255)),
            ([(0, 70), (70, 126), (0, 126)], (46, 24, 65, 255)),
        ]
        for polygon, fill in body_facets:
            drawer.polygon(polygon, fill=fill, outline=(111, 61, 128, 180))

        wing_facets = [
            ([(160, 6), (216, 0), (250, 38), (204, 62)], (92, 40, 98, 255)),
            ([(160, 58), (204, 62), (250, 38), (256, 106), (218, 126)], (67, 30, 82, 255)),
            ([(160, 112), (218, 126), (256, 106), (234, 74), (192, 92)], (83, 35, 92, 255)),
        ]
        for polygon, fill in wing_facets:
            drawer.polygon(polygon, fill=fill, outline=(129, 61, 124, 180))
        for line in [
            ((162, 18), (236, 40), (224, 118)),
            ((174, 54), (246, 84)),
            ((168, 96), (232, 72)),
            ((190, 112), (248, 92)),
        ]:
            drawer.line(line, fill=(153, 73, 139, 210), width=2, joint="curve")

        drawer.ellipse((13, 146, 48, 178), fill=(245, 218, 111, 255), outline=(93, 53, 32, 255))
        drawer.ellipse((22, 153, 34, 170), fill=(91, 23, 22, 255))
        drawer.ellipse((82, 147, 114, 174), fill=(245, 238, 215, 255), outline=(98, 75, 70, 255))
        drawer.polygon([(86, 174), (110, 170), (98, 194)], fill=(250, 247, 232, 255), outline=(112, 80, 76, 255))
        drawer.polygon([(120, 170), (148, 176), (134, 198)], fill=(251, 247, 236, 255), outline=(112, 80, 76, 255))
        drawer.ellipse((16, 204, 76, 246), fill=(117, 55, 94, 255), outline=(173, 89, 132, 255))
        drawer.ellipse((154, 196, 232, 246), fill=(86, 41, 98, 255), outline=(145, 76, 132, 255))
        for x in range(10, 256, 22):
            drawer.line((x, 130, x + 14, 254), fill=(124, 61, 122, 55), width=1)

    _write_texture(web_root, asset, draw)


def _normal(a, b, c):
    ux, uy, uz = b[0] - a[0], b[1] - a[1], b[2] - a[2]
    vx, vy, vz = c[0] - a[0], c[1] - a[1], c[2] - a[2]
    x, y, z = uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx
    length = math.sqrt(x * x + y * y + z * z)
    if length <= 1e-8:
        return (0.0, 1.0, 0.0)
    return (x / length, y / length, z / length)


def _uv_ice(point, bounds):
    x, y, z = point
    angle = math.atan2(z, x)
    u = 0.06 + 0.88 * (angle / (2 * math.pi) + 0.5)
    span = max(1e-6, bounds[4] - bounds[1])
    v = 0.06 + 0.88 * ((y - bounds[1]) / span)
    return (max(0.0, min(1.0, u)), max(0.0, min(1.0, v)))


def _uv_bat(point, region):
    x, y, z = point
    if region == "body":
        return (0.03 + 0.56 * ((x + 1.25) / 2.5), 0.03 + 0.42 * ((y + 0.55) / 1.35))
    if region == "membrane":
        return (0.64 + 0.32 * ((z + 2.0) / 4.0), 0.04 + 0.42 * ((x + 1.0) / 1.8))
    if region == "eye":
        return (0.105 + 0.025 * (z + 0.18) / 0.36, 0.63)
    if region == "tooth":
        return (0.40 + 0.035 * (z + 0.12) / 0.24, 0.68)
    return (0.10 + 0.16 * ((z + 0.4) / 0.8), 0.82 + 0.10 * ((y - 0.2) / 0.8))


def _crystal_cluster(spec):
    sides = spec["sides"]
    height = spec["height"]
    radius = spec["radius"]
    twist = spec.get("twist", 0.0)
    rings = [
        (-height * 0.5, radius * spec.get("bottomScale", 0.76), twist, spec.get("leanX", 0.0) * -0.5, spec.get("leanZ", 0.0) * -0.5),
        (-height * 0.08, radius * spec.get("waistScale", 1.0), twist + spec.get("sway", 0.0), spec.get("leanX", 0.0), spec.get("leanZ", 0.0)),
    ]
    if spec.get("topScale", 0.0) > 0.025:
        rings.append((height * 0.5, radius * spec["topScale"], twist + spec.get("sway", 0.0) * 1.8, spec.get("leanX", 0.0) * 1.8, spec.get("leanZ", 0.0) * 1.8))

    vertices = []
    ring_indices = []
    for y, ring_radius, ring_twist, center_x, center_z in rings:
        start = len(vertices)
        for index in range(sides):
            angle = 2.0 * math.pi * (index + 0.5) / sides + ring_twist
            vertices.append([
                center_x + math.cos(angle) * ring_radius,
                y,
                center_z + math.sin(angle) * ring_radius,
            ])
        ring_indices.append(start)

    faces = []
    for ring in range(len(ring_indices) - 1):
        lower = ring_indices[ring]
        upper = ring_indices[ring + 1]
        for index in range(sides):
            nxt = (index + 1) % sides
            faces.append((lower + index, upper + index, lower + nxt))
            faces.append((lower + nxt, upper + index, upper + nxt))

    lower_center = [
        spec.get("leanX", 0.0) * -0.5,
        -height * 0.5 - spec.get("bottomTip", 0.0),
        spec.get("leanZ", 0.0) * -0.5,
    ]
    lower_center_index = len(vertices)
    vertices.append(lower_center)
    lower = ring_indices[0]
    for index in range(sides):
        nxt = (index + 1) % sides
        faces.append((lower_center_index, lower + index, lower + nxt))

    upper_center = [
        spec.get("leanX", 0.0) * 1.8,
        rings[-1][0] + spec.get("topTip", 0.0),
        spec.get("leanZ", 0.0) * 1.8,
    ]
    upper_center_index = len(vertices)
    vertices.append(upper_center)
    upper = ring_indices[-1]
    for index in range(sides):
        nxt = (index + 1) % sides
        faces.append((upper_center_index, upper + nxt, upper + index))
    return vertices, faces


def _triangle_rows(clusters, bounds, category):
    rows = []
    for vertices, faces in clusters:
        for face in faces:
            points = [vertices[index] for index in face]
            normal = _normal(*points)
            for point in points:
                if category == "ice":
                    u, v = _uv_ice(point, bounds)
                else:
                    u, v = _uv_bat(point, category)
                if category == "ice":
                    rows.append([*point, *normal, u, v])
                else:
                    rows.append([u, v, *normal, *point])
    return rows


def _fit_clusters(clusters, bounds):
    points = [point for vertices, _faces in clusters for point in vertices]
    center = [
        (min(point[axis] for point in points) + max(point[axis] for point in points)) * 0.5
        for axis in range(3)
    ]
    half = [
        max(abs(point[axis] - center[axis]) for point in points)
        for axis in range(3)
    ]
    target = [
        max(abs(bounds[axis]), abs(bounds[axis + 3]))
        for axis in range(3)
    ]
    scale = min(target[axis] / half[axis] for axis in range(3) if half[axis] > 1e-8)
    return [(
        [[(point[axis] - center[axis]) * scale for axis in range(3)] for point in vertices],
        faces,
    ) for vertices, faces in clusters]


def _bing_spec(index: int) -> dict:
    specs = [
        dict(sides=6, radius=2.35, height=5.2, waistScale=1.0, topScale=0.58, bottomScale=0.72, twist=0.18, sway=0.24, leanX=0.18, leanZ=-0.10, topTip=2.0, bottomTip=1.0),
        dict(sides=5, radius=2.15, height=4.0, waistScale=1.08, topScale=0.0, bottomScale=0.62, twist=-0.34, sway=-0.18, leanX=-0.52, leanZ=0.16, topTip=2.3, bottomTip=0.7),
        dict(sides=4, radius=1.78, height=5.8, waistScale=0.72, topScale=0.38, bottomScale=0.66, twist=0.48, sway=0.34, leanX=0.42, leanZ=0.30, topTip=1.4),
        dict(sides=6, radius=2.65, height=2.5, waistScale=1.16, topScale=0.72, bottomScale=0.86, twist=-0.12, sway=-0.22, leanX=-0.28, leanZ=-0.34, topTip=0.8, bottomTip=0.5),
        dict(sides=3, radius=1.55, height=6.5, waistScale=0.92, topScale=0.0, bottomScale=0.45, twist=0.64, sway=-0.30, leanX=0.58, leanZ=-0.22, topTip=2.6),
        dict(sides=5, radius=2.42, height=4.8, waistScale=1.22, topScale=0.52, bottomScale=0.70, twist=0.28, sway=0.44, leanX=-0.18, leanZ=0.40, topTip=1.7, bottomTip=0.8),
        dict(sides=7, radius=2.05, height=3.7, waistScale=1.02, topScale=0.64, bottomScale=0.82, twist=-0.56, sway=0.20, leanX=0.30, leanZ=-0.46, topTip=0.9, bottomTip=0.45),
        dict(sides=4, radius=2.75, height=3.0, waistScale=0.64, topScale=0.30, bottomScale=0.58, twist=0.22, sway=-0.46, leanX=-0.62, leanZ=0.12, topTip=2.0, bottomTip=1.1),
        dict(sides=6, radius=1.82, height=6.2, waistScale=0.86, topScale=0.34, bottomScale=0.54, twist=-0.20, sway=0.56, leanX=0.48, leanZ=0.48, topTip=2.2),
        dict(sides=5, radius=2.70, height=2.2, waistScale=1.30, topScale=0.82, bottomScale=0.92, twist=0.44, sway=-0.16, leanX=-0.36, leanZ=0.28, topTip=0.6, bottomTip=0.35),
        dict(sides=3, radius=2.05, height=4.6, waistScale=0.74, topScale=0.0, bottomScale=0.52, twist=-0.70, sway=0.36, leanX=-0.50, leanZ=-0.50, topTip=2.8, bottomTip=0.9),
        dict(sides=6, radius=2.25, height=4.2, waistScale=0.98, topScale=0.0, bottomScale=0.60, twist=0.36, sway=-0.54, leanX=0.66, leanZ=-0.16, topTip=1.8, bottomTip=1.2),
        dict(sides=7, radius=1.92, height=5.5, waistScale=0.80, topScale=0.42, bottomScale=0.50, twist=-0.42, sway=0.28, leanX=0.22, leanZ=0.56, topTip=1.5, bottomTip=0.6),
    ]
    return specs[index - 1]


def _build_bing_resource(reference: str, index: int, source_root: Path, web_root: Path) -> dict:
    source = _source_bing(source_root)
    bounds = source["bounds"]
    spec = _bing_spec(index)
    clusters = [_crystal_cluster(spec)]
    if index in (2, 5, 8, 13):
        satellite = dict(spec)
        satellite["radius"] = max(0.55, spec["radius"] * 0.48)
        satellite["height"] = max(1.4, spec["height"] * 0.55)
        satellite["topTip"] = max(0.35, spec.get("topTip", 0.0) * 0.55)
        satellite["bottomTip"] = 0.25
        vertices, faces = _crystal_cluster(satellite)
        offset = (
            spec["radius"] * (0.75 if index % 2 == 0 else -0.85),
            -0.5,
            spec["radius"] * (0.72 if index % 3 == 0 else -0.68),
        )
        clusters.append(([[point[0] + offset[0], point[1] + offset[1], point[2] + offset[2]] for point in vertices], faces))

    clusters = _fit_clusters(clusters, bounds)
    rows = _triangle_rows(clusters, bounds, "ice")
    minx = min(row[0] for row in rows)
    maxx = max(row[0] for row in rows)
    miny = min(row[1] for row in rows)
    maxy = max(row[1] for row in rows)
    minz = min(row[2] for row in rows)
    maxz = max(row[2] for row in rows)
    _ice_texture(web_root)
    return {
        "reference": reference,
        "resolution": "published",
        "nodes": [{
            "name": f"bing_{index}",
            "fvf": 19,
            "vertices": rows,
            "colors": None,
            "parts": [{
                "kind": 0,
                "properties": source["properties"],
                "asset": BING_TEXTURE_ASSET,
                "indices": list(range(len(rows))),
                "textureProvenance": {
                    "kind": "reconstructed",
                    "basis": "bing.TGA and bing.dds are absent in the original resource tree; crystal colour and highlight layout follow the existing bing.POL icy low-poly material.",
                },
            }],
        }],
        "provenance": {
            "kind": "reconstructed",
            "basis": "Missing original bing_i.pol; generated from a distinct low-poly prism/fragment profile using the existing bing.POL section material, 60-triangle crystalline outline and approximately 3.3-unit radius as the visual basis.",
            "sourceEntity": "missing",
            "designDimensions": [maxx - minx, maxy - miny, maxz - minz],
            "triangles": len(rows) // 3,
            "duration": None,
        },
    }


def _bat_body_triangles(flap: float) -> list[tuple[str, list[tuple[float, float, float]]]]:
    triangles: list[tuple[str, list[tuple[float, float, float]]]] = []

    def add(region: str, *points):
        triangles.append((region, [tuple(float(value) for value in point) for point in points]))

    body_rings = [
        (-0.96, 0.06, 0.10),
        (-0.62, 0.34, 0.02),
        (-0.18, 0.47, 0.05),
        (0.28, 0.39, 0.08),
        (0.62, 0.27, 0.13),
        (0.82, 0.17, 0.18),
    ]
    ring_points = []
    for x, radius, y in body_rings:
        ring = []
        for index in range(6):
            angle = 2 * math.pi * index / 6
            ring.append((x, y + math.cos(angle) * radius, math.sin(angle) * radius * 0.84))
        ring_points.append(ring)
    for ring in range(len(ring_points) - 1):
        lower = ring_points[ring]
        upper = ring_points[ring + 1]
        for index in range(6):
            nxt = (index + 1) % 6
            add("body", lower[index], lower[nxt], upper[index])
            add("body", lower[nxt], upper[nxt], upper[index])
    add("body", *reversed(ring_points[0][:3]))
    add("body", *ring_points[0][3:])
    add("body", ring_points[-1][0], ring_points[-1][1], ring_points[-1][2])
    add("body", ring_points[-1][0], ring_points[-1][2], ring_points[-1][3])
    add("body", ring_points[-1][0], ring_points[-1][3], ring_points[-1][4])
    add("body", ring_points[-1][0], ring_points[-1][4], ring_points[-1][5])

    head_ring = []
    for index in range(4):
        angle = 2 * math.pi * (index + 0.5) / 4
        head_ring.append((0.98 + math.cos(angle) * 0.10, 0.16 + math.sin(angle) * 0.24, math.cos(angle) * 0.20))
    nose = (1.28, 0.10, 0.0)
    jaw = (1.16, -0.04, 0.0)
    for index in range(4):
        nxt = (index + 1) % 4
        add("body", head_ring[index], nose, head_ring[nxt])
        add("body", head_ring[index], head_ring[nxt], jaw)

    for side in (-1.0, 1.0):
        add("ear", (0.90, 0.32, side * 0.12), (0.82, 0.68, side * 0.18), (1.05, 0.34, side * 0.05))
        add("ear", (1.00, 0.31, side * 0.10), (0.92, 0.57, side * 0.15), (1.14, 0.28, side * 0.02))

    for side in (-1.0, 1.0):
        shoulder = (0.34, 0.17, side * 0.30)
        elbow_up = (0.02, 0.12, side * 1.16)
        tip = (-0.62, 0.04, side * 1.96)
        trailing = (-0.70, -0.02, side * 0.98)
        rear_root = (-0.34, 0.03, side * 0.24)
        points = []
        for x, y, z in (shoulder, elbow_up, tip, trailing, rear_root):
            amount = abs(z) / 2.05
            points.append((x, y + side * side * flap * amount * 0.62, z))
        front = [points[0], points[1], points[2], points[3], points[4]]
        if side > 0:
            wing_faces = [(0, 2, 1), (0, 3, 2), (0, 4, 3)]
        else:
            wing_faces = [(0, 1, 2), (0, 2, 3), (0, 3, 4)]
        for a, b, c in wing_faces:
            add("membrane", front[a], front[b], front[c])
        thickness = [(x, y - 0.035, z) for x, y, z in front]
        for a, b, c in wing_faces:
            add("membrane", thickness[a], thickness[c], thickness[b])
        for a, b in ((0, 1), (1, 2), (2, 3), (3, 4), (4, 0)):
            add("membrane", front[a], thickness[a], front[b])
            add("membrane", front[b], thickness[a], thickness[b])

    for side in (-1.0, 1.0):
        eye_x = 1.12
        eye_y = 0.19
        eye_z = side * 0.19
        add("eye", (eye_x + 0.04, eye_y + 0.035, eye_z), (eye_x - 0.015, eye_y + 0.025, eye_z + side * 0.012), (eye_x + 0.01, eye_y - 0.035, eye_z))
    for z in (-0.08, 0.0, 0.08):
        add("tooth", (1.20, 0.015, z), (1.20, -0.075, z * 0.55), (1.24, 0.005, z))
    return triangles


def _build_bat_resource(reference: str, _source_root: Path, web_root: Path) -> dict:
    _bat_texture(web_root)
    frames = []
    frame_triangles = None
    for flap in BAT_FLAP:
        triangles = _bat_body_triangles(flap)
        if frame_triangles is None:
            frame_triangles = triangles
        rows = []
        for region, points in triangles:
            normal = _normal(*points)
            for point in points:
                u, v = _uv_bat(point, region)
                rows.append([u, v, *normal, *point])
        frames.append(rows)
    assert frame_triangles is not None
    times = [index / (len(BAT_FLAP) - 1) for index in range(len(BAT_FLAP))]
    all_points = [row[5:8] for frame in frames for row in frame]
    minx = min(point[0] for point in all_points)
    maxx = max(point[0] for point in all_points)
    miny = min(point[1] for point in all_points)
    maxy = max(point[1] for point in all_points)
    minz = min(point[2] for point in all_points)
    maxz = max(point[2] for point in all_points)
    value = struct.unpack("<I", struct.pack("<f", 1.0))[0]
    position_keys = [
        [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
        [BAT_DURATION, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
    ]
    rotation_keys = [
        [0.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 0.0],
        [BAT_DURATION, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 0.0],
    ]
    scale_keys = [
        [0.0, 0.0, 1.0, 1.0, 1.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 0.0],
        [BAT_DURATION, 0.0, 1.0, 1.0, 1.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 0.0],
    ]
    return {
        "reference": reference,
        "resolution": "published",
        "nodes": [{
            "name": "bianfu",
            "fvf": 19,
            "parent": None,
            "animation": {
                "position": {"mode": 3, "keys": position_keys},
                "rotation": {"mode": 3, "keys": rotation_keys},
                "scale": {"mode": 3, "keys": scale_keys},
                "value": value,
            },
            "duration": BAT_DURATION,
            "frames": frames,
            "times": times,
            "parts": [{
                "kind": 0,
                "properties": [1.0] * 8 + [0.0, 0.0, 0.0, 1.0, 1.0, 1.0, 1.0, 1.0, 12.8],
                "asset": BAT_TEXTURE_ASSET,
                "indices": list(range(len(frames[0]))),
                "textureProvenance": {
                    "kind": "reconstructed",
                    "basis": "No bianfu.cvd or bat texture entity exists; the atlas follows the existing nangua.POL and youlincat.POL low-poly cartoon palette with deep-purple body, wide wing membrane, pale eyes and white teeth.",
                },
            }],
        }],
        "provenance": {
            "kind": "reconstructed",
            "basis": "Missing original bat/bianfu.cvd. Low-poly bat body, ears, membrane wings, eyes and teeth are procedurally framed from the missing reference and existing Halloween cartoon model style.",
            "sourceEntity": "missing",
            "designDimensions": [maxx - minx, maxy - miny, maxz - minz],
            "triangles": len(frames[0]) // 3,
            "duration": BAT_DURATION,
            "animation": "nine frames, wing membrane flap with a strict increasing 1.0-second cycle",
        },
    }


def build_reconstructed_model(reference: str, source_root: Path, web_root: Path) -> dict | None:
    """Return a published runtime resource for a supported missing reference."""
    key = _key(reference)
    if key == _key(BAT_REFERENCE):
        return _build_bat_resource(reference, source_root, web_root)
    match = BING_REFERENCE.match(key)
    if match:
        index = int(match.group(1))
        if 1 <= index <= 13:
            return _build_bing_resource(reference, index, source_root, web_root)
    return None


RECONSTRUCTED_REFERENCES = (
    BAT_REFERENCE,
    *[rf"data\effect\effect\bing\bing_{index}.pol" for index in range(1, 14)],
)
