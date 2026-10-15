import {AbstractMesh, ArcRotateCamera, BaseTexture, Camera, Color3, Color4, Constants, DirectionalLight, Frustum, HemisphericLight, Matrix, Scene, ShaderMaterial, ShadowGenerator,
  TransformNode, UniformBuffer, Vector3} from '@babylonjs/core';
import {sceneShadowLightProfile} from './scene-shadow-light-profiles';

interface ShadowRoot {
  readonly root: TransformNode;
  readonly dynamic: boolean;
  readonly softShadows: boolean;
  readonly meshes?: () => readonly AbstractMesh[];
  readonly staticMeshes?: readonly AbstractMesh[];
}

interface ShadowMeshNames {
  mesh: string;
  material: string;
  terrainTexture: string;
  texture: string;
  excluded: boolean;
}

const owners = new WeakMap<Scene, SceneShadowLight>();
const textures = new WeakMap<ShaderMaterial, BaseTexture>();
const EXCLUDED_SHADOW_NAMES = /(sky|cloud|beijing|shu_hou|tree02)/;
const PROJECTION_SIDES = [-1, 1] as const;
const PROJECTION_HEIGHTS = [-256, 384] as const;

export const SCENE_SHADOW_VERTEX_DECLARATION = `
#ifndef SCENE_SHADOWS_DISABLED
varying vec3 sceneShadowWorldPosition;
varying vec3 sceneShadowWorldNormal;
#endif`;

/** Source shaders supply their transformed, animated position and normal. */
export const SCENE_SHADOW_VERTEX_APPLY = `
#ifndef SCENE_SHADOWS_DISABLED
  sceneShadowWorldPosition = worldPosition.xyz;
  sceneShadowWorldNormal = worldNormal;
#endif`;

export const SCENE_SHADOW_FRAGMENT_DECLARATION = `
#ifndef SCENE_SHADOWS_DISABLED
uniform SceneShadowLight {
  vec4 sceneShadowDirection;
  vec4 sceneShadowColour;
  vec4 sceneShadowSettings;
  vec4 sceneShadowDepth;
  vec4 sceneShadowView;
  mat4 sceneShadowMatrix;
};
uniform sampler2D sceneShadowTexture;
uniform float sceneShadowReceiver;
uniform float sceneShadowOcclusion;
uniform float sceneShadowSoftness;
varying vec3 sceneShadowWorldPosition;
varying vec3 sceneShadowWorldNormal;
vec3 sceneShadowCoordinates(mat4 matrix, vec3 offset) {
  vec4 projected = matrix * vec4(sceneShadowWorldPosition + offset, 1.0);
  vec3 clip = projected.xyz / projected.w;
  float depth = (sceneShadowDepth.z * clip.z + sceneShadowDepth.x) / sceneShadowDepth.y;
  return vec3(clip.xy * 0.5 + 0.5, depth);
}
vec2 sceneShadowDepthSlope(vec3 coordinates) {
  vec3 dx = dFdx(coordinates);
  vec3 dy = dFdy(coordinates);
  float determinant = dx.x * dy.y - dx.y * dy.x;
  if (abs(determinant) < 1.0e-12) return vec2(0.0);
  return vec2(dy.y * dx.z - dx.y * dy.z, dx.x * dy.z - dy.x * dx.z) / determinant;
}
float sceneShadowSample(vec2 uv, float depth, vec2 slope, vec2 offset) {
  vec2 mapSize = vec2(textureSize(sceneShadowTexture, 0).xy);
  ivec2 texel = ivec2(clamp(floor((uv + offset) * mapSize), vec2(0.0), mapSize - vec2(1.0)));
  vec2 sampleUv = (vec2(texel) + 0.5) / mapSize;
  // Cover the full receiver-plane footprint, including faces nearly parallel to the light.
  float slopeBias = dot(abs(slope), vec2(0.5) / mapSize);
  float receiverDepth = depth + dot(slope, sampleUv - uv) - sceneShadowDepth.w - slopeBias;
  float stored = texelFetch(sceneShadowTexture, texel, 0).r;
  return step(receiverDepth, stored);
}
float sceneShadowVisibility(vec3 coordinates, vec2 slope) {
  vec2 uv = coordinates.xy;
  float depth = coordinates.z;
  if (depth < 0.0 || depth > 1.0 || uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return 1.0;
  float edge = min(min(uv.x, uv.y), min(1.0 - uv.x, 1.0 - uv.y));
  float distance = dot(sceneShadowWorldPosition.xz, sceneShadowView.xy) + sceneShadowView.z;
  float coverage = smoothstep(0.0, 0.08, edge)
    * (1.0 - smoothstep(0.8 * sceneShadowView.w, sceneShadowView.w, distance));
  if (sceneShadowSoftness < 0.5) return mix(1.0, sceneShadowSample(uv, depth, slope, vec2(0.0)), coverage);
  // Four nearby comparisons soften scene receivers without blurring tank surfaces.
  vec2 stepUv = vec2(0.5 * sceneShadowSettings.y);
  float visibility = 0.25 * (sceneShadowSample(uv, depth, slope, -stepUv)
    + sceneShadowSample(uv, depth, slope, vec2(stepUv.x, -stepUv.y))
    + sceneShadowSample(uv, depth, slope, vec2(-stepUv.x, stepUv.y))
    + sceneShadowSample(uv, depth, slope, stepUv));
  return mix(1.0, visibility, coverage);
}
vec3 sceneShadowSurfaceNormal(vec3 geometric) {
  vec3 normal = sceneShadowWorldNormal;
  if (dot(normal,normal) < 0.001) {
    normal = gl_FrontFacing ? geometric : -geometric;
  }
  return normal;
}
vec3 sceneShadowLighting(vec3 normal, float visibility) {
  vec3 incoming = -sceneShadowDirection.xyz;
  float direct = max(dot(normalize(normal), incoming), 0.0);
  // Artwork already contains shading; add a small, broad cartoon light band.
  float band = smoothstep(0.12, 0.20, direct);
  float strength = sceneShadowColour.a * band;
  float brightness = mix(sceneShadowSettings.w, 1.0, strength);
  vec3 light = brightness * mix(vec3(1.0), sceneShadowColour.rgb, 0.12 * strength);
  return light * (1.0 - (1.0 - visibility) * sceneShadowSettings.x);
}
#endif`;

