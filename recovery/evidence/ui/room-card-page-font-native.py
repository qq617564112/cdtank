"""Append only the original slash glyph to existing SIMSUN mono atlases."""
import json
from pathlib import Path
import struct
ROOT = Path(__file__).resolve().parents[3]
source = ROOT / 'recovery/evidence/ui/waiting-room-font-native.py'
namespace = {'__file__': str(source), '__name__': 'page_font_harness'}
exec(compile(source.read_text().split('e=FreeType();')[0], str(source), 'exec'), namespace)
FreeType, Image = namespace['FreeType'], namespace['Image']
e = FreeType()
assert e.call(0x100d0110, [0x2010000]) == 0
library = e.read(0x2010000)
font = (namespace['UI'] / 'fonts/MINGLIU.TTC').read_bytes()
e.uc.mem_write(0x3000000, font)
assert e.call(0x100cd940, [library, 0x3000000, len(font), 0, 0x2011000]) == 0
face = e.read(0x2011000)
path = ROOT / 'recovery/output/web-assets/ui-font-raster.json'
current = json.loads(path.read_text())
rows = []
for entry in current['faces']:
    dpi = entry['dpi']
    existing = next((g for g in entry['glyphs'] if g['codepoint'] == 47), None)
    old_glyphs = json.loads(json.dumps(entry['glyphs']))
    atlas_path = ROOT / 'recovery/output/web-assets' / entry['atlas']['asset']
    old = Image.open(atlas_path).convert('RGBA')
    assert e.call(0x100ce9c0, [face, 0, 9 * 64, dpi, dpi]) == 0
    assert e.call(0x100cd900, [face, 47, 0x1004]) == 0
    slot = e.read(face + 0x54)
    bitmap = slot + 0x4c
    width, height, pitch = [e.read(bitmap + offset) for offset in [4, 0, 8]]
    mode = bytes(e.uc.mem_read(bitmap + 0x12, 1))[0]
    assert mode == 1
    raw = bytes(e.uc.mem_read(e.read(bitmap + 0xc), abs(pitch) * height))
    pixels = [255 if raw[y * abs(pitch) + (x >> 3)] >> (7 - (x & 7)) & 1 else 0 for y in range(height) for x in range(width)]
    assert any(pixels)
    glyph = dict(character='/', codepoint=47, width=width, height=height, pitch=pitch, pixelMode=mode,
                 advance=e.read(slot + 0x40) >> 6, inkX=struct.unpack('<i', e.uc.mem_read(slot + 0x20, 4))[0] >> 6,
                 inkY=-(struct.unpack('<i', e.uc.mem_read(slot + 0x24, 4))[0] >> 6), x=existing['x'] if existing else old.width, y=0)
    if existing:
        baseline = json.loads((ROOT / 'recovery/output/waiting-room-font-native.json').read_text())
        original = next(f for f in baseline['faces'] if f['dpi'] == dpi)
        assert entry['glyphs'][:-1] == original['glyphs']
        assert existing == glyph
        assert old.crop((glyph['x'], 0, glyph['x'] + width, height)).getchannel('A').tobytes() == bytes(pixels)
        rows.append({'dpi': dpi, 'glyph': glyph, 'existingGlyphVerified': True, 'oldGlyphRowsUnchanged': True, 'resourceMutation': False})
        continue
    new = Image.new('RGBA', (old.width + width + 1, max(old.height, height)), (255, 255, 255, 0))
    new.paste(old, (0, 0))
    ink = Image.new('RGBA', (width, height), (255, 255, 255, 0))
    ink.putalpha(Image.frombytes('L', (width, height), bytes(pixels)))
    new.paste(ink, (old.width, 0))
    assert new.crop((0, 0, old.width, old.height)).tobytes() == old.tobytes()
    entry['glyphs'].append(glyph)
    assert entry['glyphs'][:-1] == old_glyphs
    assert new.crop((glyph['x'], 0, glyph['x'] + width, height)).getchannel('A').tobytes() == bytes(pixels)
    new.save(atlas_path)
    entry['atlas'].update(width=new.width, height=new.height)
    rows.append({'dpi': dpi, 'glyph': glyph, 'oldGlyphCount': len(old_glyphs), 'oldGlyphRowsUnchanged': True,
                 'oldRGBARegionUnchanged': True, 'oldDimensions': [old.width, old.height], 'newDimensions': list(new.size), 'pixels': pixels})
if any(not row.get('existingGlyphVerified') for row in rows):
    current['finiteCharacters'] += '/'
    path.write_text(json.dumps(current, ensure_ascii=False, indent=2) + '\n')
result = {'status': 'PASS', 'vectors': rows, 'originalEntries': ['0x100d0110', '0x100cd940', '0x100ce9c0', '0x100cd900'],
          'providers': 'Existing FreeType harness CRT allocation/memory/String callbacks; original TTC face0, point9, mono flags0x1004.',
          'scope': 'Only U002F at three existing DPI appended; all old glyph rows and atlas RGBA regions preserved.'}
(ROOT / ('recovery/output/room-card-page-font-native-verify.json' if all(row.get('existingGlyphVerified') for row in rows) else 'recovery/output/room-card-page-font-native.json')).write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
print('PASS: original slash three DPI; 454 existing glyph rows and RGBA atlas regions unchanged per DPI')
