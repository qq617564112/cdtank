"""Verify production password-mask mappings against the original font face."""
import json
from pathlib import Path
from fontTools.ttLib import TTFont
ROOT=Path(__file__).resolve().parents[3]
ASSETS=ROOT/'recovery/output/web-assets'
source=ASSETS/'ui/fonts/SIMSUN.ttf'
target=ASSETS/'ui/fonts/SIMSUN-password.ttf'
import sys
sys.path.insert(0, str(ROOT / 'recovery'))
from export_ui_password_font import export_password_font
original_bytes=source.read_bytes()
export_password_font(source, target)
assert source.read_bytes()==original_bytes
font=TTFont(source)
star=font.getBestCmap()[0x2a]
width=font['hmtx'][star]
outline=font['glyf'][star].getCoordinates(font['glyf'])[0]
actual=TTFont(target);cmap=actual.getBestCmap()
for code in [0x2a,0x2022,0x25cf,0x25a0]:
    glyph=cmap[code]
    assert actual['hmtx'][glyph]==width
    assert actual['glyf'][glyph].getCoordinates(actual['glyf'])[0]==outline
assert actual['head'].flags==TTFont(source)['head'].flags
for sourceStrike,actualStrike in zip(TTFont(source)['EBDT'].strikeData,actual['EBDT'].strikeData):
    assert sourceStrike[star].compile(TTFont(source))==actualStrike[cmap[42]].compile(actual)
result={'status':'PASS','source':'ui/fonts/SIMSUN.ttf','asset':'ui/fonts/SIMSUN-password.ttf','family':'CDTank-SIMSUN-Password','sourceMaskCodepoint':'U+002A','mappedCodepoints':[f'U+{c:04X}' for c in cmap],'sourceGlyph':star,'advanceUnits':width[0],'leftSideBearing':width[1],'unitsPerEm':actual['head'].unitsPerEm,'glyphCount':actual['maxp'].numGlyphs,'bitmapStrikeCount':len(actual['EBLC'].strikes),'sourceHeadFlags':actual['head'].flags,'scope':'Independent subset; each mask maps to original U+002A outline and advance. Original font is unchanged. Web font projection, not original OS/GPU pixel equivalence.'}
(ROOT/'recovery/output/room-create-password-font.json').write_text(json.dumps(result,indent=2)+'\n')
print('PASS: source asterisk outline/advance mapped to independent password font')
