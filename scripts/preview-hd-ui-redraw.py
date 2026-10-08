"""Export original and replacement UI artwork for visual approval."""
import argparse
import json
import math
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / 'art/hd-ui-redraw'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--candidate-dir', type=Path, default=ART / 'candidates')
    parser.add_argument('--output-dir', type=Path, default=ART / 'review')
    args = parser.parse_args()
    args.candidate_dir = args.candidate_dir.resolve()
    args.output_dir = args.output_dir.resolve()
    inventory = {entry['source']: entry for entry in
                 json.loads((ROOT / 'art/hd-assets/inventory.json').read_text())['textures']}
    rows = []
    for path in args.candidate_dir.rglob('*.png'):
        source = path.relative_to(args.candidate_dir).as_posix()
        rows.append(dict(source=source, candidate=path.relative_to(ROOT).as_posix(),
                         original=inventory[source]['original']))
    rows.sort(key=lambda row: row['source'])
    folder = args.output_dir
    folder.mkdir(parents=True, exist_ok=True)
    pages = []
    for start in range(0, len(rows), 32):
        entries = rows[start:start + 32]
        canvas = Image.new('RGB', (1600, math.ceil(len(entries) / 4) * 190), '#e9ecef')
        draw = ImageDraw.Draw(canvas)
        for index, entry in enumerate(entries):
            x, y = index % 4 * 400, index // 4 * 190
            draw.text((x + 8, y + 4), f"{start + index:03} {entry['source']}", fill='#17212a')
            for column, key in enumerate(('original', 'candidate')):
                draw.text((x + column * 200 + 8, y + 18), 'Original' if column == 0 else 'API', fill='#17212a')
                with Image.open(ROOT / entry[key]) as image:
                    image = image.convert('RGBA')
                    ratio = min(186 / image.width, 148 / image.height)
                    image = image.resize((max(1, round(image.width * ratio)), max(1, round(image.height * ratio))),
                                         Image.Resampling.NEAREST if key == 'original' else Image.Resampling.LANCZOS)
                    canvas.paste(image, (x + column * 200 + 7 + (186 - image.width) // 2,
                                        y + 36 + (148 - image.height) // 2), image)
        path = folder / f'{start // 32:03}.png'
        canvas.save(path)
        pages.append(dict(path=path.relative_to(ROOT).as_posix(), assets=[entry['source'] for entry in entries]))
    folder.with_suffix('.json').write_text(json.dumps(dict(entries=rows, pages=pages), ensure_ascii=False, indent=2) + '\n')
    print(f'{len(rows)} API asset comparisons; {len(pages)} pages')


if __name__ == '__main__':
    main()
