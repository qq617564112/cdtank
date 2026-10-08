"""Batch Field Road texture restoration with fixed atlas cells and a call ledger.

Requires Pillow, numpy and OpenCV. Authentication is read from CHATGPT2API_AUTH_KEY or a
hidden terminal prompt; the key is never saved with the artwork or call ledger.
"""
import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
import getpass
import json
import os
from pathlib import Path
import threading
import sys

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
ART = ROOT / "art/field-road-hd"
ASSETS = Path(os.environ.get("WEB_ASSETS", ROOT / "recovery/output/web-assets"))
MODEL = "gpt-image-2"
SKILL = Path(os.environ.get("CHATGPT2API_SKILL", "/workspace/self-skills/chatgpt2api-image-api"))
LOCK = threading.Lock()


def save_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n")


def prepare():
    inventory = json.loads((ART / "inventory.json").read_text())
    textures = inventory["textures"]
    unique = []
    duplicates = {}
    for entry in textures:
        image = Image.open(ASSETS / entry["source"]).convert("RGBA")
        pixels = image.tobytes()
        match = next((source for source, size, data in unique
                      if size == image.size and data == pixels), None)
        if match:
            duplicates[entry["source"]] = match
        else:
            unique.append((entry["source"], image.size, pixels))
    reused = "Data/map/0002/lu01.png"
    sources = [source for source, _, _ in unique if source != reused]
    water = [source for source in sources if "/image/water/" in source]
    large = [source for source in sources if Image.open(ASSETS / source).width == 512]
    roads = [source for source in sources if "/0002/lu" in source or "/0002/x04_lu" in source]
    small = [source for source in sources if source not in water + large + roads]
    batches = []

    def group(category, items, count, columns, cell, target_cell):
        for start in range(0, len(items), count):
            selection = items[start:start + count]
            cols = min(columns, len(selection))
            rows = (len(selection) + cols - 1) // cols
            first_batch = 2 if category == "water" else 1
            batch_id = f"{category}-{start // count + first_batch:02d}"
            output_cell = 2048 if category == "buildings" and len(selection) == 1 else target_cell
            source_inset = 4 if category == "water" else 0
            input_path = ART / "batches" / f"{batch_id}-input.png"
            image = Image.new("RGB", (cols * cell, rows * cell), "#665744")
            cells = []
            for index, source in enumerate(selection):
                x, y = index % cols, index // cols
                original = Image.open(ASSETS / source).convert("RGB")
                inner = cell - source_inset * 2
                image.paste(original.resize((inner, inner), Image.Resampling.LANCZOS),
                            (x * cell + source_inset, y * cell + source_inset))
                cells.append({"source": source, "column": x, "row": y})
            input_path.parent.mkdir(parents=True, exist_ok=True)
            image.save(input_path)
            size = [cols * output_cell, rows * output_cell]
            prompt = f'''Use case: precise-object-edit.
Asset type: an atlas of independent existing Field Road game textures.
Image 1 is the exact edit target. Image 2 is approved artwork showing the desired restoration quality; use its clean painted detail, not its composition.
Restore image 1 at native {size[0]}x{size[1]} pixels. Preserve its fixed {cols}-column by {rows}-row grid EXACTLY. Each cell is {output_cell}x{output_cell} pixels in the output. There are no gutters, borders or labels. Treat EVERY cell as a separate texture, not a continuous scene. Cell order is left to right, top to bottom. Empty trailing cells must remain empty.
Retain every cell's exact composition, object count, shapes, silhouette positions, atlas UV islands, crop, orientation, palette, light and dark areas and edge contents. Do not move or resize anything inside the cells. Preserve all narrow texture strips and tiny details in building atlases. Preserve the golden ochre roads, green foliage and cyan flowers wherever present. Do not transfer plants, flowers or paving stones from image 2 into cells where they do not exist.
Repaint at high resolution with crisp natural contours, smoothly blended painted gradients and clear restrained fine detail, matching the original cartoon game-art style. No perspective, no 3D rendering, no photorealism, no redesign, no extra objects, no text, no watermark, no panel borders or padding. Keep all original RGB background colors; transparency is applied separately.
Return just ONE {size[0]}x{size[1]} texture atlas, with the same full-canvas layout as image 1.'''
            if category == "water":
                image_background = Image.new("RGB", image.size, "#000000")
                for index, source in enumerate(selection):
                    image_background.paste(Image.open(ASSETS / source).convert("RGB"),
                                           (index % cols * cell + source_inset,
                                            index // cols * cell + source_inset))
                image_background.save(input_path)
                prompt = f'''Restore this exact texture sprite sheet to native {size[0]}x{size[1]} resolution, 4 times its original resolution.
It contains EXACTLY 16 independent blue-and-white water caustic animation frames, in EXACTLY 4 columns and 4 rows. Preserve their order, individual shapes, colors and wave progression exactly. Each source slot is 72x72 pixels, containing a 64x64 water image with a 4-pixel solid black margin on every side. Output slots must be EXACTLY 288x288 pixels, containing a 256x256 water image with a 16-pixel solid black margin on every side. Keep these black separators straight and completely unchanged. Keep all 16 frames completely within their original cells. There must be no fifth row or fifth column.
Smoothly repaint the original low-resolution water highlights and blue gradients into clearer high-resolution texture detail while preserving the reference geometry and style. Do not add, move or duplicate any frame. Do not merge cells into a continuous water surface. No other objects, words, labels or decorations. Output just the same 4x4 black-bordered sprite sheet, native {size[0]}x{size[1]} pixels.'''
            if category == "road-corner":
                prompt += '''
The lower-right corner MUST retain the original diagonal strip of green leaves, pale stone pavement, dark stone outlines and sandy ground. The road must enter the right and bottom edges at exactly the original positions. Do not replace this road corner with grass.'''
            prompt_path = ART / "batches" / f"{batch_id}-prompt.txt"
            prompt_path.write_text(prompt + "\n")
            batch = {"id": batch_id, "category": category,
                            "input": str(input_path.relative_to(ROOT)),
                            "prompt": str(prompt_path.relative_to(ROOT)),
                            "output": f"art/field-road-hd/batches/{batch_id}-output.png",
                     "size": size, "cellSize": output_cell, "cells": cells}
            if category == "water":
                batch["inset"] = 16
            batches.append(batch)

    group("roads", roads, 6, 3, 256, 1024)
    group("small", small, 6, 3, 256, 1024)
    group("buildings", large, 2, 2, 512, 1920)
    group("water", water, 16, 4, 72, 288)
    group("road-corner", ["Data/map/0002/lu15.png"], 1, 1, 256, 2048)
    inventory["duplicates"] = duplicates
    inventory["reused"] = {reused: "art/field-road-hd/reference-approved.png"}
    for entry in textures:
        entry.pop("svg", None)
    save_json(ART / "inventory.json", inventory)
    save_json(ART / "batch-plan.json", {"model": MODEL, "callLimit": 23,
                                       "plannedCalls": len(batches), "batches": batches})
    print(f"{len(textures)} textures, {len(duplicates)} duplicates, {len(batches)} planned calls", flush=True)


def generate(batches, concurrency, call_limit):
    sys.path.insert(0, str(SKILL / "scripts"))
    import common
    key = os.environ.get("CHATGPT2API_AUTH_KEY") or getpass.getpass("API key: ")
    base_url = common.resolve_base_url(os.environ.get("CHATGPT2API_BASE_URL", "https://gptimg.cloyd.fun/"))
    ledger_path = ART / "calls.json"
    ledger = json.loads(ledger_path.read_text()) if ledger_path.exists() else []
    reference = ART / "reference-approved.png"

    def call(batch):
        destination = ROOT / batch["output"]
        if destination.exists():
            return batch["id"] + ": reused saved output"
        with LOCK:
            if len(ledger) >= call_limit:
                return batch["id"] + ": call limit reached"
            record = {"call": len(ledger) + 1, "batch": batch["id"],
                      "started": datetime.now(timezone.utc).isoformat(), "status": "submitted"}
            ledger.append(record)
            save_json(ledger_path, ledger)
        print(f"Call {record['call']}: {batch['id']} ({len(batch['cells'])} textures)", flush=True)
        input_paths = [ROOT / batch["input"]]
        if batch["category"] != "water":
            input_paths.append(reference)
        try:
            status, parsed = common.request_multipart("POST", base_url + "/v1/images/edits",
                headers=common.auth_headers(key), fields=[("prompt", (ROOT / batch["prompt"]).read_text()),
                ("model", MODEL), ("n", "1"), ("response_format", "b64_json"),
                ("size", f"{batch['size'][0]}:{batch['size'][1]}")],
                files=[("image", path) for path in input_paths])
            paths = common.save_image_results(parsed, output_dir=destination.parent,
                prefix=batch["id"] + "-result", download_url_results=True)
            if not paths:
                raise ValueError("Response contains no image")
            image = Image.open(paths[0]).convert("RGB")
            record["http"] = status
            record["actualSize"] = list(image.size)
            image.save(destination)
            record["status"] = "complete"
            return f"{batch['id']}: {image.width}x{image.height}"
        except Exception as error:
            record["status"] = "failed"
            record["error"] = str(error).replace(key, "[REDACTED]")[:800]
            return batch["id"] + ": " + record["error"]
        finally:
            record["finished"] = datetime.now(timezone.utc).isoformat()
            with LOCK:
                save_json(ledger_path, ledger)

    with ThreadPoolExecutor(max_workers=concurrency) as executor:
        futures = [executor.submit(call, batch) for batch in batches]
        for future in as_completed(futures):
            print(future.result(), flush=True)


def preserve_texture(source, generated):
    original = Image.open(source).convert("RGBA")
    original_hd = original.resize(generated.size, Image.Resampling.LANCZOS)
    rgb = np.asarray(generated.convert("RGB"), dtype=np.float32)
    old = np.asarray(original_hd, dtype=np.float32)
    width, height = generated.size
    tile = source.parent.name == "0002" and (
        source.stem.startswith(("lu", "x04_lu", "x04_shanpo"))
        or source.stem in {"x04_caodi", "x04_hean"})
    if tile:
        # Register the restored contours to the authored positions before
        # combining colour and detail, so leaves and stones have one outline.
        alignment_size = 512
        authored = np.asarray(original.convert("RGB").resize(
            (alignment_size, alignment_size), Image.Resampling.LANCZOS))
        restored = np.asarray(generated.convert("RGB").resize(
            (alignment_size, alignment_size), Image.Resampling.LANCZOS))
        authored_gray = cv2.GaussianBlur(cv2.cvtColor(authored, cv2.COLOR_RGB2GRAY), (0, 0), 1)
        restored_gray = cv2.GaussianBlur(cv2.cvtColor(restored, cv2.COLOR_RGB2GRAY), (0, 0), 1)
        flow = cv2.DISOpticalFlow_create(cv2.DISOPTICAL_FLOW_PRESET_MEDIUM).calc(
            authored_gray, restored_gray, None)
        flow = cv2.resize(flow, (width, height))
        flow *= np.array([width, height], dtype=np.float32) / alignment_size
        yy, xx = np.mgrid[:height, :width].astype(np.float32)
        generated = Image.fromarray(cv2.remap(np.asarray(generated.convert("RGB")),
            xx + flow[:, :, 0], yy + flow[:, :, 1], cv2.INTER_CUBIC,
            borderMode=cv2.BORDER_REFLECT_101))
        rgb = np.asarray(generated, dtype=np.float32)
        # The authored terrain supplies shape and colour at every UV position;
        # the restoration supplies fine detail. Independent atlas cells must
        # not change the grass palette or the road's connection points.
        radius = width / original.width * 3
        authored_base = np.asarray(original_hd.convert("RGB").filter(
            ImageFilter.GaussianBlur(radius)), dtype=np.float32)
        restored_base = np.asarray(generated.convert("RGB").filter(
            ImageFilter.GaussianBlur(radius)), dtype=np.float32)
        rgb += authored_base - restored_base
    # Tiled textures retain a wider authored transition around their edges.
    border = max(2, round(width / original.width * (12 if tile else 2)))
    xx, yy = np.arange(width), np.arange(height)
    edge = np.minimum(np.minimum(xx, width - 1 - xx)[None, :],
                      np.minimum(yy, height - 1 - yy)[:, None]).astype(np.float32)
    weight = np.clip(edge / border, 0, 1)
    weight = (weight * weight * (3 - 2 * weight))[..., None]
    result = Image.fromarray(np.uint8(np.clip(rgb * weight + old[..., :3] * (1 - weight), 0, 255)))
    # Keep the authored cutouts, water alpha and atlas UV coverage exactly placed.
    result.putalpha(original_hd.getchannel("A"))
    return result


def extract():
    plan = json.loads((ART / "batch-plan.json").read_text())
    inventory = json.loads((ART / "inventory.json").read_text())
    textures = {entry["source"]: entry for entry in inventory["textures"]}
    completed = {record["batch"] for record in json.loads((ART / "calls.json").read_text())
                 if record["status"] == "complete"}
    for batch in plan["batches"]:
        path = ROOT / batch["output"]
        if batch["id"] not in completed:
            continue
        image = Image.open(path).convert("RGB")
        columns = batch["size"][0] // batch["cellSize"]
        rows = batch["size"][1] // batch["cellSize"]
        for cell in batch["cells"]:
            x, y = cell["column"], cell["row"]
            crop = image.crop((round(x * image.width / columns), round(y * image.height / rows),
                               round((x + 1) * image.width / columns), round((y + 1) * image.height / rows)))
            if batch.get("inset"):
                # Generated separators can shift a few pixels. Isolate each
                # blue/white frame inside its known slot before removing them.
                coverage = np.max(np.asarray(crop), axis=2) > 32
                yy, xx = np.nonzero(coverage)
                crop = crop.crop((xx.min(), yy.min(), xx.max() + 1, yy.max() + 1))
                inner = batch["cellSize"] - batch["inset"] * 2
                crop = crop.resize((inner, inner), Image.Resampling.LANCZOS)
            result = preserve_texture(ASSETS / cell["source"], crop)
            destination = ROOT / textures[cell["source"]]["png"]
            destination.parent.mkdir(parents=True, exist_ok=True)
            result.save(destination)
    for source, path in inventory["reused"].items():
        destination = ROOT / textures[source]["png"]
        destination.parent.mkdir(parents=True, exist_ok=True)
        preserve_texture(ASSETS / source, Image.open(ROOT / path)).save(destination)
    for source, original in inventory["duplicates"].items():
        destination = ROOT / textures[source]["png"]
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes((ROOT / textures[original]["png"]).read_bytes())
    for entry in inventory["textures"]:
        path = ROOT / entry["png"]
        if path.exists():
            entry["outputSize"] = list(Image.open(path).size)
    save_json(ART / "inventory.json", inventory)


def overview():
    inventory = json.loads((ART / "inventory.json").read_text())
    entries = inventory["textures"]
    font = ImageFont.load_default(size=13)
    width, height = 180, 215
    columns = 8
    canvas = Image.new("RGB", (columns * width, ((len(entries) + columns - 1) // columns) * height), "#e5e5dd")
    draw = ImageDraw.Draw(canvas)
    for index, entry in enumerate(entries):
        path = ROOT / entry["png"]
        if not path.exists():
            continue
        image = Image.open(path).convert("RGBA")
        image.thumbnail((164, 164))
        x, y = index % columns * width, index // columns * height
        canvas.paste(image, (x + 8, y + 8), image)
        draw.text((x + 8, y + 177), Path(entry["source"]).name, fill="#273727", font=font)
        draw.text((x + 8, y + 196), " x ".join(map(str, entry.get("outputSize", []))), fill="#576457", font=font)
    canvas.save(ART / "overview.png")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("action", choices=["prepare", "generate", "extract", "overview"])
    parser.add_argument("--concurrency", type=int, default=4)
    parser.add_argument("--limit", type=int, default=23)
    parser.add_argument("--ids", nargs="*")
    args = parser.parse_args()
    if args.action == "prepare":
        prepare()
    elif args.action == "generate":
        batches = json.loads((ART / "batch-plan.json").read_text())["batches"]
        if args.ids:
            batches = [batch for batch in batches if batch["id"] in args.ids]
        generate(batches, args.concurrency, min(args.limit, 23))
    elif args.action == "extract":
        extract()
    else:
        overview()


if __name__ == "__main__":
    main()