export const SCENE_SHADOW_FRAGMENT_BEGIN = `
#ifndef SCENE_SHADOWS_DISABLED
  // Derivatives must run before any fragment-dependent branch or alpha discard.
  vec3 sceneShadowGeometric = cross(dFdx(sceneShadowWorldPosition), dFdy(sceneShadowWorldPosition));
  sceneShadowGeometric /= max(length(sceneShadowGeometric), 1.0e-8);
  vec3 sceneShadowNormal = sceneShadowSurfaceNormal(sceneShadowGeometric);
  if (dot(sceneShadowGeometric, sceneShadowNormal) < 0.0) sceneShadowGeometric = -sceneShadowGeometric;
  float sceneShadowIncidence = max(dot(sceneShadowGeometric, -sceneShadowDirection.xyz), 0.0);
  vec3 sceneShadowOffset = 0.35 * sqrt(max(0.0, 1.0 - sceneShadowIncidence * sceneShadowIncidence)) * sceneShadowGeometric;
  vec3 sceneShadowCoordinatesAtPixel = sceneShadowCoordinates(sceneShadowMatrix, sceneShadowOffset);
  vec2 sceneShadowSlope = sceneShadowDepthSlope(sceneShadowCoordinatesAtPixel);
#endif`;

export const SCENE_SHADOW_FRAGMENT_APPLY = `
#ifndef SCENE_SHADOWS_DISABLED
  if (sceneShadowReceiver > 0.5 && sceneShadowSettings.z > 0.5) {
    float sceneShadowVisible = 1.0;
    if (sceneShadowOcclusion > 0.5) {
      // Geometric back faces receive ambient light, with a stable cartoon shade.
      if (sceneShadowIncidence < 0.001) {
        sceneShadowVisible = 0.0;
      } else {
        sceneShadowVisible = sceneShadowVisibility(sceneShadowCoordinatesAtPixel, sceneShadowSlope);
      }
    }
    gl_FragColor.rgb *= sceneShadowLighting(sceneShadowNormal, sceneShadowVisible);
  }
#endif`;

/** Materials remain unaffected until an actual scene mesh registers as a receiver. */
export function bindSceneShadowMaterial(material: ShaderMaterial, texture?: BaseTexture): void {
  if (texture) {
    textures.set(material, texture);
    material.getAlphaTestTexture = () => texture;
  }
  if (!material.getScene().shadowsEnabled) {
    material.options.defines.push('SCENE_SHADOWS_DISABLED');
    return;
  }
  const owner = owners.get(material.getScene());
  if (!owner) return;
  owner.bindMaterial(material);
}

