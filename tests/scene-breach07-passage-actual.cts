import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {getSceneBreakables} from '../apps/server/src/scene-objects';
import {segmentBox} from '../apps/server/src/battlefield';
const run=JSON.parse(readFileSync(process.argv[2],'utf8')),source=getSceneBreakables(7).find(o=>o.id==='50')!;
assert.equal(run.status,'PASS');assert(run.initial.every(w=>w.mode===1&&w.mapId===7&&w.players.length===4&&w.players.every(p=>!p.isCpu&&!p.isAutopilot)));
assert(run.auxiliaryPlayers.length===2&&run.entered&&run.exited);
const rows=run.routeInputs,phases=run.serverTrace.filter(t=>t.kind==='collisionPhase'&&t.targetId==='ENV:50'&&t.round===1);
assert.deepEqual(phases.map(p=>p.phase),['INTACT','FADING','RELEASED']);assert(phases[2].serverTime-phases[1].destroyedAt>2000);
for(const r of rows){const p={x:r.player.x,y:r.target.y,z:r.player.z};assert.equal(r.inside,segmentBox(p,p,source,0)!==undefined);assert(r.player.alive);}
assert(run.blocked.length===4&&run.blocked.every(r=>r.target.hp===200&&!r.inside));
assert(Math.hypot(run.blocked.at(-1).player.x-run.blocked[0].player.x,run.blocked.at(-1).player.z-run.blocked[0].player.z)<.2);
const holdingFade=rows.filter(r=>r.heldForward&&r.target.hp===0&&r.world===undefined&&r.tick<phases[2].tick);assert(holdingFade.length&&holdingFade.every(r=>!r.inside));
const entry=rows.find(r=>r.inside&&r.target.hp===0)!;assert(entry&&entry.tick>=phases[2].tick);
const exit=rows.find(r=>r.tick>entry.tick&&!r.inside&&r.player.z<source.matrix[14]-40)!;assert(exit);
assert(run.serverTrace.some(t=>t.kind==='actorEnteredClearedFootprint'&&t.targetId==='ENV:50'&&t.ordinaryPlayerInput&&t.playerId===entry.player.id));
assert(run.cleanup.every(r=>Object.values(r).every(v=>v===0)));assert(run.serverTrace.some(t=>t.kind==='roomLeaveCleanup'&&t.activeDynamicBoxes===0));
const output={status:'PASS',input:process.argv[2],blocked:run.blocked.map(r=>({tick:r.tick,x:r.player.x,z:r.player.z})),holdingFadeSamples:holdingFade.length,releasedTick:phases[2].tick,releaseDelayMs:phases[2].serverTime-phases[1].destroyedAt,entry:{tick:entry.tick,x:entry.player.x,z:entry.player.z},oppositeExit:{tick:exit.tick,x:exit.player.x,z:exit.player.z},playerId:entry.player.id,cleanup:run.cleanup};
writeFileSync('recovery/output/scene-breach07-passage-actual.json',JSON.stringify(output,null,2)+'\n');console.log('PASS: ordinary fourhuman nativeW blocked intact/fade, released original OBB entry and oppositeexit, Leave');
