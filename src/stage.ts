import type { Assets, LayoutRecord } from "./assets";
import type { KeyHandler, Scene } from "./scene";
import { SoundManager } from "./sound";
import { UNSET, type Sprite } from "./sprite";

const STAGE_WIDTH = 640;
const STAGE_HEIGHT = 480;
const NO_POSITION = -1;
const RAND_MAX = 32768;
const MAX_FRAME_MS = 100;
const PRIMARY_BUTTON = 0;
const GAME_KEYS = new Set(["Enter", " ", "Escape"]);
const CHEAT_KEYS = new Set(["x", "d", "s", "g", "n"]);
const MUTE_KEY = "m";

function isGameKey(event: KeyboardEvent): boolean {
  const isPlainKey = GAME_KEYS.has(event.key);

  if (!event.ctrlKey) {
    return isPlainKey;
  }

  const key = event.key.toLowerCase();
  const isCheatKey = CHEAT_KEYS.has(key);

  return isCheatKey || isPlainKey;
}

export interface Modal {
  sprites: Sprite[];
  onKeyDown: KeyHandler;
}

function isMuteKey(event: KeyboardEvent): boolean {
  const hasModifier = event.ctrlKey || event.altKey || event.metaKey;
  const key = event.key.toLowerCase();

  return !hasModifier && key === MUTE_KEY;
}

export class Stage {
  readonly assets: Assets;
  readonly sound: SoundManager;
  readonly canvas: HTMLCanvasElement;
  now = 0;
  mouseX = NO_POSITION;
  mouseY = NO_POSITION;
  downX = NO_POSITION;
  downY = NO_POSITION;
  upX = NO_POSITION;
  upY = NO_POSITION;
  private mouseDownSeen = false;
  private lastClock = 0;
  private modal: Modal | null = null;
  private readonly audio: AudioContext;
  private readonly context: CanvasRenderingContext2D;
  private readonly scenes = new Map<string, Scene>();
  private readonly layoutByName = new Map<string, LayoutRecord>();
  private current: Scene | null = null;
  private pending: Scene | null = null;
  private pendingReturn: Scene | null = null;
  private returnScenes = new Map<Scene, Scene | null>();

  constructor(canvas: HTMLCanvasElement, assets: Assets, audio: AudioContext) {
    this.canvas = canvas;
    this.assets = assets;
    this.audio = audio;
    this.context = canvas.getContext("2d") as CanvasRenderingContext2D;
    this.sound = new SoundManager(audio, assets, () => this.now);

    for (const record of assets.layout) {
      if (record.name === "") {
        continue;
      }

      this.layoutByName.set(record.name.toLowerCase(), record);
    }

    this.now = performance.now();
    this.lastClock = this.now;
    this.attachInput();
  }

  openModal(modal: Modal): void {
    this.modal = modal;
    this.consumeDown();
    this.consumeUp();
    void this.syncAudio();
  }

  closeModal(): void {
    this.modal = null;
    this.consumeDown();
    this.consumeUp();
    void this.syncAudio();
  }

  private async syncAudio(): Promise<void> {
    const shouldSuspend = document.hidden || this.modal !== null;

    if (shouldSuspend) {
      await this.audio.suspend();
      return;
    }

    await this.audio.resume();
  }

  get downPending(): boolean {
    return this.downX >= 0;
  }

  get upPending(): boolean {
    return this.upX >= 0;
  }

  consumeDown(): void {
    this.downX = NO_POSITION;
    this.downY = NO_POSITION;
  }

  consumeUp(): void {
    this.upX = NO_POSITION;
    this.upY = NO_POSITION;
  }

  random(): number {
    return Math.floor(Math.random() * RAND_MAX);
  }

  register(scene: Scene): void {
    this.scenes.set(scene.name, scene);
  }

  private sceneNamed(name: string): Scene {
    const scene = this.scenes.get(name);

    if (!scene) {
      throw new Error(`Unknown scene ${name}`);
    }

    return scene;
  }

  gotoScene(name: string): void {
    this.pending = this.sceneNamed(name);
    this.pendingReturn = null;
  }

  pushScene(name: string): void {
    this.pending = this.sceneNamed(name);
    this.pendingReturn = this.current;
  }

  returnToCaller(scene: Scene): void {
    const target = this.returnScenes.get(scene);

    if (!target) {
      throw new Error(`Unknown return scene from ${scene.name}`);
    }

    this.pending = target;
    this.pendingReturn = null;
  }

  applyLayout(scene: Scene): void {
    for (const sprite of scene.sprites) {
      if (sprite.noParm) {
        continue;
      }

      const record = this.layoutByName.get(sprite.name.toLowerCase());

      if (!record) {
        continue;
      }

      const visible = (record.flags & 0xff) !== 0;
      const mode = (record.flags >> 8) & 0xff;

      if (sprite.parmOffsetX === UNSET) {
        sprite.parmOffsetX = record.x - sprite.px;
        sprite.parmOffsetY = record.y - sprite.py;
      }

      sprite.setHome(record.x, record.y);
      sprite.visible = visible;
      sprite.setAllCelsMode(mode);
    }
  }

