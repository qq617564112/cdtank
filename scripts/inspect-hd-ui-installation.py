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
    buttons = document(ROOT / 'apps/web/src/assets/button-artwork.json')['assets']
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
    quality_jobs = ART / 'quality-ui-jobs.json'
    quality_sources = {source for job in document(quality_jobs) for source in job['sources']} \
        if quality_jobs.is_file() else set()
    quality_installation = ART / 'installed-quality-ui-jobs.json'
    quality_records = {record['source']: record for record in document(quality_installation) if record['installed']} \
        if quality_installation.is_file() else {}
    records.update(quality_records)
    latest_raster = {}
    for name in ('installed-raster-ui-solid-sources.json', 'installed-raster-ui-jobs.json'):
        path = ART / name
        if path.is_file():
            latest_raster.update((record['source'], record) for record in document(path) if record['installed'])
    records.update(latest_raster)
    backgrounds = {}
    for name in ('installed-blank-button-jobs.json', 'installed-blank-settings-illustration-jobs.json',
                 'installed-quality-button-background-jobs.json', 'installed-raster-button-jobs.json'):
        path = ART / name
        if path.is_file():
            backgrounds.update((record['source'], record) for record in document(path) if record['installed'])
    coverage_path = ART / 'raster-ui-coverage.json'
    coverage = document(coverage_path)['sources'] if coverage_path.is_file() else []
    awaiting = {row['source'] for row in coverage if row['status'] in ('queued', 'alias')
                and row['source'] not in latest_raster}
    groups = defaultdict(list)
    outcomes, issues = [], []
    sources = dict.fromkeys(issue['source'] for issue in document(ART / 'issues.json'))
    sources.update(dict.fromkeys(sorted(quality_sources | set(buttons))))
    sources.update(dict.fromkeys(row['source'] for row in coverage if row['status'] != 'excluded'))
    for source in sources:
        if source.startswith('ui/regions/71/'):
            outcome = {'source': source, 'rendering': 'removed', 'feature': 'screen keyboard'}
        elif source in buttons:
            button = buttons[source]
            if not button['background']:
                outcomes.append({'source': source, 'rendering': 'awaiting-unlettered-button'})
                issues.append({'source': source, 'issue': 'Accepted unlettered button PNG is not installed'})
                continue
            outcome = {'source': source, 'rendering': 'unlettered-image-font-button',
                       'background': button['background'], 'text': button['text']['text']}
            target = RUNTIME / button['background'].lstrip('/')
            record = backgrounds.get(source)
            if not target.is_file():
                issues.append({'source': source, 'issue': 'Missing unlettered runtime button PNG'})
            elif record is None:
                issues.append({'source': source, 'issue': 'No accepted unlettered button candidate'})
            else:
                with Image.open(target) as installed, Image.open(ROOT / record['candidate']) as candidate:
                    if installed.size != candidate.size or installed.convert('RGBA').tobytes() != candidate.convert('RGBA').tobytes():
                        issues.append({'source': source, 'issue': 'Runtime background differs from accepted candidate'})
        elif source in awaiting:
            outcome = {'source': source, 'rendering': 'awaiting-raster-redraw'}
            issues.append({'source': source, 'issue': 'Raster redraw is not installed'})
        elif source in quality_sources and source not in quality_records:
            outcome = {'source': source, 'rendering': 'awaiting-raster-redraw'}
            issues.append({'source': source, 'issue': 'No visually accepted raster redraw is installed'})
        elif source in records:
            record = records[source]
            outcome = {'source': source, 'rendering': 'image', 'candidate': record['candidate']}
            cell = directory.get('/' + source)
            if cell is None:
                issues.append({'source': source, 'issue': 'Missing runtime sprite mapping'})
            else:
                groups[cell['atlas']].append((record, cell))
        else:
            outcome = {'source': source, 'rendering': 'unresolved'}
            issues.append({'source': source, 'issue': 'No installed raster artwork'})
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
    report = {'problemSources': len(outcomes), 'outcomes': dict(Counter(row['rendering'] for row in outcomes)),
              'emotes': len(emotes), 'imageCells': inspected, 'runtimeSheets': len(groups),
              'buttonSources': len(buttons), 'pendingRasterSources': len(awaiting),
              'unletteredButtonBackgrounds': len(buttons), 'issues': issues}
    (ART / 'installed-current-emotes.json').write_text(json.dumps(emotes, ensure_ascii=False, indent=2) + '\n')
    (ART / 'resolved-ui-sources.json').write_text(json.dumps(outcomes, ensure_ascii=False, indent=2) + '\n')
    (ART / 'final-installation-check.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps(report, ensure_ascii=False))


if __name__ == '__main__':
    main()
