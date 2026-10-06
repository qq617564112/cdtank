import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {createRoomBattlefield} from '../apps/server/src/battlefield';
import {createOriginalBotNavigation} from '../apps/server/src/battle/cpu/original-navigation';
import {findBotPath} from '../apps/server/src/battle/cpu/navigation';
const entry = JSON.parse(readFileSync('recovery/output/web-assets/scene-placements.json','utf8')).find((s: {id: string})=>s.id==='0002');
const target = entry.records.find((s: {id: string})=>s.id==='325');
assert.equal(target.className,'SYcScnObjPlant');
const start={x:-1779.89,y:0,z:525.64};
const goal={x:target.matrix[12],y:target.position[1],z:target.matrix[14]};
const field=createRoomBattlefield(2);
const route=findBotPath(field,start,goal,createOriginalBotNavigation(field));
writeFileSync('recovery/output/scene-plant02-325-contact-entry-prepared.json',JSON.stringify({
  sourcePlacementId:'325',start,goal,route,
  scope:'Single new ordinary contact NAV candidate; no player reachability, pixel or contact claim; original Plant327 routes not repeated',
},null,2)+'\n');
console.log('PREPARED_SOURCE325_CONTACT_NAV '+route.length);
