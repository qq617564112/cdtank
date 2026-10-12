"""Classify original model texture references against the selected asset inventory."""
import argparse
from collections import Counter
import json
from pathlib import Path

from export_asset_usage import ROOT, WEB, glb_document, normalize, original_material_textures
from cvd import read_cvd
from mv3 import read_mv3
from pol import read_pol

TEXTURE_EXTENSIONS = {'.dds', '.tga', '.bmp', '.jpg'}


def texture_maps(inventory):
    local, global_names = {}, {}
    for item in inventory:
        key = item['key']
        path = Path(key)
        if path.suffix not in TEXTURE_EXTENSIONS:
            continue
        for alias in {path.name, path.stem + '.tga'}:
            local.setdefault((str(path.parent), alias), set()).add(key)
            global_names.setdefault(alias, set()).add(key)
    return local, global_names


def classify(model, name, local, global_names):
    if not name:
        return dict(classification='empty-material', candidates=[])
    candidates = sorted(local.get((str(Path(model).parent), name.lower()), []))
    if len(candidates) == 1:
        return dict(classification='unique-local-texture', candidates=candidates)
    if candidates:
        return dict(classification='ambiguous-local-texture', candidates=candidates)
    elsewhere = sorted(global_names.get(name.lower(), []))
    return dict(classification='missing-local-scope' if elsewhere else 'missing-selected-texture',
                candidates=[], exactNameElsewhere=elsewhere)


def original_slots(source):
    if source.suffix.lower() == '.mv3':
        return [material['textures'] for material in read_mv3(source)['materials']]
    if source.suffix.lower() == '.pol':
        return [part['textures'] for mesh in read_pol(source)['meshes'] for part in mesh['parts']]
    return [[part['texture']] for node in read_cvd(source)['nodes']
            if node.get('frames') for part in node['parts']]


def build():
    inventory = json.loads((ROOT / 'recovery/output/catalog/inventory.json').read_text())
    selected = {item['key']: item for item in inventory}
    usage = json.loads((ROOT / 'recovery/output/asset-usage-index.json').read_text())
    references = {item['key']: item['references'] for item in usage['assets']}
    local, global_names = texture_maps(inventory)
    unresolved, empty = [], []
    counts = Counter()
    issue_by_material = {(item['model'], item['material']): item for item in usage['textureIssues']}
    for metadata in ['pol-conversion.json', 'mv3-conversion.json', 'cvd-conversion.json']:
        models = json.loads((WEB / metadata).read_text())
        for entry in models:
            model = normalize(entry['path'])
            source = ROOT / selected[model]['selected']['source']
            textures = original_material_textures(source)
            document, _ = glb_document(WEB / entry['output'])
            materials = document.get('materials', [])
            if textures != [material.get('name', '') for material in materials]:
                raise ValueError(f'Original/GLB material ordering differs: {model}')
            for index, name in enumerate(textures):
                result = classify(model, name, local, global_names)
                counts[result['classification']] += 1
                record = dict(model=model, material=index, sourceTexture=name,
                              source=selected[model]['selected']['source'],
                              artifact=entry['output'], metadata=metadata, **result)
                if result['classification'] == 'empty-material':
                    if materials[index].get('pbrMetallicRoughness', {}).get('baseColorTexture'):
                        raise ValueError(f'Empty original material embeds texture: {model}/{index}')
                    empty.append(record)
                elif result['classification'] != 'unique-local-texture':
                    issue = issue_by_material.get((model, index))
                    if not issue or issue['sourceTexture'] != name or issue['candidates'] != result['candidates']:
                        raise ValueError(f'Texture issue index differs: {model}/{index}')
                    record['indexStatus'] = issue['status']
                    record['resolution'] = 'unresolved'
                    record['originalTextureSlots'] = original_slots(source)[index]
                    record['publishedReferences'] = [dict(metadata=ref['metadata'],
                        pointer=ref['pointer'], relation=ref['relation'])
                        for ref in references.get(model, [])]
                    unresolved.append(record)
    if len(unresolved) != len(usage['textureIssues']):
        raise ValueError('Texture issue index contains references outside this classification')
    return dict(schemaVersion=1, inventory='recovery/output/catalog/inventory.json',
                usageIndex='recovery/output/asset-usage-index.json',
                scope='Original first texture slot and converter same-directory exact-name/TGA alias map',
                summary=dict(sorted(counts.items())), issues=unresolved, emptyMaterials=empty,
                converterFixes=[], runtimeAcceptance='not-established-by-source-or-conversion-audit')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--out', type=Path, default=ROOT / 'recovery/output/texture-gaps-sol.json')
    args = parser.parse_args()
    report = build()
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps(report['summary'], ensure_ascii=False, sort_keys=True))


if __name__ == '__main__':
    main()
