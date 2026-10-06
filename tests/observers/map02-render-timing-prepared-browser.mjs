/** Passive timing for a future ordinary Map02 session; no render or load calls. */
export async function installMap02RenderTimingObserver() {
  var evidence = {renderer: {}, frames: []};
  window.map02RenderTiming = evidence;
  var scenes = new WeakSet();
  var costs = new WeakMap();
  var states = new WeakMap();
  var {ScenePreview} = await import('/src/assets/scenes/scene-preview.ts');
  var advance = ScenePreview.prototype.advance;
  ScenePreview.prototype.advance = function(...args) {
    var started = performance.now();
    try {return advance.apply(this, args);} finally {
      if (this.scene) costs.set(this.scene, (costs.get(this.scene) ?? 0) + performance.now() - started);
    }
  };
  var {Battle} = await import('/src/match/battle.ts');
  var reconcile = Battle.prototype.reconcile;
  Battle.prototype.reconcile = function(snapshot, ...args) {
    var result = reconcile.call(this, snapshot, ...args);
    if (snapshot.roomInfo?.mapId !== 2) return result;
    states.set(this.scene, {phase: snapshot.phase, round: snapshot.match?.round, roomId: snapshot.roomId});
    if (scenes.has(this.scene)) return result;
    var scene = this.scene;
    scenes.add(scene);
    var engine = scene.getEngine();
    var gl = engine._gl;
    var debug = gl?.getExtension('WEBGL_debug_renderer_info');
    evidence.renderer = {vendor: debug ? gl.getParameter(debug.UNMASKED_VENDOR_WEBGL) : null,
      renderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : null,
      version: gl?.getParameter(gl.VERSION),
      gpuTimerAvailable: Boolean(engine.getCaps().timerQuery)};
    var before;
    var last;
    scene.onBeforeRenderObservable.add(function() {before = performance.now();});
    scene.onAfterRenderObservable.add(function() {
      var now = performance.now();
      if (evidence.frames.length < 1200) evidence.frames.push({frame: scene.getFrameId(),
        ...states.get(scene),
        width: engine.getRenderWidth(), height: engine.getRenderHeight(),
        hardwareScaling: engine.getHardwareScalingLevel(), at: now,
        intervalMs: last === undefined ? null : now - last,
        sceneSubmitMs: before === undefined ? null : now - before,
        environmentAdvanceMs: costs.get(scene) ?? 0,
        activeMeshes: scene.getActiveMeshes().length, activeIndices: scene.getActiveIndices()});
      costs.set(scene, 0);
      last = now;
    });
    return result;
  };
}
