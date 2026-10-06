"""Publish all original map0007 Breach destruction CVDs."""
import json
from pathlib import Path
from tempfile import TemporaryDirectory
import shutil
from export_effect_models import export_models
ROOT=Path(__file__).resolve().parents[1]
WEB=ROOT/'recovery/output/web-assets'
REFERENCES=['Data/scnobj/obj05466/c9.CVD','Data/scnobj/obj05467/c9.CVD','Data/scnobj/obj05468/c9.CVD','Data/scnobj/obj05462/c9.CVD','Data/scnobj/obj05423/c9.CVD','Data/scnobj/obj05445/c9.CVD']
def export():
    with TemporaryDirectory(prefix='cdtank-breach07-') as temporary:
        directory=Path(temporary)
        library=export_models([dict(reference=reference) for reference in REFERENCES],ROOT/'recovery/output/verified/assets/data',directory)
        for path in directory.rglob('*.png'):
            output=WEB/path.relative_to(directory)
            output.parent.mkdir(parents=True,exist_ok=True)
            shutil.copyfile(path,output)
        (WEB/'scene-breach-0007.json').write_text(json.dumps(library,ensure_ascii=False)+'\n')
    print('Published scene Breach c9:',[(r['reference'],len(r['nodes'])) for r in library['resources']])


if __name__ == '__main__':
    export()
