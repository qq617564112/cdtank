"""Redraw complete original object atlases and restore their model UV layout."""

import argparse
from contextlib import contextmanager
import fcntl
import importlib.util
import json
from pathlib import Path
import shutil

import cv2
import numpy as np
from PIL import Image, ImageDraw

from assets import ROOT, object_entry, texture_files, uv_triangles

spec = importlib.util.spec_from_file_location('tank_image_api', ROOT / 'tools/tank-api/process.py')
api = importlib.util.module_from_spec(spec)
spec.loader.exec_module(api)
cv2.setNumThreads(2)


def paths(workspace, model):
    output = Path(workspace) / 'output/imagegen/map-api4k' / model
    relative = object_entry(model).get('sourceFolder', 'Data/scnobj/' + model)
    public = Path(workspace) / 'apps/web/public/map-audit/api4k' / relative
    output.mkdir(parents=True, exist_ok=True)
    public.mkdir(parents=True, exist_ok=True)
    return output, public


@contextmanager
def one_request(workspace):
    folder = Path(workspace) / 'output/imagegen/map-api4k'
    folder.mkdir(parents=True, exist_ok=True)
    with (folder / '.image-request.lock').open('a') as handle:
        fcntl.flock(handle, fcntl.LOCK_EX)
        yield


def uv_mask(model, filename, size):
    mask = Image.new('L', size)
    draw = ImageDraw.Draw(mask)
    triangles = uv_triangles(model, filename)
    for triangle in triangles:
        # Repeated texture coordinates are rasterized into the same unit tile.
        low, high = np.floor(triangle.min(axis=0)).astype(int), np.floor(triangle.max(axis=0)).astype(int)
        for x in range(low[0], high[0] + 1):
            for y in range(low[1], high[1] + 1):
                points = (triangle - [x, y]) * np.array(size)
                draw.polygon([tuple(point) for point in points], fill=255)
    if not triangles.size:
        draw.rectangle((0, 0, size[0], size[1]), fill=255)
    return np.array(mask)


def prepare(model, workspace, selected=None):
    output, _ = paths(workspace, model)
    for folder in ('inputs', 'native', 'prompts', 'metadata'):
        (output / folder).mkdir(exist_ok=True)
    for source in texture_files(model):
        if selected and source.name not in selected:
            continue
        original = Image.open(source).convert('RGBA')
        factor = 2048 / max(original.size)
        size = tuple(round(value * factor) for value in original.size)
        image = original.resize(size, Image.Resampling.NEAREST)
        uv = uv_mask(model, source.name, size)
        alpha = np.array(image.getchannel('A'))
        core = np.uint8((uv > 0) & (alpha > 0)) * 255
        gutter = max(2, round(factor))
        grown = cv2.dilate(core, np.ones((gutter * 2 + 1,) * 2, np.uint8))
        ring = (cv2.dilate(grown, np.ones((5, 5), np.uint8)) > 0) & (grown == 0)
        pixels = np.full((size[1], size[0], 3), 190, np.uint8)
        rgb = np.array(image.convert('RGB'))
        pixels[grown > 0] = rgb[grown > 0]
        pixels[ring] = 245
        margin = tuple(max(8, round(value / 64)) for value in size)
        canvas = Image.new('RGB', (size[0] + margin[0] * 2, size[1] + margin[1] * 2), (190,) * 3)
        canvas.paste(Image.fromarray(pixels), margin)
        ImageDraw.Draw(canvas).rectangle((margin[0] - 3, margin[1] - 3,
            margin[0] + size[0] + 2, margin[1] + size[1] + 2), outline=(245,) * 3, width=2)
        canvas.save(output / 'inputs' / source.name)
        prompt = ('将这一张地图物体的完整二维UV贴图忠实高清化，输出4K。'
            '保持原来的卡通风格、全部图案、配色、明暗关系和细节数量，线条清晰锐利。'
            '灰色是不透明辅助背景，白色细边是固定边界。保留整个画布和外框，'
            '边界内图块的位置、大小、方向、形状与输入完全一致，不移动、旋转、变形或重新排版。'
            '树叶、孔洞和缺口的轮廓保持原样，灰底保持灰色，白色引导边保持白色。'
            '文字和符号逐笔忠实描摹，保留原始方向；直线平直，圆形规则。'
            '只高清化已有内容，不添加木纹、裂缝、铆钉、光泽或其它新细节。'
            '输出相同布局的平面二维贴图，无透视、无3D模型、无水印。')
        (output / 'prompts' / (source.stem + '.txt')).write_text(prompt + '\n')
        api.save_json(output / 'inputs' / (source.stem + '.json'), {
            'atlasSize': list(size), 'margin': list(margin), 'canvasSize': list(canvas.size),
            'sourceSize': list(original.size)})
        print(f'{source.name}: opaque complete atlas prepared', flush=True)


