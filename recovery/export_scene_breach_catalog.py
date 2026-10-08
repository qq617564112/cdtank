"""Publish each placed Breach model's own destruction CVD and placement bindings."""
import json
from pathlib import Path
import shutil
from tempfile import TemporaryDirectory

from export_effect_models import export_models


def export(scenes, source_root: Path, web_root: Path, models=None):
    references = set()
    missing = {}
    models = set(models) if models is not None else None
    for scene in scenes:
        for record in scene['records']:
            if (record['className'] != 'SYcScnObjBreach' or
                    models is not None and record['model'] not in models):
                continue
            directory = source_root / f"Data/scnobj/{record['model']}"
            reference = next((f"Data/scnobj/{record['model']}/{name}"
                               for name in ('c9.CVD', 'C9.CVD')
                               if (directory / name).is_file()), None)
            if reference is None:
                reference = f"Data/scnobj/{record['model']}/c9.CVD"
                missing.setdefault(reference, []).append(dict(
                    mapId=scene['id'], sourcePlacementId=record['id']))
                continue
            references.add(reference)
            record['destruction'] = dict(
                library='scene-breach-catalog.json', reference=reference)

    with TemporaryDirectory(prefix='cdtank-breach-catalog-') as temporary:
        directory = Path(temporary)
        library = export_models([dict(reference=reference)
                                 for reference in sorted(references)], source_root, directory)
        library['missingResources'] = [dict(reference=reference, placements=placements)
                                       for reference, placements in sorted(missing.items())]
        for path in directory.rglob('*.png'):
            output = web_root / path.relative_to(directory)
            output.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(path, output)
        (web_root / 'scene-breach-catalog.json').write_text(
            json.dumps(library, ensure_ascii=False) + '\n', encoding='utf-8')
    return library
