#!/usr/bin/env python3
"""Compare delivered PNGs and installed GLBs with their original model data."""

import argparse
from datetime import datetime, timezone
from functools import lru_cache
import importlib.util
import json
import os
from pathlib import Path, PurePosixPath


@lru_cache(maxsize=4)
def read_bytes(path):
    return path.read_bytes()


def inspect(root, groups):
    spec = importlib.util.spec_from_file_location('hd_install', root / 'scripts/install-hd-assets.py')
    installer = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(installer)
    runtime = Path(os.environ.get('WEB_ASSETS', 'recovery/output/web-assets'))
    if not runtime.is_absolute():
        runtime = root / runtime
    inventory = json.loads((root / 'art/hd-assets/inventory.json').read_text())
    all_textures = {entry['source'].lower(): entry for entry in inventory['textures']
                    if not entry.get('intermediate')}
    available = {source: entry for source, entry in all_textures.items()
                 if not entry.get('deferred') and (root / entry['png']).is_file()}
    selected = [entry for entry in inventory['textures']
                if not entry.get('intermediate') and not entry.get('deferred')
                and (not groups or any(group in entry['groups'] for group in groups))]
    report = {'updated': datetime.now(timezone.utc).isoformat(timespec='seconds'),
              'scope': {'groups': groups or 'all', 'paths': len(selected)},
              'delivered': 0, 'installed': 0, 'models': 0, 'embeddedImages': 0, 'externalImages': 0,
              'deferredTextPaths': [entry['source'] for entry in inventory['textures'] if entry.get('deferred')],
              'pendingPaths': [], 'uninstalledPaths': [], 'unusedEmbeddedImages': [], 'issues': []}
    coverage = {'inventoryModels': len(inventory['models']), 'textureModels': 0,
                'untexturedModels': [], 'unmatchedTexturedModels': []}
    if not groups:
        report['runtimePngPathsOutsideInventory'] = sorted(
            path.relative_to(runtime).as_posix() for path in runtime.rglob('*.png')
            if path.relative_to(runtime).parts[0] != 'hd-ui'
            and path.relative_to(runtime).as_posix().lower() not in all_textures)
        report['runtimeModelsOutsideInventory'] = sorted(
            path.relative_to(runtime).as_posix() for path in runtime.rglob('*.glb')
            if path.relative_to(runtime).as_posix() not in inventory['models'])
        report['changedDeferredTextPaths'] = []
        for entry in inventory['textures']:
            if not entry.get('deferred'):
                continue
            installed = root / entry['installPath'] if entry.get('installPath') else runtime / entry['source']
            if not installed.is_file() or read_bytes(installed) != read_bytes(root / entry['original']):
                report['changedDeferredTextPaths'].append(entry['source'])
        report['uninstalledUiLayouts'] = []
        for source in (root / 'art/hd-ui/png').rglob('*.png'):
            installed = runtime / 'hd-ui' / source.relative_to(root / 'art/hd-ui/png')
            if not installed.is_file() or read_bytes(installed) != read_bytes(source):
                report['uninstalledUiLayouts'].append(source.relative_to(root).as_posix())
        report['uninstalledLocalUi'] = []
        for name in ('lobby-logo.png', 'normal-cursor.png', 'normal-cursor-hd.png', 'client-icon.ico'):
            source = root / 'art/hd-local-ui/png' / name
            installed = root / 'apps/web/src/assets/ui' / name
            if not installed.is_file() or read_bytes(installed) != read_bytes(source):
                report['uninstalledLocalUi'].append(name)
        report['uninstalledMapPreviews'] = []
        preview = 'custom-maps/1001/preview.svg'
        delivered = root / 'art/hd-assets/png' / preview
        installed = runtime / preview
        if not delivered.is_file() or not installed.is_file() or read_bytes(delivered) != read_bytes(installed):
            report['uninstalledMapPreviews'].append(preview)
    ready = {}
    for entry in selected:
        delivered = root / entry['png']
        if not delivered.is_file():
            report['pendingPaths'].append(entry['source'])
            continue
        report['delivered'] += 1
        ready[entry['source'].lower()] = entry
        installed = root / entry['installPath'] if entry.get('installPath') else runtime / entry['source']
        if not installed.is_file() or read_bytes(installed) != read_bytes(delivered):
            report['uninstalledPaths'].append(entry['source'])
        else:
            report['installed'] += 1
    directories = {str(PurePosixPath(source).parent) for source in ready}

    def issue(source, reason):
        report['issues'].append({'model': source, 'reason': reason})

    for source in inventory['models']:
        target = runtime / source
        snapshot = root / 'art/hd-assets/original-models' / source
        if not target.is_file():
            if not groups or str(PurePosixPath(source.lower()).parent) in directories:
                issue(source, 'Runtime model is missing')
            continue
        original_path = snapshot if snapshot.is_file() else target
        metadata = installer.read_glb_metadata(original_path)
        scoped_matches = installer.image_matches(metadata, source, ready)
        known_images = installer.image_matches(metadata, source, all_textures)
        referenced = installer.referenced_images(metadata)
        missing = referenced - known_images.keys()
        if not groups:
            if not referenced:
                coverage['untexturedModels'].append(source)
            elif missing:
                coverage['unmatchedTexturedModels'].append(source)
            else:
                coverage['textureModels'] += 1
        if not groups or scoped_matches or str(PurePosixPath(source.lower()).parent) in directories:
            for index in sorted(missing):
                issue(source, f'Referenced image {index} has no PNG inventory reference')
            unused = set(range(len(metadata.get('images', [])))) - referenced
            if unused:
                report['unusedEmbeddedImages'].append({'model': source, 'indices': sorted(unused)})
        if not scoped_matches:
            continue
        current, binary, _ = installer.read_glb(target.read_bytes())
        original, original_binary, _ = installer.read_glb(
            original_path.read_bytes())
        matches = installer.image_matches(original, source, available)
        if not matches:
            continue
        report['models'] += 1
        if not snapshot.is_file():
            issue(source, 'Original model snapshot is missing')
            continue
        mutable = {'images', 'bufferViews', 'buffers'}
        if ({key: value for key, value in current.items() if key not in mutable}
                != {key: value for key, value in original.items() if key not in mutable}):
            issue(source, 'Geometry, UV, animation or other original metadata differs')
        views = current.get('bufferViews', [])
        original_views = original.get('bufferViews', [])
        image_views = {image['bufferView'] for image in original.get('images', [])
                       if 'bufferView' in image}
        for index, before in enumerate(original_views):
            if index >= len(views):
                issue(source, f'Original buffer view {index} is missing')
                continue
            after = views[index]
            mutable_view = {'byteOffset', 'byteLength'} if index in image_views else {'byteOffset'}
            if ({key: value for key, value in before.items() if key not in mutable_view}
                    != {key: value for key, value in after.items() if key not in mutable_view}):
                issue(source, f'Original buffer view {index} metadata differs')
            if index not in image_views:
                old_offset, new_offset = before.get('byteOffset', 0), after.get('byteOffset', 0)
                if (original_binary[old_offset:old_offset + before['byteLength']]
                        != binary[new_offset:new_offset + after['byteLength']]):
                    issue(source, f'Geometry or animation buffer view {index} bytes differ')
        buffers = current.get('buffers', [])
        original_buffers = original.get('buffers', [])
        clean_buffers = [{key: value for key, value in buffer.items()
                          if index != 0 or key != 'byteLength'}
                         for index, buffer in enumerate(buffers)]
        clean_original = [{key: value for key, value in buffer.items()
                           if index != 0 or key != 'byteLength'}
                          for index, buffer in enumerate(original_buffers)]
        if clean_buffers != clean_original:
            issue(source, 'Original buffer metadata differs')
        images = current.get('images', [])
        original_images = original.get('images', [])
        if len(images) != len(original_images):
            issue(source, 'Original image count differs')
        for index, before in enumerate(original_images):
            if index >= len(images):
                break
            after = images[index]
            if index not in matches and after != before:
                issue(source, f'Unreplaced image {index} differs from the original')
            if index not in matches and 'bufferView' in before and 'bufferView' in after:
                old_view, new_view = original_views[before['bufferView']], views[after['bufferView']]
                old_offset, new_offset = old_view.get('byteOffset', 0), new_view.get('byteOffset', 0)
                if (original_binary[old_offset:old_offset + old_view['byteLength']]
                        != binary[new_offset:new_offset + new_view['byteLength']]):
                    issue(source, f'Unreplaced image {index} bytes differ from the original')
            allowed = {'uri', 'bufferView', 'mimeType'}
            if ({key: value for key, value in after.items() if key not in allowed}
                    != {key: value for key, value in before.items() if key not in allowed}):
                issue(source, f'Image {index} original metadata differs')
        for index, entry in matches.items():
            if index >= len(images):
                continue
            after = images[index]
            if 'uri' in after:
                image_path = target.parent / after['uri']
                expected = runtime / entry['source']
                if ('bufferView' in after or after.get('mimeType') != 'image/png'
                        or image_path.resolve() != expected.resolve()
                        or not image_path.is_file() or read_bytes(image_path) != read_bytes(root / entry['png'])):
                    issue(source, f'Image {index} external PNG differs from delivered {entry["source"]}')
                report['externalImages'] += 1
                continue
            view_index = after.get('bufferView')
            if (view_index is None or not 0 <= view_index < len(views)
                    or after.get('mimeType') != 'image/png' or 'uri' in after):
                issue(source, f'Image {index} has no installed PNG view')
                continue
            view = views[view_index]
            offset = view.get('byteOffset', 0)
            payload = binary[offset:offset + view['byteLength']]
            if (view.get('buffer', 0) != 0 or offset + view['byteLength'] > buffers[0]['byteLength']
                    or payload != read_bytes(root / entry['png'])):
                issue(source, f'Image {index} differs from delivered {entry["source"]}')
            report['embeddedImages'] += 1
    path = root / 'art/hd-assets/installation-inspection.json'
    temporary = path.with_suffix('.tmp')
    temporary.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    temporary.replace(path)
    if not groups:
        coverage_path = path.with_name('model-image-coverage.json')
        temporary = coverage_path.with_suffix('.tmp')
        temporary.write_text(json.dumps(coverage, ensure_ascii=False, indent=2) + '\n')
        temporary.replace(coverage_path)
    print(f'Compared {report["installed"]}/{report["delivered"]} installed PNGs, '
          f'{report["models"]} models, {report["embeddedImages"]} embedded and {report["externalImages"]} external images; '
          f'{len(report["pendingPaths"])} pending, {len(report["uninstalledPaths"])} uninstalled, '
          f'{len(report["issues"])} model issues')
    print(path)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument('--groups', nargs='*')
    args = parser.parse_args()
    inspect(args.root.resolve(), args.groups)


if __name__ == '__main__':
    main()