def generate(model, workspace, selected, revision):
    output, _ = paths(workspace, model)
    config = json.loads((api.PRIVATE / 'image-config.json').read_text())
    capabilities = api.PRIVATE / 'capabilities.json'
    if capabilities.exists():
        config.update(json.loads(capabilities.read_text()))
    for source in texture_files(model):
        if selected and source.name not in selected:
            continue
        native = output / 'native' / source.name
        metadata_path = output / 'metadata' / (source.stem + '.json')
        if api.valid_image(native) and metadata_path.exists() and not revision:
            print(f'{source.name}: existing result', flush=True)
            continue
        prepare(model, workspace, [source.name])
        input_path = output / 'inputs' / source.name
        if not api.valid_image(input_path):
            raise RuntimeError(f'Missing reference: {input_path}')
        if not revision and reuse_completed(model, source, workspace, input_path):
            continue
        original = Image.open(source)
        maximum = config.get('requestWidth', 4096)
        size = tuple(round(maximum * value / max(original.size)) for value in original.size)
        prompt = (output / 'prompts' / (source.stem + '.txt')).read_text().strip()
        if revision:
            prompt += '\n完整原图描摹要求：' + revision
        (output / 'prompts' / (source.stem + '-request.txt')).write_text(prompt + '\n')
        metadata = {'filename': source.name, 'object': model, 'model': config['model'],
            'endpoint': config['base'].rstrip('/') + '/images/edits',
            'requestedSize': f'{size[0]}x{size[1]}', 'quality': 'high',
            'inputsPerRequest': 1, 'background': 'opaque', 'status': 'submitted',
            'generationScope': 'whole-atlas', 'reference': str(source),
            'input': str(input_path), 'corrections': []}
        item = next(row for row in object_entry(model)['textures'] if row['filename'] == source.name)
        metadata['originalSource'] = item.get('originalSource', str(source.relative_to(ROOT)))
        with one_request(workspace):
            api.submit_edit(input_path, native, metadata_path, metadata, config, workspace, prompt)


def reuse_completed(model, source, workspace, input_path):
    candidates = json.loads((ROOT / 'tools/map-api/reuse.json').read_text()) if (ROOT / 'tools/map-api/reuse.json').exists() else {}
    key = model + '/' + source.name
    output, public = paths(workspace, model)
    for candidate in candidates.get(key, []):
        other_model, filename = candidate.split('/', 1)
        other = Path(workspace) / 'output/imagegen/map-api4k' / other_model
        review_path = other / 'review.json'
        if not review_path.exists():
            continue
        review = json.loads(review_path.read_text())
        if review.get('status') != 'passed' or review.get('confirmedIssueCount') != 0 or review.get('unresolvedCount') != 0:
            continue
        prepared = other / 'inputs' / filename
        if not prepared.exists():
            continue
        with Image.open(input_path) as current, Image.open(prepared) as previous:
            if current.size != previous.size or current.convert('RGB').tobytes() != previous.convert('RGB').tobytes():
                continue
        other_native = other / 'native' / filename
        other_metadata = other / 'metadata' / (Path(filename).stem + '.json')
        if not api.valid_image(other_native) or not other_metadata.exists():
            continue
        shutil.copy2(other_native, output / 'native' / source.name)
        metadata = json.loads(other_metadata.read_text())
        metadata.update(filename=source.name, object=model, reference=str(source), input=str(input_path),
                        reusedFrom=candidate, corrections=[])
        item = next(row for row in object_entry(model)['textures'] if row['filename'] == source.name)
        metadata['originalSource'] = item.get('originalSource', str(source.relative_to(ROOT)))
        metadata.pop('runtime', None)
        api.save_json(output / 'metadata' / (source.stem + '.json'), metadata)
        print(f'{source.name}: reused complete atlas from {candidate}; no API request', flush=True)
        return True
    return False


