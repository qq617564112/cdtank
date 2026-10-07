"""Reassemble original UI atlases from completed high-resolution regions."""
import argparse
import json
from pathlib import Path
import subprocess
import sys

from PIL import Image


def assemble(root):
    subprocess.run([sys.executable, str(root / 'scripts/prepare-hd-layered-ui.py'),
                    'assemble', '--root', str(root)], check=True)
    inventory = json.loads((root / 'art/hd-assets/inventory.json').read_text())
    textures = {entry['source']: entry for entry in inventory['textures']}
    paths = {entry['source'].lower(): entry['source'] for entry in inventory['textures']}
    runtime = root / 'recovery/output/web-assets'
    ui = json.loads((runtime / 'ui.json').read_text())
    atlases = {}
    for imageset in ui['imagesets']:
        path = str(Path(imageset['attributes']['Imagefile'].replace('\\', '/')).with_suffix('.png'))
        source = paths.get(path.lower())
        if (source and textures[source].get('derived') == 'ui-atlas'
                and not textures[source].get('deferred')):
            atlases.setdefault(textures[source]['canonical'], imageset)
    completed = 0
    for canonical, imageset in atlases.items():
        entry = textures[canonical]
        regions = [image for image in imageset['images'] if 'XPos' in image and 'YPos' in image]
        if any(not textures[image['asset']].get('deferred')
               and not (root / textures[image['asset']]['png']).exists() for image in regions):
            continue
        original = Image.open(root / entry['original']).convert('RGBA')
        inverted = Path(imageset['attributes']['Imagefile']).suffix.lower() == '.dds'
        if inverted:
            original = original.transpose(Image.Transpose.FLIP_TOP_BOTTOM)
        atlas = original.resize(tuple(n * 4 for n in original.size), Image.Resampling.NEAREST)
        for region in regions:
            if textures[region['asset']].get('deferred'):
                continue
            artwork = Image.open(root / textures[region['asset']]['png']).convert('RGBA')
            size = (int(region['Width']) * 4, int(region['Height']) * 4)
            atlas.paste(artwork.resize(size, Image.Resampling.LANCZOS),
                        (int(region['XPos']) * 4, int(region['YPos']) * 4))
        if inverted:
            atlas = atlas.transpose(Image.Transpose.FLIP_TOP_BOTTOM)
        delivered = root / entry['png']
        delivered.parent.mkdir(parents=True, exist_ok=True)
        temporary = delivered.with_suffix('.assembling.tmp')
        atlas.save(temporary, format='PNG')
        temporary.replace(delivered)
        completed += 1
    print(f'Assembled {completed}/{len(atlases)} UI atlases from original region coordinates', flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[1])
    assemble(parser.parse_args().root.resolve())
