import {loadStaticJson} from '../assets/static-resources';
import {loadAudioBuffer} from './audio-resources';
import {listenForAudioInteraction} from './audio-interaction';

interface ButtonSoundCatalog {
  soundIds: {id: number; asset: string}[];
}

const BUTTON_SELECTOR = 'button, input[type="button"], input[type="submit"], input[type="reset"], '
  + 'input[type="checkbox"], input[type="radio"], [data-button-sound]';
let buttonSound: ButtonSound | undefined;
let battleSceneActive = false;

/** The loading screen, orientation prompt and game share one page-owned player. */
export function installButtonSound(volume: number): () => void {
  const sound = new ButtonSound(volume);
  buttonSound = sound;
  return () => {buttonSound = undefined; sound.dispose();};
}

/** Pointer controls and custom keyboard actions can bypass the native click. */
export function playButtonSound(): void {
  if (battleSceneActive) return;
  buttonSound?.play();
}

/** Combat keeps button audio only on the scoreboard and chat entry controls. */
export function setButtonSoundBattleActive(active: boolean): void {
  battleSceneActive = active;
}

export function setButtonSoundVolume(volume: number): void {
  buttonSound?.setVolume(volume);
}

/** Original clicked callbacks play global sound ID1 (UI01) once. */
class ButtonSound {
  private readonly context = new AudioContext();
  private readonly gain = this.context.createGain();
  private readonly voices = new Set<AudioBufferSourceNode>();
  private readonly removeInteraction: () => void;
  private buffer?: AudioBuffer;
  private disposed = false;
  private readonly resume = (): void => {
    if (this.context.state === 'suspended') void this.context.resume().catch(() => {});
  };
  private readonly clicked = (event: MouseEvent): void => {
    const button = event.target instanceof Element ? event.target.closest(BUTTON_SELECTOR) : null;
    if (!button || button.matches(':disabled')) return;
    if (battleSceneActive && !button.hasAttribute('data-battle-button-sound')) return;
    if (event.detail > 0) {
      const bounds = button.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX >= bounds.right
          || event.clientY < bounds.top || event.clientY >= bounds.bottom) return;
    }
    // Capture also sees stopped propagation; defer until controls can reject a dragged-out release.
    window.setTimeout(() => {if (!event.defaultPrevented) this.play();}, 0);
  };
  constructor(private volume: number) {
    this.gain.connect(this.context.destination);
    this.setVolume(volume);
    this.removeInteraction = listenForAudioInteraction(this.resume);
    window.addEventListener('click', this.clicked, true);
    void this.load().catch(error => {console.error('按钮音效载入失败', error);});
  }

  private async load(): Promise<void> {
    const catalog = await loadStaticJson<ButtonSoundCatalog>('/manifests/audio.json');
    if (this.disposed) return;
    const sound = catalog.soundIds.find(entry => entry.id === 1);
    if (!sound) throw new Error('缺少原按钮音效：UI01');
    const buffer = await loadAudioBuffer(`/${sound.asset}`, this.context);
    if (this.disposed) return;
    this.buffer = buffer;
  }

  play(): void {
    if (this.disposed || !this.buffer || this.volume === 0) return;
    if (this.context.state === 'suspended') {
      void this.context.resume().then(() => {this.play();}).catch(() => {});
      return;
    }
    if (this.context.state !== 'running') return;
    const voice = this.context.createBufferSource();
    voice.buffer = this.buffer;
    voice.connect(this.gain);
    voice.onended = () => {this.voices.delete(voice); voice.disconnect();};
    this.voices.add(voice);
    voice.start();
  }

  setVolume(volume: number): void {
    this.volume = volume;
    this.gain.gain.value = volume;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    window.removeEventListener('click', this.clicked, true);
    this.removeInteraction();
    for (const voice of this.voices) {
      voice.onended = null;
      voice.stop();
      voice.disconnect();
    }
    this.voices.clear();
    this.buffer = undefined;
    this.gain.disconnect();
    void this.context.close();
  }
}
