"""Reassemble original UI atlases from completed high-resolution regions."""
import argparse
import json
from pathlib import Path

from PIL import Image


def assemble(root):
    inventory = json.loads((root / 'art/hd-assets/inventory.json').read_text())
    textures = {entry['source']: entry for entry in inventory['textures']}
    paths = {entry['source'].lower(): entry['source'] for entry in inventory['textures']}
    runtime = root / 'recovery/output/web-assets'
    ui = json.loads((runtime / 'ui.json').read_text())
    atlases = {}
    for imageset in ui['imagesets']:
        path = str(Path(imageset['attributes']['Imagefile'].replace('\\', '/')).with_suffix('.png'))
        source = paths.get(path.lower())
        if source and textures[source].get('derived') == 'ui-atlas':
            atlases.setdefault(textures[source]['canonical'], imageset)
    completed = 0
    for canonical, imageset in atlases.items():
        entry = textures[canonical]
        if any(not (root / textures[image['asset']]['png']).exists() for image in imageset['images']):
            continue
        original = Image.open(root / entry['original']).convert('RGBA')
        atlas = original.resize(tuple(n * 4 for n in original.size), Image.Resampling.LANCZOS)
        for region in imageset['images']:
            artwork = Image.open(root / textures[region['asset']]['png']).convert('RGBA')
            size = (int(region['Width']) * 4, int(region['Height']) * 4)
            atlas.paste(artwork.resize(size, Image.Resampling.LANCZOS),
                        (int(region['XPos']) * 4, int(region['YPos']) * 4))
        delivered = root / entry['png']
        delivered.parent.mkdir(parents=True, exist_ok=True)
        atlas.save(delivered)
        completed += 1
    print(f'Assembled {completed}/{len(atlases)} UI atlases from original region coordinates', flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[1])
    assemble(parser.parse_args().root.resolve())