/** One map-wide light supplies surface lighting and model shadows, including tanks. */
export class SceneShadowLight {
  private readonly mapSize = 1024;
  private readonly light: DirectionalLight;
  private readonly generator: ShadowGenerator;
  private readonly buffer: UniformBuffer;
  private readonly roots = new Set<ShadowRoot>();
  private readonly receivers = new Set<AbstractMesh>();
  private readonly casters = new Set<AbstractMesh>();
  private readonly meshNames = new WeakMap<AbstractMesh, ShadowMeshNames>();
  private readonly planes = Frustum.GetPlanes(Matrix.Identity());
  private readonly projectionCentre = Vector3.Zero();
  private readonly projectionForward = Vector3.Zero();
  private readonly projectionPoint = Vector3.Zero();
  private coverageDistance = 512;
  private coverageTangent = 1;
  private coverageGroundY = 0;
  private casterReach = 0.5;
  private receiversChanged = false;
  private terrain: readonly AbstractMesh[] = [];
  private readonly updateFrame = (): void => {this.update();};

  constructor(private readonly scene: Scene) {
    owners.set(scene, this);
    this.light = new DirectionalLight('scene-shadow-light', new Vector3(0.4, -1, 0.3).normalize(), scene);
    this.light.setEnabled(false);
    this.light.specular = Color3.Black();
    // One local map concentrates shadow precision around the player with one depth pass.
    this.generator = new ShadowGenerator(this.mapSize, this.light, true, undefined, true);
    this.generator.usePercentageCloserFiltering = true;
    this.generator.filteringQuality = ShadowGenerator.QUALITY_LOW;
    this.generator.bias = 0.00005;
    this.light.customProjectionMatrixBuilder = (view, _meshes, projection) => {
      const camera = scene.activeCamera;
      if (!camera) return;
      const target = camera instanceof ArcRotateCamera ? camera.target : camera.globalPosition;
      const forward = this.projectionForward;
      if (camera instanceof ArcRotateCamera) target.subtractToRef(camera.globalPosition, forward);
      else camera.getDirectionToRef(Vector3.Forward(), forward);
      const horizontal = Math.hypot(forward.x, forward.z);
      const slope = Math.abs(forward.y) / Math.max(horizontal, 0.001);
      const distance = camera instanceof ArcRotateCamera
        ? Math.max(512, Math.min(1400, camera.radius * 2 / Math.max(0.2, slope))) : 1400;
      forward.y = 0;
      if (horizontal < 0.001) forward.set(0, 0, 1);
      else forward.scaleInPlace(1 / horizontal);
      const tangent = Math.tan(camera.fov / 2) * (camera.fovMode === Camera.FOVMODE_VERTICAL_FIXED
        ? scene.getEngine().getAspectRatio(camera, true) : 1);
      this.coverageDistance = distance;
      this.coverageTangent = tangent;
      this.coverageGroundY = target.y;
      const centre = this.projectionCentre;
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      let minZ = Infinity, maxZ = -Infinity;
      // Fit the visible ground ahead of the camera, with room for nearby casters above it.
      for (let index = 0; index < 2; index++) {
        const along = index === 0 ? -128 : distance;
        const width = 128 + Math.max(0, along) * tangent;
        for (const side of PROJECTION_SIDES) {
          for (const height of PROJECTION_HEIGHTS) {
            this.projectionPoint.set(camera.globalPosition.x + forward.x * along + forward.z * width * side,
              target.y + height, camera.globalPosition.z + forward.z * along - forward.x * width * side);
            Vector3.TransformCoordinatesToRef(this.projectionPoint, view, centre);
            minX = Math.min(minX, centre.x); maxX = Math.max(maxX, centre.x);
            minY = Math.min(minY, centre.y); maxY = Math.max(maxY, centre.y);
            minZ = Math.min(minZ, centre.z); maxZ = Math.max(maxZ, centre.z);
          }
        }
      }
      const width = Math.ceil(Math.max(512, maxX - minX + 128) / 128) * 128;
      const height = Math.ceil(Math.max(512, maxY - minY + 128) / 128) * 128;
      const texelX = width / this.mapSize, texelY = height / this.mapSize;
      const x = Math.round((minX + maxX) / (2 * texelX)) * texelX;
      const y = Math.round((minY + maxY) / (2 * texelY)) * texelY;
      const near = minZ - 128, far = maxZ + 128;
      const reverse = scene.getEngine().useReverseDepthBuffer;
      Matrix.OrthoOffCenterLHToRef(x - width / 2, x + width / 2, y - height / 2, y + height / 2,
        reverse ? far : near, reverse ? near : far, projection, scene.getEngine().isNDCHalfZRange);
    };
    // Source shading normals need not match the geometric faces used by depth comparisons.
    this.generator.normalBias = 0;
    this.generator.transparencyShadow = true;
    this.generator.enableSoftTransparentShadow = true;
    this.generator.customAllowRendering = subMesh => this.eligible(subMesh.getMesh());
    this.buffer = new UniformBuffer(scene.getEngine(), undefined, true, 'scene-shadow-light', false, false);
    for (const name of ['sceneShadowDirection', 'sceneShadowColour', 'sceneShadowSettings', 'sceneShadowDepth', 'sceneShadowView']) {
      this.buffer.addUniform(name, 4);
    }
    this.buffer.addUniform('sceneShadowMatrix', 16);
    this.buffer.create();
    this.buffer.updateFloat4('sceneShadowDirection', this.light.direction.x,
      this.light.direction.y, this.light.direction.z, 0);
    this.buffer.updateFloat4('sceneShadowColour', 1, 1, 1, 0);
    this.buffer.updateFloat4('sceneShadowSettings', 0, 0, 0, 0);
    this.buffer.updateFloat4('sceneShadowView', 0, 1, 0, 512);
    const near = this.light.getDepthMinZ(scene.activeCamera!);
    const far = this.light.getDepthMaxZ(scene.activeCamera!);
    const receiverBias = this.generator.getShadowMap()!.textureType === Constants.TEXTURETYPE_HALF_FLOAT
      ? this.generator.bias + 0.00025 : this.generator.bias;
    this.buffer.updateFloat4('sceneShadowDepth', near, near + far,
      scene.getEngine().useReverseDepthBuffer ? -1 : 1, receiverBias);
    this.buffer.updateMatrix('sceneShadowMatrix', Matrix.Identity());
    this.buffer.update();
    // Babylon updates the light projection before receiver uniforms are synchronized.
    this.generator.getShadowMap()!.onBeforeRenderObservable.add(() => {
      this.updateProjection();
      // Source shaders read float depth; PBR receivers use the comparison depth texture.
      scene.getEngine().setColorWrite(true);
    });
    // Both custom and PBR receivers need their depth attachments cleared each frame.
    const shadowMap = this.generator.getShadowMap()!;
    const emptyDepth = new Color4(1, 1, 1, 1);
    shadowMap.onClearObservable.clear();
    shadowMap.onClearObservable.add(engine => {engine.clear(emptyDepth, true, true, false);});
    // Battle movement and camera follow finish in onBeforeRender before caster culling.
    scene.onBeforeCameraRenderObservable.add(this.updateFrame);
    scene.onDisposeObservable.addOnce(() => {this.dispose();});
  }

