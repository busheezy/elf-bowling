import type { Assets } from "./assets";
import type { Scene } from "./scene";
import type { Sprite } from "./sprite";

export type SoundCallback = ((sprite: Sprite) => void) | null;

interface Playing {
  source: AudioBufferSourceNode;
  priority: number;
  scene: Scene | null;
  sprite: Sprite | null;
  onDone: SoundCallback;
  talking: boolean;
  endsAt: number;
}

interface BackgroundLoop {
  name: string;
  scene: Scene;
}

const DEFAULT_TALK_INTERVAL = 160;
const BACKGROUND_PRIORITY = 1;
const MUTED_KEY = "elf-bowling-muted";

function readMuted(): boolean {
  try {
    const stored = localStorage.getItem(MUTED_KEY);

    return stored === "1";
  } catch {
    return false;
  }
}

function storeMuted(muted: boolean): void {
  const value = muted ? "1" : "0";

  try {
    localStorage.setItem(MUTED_KEY, value);
  } catch {
    return;
  }
}

export class SoundManager {
  private readonly audio: AudioContext;
  private readonly assets: Assets;
  private readonly clock: () => number;
  private readonly output: GainNode;
  private muted = readMuted();
  private current: Playing | null = null;
  private background: BackgroundLoop | null = null;

  constructor(audio: AudioContext, assets: Assets, clock: () => number) {
    this.audio = audio;
    this.assets = assets;
    this.clock = clock;
    this.output = audio.createGain();
    this.output.connect(audio.destination);
    this.applyVolume();
  }

  toggleMute(): void {
    this.muted = !this.muted;
    storeMuted(this.muted);
    this.applyVolume();
  }

  private applyVolume(): void {
    const volume = this.muted ? 0 : 1;

    this.output.gain.value = volume;
  }

  play(
    scene: Scene | null,
    sprite: Sprite | null,
    name: string,
    priority: number,
    onDone: SoundCallback = null,
  ): boolean {
    const currentPriority = this.current ? this.current.priority : -1;

    if (priority < currentPriority) {
      return false;
    }

    this.stopCurrent();
    this.start(scene, sprite, name, priority, onDone, false);

    return true;
  }

  playTalking(
    scene: Scene | null,
    sprite: Sprite,
    name: string,
    priority: number,
    talkMs: number,
    onDone: SoundCallback = null,
  ): boolean {
    const started = this.play(scene, sprite, name, priority, onDone);

    if (!started || !this.current) {
      return false;
    }

    const interval = talkMs === 0 ? DEFAULT_TALK_INTERVAL : talkMs;

    this.current.talking = true;
    sprite.startTalking(interval);

    return true;
  }

  setBackgroundLoop(scene: Scene, name: string): void {
    this.background = { name, scene };

    if (!this.current) {
      this.startBackground();
    }
  }

  clearBackgroundLoop(): void {
    this.background = null;
  }

  endScene(scene: Scene): void {
    this.background = null;

    if (this.current && this.current.scene === scene) {
      this.stopCurrent();
    }
  }

  update(): void {
    const playing = this.current;

    if (!playing) {
      return;
    }

    const now = this.clock();

    if (now < playing.endsAt) {
      return;
    }

    this.finish(playing);
  }

  private finish(playing: Playing): void {
    this.current = null;
    this.stopTalkingSprite(playing);

    if (this.background) {
      this.startBackground();
    }

    if (playing.onDone && playing.sprite) {
      playing.onDone(playing.sprite);
    }
  }

  private startBackground(): void {
    const loop = this.background;

    if (!loop) {
      return;
    }

    this.start(loop.scene, null, loop.name, BACKGROUND_PRIORITY, null, false);
  }

  private start(
    scene: Scene | null,
    sprite: Sprite | null,
    name: string,
    priority: number,
    onDone: SoundCallback,
    talking: boolean,
  ): void {
    const buffer = this.assets.sound(name);
    const source = this.audio.createBufferSource();
    const durationMs = buffer.duration * 1000;
    const endsAt = this.clock() + durationMs;

    source.buffer = buffer;
    source.connect(this.output);
    source.start();

    this.current = { source, priority, scene, sprite, onDone, talking, endsAt };
  }

  private stopCurrent(): void {
    const playing = this.current;

    if (!playing) {
      return;
    }

    this.current = null;
    playing.source.stop();
    playing.source.disconnect();
    this.stopTalkingSprite(playing);
  }

  private stopTalkingSprite(playing: Playing): void {
    if (!playing.talking || !playing.sprite) {
      return;
    }

    playing.sprite.stopTalking();
  }
}
