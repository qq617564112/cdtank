import {ArcRotateCamera, Color3, DynamicTexture, MeshBuilder, Scene, StandardMaterial, TransformNode, Vector3} from '@babylonjs/core';

interface ModelBounds {
  min: Vector3;
  max: Vector3;
  size: Vector3;
  center: Vector3;
}

function modelBounds(root: TransformNode): ModelBounds {
  const meshes = root.getChildMeshes().filter(mesh => mesh.isEnabled() && mesh.getTotalVertices() > 0);
  if (!meshes.length) throw new Error('角色模型没有可显示的网格');
  let min = new Vector3(Infinity, Infinity, Infinity), max = new Vector3(-Infinity, -Infinity, -Infinity);
  for (const mesh of meshes) {
    mesh.computeWorldMatrix(true);
    const box = mesh.getBoundingInfo().boundingBox;
    min = Vector3.Minimize(min, box.minimumWorld); max = Vector3.Maximize(max, box.maximumWorld);
  }
  return {min, max, size: max.subtract(min), center: min.add(max).scale(0.5)};
}

function contactShadows(scene: Scene, tank: ModelBounds, pet: ModelBounds): void {
  const texture = new DynamicTexture('home-player-contact-shadow', {width: 256, height: 256}, scene, false);
  const context = texture.getContext();
  context.clearRect(0, 0, 256, 256);
  const gradient = context.createRadialGradient(128, 128, 8, 128, 128, 125);
  gradient.addColorStop(0, 'rgba(46,22,16,.38)');
  gradient.addColorStop(0.6, 'rgba(46,22,16,.12)');
  gradient.addColorStop(1, 'rgba(46,22,16,0)');
  context.fillStyle = gradient; context.fillRect(0, 0, 256, 256);
  texture.update(); texture.hasAlpha = true;
  const material = new StandardMaterial('home-player-shadow-material', scene);
  material.diffuseTexture = texture; material.useAlphaFromDiffuseTexture = true;
  material.disableLighting = true; material.emissiveColor = Color3.White();
  for (const [name, bounds] of [['tank', tank], ['pet', pet]] as const) {
    const ground = MeshBuilder.CreateGround(`home-player-${name}-contact`,
      {width: bounds.size.x * 1.18, height: bounds.size.z * 1.16}, scene);
    ground.position.set(bounds.center.x, 0.015, bounds.center.z);
    ground.material = material; ground.isPickable = false;
  }
}

/** Fixed portrait: pet in front and to the right of the grounded tank. */
export function positionHomePlayerModels(scene: Scene, camera: ArcRotateCamera,
  tank: TransformNode, pet: TransformNode, aspect: number): void {
  tank.rotation.y = Math.PI; pet.rotation.y = Math.PI; pet.scaling.setAll(0.7);
  const tankBounds = modelBounds(tank), petBounds = modelBounds(pet);
  tank.position.y = -tankBounds.min.y; pet.position.y = -petBounds.min.y;
  const front = tankBounds.size.z * 0.48 + petBounds.size.z * 0.15;
  const lateral = tankBounds.size.x * 0.17;
  tank.position.z = front * 0.12;
  pet.position.x = (front - lateral) / Math.sqrt(2);
  pet.position.z = -(front + lateral) / Math.sqrt(2);
  const groundedTank = modelBounds(tank), groundedPet = modelBounds(pet);
  const min = Vector3.Minimize(groundedTank.min, groundedPet.min);
  const max = Vector3.Maximize(groundedTank.max, groundedPet.max);
  camera.target = min.add(max).scale(0.5); camera.target.y = (max.y + min.y) * 0.49;
  const forward = new Vector3(-Math.cos(camera.alpha) * Math.sin(camera.beta), -Math.cos(camera.beta),
    -Math.sin(camera.alpha) * Math.sin(camera.beta)).normalize();
  const right = Vector3.Cross(Vector3.Up(), forward).normalize();
  const up = Vector3.Cross(forward, right).normalize();
  const halfHeight = Math.tan(camera.fov / 2), halfWidth = halfHeight * aspect;
  let radius = 0;
  for (const x of [min.x, max.x]) for (const y of [min.y, max.y]) for (const z of [min.z, max.z]) {
    const delta = new Vector3(x, y, z).subtract(camera.target);
    radius = Math.max(radius,
      Math.abs(Vector3.Dot(delta, right)) / (halfWidth * 0.86) - Vector3.Dot(delta, forward),
      Math.abs(Vector3.Dot(delta, up)) / (halfHeight * 0.80) - Vector3.Dot(delta, forward));
  }
  camera.radius = radius;
  pet.position.addInPlace(new Vector3(-Math.sin(camera.alpha), 0, Math.cos(camera.alpha))
    .scale(tankBounds.size.x * 0.20));
  contactShadows(scene, groundedTank, modelBounds(pet));
}
