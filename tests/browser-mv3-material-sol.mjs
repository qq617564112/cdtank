import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const WebSocket=createRequire(import.meta.url)('ws');
const endpoint=process.argv[2];
assert(endpoint,'Usage: node tests/browser-mv3-material-sol.mjs <CDP WebSocket URL> [web origin]');
const ws=new WebSocket(endpoint);
await new Promise((resolve,reject)=>{ws.once('open',resolve);ws.once('error',reject);});
let sequence=0;const pending=new Map();
ws.on('message',raw=>{const response=JSON.parse(String(raw));const callback=pending.get(response.id);
 if(!callback)return;pending.delete(response.id);response.error?callback.reject(new Error(JSON.stringify(response.error))):callback.resolve(response.result);});
function command(method,params={},sessionId){return new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params,sessionId}));});}
async function evaluate(session,expression){const result=await command('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true},session);
 if(result.exceptionDetails)throw new Error(JSON.stringify(result.exceptionDetails));return result.result.value;}
let targetId;
try{
 ({targetId}=await command('Target.createTarget',{url:process.argv[3] ?? 'http://127.0.0.1:5173'}));
 const {sessionId}=await command('Target.attachToTarget',{targetId,flatten:true});
 let result;
 for(let attempt=0;attempt<60;attempt++){
  try{result=await evaluate(sessionId,`(async()=>{
   const response=await fetch('/src/main.ts');const source=await response.text();
   const module=source.match(/from "([^"]*@babylonjs_core.js[^"]*)"/)[1];
   const {Engine,Scene,FreeCamera,Vector3,Color4,Mesh,VertexData,RawTexture,Texture,MorphTarget,MorphTargetManager,Material}=await import(module);
   const {createMv3Material}=await import('/src/render/materials/mv3-material.ts');
   const canvas=document.createElement('canvas');canvas.width=128;canvas.height=128;document.body.append(canvas);
   const engine=new Engine(canvas,false,{preserveDrawingBuffer:true,premultipliedAlpha:false},false);
   const scene=new Scene(engine);scene.clearColor=new Color4(0,0,0,1);
   const camera=new FreeCamera('pixel-camera',new Vector3(0,0,-3),scene);camera.setTarget(Vector3.Zero());
   camera.mode=1;camera.orthoLeft=-2;camera.orthoRight=2;camera.orthoTop=2;camera.orthoBottom=-2;
   const mesh=new Mesh('source-front-quad',scene),data=new VertexData();
   data.positions=[-1,-1,0,1,-1,0,1,1,0,-1,1,0];data.uvs=[0,0,1,0,1,1,0,1];data.indices=[0,1,2,0,2,3];data.applyToMesh(mesh);
   const properties=[1,1,1,1,1,1,1,1,0,0,0,1,1,1,1,1,12.8];
   const gl=engine._gl;const rows=[];let material,texture;
   const pixel=(x,y)=>{const values=new Uint8Array(4);gl.readPixels(x,y,1,1,gl.RGBA,gl.UNSIGNED_BYTE,values);return [...values];};
   function check(actual,expected,label){const error=Math.max(...actual.map((v,i)=>Math.abs(v-expected[i])));if(error>2)throw new Error(label+' '+JSON.stringify({actual,expected}));return error;}
   async function draw(p,bytes,width,height,opacity=1){material?.dispose();texture?.dispose();
    texture=bytes?RawTexture.CreateRGBATexture(new Uint8Array(bytes),width,height,scene,false,false,Texture.NEAREST_SAMPLINGMODE):undefined;
    material=createMv3Material(scene,p,texture,opacity);mesh.material=material;
    await material.forceCompilationAsync(mesh);scene.render();gl.finish();
    if(gl.getError()!==gl.NO_ERROR)throw new Error('WebGL error');}
   try{
    const p=[...properties];p[4]=.5;p[5]=.75;p[6]=1;
    await draw(p);const actual=pixel(64,64),expected=[26,38,51,255];check(actual,expected,'ambient RGB');
    mesh.sideOrientation=Material.ClockWiseSideOrientation;mesh.scaling.z=-1;scene.render();gl.finish();
    const reflected=pixel(64,64);check(reflected,expected,'GLB reflected front');
    const originalIndices=mesh.getIndices();mesh.setIndices([0,2,1,0,3,2]);scene.render();gl.finish();const culled=pixel(64,64);check(culled,[0,0,0,255],'GLB reflected back cull');mesh.setIndices(originalIndices);scene.render();
    rows.push({case:'ambient-no-texture',actual,expected,reflected,culled,backFaceCulling:material.backFaceCulling,meshSideOrientation:mesh.sideOrientation,reflectionZ:mesh.scaling.z});
    await draw(properties,[255,0,0,255,0,255,0,255,0,0,255,255,255,255,255,255],2,2);
    const samples=[[48,48,[51,0,0,255]],[80,48,[0,51,0,255]],[48,80,[0,0,51,255]],[80,80,[51,51,51,255]]];
    rows.push({case:'texture-uv-quadrants',samples:samples.map(([x,y,expected])=>{const actual=pixel(x,y);check(actual,expected,'UV '+x+','+y);return {x,y,actual,expected};}),invertY:texture.invertY});
    const oldBinding=gl.getParameter(gl.TEXTURE_BINDING_2D);
    gl.bindTexture(gl.TEXTURE_2D,texture.getInternalTexture()._hardwareTexture.underlyingResource);
    const sampler={min:gl.getTexParameter(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER),mag:gl.getTexParameter(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER),
      wrapU:gl.getTexParameter(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S),wrapV:gl.getTexParameter(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T)};
    gl.bindTexture(gl.TEXTURE_2D,oldBinding);
    if(sampler.min!==gl.LINEAR||sampler.mag!==gl.LINEAR||sampler.wrapU!==gl.REPEAT||sampler.wrapV!==gl.REPEAT)
      throw new Error('Original texture sampler '+JSON.stringify(sampler));
    const interpolated=pixel(64,64);check(interpolated,[26,26,26,255],'bilinear center');
    const originalUV=mesh.getVerticesData('uv');mesh.setVerticesData('uv',originalUV.map((v,i)=>i%2===0?v+1:v-1));
    scene.render();gl.finish();const repeated=pixel(64,64);check(repeated,interpolated,'repeat U/V');
    mesh.setVerticesData('uv',originalUV);scene.render();
    rows.push({case:'original-linear-wrap-sampler',sampler,interpolated,repeated});
    await draw(properties,[255,255,255,200],1,1,.5);const threshold=pixel(64,64);check(threshold,[0,0,0,255],'alpha=100 discard');
    rows.push({case:'geom_t-alpha-equal100',actual:threshold,expected:[0,0,0,255]});
    await draw(properties,[255,255,255,202],1,1,.5);const passed=pixel(64,64),passExpected=[20,20,20,255];check(passed,passExpected,'alpha=101 blend');
    rows.push({case:'geom_t-alpha101',actual:passed,expected:passExpected,script:material.metadata.originalMV3.script});
    await draw(properties);const manager=new MorphTargetManager(scene),target=new MorphTarget('position-shift',0,scene);
    target.setPositions(new Float32Array(data.positions.map((v,i)=>i%3===0?v+1.5:v)));manager.addTarget(target);mesh.morphTargetManager=manager;
    await material.forceCompilationAsync(mesh);scene.render();const before=pixel(48,64);target.influence=1;scene.render();gl.finish();const after=pixel(48,64),shifted=pixel(92,64);
    check(before,[51,51,51,255],'morph baseline');check(after,[0,0,0,255],'morph moved out');check(shifted,[51,51,51,255],'morph moved in');
    rows.push({case:'position-morph',before,after,shifted,defines:mesh.subMeshes[0].effect.defines});
    return {rows,width:engine.getRenderWidth(),height:engine.getRenderHeight(),renderer:gl.getParameter(gl.RENDERER),vendor:gl.getParameter(gl.VENDOR),version:gl.getParameter(gl.VERSION),readback:'WebGL framebuffer gl.readPixels',sourceScope:'newgeom/geom_t explicit ambient-only fixture; original D3D framebuffer not executed'};
   }finally{scene.dispose();engine.dispose();canvas.remove();}
  })()`);break;}catch(error){
   if(attempt===59||!String(error).match(/navigated|context.*destroyed|Cannot read properties of null/))throw error;
   await new Promise(resolve=>setTimeout(resolve,100));
  }
 }
 await writeFile('recovery/output/browser-mv3-material-sol.json',JSON.stringify(result,null,2)+'\n');
 console.log('PASS: original LINEAR/WRAP WebGL sampler and bilinear/repeat pixels, 4 color/alpha fixtures + 1 position morph');
}finally{if(targetId)await command('Target.closeTarget',{targetId}).catch(()=>{});ws.close();}
