"""Prepare orthographic color projections and silhouette distance data."""

from pathlib import Path

import cv2
import numpy as np
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "apps/web/src/models/reference-hero"
SOURCE = ROOT / "nanobanana-preview-original-2026-10-07T03-03-04-732Z.png"
SIZE = 1024
SCALE = (SIZE - 1) / 1856
image = np.array(Image.open(SOURCE).convert("RGB"))


def silhouette(bounds):
    x0, y0, x1, y1 = bounds
    crop = image[y0:y1, x0:x1]
    mask = ((crop.min(axis=2) < 205) & (crop.mean(axis=2) < 225)).astype("uint8") * 255
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    mask[:] = 0
    cv2.drawContours(mask, [max(contours, key=cv2.contourArea)], -1, 255, -1)
    return crop, mask


front_bounds = (8, 180, 1820, 2055)
front, front_mask = silhouette(front_bounds)
front_transform = np.array([[SCALE, 0, (928 - 918 + front_bounds[0]) * SCALE],
                            [0, SCALE, (front_bounds[1] - 192) * SCALE]], dtype="float32")
mask = cv2.warpAffine(front_mask, front_transform, (SIZE, SIZE), flags=cv2.INTER_LINEAR)
inside = (mask > 127).astype("uint8")
distance = (cv2.distanceTransform(1 - inside, cv2.DIST_L2, cv2.DIST_MASK_PRECISE)
            - cv2.distanceTransform(inside, cv2.DIST_L2, cv2.DIST_MASK_PRECISE)) * 2 / (SIZE - 1)
np.rint(distance * 10000).astype("<i2").tofile(OUTPUT / "silhouette-distance.bin")

atlas = np.zeros((SIZE, SIZE * 3, 3), dtype="uint8")
views = [
    (front_bounds, 918, 928),
    ((2270, 180, 4070, 2055), 3182, 928),
    ((1850, 180, 2240, 2055), 2050, 232),
]
for index, (bounds, center, half_span) in enumerate(views):
    crop, mask = silhouette(bounds)
    r, g, b = [crop[:, :, channel].astype("float32") for channel in range(3)]
    red = (r > g * 1.26) & (r > b * 1.20)
    blue = (b > r * 1.23) & (b > g * 1.05)
    cyan = (g > r * 1.14) & (b > r * 1.14)
    gold = (r > b * 1.20) & (g > b * 1.14) & ~red
    colors = np.full(crop.shape, [168, 168, 176], dtype="float32")
    colors[red] = [178, 39, 48]
    colors[blue] = [34, 71, 126]
    colors[gold] = [193, 159, 96]
    colors[cyan] = [34, 147, 163]
    # Keep the original soft occlusion and facial grooves while removing hard specular highlights.
    colors = colors * .75 + crop.astype("float32") * .25
    colors = np.clip(colors, 0, 255).astype("uint8")
    _, labels = cv2.distanceTransformWithLabels((mask == 0).astype("uint8"),
                                               cv2.DIST_L2, 5, labelType=cv2.DIST_LABEL_PIXEL)
    palette = np.zeros((int(labels.max()) + 1, 3), dtype="uint8")
    palette[labels[mask != 0]] = colors[mask != 0]
    expanded = palette[labels]
    factor = (SIZE - 1) / (half_span * 2)
    transform = np.array([[factor, 0, (half_span - center + bounds[0]) * factor],
                          [0, SCALE, (bounds[1] - 192) * SCALE]], dtype="float32")
    atlas[:, index * SIZE:(index + 1) * SIZE] = cv2.warpAffine(expanded, transform,
                                                            (SIZE, SIZE), borderMode=cv2.BORDER_REPLICATE)

Image.fromarray(atlas).save(OUTPUT / "reference-colors.png", optimize=True)

_, side_mask = silhouette(views[2][0])
profiles = []
for height in np.arange(0, 2.001, .025):
    row = min(side_mask.shape[0] - 1, max(0, round(2048 - height * 928) - 180))
    pixels = np.flatnonzero(side_mask[row])
    if pixels.size:
        front = (int(pixels[0]) + 1850 - 2050) / 928
        back = (int(pixels[-1]) + 1850 - 2050) / 928
    else:
        front, back = -.01, .01
    profiles.append(f"  {{y: {height:.3f}, front: {front:.5f}, back: {back:.5f}}},")
(OUTPUT / "reference-profile.ts").write_text(
    "export const REFERENCE_PROFILE: readonly {y: number; front: number; back: number}[] = [\n"
    + "\n".join(profiles) + "\n];\n", encoding="utf-8")
