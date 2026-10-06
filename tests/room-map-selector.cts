import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {MAPS} from '../apps/server/src/config';
import {roomMapPage, roomMapPreviewReference} from '../apps/web/src/interface/lobby/room-map-options';
import {HomeSourceLayout} from '../apps/web/src/interface/resources/source-ui-layout';
import type {HomeSourceUi} from '../apps/web/src/interface/resources/source-ui-layout';
const ui = JSON.parse(readFileSync('recovery/output/web-assets/ui.json', 'utf8')) as HomeSourceUi;
const layout = new HomeSourceLayout(ui, 'selectgamemode.xml');
const element = () => ({style: {backgroundImage: ''}, dataset: {} as Record<string, string>}) as unknown as HTMLElement;
for (const name of ['rdoTeamMode', 'rdoConquerMode', 'rdoVIPMode', 'rdoMeleeMode', 'rdoDestroyMode']) {
  for (const property of ['NormalImage', 'HoverImage', 'PushedImage', 'CheckMarkImage']) {
    const image = element(); layout.picture(image, layout.control(name).properties[property]);
    assert(image.dataset.sourceAsset, `${name}:${property}`);
    assert(readFileSync(`recovery/output/web-assets/${image.dataset.sourceAsset}`).length > 0);
  }
}
for (const map of MAPS) {
  const image = element(); layout.picture(image, roomMapPreviewReference(map.mapId));
  assert(image.dataset.sourceAsset?.startsWith('ui/regions/76/'), `DDS preview ${map.mapId}`);
  assert(readFileSync(`recovery/output/web-assets/${image.dataset.sourceAsset}`).length > 0);
  const state = roomMapPage(MAPS, map.mode, 0, map.mapId);
  assert.equal(state.selected?.mapId, map.mapId);
  assert(state.maps.every(candidate => candidate.mode === map.mode));
}
const available = Array.from({length: 19}, (_, index) => ({...MAPS[0], mode: 1, mapId: index + 100}));
const directory = [...available, {...MAPS[0], mode: 2, mapId: 999}];
assert.deepEqual(roomMapPage(directory, 1, 1, 115).maps.map(map => map.mapId), [108,109,110,111,112,113,114,115]);
assert.equal(roomMapPage(directory, 1, 99, 118).page, 2);
assert.equal(roomMapPage(directory, 1, -1, 100).page, 0);
assert.equal(roomMapPage(directory, 1, NaN, 100).page, 0);
assert.equal(roomMapPage(directory, 1, 1, 999).selected, undefined);
assert.equal(roomMapPage(directory, 1, 1, 115).selected?.mapId, 115);
assert.deepEqual(roomMapPage(directory, 6, 9, 100), {page: 0, pages: 0, maps: [], selected: undefined});
assert.equal(roomMapPage(directory.slice(0, 4), 1, 2, 115).selected, undefined);
for (const id of [0, -1, 1.5, NaN, Infinity]) assert.equal(roomMapPreviewReference(id), undefined);
assert.equal(roomMapPreviewReference(7), 'set:xiaoditu0 image:data\\ui\\xiaoditu\\0007.tga');
console.log(`PASS: five original mode image states, ${MAPS.length} real mode/map previews, eight-slot filtered pagination and stale/empty selection refusal`);
