import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ArcRotateCamera, NullEngine, Scene, TransformNode, Vector3} from '@babylonjs/core';
import {BattlePlayers} from '../apps/web/src/render/battle-players';
import {TankView} from '../apps/web/src/assets/tanks/tank-view';
import type {PlayerSnapshot} from '../apps/shared/protocols/MsgRoomSnapshot';

async function main(): Promise<void> {
  const engine = new NullEngine();
  const scene = new Scene(engine);
  const camera = new ArcRotateCamera('camera', 0, 1, 100, Vector3.Zero(), scene);
  const originalLoad = TankView.load;
  const originalFetch = globalThis.fetch;
  const catalog = readFileSync('recovery/output/web-assets/combat-catalog.json', 'utf8');
  let resolveCatalog!: (response: Response) => void;
  globalThis.fetch = async () => new Promise<Response>(resolve => {resolveCatalog = resolve;});
  const pending: Array<{resolve: (view: TankView) => void; reject: (error: Error) => void}> = [];
  const calls: string[] = [];
  const queued: {id: string; skills: readonly number[]; active: boolean}[] = [];
  TankView.load = async () => new Promise<TankView>((resolve, reject) => {pending.push({resolve, reject});});
  const player: PlayerSnapshot = {queuedPartSkillIds: [13501], id: 'P1', name: 'Player', tankId: 1, team: 0, x: 100, y: 20, z: 30,
    yaw: 1.2, aim: .3, hp: 100, maxHp: 100, alive: true, score: 0, kills: 0, deaths: 0, respawnAt: 0, isVIP: false};
  function tank(tankId = 1, tankTextures?: PlayerSnapshot['tankTextures']): TankView {
    const root = new TransformNode(`fixture-${scene.transformNodes.length}`, scene);
    const turret = new TransformNode(`${root.name}-turret`, scene);
    turret.parent = root;
    return {root, tankId, tankTextures, activeAction: '01', acceptsBattleActions: true, usesThreePartActor: false,
      get turretYaw() {return -root.rotation.y - turret.rotation.y;},
      position: (x: number, y: number, z: number) => root.position.set(-x, y, z),
      life: async (alive: boolean) => {calls.push(`life:${alive}`);},
      motion: async (moving: boolean) => {calls.push(`motion:${moving}`);},
      trackMovementTarget: (x: number, z: number) => {calls.push(`track:${x}:${z}`);},
      aim: (aim: number) => {calls.push(`aim:${aim}`); turret.rotation.y = -aim;},
      fire: async () => {calls.push('fire');},
      setAmmoAttackEffect: (effect: number) => {calls.push(`ammo:${effect}`);},
      dispose: () => {root.dispose();},
    } as unknown as TankView;
  }
  function close(actual: number, expected: number): void {
    assert(Math.abs(actual - expected) < 1e-6, `${actual} != ${expected}`);
  }
  function direction(node: TransformNode, nativeYaw: number): void {
    node.computeWorldMatrix(true);
    const forward = node.getDirection(Vector3.Forward());
    close(forward.x, -Math.sin(nativeYaw));
    close(forward.y, 0);
    close(forward.z, Math.cos(nativeYaw));
  }
  function cameraFacesTurret(turret: TransformNode): void {
    turret.computeWorldMatrix(true);
    const turretForward = turret.getDirection(Vector3.Forward());
    const cameraForward = camera.target.subtract(camera.position);
    turretForward.y = cameraForward.y = 0;
    assert(Vector3.Dot(turretForward.normalize(), cameraForward.normalize()) > .99999,
      'Camera and crosshair must follow the rendered turret heading');
  }
  async function flush(): Promise<void> {await new Promise(resolve => setImmediate(resolve));}
  const views = new BattlePlayers(scene, camera, {
    queuedParts: (id, skills, active) => {queued.push({id, skills: [...skills], active}); return false;},
    attach: () => {calls.push('attach');}, detach: () => {calls.push('detach');},
    remove: id => {calls.push(`remove:${id}`);}, revive: id => {calls.push(`revive:${id}`);},
  });
  try {
    // An old room completion must neither insert a view nor clear a newer room's pending load.
    views.reconcile([player]);
    assert.equal(pending.length, 0);
    views.render(1, player.id);
    assert.equal(queued.length, 0);
    views.clear();
    views.reconcile([player]);
    resolveCatalog(new Response(catalog));
    await flush();
    const old = tank();
    pending[0].resolve(old);
    await flush();
    assert(old.root.isDisposed());
    assert.equal(views.size, 0);
    views.reconcile([{...player, ammoItemId: 2007}]);
    assert.equal(pending.length, 2);
    const current = tank();
    pending[1].resolve(current);
    await flush();
    assert.equal(views.get(player.id), current);
    assert.equal(views.size, 1);
    assert.equal(calls.at(-2), 'ammo:54');
    views.reconcile([{...player, ammoItemId: 2001}]);
    assert.equal(calls.at(-1), 'ammo:4');
    assert.deepEqual(current.root.position.asArray(), [-100, 20, 30]);
    views.render(1, player.id, false);
    assert.deepEqual(queued.at(-1), {id: player.id, skills: [13501], active: false});
    views.render(1, player.id, true);
    assert.deepEqual(queued.at(-1), {id: player.id, skills: [13501], active: true});
    views.render(1, player.id);
    views.reconcile([{...player, x: 110}]);
    views.render(1, player.id);
    assert(calls.includes('motion:true'));
    views.reconcile([{...player, alive: false}]);
    views.render(1, player.id);
    views.reconcile([{...player, x: 500, z: 700}]);
    views.render(.01, player.id);
    assert.deepEqual(current.root.position.asArray(), [-500, 20, 700]);
    assert(Math.abs(current.root.rotation.y + player.yaw) < 1e-6);
    assert(calls.includes('revive:P1'));
    assert.equal(calls.at(-1), 'motion:false');

    // Body heading follows the forward vector while world turret heading follows look + aim.
    const independent = {...player, bodyYaw: -.7, yaw: 1.1, aim: .4};
    views.reconcile([independent]);
    views.render(1);
    const turret = current.root.getChildTransformNodes()[0];
    direction(current.root, independent.bodyYaw);
    direction(turret, independent.yaw + independent.aim);
    close(turret.rotation.y, -(independent.yaw + independent.aim - independent.bodyYaw));

    // Turret-only turns move the camera while leaving the hull heading unchanged.
    views.render(1, player.id);
    cameraFacesTurret(turret);
    const hullHeading = current.root.rotation.y;
    const cameraBeforeAim = camera.position.clone();
    views.reconcile([{...independent, aim: independent.aim + .5}]);
    views.render(1, player.id);
    close(current.root.rotation.y, hullHeading);
    assert(Vector3.Distance(camera.position, cameraBeforeAim) > 1);
    cameraFacesTurret(turret);

    // A new network sample must be spread across render frames, including combined turns.
    for (const bodyStep of [0, .12]) {
      views.reconcile([independent]);
      views.render(1, player.id);
      const initialHeading = independent.yaw + independent.aim;
      const turning = {...independent, bodyYaw: independent.bodyYaw + bodyStep,
        yaw: independent.yaw + bodyStep, aim: independent.aim + .09};
      views.reconcile([turning]);
      let heading = initialHeading;
      for (let frame = 0; frame < 3; frame++) {
        const remaining = turning.yaw + turning.aim - heading;
        views.render(.25, player.id);
        turret.computeWorldMatrix(true);
        const forward = turret.getDirection(Vector3.Forward());
        const actual = Math.atan2(-forward.x, forward.z);
        close(actual - heading, remaining * .25);
        cameraFacesTurret(turret);
        heading = actual;
      }
    }

    // Crossing pi takes the short body rotation and retains the independent turret direction.
    views.reconcile([{...independent, bodyYaw: Math.PI - .1}]);
    views.render(1);
    const beforeCrossing = current.root.rotation.y;
    views.reconcile([{...independent, bodyYaw: -Math.PI + .1, yaw: -Math.PI + .2}]);
    views.render(.5, player.id);
    close(current.root.rotation.y - beforeCrossing, -.1);
    direction(current.root, Math.PI);
    cameraFacesTurret(turret);
    views.render(1);
    direction(current.root, -Math.PI + .1);
    direction(turret, -Math.PI + .2 + independent.aim);

    views.reconcile([{...independent, alive: false}]);
    views.render(1);
    const revived = {...independent, bodyYaw: 2.4, yaw: -.8, aim: .2, x: 600, z: 800};
    views.reconcile([revived]);
    views.render(.01);
    direction(current.root, revived.bodyYaw);
    direction(turret, revived.yaw + revived.aim);
    assert.deepEqual(current.root.position.asArray(), [-600, 20, 800]);

    // Snapshots without a separate body heading retain the existing yaw/aim contract.
    views.reconcile([player]);
    views.render(1);
    direction(current.root, player.yaw);
    direction(turret, player.yaw + player.aim);
    views.resetRound([{...player, x: 200}]);
    assert.deepEqual(current.root.position.asArray(), [-200, 20, 30]);
    views.fire(player.id);
    await flush();
    assert(calls.includes('fire'));

    // Selection changes while the replacement is loading invalidate that exact resource result.
    const firstSkin = {U: 1, M: 2, XY: 3};
    const secondSkin = {U: 4, M: 5, XY: 6};
    views.reconcile([{...player, tankTextures: firstSkin}]);
    await flush();
    assert(current.root.isDisposed());
    views.reconcile([{...player, tankTextures: secondSkin}]);
    const staleSkin = tank(1, firstSkin);
    pending[2].resolve(staleSkin);
    await flush();
    assert(staleSkin.root.isDisposed());
    views.reconcile([{...player, tankTextures: secondSkin}]);
    await flush();
    const selected = tank(1, secondSkin);
    pending[3].resolve(selected);
    await flush();
    assert.equal(views.get(player.id), selected);
    views.reconcile([]);
    assert(selected.root.isDisposed());
    assert.equal(views.size, 0);

    views.reconcile([player]);
    await flush();
    views.clear();
    pending[4].reject(new Error('old room failure'));
    await flush();
    assert.equal(views.loadingError, '');
    views.reconcile([player]);
    await flush();
    pending[5].reject(new Error('current failure'));
    await flush();
    assert(views.loadingError.includes('current failure'));
    views.clear();
    assert.equal(views.loadingError, '');
    views.reconcile([player]);
    views.reconcile([]);
    await flush();
    const departed = tank();
    pending[6].resolve(departed);
    await flush();
    assert(departed.root.isDisposed());
    assert.equal(views.size, 0);
    views.reconcile([player]);
    await flush();
    const actionView = tank();
    let rejectAction!: (error: Error) => void;
    actionView.fire = () => new Promise<void>((_resolve, reject) => {rejectAction = reject;});
    pending[7].resolve(actionView);
    await flush();
    views.fire(player.id);
    views.clear();
    rejectAction(new Error('late action failure'));
    await flush();
    assert.equal(views.loadingError, '');
    assert(actionView.root.isDisposed());
    assert.equal(scene.transformNodes.length, 0);
    console.log('PASS: player resource generations, skin replacement, removal, independent body/turret directions, pi crossing, motion/death/revival, round reset, stale failure and cleanup');
  } finally {
    TankView.load = originalLoad;
    globalThis.fetch = originalFetch;
    views.clear();
    scene.dispose();
    engine.dispose();
  }

}
void main().catch(error => {console.error(error); process.exitCode = 1;});
