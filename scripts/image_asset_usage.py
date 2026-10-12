"""Resolve published image usage from application modules, catalogs and models."""
from collections import defaultdict
import fnmatch
import json
from pathlib import Path
import struct
import subprocess
from urllib.parse import unquote

IMAGE_EXTENSIONS = {'.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.avif', '.bmp', '.ico'}


def image_usage(root, runtime, names):
    names = set(names)
    scan = json.loads(subprocess.check_output(
        ['node', str(root / 'scripts/image-resource-references.mjs'), str(root)], text=True))
    reasons = defaultdict(set)
    missing = []

    def add(path, reason):
        path = unquote(path).lstrip('/')
        if Path(path).suffix.lower() not in IMAGE_EXTENSIONS:
            return
        reasons[path].add(reason)

    def references(value, reason):
        if isinstance(value, dict):
            for field, child in value.items():
                if reason == 'catalog:scene-actor-toon.json' and field == 'source':
                    continue
                references(child, reason)
        elif isinstance(value, list):
            for child in value:
                references(child, reason)
        elif isinstance(value, str) and not value.startswith('data:') and Path(value).suffix.lower() in IMAGE_EXTENSIONS:
            add(value, reason)

    for name in scan['localImages']:
        add(name, 'module')
    for pattern in scan['patterns']:
        if Path(pattern).suffix.lower() in IMAGE_EXTENSIONS:
            for name in names:
                if fnmatch.fnmatchcase(name, pattern):
                    add(name, 'module')

    ui_path = runtime / 'ui.json'
    ui = json.loads(ui_path.read_text())
    removed_layouts = [layout['path'] for layout in ui['layouts'] if layout['path'].endswith('keyboard.xml')]
    ui['layouts'] = [layout for layout in ui['layouts'] if layout['path'] not in removed_layouts]
    keyboard_sets = [imageset['path'] for imageset in ui['imagesets']
                     if any(image.get('asset', '').startswith('ui/regions/71/') for image in imageset['images'])]
    ui['imagesets'] = [imageset for imageset in ui['imagesets']
                       if not any(image.get('asset', '').startswith('ui/regions/71/')
                                  for image in imageset['images'])]
    grouped = defaultdict(list)
    for imageset in ui['imagesets']:
        grouped[imageset['attributes']['Name']].append(imageset)
    selected = {next((row for row in rows if 'imagesets_dds/' in row['path']), rows[0])['path']
                for rows in grouped.values()}
    selected.update(scan['imagesets'])
    removed_sets = keyboard_sets + [row['path'] for row in ui['imagesets'] if row['path'] not in selected]
    ui['imagesets'] = [row for row in ui['imagesets'] if row['path'] in selected]
    references(ui, 'ui-catalog')

    catalog_paths = {path.relative_to(runtime).as_posix(): path for path in runtime.rglob('*.json')
                     if path.name not in ('ui.json', 'image-assets.json')}
    pending = [name for name in catalog_paths
               if any(fnmatch.fnmatchcase(name, pattern) for pattern in scan['patterns'])]
    catalogs = set()

    def linked_catalogs(value):
        if isinstance(value, dict):
            for child in value.values():
                linked_catalogs(child)
        elif isinstance(value, list):
            for child in value:
                linked_catalogs(child)
        elif isinstance(value, str) and value.lstrip('/') in catalog_paths:
            pending.append(value.lstrip('/'))

    while pending:
        relative = pending.pop()
        if relative in catalogs:
            continue
        catalogs.add(relative)
        data = json.loads(catalog_paths[relative].read_text())
        references(data, 'catalog:' + relative)
        linked_catalogs(data)
    for path in (root / 'apps/shared/content/definitions').rglob('*.json'):
        references(json.loads(path.read_text()), 'content-definition')

    model_count = 0
    model_references = 0
    for path in runtime.rglob('*.glb'):
        with path.open('rb') as stream:
            header = stream.read(20)
            length, kind = struct.unpack_from('<II', header, 12)
            metadata = json.loads(stream.read(length))
        model_count += 1
        for image in metadata.get('images', []):
            uri = image.get('uri', '')
            if not uri or uri.startswith('data:'):
                continue
            target = (path.parent / unquote(uri)).resolve().relative_to(runtime).as_posix()
            model_references += 1
            add(target, 'model')
            if target not in names:
                missing.append(dict(model=path.relative_to(runtime).as_posix(), image=target))

    return dict(images=sorted(reasons), reasons={name: sorted(value) for name, value in sorted(reasons.items())},
                catalogs=sorted(catalogs), modules=scan['modules'],
                removedImagesets=removed_sets, removedLayouts=removed_layouts, ui=ui, models=model_count, modelReferences=model_references,
                missingModelImages=missing)
