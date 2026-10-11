import './tank-audit.css';
import {prepareGameContent} from '../../apps/web/src/content';
import {loadStaticJson} from '../../apps/web/src/assets/static-resources';
import type {TankDefinition} from '../../apps/shared/content/types';
import type {OwnedTankTextures} from '../../apps/shared/combat/role-owned-textures';
import {TankPreview} from './tank-preview';
import type {TankTextureSample} from './tank-preview';

interface TrackAnimation {
  frames: string[];
  frameDuration: number;
}

interface Skin {
  suffix: string;
  name: string;
  ids: OwnedTankTextures;
}

interface HdManifest {
  tanks: Array<{tank: string; textures: string[]}>;
  textureCount: number;
}

const tankSelect = document.querySelector<HTMLSelectElement>('#tank')!;
const skinSelect = document.querySelector<HTMLSelectElement>('#skin')!;
const qualitySelect = document.querySelector<HTMLSelectElement>('#quality')!;
const tracksSelect = document.querySelector<HTMLSelectElement>('#tracks')!;
const motionSelect = document.querySelector<HTMLSelectElement>('#motion')!;
const status = document.querySelector<HTMLOutputElement>('#status')!;
const play = document.querySelector<HTMLButtonElement>('#play')!;
const retry = document.querySelector<HTMLButtonElement>('#retry')!;
const controls = [...document.querySelectorAll<HTMLFieldSetElement>('fieldset')];
let preview: TankPreview;
let tanks: TankDefinition[] = [];
let animations: Record<string, TrackAnimation> = {};
let skins: Skin[] = [];
let hdManifest: HdManifest;
let apiManifest: HdManifest;

function tankSkins(tank: TankDefinition): Skin[] {
  const grouped = new Map<string, Skin>();
  for (const row of tank.resources.textureVariants) {
    if (row.part !== 'M' && row.part !== 'U') continue;
    const suffix = /[MU]_(\d+)\./.exec(row.filename)?.[1];
    if (!suffix) continue;
    let skin = grouped.get(suffix);
    if (!skin) {
      skin = {suffix, name: row.name, ids: {M: 0, U: 0, XY: 0}};
      grouped.set(suffix, skin);
    }
    skin.ids[row.part] = row.recordId;
  }
  return [...grouped.values()].sort((a, b) => a.suffix.localeCompare(b.suffix));
}

function currentTank(): TankDefinition {
  return tanks.find(tank => tank.id === Number(tankSelect.value))!;
}

function selectTank(): void {
  const tank = currentTank();
  skins = tankSkins(tank);
  skinSelect.replaceChildren(new Option('默认外观', 'default'),
    ...(tank.id === 1 ? [
      new Option('Image 2.5 · 单图重绘', 'image25'),
      new Option('Image 2.5 · 固定边界', 'image25-bounded'),
      new Option('Image 2.5 · UV 对齐', 'image25-uv-aligned'),
      new Option('原版 · 256 px', 'vector-original'),
      new Option('Waifu2x · 不去噪 · 1024 px', 'upscale-waifu2x'),
      new Option('Real-CUGAN · 保守版 · 1024 px', 'upscale-cugan-conservative'),
      new Option('Real-CUGAN · 不去噪 · 1024 px', 'upscale-cugan-nodenoise'),
      new Option('Real-CUGAN · UV 分块 · 1024 px', 'upscale-cugan-split'),
      new Option('Real-CUGAN · UV 分块＋原版细节 · 1024 px', 'upscale-cugan-split-detail'),
      new Option('SwinIR · 经典超分 · 1024 px', 'upscale-swinir-classical'),
      new Option('Real-ESRGAN · 动漫 6B · 1024 px', 'upscale-esrgan-anime6b'),
      new Option('Real-ESRGAN · 动漫视频 v3 · 1024 px', 'upscale-esrgan-animevideo'),
      new Option('v3 · 几何细节重绘 · 1024 px', 'upscale-v3-geometry'),
      new Option('手绘非迷彩细节 · 512→2048→1024 px', 'upscale-manual-all'),
      new Option('手绘非迷彩细节 · UV 对齐 · 1024 px', 'upscale-manual-uv'),
      new Option('Lanczos · 插值 · 1024 px', 'upscale-lanczos'),
      new Option('VTracer · 多边形 · 4096 px', 'vector-polygon'),
      new Option('VTracer · 曲线 · 4096 px', 'vector-spline'),
      new Option('ImageTracerJS · 4096 px', 'vector-imagetracer'),
    ] : []),
    ...skins.map(skin => new Option(`${skin.suffix} · ${skin.name}`, skin.suffix)));
  skinSelect.value = skins.find(skin => skin.suffix === '001')?.suffix ?? 'default';
  tracksSelect.replaceChildren(new Option('默认履带', '0'),
    ...tank.resources.textureVariants.filter(row => row.part === 'XY')
      .map(row => new Option(row.name, String(row.recordId))));
  const animation = animations[String(tank.id)];
  document.querySelector('#animation-info')!.textContent =
    `${animation.frames.length} 帧履带 · 每帧 ${animation.frameDuration * 1000} ms`;
}

