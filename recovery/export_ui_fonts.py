"""Publish source bitmap-font mappings and the dynamic TTC face for browsers."""
import json
from pathlib import Path
from fontTools.ttLib import TTFont
from export_ui_password_font import export_password_font

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'recovery/output/verified/assets/data'
OUTPUT = ROOT / 'recovery/output/web-assets'


def export():
    ui = json.loads((OUTPUT / 'ui.json').read_text())
    files = {path.relative_to(SOURCE).as_posix().lower(): path for path in SOURCE.rglob('*') if path.is_file()}
    rows = []
    for definition in ui['fonts']:
        attributes = definition['attributes']
        path = attributes['Filename'].replace('\\', '/').lower()
        row = dict(name=attributes['Name'], source=definition['source'], attributes=attributes)
        if attributes['Type'] == 'Dynamic':
            font = TTFont(str(files[path]), fontNumber=0)
            destination = Path('ui/fonts') / f"{attributes['Name']}.ttf"
            (OUTPUT / destination).parent.mkdir(parents=True, exist_ok=True)
            font.save(str(OUTPUT / destination))
            # The browser face must preserve the collection face's outlines and character mapping.
            published = TTFont(str(OUTPUT / destination))
            assert font.getBestCmap() == published.getBestCmap()
            for tag in ['glyf', 'hmtx', 'head', 'hhea', 'maxp']:
                if tag == 'head':
                    continue  # standalone sfnt has a distinct whole-file checksum adjustment
                assert font[tag].compile(font) == published[tag].compile(published)
            row.update(asset=destination.as_posix(), family=f"CDTank-{attributes['Name']}", faceIndex=0,
                       glyphCount=len(font.getBestCmap()))
        else:
            imageset = next(item for item in ui['imagesets'] if f"data/{item['path']}".lower() == path)
            regions = {region['Name']: region for region in imageset['images']}
            row['glyphs'] = [dict(codepoint=int(mapping['Codepoint']), image=mapping['Image'],
                                 asset=regions[mapping['Image']]['asset'],
                                 width=int(regions[mapping['Image']]['Width']),
                                 height=int(regions[mapping['Image']]['Height']))
                             for mapping in definition['mappings']]
        rows.append(row)
    export_password_font(OUTPUT / 'ui/fonts/SIMSUN.ttf', OUTPUT / 'ui/fonts/SIMSUN-password.ttf')
    return dict(fonts=rows, scope='Source definitions and source glyph assets; browser rasterization differs from original AntiAlias=false.')


if __name__ == '__main__':
    result = export()
    (OUTPUT / 'ui-fonts.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    print(f"Published {len(result['fonts'])} source fonts, {sum(len(row.get('glyphs', [])) for row in result['fonts'])} bitmap glyphs and the source SIMSUN/MingLiU face")
