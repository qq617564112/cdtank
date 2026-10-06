// Original NAV/BOX route planning only; no gameplay state or camera mutation.
import {writeFileSync} from 'node:fs';
import {getBattlefield} from '../apps/server/src/battlefield';
import {createOriginalBotNavigation} from '../apps/server/src/battle/cpu/original-navigation';
import {findBotPath} from '../apps/server/src/battle/cpu/navigation';
const field=getBattlefield(18),nav=createOriginalBotNavigation(field);
const policy={...nav,cacheKey:nav.cacheKey+':box26',canTraverse:(a,b)=>nav.canTraverse(a,b)&&Math.hypot(field.move(a,b,26).x-b.x,field.move(a,b,26).z-b.z)<.01};
const targets=[{id:'68',x:-321.70135498046875,z:-1199.89501953125},{id:'66',x:272.762939453125,z:1267.0318603515625},{id:'67',x:-319.60919189453125,z:1269.3758544921875}];const rows=[];
for(const target of targets){
 for(const p of target.id==='68'?[{x:122.27,y:0,z:-766.81},{x:-176.55,y:0,z:-767.61}]:[{x:-180,y:0,z:838},{x:121,y:0,z:838}]){
  const candidates=[];
  for(let x=-950;x<=950;x+=100)for(let z=target.id==='68'?-900:0;z<=(target.id==='68'?100:1000);z+=100){
   const distance=Math.hypot(x-target.x,z-target.z);if(distance<760||distance>950)continue;
   const goal={x,y:0,z};if(!field.navigation.sample(x,z)?.valid)continue;
   const route=findBotPath(field,p,goal,policy);if(!route.length)continue;
   // Roof-level animation: verify source wall line from ordinary camera-height vicinity.
   const wall=field.firstBoxHit({x,y:65,z},{x:target.x,y:155,z:target.z},1);
   const length=route.reduce((s,q,i)=>s+Math.hypot(q.x-(i?route[i-1].x:p.x),q.z-(i?route[i-1].z:p.z)),0);
   candidates.push({goal,distance,length,wall:wall?.boxId,route});
  }
  candidates.sort((a,b)=>Number(!!a.wall)-Number(!!b.wall)||a.length-b.length);rows.push({target,start:p,candidates:candidates.slice(0,6)});
 }
}
writeFileSync('recovery/output/scene-animation-0018-viewpoints.json',JSON.stringify({scope:'Source navigation route planning, not browser visual or movement proof',rows},null,2)+'\n');console.log(JSON.stringify(rows));
