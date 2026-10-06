"""Verify closed-set coverage, provenance pointers and source/code normalization."""
import json
from pathlib import Path
import sys
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'recovery'))
from export_asset_usage import normalize, original_material_textures, glb_document
inventory = json.loads((ROOT / 'recovery/output/catalog/inventory.json').read_text())
index = json.loads((ROOT / 'recovery/output/asset-usage-index.json').read_text())
assert len(inventory) == len(index['assets']) == 4665
expected = {row['key']: row for row in inventory}
assert len(expected) == 4665
assert [r['key'] for r in index['assets']] == [r['key'] for r in inventory]
cache = {}
def document(path):
    if path not in cache: cache[path] = json.loads((ROOT / path).read_text())
    return cache[path]
def resolve(value, pointer):
    for segment in pointer.split('/')[1:] if pointer else []:
        segment = segment.replace('~1', '/').replace('~0', '~')
        value = value[int(segment)] if isinstance(value, list) else value[segment]
    return value
for row in index['assets']:
    original = expected[row['key']]
    for field in ['selected', 'versions', 'selectionBasis', 'patchPending']:
        assert row[field] == original[field]
    assert normalize(row['selected']['source']) == row['key']
    assert row['runtimeAcceptance'] == 'not-established-by-index'
    assert row['usageStatus'] == ('metadata-matched' if row['references'] else 'unmatched')
    for evidence in row['originalLoading']['evidence']:
        assert (ROOT / evidence).is_file()
references = [reference for row in index['assets'] for reference in row['references']] + index['outsideReferences']
reference_owners = {id(ref): row['key'] for row in index['assets'] for ref in row['references']}
texture_candidates = {}
for candidate in expected:
    if Path(candidate).suffix in ['.dds', '.tga', '.bmp', '.jpg']:
        for alias in {Path(candidate).name, Path(candidate).stem + '.tga'}:
            texture_candidates.setdefault((str(Path(candidate).parent), alias), []).append(candidate)
texture_cache = {}
texture_count = 0
for ref in references:
    assert normalize(ref['reference']) == ref['normalizedReference']
    value = resolve(document(ref['metadata']), ref['pointer'])
    if ref['relation'] != 'exporter-source-construction':
        assert isinstance(value, str)
        assert value == ref['reference'] or ref['relation'] == 'ini-relative-action-source'
    for code in ref['loadingCode'] + ([ref['sourceConstruction']] if ref.get('sourceConstruction') else []) + ref.get('textureSource', {}).get('codeEvidence', []):
        assert (ROOT / code['file']).read_text().splitlines()[code['line'] - 1].strip() == code['code']
    assert ref['runtimeAcceptance'] == 'not-established-by-index'
    if ref.get('textureSource'):
        texture = ref['textureSource']
        model_key = texture['modelKey']
        if model_key not in texture_cache:
            source = ROOT / expected[model_key]['selected']['source']
            textures = original_material_textures(source)
            glb, binary = glb_document(ROOT / 'recovery/output/web-assets' / texture['glb'])
            texture_cache[model_key] = textures, glb, binary
        textures, glb, binary = texture_cache[model_key]
        assert textures[texture['materialIndex']] == texture['originalTexture']
        assert glb['materials'][texture['materialIndex']]['name'] == texture['originalTexture']
        key = reference_owners[id(ref)]
        assert Path(key).parent == Path(model_key).parent
        aliases = {Path(key).name, Path(key).stem + '.tga'}
        assert texture['originalTexture'].lower() in aliases
        candidates = texture_candidates[(str(Path(model_key).parent), texture['originalTexture'].lower())]
        assert candidates == [key]
        image = glb['images'][texture['imageIndex']]
        view = glb['bufferViews'][image['bufferView']]
        png = (ROOT / 'recovery/output/web-assets' / texture['png']).read_bytes()
        assert binary[view.get('byteOffset', 0):view.get('byteOffset', 0) + view['byteLength']] == png
        assert texture['embeddedPngBytes'] == len(png)
        texture_count += 1
for ref in index['outsideReferences']:
    assert ref['key'] not in expected and ref['status'] == 'outside-inventory'
summary = index['summary']
assert texture_count == summary['embeddedTextureReferences']
assert len(texture_cache) <= summary['textureModels']
assert summary['matched'] + summary['unmatched'] == 4665
assert summary['references'] == sum(len(row['references']) for row in index['assets'])
assert summary['outsideReferences'] == len(index['outsideReferences'])
assert json.loads((ROOT / 'recovery/output/asset-usage-summary.json').read_text()) == summary
assert normalize('Data\\role\\001\\01M.MV3') == 'role/001/01m.mv3'
assert normalize('/workspace/cdtank/CDTank/Data/sound/GA07.wav') == 'sound/ga07.wav'
assert normalize('recovery/output/verified/assets/data/Data/ui/layouts/chat.xml') == 'ui/layouts/chat.xml'
print(f"PASS: 4665 selected paths exactly once, {summary['references']} provenance references, {summary['outsideReferences']} outside references, code/pointers verified")
