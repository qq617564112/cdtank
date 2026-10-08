"""Trace the original Field Road artwork into curves and rasterize at 4x.

Dependencies: Pillow, vtracer 0.6.15, CairoSVG 2.9.1.
The source coordinate system and separate alpha contours retain atlas placement.
"""
import argparse
import io
import json
from pathlib import Path
import xml.etree.ElementTree as ET

import cairosvg
from PIL import Image
import vtracer


NS = "http://www.w3.org/2000/svg"
ET.register_namespace("", NS)


def curves(image, difference=6, precision=8, hierarchical="stacked"):
    stream = io.BytesIO()
    image.save(stream, format="PNG")
    return ET.fromstring(vtracer.convert_raw_image_to_svg(
        stream.getvalue(), img_format="png", colormode="color",
        hierarchical=hierarchical, mode="spline", filter_speckle=0,
        color_precision=precision, layer_difference=difference,
        corner_threshold=60, length_threshold=3.5, max_iterations=10,
        splice_threshold=45, path_precision=3))


def convert(source, svg_path, png_path, difference=6):
    original = Image.open(source).convert("RGBA")
    width, height = original.size
    root = curves(original.convert("RGB"), difference)
    root.set("viewBox", f"0 0 {width} {height}")
    root.set("width", str(width * 4))
    root.set("height", str(height * 4))
    alpha = original.getchannel("A")
    alpha_curves = None
    lo, hi = alpha.getextrema()
    if lo == hi:
        if hi != 255:
            group = ET.Element(f"{{{NS}}}g", {"opacity": f"{hi / 255:.6f}"})
            group.extend(list(root))
            root.clear()
            root.attrib.update(viewBox=f"0 0 {width} {height}",
                               width=str(width * 4), height=str(height * 4))
            root.append(group)
    else:
        mask = ET.Element(f"{{{NS}}}mask", {
            "id": "source-alpha", "maskUnits": "userSpaceOnUse",
            "x": "0", "y": "0", "width": str(width), "height": str(height)})
        # Grayscale paths preserve both cutout silhouettes and partial opacity.
        mask.set("mask-type", "luminance")
        alpha_curves = curves(alpha.convert("RGB"), 1)
        mask.extend(list(alpha_curves))
        defs = ET.Element(f"{{{NS}}}defs")
        defs.append(mask)
        group = ET.Element(f"{{{NS}}}g", {"mask": "url(#source-alpha)"})
        group.extend(list(root))
        root[:] = [defs, group]
    svg_path = Path(svg_path)
    png_path = Path(png_path)
    svg_path.parent.mkdir(parents=True, exist_ok=True)
    png_path.parent.mkdir(parents=True, exist_ok=True)
    data = ET.tostring(root, encoding="utf-8", xml_declaration=True)
    svg_path.write_bytes(data)
    if alpha_curves is None:
        cairosvg.svg2png(bytestring=data, write_to=str(png_path),
                        output_width=width * 4, output_height=height * 4)
    else:
        # CairoSVG masks support alpha only; render the vector luminance mask
        # separately, then apply it to the curve render for the same SVG result.
        group.attrib.pop("mask")
        rgb = Image.open(io.BytesIO(cairosvg.svg2png(
            bytestring=ET.tostring(root), output_width=width * 4,
            output_height=height * 4))).convert("RGBA")
        coverage = Image.open(io.BytesIO(cairosvg.svg2png(
            bytestring=ET.tostring(alpha_curves), output_width=width * 4,
            output_height=height * 4))).convert("L")
        rgb.putalpha(coverage)
        rgb.save(png_path)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--assets", type=Path, required=True)
    parser.add_argument("--inventory", type=Path,
                        default=Path("art/field-road-hd/inventory.json"))
    parser.add_argument("--output", type=Path, default=Path("."))
    parser.add_argument("--prefix", default="")
    args = parser.parse_args()
    for entry in json.loads(args.inventory.read_text())["textures"]:
        if not entry["source"].startswith(args.prefix):
            continue
        convert(args.assets / entry["source"], args.output / entry["svg"],
                args.output / entry["png"])
        print(entry["source"], flush=True)


if __name__ == "__main__":
    main()
