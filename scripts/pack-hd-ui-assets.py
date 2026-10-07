"""Pack pending UI image-edit requests while preserving saved deliveries.

Only UI plan entries are replaced. Input sheets use nearest-neighbor previews;
final restoration remains the responsibility of the image API and extractor.
"""
import argparse
from collections import Counter, defaultdict
import json
import math
from pathlib import Path

from PIL import Image


LAYOUTS = {'tiny': (32, 8, 128), 'small': (64, 4, 256),
           'medium': (256, 2, 512)}


def category(entry):
    extent = max(entry['size'])
    for name, (limit, _, _) in LAYOUTS.items():
        if extent <= limit:
            return name
    return 'large'


def prompt(columns, rows, occupied):
    return f'''Use case: precise-object-edit.
Restore this exact game UI sprite sheet at high resolution, ideally 4096 pixels on its longest edge. The sheet contains EXACTLY {columns} columns by {rows} rows and {occupied} occupied independent slots. Preserve the black separators, empty slots, and all original empty margins exactly.
Each slot is a separate original UI asset. Restore every slot independently in its original style, palette, aspect ratio and normalized position. Never combine neighboring slots, borrow their content, add slots, rearrange the grid, or draw a new interface layout.
Preserve EVERY original Chinese character, Latin letter, digit, punctuation mark and symbol stroke by stroke. Do not substitute characters, change wording, simplify or invent strokes, replace a font, or reflow lettering. Keep all original spacing, blank areas, glyph shapes, button states, border contours, gradients and cursor shapes. Restore crisp readable original lettering and carefully refined painted UI details. Do not add labels, watermark, decorative borders, objects or new lettering. Return only the restored sprite sheet.'''


def create_batch(root, batch_id, entries, kind, write):
    _, maximum_columns, inner = LAYOUTS[kind]
    columns = min(maximum_columns, math.ceil(math.sqrt(len(entries))))
    rows = columns
    # Square sheets preserve the API composition without stretching partial rows.
    pitch = inner + 16
    size = (columns * pitch, rows * pitch)
    canvas = Image.new('RGB', size, 'black') if write else None
    cells = []
    for index, entry in enumerate(entries):
        width, height = entry['size']
        scale = inner / max(width, height)
        width, height = max(1, round(width * scale)), max(1, round(height * scale))
        x = index % columns * pitch + 8 + (inner - width) // 2
        y = index // columns * pitch + 8 + (inner - height) // 2
        cells.append({'source': entry['canonical'], 'box': [x, y, x + width, y + height]})
        if write:
            with Image.open(root / entry['original']) as original:
                # Dropping alpha retains original RGB under transparent pixels;
                # compositing onto black would discard that original content.
                preview = original.convert('RGB').resize((width, height), Image.Resampling.NEAREST)
                canvas.paste(preview, (x, y))
    folder = Path('art/hd-assets/batches') / batch_id
    if write:
        (root / folder).mkdir(parents=True, exist_ok=True)
        canvas.save(root / folder / 'input.png')
        (root / folder / 'prompt.txt').write_text(prompt(columns, rows, len(entries)) + '\n')
    return {'id': batch_id, 'group': 'ui', 'input': str(folder / 'input.png'),
            'inputSize': list(size), 'cells': cells, 'prompt': str(folder / 'prompt.txt'),
            'output': str(folder / 'output-1.png'),
            'ratio': '1:1' if columns == rows else '16:9'}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument('--dry-run', action='store_true', help='Print counts without writing any files')
    args = parser.parse_args()
    root = args.root.resolve()
    inventory = json.loads((root / 'art/hd-assets/inventory.json').read_text())
    plan_path = root / 'art/hd-assets/plan.json'
    plan = json.loads(plan_path.read_text())
    textures = {entry['source']: entry for entry in inventory['textures']}
    unique = {entry['canonical']: entry for entry in inventory['textures'] if 'ui' in entry['groups']}
    retained, covered, original_large = [], set(), {}
    for batch in plan['batches']:
        if batch['group'] != 'ui':
            retained.append(batch)
            continue
        saved = (root / batch['output']).exists()
        delivered = all((root / textures[cell['source']]['png']).exists() for cell in batch['cells'])
        if saved or delivered:
            retained.append(batch)
            covered.update(cell['source'] for cell in batch['cells'])
        elif len(batch['cells']) == 1:
            original_large[batch['cells'][0]['source']] = batch
    families = defaultdict(list)
    for canonical, entry in unique.items():
        if canonical in covered or (root / entry['png']).exists():
            continue
        kind = category(entry)
        if kind == 'large':
            # Preserve existing single-request layout and prompt for large assets.
            batch = original_large.get(canonical)
            if batch is None:
                raise ValueError(f'Large UI asset has no existing single batch: {canonical}')
            retained.append(batch)
        else:
            families[(str(Path(canonical).parent), kind)].append(entry)
    batches, counts = [], Counter()
    occupied_ids = {batch['id'] for batch in retained}
    sequence = 0
    for (family, kind), entries in sorted(families.items()):
        entries.sort(key=lambda entry: entry['canonical'])
        capacity = LAYOUTS[kind][1] ** 2
        for start in range(0, len(entries), capacity):
            sequence += 1
            batch_id = f'ui-packed-{sequence:04d}-{kind}'
            while batch_id in occupied_ids:
                sequence += 1
                batch_id = f'ui-packed-{sequence:04d}-{kind}'
            occupied_ids.add(batch_id)
            batch = create_batch(root, batch_id, entries[start:start + capacity], kind, not args.dry_run)
            batches.append(batch)
            counts[kind] += 1
    summary = {'previous_ui_batches': sum(batch['group'] == 'ui' for batch in plan['batches']),
               'retained_ui_batches': sum(batch['group'] == 'ui' for batch in retained),
               'new_ui_batches': dict(counts),
               'total_ui_batches': sum(batch['group'] == 'ui' for batch in retained) + len(batches),
               'dry_run': args.dry_run}
    if not args.dry_run:
        plan['batches'] = retained + batches
        temporary = plan_path.with_suffix('.packing.tmp')
        temporary.write_text(json.dumps(plan, ensure_ascii=False, indent=2) + '\n')
        temporary.replace(plan_path)
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
