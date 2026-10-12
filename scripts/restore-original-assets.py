#!/usr/bin/env python3
"""Publish original UI images with HD model textures and minimaps."""
import argparse
import json
import os
from pathlib import Path
import shutil

from image_asset_usage import IMAGE_EXTENSIONS, image_usage
from asset_compression.public_layout import organize_public


def publish_images(root, runtime, directory):
    count = 0
    for source in directory.rglob('*'):
        if not source.is_file() or source.suffix.lower() not in IMAGE_EXTENSIONS:
            continue
        name = source.relative_to(directory).as_posix()
        target = runtime / name
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, target)
        count += 1
    return count


def restore(root, runtime):
    original = root / 'art/original'
    hd = root / 'art/hd'
    if not original.is_dir() or not hd.is_dir():
        raise FileNotFoundError('Original and HD artwork are required in art/original and art/hd')
    restored = publish_images(root, runtime, original)
    installed = publish_images(root, runtime, hd)
    track_animations = hd / 'tank-track-animations.json'
    if track_animations.is_file():
        shutil.copyfile(track_animations, runtime / track_animations.name)
    shutil.rmtree(runtime / 'sprites', ignore_errors=True)
    shutil.rmtree(runtime / 'assets/ui/atlases', ignore_errors=True)
    (runtime / 'sprite-images.json').unlink(missing_ok=True)
    (runtime / 'manifests/sprite-images.json').unlink(missing_ok=True)
    sources = {path.relative_to(runtime).as_posix(): path for path in runtime.rglob('*')
               if path.is_file() and path.suffix.lower() in IMAGE_EXTENSIONS}
    sources.update({'local-images/' + path.relative_to(root / 'apps/web/src').as_posix(): path
                    for path in (root / 'apps/web/src').rglob('*')
                    if path.is_file() and path.suffix.lower() in IMAGE_EXTENSIONS})
    usage = image_usage(root, runtime, sources)
    if usage['missingModelImages']:
        raise ValueError(usage['missingModelImages'])
    ui_path = runtime / ('ui.json' if (runtime / 'ui.json').is_file() else 'manifests/ui.json')
    ui_path.write_text(json.dumps(usage['ui'], ensure_ascii=False, separators=(',', ':')) + '\n')
    for name, path in sources.items():
        if name not in usage['images']:
            path.unlink()
    print(f'Published {restored} original images and {installed} HD model/minimap images as individual files')
    organize_public(runtime)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[1])
    args = parser.parse_args()
    root = args.root.resolve()
    runtime = Path(os.environ.get('CDTANK_WEB_ASSETS', 'apps/web/public'))
    if not runtime.is_absolute():
        runtime = root / runtime
    restore(root, runtime)


if __name__ == '__main__':
    main()
