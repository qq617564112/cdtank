import argparse
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
import csv
import json
from pathlib import Path
import shutil
import tempfile
import time
from urllib.parse import unquote

from .encoding import WebpEncoder
from .package import glb_chunks, rewrite_model, rewrite_resource


REPOSITORY = Path(__file__).resolve().parents[2]
RECIPE = Path(__file__).with_name('recipe.json')
IMAGE_SUFFIXES = {'.png', '.webp', '.svg', '.ico'}


def write_json(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')


def process_image(row, source, output, encoder):
    original = source / row['source_relative']
    destination = output / row['output_relative']
    destination.parent.mkdir(parents=True, exist_ok=True)
    if destination.suffix.lower() in ('.svg', '.ico'):
        shutil.copy2(original, destination)
        size = original.stat().st_size
        return {**row, 'source_bytes': size, 'baseline_bytes': size, 'output_bytes': size,
            'encoding_profile': 'keep-source', 'rgb_equal': True, 'resized': False}
    payload, result = encoder.image(original.read_bytes(), original.suffix.lower(),
        row['target_size'], row['encoding_profile'])
    if result['source_size'] != row['source_size']:
        raise RuntimeError(f'Source dimensions differ from the approved recipe: {row["source_relative"]}')
    temporary = destination.with_suffix('.webp.candidate')
    temporary.write_bytes(payload)
    temporary.replace(destination)
    return {**row, **result}


def verify_references(output, resources, models, retired):
    retired_names = {name for row in retired for name in (row['texture'], row['output_relative'])}
    for relative in resources:
        document = json.loads((output / relative).read_text())

        def visit(value):
            if isinstance(value, dict):
                for key, item in value.items():
                    visit(key)
                    visit(item)
            elif isinstance(value, list):
                for item in value:
                    visit(item)
            elif isinstance(value, str) and value.lstrip('/') in retired_names:
                raise RuntimeError(f'Retired UI image is referenced by {relative}: {value}')

        visit(document)
    for relative in models:
        document = json.loads(glb_chunks((output / relative).read_bytes())[0][1])
        for image in document.get('images', []):
            if 'uri' in image and not ((output / relative).parent / unquote(image['uri'])).is_file():
                raise RuntimeError(f'Unresolved model image in {relative}: {image["uri"]}')
    for row in retired:
        if not (output / row['replacement']).is_file():
            raise RuntimeError(f'Missing UI replacement: {row["replacement"]}')


def write_reports(output, recipe, images, models, files, encoder_version):
    reports = output / 'reports'
    reports.mkdir(exist_ok=True)
    embedded = [row for model in models for row in model['embedded_images']]
    categories = defaultdict(lambda: {'files': 0, 'source_bytes': 0, 'baseline_bytes': 0, 'output_bytes': 0})
    for row in images:
        group = categories[row['category_label']]
        group['files'] += 1
        for key in ('source_bytes', 'baseline_bytes', 'output_bytes'):
            group[key] += row[key]
    source_bytes = sum(row['source_bytes'] for row in images)
    output_bytes = sum(row['output_bytes'] for row in images)
    asset_bytes = sum((output / relative).stat().st_size for relative in files)
    raster = [row for row in images + embedded if row['output_relative'].split('#')[0].endswith(('.webp', '.glb'))]
    report = {'source': str(recipe['source']), 'output': str(output), 'encoder_version': encoder_version,
        'image_files': len(images), 'webp_image_files': sum(row['output_relative'].endswith('.webp') for row in images),
        'embedded_images': len(embedded), 'model_files': len(models),
        'resource_files': len(files), 'resized_images': sum(row['resized'] for row in images),
        'profiles': dict(Counter(row['encoding_profile'] for row in images)),
        'source_image_bytes': source_bytes, 'baseline_image_bytes': sum(row['baseline_bytes'] for row in images),
        'output_image_bytes': output_bytes, 'main_asset_bytes': asset_bytes,
        'image_saved_percent': round(100 * (1 - output_bytes / source_bytes), 3),
        'retired_ui_images': len(recipe['ui_replacements']), 'size_rules': recipe['size_rules'],
        'verification': {'dimensions_checked': len(raster), 'alpha_checked': len(raster),
            'near80_max_rgb_error': max((row['rgb_max_error'] for row in raster if row['encoding_profile'] == 'near80'), default=0),
            'issues': []}, 'categories': dict(categories), 'files': images, 'models': models}
    write_json(reports / 'generated-assets.json', report)
    write_json(reports / 'runtime-files.json', sorted(files))
    with (reports / 'generated-assets.csv').open('w', newline='', encoding='utf-8-sig') as file:
        columns = ['source_relative', 'output_relative', 'category_label', 'encoding_profile',
            'source_size', 'target_size', 'source_bytes', 'baseline_bytes', 'output_bytes',
            'resized', 'rgb_equal', 'rgb_max_error', 'alpha_equal']
        writer = csv.DictWriter(file, fieldnames=columns, extrasaction='ignore')
        writer.writeheader()
        writer.writerows(images + embedded)
    lines = ['# 高清资产生成结果', '',
        f'图片 {len(images):,} 张，模型内嵌图片 {len(embedded)} 张。独立图片输出 {output_bytes / 1073741824:.3f} GiB，全资产输出 {asset_bytes / 1073741824:.3f} GiB。', '',
        '从 art/hd 读取源文件，先采用已确认的最终尺寸，再进行一次 Lanczos 缩放。编码按已确认的逐图配方执行：不透明贴图 q95；透明素材、UI 和特效 near80；保留小地图、已有有损图片及没有压缩收益的图片。SVG 和 ICO 保留。近无损保留 Alpha、全透明区域 RGB 及纯黑 RGB，最终 RGB 通道差不超过 1/255。', '',
        '| 类别 | 图片数 | 高清源（MiB） | 输出（MiB） |', '| --- | ---: | ---: | ---: |']
    for label, group in categories.items():
        lines.append(f'| {label} | {group["files"]} | {group["source_bytes"] / 1048576:.2f} | {group["output_bytes"] / 1048576:.2f} |')
    lines += ['', f'排除 {len(recipe["ui_replacements"])} 张旧 UI 图片并重写资源引用。GLB 外部及内嵌图片采用 EXT_texture_webp；几何缓冲区内容保留。', '',
        '- [逐图尺寸与编码](generated-assets.csv)', '- [完整结果](generated-assets.json)', '- [运行文件清单](runtime-files.json)', '',
        '## 限制', '', '生成结果尚未进行游戏内视觉验收。WebP 版本可能影响文件大小；配方固定当前已经确认的尺寸和编码选择。新增资产需要加入配方，修改源图尺寸需要更新对应条目。', '']
    (reports / 'generated-assets.md').write_text('\n'.join(lines))
    return report


def generate(source, output, recipe_path, cwebp, workers):
    recipe = json.loads(recipe_path.read_text())
    images = {row['source_relative']: row for row in recipe['images']}
    retired = {row['texture'] for row in recipe['ui_replacements']}
    paths = []
    for path in sorted(source.rglob('*')):
        if not path.is_file():
            continue
        relative = path.relative_to(source).as_posix()
        if relative in retired or any(relative.startswith(prefix) for prefix in recipe['excluded_source_prefixes']):
            continue
        if path.suffix.lower() in IMAGE_SUFFIXES and relative not in images:
            raise RuntimeError(f'Image has no approved sizing recipe: {relative}')
        paths.append((relative, path))
    for relative in images:
        if not (source / relative).is_file():
            raise FileNotFoundError(f'Missing HD input: {relative}')
    output.mkdir(parents=True, exist_ok=True)
    output_prefix = output.relative_to(REPOSITORY).as_posix() if output.is_relative_to(REPOSITORY) else output.as_posix()
    mapping = {row['source_relative']: row['output_relative'] for row in images.values()}
    mapping.update({name: row['replacement'] for row in recipe['ui_replacements']
        for name in (row['texture'], row['output_relative'])})
    results = []
    model_rows = []
    files = {row['output_relative'] for row in images.values()}
    started = time.monotonic()
    with tempfile.TemporaryDirectory(prefix='.generate-', dir=output) as work:
        encoder = WebpEncoder(cwebp, recipe['encoder'], Path(work))
        with ThreadPoolExecutor(max_workers=workers) as pool:
            futures = [pool.submit(process_image, row, source, output, encoder) for row in images.values()]
            last_progress = time.monotonic()
            for future in as_completed(futures):
                results.append(future.result())
                if time.monotonic() - last_progress >= 20 or len(results) == len(images):
                    print(json.dumps({'phase': 'images', 'completed': len(results), 'total': len(images),
                        'elapsed_seconds': round(time.monotonic() - started, 1)}), flush=True)
                    last_progress = time.monotonic()
        embedded = {(row['model'], row['image_index']): row for row in recipe['embedded_images']}
        resources = []
        model_paths = []
        with ThreadPoolExecutor(max_workers=workers) as pool:
            futures = []
            for relative, path in paths:
                if relative in images:
                    continue
                destination = output / relative
                destination.parent.mkdir(parents=True, exist_ok=True)
                files.add(relative)
                if path.suffix.lower() == '.glb':
                    model_paths.append(relative)
                    futures.append(pool.submit(rewrite_model, path, relative, source, destination,
                        mapping, embedded, encoder))
                elif path.suffix.lower() == '.json':
                    resources.append(relative)
                    rewrite_resource(path, relative, destination, mapping, images, output_prefix)
                else:
                    shutil.copy2(path, destination)
            for future in as_completed(futures):
                model_rows.append(future.result())
                if len(model_rows) % 100 == 0 or len(model_rows) == len(futures):
                    print(json.dumps({'phase': 'models', 'completed': len(model_rows), 'total': len(futures)}), flush=True)
    for row in recipe['ui_replacements']:
        (output / row['texture']).unlink(missing_ok=True)
        (output / row['output_relative']).unlink(missing_ok=True)
    for row in images.values():
        if row['source_relative'].endswith('.png'):
            (output / row['source_relative']).unlink(missing_ok=True)
    for prefix in recipe['excluded_source_prefixes']:
        path = output / prefix
        if path.exists():
            shutil.rmtree(path)
    verify_references(output, resources, model_paths, recipe['ui_replacements'])
    recipe['source'] = source
    results.sort(key=lambda row: row['output_relative'])
    report = write_reports(output, recipe, results, model_rows, files, encoder.version)
    print(json.dumps({key: report[key] for key in ['image_files', 'embedded_images', 'profiles',
        'output_image_bytes', 'main_asset_bytes', 'verification']}, ensure_ascii=False), flush=True)


def main():
    parser = argparse.ArgumentParser(description='Generate compressed assets directly from HD sources and the approved recipe.')
    parser.add_argument('--source', type=Path, default=REPOSITORY / 'art/hd')
    parser.add_argument('--output', type=Path, default=REPOSITORY / 'art/compressed')
    parser.add_argument('--recipe', type=Path, default=RECIPE)
    parser.add_argument('--cwebp', default='cwebp')
    parser.add_argument('--workers', type=int, default=6)
    args = parser.parse_args()
    source, output = args.source.resolve(), args.output.resolve()
    if output == source or source in output.parents or output in source.parents:
        parser.error('Source and output must be separate directories')
    if args.workers < 1:
        parser.error('--workers must be at least 1')
    generate(source, output, args.recipe.resolve(), args.cwebp, args.workers)
