import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
import io
import json
from pathlib import Path
import os
import shutil
import struct
import tempfile
from urllib.parse import unquote

from PIL import Image

from .encoding import WebpEncoder
from .package import glb_chunks
from .public_layout import organize_public, prune_empty_directories


REPOSITORY = Path(__file__).resolve().parents[2]
RECIPE = Path(__file__).with_name('recipe.json')
BIN_CHUNK = 0x004E4942


def original_image(relative, original, verified):
    candidates = [original / relative]
    if relative.startswith('tank-textures/role/'):
        candidates.append(original / relative.replace('tank-textures/role/', 'Data/role/', 1))
    for path in candidates:
        if path.is_file():
            return path
    relative = relative.replace('tank-textures/role/', 'Data/role/', 1)
    directory = verified / Path(relative).parent
    if directory.is_dir():
        basename = Path(relative).stem.lower()
        return next((path for path in directory.iterdir()
            if path.stem.lower() == basename and path.suffix.lower() in ('.dds', '.tga', '.bmp')), None)
    return None


def encode_original(payload, encoder):
    with Image.open(io.BytesIO(payload)) as source:
        size = list(source.size)
    encoded, _ = encoder.image(payload, '.png', size, 'keep-source')
    return encoded, size


def publish_image(row, original, verified, compressed, mobile, staged, encoder):
    relative = row['output_relative']
    high = compressed / relative
    native = original_image(row['source_relative'], original, verified)
    for quality in ('hd', 'original', 'mobile-hd'):
        (staged / quality / relative).parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(high, staged / 'hd' / relative)
    shutil.copy2(mobile / relative, staged / 'mobile-hd' / relative)
    low = staged / 'original' / relative
    if native:
        encoded, size = encode_original(native.read_bytes(), encoder)
        low.write_bytes(encoded)
    else:
        shutil.copy2(high, low)
        with Image.open(high) as image:
            size = list(image.size)
    with Image.open(high) as image:
        high_size = list(image.size)
    with Image.open(mobile / relative) as image:
        mobile_size = list(image.size)
    if mobile_size != size or mobile_size != row['mobile_target_size']:
        raise RuntimeError(f'Mobile texture dimensions differ from nostalgic artwork or recipe: {relative}')
    return {'asset': relative, 'source': str(native) if native else None,
        'original_size': size, 'hd_size': high_size, 'mobile_hd_size': mobile_size, 'shared': native is None}


def image_payload(document, binary, index, path):
    image = document['images'][index]
    if 'uri' in image:
        return (path.parent / unquote(image['uri'])).read_bytes()
    view = document['bufferViews'][image['bufferView']]
    start = view.get('byteOffset', 0)
    return binary[start:start + view['byteLength']]


def publish_model(relative, original, compressed, mobile, staged, encoder):
    high = compressed / relative
    high_target = staged / 'hd' / relative
    low_target = staged / 'original' / relative
    high_target.parent.mkdir(parents=True, exist_ok=True)
    low_target.parent.mkdir(parents=True, exist_ok=True)
    mobile_target = staged / 'mobile-hd' / relative
    mobile_target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(mobile / relative, mobile_target)
    shutil.copy2(high, high_target)
    chunks = glb_chunks(high.read_bytes())
    document = json.loads(chunks[0][1])
    binary = next((payload for kind, payload in chunks if kind == BIN_CHUNK), b'')
    embedded = [(index, image) for index, image in enumerate(document.get('images', [])) if 'bufferView' in image]
    if not embedded:
        shutil.copy2(high, low_target)
        return 0
    native_path = original / relative
    native_chunks = glb_chunks(native_path.read_bytes())
    native_document = json.loads(native_chunks[0][1])
    native_binary = next((payload for kind, payload in native_chunks if kind == BIN_CHUNK), b'')
    replacements = {}
    for index, image in embedded:
        encoded, _ = encode_original(image_payload(native_document, native_binary, index, native_path), encoder)
        replacements[image['bufferView']] = encoded
    rebuilt = bytearray()
    for index, view in enumerate(document['bufferViews']):
        rebuilt.extend(b'\0' * (-len(rebuilt) % 4))
        start = view.get('byteOffset', 0)
        content = replacements.get(index, binary[start:start + view['byteLength']])
        view['byteOffset'] = len(rebuilt)
        view['byteLength'] = len(content)
        rebuilt.extend(content)
    document['buffers'][0]['byteLength'] = len(rebuilt)
    rebuilt.extend(b'\0' * (-len(rebuilt) % 4))
    metadata = json.dumps(document, ensure_ascii=False, separators=(',', ':')).encode()
    metadata += b' ' * (-len(metadata) % 4)
    chunks[0] = (chunks[0][0], metadata)
    body = b''.join(struct.pack('<II', len(value), kind) + value
        for kind, payload in chunks for value in [bytes(rebuilt) if kind == BIN_CHUNK else payload])
    low_target.write_bytes(struct.pack('<III', 0x46546C67, 2, 12 + len(body)) + body)
    return len(embedded)


