"""Prepare raster button artwork and live font labels."""
import importlib.util
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'apps/web/src/assets'
RASTER_SCRIPT = Path(__file__).with_name('prepare-raster-button-backgrounds.py')
SPEC = importlib.util.spec_from_file_location('prepare_raster_button_backgrounds', RASTER_SCRIPT)
RASTER = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(RASTER)


def main():
    assets, report = RASTER.build_button_assets(ROOT, prepare_jobs=False)
    for entry in assets.values():
        if not (ROOT / 'recovery/output/web-assets' / entry['background'].lstrip('/')).is_file():
            entry['background'] = None
    (OUTPUT / 'button-artwork.json').write_text(
        json.dumps({'assets': assets}, ensure_ascii=False, indent=2) + '\n')
    rules = []
    for asset, entry in assets.items():
        selector = f'[data-source-asset="{asset}"]:not(.source-static-image):not(.source-state-button)'
        background = entry['background']
        if not background:
            continue
        if background:
            name = Path(background).stem
            style = {
                'background-image': f"var(--source-button-{name}, url('{background}')) !important",
                'background-position': '0 0 !important',
                'background-size': '100% 100% !important',
                'background-repeat': 'no-repeat !important',
            }
            rules.append(selector + ' {\n' + '\n'.join(
                f'  {key}: {value};' for key, value in style.items()) + '\n}')
        text = entry['text']
        rules.append(selector + ' {\n  container-type: size;\n  overflow: hidden;\n}')
        face = {'brush': 'CDTank-Xiangjiao', 'sans': 'CDTank-SourceSans', 'latin': 'CDTank-SourceLatin',
                'digits': 'CDTank-SourceDigits', 'serif': 'CDTank-SourceSerif'}[text['face']]
        after = {
            'content': json.dumps(text['text'], ensure_ascii=False),
            'position': 'absolute',
            'left': f"{text['x'] / text['width'] * 100:.6f}%",
            'top': f"{text['y'] / text['height'] * 100:.6f}%",
            'width': 'max-content',
            'white-space': 'pre',
            'transform-origin': 'left top',
            'transform': f"scaleX({text['scaleX']})",
            'font-family': f"'{face}', sans-serif !important",
            'font-size': f"{text['size'] / text['width'] * 100:.6f}cqw",
            'line-height': f"{text['lineHeight'] / text['width'] * 100:.6f}cqw",
            'font-style': 'normal',
            'font-weight': '700',
            'letter-spacing': '0',
            'text-transform': 'none',
            'color': text['colour'],
            '-webkit-text-stroke': f"{text['stroke'] / text['width'] * 100:.6f}cqw {text['outline']}",
            'paint-order': 'stroke fill',
            'pointer-events': 'none',
        }
        if text.get('shadow'):
            after['text-shadow'] = (
                f"{text['shadowX'] / text['width'] * 100:.6f}cqw "
                f"{text['shadowY'] / text['width'] * 100:.6f}cqw 0 {text['shadow']}")
        rules.append(selector + ':not([data-source-button-label="external"]):not(:has(> .source-text-artwork))::after {\n'
                     + '\n'.join(f'  {key}: {value};' for key, value in after.items()) + '\n}')
    (OUTPUT / 'button-artwork.css').write_text('\n\n'.join(rules) + '\n')
    (ROOT / 'art/hd-ui-redraw/button-text-classification.json').write_text(json.dumps({
        'sources': len(assets),
        'backgrounds': sorted({entry['background'] for entry in assets.values() if entry['background']}),
        'jobs': [job['id'] for job in report['jobs']],
        'unresolved': report['unresolved'],
        'rendering': 'unlettered raster backgrounds and live HTML fonts',
    }, ensure_ascii=False, indent=2) + '\n')
    print(f'{len(assets)} raster button labels; {len(report["jobs"])} full-button image requests')


if __name__ == '__main__':
    main()
