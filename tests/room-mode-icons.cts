import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {roomModeIconReference} from '../apps/web/src/interface/lobby/room-mode-icons';
import {HomeSourceLayout} from '../apps/web/src/interface/resources/source-ui-layout';
import type {HomeSourceUi} from '../apps/web/src/interface/resources/source-ui-layout';
const ui = JSON.parse(readFileSync('recovery/output/web-assets/ui.json', 'utf8')) as HomeSourceUi;
const layout = new HomeSourceLayout(ui, 'roomlist_icon.xml');
const expected = ['ui/regions/60/80.png', 'ui/regions/60/79.png', 'ui/regions/60/83.png', 'ui/regions/60/82.png', 'ui/regions/60/81.png'];
for (let mode = 1; mode <= 5; mode++) {
  const element = {style: {backgroundImage: ''}, dataset: {} as Record<string, string>} as unknown as HTMLElement;
  layout.picture(element, roomModeIconReference(mode));
  assert.equal(element.dataset.sourceAsset, expected[mode - 1]);
  assert(readFileSync(`recovery/output/web-assets/${element.dataset.sourceAsset}`).length > 0);
}
for (const mode of [0, 6, -1, 1.5, NaN, Infinity]) assert.equal(roomModeIconReference(mode), undefined);
console.log('PASS: five known Web modes resolve exact original raw0..4 DDS regions; unknown modes never guess an image');
