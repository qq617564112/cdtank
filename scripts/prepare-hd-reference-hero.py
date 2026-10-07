"""Add the local reference character's three color projections to the art queue."""

import json
from pathlib import Path
import shutil

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / 'art/hd-assets'
SOURCE = 'local-art/reference-hero/reference-colors.png'
INSTALL = 'apps/web/src/models/reference-hero/reference-colors.png'


def write_json(path, value):
    temporary = path.with_suffix('.tmp')
    temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')
    temporary.replace(path)


def main():
    inventory_path = ART / 'inventory.json'
    inventory = json.loads(inventory_path.read_text())
    original = ART / 'original' / SOURCE
    if not original.exists():
        original.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(ROOT / INSTALL, original)
    image = Image.open(original).convert('RGB')
    width, height = image.size
    panel_width = width // 3
    entry = {'source': SOURCE, 'canonical': SOURCE,
             'original': str(original.relative_to(ROOT)),
             'png': str((ART / 'png' / SOURCE).relative_to(ROOT)),
             'size': [width, height], 'groups': ['art'],
             'installPath': INSTALL, 'derived': 'texture-panels'}
    inventory['textures'] = [item for item in inventory['textures'] if item['source'] != SOURCE] + [entry]
    write_json(inventory_path, inventory)
    plan_path = ART / 'plan.json'
    plan = json.loads(plan_path.read_text())
    existing = {batch['id'] for batch in plan['batches']}
    for index, name in enumerate(('front', 'back', 'side')):
        batch_id = f'art-reference-hero-{name}'
        if batch_id in existing:
            continue
        source_box = [index * panel_width, 0, (index + 1) * panel_width, height]
        panel = image.crop(source_box)
        canvas = Image.new('RGB', (panel_width + 16, height + 16), 'black')
        canvas.paste(panel, (8, 8))
        folder = ART / 'batches' / batch_id
        folder.mkdir(parents=True, exist_ok=True)
        canvas.save(folder / 'input.png')
        prompt = f'''Use case: precise-object-edit.
Restore this exact {name} projection color map for ONE original silver, red, cyan and gold character. This is a flat model color projection, not a finished scene or a new character design. Preserve every normalized coordinate, original silhouette, pose, visible stripe, jewel, facial feature, exact palette and edge-extended background. Sharpen the original painted details without moving or resizing any part. Do not remove or replace the directional stretched colors outside the silhouette: the renderer uses those original edge extensions. Keep the 8-pixel black border and exact square composition. Do not assemble a three-view sheet, add another character, change the pose or perspective, add text, labels or a watermark. Return only the same precise color projection at high resolution, ideally 4096 pixels on its longest edge.'''
        (folder / 'prompt.txt').write_text(prompt + '\n')
        plan['batches'].append({
            'id': batch_id, 'group': 'art',
            'input': str((folder / 'input.png').relative_to(ROOT)),
            'inputSize': list(canvas.size),
            'cells': [{'source': SOURCE, 'box': [8, 8, panel_width + 8, height + 8],
                       'sourceBox': source_box, 'kind': 'texture'}],
            'prompt': str((folder / 'prompt.txt').relative_to(ROOT)),
            'output': str((folder / 'output-1.png').relative_to(ROOT)), 'ratio': '1:1',
        })
    write_json(plan_path, plan)
    print('Prepared 3 single-character reference color projections', flush=True)


if __name__ == '__main__':
    main()
