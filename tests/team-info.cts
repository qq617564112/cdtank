import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {World} from '../apps/server/src/world';
import {teamInfo} from '../apps/web/src/interface/battle/team-info';
const world=new World();
const owner=world.createAndJoin('team-info-owner',1,7,'团队面板','Owner',1);
const guest=world.joinRoom(owner.roomId,'team-info-guest','Guest',1);
assert.equal(teamInfo(world.snapshot(owner.roomId)!,owner.playerId),undefined);
world.ready(owner.playerId,1);world.ready(guest.playerId,1);
const snapshot=world.snapshot(owner.roomId)!;
assert.equal(snapshot.phase,'PLAYING');
const original=JSON.stringify(snapshot);
const ownerTeam=snapshot.players.find(player=>player.id===owner.playerId)!.team;
const guestTeam=snapshot.players.find(player=>player.id===guest.playerId)!.team;
assert.notEqual(ownerTeam,guestTeam);
for(const counts of [[30,29],[0,1],[100,12]]) {
 const current={...snapshot,match:{...snapshot.match!,teamLives:counts}};
 assert.deepEqual(teamInfo(current,owner.playerId),{self:String(counts[ownerTeam]),enemy:String(counts[1-ownerTeam])});
 assert.deepEqual(teamInfo(current,guest.playerId),{self:String(counts[guestTeam]),enemy:String(counts[1-guestTeam])});
 assert.deepEqual(teamInfo({...current,phase:'FINISHED'},guest.playerId),teamInfo(current,guest.playerId));
}
for(const counts of [[],[1],[1,2,3],[-1,3],[1.5,3],[NaN,3],[Infinity,3]]) {
 assert.equal(teamInfo({...snapshot,match:{...snapshot.match!,teamLives:counts}},owner.playerId),undefined);
}
assert.equal(teamInfo(snapshot,'not-a-player'),undefined);
assert.equal(teamInfo({...snapshot,mode:2},owner.playerId),undefined);
assert.equal(teamInfo({...snapshot,match:undefined},owner.playerId),undefined);
assert.equal(JSON.stringify(snapshot),original);
writeFileSync('recovery/output/team-info-rules.json',JSON.stringify({status:'PASS',scope:'Rebuilt authoritative team-lives projection',oppositeTeams:[ownerTeam,guestTeam],phaseGate:true,invalidDataHidden:true,noSnapshotMutation:true},null,2));
console.log('PASS team info projection');
