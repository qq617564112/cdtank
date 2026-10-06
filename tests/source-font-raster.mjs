import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const library=JSON.parse(await readFile('recovery/output/web-assets/ui-font-raster.json','utf8'));
assert.equal(library.status,'PASS');assert.equal(library.font,'SIMSUN');assert.equal(library.faces.length,3);
for(const face of library.faces){assert(face.dpi===96||face.dpi===103||face.dpi===192);assert(face.lineSpacing>0);assert(face.baseline>0);assert(face.glyphs.length>=72);const png=await readFile('recovery/output/web-assets/'+face.atlas.asset);assert.equal(png.readUInt32BE(16),face.atlas.width);assert.equal(png.readUInt32BE(20),face.atlas.height);assert.equal(png[25],6);const chinese=face.glyphs.find(g=>g.codepoint===0x4e2d),ascii=face.glyphs.find(g=>g.codepoint===65);assert(chinese&&ascii);assert.equal(chinese.advance,face.dpi===192?24:12);assert(ascii.advance>=6);assert(chinese.width>0&&chinese.height>0);}
console.log('PASS: original SIMSUN/MINGLIU mono atlas 96/103/192 DPI metrics and PNG pixels');
