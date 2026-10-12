import {AbstractMesh, BaseTexture, Color3, DirectionalLight, HemisphericLight, Matrix, Scene, ShaderMaterial,
  ShadowGenerator, TransformNode, UniformBuffer, Vector3} from '@babylonjs/core';
import {sceneShadowLightProfile} from './scene-shadow-light-profiles';

interface ShadowRoot {
  readonly root: TransformNode;
  readonly dynamic: boolean;
  readonly softShadows: boolean;
  readonly meshes?: () => readonly AbstractMesh[];
}

const MAP_SIZE = 2048;
const owners = new WeakMap<Scene, SceneShadowLight>();
const textures = new WeakMap<ShaderMaterial, BaseTexture>();

export const SCENE_SHADOW_VERTEX_DECLARATION = `
varying vec3 sceneShadowWorldPosition;
varying vec3 sceneShadowWorldNormal;`;

/** Source shaders supply their transformed, animated position and normal. */
export const SCENE_SHADOW_VERTEX_APPLY = `
  sceneShadowWorldPosition = worldPosition.xyz;
  sceneShadowWorldNormal = worldNormal;`;

export const SCENE_SHADOW_FRAGMENT_DECLARATION = `
uniform SceneShadowLight {
  vec4 sceneShadowDirection;
  vec4 sceneShadowColour;
  vec4 sceneShadowSettings;
  vec4 sceneShadowDepth;
  mat4 sceneShadowMatrix;
};
uniform sampler2D sceneShadowTexture;
uniform float sceneShadowReceiver;
uniform float sceneShadowSoftness;
varying vec3 sceneShadowWorldPosition;
varying vec3 sceneShadowWorldNormal;
vec3 sceneShadowCoordinates() {
  vec4 projected = sceneShadowMatrix * vec4(sceneShadowWorldPosition, 1.0);
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
  ivec2 texel = ivec2(clamp(floor((uv + offset) * ${MAP_SIZE}.0), vec2(0.0), vec2(${MAP_SIZE - 1}.0)));
  vec2 sampleUv = (vec2(texel) + 0.5) / ${MAP_SIZE}.0;
  float receiverDepth = depth + dot(slope, sampleUv - uv) - sceneShadowDepth.w;
  float stored = texelFetch(sceneShadowTexture, texel, 0).r;
  return step(receiverDepth, stored);
}
float sceneShadowVisibility(vec3 coordinates, vec2 slope) {
  vec2 uv = coordinates.xy;
  float depth = coordinates.z;
  if (depth < 0.0 || depth > 1.0 || uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return 1.0;
  if (sceneShadowSoftness < 0.5) return sceneShadowSample(uv, depth, slope, vec2(0.0));
  float visibility = 0.0;
  for (int row = -1; row <= 1; row++) {
    for (int column = -1; column <= 1; column++) {
      vec2 offset = vec2(float(column), float(row)) * sceneShadowSettings.y;
      visibility += sceneShadowSample(uv, depth, slope, offset);
    }
  }
  return visibility / 9.0;
}
vec3 sceneShadowSurfaceNormal() {
  // Derivatives must run before any fragment-dependent branch or alpha discard.
  vec3 geometric = cross(dFdx(sceneShadowWorldPosition), dFdy(sceneShadowWorldPosition));
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
}`;

export const SCENE_SHADOW_FRAGMENT_BEGIN = `
  vec3 sceneShadowNormal = sceneShadowSurfaceNormal();
  vec3 sceneShadowCoordinatesAtPixel = sceneShadowCoordinates();
  vec2 sceneShadowSlope = sceneShadowDepthSlope(sceneShadowCoordinatesAtPixel);`;

export const SCENE_SHADOW_FRAGMENT_APPLY = `
  if (sceneShadowReceiver > 0.5 && sceneShadowSettings.z > 0.5) {
    gl_FragColor.rgb *= sceneShadowLighting(sceneShadowNormal,
      sceneShadowVisibility(sceneShadowCoordinatesAtPixel, sceneShadowSlope));
  }`;

/** Materials remain unaffected until an actual scene mesh registers as a receiver. */
export function bindSceneShadowMaterial(material: ShaderMaterial, texture?: BaseTexture): void {
  if (texture) {
    textures.set(material, texture);
    material.getAlphaTestTexture = () => texture;
  }
  const owner = owners.get(material.getScene());
  if (!owner) return;
  owner.bindMaterial(material);
}

/** One map-wide light supplies surface lighting and model shadows, including tanks. */
export class SceneShadowLight {
  private readonly light: DirectionalLight;
  private readonly generator: ShadowGenerator;
  private readonly buffer: UniformBuffer;
  private readonly roots = new Set<ShadowRoot>();
  private readonly receivers = new Set<AbstractMesh>();
  private receiversChanged = false;
  private terrain: readonly AbstractMesh[] = [];
  private readonly updateFrame = (): void => {this.update();};

