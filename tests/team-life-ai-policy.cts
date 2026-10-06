import assert from 'node:assert/strict';
import {teamLifeHotkey, type TeamLifeContext} from '../apps/server/src/battle/cpu/items';
import {BotController} from '../apps/server/src/battle/cpu/controller';
import {getBattlefield} from '../apps/server/src/battlefield';
const actor = {alive: true, hp: 300, maxHp: 300, id: 'bot', team: 0, x: 182.31, y: .32,
  z: 420.93, yaw: 10.7259, aim: 0, vip: false, tank: {speed: 30, turn: 100},
  inventory: [{instanceId: 77, itemTableId: 501, ownedQuantity: 2, battleQuantity: 2},
    {instanceId: 88, itemTableId: 1, ownedQuantity: 2, battleQuantity: 2},
    {instanceId: 99, itemTableId: 8, ownedQuantity: 2, battleQuantity: 2}],
  combat: {status: 2, record: {arrays: new Map([[0, Int32Array.from([0, 0, 0, 77, 88, 99, 0])], [4, new Int32Array(16)]])}}};
const context: TeamLifeContext = {mode: 1, team: 0, initialLives: 30, lives: [29, 30]};
assert.equal(teamLifeHotkey(actor, context), 5);
for (const changed of [undefined, {...context, mode: 2}, {...context, mode: 4}, {...context, team: -1},
  {...context, lives: [30, 30]}, {...context, lives: [31, 30]}, {...context, lives: [29, 0]},
  {...context, lives: [0, 30]}, {...context, lives: [29.5, 30]}, {...context, initialLives: 0}]) {
  assert.equal(teamLifeHotkey(actor, changed), 0);
}
assert.equal(teamLifeHotkey({...actor, alive: false}, context), 0);
assert.equal(teamLifeHotkey({...actor, combat: {...actor.combat, status: 3}}, context), 0);
assert.equal(teamLifeHotkey({...actor, inventory: [{...actor.inventory[0], ownedQuantity: 0}]}, context), 0);
assert.equal(teamLifeHotkey({...actor, inventory: [{...actor.inventory[0], battleQuantity: 0}]}, context), 0);
assert.equal(teamLifeHotkey({...actor, inventory: [{...actor.inventory[0], instanceId: 100}]}, context), 0);
assert.equal(teamLifeHotkey({...actor, inventory: [{...actor.inventory[0], instanceId: 0}]}, context), 0);
const enemy = {...actor, id: 'enemy', team: 1, x: 362, z: 425};
const decide = (hp: number, state = context) => {
  const controller = new BotController();
  controller.input({...actor, hp}, [enemy], [], getBattlefield(7), state.mode, 100000, .05, state);
  return controller.input({...actor, hp}, [enemy], [], getBattlefield(7), state.mode, 100050, .05, state).useItem;
};
assert.equal(decide(80), 6, 'Natural healing decision retains priority');
assert.equal(decide(150), 7, 'Nearby threat immunity retains priority');
assert.equal(decide(300), 5, 'Lost team life requests the ordinary configured 1UP slot');
assert.equal(decide(300, {...context, lives: [30, 30]}), 0);
assert.equal(decide(300, {...context, mode: 4}), 0);
context.lives = [30, 30];
assert.equal(teamLifeHotkey(actor, context), 0, 'Next controller sees an already replenished team and saves stock');
console.log('PASS: 1UP AI qualifications, finite assigned stock, restoration threshold and ordinary controller priorities');
