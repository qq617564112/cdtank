/** Read ordinary authority events and the camera's actual view without changing state. */
export async function installCombatLocalHurtCameraObserver() {
  const source=await(await fetch('/src/render/scene-runtime.ts')).text();
  const url=source.match(/from \"([^\"]*@babylonjs_core.js[^\"]*)\"/)[1];
  const {EngineStore,Matrix}=await import(url);
  const scene=EngineStore.LastCreatedScene;
  window.hurtScene=scene;
  window.hurt={events:[],shakes:[],framesObserved:[],fourPartIds:[],roundClears:[]};
  const {Battle}=await import('/src/match/battle.ts'),reconcile=Battle.prototype.reconcile;
  Battle.prototype.reconcile=function(...args){window.hurtBattle=this;return reconcile.apply(this,args);};
  const {BattleSound}=await import('/src/audio/battle-sound.ts'),event=BattleSound.prototype.event;
  BattleSound.prototype.event=function(value,...args){if(['hit','destroy'].includes(value.type))window.hurt.events.push(value);return event.call(this,value,...args);};
  const {EffectRuntime}=await import('/src/render/effects/runtime/effect-runtime.ts');
  const ordinary=EffectRuntime.prototype.ordinaryHurtCamera;
  EffectRuntime.prototype.ordinaryHurtCamera=function(){const result=ordinary.call(this);const state=this.cameraShake.state;
    window.hurt.shakes.push({parameter:state.parameter,duration:state.duration,strength:state.strength,active:state.active,
      event:window.hurt.events.at(-1),world:JSON.parse(document.querySelector('#battle-status').dataset.world)});return result;};
  const clear=EffectRuntime.prototype.clearRoundEffects;
  EffectRuntime.prototype.clearRoundEffects=function(){const result=clear.call(this);window.hurt.roundClears.push({active:this.cameraShake.state.active,elapsed:this.cameraShake.state.elapsed});return result;};
  let frame=0,wasActive=false,restored=0;
  scene.onAfterRenderObservable.add(()=>{
    frame++;
    const battle=window.hurtBattle,raw=document.querySelector('#battle-status')?.dataset.world;
    if(!battle||!raw)return;
    const world=JSON.parse(raw),camera=scene.activeCamera,state=battle.effects.cameraShake.state;
    window.hurt.fourPartIds=[...battle.players.players].filter(([,v])=>!v.usesThreePartActor).map(([id])=>id);
    const actual=Array.from(camera.getViewMatrix().m);
    const base=Matrix.Identity();
    const target=camera.getTarget(),eye=camera.position,up=camera.upVector;
    if(scene.useRightHandedSystem)Matrix.LookAtRHToRef(eye,target,up,base);else Matrix.LookAtLHToRef(eye,target,up,base);
    const viewDifference=Math.max(...actual.map((v,i)=>Math.abs(v-base.m[i])));
    if(state.active||wasActive||frame%20===0){
      window.hurt.framesObserved.push({frame,tick:world.tick,phase:world.phase,active:state.active,elapsed:state.elapsed,
        actual,base:Array.from(base.m),viewDifference,worldPlayers:world.players.map(p=>({id:p.id,tankId:p.tankId,hp:p.hp,alive:p.alive})),
        pose:battle.effects.cameraShake.pose?JSON.parse(JSON.stringify(battle.effects.cameraShake.pose)):undefined,
        canvas:state.active&&window.hurt.framesObserved.filter(r=>r.active).length<2?scene.getEngine().getRenderingCanvas().toDataURL('image/png'):undefined});
    }
    if(wasActive&&!state.active)restored++;
    wasActive=state.active;
    window.hurt.restored=restored;
  });
}
