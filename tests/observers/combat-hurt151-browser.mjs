/** Observe ordinary hurt rendering without changing battle or animation state. */
export async function installCombatHurt151Observer() {
  const source=await(await fetch('/src/render/scene-runtime.ts')).text();
  const url=source.match(/from \"([^\"]*@babylonjs_core.js[^\"]*)\"/)[1];
  const {EngineStore}=await import(url),engine=EngineStore.LastCreatedEngine,scene=EngineStore.LastCreatedScene;
  window.hurtScene=scene;window.hurt={events:[],messages:[],hurts:[],draws:[],states:[],captures:[],frames:0};
  const actions=['05','06','07','08'];
  const {Battle}=await import('/src/match/battle.ts'),reconcile=Battle.prototype.reconcile;
  Battle.prototype.reconcile=function(...args){window.hurtBattle=this;return reconcile.apply(this,args);};
  const {BattleSound}=await import('/src/audio/battle-sound.ts'),event=BattleSound.prototype.event;
  BattleSound.prototype.event=function(value,...args){if(['fire','hit','destroy'].includes(value.type))window.hurt.events.push(value);return event.call(this,value,...args);};
  const {EffectRuntime}=await import('/src/render/effects/runtime/effect-runtime.ts'),message=EffectRuntime.prototype.message;
  EffectRuntime.prototype.message=function(view,value){const before=this.instances.length,voicesBefore=this.sound.voices.size,skillBefore=this.skillSound.voices.size;const result=message.call(this,view,value);
    if(view.tankId===151&&actions.includes(value.action))window.hurt.messages.push({owner:view.root.name,...value,before,after:this.instances.length,voicesBefore,voicesAfter:this.sound.voices.size,skillBefore,skillAfter:this.skillSound.voices.size});return result;};
  const {TankView}=await import('/src/assets/tanks/tank-view.ts'),hurt=TankView.prototype.hurt;
  TankView.prototype.hurt=function(selector){if(this.tankId===151)window.hurt.hurts.push({owner:this.root.name,selector,frame:window.hurt.frames,alive:this.alive});return hurt.call(this,selector);};
  const totals=new Map(),geometries=new Map();
  scene.onBeforeRenderObservable.add(()=>{for(const mesh of scene.meshes){if(mesh.hurt151Observed||!mesh.onBeforeRenderObservable)continue;mesh.hurt151Observed=true;mesh.onBeforeRenderObservable.add(()=>{
    const view=[...(window.hurtBattle?.players.players.values()??[])].find(v=>v.current?.assets.some(a=>a.meshes.includes(mesh)));
    if(!view||view.tankId!==151||!actions.includes(view.activeAction)||!mesh.getTotalVertices())return;
    const component=view.current.components.find(c=>c.assets.meshes.includes(mesh));if(!component)return;
    const key=view.root.name+':'+view.activeAction+':'+mesh.name,amount=totals.get(key)??0;
    if(amount>=30)return;totals.set(key,amount+1);
    const manager=mesh.morphTargetManager;
    if(!geometries.has(key))geometries.set(key,{positions:Array.from(mesh.getVerticesData('position')??[]),uvs:Array.from(mesh.getVerticesData('uv')??[]),indices:Array.from(mesh.getIndices()??[]),targets:manager?Array.from({length:manager.numTargets},(_,i)=>Array.from(manager.getTarget(i).getPositions()??[])):[]});
    const row={owner:view.root.name,action:view.activeAction,part:component.part,asset:component.action.asset,mesh:mesh.name,vertices:mesh.getTotalVertices(),frame:window.hurt.frames+1,clock:view.root.metadata.actionClocks?.find(c=>c.part===component.part),matrix:Array.from(mesh.getWorldMatrix().m),morphs:manager?Array.from({length:manager.numTargets},(_,i)=>manager.getTarget(i).influence):[],geometry:amount===0?geometries.get(key):undefined};
    window.hurt.draws.push(row);
  });}});
  const seen=new Map();scene.onAfterRenderObservable.add(()=>{window.hurt.frames++;
    const raw=document.querySelector('#battle-status')?.dataset.world;if(!raw||!window.hurtBattle)return;const world=JSON.parse(raw);
    for(const player of world.players.filter(p=>p.tankId===151&&!p.isCpu)){const view=window.hurtBattle.players.get(player.id);if(!view)continue;
      const clocks=view.root.metadata.actionClocks??[],key=player.alive+':'+view.activeAction+':'+clocks.map(c=>c.overMessage).join(',');
      if(seen.get(player.id)!==key){seen.set(player.id,key);window.hurt.states.push({id:player.id,frame:window.hurt.frames,action:view.activeAction,alive:player.alive,hp:player.hp,maxHp:player.maxHp,deaths:player.deaths,clocks});}
      const draws=window.hurt.draws.filter(d=>d.owner===view.root.name&&d.frame===window.hurt.frames);
      if(actions.includes(view.activeAction)&&new Set(draws.map(d=>d.part)).size===3&&!window.hurt.captures.some(c=>c.id===player.id&&c.action===view.activeAction))window.hurt.captures.push({id:player.id,action:view.activeAction,frame:window.hurt.frames,world,draws,camera:{view:Array.from(scene.activeCamera.getViewMatrix().m),projection:Array.from(scene.activeCamera.getProjectionMatrix().m),width:engine.getRenderWidth(),height:engine.getRenderHeight()},canvas:engine.getRenderingCanvas().toDataURL('image/png')});
    }
  });
}
