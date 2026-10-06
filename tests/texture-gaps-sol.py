"""Verify exact texture classification and original material evidence."""
from collections import Counter
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'recovery'))
from texture_gaps_sol import build, classify, texture_maps

# Directory boundaries and alias collisions must remain unresolved, regardless of
# texture enumeration order; unrelated model stems are never image candidates.
keys = ['map/a/only.dds', 'map/b/remote.dds', 'map/a/dual.dds',
        'map/a/dual.tga', 'map/a/only.pol']
for order in [keys, list(reversed(keys))]:
    local, global_names = texture_maps([dict(key=key) for key in order])
    assert classify('map/a/a.pol', 'ONLY.TGA', local, global_names) == dict(
        classification='unique-local-texture', candidates=['map/a/only.dds'])
    assert classify('map/a/a.pol', 'dual.tga', local, global_names) == dict(
        classification='ambiguous-local-texture', candidates=['map/a/dual.dds', 'map/a/dual.tga'])
    assert classify('map/a/a.pol', 'remote.tga', local, global_names) == dict(
        classification='missing-local-scope', candidates=[], exactNameElsewhere=['map/b/remote.dds'])
    assert classify('map/a/a.pol', 'absent.tga', local, global_names) == dict(
        classification='missing-selected-texture', candidates=[], exactNameElsewhere=[])
    assert classify('map/a/a.pol', '', local, global_names) == dict(
        classification='empty-material', candidates=[])

report = build()
assert len(report['issues']) == 44
assert Counter(issue['classification'] for issue in report['issues']) == dict(
    **{'missing-selected-texture': 40, 'missing-local-scope': 4})
assert Counter(Path(issue['model']).suffix for issue in report['issues']) == {'.pol': 7, '.mv3': 37}
assert report['converterFixes'] == []
assert all(issue['resolution'] == 'unresolved' for issue in report['issues'])
assert len(report['emptyMaterials']) == 11
assert all(issue['originalTextureSlots'][0] == issue['sourceTexture']
           and not any(issue['originalTextureSlots'][1:]) for issue in report['issues'])
print('PASS exact resolution, directory scope, ambiguity, empty materials and 44 original/GLB references')
print(report['summary'])