def generate(original, compressed, mobile, verified, output, recipe_path, cwebp, workers):
    previous_path = output / 'manifests/battle-artwork.json'
    previous = json.loads(previous_path.read_text()) if previous_path.is_file() else {}
    recipe = json.loads(recipe_path.read_text())
    images = [row for row in recipe['images']
        if not row['category'].startswith('ui_') and row['category'] != 'minimap_keep']
    models = sorted(path.relative_to(compressed).as_posix() for path in compressed.rglob('*.glb')
        if path.relative_to(compressed).parts[0] not in ('lossy-trial', 'analysis', 'reports'))
    variants = {'original': {}, 'hd': {}, 'mobile-hd': {}}
    output.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='.battle-artwork-', dir=output) as directory:
        work = Path(directory)
        staged = work / 'battle-artwork'
        encoder = WebpEncoder(cwebp, {'baseline': ['-lossless', '-q', '75', '-m', '4', '-exact']}, work)
        rows = []
        with ThreadPoolExecutor(max_workers=workers) as pool:
            futures = [pool.submit(publish_image, row, original, verified, compressed, mobile, staged, encoder) for row in images]
            for index, future in enumerate(as_completed(futures), 1):
                rows.append(future.result())
                if index % 250 == 0 or index == len(futures):
                    print(f'Battle textures: {index}/{len(futures)}', flush=True)
            futures = [pool.submit(publish_model, relative, original, compressed, mobile, staged, encoder) for relative in models]
            embedded = sum(future.result() for future in as_completed(futures))
        for quality in variants:
            for row in images:
                target = f'/battle-artwork/{quality}/{row["output_relative"]}'
                for relative in (row['source_relative'], row['output_relative']):
                    variants[quality]['/' + relative] = target
            for relative in models:
                variants[quality]['/' + relative] = f'/battle-artwork/{quality}/{relative}'
            for relative in models:
                path = staged / quality / relative
                document = json.loads(glb_chunks(path.read_bytes())[0][1])
                for image in document.get('images', []):
                    if 'uri' in image and not (path.parent / unquote(image['uri'])).is_file():
                        raise RuntimeError(f'Model texture missing: {quality}/{relative}: {image["uri"]}')
        summary = {'textures': len(images), 'original_textures': sum(not row['shared'] for row in rows),
            'shared_textures': sum(row['shared'] for row in rows), 'models': len(models),
            'embedded_original_images': embedded, 'mobile_hd_textures': len(images)}
        manifest = {'version': 1, 'variants': variants, 'summary': summary,
            'textures': sorted(rows, key=lambda row: row['asset'])}
        temporary_manifest = work / 'battle-artwork.json'
        temporary_manifest.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
        destination = output / 'battle-artwork'
        shutil.rmtree(destination, ignore_errors=True)
        staged.replace(destination)
        temporary_manifest.replace(output / 'battle-artwork.json')
    organize_public(output)
    current = json.loads(previous_path.read_text())
    previous_files = {url for variant in previous.get('variants', {}).values() for url in variant.values()}
    current_files = {url for variant in current['variants'].values() for url in variant.values()}
    for url in previous_files - current_files:
        if url.startswith(('/assets/models/', '/assets/textures/')):
            (output / url.lstrip('/')).unlink(missing_ok=True)
    prune_empty_directories(output)
    print(json.dumps(summary, ensure_ascii=False, indent=2), flush=True)


def main():
    parser = argparse.ArgumentParser(description='Publish original, desktop HD and mobile HD battle models and textures.')
    parser.add_argument('--original', type=Path, default=REPOSITORY / 'art/original')
    parser.add_argument('--compressed', type=Path, default=REPOSITORY / 'art/compressed')
    parser.add_argument('--compressed-mobile', type=Path, default=REPOSITORY / 'art/compressed-mobile')
    parser.add_argument('--verified', type=Path, default=REPOSITORY / 'recovery/output/verified/assets/data')
    parser.add_argument('--output', type=Path, default=REPOSITORY / os.environ.get('CDTANK_WEB_ASSETS', 'apps/web/public'))
    parser.add_argument('--recipe', type=Path, default=RECIPE)
    parser.add_argument('--cwebp', default='cwebp')
    parser.add_argument('--workers', type=int, default=6)
    args = parser.parse_args()
    output = args.output.resolve()
    if args.workers < 1:
        parser.error('Workers must be positive.')
    for source in (args.original.resolve(), args.compressed.resolve(), args.compressed_mobile.resolve()):
        if output.is_relative_to(source) or source.is_relative_to(output):
            parser.error('Source and output directories must not overlap.')
    generate(args.original.resolve(), args.compressed.resolve(), args.compressed_mobile.resolve(), args.verified.resolve(), output,
        args.recipe.resolve(), args.cwebp, args.workers)
