"""Export side-by-side original and published UI artwork for visual inspection."""
import json
from collections import defaultdict
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / 'art/hd-ui-redraw'


def main():
    inventory = json.loads((ROOT / 'art/hd-assets/inventory.json').read_text())
    sprites = json.loads((ROOT / 'recovery/output/web-assets/sprite-images.json').read_text())['images']
    text = json.loads((ROOT / 'apps/web/src/interface/resources/source-text-artwork.json').read_text())['assets']
    ui = json.loads((ROOT / 'recovery/output/web-assets/ui.json').read_text())
    names = defaultdict(list)
    for imageset in ui['imagesets']:
        for image in imageset['images']:
            if image.get('asset'):
                names[image['asset']].append(image['Name'])
    entries = []
    seen = set()
    for entry in inventory['textures']:
        source = entry['source']
        if 'ui' not in entry.get('groups', []) or entry.get('intermediate') or source in text:
            continue
        if '/' + source not in sprites and not (ROOT / 'recovery/output/web-assets' / source).is_file():
            continue
        if entry['png'] in seen:
            continue
        seen.add(entry['png'])
        entries.append(dict(entry, names=names[source]))
    entries.sort(key=lambda entry: entry['source'])
    folder = ART / 'audit'
    folder.mkdir(parents=True, exist_ok=True)
    pages = []
    for start in range(0, len(entries), 40):
        rows = entries[start:start + 40]
        canvas = Image.new('RGB', (1600, 1640), '#eceef0')
        draw = ImageDraw.Draw(canvas)
        for index, entry in enumerate(rows):
            x, y = index % 4 * 400, index // 4 * 164
            draw.text((x + 8, y + 4), f"{start + index:04} {entry['source']}", fill='#17212a')
            name = Path(entry['names'][0].replace('\\', '/')).stem if entry['names'] else ''
            draw.text((x + 8, y + 18), name[:50], fill='#17212a')
            for column, (label, path) in enumerate((('Original', entry['original']), ('HD', entry['png']))):
                draw.text((x + column * 200 + 8, y + 34), label, fill='#17212a')
                with Image.open(ROOT / path) as image:
                    image = image.convert('RGBA')
                    ratio = min(188 / image.width, 106 / image.height)
                    image = image.resize((max(1, round(image.width * ratio)), max(1, round(image.height * ratio))),
                                         Image.Resampling.LANCZOS)
                    canvas.paste(image, (x + column * 200 + 6 + (188 - image.width) // 2,
                                        y + 48 + (106 - image.height) // 2), image)
        path = folder / f'{start // 40:03}.png'
        canvas.save(path)
        pages.append(dict(path=path.relative_to(ROOT).as_posix(), first=start,
                          last=start + len(rows) - 1, assets=[entry['source'] for entry in rows]))
    (ART / 'audit.json').write_text(json.dumps(dict(entries=entries, pages=pages), ensure_ascii=False, indent=2) + '\n')
    print(f'{len(entries)} distinct UI assets, {len(pages)} comparison pages: {ART / "audit.json"}')


if __name__ == '__main__':
    main()
