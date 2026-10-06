import {strict as assert} from 'node:assert';
import {readFileSync, writeFileSync} from 'node:fs';
import {NavigationGrid, SourceNavigationLayer} from '../apps/server/src/navigation';
import {getBattlefield} from '../apps/server/src/battlefield';

const fields: {id: string; navigationLayers: SourceNavigationLayer[]}[] = JSON.parse(
  readFileSync('recovery/output/web-assets/battlefields.json', 'utf8'));
let cells = 0;
let valid = 0;
for (const field of fields) {
  for (const source of field.navigationLayers) {
    const grid = new NavigationGrid(source);
    const raw = Buffer.from(source.cells, 'base64');
    for (let z = 0; z < source.height; z++) {
      for (let x = 0; x < source.width; x++) {
        const offset = (z * source.width + x) * 8;
        const expected = raw[offset + 4] > 1;
        const position = {x: Math.fround(source.minimum[0] + x * 12 + 6),
          z: Math.fround(source.minimum[2] + z * 12 + 6)};
        const cell = grid.sample(position.x, position.z)!;
        assert.equal(cell.x, x);
        assert.equal(cell.z, z);
        assert.equal(cell.fields, raw.readUInt32LE(offset + 4));
        assert.equal(cell.height, raw.readFloatLE(offset));
        assert.equal(cell.valid, expected);
        const center = grid.positionAtCell(x, z);
        if (expected) {
          assert.deepEqual(center, {...position, y: cell.height});
          valid++;
        } else {
          assert.equal(center, undefined);
        }
        cells++;
      }
    }
    assert.equal(grid.sample(source.minimum[0] - 6, source.minimum[2] + 6)!.x, 0,
      'Original truncation accepts a negative fraction as cell zero');
    assert.equal(grid.sample(source.minimum[0] - 13, source.minimum[2] + 6), undefined);
    assert.equal(grid.sample(source.minimum[0] + source.width * 12,
      source.minimum[2] + 6), undefined);
  }
}
assert.equal(cells, 1417662);

// High byte 1 alone is invalid; low byte 2 with another byte set is valid.
const bytes = Buffer.alloc(5 * 8);
for (const [index, fields] of [2, 3, 256, 258, 7].entries()) {
  bytes.writeFloatLE(10 + index, index * 8);
  bytes.writeUInt32LE(fields, index * 8 + 4);
}
const grid = new NavigationGrid({minimum: [0, 0, 0], maximum: [60, 0, 12],
  width: 5, height: 1, cells: bytes.toString('base64')});
assert.equal(grid.sample(30, 6)!.valid, false);
assert.equal(grid.sample(42, 6)!.valid, true);
const blocked = grid.firstInvalidFraction({x: 6, z: 6}, {x: 54, z: 6})!;
assert(Math.abs(blocked - (2 / Math.fround(1 / 12) - 6) / 48) < 1e-8);
assert.equal(grid.firstInvalidFraction({x: 30, z: 6}, {x: 54, z: 6}), 0);
assert.equal(grid.firstInvalidFraction({x: 6, z: 6}, {x: 18, z: 6}), undefined);

// The diagonal crosses an invalid cell for less than a unit. Fixed-distance
// samples can miss it, but the cell-boundary sweep must stop at its entry.
const cornerBytes = Buffer.alloc(4 * 8);
for (let index = 0; index < 4; index++) {
  cornerBytes.writeUInt32LE(index === 1 ? 0 : 7, index * 8 + 4);
}
const corner = new NavigationGrid({minimum: [0, 0, 0], maximum: [24, 0, 24],
  width: 2, height: 2, cells: cornerBytes.toString('base64')});
assert(corner.firstInvalidFraction({x: 6, z: 5.9}, {x: 18, z: 17.9}) !== undefined);
assert.equal(corner.firstInvalidFraction({x: 6, z: 6}, {x: 18, z: 18}), undefined);

// A rendered POL surface is insufficient: movement must stop at NAV void.
const field = getBattlefield(2);
const source = field.navigation.source;
let checkedVoid = false;
for (let z = 0; z < source.height && !checkedVoid; z++) {
  for (let x = 1; x < source.width && !checkedVoid; x++) {
    const start = field.navigation.positionAtCell(x - 1, z);
    const cell = field.navigation.cellAt(x, z)!;
    const end = {x: source.minimum[0] + x * 12 + 6, y: 0,
      z: source.minimum[2] + z * 12 + 6};
    if (!start || cell.valid || field.heightAt(end.x, end.z, start.y) === undefined) {
      continue;
    }
    const stopped = field.move(start, end, 20);
    assert(field.navigation.sample(stopped.x, stopped.z)!.valid);
    assert(stopped.x < source.minimum[0] + x * 12);
    assert.equal(stopped.y, field.navigation.sample(stopped.x, stopped.z)!.height);
    checkedVoid = true;
  }
}
assert(checkedVoid, 'Need an actual NAV void cell covered by visible terrain');
writeFileSync('recovery/output/navigation-runtime-verification.json', JSON.stringify({
  maps: fields.length, cells, validCenters: valid,
  sourceCellCenters: true, lowByteValidity: true, truncation: true,
  continuousVoidCrossing: true, shortCornerCrossing: true, visualTerrainVoid: checkedVoid,
}, null, 2));
console.log(`PASS: ${cells} source NAV cells, ${valid} valid centers, low-byte gating, truncation, continuous void/corner crossings and authoritative terrain exclusion`);