def registered(reference, pixels, mask):
    count, labels, stats, _ = cv2.connectedComponentsWithStats(mask)
    result = pixels.copy()
    records = []
    for label in range(1, count):
        x, y, width, height, _ = stats[label]
        margin = max(4, round(max(pixels.shape[:2]) / 256 * 3))
        x0, y0 = max(0, x - margin), max(0, y - margin)
        x1, y1 = min(pixels.shape[1], x + width + margin), min(pixels.shape[0], y + height + margin)
        region = labels[y0:y1, x0:x1] == label
        old = cv2.cvtColor(reference[y0:y1, x0:x1], cv2.COLOR_RGB2GRAY)
        new = cv2.cvtColor(pixels[y0:y1, x0:x1], cv2.COLOR_RGB2GRAY)
        scale = min(1, 600 / max(old.shape))
        shape = tuple(max(8, round(value * scale)) for value in (old.shape[1], old.shape[0]))
        old_small, new_small = [cv2.resize(value, shape).astype(np.float32) / 255 for value in (old, new)]
        valid = cv2.erode(cv2.resize(np.uint8(region), shape, interpolation=cv2.INTER_NEAREST), np.ones((3, 3), np.uint8))
        warp = np.eye(2, 3, dtype=np.float32)
        correlation = None
        try:
            correlation, fitted = cv2.findTransformECC(old_small, new_small, warp.copy(),
                cv2.MOTION_AFFINE, (cv2.TERM_CRITERIA_COUNT | cv2.TERM_CRITERIA_EPS, 60, .0001), valid, 5)
            if correlation >= .5:
                center = np.float32([shape[0] / 2, shape[1] / 2])
                displacement = fitted[:, :2] @ center + fitted[:, 2] - center
                limit = np.minimum(margin, np.array([width, height]) * .08) * scale
                warp[:, :2] = np.diag(np.clip(np.diag(fitted[:, :2]), .98, 1.02))
                warp[:, 2] = (center + np.clip(displacement, -limit, limit) - warp[:, :2] @ center) / scale
        except cv2.error:
            pass
        aligned = cv2.warpAffine(pixels[y0:y1, x0:x1], warp, (x1 - x0, y1 - y0),
            flags=cv2.INTER_LINEAR | cv2.WARP_INVERSE_MAP, borderMode=cv2.BORDER_REPLICATE)
        result[y0:y1, x0:x1][region] = aligned[region]
        records.append({'bounds': [int(x), int(y), int(width), int(height)],
                        'correlation': None if correlation is None else float(correlation),
                        'transform': warp.tolist()})
    return result, records


