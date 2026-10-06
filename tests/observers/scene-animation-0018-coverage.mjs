/** Record real scene-animation geometry and camera frames. */
export async function installSceneAnimation0018CoverageObserver(targetIds){

      const source=await(await fetch('/src/render/scene-runtime.ts')).text();const url=source.match(/from \"([^\"]*@babylonjs_core.js[^\"]*)\"/)[1];
      const {EngineStore,Vector3,Matrix,Viewport}=await import(url),engine=EngineStore.LastCreatedEngine,scene=EngineStore.LastCreatedScene;
      engine.setHardwareScalingLevel(1);engine.resize();window.breachScene=scene;
      window.breach={frames:0,draws:[],counts:{},captures:[],worlds:[],targets:targetIds};
      const {Battle}=await import('/src/match/battle.ts'),reconcile=Battle.prototype.reconcile;
      Battle.prototype.reconcile=function(...args){window.breachBattle=this;return reconcile.apply(this,args);};
      const observe=mesh=>{mesh.onBeforeRenderObservable.add(()=>{
        if(window.breach.phase!=='PLAYING')return;
        if(!['66','67','68','69'].includes(mesh.metadata?.sourcePlacementId)||!mesh.metadata?.sourceSceneModel)return;
        const animation=window.breachBattle.battlefield.animations.find(a=>a.placementId===mesh.metadata.sourcePlacementId),node=mesh.metadata.sourceSceneModelNode;
        if(!animation)return;
        const renderer=animation.renderer,clock=renderer.animations[node];
        const row={phase:window.breach.phase,id:animation.placementId,node,frame:window.breach.frames+1,positions:Array.from(mesh.getVerticesData('position')??[]),uvs:Array.from(mesh.getVerticesData('uv')??[]),indices:Array.from(mesh.getIndices()??[]),texture:mesh.material.getActiveTextures().map(t=>t.url),worldMatrix:Array.from(mesh.getWorldMatrix().m),placementMatrix:animation.matrix,
          clocks:renderer.animations.map(c=>c?{time:c.time,loops:c.loops,matrix:c.matrix,rate:c.rate}:null),source:mesh.metadata.sourceSceneModel};
        window.breach.counts[animation.placementId+':'+node]=(window.breach.counts[animation.placementId+':'+node]??0)+1;
        const old=window.breach.draws.filter(d=>d.node===node&&d.id===animation.placementId);
        if(old.length<6&&(!old.length||row.clocks[node].time!==old[old.length-1].clocks[node].time))window.breach.draws.push(row);
        window.breach.current??=[];window.breach.current.push(row);
      });};scene.onBeforeRenderObservable.add(()=>{const raw=document.querySelector('#battle-status')?.dataset.world;window.breach.phase=raw?JSON.parse(raw).phase:undefined;});scene.meshes.forEach(observe);scene.onNewMeshAddedObservable.add(observe);
      scene.onAfterRenderObservable.add(()=>{
        window.breach.frames++;
        const raw=document.querySelector('#battle-status')?.dataset.world;if(raw&&window.breach.frames%20===0){const world=JSON.parse(raw);window.breach.worlds.push({frame:window.breach.frames,world});}
        for(const id of ['66','67','68','69'])if(new Set((window.breach.current??[]).filter(r=>r.id===id).map(r=>r.node)).size===5&&!window.breach.captures.some(c=>c.id===id)&&(()=>{const w=JSON.parse(raw||'null');if(w?.phase!=='PLAYING'||w.tick<20||!window.breach.targets.includes(id))return false;
          const transform=scene.activeCamera.getViewMatrix().multiply(scene.activeCamera.getProjectionMatrix()),viewport=new Viewport(0,0,engine.getRenderWidth(),engine.getRenderHeight());
          const points=window.breach.current.filter(r=>r.id===id).flatMap(r=>{const points=[];for(let i=0;i<r.positions.length;i+=3)points.push(Vector3.Project(new Vector3(...r.positions.slice(i,i+3)),Matrix.Identity(),transform,viewport));return points;});
          const x=points.map(p=>p.x),y=points.map(p=>p.y),z=points.map(p=>p.z);
          return Math.min(...x)>=0&&Math.max(...x)<=viewport.width&&Math.min(...y)>=0&&Math.max(...y)<=viewport.height&&Math.max(...x)-Math.min(...x)>=30&&Math.max(...y)-Math.min(...y)>=20&&Math.min(...z)>0&&Math.max(...z)<1;
        })()){
          const world=JSON.parse(raw);window.breach.captures.push({id,frame:window.breach.frames,world,draws:window.breach.current.filter(r=>r.id===id),camera:{view:Array.from(scene.activeCamera.getViewMatrix().m),projection:Array.from(scene.activeCamera.getProjectionMatrix().m),position:scene.activeCamera.globalPosition.asArray(),target:scene.activeCamera.getTarget().asArray(),width:engine.getRenderWidth(),height:engine.getRenderHeight()},canvas:engine.getRenderingCanvas().toDataURL('image/png')});
        }
        if(window.breach.frames%20===0){window.breach.diagnostics=targetIds.map(id=>{const meshes=scene.meshes.filter(m=>m.metadata?.sourcePlacementId===id&&m.metadata?.sourceSceneModel),transform=scene.activeCamera.getViewMatrix().multiply(scene.activeCamera.getProjectionMatrix()),viewport=new Viewport(0,0,engine.getRenderWidth(),engine.getRenderHeight());const points=meshes.flatMap(m=>{const p=m.getVerticesData('position')??[],points=[];for(let i=0;i<p.length;i+=3)points.push(Vector3.Project(new Vector3(...p.slice(i,i+3)),Matrix.Identity(),transform,viewport));return points;});return {id,frame:window.breach.frames,nodes:meshes.map(m=>m.metadata.sourceSceneModelNode),bounds:points.length?{minX:Math.min(...points.map(p=>p.x)),maxX:Math.max(...points.map(p=>p.x)),minY:Math.min(...points.map(p=>p.y)),maxY:Math.max(...points.map(p=>p.y)),minDepth:Math.min(...points.map(p=>p.z)),maxDepth:Math.max(...points.map(p=>p.z))}:null,camera:{view:Array.from(scene.activeCamera.getViewMatrix().m),projection:Array.from(scene.activeCamera.getProjectionMatrix().m)},canvas:engine.getRenderingCanvas().toDataURL('image/png')};});}
        window.breach.current=[];
      });

}
