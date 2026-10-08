"""Compare installed UI image cells and shared backgrounds with their deliveries."""
from collections import Counter, defaultdict
import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / 'art/hd-ui-redraw'
RUNTIME = ROOT / 'recovery/output/web-assets'


def document(path):
    return json.loads(path.read_text())


def main():
    simple = document(ROOT / 'apps/web/src/assets/simple-ui-artwork.json')['assets']
    buttons = document(ROOT / 'apps/web/src/assets/button-artwork.json')['assets']
    lettering = document(ROOT / 'apps/web/src/interface/resources/source-text-artwork.json')['assets']
    inventory = {entry['source']: entry for entry in document(ROOT / 'art/hd-assets/inventory.json')['textures']}
    directory = document(RUNTIME / 'sprite-images.json')['images']
    records = {record['source']: record for record in document(ART / 'installed-framed-ui-jobs.json')}
    emotes = []
    for source in document(ART / 'accepted-current-emotes.json'):
        candidate = ART / 'sunburst-smooth-candidates' / source
        with Image.open(candidate) as image:
            emotes.append({'source': source, 'size': list(image.size),
                           'candidate': candidate.relative_to(ROOT).as_posix(), 'installed': True})
    for name in ('installed-sunburst-pilot-jobs.json', 'installed-framed-smooth-jobs.json'):
        emotes.extend(record for record in document(ART / name) if record['installed'])
    records.update((record['source'], record) for record in emotes)
    groups = defaultdict(list)
    outcomes, issues = [], []
    for issue in document(ART / 'issues.json'):
        source = issue['source']
        if source.startswith('ui/regions/71/'):
            outcome = {'source': source, 'rendering': 'removed', 'feature': 'screen keyboard'}
        elif source in simple:
            outcome = {'source': source, 'rendering': 'html-css', 'recipe': simple[source]}
        elif source in buttons:
            outcome = {'source': source, 'rendering': 'html-button',
                       'background': buttons[source]['background'], 'text': buttons[source]['text']['text']}
        elif source in lettering:
            outcome = {'source': source, 'rendering': 'html-font', 'text': lettering[source]['text']}
        elif source in records:
            record = records[source]
            outcome = {'source': source, 'rendering': 'image', 'candidate': record['candidate']}
            cell = directory['/' + source]
            groups[cell['atlas']].append((record, cell))
        else:
            outcome = {'source': source, 'rendering': 'unresolved'}
            issues.append({'source': source, 'issue': 'No installed image or HTML artwork'})
        outcomes.append(outcome)
    inspected = 0
    for atlas, members in groups.items():
        with Image.open(RUNTIME / atlas.lstrip('/')) as sheet:
            sheet = sheet.convert('RGBA')
            for record, cell in members:
                source = record['source']
                x, y, width, height = (cell[key] for key in ('x', 'y', 'width', 'height'))
                crop = sheet.crop((x, y, x + width, y + height))
                with Image.open(ROOT / record['candidate']) as candidate, Image.open(ROOT / inventory[source]['png']) as delivery:
                    for label, image in (('candidate', candidate), ('delivery', delivery)):
                        image = image.convert('RGBA')
                        if image.size != crop.size or image.tobytes() != crop.tobytes():
                            issues.append({'source': source, 'issue': f'Runtime cell differs from {label}'})
                for backup in (ROOT / inventory[source]['original'], ART / 'previous' / inventory[source]['png']):
                    if not backup.is_file():
                        issues.append({'source': source, 'issue': f'Missing backup {backup.relative_to(ROOT)}'})
                inspected += 1
        backup = ART / 'previous' / (RUNTIME / atlas.lstrip('/')).relative_to(ROOT)
        if not backup.is_file():
            issues.append({'atlas': atlas, 'issue': 'Missing previous sprite sheet'})
    backgrounds = document(ART / 'installed-blank-button-jobs.json')
    for record in backgrounds:
        target = RUNTIME / record['background']
        with Image.open(target) as installed, Image.open(ROOT / record['candidate']) as candidate:
            if installed.size != candidate.size or installed.convert('RGBA').tobytes() != candidate.convert('RGBA').tobytes():
                issues.append({'background': record['background'], 'issue': 'Runtime background differs from candidate'})
    report = {'problemSources': len(outcomes), 'outcomes': dict(Counter(row['rendering'] for row in outcomes)),
              'emotes': len(emotes), 'imageCells': inspected, 'runtimeSheets': len(groups),
              'simpleUiSources': len(simple), 'buttonSources': len(buttons),
              'fontSources': len(lettering),
              'sharedButtonBackgrounds': len(backgrounds), 'issues': issues}
    (ART / 'installed-current-emotes.json').write_text(json.dumps(emotes, ensure_ascii=False, indent=2) + '\n')
    (ART / 'resolved-ui-sources.json').write_text(json.dumps(outcomes, ensure_ascii=False, indent=2) + '\n')
    (ART / 'final-installation-check.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps(report, ensure_ascii=False))


if __name__ == '__main__':
    main()
