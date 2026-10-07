#!/usr/bin/env python3
"""Create an offline original/HD gallery from the delivered asset inventory."""

import argparse
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import struct
from urllib.parse import quote


def png_size(path):
    with path.open('rb') as stream:
        header = stream.read(24)
    return list(struct.unpack('>II', header[16:24]))


def relative_url(path, directory):
    return quote(Path(os.path.relpath(path, directory)).as_posix(), safe='/')


def render(root):
    destination = root / 'art/hd-assets/asset-gallery.html'
    inventory = json.loads((destination.parent / 'inventory.json').read_text())
    records = []
    for entry in inventory['textures']:
        original = root / entry['original']
        delivered = root / entry['png']
        ready = delivered.is_file()
        records.append({
            'source': entry['source'],
            'groups': entry['groups'],
            'size': entry['size'],
            'hdSize': png_size(delivered) if ready else None,
            'original': relative_url(original, destination.parent),
            'hd': relative_url(delivered, destination.parent) if ready else None,
            'layer': 'loading' in entry['groups'] or entry.get('intermediate', False),
        })
    previews = []
    preview_paths = list((root / 'art/hd-assets/previews').glob('*.png'))
    preview_paths.extend((root / 'art/hd-ui/png').glob('*/layout-*.png'))
    preview_paths.extend((root / 'art/hd-ui/png/loading').glob('*.png'))
    for path in sorted(preview_paths):
        name = path.stem if path.parent.name == 'previews' else f'{path.parent.name}/{path.stem}'
        previews.append({'name': name, 'url': relative_url(path, destination.parent)})
    data = {'assets': records, 'previews': previews,
            'updated': datetime.now(timezone.utc).isoformat(timespec='seconds')}
    payload = json.dumps(data, ensure_ascii=False, separators=(',', ':')).replace('<', '\\u003c')
    resources = root / 'scripts/hd-asset-gallery'
    html = (resources / 'index.html').read_text()
    html = html.replace('/* GALLERY_STYLE */', (resources / 'gallery.css').read_text())
    html = html.replace('/* GALLERY_DATA */', payload)
    html = html.replace('/* GALLERY_SCRIPT */', (resources / 'gallery.js').read_text())
    temporary = destination.with_suffix('.tmp')
    temporary.write_text(html)
    temporary.replace(destination)
    base = [entry for entry in records if not entry['layer']]
    print(f'Gallery: {sum(bool(entry["hd"]) for entry in base)}/{len(base)} base assets; {destination}')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[1])
    args = parser.parse_args()
    render(args.root.resolve())


if __name__ == '__main__':
    main()