async function loadSelection(): Promise<void> {
  controls.forEach(control => {control.disabled = true;});
  retry.hidden = true;
  status.value = '载入模型和贴图…';
  const tank = currentTank();
  const skin = skins.find(value => value.suffix === skinSelect.value);
  const sample = tank.id === 1 &&
    ['image25', 'image25-bounded', 'image25-uv-aligned',
      'vector-original', 'vector-polygon', 'vector-spline',
      'vector-imagetracer', 'upscale-waifu2x', 'upscale-cugan-conservative',
      'upscale-cugan-nodenoise', 'upscale-cugan-split',
      'upscale-cugan-split-detail', 'upscale-swinir-classical',
      'upscale-esrgan-anime6b', 'upscale-esrgan-animevideo',
      'upscale-v3-geometry',
      'upscale-manual-all',
      'upscale-manual-uv',
      'upscale-lanczos'].includes(skinSelect.value);
  const sampleFolder = skinSelect.value;
  const ids = {...(skin?.ids ?? {M: 0, U: 0, XY: 0}), XY: Number(tracksSelect.value)};
  const tankCode = String(tank.id).padStart(3, '0');
  const hdTank = hdManifest.tanks.find(row => row.tank === tankCode);
  const apiTank = apiManifest.tanks.find(row => row.tank === tankCode);
  const suffix = skin?.suffix ?? '001';
  const textureOverrides: TankTextureSample = {};
  let useHd = false;
  let apiParts = 0;
  let totalParts = 0;
  if (!sample) {
    for (const part of ['M', 'U'] as const) {
      if (!tank.resources.components.some(component =>
        component.part === part && component.actions.length > 0)) continue;
      totalParts++;
      const partSuffix = skin && skin.ids[part] === 0 ? '001' : suffix;
      const filename = `${tankCode}${part}_${partSuffix}.png`;
      if (qualitySelect.value === 'api4k' && apiTank?.textures.includes(filename)) {
        textureOverrides[part] = `tank-audit/api4k/${tankCode}/${filename}`;
        apiParts++;
      } else if (qualitySelect.value === 'hd' && hdTank?.textures.includes(filename)) {
        textureOverrides[part] = `tank-audit/hd/${tankCode}/${filename}`;
        useHd = true;
      } else {
        textureOverrides[part] = `tank-audit/original/${tankCode}/${filename}`;
      }
    }
  }
  try {
    await preview.load(tank.id, ids, sample ? {
      M: `tank-audit/${sampleFolder}/001M_001.png`, U: `tank-audit/${sampleFolder}/001U_001.png`,
    } : textureOverrides);
    const label = sample ? skinSelect.selectedOptions[0].text : skin ? `${skin.suffix} · ${skin.name}` : '默认外观';
    document.querySelector('#asset-title')!.textContent = `${String(tank.id).padStart(3, '0')} · ${tank.name}`;
    const version = sample ? '' : qualitySelect.value === 'api4k' ?
      apiParts === totalParts ? 'API 4K · ' : `API 4K ${apiParts}/${totalParts} 部件（其余原版） · ` :
      useHd ? '高清 1024 · ' : '原版 · ';
    document.querySelector('#asset-detail')!.textContent = `${version}${label} / ${tracksSelect.selectedOptions[0].text}`;
    status.value = `已载入 · ${version}M ${ids.M} / U ${ids.U} / XY ${ids.XY}`;
    const url = new URL(location.href);
    url.searchParams.set('tank', String(tank.id));
    url.searchParams.set('skin', skinSelect.value);
    url.searchParams.set('tracks', tracksSelect.value);
    url.searchParams.set('quality', qualitySelect.value);
    history.replaceState(null, '', url);
  } catch (error) {
    status.value = `载入失败：${error instanceof Error ? error.message : String(error)}`;
    retry.hidden = false;
  } finally {
    controls.forEach(control => {control.disabled = false;});
  }
}

