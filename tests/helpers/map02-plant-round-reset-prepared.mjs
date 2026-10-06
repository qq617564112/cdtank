/** Ordinary input precondition for a later natural Map02 round reset. */
export async function hideMap02PlantForRoundReset({readWorld, setKeys, focus,
  findPath, goal, modeId = 1, timeoutMs = 60000}) {
  var inputs = [];
  var deadline = Date.now() + timeoutMs;
  var hiddenWorld;
  var stoppedWorld;
  try {
    while (Date.now() < deadline) {
      await focus();
      var world = await readWorld();
      var plant = world.match?.scenePlants?.find(function(value) {
        return value.sourcePlacementId === '327';
      });
      if (plant?.hidden) {
        hiddenWorld = world;
        break;
      }
      var player = world.players.find(function(value) {return value.id === world.playerId;});
      if (world.mapId !== 2 || world.mode !== modeId || world.phase !== 'PLAYING' || !player?.alive) {
        stoppedWorld = world;
        break;
      }
      var path = findPath({x: player.x, y: player.y, z: player.z}, goal);
      var point = path.find(function(value) {
        return Math.hypot(value.x - player.x, value.z - player.z) > 25;
      }) ?? goal;
      var bearing = Math.atan2(point.x - player.x, point.z - player.z);
      var turn = Math.atan2(Math.sin(bearing - player.yaw), Math.cos(bearing - player.yaw));
      var keys = new Set();
      if (Math.abs(turn) > 0.07) keys.add(turn > 0 ? 'KeyA' : 'KeyD');
      if (Math.abs(turn) < 0.15) keys.add('KeyW');
      inputs.push({tick: world.tick, playerId: player.id, x: player.x, z: player.z,
        goal, point, keys: [...keys]});
      await setKeys(keys);
      await new Promise(function(resolve) {setTimeout(resolve, 120);});
    }
  } finally {
    await setKeys(new Set());
  }
  return {sourcePlacementId: '327', reached: Boolean(hiddenWorld), inputs,
    hiddenWorld, stoppedWorld};
}
