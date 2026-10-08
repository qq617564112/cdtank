import argparse
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont


SIZE = 64
SCALE = 8
OUTLINE = 3
INSET = 4
COLOURS = {'self': (255, 255, 255), 'enemy': (255, 80, 80), 'friend': (80, 160, 255)}


def icon_variants(path):
    image = Image.open(path).convert('RGBA')
    bounds = image.getchannel('A').getbbox()
    if bounds is None:
        raise ValueError(f'坦克模型没有可见像素：{path}')
    image = image.crop(bounds)
    image.thumbnail(((SIZE - INSET * 2) * SCALE,) * 2, Image.Resampling.LANCZOS)
    canvas = Image.new('RGBA', (SIZE * SCALE,) * 2)
    canvas.alpha_composite(image, ((canvas.width - image.width) // 2,
                                  (canvas.height - image.height) // 2))
    mask = canvas.getchannel('A').point(lambda value: 255 if value >= 128 else 0)
    outer = mask.filter(ImageFilter.MaxFilter(OUTLINE * SCALE * 2 + 1))
    variants = {}
    for side, colour in COLOURS.items():
        outlined = Image.new('RGBA', canvas.size, (*colour, 0))
        outlined.putalpha(outer)
        outlined.alpha_composite(canvas)
        variants[side] = outlined.resize((SIZE, SIZE), Image.Resampling.LANCZOS)
    return variants


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--renders', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--assets', type=Path, required=True)
    parser.add_argument('--overview', type=Path, required=True)
    args = parser.parse_args()
    tanks = json.loads((args.assets / 'tanks.json').read_text())
    args.output.mkdir(parents=True, exist_ok=True)
    columns, cell_width, cell_height, header = 7, 224, 116, 48
    overview = Image.new('RGBA', (columns * cell_width,
                                 header + ((len(tanks) + columns - 1) // columns) * cell_height),
                         (27, 33, 39, 255))
    draw = ImageDraw.Draw(overview)
    font = ImageFont.truetype(str(args.assets / 'ui/fonts/xiangjiao-brush.ttf'), 16)
    draw.text((16, 12), 'Tank minimap icons | 64 x 64 | 3px outline | turret 150%',
              fill='white', font=font)
    for index, tank in enumerate(tanks):
        code = f"{tank['id']:03d}"
        variants = icon_variants(args.renders / f'{code}.png')
        x, y = index % columns * cell_width, header + index // columns * cell_height
        for variant_index, (side, icon) in enumerate(variants.items()):
            icon.save(args.output / f'{code}-{side}.png')
            overview.alpha_composite(icon, (x + 8 + variant_index * 72, y + 4))
        draw.text((x + cell_width // 2, y + 80), f"{code} {tank['name']}",
                  anchor='mt', fill='white', font=font)
    args.overview.parent.mkdir(parents=True, exist_ok=True)
    overview.save(args.overview)
    print(f'{len(tanks)}种坦克，{len(tanks) * len(COLOURS)}张64×64图标；总览：{args.overview}')


if __name__ == '__main__':
    main()