function updatePlay(playing: boolean): void {
  preview.playing = playing;
  play.textContent = playing ? '暂停' : '播放';
  play.setAttribute('aria-pressed', String(playing));
}

async function initialize(): Promise<void> {
  preview = new TankPreview(document.querySelector<HTMLCanvasElement>('#world')!);
  const [content, trackAnimations, hdTextures, apiTextures] = await Promise.all([
    prepareGameContent(), loadStaticJson<Record<string, TrackAnimation>>('/tank-track-animations.json'),
    loadStaticJson<HdManifest>('/tank-audit/hd/manifest.json'),
    loadStaticJson<HdManifest>('/tank-audit/api4k/manifest.json'),
  ]);
  tanks = [...content.tanks.values()].sort((a, b) => a.id - b.id);
  animations = trackAnimations;
  hdManifest = hdTextures;
  apiManifest = apiTextures;
  tankSelect.replaceChildren(...tanks.map(tank => new Option(
    `${String(tank.id).padStart(3, '0')} · ${tank.name}`, String(tank.id))));
  const params = new URL(location.href).searchParams;
  if (['original', 'hd', 'api4k'].includes(params.get('quality') ?? '')) {
    qualitySelect.value = params.get('quality')!;
  }
  if (tanks.some(tank => String(tank.id) === params.get('tank'))) tankSelect.value = params.get('tank')!;
  selectTank();
  if ([...skinSelect.options].some(option => option.value === params.get('skin'))) {
    skinSelect.value = params.get('skin')!;
  }
  if ([...tracksSelect.options].some(option => option.value === params.get('tracks'))) {
    tracksSelect.value = params.get('tracks')!;
  }
  const skinCount = tanks.reduce((sum, tank) => sum + tankSkins(tank).length, 0);
  document.querySelector('#coverage')!.textContent =
    `${tanks.length} 辆坦克 · ${skinCount} 套皮肤 · API 4K 已就绪 ${apiManifest.textureCount}/518 张`;
  await loadSelection();
}

tankSelect.addEventListener('change', () => {selectTank(); void loadSelection();});
skinSelect.addEventListener('change', () => {void loadSelection();});
qualitySelect.addEventListener('change', () => {void loadSelection();});
tracksSelect.addEventListener('change', () => {void loadSelection();});
for (const [id, delta] of [['previous-skin', -1], ['next-skin', 1]] as const) {
  document.querySelector(`#${id}`)!.addEventListener('click', () => {
    skinSelect.selectedIndex = (skinSelect.selectedIndex + delta + skinSelect.length) % skinSelect.length;
    void loadSelection();
  });
}
motionSelect.addEventListener('change', () => {
  controls.forEach(control => {control.disabled = true;});
  void preview.setMotion(Number(motionSelect.value)).catch(error => {
    status.value = `动作载入失败：${error instanceof Error ? error.message : String(error)}`;
  }).finally(() => {controls.forEach(control => {control.disabled = false;});});
});
document.querySelector<HTMLSelectElement>('#speed')!.addEventListener('change', event => {
  preview.speed = Number((event.currentTarget as HTMLSelectElement).value);
});
play.addEventListener('click', () => updatePlay(!preview.playing));
document.querySelector('#step')!.addEventListener('click', () => {
  updatePlay(false);
  preview.advance(animations[String(currentTank().id)].frameDuration);
});
document.querySelectorAll<HTMLButtonElement>('[data-view]').forEach(button => {
  button.addEventListener('click', () => preview.setView(button.dataset.view!));
});
document.querySelector<HTMLSelectElement>('#background')!.addEventListener('change', event => {
  preview.setBackground((event.currentTarget as HTMLSelectElement).value);
});
retry.addEventListener('click', () => {void loadSelection();});
void initialize().catch(error => {
  status.value = `初始化失败：${error instanceof Error ? error.message : String(error)}`;
});