  bindMaterial(material: ShaderMaterial): void {
    material.setUniformBuffer('SceneShadowLight', this.buffer);
    material.setFloat('sceneShadowReceiver', 0);
    material.setFloat('sceneShadowOcclusion', 1);
    material.setFloat('sceneShadowSoftness', 1);
    material.setTexture('sceneShadowTexture', this.generator.getShadowMap()!);
  }

  /** Prepare each fragment model's shadow shader during map loading. */
  async prepareMeshes(meshes: readonly AbstractMesh[]): Promise<void> {
    const pending = meshes.filter(mesh => this.eligible(mesh)).flatMap(mesh => mesh.subMeshes);
    const deadline = performance.now() + 30_000;
    while (pending.length && !this.scene.isDisposed) {
      for (let index = pending.length - 1; index >= 0; index--) {
        const subMesh = pending[index];
        const mesh = subMesh.getMesh();
        const material = subMesh.getMaterial();
        const transparent = material?.needAlphaBlendingForMesh(mesh) ?? false;
        if (mesh.isDisposed() || this.generator.isReady(subMesh, false, transparent)) {
          pending.splice(index, 1);
          continue;
        }
        const wrapper = material?.shadowDepthWrapper;
        const depthEffect = wrapper?.getEffect(subMesh, this.generator,
          this.scene.getEngine().currentRenderPassId)?.effect;
        const compilationError = depthEffect?.getCompilationError()
          || wrapper?.baseMaterial.getEffect()?.getCompilationError();
        if (compilationError) {
          throw new Error(`场景阴影着色器编译失败：${mesh.name}（${compilationError}）`);
        }
        if (performance.now() >= deadline) {
          throw new Error(`场景阴影着色器编译超时，请重试：${mesh.name}`);
        }
      }
      if (pending.length) await new Promise<void>(resolve => {setTimeout(resolve, 16);});
    }
  }

