"""Join the selected asset inventory to explicit published metadata references."""
import argparse
from collections import Counter
import json
from pathlib import Path
import re
import struct
from pol import read_pol
from mv3 import read_mv3
from cvd import read_cvd

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / 'recovery/output/web-assets'
SOURCE_FIELDS = {'source', 'path', 'ini', 'reference', 'sourceReference', 'tableSource', 'Imagefile', 'Filename', 'imageset', 'remoteImageset'}
DERIVED_FIELDS = {'asset', 'output', 'terrain', 'remoteAsset'}

def normalize(value):
    value = value.replace('\\', '/').lower()
    for prefix in ['/data/', 'data/']:
        if prefix in value:
            # The extracted data/Data prefix and CDTank/Data prefix both end here.
            return value.rsplit(prefix, 1)[1]
    return value.lstrip('./')

def pointer(parent, key):
    return parent + '/' + str(key).replace('~', '~0').replace('/', '~1')

def leaves(value, location=''):
    if isinstance(value, dict):
        for key, child in value.items():
            if isinstance(child, str):
                yield key, child, pointer(location, key), value
            elif isinstance(child, (dict, list)):
                yield from leaves(child, pointer(location, key))
    elif isinstance(value, list):
        for index, child in enumerate(value):
            if isinstance(child, (dict, list)):
                yield from leaves(child, pointer(location, index))
            elif isinstance(child, str):
                yield '', child, pointer(location, index), None

def consumers(filenames):
    result = {filename: [] for filename in filenames}
    for path in sorted((ROOT / 'apps').rglob('*')):
        if path.suffix not in {'.ts', '.tsx'}:
            continue
        for number, line in enumerate(path.read_text().splitlines(), 1):
            for filename in result:
                if filename in line:
                    result[filename].append(dict(file=path.relative_to(ROOT).as_posix(), line=number,
                                                 entry='metadata-reference', code=line.strip()))
    # The scene owners construct these exact filenames from the original map ID.
    for prefix, file, token in [
        ('scene-effects-', 'apps/web/src/assets/scenes/map-scene-effects.ts',
         'fetch(`/scene-effects-'),
        ('scene-environment-sound-', 'apps/web/src/audio/map-environment-sound.ts',
         'this.json<EnvironmentSoundMap>(`/scene-environment-sound-'),
    ]:
        evidence = code_evidence(file, token)
        for filename, entries in result.items():
            match = re.fullmatch(re.escape(prefix) + r'(\d{4})\.json', filename)
            if match and 1 <= int(match[1]) <= 25:
                entries.append(dict(**evidence, entry='map-id-metadata-reference'))
    return result

def original_material_textures(path):
    if path.suffix.lower() == '.mv3':
        return [material['textures'][0] for material in read_mv3(path)['materials']]
    if path.suffix.lower() == '.pol':
        return [(part['textures'] or [''])[0] for mesh in read_pol(path)['meshes'] for part in mesh['parts']]
    return [part['texture'] for node in read_cvd(path)['nodes'] if node.get('frames') for part in node['parts']]

def glb_document(path):
    raw = path.read_bytes()
    magic, version, length = struct.unpack_from('<III', raw)
    assert magic == 0x46546c67 and version == 2 and length == len(raw)
    size, kind = struct.unpack_from('<II', raw, 12)
    assert kind == 0x4e4f534a
    doc = json.loads(raw[20:20 + size])
    binary_size, binary_kind = struct.unpack_from('<II', raw, 20 + size)
    assert binary_kind == 0x004e4942
    return doc, raw[28 + size:28 + size + binary_size]

def code_evidence(file, token):
    code = (ROOT / file).read_text().splitlines()
    number = next(i for i, line in enumerate(code, 1) if token in line)
    return dict(file=file, line=number, code=code[number - 1].strip())

