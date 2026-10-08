"""Render the authored Field Road GLB geometry with its restored PNG artwork.

An offline orthographic raster produces the selector/radar image without a
browser. Requires numpy and Pillow; it uses the radar's native +X/+Z bounds.
"""
import argparse
from functools import lru_cache
import json
from pathlib import Path
import struct

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "recovery/output/web-assets"
ART = ROOT / "art/field-road-hd"
TEXTURES = ART / "png"
BOUNDS = (-2626.316650390625, 1016.7206420898438,
          -1994.4244079589844, 1648.6128845214844)


@lru_cache(maxsize=None)
def model(path):
    data = (ASSETS / path).read_bytes()
    size = struct.unpack_from("<I", data, 12)[0]
    metadata = json.loads(data[20:20 + size])
    return metadata, data[28 + size:]


def accessor(metadata, binary, index):
    spec = metadata["accessors"][index]
    view = metadata["bufferViews"][spec["bufferView"]]
    width = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4}[spec["type"]]
    dtype = {5126: "<f4", 5125: "<u4", 5123: "<u2", 5121: "u1"}[spec["componentType"]]
    offset = view.get("byteOffset", 0) + spec.get("byteOffset", 0)
    stride = view.get("byteStride", np.dtype(dtype).itemsize * width)
    return np.ndarray((spec["count"], width), dtype=dtype, buffer=binary,
                      offset=offset, strides=(stride, np.dtype(dtype).itemsize)).copy()


@lru_cache(maxsize=None)
def texture(path):
    return np.asarray(Image.open(TEXTURES / path).convert("RGBA"))


def node_matrix(node):
    if "matrix" in node:
        return np.array(node["matrix"]).reshape((4, 4), order="F")
    matrix = np.eye(4)
    x, y, z, w = node.get("rotation", [0, 0, 0, 1])
    matrix[:3, :3] = [[1 - 2*y*y - 2*z*z, 2*x*y - 2*z*w, 2*x*z + 2*y*w],
                     [2*x*y + 2*z*w, 1 - 2*x*x - 2*z*z, 2*y*z - 2*x*w],
                     [2*x*z - 2*y*w, 2*y*z + 2*x*w, 1 - 2*x*x - 2*y*y]]
    matrix[:3, :3] *= np.array(node.get("scale", [1, 1, 1]))
    matrix[:3, 3] = node.get("translation", [0, 0, 0])
    return matrix


