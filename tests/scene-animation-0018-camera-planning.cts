// Offline original-camera planning from recorded geometry; not browser visual evidence.
import {readFileSync} from 'node:fs';
import {Matrix,Vector3,Viewport} from '@babylonjs/core';
import {originalBattleCameraPose,originalActorCameraHeading} from '../apps/web/src/render/battle-camera';
const j=JSON.parse(readFileSync('recovery/output/browser-scene-animation-0018-coverage-2026-10-04T05-23-09-540Z.json','utf8'));
const ds=j.observed[0].draws.filter(d=>d.id==='68');const positions=ds.filter((d,i)=>ds.findIndex(q=>q.node===d.node)===i).flatMap(d=>d.positions);
for (const distance of [340,440,540,640,740]) {
 const p=[-321.70135498046875,0,-1199.89501953125+distance] as const;
 const pose=originalBattleCameraPose(p,originalActorCameraHeading(Math.PI));
 const view=Matrix.LookAtLH(new Vector3(-pose.eye[0],pose.eye[1],pose.eye[2]),new Vector3(-pose.target[0],pose.target[1],pose.target[2]),new Vector3(-pose.up[0],pose.up[1],pose.up[2]));
 const vfov=2*Math.atan(Math.tan(Math.PI/6)/(1280/720));const projection=Matrix.PerspectiveFovLH(vfov,1280/720,10,5000);
 const pts=[];for(let i=0;i<positions.length;i+=3)pts.push(Vector3.Project(new Vector3(...positions.slice(i,i+3)),Matrix.Identity(),view.multiply(projection),new Viewport(0,0,1280,720)));
 console.log(distance,{minX:Math.min(...pts.map(p=>p.x)),maxX:Math.max(...pts.map(p=>p.x)),minY:Math.min(...pts.map(p=>p.y)),maxY:Math.max(...pts.map(p=>p.y))});
}
