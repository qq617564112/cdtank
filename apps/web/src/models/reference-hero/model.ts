import {Color3, Mesh, MeshBuilder, Scene, TransformNode, Vector3} from '@babylonjs/core';
import type {PBRMaterial} from '@babylonjs/core';
import {facetedGem, surfacePatch, surfaceRibbon} from './geometry';
import type {Point2, Projection} from './geometry';
import {createContinuousBody} from './continuous-body';
import type {ContinuousBody} from './continuous-body';
import {solidMaterial} from './materials';

export interface ReferenceHero {
  readonly root: TransformNode;
  readonly meshes: Mesh[];
  readonly height: number;
  readonly span: number;
}

function scaleOutline(outline: readonly Point2[], scale: number): Point2[] {
  const center = outline.reduce((p, q) => ({x: p.x + q.x / outline.length,
    y: p.y + q.y / outline.length}), {x: 0, y: 0});
  return outline.map(p => ({x: center.x + (p.x - center.x) * scale,
    y: center.y + (p.y - center.y) * scale}));
}

export async function createReferenceHero(scene: Scene): Promise<ReferenceHero> {
  const root = new TransformNode('reference-hero', scene);
  root.metadata = {heightMeters: 2, pose: 'T', reference:
    'nanobanana-preview-original-2026-10-07T03-03-04-732Z.png'};
  const silver = solidMaterial(scene, 'brushed-silver', '#aaaab2', 0.18, 0.65);
  const silverEdge = solidMaterial(scene, 'silver-trim', '#c2c2c7', 0.22, 0.62);
  const gold = solidMaterial(scene, 'warm-gold', '#c5a25e', 0.30, 0.59);
  const dark = solidMaterial(scene, 'inset-shadow', '#3e3f43', 0.30, 0.48);
  const red = solidMaterial(scene, 'red-seam', '#b82530', 0.02, 0.72);
  const eye = solidMaterial(scene, 'ivory-eye-lenses', '#e7dbc0', 0.02, 0.48);
  eye.emissiveColor = Color3.FromHexString('#f4dda3').scale(0.035);
  const crystal = solidMaterial(scene, 'turquoise-crystal', '#19a4b8', 0.28, 0.18);
  crystal.emissiveColor = Color3.FromHexString('#168eac').scale(0.035);

  const body = await createContinuousBody(scene, root);
  addChestDetails(scene, root, body, silverEdge, gold, dark, crystal, red);
  addFaceDetails(scene, root, body, silver, silverEdge, gold, dark, eye, crystal, red);
  for (const side of [-1, 1]) addThumb(scene, root, side, silver);
  return {root, meshes: root.getChildMeshes() as Mesh[], height: 2, span: 1.96};
}

function addChestDetails(scene: Scene, root: TransformNode, body: ContinuousBody, silver: PBRMaterial,
  gold: PBRMaterial, dark: PBRMaterial, crystal: PBRMaterial, red: PBRMaterial): void {
  const front = body.front;
  const back = body.back;
  const collar: readonly Point2[] = [
    {x: -0.185, y: 1.611}, {x: -0.173, y: 1.535}, {x: -0.146, y: 1.491},
    {x: -0.095, y: 1.461}, {x: -0.045, y: 1.432}, {x: 0, y: 1.385},
    {x: 0.045, y: 1.432}, {x: 0.095, y: 1.461}, {x: 0.146, y: 1.491},
    {x: 0.173, y: 1.535}, {x: 0.185, y: 1.611},
  ];
  for (const [label, project] of [['front', front], ['back', back]] as const) {
    surfaceRibbon(scene, root, `${label}-collar-recess`, collar, project,
      dark, 0.051, 0.002, 0.004);
    surfaceRibbon(scene, root, `${label}-silver-collar-border`, collar, project,
      silver, 0.047, 0.005, 0.006);
    surfaceRibbon(scene, root, `${label}-gold-collar-inlay`, collar, project,
      gold, 0.025, 0.012, 0.006);
  }
  const emblem = [{x: -0.018, y: 1.519}, {x: 0.018, y: 1.519},
    {x: 0.033, y: 1.480}, {x: 0, y: 1.446}, {x: -0.033, y: 1.480}];
  facetedGem(scene, root, 'chest-emblem-recess', scaleOutline(emblem, 1.14),
    front, dark, 0.003, 0.011);
  facetedGem(scene, root, 'chest-emblem-gold-mount', emblem, front, gold, 0.010, 0.017);
  facetedGem(scene, root, 'chest-turquoise-gem', scaleOutline(emblem, 0.70),
    front, crystal, 0.028, 0.012);
  surfaceRibbon(scene, root, 'back-center-zipper', [{x: 0, y: 1.62},
    {x: 0, y: 1.46}, {x: 0, y: 1.29}, {x: 0, y: 1.065}],
    back, dark, 0.004, 0.001, 0.001);
  surfaceRibbon(scene, root, 'back-red-collar-spine', [{x: 0, y: 1.674},
    {x: 0, y: 1.61}, {x: 0, y: 1.49}, {x: 0, y: 1.35}],
    back, red, 0.014, 0.009, 0.006);
}