  setTerrain(mapId: string, meshes: readonly AbstractMesh[]): void {
    this.terrain = meshes.filter(mesh => this.eligible(mesh));
    const profile = sceneShadowLightProfile(mapId);
    for (const mesh of this.terrain) this.receive(mesh);
    this.light.direction.copyFromFloats(...profile.direction).normalize();
    this.casterReach = Math.hypot(this.light.direction.x, this.light.direction.z) / Math.abs(this.light.direction.y);
    this.light.forceProjectionMatrixCompute();
    this.light.diffuse = Color3.FromArray(profile.colour);
    this.light.intensity = profile.intensity;
    this.generator.setDarkness(1 - profile.shadowStrength);
    this.generator.blurScale = profile.softness;
    this.syncReceivers();
    this.buffer.updateFloat4('sceneShadowDirection', this.light.direction.x,
      this.light.direction.y, this.light.direction.z, 0);
    this.buffer.updateFloat4('sceneShadowColour', ...profile.colour, profile.intensity);
    this.buffer.updateFloat4('sceneShadowSettings', profile.shadowStrength,
      profile.softness / this.mapSize, 1, profile.ambient);
    this.buffer.update();
    const sky = this.scene.getLightByName('sky');
    if (sky instanceof HemisphericLight) sky.intensity = profile.ambient * 1.2;
    this.light.setEnabled(true);
  }

  addRoot(root: TransformNode, options: {dynamic?: boolean; softShadows?: boolean;
    meshes?: () => readonly AbstractMesh[]} = {}): () => void {
    const entry = {root, dynamic: options.dynamic ?? false,
      softShadows: options.softShadows ?? true, meshes: options.meshes,
      staticMeshes: !options.dynamic && !options.meshes ? root.getChildMeshes() : undefined};
    this.roots.add(entry);
    return () => {this.roots.delete(entry);};
  }

  clear(): void {
    for (const entry of this.roots) if (!entry.dynamic) this.roots.delete(entry);
    for (const mesh of this.receivers) {
      mesh.receiveShadows = false;
      if (mesh.material instanceof ShaderMaterial) mesh.material.setFloat('sceneShadowReceiver', 0);
    }
    this.receivers.clear();
    this.casters.clear();
    this.receiversChanged = false;
    this.terrain = [];
    this.light.includedOnlyMeshes = [];
    this.light.setEnabled(false);
    const renderList = this.generator.getShadowMap()!.renderList;
    if (renderList?.length) renderList.splice(0);
    this.buffer.updateFloat4('sceneShadowSettings', 0, 0, 0, 0);
    this.buffer.update();
  }

  private updateProjection(): void {
    this.buffer.updateMatrix('sceneShadowMatrix', this.generator.getTransformMatrix());
    const eye = this.scene.activeCamera!.globalPosition;
    const forward = this.projectionForward;
    this.buffer.updateFloat4('sceneShadowView', forward.x, forward.z,
      -(eye.x * forward.x + eye.z * forward.z), this.coverageDistance);
    this.buffer.update();
  }