  private switchScene(): void {
    const next = this.pending;

    if (!next) {
      return;
    }

    this.pending = null;

    if (this.current) {
      this.sound.endScene(this.current);
    }

    this.current = next;
    this.returnScenes.set(next, this.pendingReturn);
    this.consumeDown();
    this.consumeUp();
    next.enter();
    this.mouseDownSeen = false;
  }

  run(): void {
    const frame = () => {
      this.step();
      requestAnimationFrame(frame);
    };

    requestAnimationFrame(frame);
  }

  private advanceClock(): void {
    const clock = performance.now();
    const elapsed = Math.min(clock - this.lastClock, MAX_FRAME_MS);

    this.lastClock = clock;

    if (this.modal) {
      return;
    }

    this.now += elapsed;
  }

  private updateModal(): void {
    const modal = this.modal;

    if (!modal) {
      return;
    }

    for (const sprite of modal.sprites) {
      sprite.handleInput();
    }

    this.consumeDown();
    this.consumeUp();
  }

  private step(): void {
    this.advanceClock();
    this.sound.update();
    this.switchScene();

    const scene = this.current;

    this.syncResolution();
    this.context.fillStyle = "#000";
    this.context.fillRect(0, 0, STAGE_WIDTH, STAGE_HEIGHT);

    if (!scene) {
      return;
    }

    scene.logic();
    this.updateModal();
    scene.draw(this.context);
  }

  private syncResolution(): void {
    const rect = this.canvas.getBoundingClientRect();
    const pixelRatio = window.devicePixelRatio;
    const width = Math.max(STAGE_WIDTH, Math.round(rect.width * pixelRatio));
    const height = Math.max(STAGE_HEIGHT, Math.round(rect.height * pixelRatio));
    const isResized = this.canvas.width !== width || this.canvas.height !== height;

    if (isResized) {
      this.canvas.width = width;
      this.canvas.height = height;
    }

    const scaleX = width / STAGE_WIDTH;
    const scaleY = height / STAGE_HEIGHT;

    this.context.setTransform(scaleX, 0, 0, scaleY, 0, 0);
    this.context.imageSmoothingEnabled = false;
  }

  private toStage(event: PointerEvent): [number, number] {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = STAGE_WIDTH / rect.width;
    const scaleY = STAGE_HEIGHT / rect.height;
    const x = Math.floor((event.clientX - rect.left) * scaleX);
    const y = Math.floor((event.clientY - rect.top) * scaleY);

    return [x, y];
  }

  private attachInput(): void {
    this.canvas.addEventListener("pointerdown", (event) => {
      this.handlePointerDown(event);
    });

    this.canvas.addEventListener("pointermove", (event) => {
      const [x, y] = this.toStage(event);

      this.mouseX = x;
      this.mouseY = y;
    });

    window.addEventListener("pointerup", (event) => {
      this.handlePointerUp(event);
    });

    window.addEventListener("keydown", (event) => {
      this.handleKeyDown(event);
    });

    const syncAudio = async () => {
      await this.syncAudio();
    };

    document.addEventListener("visibilitychange", syncAudio);
    window.addEventListener("pointerup", syncAudio);
    window.addEventListener("keydown", syncAudio);
  }

  private handlePointerDown(event: PointerEvent): void {
    if (event.button !== PRIMARY_BUTTON) {
      return;
    }

    const [x, y] = this.toStage(event);

    this.mouseDownSeen = true;
    this.mouseX = x;
    this.mouseY = y;
    this.downX = x;
    this.downY = y;
  }

  private handlePointerUp(event: PointerEvent): void {
    const isPrimary = event.button === PRIMARY_BUTTON;

    if (!this.mouseDownSeen || !isPrimary) {
      return;
    }

    const [x, y] = this.toStage(event);

    this.mouseDownSeen = false;
    this.upX = x;
    this.upY = y;

    if (event.pointerType === "mouse") {
      return;
    }

    this.mouseX = NO_POSITION;
    this.mouseY = NO_POSITION;
  }

  private handleKeyDown(event: KeyboardEvent): void {
    if (isMuteKey(event)) {
      event.preventDefault();
      this.toggleMuteOnce(event);
      return;
    }

    const isShiftEnter = event.key === "Enter" && event.shiftKey;
    const handler = this.keyHandler();

    if (isShiftEnter || !handler || !isGameKey(event)) {
      return;
    }

    event.preventDefault();

    if (event.repeat) {
      return;
    }

    handler(event);
  }

  private keyHandler(): KeyHandler | null {
    if (this.modal) {
      return this.modal.onKeyDown;
    }

    const scene = this.current;

    if (!scene) {
      return null;
    }

    return scene.onKeyDown;
  }

  private toggleMuteOnce(event: KeyboardEvent): void {
    if (event.repeat) {
      return;
    }

    this.sound.toggleMute();
  }

  get currentScene(): Scene | null {
    return this.current;
  }
}
