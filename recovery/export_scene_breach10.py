"""Publish original map0010 Breach destruction models."""
import json
from pathlib import Path
from tempfile import TemporaryDirectory
import shutil

from export_effect_models import export_models

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / 'recovery/output/web-assets'
REFERENCES = [f'Data/scnobj/obj{model}/c9.CVD'
              for model in ['05425', '05426', '05427', '05428', '05429']]


def export():
    with TemporaryDirectory(prefix='cdtank-breach10-') as temporary:
        directory = Path(temporary)
        library = export_models([dict(reference=reference) for reference in REFERENCES],
                                ROOT / 'recovery/output/verified/assets/data', directory)
        for resource in library['resources']:
            if resource['resolution'] != 'published':
                raise ValueError(f"Missing original map0010 Breach: {resource['reference']}")
        for path in directory.rglob('*.png'):
            output = WEB / path.relative_to(directory)
            output.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(path, output)
        (WEB / 'scene-breach-0010.json').write_text(
            json.dumps(library, ensure_ascii=False) + '\n')
    return library


if __name__ == '__main__':
    result = export()
    print('Published0010 original Breach c9:',
          [(resource['reference'], len(resource['nodes'])) for resource in result['resources']])
