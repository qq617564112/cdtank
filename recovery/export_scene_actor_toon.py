"""Publish the original default actor toon light resources."""
import argparse
import json
import struct
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SOURCE_ROOT = ROOT / 'recovery/output/verified/assets/data/Data'
DEFAULT_OUTPUT_ROOT = ROOT / 'recovery/output/web-assets'
MAP_IDS = tuple(f'{map_id:04d}' for map_id in range(1, 26))
TEXTURE_SOURCE = 'Data/image/toon/0.bmp'
TEXTURE = 'scene/actor-toon/0.png'


def candidate_count(path):
    raw = path.read_bytes()
    if len(raw) != 4:
        raise ValueError(f'Incomplete ctl file: {path}')
    return struct.unpack('<I', raw)[0]


def publish(source_root, output_root):
    maps = []
    for map_id in MAP_IDS:
        source = f'Data/scn/{map_id}/{map_id}.ctl'
        count = candidate_count(source_root / source.removeprefix('Data/'))
        if count:
            raise ValueError(
                f'Map {map_id} has {count} actor light candidates; '
                'the default toon resources require zero candidates')
        maps.append(dict(id=map_id, source=source, candidateCount=count))

    texture_path = output_root / TEXTURE
    texture_path.parent.mkdir(parents=True, exist_ok=True)
    with Image.open(source_root / TEXTURE_SOURCE.removeprefix('Data/')) as image:
        image.convert('RGB').save(texture_path, format='PNG')

    document = dict(
        source=TEXTURE_SOURCE,
        texture=TEXTURE,
        lightPosition=[0, 200, 0],
        maps=maps,
        resolution='original')
    metadata_path = output_root / 'scene-actor-toon.json'
    metadata_path.write_text(
        json.dumps(document, indent=2) + '\n', encoding='utf-8')
    return document


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source-root', type=Path, default=DEFAULT_SOURCE_ROOT)
    parser.add_argument('--output-root', type=Path, default=DEFAULT_OUTPUT_ROOT)
    args = parser.parse_args()
    document = publish(args.source_root, args.output_root)
    print(f"Published {len(document['maps'])} original actor toon maps")


if __name__ == '__main__':
    main()
