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
    if entry['size'][0] > 256 and entry['size'][1] <= 64:
        return 'strip'
    for name, (limit, _, _) in LAYOUTS.items():
        if extent <= limit:
            return name
    return 'large'


def prompt(columns, rows, occupied):
    return f'''Use case: precise-object-edit.
Restore this exact game UI sprite sheet at high resolution, ideally 4096 pixels on its longest edge. The sheet contains EXACTLY {columns} columns by {rows} rows and {occupied} occupied independent slots. Preserve the black separators, empty slots, and all original empty margins exactly.
Each slot is a separate original UI asset. Restore every slot independently in its original style, palette, aspect ratio and normalized position. Never combine neighboring slots, borrow their content, add slots, rearrange the grid, or draw a new interface layout.
Preserve EVERY original Chinese character, Latin letter, digit, punctuation mark and symbol stroke by stroke. Do not substitute characters, change wording, simplify or invent strokes, replace a font, or reflow lettering. Keep all original spacing, blank areas, glyph shapes, button states, border contours, gradients and cursor shapes. Restore crisp readable original lettering and carefully refined painted UI details. Do not add labels, watermark, decorative borders, objects or new lettering. Return only the restored sprite sheet.
这些是低分辨率复古游戏 UI 素材。请在保持原美术和字体风格的情况下重绘为清晰的高清素材。低分辨率像素台阶、模糊和压缩噪点是采样痕迹，请恢复它们表达的连续轮廓；文字的斜线连贯，曲线自然，笔画完整，粗细稳定，保留字形、衬线、比例和原来的颜色。图标与控件保持相同的轮廓、图案、状态和配色，描边清楚，渐变平滑。不要复制大像素块，不要产生毛边、断笔、随机孔洞、额外纹理、光晕或浮雕。保持每个格子的位置、比例和留白。'''


def font_prompt(columns, rows, occupied):
    return f'''这是一张低分辨率复古游戏字体的参考拼图，{columns}列×{rows}行，{occupied}个独立字形。请在保持原字体风格的情况下重绘为真正清晰的高清文字。
保留每个字符的身份、原字形、笔画粗细、窄长或方正比例、衬线、开口、字内空间、汉字结构和复古风格。不换字体，不改字，不补字，不省略笔画。
本次重点是重新构建采样前的连续字形，不是原图放大。参考的大方块与阶梯是低分辨率栅格采样结果，不能作为高清轮廓保留下来。把阶梯斜笔画画成稳定粗细的连续斜线，把分块转弯连成完整自然的曲线。允许消除像素台阶、恢复弧线与平滑转角；不能直接复制大像素块，不能输出像素字，不能模糊处理。
直线必须笔直，曲线顺滑，所有笔画完整清楚，转角干净，粗细稳定。禁止毛边、模糊、断笔、随机孔洞、颗粒、纹理、阴影和浮雕。纯白实心字、纯黑背景，无其他颜色。
每格只保留原来一个字形；保留原格位置、字符外框的宽高与空白，不重排网格，不增加标签。只返回完整高清拼图。字形和风格相同，分辨率与绘制精度提升。'''


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
                if entry.get('inkReference'):
                    preview = Image.new('RGB', original.size, 'black')
                    preview.paste(Image.new('RGB', original.size, tuple(entry['inkReference'])),
                                  (0, 0), original.getchannel('A'))
                else:
                    preview = original.convert('RGB')
                preview = preview.resize((width, height), Image.Resampling.NEAREST)
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


def font_entries(root, textures):
    faces = {}
    for filename in ('ui-font-raster.json', 'five-page-font-raster.json'):
        metadata = json.loads((root / 'recovery/output/web-assets' / filename).read_text())
        for face in metadata['faces']:
            entry = textures[face['atlas']['asset']]
            faces.setdefault(entry['canonical'], (entry, face['glyphs']))
    result = {}
    for canonical, (entry, glyphs) in faces.items():
        tiles = []
        with Image.open(root / entry['original']) as original:
            alpha = original.convert('RGBA').getchannel('A')
            for glyph in glyphs:
                width, height = glyph['width'], glyph['height']
                if not width or not height:
                    continue
                x, y = glyph['x'], glyph['y']
                box = [x, y, x + width, y + height]
                if alpha.crop(box).getbbox() is not None:
                    tiles.append({**entry, 'size': [width, height], 'sourceBox': box,
                                  'character': glyph['character']})
        result[canonical] = tiles
    return result


def strip_chunks(entries):
    selection = []
    y = 8
    for entry in entries:
        height = max(1, round(entry['size'][1] * 512 / entry['size'][0]))
        if selection and y + height + 8 > 528:
            yield selection
            selection = []
            y = 8
        selection.append(entry)
        y += height + 16
    if selection:
        yield selection


