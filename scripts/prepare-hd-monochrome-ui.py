"""Show monochrome transparent UI strokes in white-on-black edit references."""

import json
from pathlib import Path

import numpy as np
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / 'art/hd-assets'


def main():
    inventory_path = ART / 'inventory.json'
    inventory = json.loads(inventory_path.read_text())
    textures = {entry['source']: entry for entry in inventory['textures']}
    monochrome = {}
    for entry in inventory['textures']:
        if 'ui' not in entry['groups'] or entry.get('derived') or entry.get('intermediate'):
            continue
        with Image.open(ROOT / entry['original']) as original:
            pixels = np.asarray(original.convert('RGBA'))
        alpha = pixels[:, :, 3]
        if alpha.min() == 255 or alpha.max() == 0:
            continue
        colors = pixels[:, :, :3][alpha > 0]
        if not np.all(colors == colors[0]):
            continue
        entry['solidColor'] = colors[0].tolist()
        entry['inkReference'] = [255, 255, 255]
        monochrome[entry['canonical']] = entry
    for canonical, entry in monochrome.items():
        textures[canonical]['solidColor'] = entry['solidColor']
        textures[canonical]['inkReference'] = entry['inkReference']
    temporary = inventory_path.with_suffix('.monochrome.tmp')
    temporary.write_text(json.dumps(inventory, ensure_ascii=False, indent=2) + '\n')
    temporary.replace(inventory_path)
    plan = json.loads((ART / 'plan.json').read_text())
    changed = 0
    for batch in plan['batches']:
        cells = [cell for cell in batch['cells']
                 if cell['source'] in monochrome and not cell.get('sourceBox')]
        if not cells or (ROOT / batch['output']).exists():
            continue
        with Image.open(ROOT / batch['input']) as original:
            canvas = original.convert('RGB')
        for cell in cells:
            entry = monochrome[cell['source']]
            with Image.open(ROOT / entry['original']) as original:
                alpha = original.convert('RGBA').getchannel('A')
            x, y, right, bottom = cell['box']
            alpha = alpha.resize((right - x, bottom - y), Image.Resampling.NEAREST)
            ink = Image.new('RGB', alpha.size, 'black')
            ink.paste(Image.new('RGB', alpha.size, 'white'), (0, 0), alpha)
            canvas.paste(ink, (x, y))
        canvas.save(ROOT / batch['input'])
        prompt = ROOT / batch['prompt']
        text = prompt.read_text()
        instruction = 'White-on-black slots represent the original monochrome transparent UI strokes. Restore their precise original silhouettes and lettering in white on pure black. Keep every stroke, position and margin unchanged; original ink colors are applied locally.'
        if instruction not in text:
            prompt.write_text(text.rstrip() + '\n' + instruction + '\n')
        changed += 1
    print(f'Prepared {len(monochrome)} monochrome UI sources in {changed} pending sheets', flush=True)


if __name__ == '__main__':
    main()
