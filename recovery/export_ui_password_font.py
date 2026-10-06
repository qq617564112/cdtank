"""Publish the original asterisk as the browser password mask font."""
import copy
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools import subset


def export_password_font(source: Path, target: Path) -> None:
    font=TTFont(source)
    source_map=font.getBestCmap();star=source_map[0x2a]
    bitmapLocation=copy.deepcopy(font['EBLC']);bitmapData=copy.deepcopy(font['EBDT'])
    for strike,data in zip(bitmapLocation.strikes,bitmapData.strikeData):
        table=next(table for table in strike.indexSubTables if star in table.names)
        table.names=[star];table.firstGlyphIndex=1;table.lastGlyphIndex=1
        strike.indexSubTables=[table];strike.bitmapSizeTable.startGlyphIndex=1;strike.bitmapSizeTable.endGlyphIndex=1
        glyph=data[star];data.clear();data[star]=glyph
    # Chromium's password masks are U+2022 on this supported browser; the other
    # common mask codepoints use the same recovered glyph in this tiny font.
    for table in font['cmap'].tables:
        if table.isUnicode():
            for code in [0x2a,0x2022,0x25cf,0x25a0]:table.cmap[code]=star
    options=subset.Options();options.name_IDs=['*'];options.name_legacy=True;options.name_languages=['*']
    options.drop_tables += ['vhea','vmtx']
    subsetter=subset.Subsetter(options=options);subsetter.populate(unicodes=[0x2a,0x2022,0x25cf,0x25a0]);subsetter.subset(font)
    font['EBLC']=bitmapLocation;font['EBDT']=bitmapData
    for entry in font['name'].names:
        if entry.nameID in [1,2,3,4,6]:
            value='CDTank SIMSUN Password' if entry.nameID!=6 else 'CDTank-SIMSUN-Password'
            entry.string=value.encode(entry.getEncoding())
    font.recalcBBoxes=False
    # Preserve source flags because they select the embedded bitmap strikes.
    font['head'].flags=TTFont(source)['head'].flags
    font.save(target)
