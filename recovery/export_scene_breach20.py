"""Publish the source0020 obj05460/obj05461/obj05462/obj05442/obj05434/obj05435/obj05436 destruction CVDs consumed by ScenePreview."""
import json
from pathlib import Path
from tempfile import TemporaryDirectory
import shutil
from export_effect_models import export_models
ROOT=Path(__file__).resolve().parents[1]
WEB=ROOT/'recovery/output/web-assets'
REFERENCES=['Data/scnobj/obj05460/c9.CVD','Data/scnobj/obj05461/c9.CVD','Data/scnobj/obj05462/c9.CVD','Data/scnobj/obj05442/c9.CVD','Data/scnobj/obj05434/c9.CVD','Data/scnobj/obj05435/c9.CVD','Data/scnobj/obj05436/c9.CVD']
def export():
    with TemporaryDirectory(prefix='cdtank-breach20-') as temporary:
        directory=Path(temporary)
        library=export_models([dict(reference=reference) for reference in REFERENCES],ROOT/'recovery/output/verified/assets/data',directory)
        for path in directory.rglob('*.png'):
            output=WEB/path.relative_to(directory)
            output.parent.mkdir(parents=True,exist_ok=True)
            shutil.copyfile(path,output)
        (WEB/'scene-breach-0020.json').write_text(json.dumps(library,ensure_ascii=False)+'\n')
    print('Published scene Breach c9:',[(r['reference'],len(r['nodes'])) for r in library['resources']])


if __name__ == '__main__':
    export()
