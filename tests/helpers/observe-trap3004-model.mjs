/** Read-only hook for the normal placement/contact browser runner. */
export function observeTrap3004Model(scene, engine) {
  const data = {models: [], captures: [], frames: 0};
  const registered = new WeakSet();
  const drawObservers = [];
  let capturePending = false;
  const before = scene.onBeforeRenderObservable.add(() => {
    for (const mesh of scene.meshes) {
      if (mesh.metadata?.sourceModel !== 'Data/scnobj/03004/03004.POL' ||
          mesh.getTotalVertices() !== 228 || !mesh.onBeforeDrawObservable || registered.has(mesh)) continue;
      registered.add(mesh);
      const record = {groundId: mesh.metadata.groundTrapId, name: mesh.name,
        sourceModel: mesh.metadata.sourceModel, vertices: mesh.getTotalVertices(),
        indices: mesh.getTotalIndices(), draws: 0, textures: []};
      data.models.push(record);
      const observer = mesh.onBeforeDrawObservable.add(() => {
        record.draws++;
        record.matrix = Array.from(mesh.getWorldMatrix().asArray());
        record.textures = mesh.material?.getActiveTextures().map(texture => texture.url ?? texture.name) ?? [];
        record.frame = data.frames + 1;
        if (!data.captures.length) capturePending = true;
      });
      drawObservers.push({mesh, observer});
    }
  });
  const after = scene.onAfterRenderObservable.add(() => {
    data.frames++;
    if (!capturePending) return;
    capturePending = false;
    const world = JSON.parse(document.querySelector('#battle-status')?.dataset.world || 'null');
    data.captures.push({frame: data.frames, world,
      models: data.models.map(model => ({...model})),
      canvas: engine.getRenderingCanvas().toDataURL('image/png')});
  });
  return {data, cleanup: () => ({
    models: scene.meshes.filter(mesh => mesh.metadata?.sourceModel === 'Data/scnobj/03004/03004.POL').length,
    world: document.querySelector('#battle-status')?.dataset.world || null,
  }), dispose: () => {
    scene.onBeforeRenderObservable.remove(before);
    scene.onAfterRenderObservable.remove(after);
    for (const {mesh, observer} of drawObservers) mesh.onBeforeDrawObservable.remove(observer);
  }};
}
