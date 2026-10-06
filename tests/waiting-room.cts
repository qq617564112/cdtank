import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {waitingRoomSlots, waitingTankReference} from '../apps/web/src/interface/lobby/waiting-room-state';
import {HomeSourceLayout} from '../apps/web/src/interface/resources/source-ui-layout';
import type {HomeSourceUi} from '../apps/web/src/interface/resources/source-ui-layout';
import type {MsgRoomSnapshot} from '../apps/shared/protocols';
import {TANKS} from '../apps/server/src/config';
const ui = JSON.parse(readFileSync('recovery/output/web-assets/ui.json', 'utf8')) as HomeSourceUi;
const layout = new HomeSourceLayout(ui, 'room_main.xml');
const element = () => ({style: {backgroundImage: ''}, dataset: {} as Record<string, string>}) as unknown as HTMLElement;
for (let slot = 0; slot < 12; slot++) {
  for (const name of [`PlayerPanel${slot}`, `picReady${slot}`, `picNA${slot}`]) {
    const image = element(); layout.picture(image, layout.control(name).properties.Image);
    assert(image.dataset.sourceAsset, name);
    assert(readFileSync(`recovery/output/web-assets/${image.dataset.sourceAsset}`).length > 0);
  }
}
for (const name of ['btnReady', 'btnCancel', 'btnCatTeam', 'btnDogTeam', 'btnClose']) {
  for (const property of ['NormalImage', 'HoverImage', 'PushedImage']) {
    const reference = layout.control(name).properties[property];
    if (!reference) continue;
    const image = element(); layout.picture(image, reference);
    assert(image.dataset.sourceAsset, `${name}:${property}`);
  }
}
for (const tank of TANKS) {
  const image = element(); layout.picture(image, waitingTankReference(tank.id));
  assert(image.dataset.sourceAsset?.startsWith('ui/regions/73/'), `tank ${tank.id}`);
  assert(readFileSync(`recovery/output/web-assets/${image.dataset.sourceAsset}`).length > 0);
}
const players = Array.from({length: 15}, (_, index) => ({id: `P${index}`, team: index % 2})) as MsgRoomSnapshot['players'];
const snapshot = {mode: 1, players} as MsgRoomSnapshot;
const before = JSON.stringify(snapshot);
const grouped = waitingRoomSlots(snapshot);
assert.deepEqual(grouped.slots.slice(0, 6).map(player => player?.id), ['P0','P2','P4','P6','P8','P10']);
assert.deepEqual(grouped.slots.slice(6).map(player => player?.id), ['P1','P3','P5','P7','P9','P11']);
assert.deepEqual(grouped.overflow.map(player => player.id), ['P12','P13','P14']);
assert.equal(JSON.stringify(snapshot), before);
const personal = waitingRoomSlots({...snapshot, mode: 4});
assert.deepEqual(personal.slots.map(player => player?.id), players.slice(0,12).map(player => player.id));
assert.equal(personal.overflow.length, 3);
const changed = waitingRoomSlots({...snapshot, players: [{...players[0], team: 1}]});
assert.equal(changed.slots[0], undefined);
assert.equal(changed.slots[6]?.id, 'P0');
assert(waitingRoomSlots({...snapshot, players: []}).slots.every(player => player === undefined));
for (const id of [0,-1,1.5,NaN,Infinity]) assert.equal(waitingTankReference(id), undefined);
assert.equal(waitingTankReference(1), 'set:tanke0 image:data\\ui\\tanke\\001.tga');
console.log('PASS: twelve source player/ready/empty images, five ordinary button states, 21 tank icons, rebuilt grouped/personal slots and explicit overflow without mutation');
