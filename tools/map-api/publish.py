"""Publish independently reviewed map-object textures and original model geometry."""

import argparse
import json
from pathlib import Path
import posixpath
import shutil
import struct

from assets import ROOT, texture_name


def model_bytes(raw, entry, images, relative, variant=None, group=None):
    length = struct.unpack_from('<I', raw, 12)[0]
    document = json.loads(raw[20:20 + length])
    if group is not None:
        selected = set(next(row['meshes'] for row in entry['reviewGroups'] if row['name'] == group))
        for node in document.get('nodes', []):
            if 'mesh' in node and document['meshes'][node['mesh']]['name'] not in selected:
                del node['mesh']
    names = {}
    for material in document.get('materials', []):
        texture = material.get('pbrMetallicRoughness', {}).get('baseColorTexture')
        if texture is None:
            continue
        filename = entry.get('textureAliases', {}).get(material.get('name'), texture_name(material))
        names[document['textures'][texture['index']]['source']] = filename
    for index, filename in names.items():
        if filename not in images:
            continue
        selected = variant if variant and len(set(names.values())) == 1 else filename
        document['images'][index] = {'uri': posixpath.relpath(images[selected], posixpath.dirname(relative)),
                                     'mimeType': 'image/png'}
    encoded = json.dumps(document, ensure_ascii=False, separators=(',', ':')).encode()
    encoded += b' ' * (-len(encoded) % 4)
    suffix = raw[20 + length:]
    header = struct.pack('<IIIII', 0x46546C67, 2, 20 + len(encoded) + len(suffix),
                         len(encoded), 0x4E4F534A)
    return header + encoded + suffix


def reviewed(entry, evidence, independent):
    own_path = evidence / 'review.json'
    independent_path = independent / (entry['model'] + '.json')
    if not own_path.exists() or not independent_path.exists():
        return False
    for path in (own_path, independent_path):
        row = json.loads(path.read_text())
        if row.get('status') != 'passed' or row.get('confirmedIssueCount') != 0 or row.get('unresolvedCount') != 0:
            return False
    return True


def publish(independent, require_complete, install_runtime):
    inventory = json.loads((ROOT / 'tools/map-api/inventory.json').read_text())
    entries = inventory['objects']
    accepted = [row for row in entries if reviewed(row,
                ROOT / 'output/imagegen/map-api4k' / row['model'], independent)]
    if require_complete or install_runtime:
        pending = [row['model'] for row in entries if row not in accepted]
        if pending:
            raise ValueError('Independent review pending: ' + ', '.join(pending))
    public = ROOT / 'apps/web/public'
    audit = public / 'map-audit'
    catalog = []
    for entry in accepted:
        model = entry['model']
        evidence = ROOT / 'output/imagegen/map-api4k' / model
        folder = entry.get('runtimeFolder', entry.get('sourceFolder', 'Data/scnobj/' + model))
        original_images, generated_images = {}, {}
        for texture in entry['textures']:
            filename = texture['filename']
            original = 'map-audit/original/' + model + '/' + filename
            generated = 'map-audit/api4k/' + folder + '/' + filename
            target = public / original
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(ROOT / texture['reference'], target)
            if not (public / generated).is_file():
                raise FileNotFoundError(generated)
            original_images[filename] = original
            generated_images[filename] = generated
        scope = json.loads((evidence / 'renders/scope.json').read_text())
        models = []
        for item in scope['models']:
            raw = (ROOT / 'art/original' / item['asset']).read_bytes()
            urls = {}
            for mode, images in [('original', original_images), ('api4k', generated_images)]:
                relative = '/'.join(['map-audit/models', model, mode,
                                     item['action'], Path(item['variant']).stem + '.glb'])
                group = item['action'] if entry.get('kind') == 'static-map-objects' else None
                variant = None if group else item['variant']
                target = public / relative
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(model_bytes(raw, entry, images, relative, variant, group))
                urls[mode] = '/' + relative
            models.append({'action': item['action'], 'variant': item['variant'], **urls})
        catalog.append({'model': model, 'maps': entry['maps'], 'models': models,
                        'textureCount': len(entry['textures'])})
        if install_runtime:
            install(entry, generated_images, public)
    audit.mkdir(parents=True, exist_ok=True)
    manifest = {'mapCount': inventory['mapCount'], 'expectedGroups': len(entries),
                'reviewedGroups': len(catalog), 'objects': catalog}
    (audit / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    print(f'Published {len(catalog)}/{len(entries)} independently reviewed object groups')


def install(entry, generated_images, public):
    folder = entry.get('runtimeFolder', entry.get('sourceFolder', 'Data/scnobj/' + entry['model']))
    images = {}
    for filename, generated in generated_images.items():
        relative = folder + '/' + filename
        for root in (public, ROOT / 'art/hd'):
            target = root / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(public / generated, target)
        images[filename] = relative
    sources = list(entry['models'])
    installed = dict(images)
    if '1002' in entry['maps']:
        sources.extend('custom-maps/1002/' + source for source in entry['models'])
    for source in sources:
        target = public / source
        raw = target.read_bytes()
        mapped = images
        if source.startswith('custom-maps/1002/'):
            mapped = {}
            for filename, image in images.items():
                relative = 'custom-maps/1002/' + image
                for root in (public, ROOT / 'art/hd'):
                    destination = root / relative
                    destination.parent.mkdir(parents=True, exist_ok=True)
                    shutil.copy2(public / image, destination)
                mapped[filename] = relative
                installed[relative] = relative
        target.write_bytes(model_bytes(raw, entry, mapped, source))
    manifest_path = ROOT / 'art/hd/manifest.json'
    manifest = json.loads(manifest_path.read_text())
    old = {row['source']: row for row in manifest['textures']}
    replacements = {}
    for source in installed.values():
        texture = next(row for row in entry['textures'] if row['filename'] == Path(source).name)
        metadata = json.loads((ROOT / 'output/imagegen/map-api4k' / entry['model'] /
                               'metadata' / (Path(source).stem + '.json')).read_text())
        replacements[source] = {**old.get(source, {}), 'source': source,
            'png': 'art/hd/' + source, 'original': texture.get('originalSource', texture['reference']),
            'size': texture['sourceSize'], 'outputSize': metadata['finalSize']}
        replacements[source].setdefault('groups', ['map-' + mid for mid in entry['maps']])
    manifest['textures'] = [replacements.pop(row['source'], row) for row in manifest['textures']] + list(replacements.values())
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--independent-review', type=Path, required=True)
    parser.add_argument('--require-complete', action='store_true')
    parser.add_argument('--install-runtime', action='store_true')
    args = parser.parse_args()
    publish(args.independent_review, args.require_complete, args.install_runtime)
