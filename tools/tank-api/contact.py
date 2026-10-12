"""Make visual review sheets from actual model renders."""

import argparse
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('tank')
    parser.add_argument('--workspace', required=True)
    args = parser.parse_args()
    output = Path(args.workspace) / 'output/imagegen/tank-api4k' / args.tank
    renders = output / 'renders'
    review = output / 'review'
    review.mkdir(exist_ok=True)
    skins = sorted(folder.name for folder in renders.iterdir() if folder.is_dir())
    views = ['center', 'top', 'left', 'right', 'front', 'rear']
    font = ImageFont.load_default(size=16)
    for batch in range(0, len(skins), 4):
        selected = skins[batch:batch + 4]
        sheet = Image.new('RGB', (6 * 230, len(selected) * 2 * 256), '#171c21')
        draw = ImageDraw.Draw(sheet)
        for row, suffix in enumerate(selected):
            for mode_index, mode in enumerate(['original', 'api4k']):
                y = (row * 2 + mode_index) * 256
                for column, view in enumerate(views):
                    image = Image.open(renders / suffix / f'{mode}-{view}.png').convert('RGB')
                    image.thumbnail((226, 226), Image.Resampling.LANCZOS)
                    sheet.paste(image, (column * 230 + 2, y + 28))
                    draw.text((column * 230 + 5, y + 5), f'{suffix} {mode} {view}', font=font, fill='white')
        target = review / f'contact-{batch // 4 + 1:02}.jpg'
        sheet.save(target, quality=94)
        print(target)
    manifest = {'tank': args.tank, 'skins': skins, 'views': views,
                'sheets': [p.name for p in sorted(review.glob('contact-*.jpg'))]}
    (review / 'sheets.json').write_text(json.dumps(manifest, indent=2) + '\n')


if __name__ == '__main__':
    main()
