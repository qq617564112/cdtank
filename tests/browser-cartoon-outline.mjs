import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const WebSocket = createRequire(import.meta.url)('ws');
const browser = await (await fetch('http://127.0.0.1:9368/json/version')).json();
const ws = new WebSocket(browser.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {ws.once('open', resolve);ws.once('error', reject);});
let id = 0;
const pending = new Map();
ws.on('message', raw => {const message=JSON.parse(String(raw));const task=pending.get(message.id);if(task){pending.delete(message.id);message.error?task.reject(message.error):task.resolve(message.result);}});
const call=(method,params={},sessionId)=>new Promise((resolve,reject)=>{const request=++id;pending.set(request,{resolve,reject});ws.send(JSON.stringify({id:request,method,params,sessionId}));});
let targetId;
try {
  ({targetId}=await call('Target.createTarget',{url:'http://127.0.0.1:5298/'}));
  const {sessionId}=await call('Target.attachToTarget',{targetId,flatten:true});
  await call('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false},sessionId);
  const evaluate=async expression=>{const response=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true},sessionId);if(response.exceptionDetails)throw new Error(JSON.stringify(response.exceptionDetails));return response.result.value;};
  await new Promise(resolve=>setTimeout(resolve,1500));
  const setup=await evaluate(`(async()=>{
    const source=await(await fetch('/src/main.ts')).text();
    const url=source.match(/from "([^\"]*@babylonjs_core.js[^\"]*)"/)[1];
    const B=await import(url);B.EngineStore.LastCreatedEngine?.stopRenderLoop();
    const {TankView}=await import('/src/assets/tanks/tank-view.ts');
    const {ScenePreview}=await import('/src/assets/scenes/scene-preview.ts');
    const canvas=document.createElement('canvas');canvas.width=1920;canvas.height=1080;
    canvas.style.cssText='position:fixed;inset:0;width:1920px;height:1080px;z-index:99999';document.body.append(canvas);
    const engine=new B.Engine(canvas,true,{preserveDrawingBuffer:true},false);
    const scene=new B.Scene(engine);scene.ambientColor=B.Color3.White();scene.clearColor=new B.Color4(.25,.36,.44,1);
    const light=new B.HemisphericLight('sky',new B.Vector3(0,1,0),scene);light.intensity=1.2;light.groundColor=new B.Color3(.35,.35,.35);
    const camera=new B.ArcRotateCamera('camera',-Math.PI/2,Math.PI/3,700,B.Vector3.Zero(),scene);camera.minZ=.1;camera.maxZ=100000;
    const preview=new ScenePreview(scene,camera);await preview.load('0007');const terrainMeshes=preview.assets[0].meshes.filter(m=>m.getTotalVertices()>0);if(terrainMeshes.some(m=>m.renderOutline))throw new Error('Continuous terrain must not render primitive outlines');camera.radius=700;camera.target.y=20;
    const renderer=scene.getOutlineRenderer();let tank;const renders=[];
    const original=renderer.render.bind(renderer);
    renderer.render=function(submesh,...args){renders.push({name:submesh.getRenderingMesh().name,pass:args[2],morph:!!submesh.getRenderingMesh().morphTargetManager});return original(submesh,...args);};
    async function render(){await scene.whenReadyAsync();for(let frame=0;frame<6;frame++){scene.render();await new Promise(r=>setTimeout(r,50));}engine._gl.finish();}
    function pixels(){const bytes=new Uint8Array(1920*1080*4);const gl=engine._gl;gl.readPixels(0,0,1920,1080,gl.RGBA,gl.UNSIGNED_BYTE,bytes);return bytes;}
    let before;
    window.outlineTest={async baseline(){renderer.enabled=false;await render();before=pixels();return {meshes:scene.meshes.length,materials:scene.materials.length};},async outlined(){renders.length=0;renderer.enabled=true;await render();const after=pixels();let changed=0,blackEdges=0;for(let i=0;i<before.length;i+=4){const delta=Math.abs(after[i]-before[i])+Math.abs(after[i+1]-before[i+1])+Math.abs(after[i+2]-before[i+2]);if(delta>10){changed++;if(after[i]+after[i+1]+after[i+2]<30&&before[i]+before[i+1]+before[i+2]>60)blackEdges++;}}return {changed,blackEdges,renders:[...renders],meshes:scene.meshes.length,materials:scene.materials.length};},async addTank(){camera.target.x+=300;camera.radius=400;tank=await TankView.load(scene,'outline-tank',1);tank.position(-camera.target.x,0,camera.target.z);return {outlined:scene.meshes.filter(m=>(()=>{for(let node=m.parent;node;node=node.parent){if(node.name==='outline-tank')return true;}return false;})()&&m.getTotalVertices()>0).map(m=>({name:m.name,enabled:m.isEnabled(),outline:m.renderOutline,width:m.outlineWidth,black:m.outlineColor.asArray(),normal:m.isVerticesDataPresent('normal'),morph:!!m.morphTargetManager}))};},async action(name){await tank.activate(name,true);await render();return {name,active:tank.activeAction,enabled:scene.meshes.filter(m=>(()=>{for(let node=m.parent;node;node=node.parent){if(node.name==='outline-tank')return true;}return false;})()&&m.isEnabled()&&m.getTotalVertices()>0).map(m=>({name:m.name,outline:m.renderOutline,width:m.outlineWidth}))};},async clear(){tank?.dispose();preview.clear();await new Promise(r=>setTimeout(r,200));const remaining={meshes:scene.meshes.length,materials:scene.materials.length,textures:scene.textures.length};scene.dispose();engine.dispose();return remaining;}};
    return {terrain:{meshes:terrainMeshes.length,outlined:terrainMeshes.filter(m=>m.renderOutline).length},canvas:[engine.getRenderWidth(),engine.getRenderHeight()],scope:'Original map0007/actual TankView1, fixed-view outline toggle framebuffers, no network or performance claim.'};
  })()`);
  const screenshot=async name=>{const shot=await call('Page.captureScreenshot',{format:'png'},sessionId);await writeFile(`recovery/output/cartoon-outline-${name}.png`,Buffer.from(shot.data,'base64'));};
  const cases=[];
  for(const name of ['map','tank']){
    let tank;if(name==='tank')tank=await evaluate('outlineTest.addTank()');
    const baseline=await evaluate('outlineTest.baseline()');await screenshot(`${name}-before`);
    const outlined=await evaluate('outlineTest.outlined()');await screenshot(`${name}-after`);
    assert(outlined.blackEdges>100,`${name} must draw actual black edge pixels`);
    assert.equal(outlined.meshes,baseline.meshes);assert.equal(outlined.materials,baseline.materials);
    assert(outlined.renders.length>0);
    if(tank)assert(tank.outlined.length>0&&tank.outlined.every(mesh=>mesh.outline&&mesh.width===.65&&mesh.black.every(c=>c===0)&&mesh.normal));
    cases.push({name,baseline,outlined,tank});
  }
  const actions=[];
  for(const action of ['02','03','09','01']){
    const result=await evaluate(`outlineTest.action('${action}')`);
    assert(result.enabled.length>0&&result.enabled.every(mesh=>mesh.outline&&mesh.width===.65));
    actions.push(result);
  }
  const cleanup=await evaluate('outlineTest.clear()');
  assert.equal(cleanup.meshes,0);assert.equal(cleanup.materials,0);
  const evidence={status:'PASS',setup,cases,actions,cleanup};
  await writeFile('recovery/output/cartoon-outline-browser.json',JSON.stringify(evidence,null,2)+'\n');
  console.log(JSON.stringify({status:evidence.status,cases:cases.map(c=>({name:c.name,changed:c.outlined.changed,blackEdges:c.outlined.blackEdges})),actions:actions.map(a=>a.name),cleanup}));
} finally {if(targetId)await call('Target.closeTarget',{targetId});ws.close();}
