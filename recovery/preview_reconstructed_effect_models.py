"""Render offline previews for reconstructed bat and ice model resources."""
from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw

from reconstruct_effect_models import (
    BAT_REFERENCE,
    RECONSTRUCTED_REFERENCES,
    build_reconstructed_model,
)

ROOT = Path(__file__).resolve().parents[1]
SOURCE_ROOT = ROOT / "recovery/output/verified/assets/data"
WEB_ROOT = ROOT / "recovery/output/web-assets"
OUTPUT = ROOT / "recovery/output/reconstructed-battle-preview"


def _project(point, yaw, pitch, scale, origin):
    x, y, z = point
    cy, sy = math.cos(yaw), math.sin(yaw)
    cp, sp = math.cos(pitch), math.sin(pitch)
    xz = x * cy + z * sy
    depth = -x * sy + z * cy
    vertical = y * cp - depth * sp
    return (
        origin[0] + xz * scale,
        origin[1] - vertical * scale,
        depth * cp + y * sp,
    )


def _shade(base, normal, light=(-0.42, -0.78, 0.46)):
    amount = 0.72 + 0.38 * max(0.0, sum(a * b for a, b in zip(normal, light)))
    return tuple(max(0, min(255, round(channel * amount))) for channel in base)


def _fill_mesh(drawer, rows, yaw, pitch, scale, origin, palette, texture=None, animated=False):
    view = [
        {
            "position": row[5:8] if animated else row[0:3],
            "normal": row[2:5] if animated else row[3:6],
            "uv": row[0:2] if animated else row[6:8],
        }
        for row in rows
    ]
    projected = [_project(row["position"], yaw, pitch, scale, origin) for row in view]
    depth = [point[2] for point in projected]
    triangles = []
    for index in range(0, len(rows), 3):
        triangles.append((
            (depth[index] + depth[index + 1] + depth[index + 2]) / 3.0,
            index,
        ))
    for _z, index in sorted(triangles):
        triangle = [index, index + 1, index + 2]
        polygon = [(projected[item][0], projected[item][1]) for item in triangle]
        if texture is not None:
            u = sum(view[item]["uv"][0] for item in triangle) / 3.0
            v = sum(view[item]["uv"][1] for item in triangle) / 3.0
            base = texture.getpixel((
                max(0, min(255, round(u * 255))),
                max(0, min(255, round(v * 255))),
            ))[:3]
        else:
            base = palette[index % len(palette)]
        normal = view[index]["normal"]
        drawer.polygon(polygon, fill=(*_shade(base, normal), 255), outline=(20, 12, 34, 170))


def _bat_preview(resource):
    image = Image.new("RGBA", (1560, 620), (22, 18, 32, 255))
    drawer = ImageDraw.Draw(image, "RGBA")
    texture = Image.open(WEB_ROOT / resource["nodes"][0]["parts"][0]["asset"]).convert("RGBA")
    frame_indices = [0, 2, 4, 6, 8]
    for column, frame_index in enumerate(frame_indices):
        frame = resource["nodes"][0]["frames"][frame_index]
        origin = (170 + column * 305, 320 + (column % 2) * 14)
        _fill_mesh(drawer, frame, yaw=0.54, pitch=0.42, scale=52, origin=origin,
                   palette=[(67, 31, 83)], texture=texture, animated=True)
        drawer.text((120 + column * 305, 560), f"frame {frame_index}", fill=(221, 203, 226, 255))
    image.save(OUTPUT / "bat-flap.png")


def _ice_preview(resources):
    image = Image.new("RGBA", (1040, 780), (215, 231, 235, 255))
    drawer = ImageDraw.Draw(image, "RGBA")
    texture = Image.open(WEB_ROOT / resources[0]["nodes"][0]["parts"][0]["asset"]).convert("RGBA")
    for index, resource in enumerate(resources):
        column = index % 5
        row = index // 5
        origin = (116 + column * 204, 150 + row * 248)
        rows = resource["nodes"][0]["vertices"]
        size = max(resource["provenance"]["designDimensions"])
        scale = 17.5 if size > 5 else 22
        _fill_mesh(drawer, rows, yaw=0.78, pitch=0.62, scale=scale, origin=origin,
                   palette=[(118, 196, 222)], texture=texture)
        label = resource["reference"].rsplit("\\", 1)[-1].replace(".pol", "")
        drawer.text((origin[0] - 34, origin[1] + 84), label, fill=(34, 67, 82, 255))
    image.save(OUTPUT / "ice-13.png")


def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    bat = build_reconstructed_model(BAT_REFERENCE, SOURCE_ROOT, WEB_ROOT)
    ice = [build_reconstructed_model(reference, SOURCE_ROOT, WEB_ROOT)
           for reference in RECONSTRUCTED_REFERENCES[1:]]
    _bat_preview(bat)
    _ice_preview(ice)
    print(OUTPUT / "bat-flap.png")
    print(OUTPUT / "ice-13.png")


if __name__ == "__main__":
    main()
