/** Read ordinary authority events and the camera's actual view without changing state. */
export async function installCombatLocalFireCameraObserver() {
  const source=await(await fetch('/src/render/scene-runtime.ts')).text();
  const url=source.match(/from \"([^\"]*@babylonjs_core.js[^\"]*)\"/)[1];
  const {EngineStore,Matrix}=await import(url);
  const scene=EngineStore.LastCreatedScene;
  window.hurtScene=scene;
  window.hurt={events:[],shakes:[],framesObserved:[],fourPartIds:[],roundClears:[],fireVoices:[],muzzleDraws:[],life:[]};
  const {Battle}=await import('/src/match/battle.ts'),reconcile=Battle.prototype.reconcile;
  Battle.prototype.reconcile=function(...args){window.hurtBattle=this;return reconcile.apply(this,args);};
  const {BattleSound}=await import('/src/audio/battle-sound.ts'),event=BattleSound.prototype.event;
  BattleSound.prototype.event=function(value,...args){if(['fire','hit','destroy'].includes(value.type))window.hurt.events.push(value);const before=new Set(this.voices);const result=event.call(this,value,...args);if(value.type==='fire')for(const voice of this.voices){if(before.has(voice))continue;const row={playerId:value.playerId,soundId:this.history.at(-1)?.soundId,started:true,ended:false};window.hurt.fireVoices.push(row);voice.source.addEventListener('ended',()=>{row.ended=true;});}return result;};
  const {EffectRuntime}=await import('/src/render/effects/runtime/effect-runtime.ts');
  for(const [method,kind]of [['ordinaryFireCamera','fire'],['ordinaryHurtCamera','hurt']]){
    const ordinary=EffectRuntime.prototype[method];
    EffectRuntime.prototype[method]=function(){const result=ordinary.call(this);const state=this.cameraShake.state;
      window.hurt.lastKind=kind;window.hurt.shakes.push({kind,parameter:state.parameter,duration:state.duration,strength:state.strength,active:state.active,
        event:window.hurt.events.at(-1),world:JSON.parse(document.querySelector('#battle-status').dataset.world)});return result;};
  }
  const clear=EffectRuntime.prototype.clearRoundEffects;
  EffectRuntime.prototype.clearRoundEffects=function(){const result=clear.call(this);window.hurt.roundClears.push({active:this.cameraShake.state.active,elapsed:this.cameraShake.state.elapsed});return result;};
  let frame=0,wasActive=false,restored=0;
  scene.onAfterRenderObservable.add(()=>{
    frame++;
    for(const mesh of scene.meshes){if(mesh.recoilObserved||!mesh.onBeforeRenderObservable)continue;mesh.recoilObserved=true;
      mesh.onBeforeRenderObservable.add(()=>{if(!mesh.metadata?.originalEffect||!mesh.getTotalVertices())return;
        const instance=window.hurtBattle?.effects.instances.find(v=>v.draws.some(d=>d.sprite?.mesh===mesh||d.particle?.sprite.mesh===mesh));
        if(instance?.tree.definition?.name==='_root\\online\\004'||instance?.tree.root?.definition?.name==='_root\\online\\004')window.hurt.muzzleDraws.push({frame,owner:instance.owner?.root.name,mesh:mesh.name,vertices:mesh.getTotalVertices()});
      });
    }
    const battle=window.hurtBattle,raw=document.querySelector('#battle-status')?.dataset.world;
    if(!battle||!raw)return;
    const world=JSON.parse(raw);for(const p of world.players){const last=window.hurt.life.filter(v=>v.id===p.id).at(-1);if(!last||last.alive!==p.alive)window.hurt.life.push({id:p.id,tankId:p.tankId,alive:p.alive,hp:p.hp,deaths:p.deaths,tick:world.tick});}
    const camera=scene.activeCamera,state=battle.effects.cameraShake.state;
    window.hurt.fourPartIds=[...battle.players.players].filter(([,v])=>!v.usesThreePartActor).map(([id])=>id);
    const actual=Array.from(camera.getViewMatrix().m);
    const base=Matrix.Identity();
    const target=camera.getTarget(),eye=camera.position,up=camera.upVector;
    if(scene.useRightHandedSystem)Matrix.LookAtRHToRef(eye,target,up,base);else Matrix.LookAtLHToRef(eye,target,up,base);
    const viewDifference=Math.max(...actual.map((v,i)=>Math.abs(v-base.m[i])));
    if(state.active||wasActive||frame%20===0){
      window.hurt.framesObserved.push({frame,kind:window.hurt.lastKind,tick:world.tick,phase:world.phase,active:state.active,elapsed:state.elapsed,
        actual,base:Array.from(base.m),viewDifference,worldPlayers:world.players.map(p=>({id:p.id,tankId:p.tankId,hp:p.hp,alive:p.alive})),
        pose:battle.effects.cameraShake.pose?JSON.parse(JSON.stringify(battle.effects.cameraShake.pose)):undefined,
        canvas:state.active&&window.hurt.framesObserved.filter(r=>r.active).length<2?scene.getEngine().getRenderingCanvas().toDataURL('image/png'):undefined});
    }
    if(wasActive&&!state.active)restored++;
    wasActive=state.active;
    window.hurt.restored=restored;
  });
}
