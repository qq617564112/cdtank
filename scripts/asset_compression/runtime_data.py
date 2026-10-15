"""Publish browser effect configuration and per-map placement data."""

import json
from pathlib import Path
import struct

EFFECT_CONTROL_TABLES = ('spriteControls', 'particleControls', 'stripControls', 'soundControls',
    'boltControls', 'overlayControls', 'screenControls', 'modelControls')


def select_fields(record, fields):
    return {key: record[key] for key in fields if key in record}


def write_document(path, document):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(document, ensure_ascii=False, separators=(',', ':')) + '\n')
    return path.stat().st_size


def publish_scene_tag_data(root):
    files = 0
    source_bytes = 0
    published_bytes = 0
    for name in ('castle.json', 'hook.json'):
        for source in sorted((root / 'data/maps').glob('*/' + name)):
            document = json.loads(source.read_text())
            values = bytearray()

            def pack(track):
                offset = len(values) // 4
                for frame in track['frames']:
                    values.extend(struct.pack('<17f', frame['time'], *frame['matrix']))
                return {**track, 'frames': dict(offset=offset, length=len(track['frames']))}

            if name == 'castle.json':
                document['castles'] = [{**castle, 'actions': [{**action,
                    'tracks': [pack(track) for track in action['tracks']]}
                    for action in castle['actions'] if action['name'] in ('c2', 'c3', 'n1', 'n2')]}
                    for castle in document['castles']]
            else:
                document['track'] = pack(document['track'])
            binary_path = source.with_suffix('.tracks.bin')
            document['binary'] = '/' + binary_path.relative_to(root).as_posix()
            published_bytes += write_document(source.with_suffix('.tracks.json'), document)
            binary_path.write_bytes(values)
            published_bytes += len(values)
            source_bytes += source.stat().st_size
            files += 2
    return dict(files=files, source_bytes=source_bytes, published_bytes=published_bytes)


def pack_effect_library(library):
    vectors = []
    indices = {}
    vector_fields = {}

    def pack(value, fields, path=()):
        if isinstance(value, list):
            if len(value) in (2, 3, 4) and all(isinstance(item, (int, float)) and
                    not isinstance(item, bool) for item in value):
                key = struct.pack('<' + 'd' * len(value), *value)
                if key not in indices:
                    indices[key] = len(vectors)
                    vectors.append(value)
                fields.add(path)
                return indices[key]
            return [pack(item, fields, (*path, '*')) for item in value]
        if isinstance(value, dict):
            return {key: pack(item, fields, (*path, key)) for key, item in value.items()}
        return value

    packed = dict(library)
    for table in (*EFFECT_CONTROL_TABLES, 'textureGrids', 'boltTextures'):
        fields = set()
        packed[table] = [pack(row, fields) for row in library[table]]
        if fields:
            vector_fields[table] = [list(path) for path in sorted(fields)]
    control_records = {}
    for table in EFFECT_CONTROL_TABLES:
        pools = {}
        record_indices = {}
        for row in packed[table]:
            for field, value in row.items():
                if not isinstance(value, dict):
                    continue
                records = pools.setdefault(field, [])
                indices_for_field = record_indices.setdefault(field, {})
                key = json.dumps(value, ensure_ascii=False, separators=(',', ':'))
                if key not in indices_for_field:
                    indices_for_field[key] = len(records)
                    records.append(value)
                row[field] = indices_for_field[key]
        if pools:
            control_records[table] = pools
    return dict(vectors=vectors, vectorFields=vector_fields, controlRecords=control_records, library=packed)


def gameplay_effect_nodes(root, library):
    """Keep all online definitions, explicit gameplay references and their child closure."""
    by_id = {}
    by_name = {}
    for node in library['nodes']:
        if node['id'] != 0:
            by_id.setdefault(node['id'], node)
        by_name.setdefault(node['name'], node)
    names = {node['name'] for node in library['nodes']
        if node['name'].startswith('_root\\online\\')}
    source = root / 'data/effects/links.json'
    if source.is_file():
        links = json.loads(source.read_text())
        for file in links['files']:
            for group in file['groups']:
                for action in group['actions']:
                    names.update(record['field04String'] for record in action['records'])
    for source in sorted((root / 'data/maps').glob('*/effects.json')):
        names.update(row['name'] for row in json.loads(source.read_text())['effects'])
    for source in sorted((root / 'data/maps').glob('*/hook.json')):
        names.add(json.loads(source.read_text())['effect'])
    pending = [by_name[name] for name in names if name in by_name]
    indices = set()
    while pending:
        node = pending.pop()
        if node['index'] in indices:
            continue
        indices.add(node['index'])
        pending.extend(by_id[child] for child in node['children'] if child in by_id)
    return indices


def publish_effect_library(root):
    root = Path(root)
    source = root / 'data/effects/library.json'
    if not source.is_file():
        return dict(files=0, source_bytes=0, published_bytes=0)
    library = json.loads(source.read_text())
    indices = gameplay_effect_nodes(root, library)
    runtime = {key: [row for row in library[key] if row['node'] in indices]
        for key in EFFECT_CONTROL_TABLES}
    runtime['nodes'] = [select_fields(node, ('index', 'id', 'type', 'name', 'children'))
        for node in library['nodes'] if node['index'] in indices]
    runtime['nodeTimings'] = [select_fields(row, ('node', 'delay', 'lifetime', 'controllers'))
        for row in library['nodeTimings'] if row['node'] in indices]
    for key in ('textureGrids', 'boltTextures'):
        runtime[key] = [select_fields(row, ('node', 'asset', 'resolution', 'uvFrames'))
            for row in library[key] if row['node'] in indices]
    runtime['rendering'] = select_fields(library['rendering'],
        ('scripts', 'spriteSelections', 'particleSelections', 'overlayScripts'))
    for key in ('spriteSelections', 'particleSelections'):
        runtime['rendering'][key] = [row for row in runtime['rendering'][key] if row['node'] in indices]
    published_bytes = write_document(source.with_name('library.runtime.json'), pack_effect_library(runtime))
    return dict(files=1, source_bytes=source.stat().st_size, published_bytes=published_bytes)


def publish_runtime_data(root):
    root = Path(root)
    effects = publish_effect_library(root)
    source_bytes = effects['source_bytes']
    published_bytes = effects['published_bytes']
    files = effects['files']
    source = root / 'data/effects/links.json'
    if source.is_file():
        links = json.loads(source.read_text())
        runtime = {'actionKeys': [select_fields(row, ('name', 'id')) for row in links['actionKeys']],
            'files': [{'tankCode': file['tankCode'], 'groups': [{'key': group['key'],
                'actions': [{'name': action['name'], 'records': [select_fields(record,
                    ('field04String', 'field148String', 'bindingMode')) for record in action['records']]}
                    for action in group['actions']]} for group in file['groups']]} for file in links['files']]}
        published_bytes += write_document(source.with_name('links.runtime.json'), runtime)
        source_bytes += source.stat().st_size
        files += 1
    source = root / 'data/maps/shared/placements.json'
    if source.is_file():
        for entry in json.loads(source.read_text()):
            published_bytes += write_document(root / 'data/maps' / entry['id'] / 'placements.json', entry)
            files += 1
        source_bytes += source.stat().st_size
    scene_tags = publish_scene_tag_data(root)
    return dict(files=files + scene_tags['files'], source_bytes=source_bytes + scene_tags['source_bytes'],
        published_bytes=published_bytes + scene_tags['published_bytes'])
