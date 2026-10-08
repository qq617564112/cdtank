import {Color3, DynamicTexture, PBRMaterial, Scene, Texture} from '@babylonjs/core';
import {smoothstep} from './geometry';

export type SuitColor = 'silver' | 'red' | 'blue' | 'dark';
export type Paint = (u: number, v: number) => SuitColor;

interface Finish {
  readonly color: string;
  readonly metallic: number;
  readonly roughness: number;
}

const FINISHES: Record<SuitColor, Finish> = {
  silver: {color: '#b6b8c0', metallic: 0.68, roughness: 0.37},
  red: {color: '#b82530', metallic: 0.12, roughness: 0.48},
  blue: {color: '#21457e', metallic: 0.15, roughness: 0.43},
  dark: {color: '#33373e', metallic: 0.40, roughness: 0.43},
};

export function solidMaterial(scene: Scene, name: string, color: string,
  metallic: number, roughness: number): PBRMaterial {
  const material = new PBRMaterial(name, scene);
  material.albedoColor = Color3.FromHexString(color);
  material.metallic = metallic;
  material.roughness = roughness;
  material.environmentIntensity = 0.85;
  material.backFaceCulling = false;
  return material;
}

/** Paint and surface finish share UVs, so silver highlights follow the suit panels. */
export function suitMaterial(scene: Scene, name: string, paint: Paint,
  size = 1024): PBRMaterial {
  const albedo = new DynamicTexture(`${name}-color`, size, scene, true,
    Texture.TRILINEAR_SAMPLINGMODE);
  const finish = new DynamicTexture(`${name}-finish`, size, scene, true,
    Texture.TRILINEAR_SAMPLINGMODE);
  const colorContext = albedo.getContext();
  const finishContext = finish.getContext();
  const colorImage = new ImageData(size, size);
  const finishImage = new ImageData(size, size);
  const palette = Object.fromEntries(Object.entries(FINISHES).map(([key, value]) => {
    const color = Color3.FromHexString(value.color);
    return [key, [color.r * 255, color.g * 255, color.b * 255]];
  })) as Record<SuitColor, number[]>;
  for (let y = 0; y < size; y++) {
    const v = 1 - y / (size - 1);
    for (let x = 0; x < size; x++) {
      const u = x / (size - 1);
      const panel = paint(u, v);
      const rgb = palette[panel];
      const surface = FINISHES[panel];
      const noise = (Math.sin(x * 73.17 + y * 19.37) * 43758.5453) % 1;
      const grain = noise * (panel === 'silver' ? 1.0 : 0.65);
      const index = (y * size + x) * 4;
      colorImage.data[index] = rgb[0] + grain;
      colorImage.data[index + 1] = rgb[1] + grain;
      colorImage.data[index + 2] = rgb[2] + grain;
      colorImage.data[index + 3] = 255;
      finishImage.data[index] = 255;
      finishImage.data[index + 1] = surface.roughness * 255;
      finishImage.data[index + 2] = surface.metallic * 255;
      finishImage.data[index + 3] = 255;
    }
  }
  colorContext.putImageData(colorImage, 0, 0);
  finishContext.putImageData(finishImage, 0, 0);
  albedo.update();
  finish.update();
  albedo.wrapU = Texture.WRAP_ADDRESSMODE;
  albedo.wrapV = Texture.CLAMP_ADDRESSMODE;
  finish.wrapU = Texture.WRAP_ADDRESSMODE;
  finish.wrapV = Texture.CLAMP_ADDRESSMODE;
  finish.gammaSpace = false;
  const material = solidMaterial(scene, name, '#ffffff', 1, 1);
  material.albedoTexture = albedo;
  material.metallicTexture = finish;
  material.useRoughnessFromMetallicTextureAlpha = false;
  material.useRoughnessFromMetallicTextureGreen = true;
  material.useMetallnessFromMetallicTextureBlue = true;
  return material;
}

export function torsoPaint(u: number, v: number): SuitColor {
  const angle = (u - 0.5) * Math.PI * 2;
  const side = Math.abs(Math.sin(angle));
  const front = Math.cos(angle) >= 0;
  const y = 0.865 + v * 0.813;
  const redEdge = (front ? 1.305 : 1.35) + (front ? 0.215 : 0.175) * side ** 0.62;
  if (y > redEdge) return 'red';
  const silverEdge = (front ? 1.105 : 1.225) + (front ? 0.225 : 0.12) * side ** 1.05;
  if (y > silverEdge) return 'silver';
  const hipStripe = 0.89 + 0.07 * smoothstep(0.91, 1.24, y);
  if (y < 1.26 && side > hipStripe) return 'red';
  if (y < 1.30 && side > hipStripe - 0.065) return 'silver';
  return 'blue';
}

export function headPaint(u: number, v: number): SuitColor {
  const angle = (u - 0.5) * Math.PI * 2;
  const y = 1.645 + v * 0.355;
  if (Math.cos(angle) < -0.06 && Math.abs(Math.sin(angle)) < 0.9
    && y < 1.957 - 0.036 * Math.abs(Math.sin(angle))) return 'red';
  return 'silver';
}

export function armPaint(u: number, v: number): SuitColor {
  const angle = u * Math.PI * 2;
  const top = Math.cos(angle);
  const visibleSide = Math.abs(Math.sin(angle));
  const x = 0.208 + v * 0.598;
  const shoulderCap = 0.035 + 0.70 * Math.exp(-(((x - 0.268) / 0.045) ** 2));
  if (x < 0.66 && top > shoulderCap + 0.50 * smoothstep(0.44, 0.67, x)) return 'red';
  const blueEdge = -0.25 + 0.29 * Math.exp(-(((x - 0.58) / 0.10) ** 2));
  if (x > 0.29 && x < 0.722 && top < blueEdge && visibleSide > 0.40) return 'blue';
  return 'silver';
}

export function legPaint(side: number): Paint {
  return (u, v) => {
    const angle = (u - 0.5) * Math.PI * 2;
    const y = 0.105 + v * 0.945;
    if (y < 0.535) return 'silver';
    const outside = side * Math.sin(angle);
    const taper = 0.90 - 0.62 * smoothstep(0.55, 0.81, y);
    if (outside > taper) return 'red';
    if (outside > taper - 0.15) return 'silver';
    const blueBottom = 0.525 + 0.11 * Math.max(0, outside);
    if (y > blueBottom) return 'blue';
    return 'silver';
  };
}
