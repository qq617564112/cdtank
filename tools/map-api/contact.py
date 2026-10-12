"""Six-view original/API contact sheets for each object action and texture."""

import argparse
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


def contacts(workspace, model):
    output = Path(workspace) / 'output/imagegen/map-api4k' / model
    scope = json.loads((output / 'renders/scope.json').read_text())
    font = ImageFont.load_default(size=16)
    paths = []
    for item in scope['models']:
        source = output / 'renders' / item['action'] / Path(item['variant']).stem
        sheet = Image.new('RGB', (1200, 1696), '#171c21')
        draw = ImageDraw.Draw(sheet)
        for index, view in enumerate(['left', 'center', 'right', 'top', 'front', 'rear']):
            column = index % 3
            row = index // 3
            for offset, mode in enumerate(['original', 'api4k']):
                x, y = column * 400, (row * 2 + offset) * 424
                image = Image.open(source / (mode + '-' + view + '.png')).convert('RGB')
                image.thumbnail((400, 400), Image.Resampling.LANCZOS)
                sheet.paste(image, (x, y + 24))
                draw.text((x + 4, y + 4), f'{model} {item["action"]} {item["variant"]} {mode} {view}', fill='white', font=font)
        path = source / 'comparison.jpg'
        sheet.save(path, quality=96)
        paths.append(str(path))
    print('\n'.join(paths))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('model')
    parser.add_argument('workspace')
    args = parser.parse_args()
    contacts(args.workspace, args.model)