def finish(model, workspace, selected):
    output, public = paths(workspace, model)
    for source in texture_files(model):
        if selected and source.name not in selected:
            continue
        native_path = output / 'native' / source.name
        if not native_path.exists():
            continue
        original = Image.open(source).convert('RGBA')
        native = Image.open(native_path).convert('RGB')
        prep = json.loads((output / 'inputs' / (source.stem + '.json')).read_text())
        if abs(native.width / native.height - original.width / original.height) > .02:
            raise ValueError(f'{source.name}: unexpected API aspect ratio {native.size}')
        sx, sy = native.width / prep['canvasSize'][0], native.height / prep['canvasSize'][1]
        mx, my = prep['margin']
        width, height = prep['atlasSize']
        native = native.crop((round(mx * sx), round(my * sy), round((mx + width) * sx), round((my + height) * sy)))
        # Keep the outer canvas guide out of filtering at repeated texture edges.
        cropped = np.array(native)
        border = max(1, round(max(native.size) / 2048))
        cropped[:border] = cropped[border:border + 1]
        cropped[-border:] = cropped[-border - 1:-border]
        cropped[:, :border] = cropped[:, border:border + 1]
        cropped[:, -border:] = cropped[:, -border - 1:-border]
        native = Image.fromarray(cropped)
        reference = original.resize(native.size, Image.Resampling.BILINEAR)
        mask = uv_mask(model, source.name, native.size)
        alpha = np.array(reference.getchannel('A'))
        mask[alpha == 0] = 0
        pixels, registration = registered(np.array(reference.convert('RGB')), np.array(native), mask)
        # Remove neutral guide contamination only at the known UV/cutout edge.
        source_scale = native.width / original.width
        edge_width = max(4, round(source_scale * 1.5))
        edge = (mask > 0) & (cv2.erode(mask, np.ones((edge_width * 2 + 1,) * 2, np.uint8)) == 0)
        neutral = pixels.max(axis=2).astype(np.int16) - pixels.min(axis=2) < 10
        intensity = pixels.mean(axis=2)
        reference_rgb = np.array(reference.convert('RGB'), dtype=np.float32)
        delta = pixels.astype(np.float32) - reference_rgb
        difference = np.linalg.norm(delta, axis=2)
        contamination = neutral & ((intensity > 220) | (abs(intensity - 190) < 12))
        for guide_color in (190, 245):
            direction = guide_color - reference_rgb
            amount = (delta * direction).sum(axis=2) / np.maximum((direction * direction).sum(axis=2), 1)
            remainder = np.linalg.norm(delta - amount[:, :, None] * direction, axis=2)
            contamination |= (amount > .12) & (amount < 1.05) & (remainder < 15)
        guides = np.uint8(edge & contamination & (difference > 55)) * 255
        valid = mask > 0
        artwork = valid & (guides == 0)
        padding = (~valid) | (guides > 0)
        if artwork.any() and padding.any():
            _, nearest = cv2.distanceTransformWithLabels(np.uint8(~artwork), cv2.DIST_L2, 5, labelType=cv2.DIST_LABEL_PIXEL)
            pixels[padding] = pixels[artwork][nearest[padding] - 1]
        maximum = 4096
        final_size = tuple(round(maximum * value / max(original.size)) for value in original.size)
        final = Image.fromarray(pixels).resize(final_size, Image.Resampling.LANCZOS).convert('RGBA')
        final.putalpha(original.getchannel('A').resize(final_size, Image.Resampling.LANCZOS))
        if original.getchannel('A').getextrema() == (255, 255):
            final = final.convert('RGB')
        final.save(public / source.name)
        metadata_path = output / 'metadata' / (source.stem + '.json')
        metadata = json.loads(metadata_path.read_text())
        metadata.update(finalSize=list(final_size), registration=registration, corrections=[],
                        runtimeMode=final.mode, alphaSource=str(source),
                        runtime=str((public / source.name).relative_to(Path(workspace))))
        api.save_json(metadata_path, metadata)
        print(f'{source.name}: registered {final_size}, {final.mode}', flush=True)
    rows = [json.loads(path.read_text()) for path in sorted((output / 'metadata').glob('*.json'))]
    api.save_json(output / 'manifest.json', {'object': model, 'textureCount': len(rows), 'textures': rows})


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('command', choices=['prepare', 'generate', 'finish'])
    parser.add_argument('model')
    parser.add_argument('--workspace', required=True)
    parser.add_argument('--only', nargs='*')
    parser.add_argument('--revision', default='')
    args = parser.parse_args()
    if args.command == 'prepare':
        prepare(args.model, args.workspace, args.only)
    elif args.command == 'generate':
        generate(args.model, args.workspace, args.only, args.revision)
    else:
        finish(args.model, args.workspace, args.only)
