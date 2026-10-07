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
    selected = [entry for entry in inventory['textures']
                if not entry.get('intermediate')
                and (not groups or any(group in entry['groups'] for group in groups))]
    report = {'updated': datetime.now(timezone.utc).isoformat(timespec='seconds'),
              'scope': {'groups': groups or 'all', 'paths': len(selected)},
              'delivered': 0, 'installed': 0, 'models': 0, 'embeddedImages': 0,
              'pendingPaths': [], 'uninstalledPaths': [], 'issues': []}
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
        if str(PurePosixPath(source.lower()).parent) not in directories:
            continue
        target = runtime / source
        snapshot = root / 'art/hd-assets/original-models' / source
        if not target.is_file():
            issue(source, 'Runtime model is missing')
            continue
        current, binary, _ = installer.read_glb(target.read_bytes())
        original, original_binary, _ = installer.read_glb(
            snapshot.read_bytes() if snapshot.is_file() else target.read_bytes())
        matches = installer.image_matches(original, source, ready)
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
        if views[:len(original_views)] != original_views:
            issue(source, 'Original buffer views differ')
        if binary[:len(original_binary)] != original_binary:
            issue(source, 'Original buffer bytes differ')
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
            allowed = {'uri', 'bufferView', 'mimeType'}
            if ({key: value for key, value in after.items() if key not in allowed}
                    != {key: value for key, value in before.items() if key not in allowed}):
                issue(source, f'Image {index} original metadata differs')
        for index, entry in matches.items():
            if index >= len(images):
                continue
            after = images[index]
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
    print(f'Compared {report["installed"]}/{report["delivered"]} installed PNGs, '
          f'{report["models"]} models and {report["embeddedImages"]} embedded images; '
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
