"""Generate mobile HD battle artwork from HD sources at nostalgic dimensions."""

from concurrent.futures import ThreadPoolExecutor, as_completed
import json
from pathlib import Path
import tempfile
import time

from .encoding import WebpEncoder
from .package import rewrite_model
from .pipeline import process_image, write_json


def generate_mobile(source, output, recipe_path, cwebp, workers, selected=None):
    recipe = json.loads(recipe_path.read_text())
    rows = [{**row, 'target_size': row['mobile_target_size'], 'basis': row['mobile_size_basis']}
        for row in recipe['images']
        if not row['category'].startswith('ui_') and row['category'] != 'minimap_keep']
    mapping = {row['source_relative']: row['output_relative'] for row in rows}
    if selected:
        selected = set(selected)
        rows = [row for row in rows
            if row['source_relative'] in selected or row['output_relative'] in selected]
        matched = {name for row in rows for name in (row['source_relative'], row['output_relative'])}
        if selected - matched:
            raise ValueError(f'Images have no mobile sizing recipe: {", ".join(sorted(selected - matched))}')
    for row in rows:
        width, height = row['source_size']
        target_width, target_height = row['target_size']
        if target_width > width or target_height > height or width * target_height != height * target_width:
            raise ValueError(f'Mobile dimensions must preserve aspect ratio without enlargement: {row["source_relative"]}')
    output.mkdir(parents=True, exist_ok=True)
    images, models = [], []
    started = time.monotonic()
    with tempfile.TemporaryDirectory(prefix='.generate-', dir=output) as directory:
        encoder = WebpEncoder(cwebp, recipe['encoder'], Path(directory))
        with ThreadPoolExecutor(max_workers=workers) as pool:
            futures = [pool.submit(process_image, row, source, output, encoder) for row in rows]
            last_progress = time.monotonic()
            for future in as_completed(futures):
                images.append(future.result())
                if time.monotonic() - last_progress >= 20 or len(images) == len(rows):
                    print(json.dumps({'phase': 'mobile-images', 'completed': len(images), 'total': len(rows),
                        'elapsed_seconds': round(time.monotonic() - started, 1)}), flush=True)
                    last_progress = time.monotonic()
            if not selected:
                embedded = {(row['model'], row['image_index']):
                    {**row, 'target_size': row['mobile_target_size'], 'basis': row['mobile_size_basis']}
                    for row in recipe['embedded_images']}
                futures = []
                for path in sorted(source.rglob('*.glb')):
                    relative = path.relative_to(source).as_posix()
                    if any(relative.startswith(prefix) for prefix in recipe['excluded_source_prefixes']):
                        continue
                    destination = output / relative
                    destination.parent.mkdir(parents=True, exist_ok=True)
                    futures.append(pool.submit(rewrite_model, path, relative, source, destination,
                        mapping, embedded, encoder))
                for future in as_completed(futures):
                    models.append(future.result())
    if not selected:
        from .geometry import preprocess_geometry
        preprocess_geometry(output)
        for row in models:
            row['output_bytes'] = (output / row['model']).stat().st_size
    report = {'source': str(source), 'output': str(output), 'encoder_version': encoder.version,
        'image_files': len(images), 'model_files': len(models),
        'source_image_bytes': sum(row['source_bytes'] for row in images),
        'output_image_bytes': sum(row['output_bytes'] for row in images),
        'source_pixels': sum(row['source_size'][0] * row['source_size'][1] for row in images),
        'output_pixels': sum(row['target_size'][0] * row['target_size'][1] for row in images),
        'files': sorted(images, key=lambda row: row['output_relative']),
        'models': sorted(models, key=lambda row: row['model'])}
    reports = output / 'reports'
    reports.mkdir(exist_ok=True)
    write_json(reports / ('selected-assets.json' if selected else 'generated-assets.json'), report)
    print(json.dumps({key: value for key, value in report.items() if key not in ('files', 'models')},
        ensure_ascii=False, indent=2), flush=True)