def create_strip_batch(root, batch_id, entries, write):
    canvas = Image.new('RGB', (528, 528), 'black') if write else None
    cells = []
    y = 8
    for entry in entries:
        height = max(1, round(entry['size'][1] * 512 / entry['size'][0]))
        cells.append({'source': entry['canonical'], 'box': [8, y, 520, y + height]})
        if write:
            with Image.open(root / entry['original']) as original:
                if entry.get('solidColor'):
                    preview = Image.new('RGB', original.size, 'black')
                    ink = Image.new('RGB', original.size, tuple(entry['inkReference'])) if entry.get('inkReference') else original.convert('RGB')
                    preview.paste(ink, (0, 0), original.getchannel('A'))
                else:
                    preview = original.convert('RGB')
                canvas.paste(preview.resize((512, height), Image.Resampling.NEAREST), (8, y))
        y += height + 16
    folder = Path('art/hd-assets/batches') / batch_id
    if write:
        (root / folder).mkdir(parents=True, exist_ok=True)
        canvas.save(root / folder / 'input.png')
        text = prompt(1, len(entries), len(entries))
        text += '\nThe occupied slots form ONE column of independent horizontal strips with DIFFERENT heights. Keep every strip at its exact input coordinates, width, height and aspect ratio. Preserve the 16-pixel black gaps and all black space below the final strip. Do not resize rows to equal heights, combine strips, reflow text, add rows or turn this reference into an assembled interface.'
        (root / folder / 'prompt.txt').write_text(text + '\n')
    return {'id': batch_id, 'group': 'ui', 'input': str(folder / 'input.png'),
            'inputSize': [528, 528], 'cells': cells, 'prompt': str(folder / 'prompt.txt'),
            'output': str(folder / 'output-1.png'), 'ratio': '1:1'}


def create_font_batch(root, batch_id, entries, write):
    batch = create_batch(root, batch_id, entries, 'tiny', False)
    canvas = Image.new('RGB', tuple(batch['inputSize']), 'black') if write else None
    for index, (cell, entry) in enumerate(zip(batch['cells'], entries)):
        cell['sourceBox'] = entry['sourceBox']
        cell['character'] = entry['character']
        columns = batch['inputSize'][0] // 144
        x, y = index % columns * 144, index // columns * 144
        cell['slotBox'] = [x, y, x + 144, y + 144]
        if write:
            with Image.open(root / entry['original']) as original:
                alpha = original.convert('RGBA').getchannel('A').crop(entry['sourceBox'])
                x, y, right, bottom = cell['box']
                alpha = alpha.resize((right - x, bottom - y), Image.Resampling.NEAREST)
                canvas.paste(Image.new('RGB', alpha.size, 'white'), (x, y), alpha)
    if write:
        folder = (root / batch['input']).parent
        folder.mkdir(parents=True, exist_ok=True)
        canvas.save(root / batch['input'])
        columns = batch['inputSize'][0] // 144
        text = font_prompt(columns, columns, len(entries))
        text += '\n字符身份按下列每行的 JSON 列表确定，列表和引号不画入图片：\n'
        text += '\n'.join(json.dumps([entry['character'] for entry in entries[start:start + columns]],
                                     ensure_ascii=False)
                          for start in range(0, len(entries), columns))
        (root / batch['prompt']).write_text(text + '\n')
    return batch


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
    unique = {entry['canonical']: entry for entry in inventory['textures']
              if 'ui' in entry['groups'] and not entry.get('derived')}
    fonts = font_entries(root, textures)
    # Keep every batch of a font together once any output or tile is saved.
    retained_fonts = set()
    for batch in plan['batches']:
        if batch['group'] == 'ui' and any('sourceBox' in cell for cell in batch['cells']):
            tiles = root / 'art/hd-assets/tiles' / batch['id']
            if (root / batch['output']).exists() or any(
                    (tiles / f'{index:03}.png').exists() for index in range(len(batch['cells']))):
                retained_fonts.update(cell['source'] for cell in batch['cells'])
    retained, covered, original_large = [], set(), {}
    for batch in plan['batches']:
        if batch['group'] != 'ui':
            retained.append(batch)
            continue
        saved = (root / batch['output']).exists()
        delivered = all((root / textures[cell['source']]['png']).exists() for cell in batch['cells'])
        if (saved or delivered or any(cell['source'] in retained_fonts
                                     or textures[cell['source']].get('intermediate')
                                     for cell in batch['cells'])):
            retained.append(batch)
            covered.update(cell['source'] for cell in batch['cells'])
        elif len(batch['cells']) == 1:
            original_large[batch['cells'][0]['source']] = batch
    families = defaultdict(list)
    for canonical, entry in unique.items():
        if canonical in covered or (root / entry['png']).exists():
            continue
        kind = category(entry)
        if canonical in fonts:
            continue
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
    font_sequence = 0
    for canonical, entries in sorted(fonts.items()):
        if canonical in covered or (root / unique[canonical]['png']).exists():
            continue
        for start in range(0, len(entries), 64):
            font_sequence += 1
            batch_id = f'ui-font-{font_sequence:04d}'
            while batch_id in occupied_ids:
                font_sequence += 1
                batch_id = f'ui-font-{font_sequence:04d}'
            occupied_ids.add(batch_id)
            batches.append(create_font_batch(root, batch_id, entries[start:start + 64], not args.dry_run))
            counts['font'] += 1
    for (family, kind), entries in sorted(families.items()):
        entries.sort(key=lambda entry: entry['canonical'])
        if kind == 'strip':
            selections = strip_chunks(entries)
        else:
            capacity = LAYOUTS[kind][1] ** 2
            selections = (entries[start:start + capacity] for start in range(0, len(entries), capacity))
        for selection in selections:
            sequence += 1
            batch_id = f'ui-packed-{sequence:04d}-{kind}'
            while batch_id in occupied_ids:
                sequence += 1
                batch_id = f'ui-packed-{sequence:04d}-{kind}'
            occupied_ids.add(batch_id)
            batch = (create_strip_batch(root, batch_id, selection, not args.dry_run) if kind == 'strip'
                     else create_batch(root, batch_id, selection, kind, not args.dry_run))
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