function addFaceDetails(scene: Scene, root: TransformNode, body: ContinuousBody, silver: PBRMaterial,
  silverEdge: PBRMaterial, gold: PBRMaterial, dark: PBRMaterial,
  eye: PBRMaterial, crystal: PBRMaterial, red: PBRMaterial): void {
  const front = body.front;
  const back = body.back;
  for (const side of [-1, 1]) {
    const label = side === 1 ? 'left' : 'right';
    const lens = [{x: 0.018, y: 1.807}, {x: 0.035, y: 1.824},
      {x: 0.068, y: 1.833}, {x: 0.092, y: 1.830}, {x: 0.086, y: 1.807},
      {x: 0.062, y: 1.788}, {x: 0.034, y: 1.786}]
      .map(p => ({x: p.x * side, y: p.y}));
    surfacePatch(scene, root, `${label}-eye-socket`, scaleOutline(lens, 1.14),
      front, dark, 0.0015, 0.002);
    surfacePatch(scene, root, `${label}-ivory-lens`, lens, front, eye, 0.004, 0.009);
    surfaceRibbon(scene, root, `${label}-forehead-contour`, [
      {x: 0, y: 1.995}, {x: side * 0.040, y: 1.946},
      {x: side * 0.062, y: 1.901}, {x: side * 0.040, y: 1.866},
      {x: side * 0.011, y: 1.840},
    ], front, silverEdge, 0.010, 0.003, 0.003);
    surfaceRibbon(scene, root, `${label}-temple-edge`, [
      {x: side * 0.094, y: 1.891}, {x: side * 0.119, y: 1.829},
      {x: side * 0.111, y: 1.773}, {x: side * 0.084, y: 1.712},
    ], front, silver, 0.006, 0.002, 0.002);
    const earProjection: Projection = body.side(side);
    const ear = [{x: -0.008, y: 1.818}, {x: 0.031, y: 1.826},
      {x: 0.026, y: 1.783}, {x: -0.009, y: 1.760}];
    surfacePatch(scene, root, `${label}-ear-silver-rim`, scaleOutline(ear, 1.18),
      earProjection, silverEdge, 0.001, 0.001);
    surfacePatch(scene, root, `${label}-ear-recess`, ear, earProjection, dark, 0.003, 0.001);
    surfacePatch(scene, root, `${label}-ear-inset`, scaleOutline(ear, 0.70),
      earProjection, silver, 0.005, 0.001);
  }
  const crest = [{x: 0, y: 1.970}, {x: 0.024, y: 1.924},
    {x: 0.010, y: 1.879}, {x: 0, y: 1.854}, {x: -0.010, y: 1.879},
    {x: -0.024, y: 1.924}];
  facetedGem(scene, root, 'forehead-gold-crest', crest, front, gold, 0.003, 0.006);
  const foreheadStone = [{x: 0, y: 1.929}, {x: 0.009, y: 1.908},
    {x: 0, y: 1.882}, {x: -0.009, y: 1.908}];
  facetedGem(scene, root, 'forehead-crystal', foreheadStone, front, crystal, 0.010, 0.003);
  surfaceRibbon(scene, root, 'central-nose-ridge', [{x: 0, y: 1.844},
    {x: 0, y: 1.790}, {x: 0, y: 1.742}, {x: 0, y: 1.727}],
    front, silver, 0.014, 0.001, 0.004);
  const mouth = [{x: -0.049, y: 1.719}, {x: 0, y: 1.725},
    {x: 0.049, y: 1.719}, {x: 0.028, y: 1.703}, {x: 0, y: 1.699},
    {x: -0.028, y: 1.703}];
  surfacePatch(scene, root, 'mouth-recess', mouth, front, dark, 0.002, 0.001);
  surfaceRibbon(scene, root, 'upper-mouth-edge', [{x: -0.047, y: 1.719},
    {x: 0, y: 1.724}, {x: 0.047, y: 1.719}], front, silverEdge, 0.006, 0.005, 0.001);
  const chin = [{x: -0.031, y: 1.703}, {x: 0.031, y: 1.703},
    {x: 0.025, y: 1.664}, {x: 0, y: 1.655}, {x: -0.025, y: 1.664}];
  surfacePatch(scene, root, 'chin-inset-border', scaleOutline(chin, 1.10),
    front, dark, 0.002, 0.001);
  surfacePatch(scene, root, 'chin-silver-plate', chin, front, silver, 0.004, 0.003);
  surfaceRibbon(scene, root, 'chin-center-groove', [{x: 0, y: 1.701},
    {x: 0, y: 1.663}], front, dark, 0.0025, 0.007, 0.001);
  surfaceRibbon(scene, root, 'helmet-rear-ridge', [{x: 0, y: 1.959},
    {x: 0, y: 1.908}, {x: 0, y: 1.811}, {x: 0, y: 1.716},
    {x: 0, y: 1.655}], back, red, 0.011, 0.005, 0.003);
}

function addThumb(scene: Scene, root: TransformNode, side: number,
  silver: PBRMaterial): void {
  const label = side === 1 ? 'left' : 'right';
  const thumb = MeshBuilder.CreateTube(`${label}-thumb`, {
    path: [new Vector3(side * 0.824, 1.469, -0.023),
      new Vector3(side * 0.842, 1.465, -0.044),
      new Vector3(side * 0.862, 1.463, -0.063),
      new Vector3(side * 0.886, 1.468, -0.065),
      new Vector3(side * 0.890, 1.469, -0.064)],
    radiusFunction: (index: number) => index === 4 ? 0.002 : 0.011 - index * 0.001,
    tessellation: 12, cap: Mesh.CAP_ALL,
  }, scene);
  thumb.material = silver;
  thumb.parent = root;
}
