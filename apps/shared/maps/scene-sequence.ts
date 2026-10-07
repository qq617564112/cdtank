export type SceneSequenceMapId = '0008' | '0013';

export interface SceneSequencePlacementKey {
  mapId: SceneSequenceMapId;
  sourcePlacementId: string;
}

export interface SceneSequenceFrame {
  reference: string;
  asset: string;
}

export interface SceneSequenceLibrary {
  schemaVersion: 1;
  className: 'SYcScnObjSequence';
  model: 'obj05023';
  source: {
    vtable: '0x5c77e0';
    loader: '0x460bcd';
    update: '0x45f298';
    screenNodes: '0x44ef5e';
    textureAssign: '0x5c09b8';
  };
  base: {
    reference: 'Data/scnobj/obj05023/obj05023.POL';
    asset: 'Data/scnobj/obj05023/obj05023.glb';
    texture: 'Data/scnobj/obj05023/obj05023.png';
  };
  screen: {
    reference: 'Data/scnobj/obj05023/scr.POL';
    asset: 'Data/scnobj/obj05023/scr.glb';
  };
  frames: SceneSequenceFrame[];
  delay: {
    sourceValue: 100;
    sourceMultiplierF32: number;
    seconds: number;
  };
  placements: SceneSequencePlacementKey[];
}
