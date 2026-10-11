"""Prepare bounded atlases, submit image edits, and register them to model UVs."""

import argparse
import base64
from contextlib import contextmanager
from concurrent.futures import ThreadPoolExecutor
import fcntl
import hashlib
import io
import json
from pathlib import Path
import re
import subprocess
import sys
import time

import cv2
import numpy as np
from PIL import Image, ImageDraw
import requests

ROOT = Path(__file__).resolve().parents[2]
PRIVATE = Path('/tmp/cdtank-api4k')
sys.path.insert(0, str(ROOT / 'tools/tank-hd'))
from process import read_uv, uv_groups

cv2.setNumThreads(2)


class HttpError(RuntimeError):
    def __init__(self, status, body, retry_after=None):
        super().__init__(f'HTTP {status}: {body}')
        self.status = status
        self.retry_after = retry_after


def acquire_slot(handles):
    while True:
        for handle in handles:
            try:
                fcntl.flock(handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
                return handle
            except BlockingIOError:
                pass
        time.sleep(1)


@contextmanager
def image_slot(workspace):
    workspace_key = hashlib.sha256(str(Path(workspace).resolve()).encode()).hexdigest()[:16]
    job_handles = [(PRIVATE / f'image-job-{workspace_key}-{index}.lock').open('a')
                   for index in range(2)]
    global_handles = [(PRIVATE / f'image-slot-{index}.lock').open('a') for index in range(5)]
    job_slot = None
    global_slot = None
    try:
        job_slot = acquire_slot(job_handles)
        global_slot = acquire_slot(global_handles)
        yield
    finally:
        if global_slot:
            fcntl.flock(global_slot, fcntl.LOCK_UN)
        if job_slot:
            fcntl.flock(job_slot, fcntl.LOCK_UN)
        for handle in job_handles + global_handles:
            handle.close()


def save_json(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')


def valid_image(path):
    try:
        if not path.is_file() or path.stat().st_size == 0:
            return False
        with Image.open(path) as image:
            image.verify()
        return True
    except (OSError, ValueError):
        return False


def retryable_error(error):
    if isinstance(error, (requests.ConnectionError, requests.Timeout)):
        return True
    if isinstance(error, HttpError):
        return error.status in {429, 500, 502, 503, 504}
    match = re.search(r'HTTP (\d{3})', str(error))
    return bool(match and match.group(1) in {'429', '500', '502', '503', '504'})


def retry_delay(error, attempt):
    if isinstance(error, HttpError) and error.status == 429:
        try:
            delay = int(float(error.retry_after))
        except (TypeError, ValueError):
            delay = 65
        return min(300, max(65, delay))
    return 15 * (attempt + 1)


def paths(workspace, tank):
    output = Path(workspace) / 'output/imagegen/tank-api4k' / tank
    public = Path(workspace) / 'apps/web/public/tank-audit/api4k' / tank
    for folder in (output, public):
        folder.mkdir(parents=True, exist_ok=True)
    return output, public


def source_files(tank):
    return sorted((ROOT / 'art/original/tank-textures/role' / tank).glob(f'{tank}[MU]_*.png'))


def masks(tank, part, size):
    triangles = read_uv(tank, part)
    main = Image.new('L', size)
    micro = Image.new('L', size)
    main_draw, micro_draw = ImageDraw.Draw(main), ImageDraw.Draw(micro)
    scale = np.array(size) / 256
    for group in uv_groups(triangles):
        bounds = np.array(group['bounds'])
        span = bounds[2:] - bounds[:2]
        if span.max() > 230 and span.min() > 230:
            continue
        draw = micro_draw if span.max() < 16 or span.min() < 1.5 else main_draw
        for index in group['uvTriangles']:
            draw.polygon([tuple(point * scale) for point in triangles[index]], fill=255)
    return np.array(main), np.array(micro)


def prepare(tank, workspace, selected=None, input_rotation=0):
    output, _ = paths(workspace, tank)
    for folder in ('inputs', 'native', 'prompts', 'metadata'):
        (output / folder).mkdir(exist_ok=True)
    rows = []
    for source in source_files(tank):
        original = Image.open(source).convert('RGB')
        width = 2048
        size = (width, round(width * original.height / original.width))
        requested = (4096, round(4096 * original.height / original.width))
        input_size = size
        if input_rotation in {90, 270}:
            input_size = (size[1], size[0])
            requested = (requested[1], requested[0])
        rows.append({'filename': source.name, 'sourceSize': list(original.size),
                     'inputSize': list(input_size), 'requestedSize': list(requested)})
        if selected and source.name not in selected:
            continue
        reference = np.array(original.resize(size, Image.Resampling.NEAREST))
        core, micro = masks(tank, source.name[3], size)
        pixels_per_source = width / original.width
        gutter = max(1, round(pixels_per_source * .75))
        grown = cv2.dilate(core, np.ones((gutter * 2 + 1,) * 2, np.uint8))
        ring = (cv2.dilate(grown, np.ones((7, 7), np.uint8)) > 0) & (grown == 0)
        pixels = np.full((*core.shape, 3), 190, np.uint8)
        pixels[grown > 0] = reference[grown > 0]
        pixels[micro > 0] = reference[micro > 0]
        pixels[ring] = 245
        prepared = Image.fromarray(pixels)
        uv_mask = Image.fromarray(core)
        if input_rotation:
            rotation = getattr(Image.Transpose, f'ROTATE_{input_rotation}')
            prepared = prepared.transpose(rotation)
            uv_mask = uv_mask.transpose(rotation)
        prepared.save(output / 'inputs' / source.name)
        uv_mask.save(output / 'inputs' / f'{source.stem}-uv.png')
        part = '车身' if source.name[3] == 'M' else '炮塔'
        prompt = (
            f'将这张坦克{part}二维UV贴图高清重绘，输出{requested[0]}x{requested[1]}，'
            '保持原来的卡通风格、配色和全部图案，线条清晰锐利。'
            '灰色是不透明辅助背景，白色细边是固定图块边界。'
            '所有图块的位置、大小、轮廓和方向必须与输入完全一致，不得移动、旋转、变形或重新排版。'
            '直线必须平直，圆形和孔槽保持规则形状。只高清化边界内已有内容，'
            '边界外灰底和白色引导细边保持原样。'
            '保留全部孔槽、格栅、接缝、迷彩及装饰的数量、形状与位置。'
            '保留原有标志和文字，不添加新细节，不改变颜色、明暗或风格。'
            '输出一张同布局的平面二维贴图，无透视、无3D效果、无模型、无水印。')
        (output / 'prompts' / f'{source.stem}.txt').write_text(prompt + '\n')
    save_json(output / 'inventory.json', {'tank': tank, 'textures': rows})
    print(f'Prepared {tank}: {len(rows)} bounded inputs', flush=True)


def generate_one(tank, workspace, filename, revision, input_rotation=0):
    output, _ = paths(workspace, tank)
    native = output / 'native' / filename
    metadata_path = output / 'metadata' / f'{Path(filename).stem}.json'
    if valid_image(native) and metadata_path.exists() and not revision:
        print(f'{filename}: existing native result', flush=True)
        return
    prepare(tank, workspace, [filename], input_rotation)
    input_path = output / 'inputs' / filename
    if not valid_image(input_path):
        raise RuntimeError(f'input missing or invalid PNG: {input_path}')
    config = json.loads((PRIVATE / 'image-config.json').read_text())
    capabilities = PRIVATE / 'capabilities.json'
    if capabilities.exists():
        config.update(json.loads(capabilities.read_text()))
    key = config['key']
    source = ROOT / 'art/original/tank-textures/role' / tank / filename
    original = Image.open(source)
    request_width = config.get('requestWidth', 4096)
    request_height = round(request_width * original.height / original.width)
    if input_rotation in {90, 270}:
        request_width, request_height = request_height, request_width
    request_size = f'{request_width}x{request_height}'
    prompt = (output / 'prompts' / f'{source.stem}.txt').read_text().strip()
    if input_rotation:
        prompt += f'\n输入是原始完整图集整体逆时针旋转{input_rotation}度后的图像。严格保持当前输入的整图方向和全部图块位置输出，不要自行旋转或重排。'
    if revision:
        prompt += '\n修正要求：' + revision
        (output / 'prompts' / f'{source.stem}-revision.txt').write_text(prompt + '\n')
    metadata = {'filename': filename, 'model': config['model'],
                'endpoint': config['base'].rstrip('/') + '/images/edits',
                'requestedSize': request_size, 'quality': 'high',
                'inputsPerRequest': 1, 'background': 'opaque', 'status': 'submitted',
                'generationScope': 'whole-atlas',
                'inputRotation': input_rotation,
                'reference': str(source), 'input': str(input_path),
                'inputPreparation': 'original atlas with opaque background and UV guides'}
    save_json(metadata_path, metadata)
    print(f'{filename}: submitted {config["model"]} {request_size}', flush=True)
    for attempt in range(3):
        try:
            with image_slot(workspace), input_path.open('rb') as image:
                response = requests.post(metadata['endpoint'],
                    headers={'Authorization': 'Bearer ' + key},
                    files={'image': (filename, image, 'image/png')},
                    data={'model': config['model'], 'prompt': prompt, 'size': request_size,
                          'quality': 'high', 'background': 'opaque', 'n': '1',
                          'response_format': 'b64_json'}, timeout=1300)
            if not response.ok:
                raise HttpError(response.status_code, response.text[:500],
                                response.headers.get('Retry-After'))
            payload = response.json()
            item = payload['data'][0]
            if item.get('b64_json'):
                raw = base64.b64decode(item['b64_json'])
            elif item['url'].startswith('data:'):
                raw = base64.b64decode(item['url'].split(',', 1)[1])
            else:
                download = requests.get(item['url'], timeout=180)
                download.raise_for_status()
                raw = download.content
            image = Image.open(io.BytesIO(raw))
            image.load()
            image.save(native)
            metadata.update(status='received', nativeSize=list(image.size),
                            usage=payload.get('usage'), revisedPrompt=item.get('revised_prompt'))
            metadata.pop('error', None)
            save_json(metadata_path, metadata)
            print(f'{filename}: native {image.width}x{image.height}', flush=True)
            return
        except Exception as error:
            message = str(error).replace(key, '[REDACTED]')[:700]
            metadata.update(status='failed', error=message)
            save_json(metadata_path, metadata)
            print(f'{filename}: {message}', flush=True)
            if attempt == 2 or not retryable_error(error):
                raise RuntimeError(message) from None
            time.sleep(retry_delay(error, attempt))


def registered(source, native, tank, part):
    size = native.size
    reference = np.array(source.resize(size, Image.Resampling.BILINEAR))
    pixels = np.array(native.convert('RGB'))
    core, micro = masks(tank, part, size)
    count, labels, stats, _ = cv2.connectedComponentsWithStats(core)
    result = reference.copy()
    records = []
    for label in range(1, count):
        x, y, width, height, _ = stats[label]
        margin = max(8, round(size[0] / source.width * 4))
        x0, y0 = max(0, x - margin), max(0, y - margin)
        x1, y1 = min(size[0], x + width + margin), min(size[1], y + height + margin)
        region = labels[y0:y1, x0:x1] == label
        old = cv2.cvtColor(reference[y0:y1, x0:x1], cv2.COLOR_RGB2GRAY)
        new = cv2.cvtColor(pixels[y0:y1, x0:x1], cv2.COLOR_RGB2GRAY)
        scale = min(1, 600 / max(old.shape))
        shape = (max(8, round(old.shape[1] * scale)), max(8, round(old.shape[0] * scale)))
        old_small = cv2.resize(old, shape).astype(np.float32) / 255
        new_small = cv2.resize(new, shape).astype(np.float32) / 255
        valid = cv2.resize(np.uint8(region), shape, interpolation=cv2.INTER_NEAREST)
        valid = cv2.erode(valid, np.ones((3, 3), np.uint8))
        warp = np.eye(2, 3, dtype=np.float32)
        correlation = None
        try:
            correlation, fitted = cv2.findTransformECC(old_small, new_small, warp.copy(),
                cv2.MOTION_AFFINE, (cv2.TERM_CRITERIA_COUNT | cv2.TERM_CRITERIA_EPS, 60, .0001), valid, 5)
            if correlation >= .5:
                center = np.float32([shape[0] / 2, shape[1] / 2])
                displacement = fitted[:, :2] @ center + fitted[:, 2] - center
                limit = margin * scale
                warp[:, :2] = np.diag(np.clip(np.diag(fitted[:, :2]), .97, 1.03))
                warp[:, 2] = (center + np.clip(displacement, -limit, limit) - warp[:, :2] @ center) / scale
        except cv2.error:
            pass
        aligned = cv2.warpAffine(pixels[y0:y1, x0:x1], warp, (x1 - x0, y1 - y0),
            flags=cv2.INTER_LINEAR | cv2.WARP_INVERSE_MAP, borderMode=cv2.BORDER_REPLICATE)
        result[y0:y1, x0:x1][region] = aligned[region]
        records.append({'bounds': [int(x), int(y), int(width), int(height)],
                        'correlation': None if correlation is None else float(correlation),
                        'transform': warp.tolist()})
    # Restrict guide cleanup to the UV perimeter and known neutral guide colors.
    edge_width = max(3, round(size[0] / source.width * 1.5))
    edge = (core > 0) & (cv2.erode(core, np.ones((edge_width * 2 + 1,) * 2, np.uint8)) == 0)
    neutral = result.max(axis=2).astype(np.int16) - result.min(axis=2) < 10
    intensity = result.mean(axis=2)
    ref_distance = np.linalg.norm(result.astype(np.float32) - reference, axis=2)
    guide = edge & neutral & (((intensity > 235) | (np.abs(intensity - 190) < 12))) & (ref_distance > 55)
    result[guide] = reference[guide]
    result[micro > 0] = reference[micro > 0]
    return Image.fromarray(result), core | micro, records


def finish(tank, workspace, selected):
    output, public = paths(workspace, tank)
    corrections_path = output / 'corrections.json'
    corrections = json.loads(corrections_path.read_text()) if corrections_path.exists() else {}
    for source in source_files(tank):
        if selected and source.name not in selected:
            continue
        native_path = output / 'native' / source.name
        if not native_path.exists():
            continue
        original, native = Image.open(source).convert('RGB'), Image.open(native_path).convert('RGB')
        path = output / 'metadata' / f'{source.stem}.json'
        metadata = json.loads(path.read_text())
        input_rotation = metadata.get('inputRotation', 0)
        if input_rotation:
            native = native.transpose(getattr(Image.Transpose, f'ROTATE_{360 - input_rotation}'))
        final_size = (4096, round(4096 * original.height / original.width))
        if abs(native.width / native.height - original.width / original.height) > .02:
            raise ValueError(f'{source.name}: API aspect ratio {native.size} differs from source {original.size}')
        aligned, mask, registrations = registered(original, native, tank, source.name[3])
        corrections.pop(source.name, None)
        radius = max(2, round(native.width / original.width * 2))
        wanted = cv2.dilate(mask, np.ones((radius * 2 + 1,) * 2, np.uint8)) > 0
        pixels = np.array(aligned)
        valid = mask > 0
        if valid.any():
            _, nearest = cv2.distanceTransformWithLabels(np.uint8(~valid), cv2.DIST_L2, 5,
                                                        labelType=cv2.DIST_LABEL_PIXEL)
            pixels[wanted & ~valid] = pixels[valid][nearest[wanted & ~valid] - 1]
        final = Image.fromarray(pixels).resize(final_size, Image.Resampling.LANCZOS)
        final.save(public / source.name)
        if metadata.get('status') == 'received':
            metadata.pop('error', None)
        metadata.update(finalSize=list(final_size), resampledTo4k=native.size != final_size,
                        runtimeMode='RGB',
                        registration=registrations, corrections=[],
                        runtime=f'apps/web/public/tank-audit/api4k/{tank}/{source.name}')
        save_json(path, metadata)
        print(f'{source.name}: UV registered, saved {final_size}', flush=True)
    if corrections_path.exists():
        save_json(corrections_path, corrections)
    received = []
    for source in source_files(tank):
        metadata = output / 'metadata' / f'{source.stem}.json'
        if (public / source.name).exists() and metadata.exists():
            received.append(json.loads(metadata.read_text()))
    save_json(output / 'manifest.json', {'tank': tank, 'textureCount': len(received), 'textures': received})


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('command', choices=['prepare', 'generate', 'finish'])
    parser.add_argument('tank')
    parser.add_argument('--workspace', required=True)
    parser.add_argument('--workers', type=int, default=1)
    parser.add_argument('--only', nargs='*')
    parser.add_argument('--revision', default='')
    parser.add_argument('--input-rotation', type=int, choices=[0, 90, 180, 270], default=0)
    parser.add_argument('--detach', action='store_true')
    args = parser.parse_args()
    if args.detach:
        output, _ = paths(args.workspace, args.tank)
        log = output / 'generation.log'
        command = [sys.executable, str(Path(__file__).resolve()), args.command, args.tank,
                   '--workspace', args.workspace, '--workers', str(args.workers)]
        if args.only:
            command += ['--only', *args.only]
        if args.revision:
            command += ['--revision', args.revision]
        if args.input_rotation:
            command += ['--input-rotation', str(args.input_rotation)]
        with log.open('a') as handle:
            child = subprocess.Popen(command, stdin=subprocess.DEVNULL, stdout=handle,
                                     stderr=subprocess.STDOUT, start_new_session=True)
        save_json(output / 'generation-job.json', {'pid': child.pid, 'log': str(log)})
        print(f'Independent generation job {child.pid}: {log}', flush=True)
        return
    if args.command == 'prepare':
        prepare(args.tank, args.workspace, args.only, args.input_rotation)
    elif args.command == 'generate':
        files = [p.name for p in source_files(args.tank) if not args.only or p.name in args.only]
        workers = min(args.workers, 2)
        if workers != args.workers:
            print(f'capping generation workers from {args.workers} to {workers}', flush=True)
        with ThreadPoolExecutor(max_workers=workers) as pool:
            list(pool.map(lambda name: generate_one(args.tank, args.workspace, name, args.revision,
                                                   args.input_rotation), files))
    else:
        finish(args.tank, args.workspace, args.only)


if __name__ == '__main__':
    main()