  constructor(private readonly scene: Scene) {
    owners.set(scene, this);
    this.light = new DirectionalLight('scene-shadow-light', new Vector3(0.4, -1, 0.3).normalize(), scene);
    this.light.setEnabled(false);
    this.light.autoCalcShadowZBounds = true;
    this.light.shadowOrthoScale = 0.05;
    this.light.specular = Color3.Black();
    this.generator = new ShadowGenerator(MAP_SIZE, this.light);
    this.generator.usePoissonSampling = true;
    this.generator.bias = 0.0005;
    this.generator.normalBias = 0.5;
    this.generator.transparencyShadow = true;
    this.generator.enableSoftTransparentShadow = true;
    this.generator.customAllowRendering = subMesh => this.eligible(subMesh.getMesh());
    this.buffer = new UniformBuffer(scene.getEngine(), undefined, true, 'scene-shadow-light', false, false);
    for (const name of ['sceneShadowDirection', 'sceneShadowColour', 'sceneShadowSettings', 'sceneShadowDepth']) {
      this.buffer.addUniform(name, 4);
    }
    this.buffer.addUniform('sceneShadowMatrix', 16);
    this.buffer.create();
    this.buffer.updateFloat4('sceneShadowDirection', this.light.direction.x,
      this.light.direction.y, this.light.direction.z, 0);
    this.buffer.updateFloat4('sceneShadowColour', 1, 1, 1, 0);
    this.buffer.updateFloat4('sceneShadowSettings', 0, 0, 0, 0);
    const near = this.light.getDepthMinZ(scene.activeCamera!);
    const far = this.light.getDepthMaxZ(scene.activeCamera!);
    this.buffer.updateFloat4('sceneShadowDepth', near, near + far,
      scene.getEngine().useReverseDepthBuffer ? -1 : 1, this.generator.bias * 0.1);
    this.buffer.updateMatrix('sceneShadowMatrix', Matrix.Identity());
    this.buffer.update();
    // Babylon fits the projection before this observer; receivers use that exact pass matrix.
    this.generator.getShadowMap()!.onBeforeRenderObservable.add(() => {
      this.buffer.updateMatrix('sceneShadowMatrix', this.generator.getTransformMatrix());
      this.buffer.update();
    });
    scene.onBeforeRenderObservable.add(this.updateFrame);
    scene.onDisposeObservable.addOnce(() => {this.dispose();});
  }

  bindMaterial(material: ShaderMaterial): void {
    material.setUniformBuffer('SceneShadowLight', this.buffer);
    material.setFloat('sceneShadowReceiver', 0);
    material.setFloat('sceneShadowSoftness', 1);
    material.setTexture('sceneShadowTexture', this.generator.getShadowMap()!);
  }

  /** Prepare each fragment model's shadow shader during map loading. */
  async prepareMeshes(meshes: readonly AbstractMesh[]): Promise<void> {
    const pending = meshes.filter(mesh => this.eligible(mesh)).flatMap(mesh => mesh.subMeshes);
    while (pending.length && !this.scene.isDisposed) {
      for (let index = pending.length - 1; index >= 0; index--) {
        const subMesh = pending[index];
        const mesh = subMesh.getMesh();
        const transparent = subMesh.getMaterial()?.needAlphaBlendingForMesh(mesh) ?? false;
        if (mesh.isDisposed() || this.generator.isReady(subMesh, false, transparent)) {
          pending.splice(index, 1);
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
      profile.softness / MAP_SIZE, 1, profile.ambient);
    this.buffer.update();
    const sky = this.scene.getLightByName('sky');
    if (sky instanceof HemisphericLight) sky.intensity = profile.ambient * 1.2;
    this.light.setEnabled(true);
  }

  addRoot(root: TransformNode, options: {dynamic?: boolean; softShadows?: boolean;
    meshes?: () => readonly AbstractMesh[]} = {}): () => void {
    const entry = {root, dynamic: options.dynamic ?? false,
      softShadows: options.softShadows ?? true, meshes: options.meshes};
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
    this.receiversChanged = false;
    this.terrain = [];
    this.light.includedOnlyMeshes = [];
    this.light.setEnabled(false);
    this.generator.getShadowMap()!.renderList = [];
    this.buffer.updateFloat4('sceneShadowSettings', 0, 0, 0, 0);
    this.buffer.update();
  }

  private update(): void {
    if (!this.terrain.length) return;
    const casters = new Set(this.terrain);
    for (const entry of this.roots) {
      if (entry.root.isDisposed()) {this.roots.delete(entry); continue;}
      for (const mesh of entry.meshes?.() ?? entry.root.getChildMeshes()) {
        if (!this.eligible(mesh)) continue;
        this.receive(mesh, entry.softShadows);
        if (entry.root.isEnabled() && mesh.isEnabled() && mesh.isVisible && mesh.visibility > 0) {
          mesh.computeWorldMatrix(true);
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
    this.generator.getShadowMap()!.renderList = [...casters];
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
    const name = `${mesh.name} ${material?.name ?? ''} ${material?.metadata?.sourceTerrainTexture ?? ''} ${texture?.name ?? ''}`.toLowerCase();
    return !/(sky|cloud|beijing|shu_hou|tree02)/.test(name) && !material?.metadata?.sourcePlantModel;
  }

  private dispose(): void {
    this.clear();
    this.roots.clear();
    this.scene.onBeforeRenderObservable.removeCallback(this.updateFrame);
    this.generator.dispose();
    this.light.dispose();
    this.buffer.dispose();
    owners.delete(this.scene);
  }
}

export function sceneShadowLight(scene: Scene): SceneShadowLight | undefined {
  return owners.get(scene);
}
