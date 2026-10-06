"""Publish original0022 two-model destruction resources consumed by ScenePreview."""
import json
from pathlib import Path
from tempfile import TemporaryDirectory
import shutil
from export_effect_models import export_models

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / 'recovery/output/web-assets'
REFERENCES = ['Data/scnobj/obj05424/c9.CVD', 'Data/scnobj/obj05469/c9.CVD']

def export():
    with TemporaryDirectory(prefix='cdtank-breach22-') as temporary:
        directory = Path(temporary)
        library = export_models([dict(reference=reference) for reference in REFERENCES],
                                ROOT / 'recovery/output/verified/assets/data', directory)
        for path in directory.rglob('*.png'):
            output = WEB / path.relative_to(directory)
            output.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(path, output)
        (WEB / 'scene-breach-0022.json').write_text(json.dumps(library, ensure_ascii=False) + '\n')
    print('Published0022 Breach c9:', [(r['reference'], len(r['nodes'])) for r in library['resources']])

if __name__ == '__main__':
    export()