  private update(): void {
    if (!this.terrain.length) return;
    this.light.forceProjectionMatrixCompute();
    const casters = this.casters;
    casters.clear();
    for (const mesh of this.terrain) casters.add(mesh);
    for (const entry of this.roots) {
      if (entry.root.isDisposed()) {this.roots.delete(entry); continue;}
      for (const mesh of entry.meshes?.() ?? entry.staticMeshes ?? entry.root.getChildMeshes()) {
        if (!this.eligible(mesh)) continue;
        this.receive(mesh, entry.softShadows);
        if (entry.root.isEnabled() && mesh.isEnabled() && mesh.isVisible && mesh.visibility > 0) {
          casters.add(mesh);
        }
      }
    }
    // Destruction CVDs have no placement root and retain the map's lifetime.
    for (const mesh of this.scene.meshes) {
      if (!mesh.metadata?.sourceBreachBroken || !this.eligible(mesh)) continue;
      this.receive(mesh);
      if (mesh.isEnabled() && mesh.isVisible && mesh.visibility > 0) casters.add(mesh);
    }
    this.syncReceivers();
    const map = this.generator.getShadowMap()!;
    Frustum.GetPlanesToRef(this.generator.getTransformMatrix(), this.planes);
    const visible = map.renderList ?? (map.renderList = []);
    let visibleCount = 0;
    const eye = this.scene.activeCamera!.globalPosition;
    const forward = this.projectionForward;
    for (const mesh of casters) {
      mesh.computeWorldMatrix();
      const bounds = mesh.getBoundingInfo();
      const centre = bounds.boundingSphere.centerWorld;
      const dx = centre.x - eye.x, dz = centre.z - eye.z;
      const along = dx * forward.x + dz * forward.z;
      const side = Math.abs(dx * forward.z - dz * forward.x);
      // Off-screen casters can still project into view, especially under low sunset light.
      const reach = Math.max(0, bounds.boundingBox.maximumWorld.y - this.coverageGroundY + 128) * this.casterReach;
      const margin = bounds.boundingSphere.radiusWorld + 128 + reach;
      if (along < -128 - margin || along > this.coverageDistance + margin
          || side > 128 + Math.max(0, along) * this.coverageTangent + margin) continue;
      if (mesh.isInFrustum(this.planes)) {
        // Keep Babylon's empty-to-nonempty notification without clearing the list each frame.
        if (!visible.length) visible.push(mesh);
        else visible[visibleCount] = mesh;
        visibleCount++;
      }
    }
    // Only an empty/nonempty transition needs the observed mutation and light-dirty notification.
    if (!visibleCount && visible.length) visible.splice(0);
    else visible.length = visibleCount;
  }

  private syncReceivers(): void {
    for (const mesh of this.receivers) {
      if (!mesh.isDisposed()) continue;
      this.receivers.delete(mesh);
      this.receiversChanged = true;
    }
    if (!this.receiversChanged) return;
    this.light.includedOnlyMeshes = [...this.receivers];
    this.receiversChanged = false;
  }

  private receive(mesh: AbstractMesh, softShadows = true): void {
    if (this.receivers.has(mesh)) return;
    this.receivers.add(mesh);
    this.receiversChanged = true;
    mesh.receiveShadows = true;
    if (mesh.material instanceof ShaderMaterial) {
      mesh.material.setFloat('sceneShadowReceiver', 1);
      mesh.material.setFloat('sceneShadowSoftness', softShadows ? 1 : 0);
    }
  }

  private eligible(mesh: AbstractMesh): boolean {
    if (mesh.isDisposed() || !mesh.getTotalVertices()) return false;
    for (let node: TransformNode | null = mesh; node; node = node.parent instanceof TransformNode ? node.parent : null) {
      if (node.billboardMode !== 0) return false;
    }
    const material = mesh.material;
    const texture = material instanceof ShaderMaterial ? textures.get(material) : undefined;
    const meshName = mesh.name;
    const materialName = material?.name ?? '';
    const terrainTexture = material?.metadata?.sourceTerrainTexture ?? '';
    const textureName = texture?.name ?? '';
    let names = this.meshNames.get(mesh);
    if (!names || names.mesh !== meshName || names.material !== materialName
      || names.terrainTexture !== terrainTexture || names.texture !== textureName) {
      names ??= {mesh: '', material: '', terrainTexture: '', texture: '', excluded: false};
      names.mesh = meshName;
      names.material = materialName;
      names.terrainTexture = terrainTexture;
      names.texture = textureName;
      names.excluded = EXCLUDED_SHADOW_NAMES.test(
        `${meshName} ${materialName} ${terrainTexture} ${textureName}`.toLowerCase());
      this.meshNames.set(mesh, names);
    }
    return !names.excluded && !material?.metadata?.sourcePlantModel;
  }

  private dispose(): void {
    this.clear();
    this.roots.clear();
    this.scene.onBeforeCameraRenderObservable.removeCallback(this.updateFrame);
    this.generator.dispose();
    this.light.dispose();
    this.buffer.dispose();
    owners.delete(this.scene);
  }
}

export function sceneShadowLight(scene: Scene): SceneShadowLight | undefined {
  return owners.get(scene);
}
