"""Inspect CDTank serialized scene placement records."""
from pathlib import Path
from mv3 import Reader


def read_scene(path):
    r = Reader(Path(path).read_bytes())
    count = r.integer()
    records = []
    for _ in range(count):
        offset = r.position
        kind = r.integer()
        class_name = r.name(r.integer())
        stamp = r.integer()
        identifier = r.name(r.integer())
        model = r.name(r.integer())
        position = r.unpack('3f')
        enabled = r.unpack('B')[0]
        rotation = r.unpack('3f')
        matrix = r.unpack('16f')
        bounds = r.unpack('3f')
        tail_sizes = {'SYcScnObjPlant': 30, 'SYcScnObjSound': 35, 'SYcScnObjBreach': 26,
            'SYcScnObjGeneral': 26, 'SYcScnObjEffect': 42, 'SYcScnObjHook': 42,
            'SYcScnObjCrush': 30, 'SYcScnObjSequence': 26, 'SYcScnObjWaterFall': 26,
            'SYcCastle': 12, 'SYcVirtualBox': 80}
        tail = r.take(tail_sizes[class_name]).hex()
        records.append(dict(offset=offset, kind=kind, className=class_name, stamp=stamp,
            id=identifier, model=model, position=position, enabled=enabled,
            rotation=rotation, matrix=matrix, bounds=bounds, tail=tail))
    if r.position != len(r.data):
        raise ValueError(f'Trailing scene bytes {r.position}/{len(r.data)}')
    return records


if __name__ == '__main__':
    import json
    failures = []
    counts = {}
    for path in Path('recovery/output/verified/assets/data/Data/scn').rglob('*.obj'):
        try:
            counts[path.name] = len(read_scene(path))
        except Exception as error:
            failures.append((str(path), str(error)))
    print(json.dumps(dict(counts=counts, failures=failures),indent=2))