def table_consumers():
    result = {}
    # These literal calls name decoded tables, rather than Web metadata files.
    for path in sorted((ROOT / 'apps/server/src').rglob('*.ts')):
        for number, line in enumerate(path.read_text().splitlines(), 1):
            names = re.findall(r"sourceTablePath\(['\"]([^'\"]+)['\"]\)", line)
            if path.relative_to(ROOT).as_posix() == 'apps/server/src/config.ts':
                names += re.findall(r"readTable\(['\"]([^'\"]+)['\"]\)", line)
            for name in names:
                result.setdefault(name, []).append(dict(file=path.relative_to(ROOT).as_posix(),
                    line=number, entry='decoded-table-read', code=line.strip()))
    # config.ts expands its explicit five-mode range into m001 through m005.
    config = 'apps/server/src/config.ts'
    mode_range = code_evidence(config, '[1, 2, 3, 4, 5].flatMap(mode =>')
    mode_read = code_evidence(config, 'readTable(`m00${mode}`)')
    for mode in range(1, 6):
        result.setdefault(f'm00{mode}', []).extend([
            dict(**mode_range, entry='decoded-mode-table-range'),
            dict(**mode_read, entry='decoded-mode-table-read')])
    resolver = dict(**code_evidence('apps/server/src/runtime/content-paths.ts',
        'process.env.CONTENT_TABLES'), entry='decoded-table-path')
    config_read = dict(**code_evidence(config, 'readFileSync(sourceTablePath(name)'),
        entry='decoded-table-loader')
    for entries in result.values():
        if any(entry['file'] == config for entry in entries):
            entries.append(config_read)
        entries.append(resolver)
    return result

