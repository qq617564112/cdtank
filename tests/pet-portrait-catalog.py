"""Check the pet definition index and recovered HUD resource references."""
import json
from pathlib import Path

root = Path('recovery/output')
assets = root / 'web-assets'
ui = json.loads((assets / 'ui.json').read_text())
rows = json.loads((root / 'verified/tables/pet.json').read_text())['rows']
ids = [int(row['values']['ID']) for row in rows]
assert [portrait['petId'] for portrait in ui['portraits']] == ids
assert all('tankId' not in portrait for portrait in ui['portraits'])
visible = []
for portrait in ui['portraits']:
    identifier = portrait['petId']
    visible.append(identifier)
    local = next(imageset for imageset in ui['imagesets']
                 if imageset['path'] == portrait['imageset'])
    remote = next(imageset for imageset in ui['imagesets']
                  if imageset['path'] == portrait['remoteImageset'])
    assert local['attributes']['Name'] == f'{identifier}0'
    assert remote['attributes']['Name'] == 'zhandou00'
    for region_name, asset, imageset in [
        (f'data\\ui\\{identifier}\\{identifier}_normal.tga', portrait['asset'], local),
        (f'data\\ui\\zhandou\\{identifier}_normal1.tga', portrait['remoteAsset'], remote),
        *[(f'data\\ui\\{identifier}\\{identifier}_{expression}.tga', asset, local)
          for expression, asset in portrait['expressions'].items()],
    ]:
        region = next(region for region in imageset['images'] if region['Name'] == region_name)
        assert region['asset'] == asset
        assert (assets / asset).is_file()
    assert portrait['asset'] != portrait['remoteAsset']
assert visible == [1, 2, 3, 4, 5, 101, 102, 103, 104, 105]
evidence = {'status': 'PASS', 'petIds': ids, 'matchedLocalAndRemote': visible,
            'unrecoveredPetIds': [], 'tankIdFallback': False,
            'scope': 'PetTable index and exact existing atlas references/files; no atlas pixel or native rerun.'}
(root / 'pet-portrait-catalog.json').write_text(json.dumps(evidence, indent=2) + '\n')
print('PASS: 10 pet definitions and recovered local/remote families')
