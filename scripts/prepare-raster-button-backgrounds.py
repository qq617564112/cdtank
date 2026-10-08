"""Prepare original button states as unlettered high-resolution PNGs."""
import json
from pathlib import Path
import re
import shutil

from PIL import Image
from source_ui_metrics import manual_catalogue, manual_style

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / 'art/hd-ui-redraw'

def _normalized_reference(value: str) -> str:
    return value.lower().replace('/', '\\')


def _source_asset(ui: dict):
    images = {
        image['asset']: image
        for sheet in ui['imagesets']
        for image in sheet['images']
        if image.get('asset', '').startswith('ui/regions/')
    }
    by_name = {}
    for sheet in ui['imagesets']:
        for image in sheet['images']:
            asset = image.get('asset')
            if not asset:
                continue
            name = _normalized_reference(image['Name'])
            if name not in by_name or 'imagesets_dds/' in sheet['path']:
                by_name[name] = asset
    return images, by_name


def button_state_assets(ui):
    """Return assets referenced by actual Button, RadioButton or Checkbox state properties."""
    _, by_name = _source_asset(ui)
    result = {}
    for layout in ui['layouts']:
        for control in layout['windows']:
            control_type = control.get('type')
            if control_type not in {'WindowsLook/Button', 'WindowsLook/RadioButton', 'WindowsLook/Checkbox'}:
                continue
            for property_name, value in control.get('properties', {}).items():
                if not property_name.endswith('Image'):
                    continue
                match = re.fullmatch(r'set:(\S+) image:(.+)', value)
                if not match:
                    continue
                asset = by_name.get(_normalized_reference(match[2]))
                if not asset:
                    continue
                result.setdefault(asset, []).append({
                    'layout': layout['path'],
                    'control': control['name'],
                    'type': control_type,
                    'property': property_name,
                })
    return result


def build_records(root=ROOT):
    ui = json.loads((root / 'recovery/output/web-assets/ui.json').read_text())
    images, _ = _source_asset(ui)
    states = button_state_assets(ui)
    manual = manual_catalogue()
    records = {}
    for asset, uses in states.items():
        entry = dict(manual['textAssets'].get(asset, {}))
        entry.update(manual['assets'].get(asset, {}))
        if not entry.get('text'):
            continue
        with Image.open(root / 'art/hd-assets/original' / asset) as original:
            text = manual_style(original.convert('RGBA'), entry)
        records[asset] = dict(asset=asset, text=text, states=uses, emptyButton=bool(entry.get('plain')))
    return records, list(states.values())


def background_name(asset):
    return 'raster-' + asset.removesuffix('.png').removeprefix('ui/regions/').replace('/', '-')


def build_button_assets(root=ROOT, write_backgrounds=True, prepare_jobs=True):
    import importlib.util
    spec = importlib.util.spec_from_file_location('quality_ui', root / 'scripts/prepare-quality-ui-redraw.py')
    quality = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(quality)
    records, state_assets = build_records(root)
    runtime = root / 'recovery/output/web-assets/hd-ui/buttons'
    runtime.mkdir(parents=True, exist_ok=True)
    accepted = {}
    review_path = root / 'art/hd-ui-redraw/raster-button-visual-review.json'
    rejected = {row['source'] for row in json.loads(review_path.read_text())['issues']} if review_path.is_file() else set()
    for name in ['installed-blank-button-jobs.json', 'installed-blank-settings-illustration-jobs.json',
                 'installed-quality-button-background-jobs.json']:
        path = root / 'art/hd-ui-redraw' / name
        if path.exists():
            for row in json.loads(path.read_text()):
                if row.get('installed') and row['source'] not in rejected:
                    accepted[row['source']] = root / row['candidate']
    assets, pending = {}, []
    for asset, record in records.items():
        name = background_name(asset)
        target = runtime / (name + '.png')
        known = accepted.get(asset)
        if write_backgrounds and not target.exists() and known and known.is_file():
            shutil.copyfile(known, target)
        assets[asset] = dict(background='/hd-ui/buttons/' + name + '.png', family='raster',
                             filter='none', text=record['text'])
        if not target.exists():
            pending.append(asset)
    priority = ['login.xml', 'lobby_select.xml', 'default.xml', 'roomlist.xml']
    def order(asset):
        layouts = {Path(use['layout']).name for use in records[asset]['states']}
        return min([priority.index(name) for name in layouts if name in priority] or [len(priority)]), asset
    pending.sort(key=order)
    jobs_path = root / 'art/hd-ui-redraw/raster-button-jobs.json'
    jobs = json.loads(jobs_path.read_text()) if jobs_path.is_file() else []
    covered = {source for job in jobs for source in job['sources']}
    queued = [asset for asset in pending if asset not in covered] if prepare_jobs else []
    # Entire original buttons occupy separate frames; states retain their own shape and palette.
    for index in range(0, len(queued), 4):
        group = queued[index:index + 4]
        refs = [dict(sources=[asset], buttonBackground=background_name(asset),
                     description='原始完整按钮交互状态。移除全部原文字和文字描边阴影，原非文字插画、外轮廓、浅色高光、厚度、阴影、颜色和透明留白全部保留；不增加封边或装饰')
                for asset in group]
        job = quality.prepare('raster-buttons-' + str(len(jobs)).zfill(3), '完整原按钮的无字高清底图', refs)
        for cell in job['cells']:
            if records[cell['source']]['emptyButton']:
                cell['emptyButton'] = True
        jobs.append(job)
    if prepare_jobs:
        jobs_path.write_text(json.dumps(jobs, ensure_ascii=False, indent=2) + '\n')
    unresolved = [dict(asset=asset, background=assets[asset]['background']) for asset in pending]
    report = dict(assets=assets, buttons=len(assets), stateAssets=sum(len(value) for value in state_assets),
                  jobs=jobs, unresolved=unresolved)
    (root / 'art/hd-ui-redraw/raster-button-background-map.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    return assets, report


def main():
    assets, report = build_button_assets()
    print(f'{len(assets)} original button states; {len(report["jobs"])} image edit requests; {len(report["unresolved"])} pending PNGs')


if __name__ == '__main__':
    main()
