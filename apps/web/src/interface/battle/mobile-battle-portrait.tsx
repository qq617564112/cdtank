import {imageResourceUrl} from '../../assets/image-cache';

/** Expressions share their pet's source-pixel scale; offsets only place the artwork. */
const PET_VIEWPORT_SIZES: Readonly<Record<string, number>> = {
  '1': 340,
  '101': 359,
  '102': 393,
  '103': 382,
  '104': 422,
  '105': 398,
  '2': 335,
  '3': 436,
  '4': 390,
  '5': 441,
};

const PORTRAIT_CENTRES: Readonly<Record<string, readonly [number, number]>> = {
  'ui/battle/portraits/pet-1-attack.webp': [242.5, 212.5],
  'ui/battle/portraits/pet-1-normal.webp': [191, 247],
  'ui/battle/portraits/pet-1-wound.webp': [210.5, 213.5],
  'ui/battle/portraits/pet-1-yeah1.webp': [188.5, 206],
  'ui/battle/portraits/pet-1-yeah2.webp': [200, 207.5],
  'ui/battle/portraits/pet-101-attack.webp': [242.5, 196.5],
  'ui/battle/portraits/pet-101-normal.webp': [163.5, 241],
  'ui/battle/portraits/pet-101-wound.webp': [209, 210.5],
  'ui/battle/portraits/pet-101-yeah1.webp': [189, 206],
  'ui/battle/portraits/pet-101-yeah2.webp': [210, 206],
  'ui/battle/portraits/pet-102-attack.webp': [250, 193],
  'ui/battle/portraits/pet-102-normal.webp': [176, 225],
  'ui/battle/portraits/pet-102-wound.webp': [206, 208.5],
  'ui/battle/portraits/pet-102-yeah1.webp': [216.5, 197.5],
  'ui/battle/portraits/pet-102-yeah2.webp': [216.5, 197.5],
  'ui/battle/portraits/pet-103-attack.webp': [263.5, 195.5],
  'ui/battle/portraits/pet-103-normal.webp': [207.5, 238],
  'ui/battle/portraits/pet-103-wound.webp': [209, 211],
  'ui/battle/portraits/pet-103-yeah1.webp': [208, 207],
  'ui/battle/portraits/pet-103-yeah2.webp': [238, 207.5],
  'ui/battle/portraits/pet-104-attack.webp': [272, 197.5],
  'ui/battle/portraits/pet-104-normal.webp': [198, 205],
  'ui/battle/portraits/pet-104-wound.webp': [213, 210.5],
  'ui/battle/portraits/pet-104-yeah1.webp': [204, 197.5],
  'ui/battle/portraits/pet-104-yeah2.webp': [209.5, 197.5],
  'ui/battle/portraits/pet-105-attack.webp': [248, 202.5],
  'ui/battle/portraits/pet-105-normal.webp': [187, 225],
  'ui/battle/portraits/pet-105-wound.webp': [209, 210],
  'ui/battle/portraits/pet-105-yeah1.webp': [196.5, 193.5],
  'ui/battle/portraits/pet-105-yeah2.webp': [189, 190],
  'ui/battle/portraits/pet-2-attack.webp': [252, 211.5],
  'ui/battle/portraits/pet-2-normal.webp': [170.5, 238.5],
  'ui/battle/portraits/pet-2-wound.webp': [211, 213.5],
  'ui/battle/portraits/pet-2-yeah1.webp': [217, 203],
  'ui/battle/portraits/pet-2-yeah2.webp': [227, 208],
  'ui/battle/portraits/pet-3-attack.webp': [242.5, 190.5],
  'ui/battle/portraits/pet-3-normal.webp': [183.5, 230.5],
  'ui/battle/portraits/pet-3-wound.webp': [209, 207.5],
  'ui/battle/portraits/pet-3-yeah1.webp': [157.5, 198.5],
  'ui/battle/portraits/pet-3-yeah2.webp': [293, 195],
  'ui/battle/portraits/pet-4-attack.webp': [249, 186],
  'ui/battle/portraits/pet-4-normal.webp': [159.5, 232.5],
  'ui/battle/portraits/pet-4-wound.webp': [228.5, 215.5],
  'ui/battle/portraits/pet-4-yeah1.webp': [199, 208],
  'ui/battle/portraits/pet-4-yeah2.webp': [247.5, 249],
  'ui/battle/portraits/pet-5-attack.webp': [250.5, 206],
  'ui/battle/portraits/pet-5-normal.webp': [230.5, 212],
  'ui/battle/portraits/pet-5-wound.webp': [250, 220],
  'ui/battle/portraits/pet-5-yeah1.webp': [217.5, 195.5],
  'ui/battle/portraits/pet-5-yeah2.webp': [266.5, 195.5],
  'ui/regions/77/15.webp': [324, 408],
};

export function MobileBattlePortrait({asset}: {asset: string}) {
  const path = asset.replace(/^\//, '');
  const petId = /^ui\/battle\/portraits\/pet-(\d+)-/.exec(path)?.[1];
  const [centreX, centreY] = PORTRAIT_CENTRES[path];
  const size = petId ? PET_VIEWPORT_SIZES[petId] : 589;
  const width = petId ? 504 : 816;
  const height = petId ? 420 : 680;
  return <svg viewBox={`${centreX - size / 2} ${centreY - size / 2} ${size} ${size}`}
    preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">
    <image href={imageResourceUrl(asset)} width={width} height={height} preserveAspectRatio="xMidYMid meet"/>
  </svg>;
}
