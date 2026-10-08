"""Inspect published image references, sprite coverage and cleanup backups."""
from collections import Counter
import json
from pathlib import Path

from PIL import Image
from image_asset_usage import IMAGE_EXTENSIONS, image_usage

ROOT = Path(__file__).resolve().parents[1]
RUNTIME = ROOT / 'recovery/output/web-assets'


def main():
    directory = json.loads((RUNTIME / 'sprite-images.json').read_text())
    cleanup = json.loads((ROOT / 'art/hd-assets/image-cleanup.json').read_text())
    archive = ROOT / 'art/hd-assets/unused-images'
    manifest = json.loads((archive / 'manifest.json').read_text())
    physical = {path.relative_to(RUNTIME).as_posix() for path in RUNTIME.rglob('*')
                if path.is_file() and path.suffix.lower() in IMAGE_EXTENSIONS}
    physical.update('local-images/' + path.relative_to(ROOT / 'apps/web/src').as_posix()
                    for path in (ROOT / 'apps/web/src').rglob('*')
                    if path.is_file() and path.suffix.lower() in IMAGE_EXTENSIONS)
    actual = physical | {path.lstrip('/') for path in directory['images']}
    # Include archived names so a reference to a removed image is detected.
    names = actual | set(cleanup['unusedPaths']) | {row['path'] for row in manifest['files']}
    usage = image_usage(ROOT, RUNTIME, names)
    issues = [{'path': name, 'reason': 'Referenced image is absent'}
              for name in usage['images'] if name not in actual]
    sizes = {}
    for sheet in directory['sheets']:
        with Image.open(RUNTIME / sheet['path']) as image:
            sizes['/' + sheet['path']] = image.size
    for path, cell in directory['images'].items():
        width, height = sizes[cell['atlas']]
        if not (0 <= cell['x'] and 0 <= cell['y'] and cell['x'] + cell['width'] <= width
                and cell['y'] + cell['height'] <= height):
            issues.append({'path': path, 'reason': 'Sprite rectangle is outside its sheet'})
    for row in manifest['files']:
        path = archive / row['source']
        if not path.is_file() or path.stat().st_size != row['bytes']:
            issues.append({'path': row['source'], 'reason': 'Archived image is absent or incomplete'})
    for row in manifest['virtualImages']:
        if not (ROOT / row['backup']).is_file():
            issues.append({'path': row['path'], 'reason': 'Archived sprite original is absent'})
    sheets = {'/' + row['path'] for row in directory['sheets']}
    referenced_sheets = {row['atlas'] for row in directory['images'].values()}
    for path in sheets - referenced_sheets:
        issues.append({'path': path, 'reason': 'Sprite sheet is unreferenced'})
    orphaned = sorted(path for path in actual if path not in usage['images'] and '/' + path not in referenced_sheets)
    issues.extend({'path': path, 'reason': 'Published image is unreferenced'} for path in orphaned)
    cells = {(cell['atlas'], cell['x'], cell['y'], cell['width'], cell['height'])
             for cell in directory['images'].values()}
    report = dict(publishedImages=len(physical), publishedPngImages=sum(Path(path).suffix == '.png' for path in physical),
                  referencedImages=len(usage['images']), mappedImages=len(directory['images']),
                  uniqueCells=len(cells), spriteSheets=len(sheets), models=usage['models'],
                  externalModelImages=usage['modelReferences'], catalogs=len(usage['catalogs']), modules=len(usage['modules']),
                  archivedPhysicalImages=len(manifest['files']), archivedVirtualImages=len(manifest['virtualImages']),
                  pixelComparisons=cleanup['pixelComparisons'], pixelDifferences=cleanup['pixelDifferences'],
                  sharedCells=sum(count > 1 for count in Counter(
                      (cell['atlas'], cell['x'], cell['y'], cell['width'], cell['height'])
                      for cell in directory['images'].values()).values()),
                  issues=issues, missingModelImages=usage['missingModelImages'])
    path = ROOT / 'art/hd-assets/image-cleanup-inspection.json'
    path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
