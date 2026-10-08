"""Generate replacement UI artwork with the configured chatgpt2api image skill."""
import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
import math
import json
import os
from pathlib import Path
import signal
import sys
import threading
import time

from PIL import Image, ImageDraw

import hd_image_api
from ui_artwork_scope import html_ui_sources

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / 'art/hd-ui-redraw'
LOCK = threading.Lock()
STOP = threading.Event()


def save(path, value):
    temporary = path.with_suffix('.tmp')
    temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')
    temporary.replace(path)


def prepare(job, inventory):
    folder = ART / 'jobs' / job.get('id', job['source'].removesuffix('.png'))
    folder.mkdir(parents=True, exist_ok=True)
    if job.get('cells') and (folder / 'input.png').is_file():
        return job
    sources = job.get('sources', [job['source']])
    if job.get('framed') or len(sources) > 1:
        job['framed'] = True
        columns = 2 if len(sources) > 1 else 1
        rows = math.ceil(len(sources) / columns)
        outer, gap, stroke, padding = 40, 64, 6, 48
        width = (1024 - outer * 2 - gap * (columns - 1)) // columns
        height = (768 - outer * 2 - gap * (rows - 1)) // rows
        originals = []
        for source in sources:
            with Image.open(ROOT / inventory[source]['original']) as original:
                originals.append(original.convert('RGBA'))
        factor = min(min((width - padding * 2) / original.width,
                         (height - padding * 2) / original.height)
                     for original in originals)
        canvas = Image.new('RGB', (1024, 768), '#ff00ff')
        draw = ImageDraw.Draw(canvas)
        cells = []
        for index, (source, original) in enumerate(zip(sources, originals)):
            left = outer + index % columns * (width + gap)
            top = outer + index // columns * (height + gap)
            frame = [left, top, left + width, top + height]
            draw.rectangle((left, top, left + width - 1, top + height - 1),
                           outline=(32, 144, 255), width=stroke)
            reference = original.resize((round(original.width * factor), round(original.height * factor)),
                                        Image.Resampling.LANCZOS)
            x = left + (width - reference.width) // 2
            y = top + (height - reference.height) // 2
            canvas.paste(reference, (x, y), reference)
            cells.append(dict(source=source, box=[x, y, x + reference.width, y + reference.height],
                              frame=frame, slot=[left + stroke, top + stroke,
                                                left + width - stroke, top + height - stroke],
                              size=inventory[source]['size']))
        job.update(folder=folder.relative_to(ROOT).as_posix(), cells=cells,
                   canvas=[1024, 768], frameColor=[32, 144, 255], gap=gap)
        positions = '\n'.join(f"第{index + 1}格的完整原图占位为 {cell['box']}；"
                              f"蓝框外沿为 {cell['frame']}。"
                              for index, cell in enumerate(cells))
        job['prompt'] += ('\n这是带切图定位边框的素材拼图。画布1024×768，所有素材使用同一放大比例。'
                          '蓝色RGB(32,144,255)矩形仅用于定位，必须逐一保持原数量、形状、'
                          '颜色、粗细和位置，完整保留四条边。格间64像素间距和格内留白必须保留。'
                          '每个素材必须完整画在自己的蓝框里，任何字符、轮廓和效果都不准跨框。'
                          '保留每格原图的完整画布占位和透明留白，特别是无文字帧右侧的空白，'
                          '不能把脸居中放大填满格子。逐帧复刻，不补字，不借用相邻帧内容。'
                          '框内框外空白保持纯洋红RGB(255,0,255)，不改成透明或棋盘格。'
                          '只高清重绘框内原素材，蓝框与间距属于定位标记，保持原样。\n' + positions)
        canvas.save(folder / 'input.png')
        (folder / 'prompt.txt').write_text(job['prompt'] + '\n')
        return job
    columns = 4 if len(sources) > 9 else 3 if len(sources) > 4 else 2 if len(sources) > 1 else 1
    rows = math.ceil(len(sources) / columns)
    width, height = 1024 // columns, 768 // rows
    canvas = Image.new('RGB', (1024, 768), '#ff00ff' if 'sources' in job else 'white')
    cells = []
    for index, source in enumerate(sources):
        entry = inventory[source]
        with Image.open(ROOT / entry['original']) as original:
            original = original.convert('RGBA')
            margin = 16 if 'sources' in job else 128
            factor = min((width - margin) / original.width, (height - margin) / original.height)
            reference = original.resize((round(original.width * factor), round(original.height * factor)),
                                        Image.Resampling.LANCZOS)
            x = index % columns * width + (width - reference.width) // 2
            y = index // columns * height + (height - reference.height) // 2
            canvas.paste(reference, (x, y), reference)
            cells.append(dict(source=source, box=[x, y, x + reference.width, y + reference.height],
                              slot=[index % columns * width, index // columns * height,
                                    (index % columns + 1) * width, (index // columns + 1) * height],
                              size=entry['size']))
    canvas.save(folder / 'input.png')
    job.update(folder=folder.relative_to(ROOT).as_posix(), cells=cells)
    if len(cells) == 1:
        job.update(box=cells[0]['box'], size=cells[0]['size'])
    (folder / 'prompt.txt').write_text(job['prompt'] + '\n')
    return job


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--jobs', type=Path, default=ART / 'jobs.json')
    parser.add_argument('--workers', type=int, default=8)
    parser.add_argument('--prepare-only', action='store_true')
    parser.add_argument('--collect-only', action='store_true')
    args = parser.parse_args()
    signal.signal(signal.SIGINT, lambda *_: STOP.set())
    signal.signal(signal.SIGTERM, lambda *_: STOP.set())
    ART.mkdir(parents=True, exist_ok=True)
    jobs = json.loads(args.jobs.read_text())
    simple = html_ui_sources()
    jobs = [job for job in jobs if job.get('unlettered') or not any(source in simple for source in job.get('sources', [job['source']]))]
    inventory = {entry['source']: entry for entry in
                 json.loads((ROOT / 'art/hd-assets/inventory.json').read_text())['textures']}
    jobs = [prepare(job, inventory) for job in jobs]
    save(args.jobs, jobs)
    if args.prepare_only:
        return
    skill = Path(os.environ.get('CHATGPT2API_SKILL', '/workspace/self-skills/chatgpt2api-image-api'))
    sys.path.insert(0, str(skill / 'scripts'))
    import common
    key = hd_image_api.auth_key()
    base = os.environ.get('CHATGPT2API_BASE_URL', hd_image_api.DEFAULT_BASE_URL)
    ledger_path = ART / (args.jobs.stem + '-calls.json')
    ledger = json.loads(ledger_path.read_text()) if ledger_path.is_file() else []

    def generate(job):
        folder = ROOT / job['folder']
        if (folder / 'output-1.png').is_file():
            return job['source'] + ': saved result'
        if STOP.is_set():
            return job['source'] + ': paused before submission'
        failures = [datetime.fromisoformat(record['finished']).timestamp() for record in ledger
                    if record.get('job', record['source']) == job.get('id', job['source'])
                    and record['status'] == 'failed']
        retry_at = max(failures, default=0) + 300
        response_path = folder / 'response.json'
        if args.collect_only and not response_path.is_file():
            return job['source'] + ': no saved response'
        while True:
            if STOP.is_set():
                return job['source'] + ': paused before submission'
            delay = retry_at - time.time()
            if delay > 0:
                print(f'{job["source"]}: waiting {round(delay)} seconds before retry', flush=True)
                if STOP.wait(delay):
                    return job['source'] + ': paused before retry'
            record = dict(source=job['source'], job=job.get('id', job['source']),
                          status='submitted', model=hd_image_api.MODEL,
                          started=datetime.now(timezone.utc).isoformat())
            with LOCK:
                ledger.append(record)
                save(ledger_path, ledger)
            print(f'{job["source"]}: image edit request', flush=True)
            try:
                if response_path.is_file():
                    status, payload = 200, json.loads(response_path.read_text())
                else:
                    status, payload = hd_image_api.edit(base, key, job['prompt'], folder / 'input.png')
                    save(response_path, payload)
                paths = common.save_image_results({'data': [payload['data'][0]]}, output_dir=folder, prefix='output',
                                                  download_url_results=True)
                if not paths:
                    raise ValueError('The image API returned no image')
                with Image.open(paths[0]) as image:
                    image.load()
                    record.update(status='complete', http=status, size=list(image.size))
                return job['source'] + ': generated'
            except Exception as error:
                record.update(status='failed', error=str(error).replace(key, '<REDACTED>')[:600])
                print(f'{job["source"]}: {record["error"]}; retry in 300 seconds', flush=True)
                (folder / 'output-1.png').unlink(missing_ok=True)
                retry_at = time.time() + 300
            finally:
                record['finished'] = datetime.now(timezone.utc).isoformat()
                with LOCK:
                    save(ledger_path, ledger)

    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        pending = [pool.submit(generate, job) for job in jobs]
        for future in as_completed(pending):
            print(future.result(), flush=True)


if __name__ == '__main__':
    main()
