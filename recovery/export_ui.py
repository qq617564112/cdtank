"""Export source CEGUI layouts, atlas regions and bitmap font mappings for Web."""
import json
from pathlib import Path
import xml.etree.ElementTree as ET
from PIL import Image

catalog = Path('recovery/output/catalog')
out = Path('recovery/output/web-assets')
root = Path('recovery/output/verified/assets/data')
files = {p.relative_to(root).as_posix().lower(): p for p in root.rglob('*') if p.is_file()}
layouts = json.loads((catalog / 'layouts.json').read_text())
sets = json.loads((catalog / 'imagesets.json').read_text())
missing = []
for index, imageset in enumerate(sets):
    name = imageset['attributes']['Imagefile'].replace('\\', '/').lower()
    source = files.get(name)
    imageset['sourceImage'] = str(source) if source else None
    if source is None:
        missing.append(name)
        continue
    atlas = Image.open(source).convert('RGBA')
    # DDS scanlines are inverted relative to CEGUI's top-origin region rectangles.
    if source.suffix.lower() == '.dds':
        atlas = atlas.transpose(Image.Transpose.FLIP_TOP_BOTTOM)
    imageset['size'] = list(atlas.size)
    for region_index, region in enumerate(imageset['images']):
        x, y, width, height = [int(region[k]) for k in ('XPos', 'YPos', 'Width', 'Height')]
        if x < 0 or y < 0 or x + width > atlas.width or y + height > atlas.height:
            raise ValueError(f'Region outside atlas: {imageset["path"]}/{region["Name"]}')
        target = Path(f'ui/regions/{index}/{region_index}.png')
        (out / target).parent.mkdir(parents=True, exist_ok=True)
        atlas.crop((x, y, x + width, y + height)).save(out / target)
        region['asset'] = target.as_posix()
fonts = []
for path in sorted((root / 'Data/ui/fonts').glob('*.font')):
    font = ET.fromstring(path.read_bytes())
    fonts.append(dict(source=path.relative_to(root).as_posix(), attributes=dict(font.attrib),
                      mappings=[dict(mapping.attrib) for mapping in font]))
portraits = []
remote_set = next(entry for entry in sets if entry['attributes']['Name'] == 'zhandou00'
                  and 'imagesets_dds/' in entry['path'])
rows = json.loads(Path('recovery/output/verified/tables/pet.json').read_text())['rows']
for row in rows:
    identifier = int(row['values']['ID'])
    imageset = next((entry for entry in sets if entry['attributes']['Name'] == f'{identifier}0'
                     and 'imagesets_dds/' in entry['path']), None)
    region = next((region for region in imageset['images']
                   if region['Name'] == f'data\\ui\\{identifier}\\{identifier}_normal.tga'), None) if imageset else None
    remote = next((region for region in remote_set['images']
                   if region['Name'] == f'data\\ui\\zhandou\\{identifier}_normal1.tga'), None)
    expressions = {state: next((r['asset'] for r in imageset['images']
                   if r['Name'] == f'data\\ui\\{identifier}\\{identifier}_{state}.tga'), None)
                   if imageset else None for state in ('attack', 'wound', 'yeah1', 'yeah2')}
    portraits.append(dict(petId=identifier, asset=region.get('asset') if region else None,
                          imageset=imageset['path'] if imageset else None,
                          region=region['Name'] if region else None,
                          remoteAsset=remote.get('asset') if remote else None,
                          remoteImageset=remote_set['path'] if remote else None,
                          remoteRegion=remote['Name'] if remote else None, expressions=expressions))
death = {kind: next(r['asset'] for r in remote_set['images']
         if r['Name'] == f'data\\ui\\zhandou\\{name}.tga')
         for kind, name in [('local', 'die'), ('remote', 'die_2')]}
data = dict(nativeSize=[800, 600], layouts=layouts, imagesets=sets, fonts=fonts,
            portraits=portraits, portraitDeath=death, missingImages=missing)
(out / 'ui.json').write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
print(f'{len(layouts)} layouts, {sum(len(l["windows"]) for l in layouts)} controls, '
      f'{len(sets)} imagesets, {sum("asset" in i for s in sets for i in s["images"])} PNG regions, '
      f'{len(fonts)} fonts; {len(missing)} missing atlas references')
print(f'{sum(bool(p["asset"]) for p in portraits)} matched pet portraits, '
      f'{sum(not p["asset"] for p in portraits)} unresolved pet portraits')
print(f'{sum(bool(p["remoteAsset"]) for p in portraits)} matched remote battle portraits')