def render(size, output=None):
    entries = json.loads((ASSETS / "scene-placements.json").read_text())
    scene = next(entry for entry in entries if entry["id"] == "0002")
    pixels = np.zeros((size, size, 4), np.float32)
    pixels[:, :, :3] = [.25, .36, .44]
    pixels[:, :, 3] = 1
    depth = np.full((size, size), -np.inf, np.float32)
    min_x, max_x, min_z, max_z = BOUNDS
    texture_names = {entry["source"].lower(): entry["source"]
                     for entry in json.loads((ART / "inventory.json").read_text())["textures"]}

    def triangle(positions, uvs, colors, image):
        projected = np.column_stack(((positions[:, 0] - min_x) / (max_x - min_x) * size,
                                     (max_z - positions[:, 2]) / (max_z - min_z) * size))
        lo = np.maximum(np.floor(projected.min(axis=0)).astype(int), 0)
        hi = np.minimum(np.ceil(projected.max(axis=0)).astype(int), size - 1)
        if np.any(hi < lo):
            return
        a, b, c = projected
        determinant = (b[1]-c[1])*(a[0]-c[0]) + (c[0]-b[0])*(a[1]-c[1])
        if abs(determinant) < 1e-6:
            return
        yy, xx = np.mgrid[lo[1]:hi[1]+1, lo[0]:hi[0]+1]
        xx, yy = xx + .5, yy + .5
        first = ((b[1]-c[1])*(xx-c[0]) + (c[0]-b[0])*(yy-c[1])) / determinant
        second = ((c[1]-a[1])*(xx-c[0]) + (a[0]-c[0])*(yy-c[1])) / determinant
        weights = np.stack((first, second, 1-first-second), axis=-1)
        height = weights @ positions[:, 1]
        local_depth = depth[lo[1]:hi[1]+1, lo[0]:hi[0]+1]
        visible = (weights.min(axis=-1) >= -.00001) & (height >= local_depth)
        if not visible.any():
            return
        uv = weights @ uvs
        th, tw = image.shape[:2]
        # glTF image top-left corresponds to v=0; imported UVs retain that origin.
        tx = np.mod(uv[:, :, 0], 1) * (tw - 1)
        ty = np.mod(uv[:, :, 1], 1) * (th - 1)
        ix, iy = tx.astype(int), ty.astype(int)
        fx, fy = (tx - ix)[..., None], (ty - iy)[..., None]
        rgba = (image[iy, ix] * (1-fx) + image[iy, (ix+1) % tw] * fx) * (1-fy)
        rgba += (image[(iy+1) % th, ix] * (1-fx) + image[(iy+1) % th, (ix+1) % tw] * fx) * fy
        rgba /= 255
        rgba *= np.clip(weights @ colors, 0, 1)
        visible &= rgba[:, :, 3] > 100 / 255
        target = pixels[lo[1]:hi[1]+1, lo[0]:hi[0]+1]
        alpha = rgba[:, :, 3:4]
        target[visible, :3] = (rgba[:, :, :3] * alpha + target[:, :, :3] * (1-alpha))[visible]
        local_depth[visible] = height[visible]

    def draw_model(path, placement=None):
        metadata, binary = model(path)
        root = np.eye(4)
        if placement:
            root = np.array(placement["matrix"]).reshape((4, 4), order="F")
            root[:3, 3] = placement["position"]

        def visit(index, parent):
            node = metadata["nodes"][index]
            transform = parent @ node_matrix(node)
            if "mesh" in node:
                mesh = metadata["meshes"][node["mesh"]]
                for primitive in mesh["primitives"]:
                    attrs = primitive["attributes"]
                    positions = accessor(metadata, binary, attrs["POSITION"])
                    homogeneous = np.column_stack((positions, np.ones(len(positions))))
                    positions = (homogeneous @ transform.T)[:, :3]
                    uvs = accessor(metadata, binary, attrs["TEXCOORD_0"])
                    colors = accessor(metadata, binary, attrs["COLOR_0"]) if "COLOR_0" in attrs else np.ones((len(positions), 4))
                    material = metadata["materials"][primitive["material"]]
                    name = str(Path(path).parent / (Path(material["name"]).stem + ".png"))
                    name = texture_names[name.lower()]
                    image = texture(name)
                    indices = accessor(metadata, binary, primitive["indices"]).ravel() if "indices" in primitive else np.arange(len(positions))
                    for vertices in indices.reshape((-1, 3)):
                        triangle(positions[vertices], uvs[vertices], colors[vertices], image)
            for child in node.get("children", []):
                visit(child, transform)
        for index in metadata["scenes"][metadata.get("scene", 0)]["nodes"]:
            visit(index, root)

    draw_model(scene["terrain"])
    print("Terrain rendered", flush=True)
    draw_model("Data/map/0002/water.glb")
    for placement in scene["records"]:
        if placement.get("asset") and placement.get("enabled", 1):
            draw_model(placement["asset"], placement)
    for placement in scene["castles"]:
        draw_model(f"Data/scnobj/{placement['model']}/n1.glb", placement)
    result = Image.fromarray(np.uint8(np.clip(pixels, 0, 1) * 255))
    destination = output or ART / "map-preview.png"
    destination.parent.mkdir(parents=True, exist_ok=True)
    result.save(destination)
    if output is None:
        result.resize((1024, 1024), Image.Resampling.LANCZOS).save(ROOT / "apps/web/src/assets/maps/minimaps/1002.png")
    print(destination, flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--size", type=int, default=1536)
    parser.add_argument("--texture-root", type=Path, default=TEXTURES)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    TEXTURES = args.texture_root
    render(args.size, args.output)