def build():
    inventory = json.loads((ROOT / 'recovery/output/catalog/inventory.json').read_text())
    by_key = {row['key']: row for row in inventory}
    documents = {path.name: json.loads(path.read_text()) for path in sorted(WEB.glob('*.json'))
                 if 'native' not in path.name and path.name != 'validation.json'}
    source_fields = []
    derived = {}
    # Only an explicit source/output pair establishes a converted-output mapping.
    for name, doc in documents.items():
        for field, value, location, parent in leaves(doc):
            if field not in SOURCE_FIELDS or not Path(value.replace('\\', '/')).suffix:
                continue
            if name in ['pol-conversion.json', 'mv3-conversion.json', 'cvd-conversion.json'] and field == 'path':
                if parent.get('output'):
                    derived.setdefault(normalize(parent['output']), set()).add(normalize(value))
            elif field == 'source' and parent:
                for asset_field in ['asset', 'output']:
                    if parent.get(asset_field):
                        derived.setdefault(normalize(parent[asset_field]), set()).add(normalize(value))
            source_fields.append((name, field, value, location, parent))
    references = {key: [] for key in by_key}
    outside = []
    loader = consumers(documents)
    def add(key, name, location, value, relation, artifact=None):
        item = dict(metadata='recovery/output/web-assets/' + name, pointer=location,
                    reference=value, normalizedReference=normalize(value), relation=relation,
                    artifact=artifact, usage=name.removesuffix('.json'),
                    loadingCode=loader[name], runtimeAcceptance='not-established-by-index')
        if key in references:
            references[key].append(item)
        else:
            outside.append(dict(key=key, **item, status='outside-inventory'))
    for name, field, value, location, parent in source_fields:
        artifact = parent.get('output') or parent.get('asset') if parent else None
        key = normalize(value)
        add(key, name, location, value, 'explicit-source-reference', artifact)
        if key not in references:
            outside[-1]['field'] = field
            if parent and parent.get('source') and normalize(parent['source']) in references:
                outside[-1]['publishedResolvedSource'] = normalize(parent['source'])
    for name, doc in documents.items():
        for field, value, location, parent in leaves(doc):
            if field not in DERIVED_FIELDS or not Path(value.replace('\\', '/')).suffix:
                continue
            for source_key in sorted(derived.get(normalize(value), [])):
                add(source_key, name, location, value, 'explicit-derived-artifact-reference', value)
    # The tank action filename is relative to its explicit component INI directory.
    for ti, tank in enumerate(documents.get('tanks.json', [])):
        for ci, component in enumerate(tank['components']):
            for ai, action in enumerate(component['actions']):
                filename = action.get('fields', {}).get('file')
                if filename:
                    value = str(Path(component['ini']).parent / filename)
                    add(normalize(value), 'tanks.json', f'/{ti}/components/{ci}/actions/{ai}/fields/file',
                        value, 'ini-relative-action-source', action.get('asset'))
    # Atlas regions are cropped from the explicitly named Imagefile, not a loose TGA.
    regions = {}
    for ii, imageset in enumerate(documents.get('ui.json', {}).get('imagesets', [])):
        imagefile = imageset.get('attributes', {}).get('Imagefile')
        for ri, region in enumerate(imageset.get('images', [])):
            if imagefile and region.get('asset'):
                regions[normalize(region['asset'])] = normalize(imagefile)
                add(normalize(imagefile), 'ui.json', f'/imagesets/{ii}/images/{ri}/asset',
                    region['asset'], 'atlas-region-artifact', region['asset'])
    for name in ['ui.json', 'ui-fonts.json']:
        for field, value, location, parent in leaves(documents.get(name, {})):
            if field in DERIVED_FIELDS and normalize(value) in regions:
                add(regions[normalize(value)], name, location, value, 'atlas-region-use', value)
    # Table provenance published by the table decoder includes the source path.
    table_loaders = table_consumers()
    for path in sorted((ROOT / 'recovery/output/verified/tables').glob('*.json')):
        table = json.loads(path.read_text())
        source = table.get('source')
        if source and normalize(source) in references:
            references[normalize(source)].append(dict(metadata=path.relative_to(ROOT).as_posix(), pointer='/source',
                reference=source, normalizedReference=normalize(source), relation='decoded-table', artifact=None,
                usage='table-metadata', loadingCode=table_loaders.get(path.stem, []),
                runtimeAcceptance='not-established-by-index'))
    # Source paths constructed by exporters are recorded with their exact code basis.
    def exporter_source(key, name, location, code_file, code_token):
        add(key, name, location, key, 'exporter-source-construction', name)
        ref = references[key][-1] if key in references else outside[-1]
        code = (ROOT / code_file).read_text().splitlines()
        number = next(i for i, line in enumerate(code, 1) if code_token in line)
        ref['sourceConstruction'] = dict(file=code_file, line=number, code=code[number - 1].strip())
    for index, scene in enumerate(documents.get('scene-placements.json', [])):
        identifier = scene['id']
        for extension, token in [('obj', "rglob('*.obj')"), ('cas', "with_suffix('.cas')"), ('box', "with_suffix('.box')")]:
            exporter_source(f'scn/{identifier}/{identifier}.{extension}', 'scene-placements.json',
                            f'/{index}/id', 'recovery/export_scenes.py', token)
        for ci, castle in enumerate(scene['castles']):
            model = castle['model']
            exporter_source(f'scnobj/{model}/{model}.ini', 'scene-placements.json',
                            f'/{index}/castles/{ci}/model', 'recovery/export_scenes.py', "actions.read(model_dir")
    for index, field in enumerate(documents.get('battlefields.json', [])):
        identifier = field['id']
        for extension, token, directory in [('POL', 'terrain = read_pol', 'map'), ('rpt', '.rpt', 'scn'), ('nav', 'navigation = read_nav', 'scn')]:
            exporter_source(f'{directory}/{identifier}/{identifier}.{extension}'.lower(), 'battlefields.json',
                            f'/{index}/id', 'recovery/export_battlefields.py', token)
    for table, token in [('skill', 'table/skill.dat'), ('item', 'table/item.dat'), ('datascale', 'table/datascale.dat')]:
        exporter_source(f'table/{table}.dat', 'combat-catalog.json', '', 'recovery/export_combat_catalog.py', token)
    exporter_source('effect/effect.sav', 'effect-library.json', '', 'recovery/export_effect_library.py', 'source = ROOT')
    # A model material uses only the converter's exact same-directory texture map.
    texture_candidates = {}
    for key, item in by_key.items():
        if Path(key).suffix not in ['.dds', '.tga', '.bmp', '.jpg']:
            continue
        parent = str(Path(key).parent)
        for alias in {Path(key).name, Path(key).stem + '.tga'}:
            texture_candidates.setdefault((parent, alias), set()).add(key)
    texture_issues = []
    texture_models = 0
    embedded_images = 0
    for name in ['pol-conversion.json', 'mv3-conversion.json', 'cvd-conversion.json']:
        for mi, model in enumerate(documents.get(name, [])):
            model_key = normalize(model['path'])
            if model_key not in by_key:
                texture_issues.append(dict(model=model_key, status='source-outside-inventory'))
                continue
            original_path = ROOT / by_key[model_key]['selected']['source']
            glb_path = WEB / model['output']
            if not glb_path.is_file():
                texture_issues.append(dict(model=model_key, artifact=model['output'], status='missing-glb'))
                continue
            source_textures = original_material_textures(original_path)
            glb, binary = glb_document(glb_path)
            materials = glb.get('materials', [])
            assert [material.get('name', '') for material in materials] == source_textures, model_key
            texture_models += 1
            for material_index, material in enumerate(materials):
                source_name = source_textures[material_index]
                if not source_name:
                    continue
                candidates = sorted(texture_candidates.get((str(Path(model_key).parent), source_name.lower()), []))
                texture = material.get('pbrMetallicRoughness', {}).get('baseColorTexture')
                if len(candidates) != 1:
                    texture_issues.append(dict(model=model_key, material=material_index, sourceTexture=source_name,
                        candidates=candidates, status='missing-local-texture' if not candidates else 'ambiguous-local-texture'))
                    continue
                key = candidates[0]
                png_relative = 'Data/' + Path(by_key[key]['selected']['path']).with_suffix('.png').as_posix()
                png_path = WEB / png_relative
                if not texture or not png_path.is_file():
                    texture_issues.append(dict(model=model_key, material=material_index, sourceTexture=source_name,
                        selectedTexture=key, status='not-embedded' if not texture else 'missing-png'))
                    continue
                image_index = glb['textures'][texture['index']]['source']
                image = glb['images'][image_index]
                view = glb['bufferViews'][image['bufferView']]
                image_bytes = binary[view.get('byteOffset', 0):view.get('byteOffset', 0) + view['byteLength']]
                assert image.get('mimeType') == 'image/png' and image_bytes == png_path.read_bytes(), (model_key, source_name)
                add(key, name, f'/{mi}/path', model['path'], 'original-material-embedded-texture', model['output'])
                ref = references[key][-1]
                ref['textureSource'] = dict(modelKey=model_key, originalTexture=source_name,
                    materialIndex=material_index, imageIndex=image_index, png=png_relative,
                    glb=model['output'], imagePointer=f'/images/{image_index}/bufferView',
                    resolution='unique-converter-local-map', embeddedPngBytes=len(image_bytes),
                    codeEvidence=[code_evidence('recovery/' + name.replace('-conversion.json', '').replace('pol', 'convert_pol').replace('mv3', 'convert_mv3').replace('cvd', 'convert_cvd') + '.py', 'stem.lower()'),
                                  code_evidence('recovery/convert_mv3.py', "texture = material['textures'][0]"),
                                  code_evidence('recovery/convert_mv3.py', "image_bytes = image_path.read_bytes()")])
                embedded_images += 1
    
    # These are original loader evidence, kept separate from web runtime acceptance.
    rows = []
    for original in inventory:
        key = original['key']
        original_entry = dict(status='unknown', evidence=[])
        if key.startswith('table/') and key.endswith('.dat'):
            original_entry = dict(status='documented-native-entry', entry='41a2ff ->418e4a ->40483a',
                evidence=['recovery/docs/asset-loose-entry-sol.md', 'recovery/output/asset-loose-sol-tables.json'])
        elif key.startswith('sound/') and key.endswith('.wav'):
            original_entry = dict(status='documented-native-entry', entry='485920 ->575a03 ->575beb disk',
                evidence=['recovery/docs/asset-loose-entry-sol.md', 'recovery/output/asset-loose-sol-media.json'])
        elif key == 'movie/logo.bik':
            original_entry = dict(status='documented-native-entry', entry='447284 ->4484b9 ->448407',
                evidence=['recovery/docs/asset-loose-entry-sol.md', 'recovery/output/asset-movie-slot-sol.json'])
        refs = references[key]
        rows.append(dict(key=key, selected=original['selected'], versions=original['versions'],
            selectionBasis=original['selectionBasis'], patchPending=original['patchPending'],
            references=refs, usageStatus='metadata-matched' if refs else 'unmatched',
            originalLoading=original_entry, runtimeAcceptance='not-established-by-index'))
    summary = dict(paths=len(rows), selected=sum(r['selected'] is not None for r in rows),
        matched=sum(bool(r['references']) for r in rows), unmatched=sum(not r['references'] for r in rows),
        references=sum(len(r['references']) for r in rows), outsideReferences=len(outside),
        textureModels=texture_models, embeddedTextureReferences=embedded_images, textureIssues=len(texture_issues),
        outsideKeys=len({r['key'] for r in outside}),
        unmatchedByExtension=dict(Counter(Path(r['key']).suffix or '(none)' for r in rows if not r['references'])),
        outsideByRoot=dict(Counter(r['key'].split('/')[0] for r in outside)),
        outsideWithPublishedResolvedSource=sum('publishedResolvedSource' in r for r in outside),
        originalEntries=dict(Counter(r['originalLoading']['status'] for r in rows)),
        referencesByMetadata=dict(Counter(r['metadata'] for row in rows for r in row['references'])))
    return dict(schemaVersion=1, inventory='recovery/output/catalog/inventory.json', metadata=list(documents),
        scope='Explicit metadata source references and derived artifact relationships; code references do not establish browser loads or original rendering acceptance.',
        summary=summary, assets=rows, outsideReferences=outside, textureIssues=texture_issues)

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--out', type=Path, default=ROOT / 'recovery/output/asset-usage-index.json')
    args = parser.parse_args()
    result = build()
    args.out.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    args.out.with_name('asset-usage-summary.json').write_text(json.dumps(result['summary'], ensure_ascii=False, indent=2) + '\n')
    print(json.dumps(result['summary'], ensure_ascii=False))
if __name__ == '__main__': main()
