import type { Assets, LayoutRecord } from "./assets";
import type { Scene } from "./scene";
import { SoundManager } from "./sound";

const STAGE_WIDTH = 640;
const STAGE_HEIGHT = 480;
const NO_POSITION = -1;
const RAND_MAX = 32768;
const UNSET = 999999999;

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
    this.context = canvas.getContext("2d") as CanvasRenderingContext2D;
    this.sound = new SoundManager(audio, assets, () => this.now);

    for (const record of assets.layout) {
      if (record.name === "") {
        continue;
      }

      this.layoutByName.set(record.name.toLowerCase(), record);
    }

    this.now = performance.now();
    this.attachInput();
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

  private step(): void {
    this.now = performance.now();
    this.sound.update();
    this.switchScene();

    const scene = this.current;

    this.context.fillStyle = "#000";
    this.context.fillRect(0, 0, STAGE_WIDTH, STAGE_HEIGHT);

    if (!scene) {
      return;
    }

    scene.logic();
    scene.draw(this.context);
  }

  private toStage(event: MouseEvent): [number, number] {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = STAGE_WIDTH / rect.width;
    const scaleY = STAGE_HEIGHT / rect.height;
    const x = Math.floor((event.clientX - rect.left) * scaleX);
    const y = Math.floor((event.clientY - rect.top) * scaleY);

    return [x, y];
  }

  private attachInput(): void {
    this.canvas.addEventListener("mousedown", (event) => {
      const [x, y] = this.toStage(event);

      this.mouseDownSeen = true;
      this.downX = x;
      this.downY = y;
    });

    this.canvas.addEventListener("mousemove", (event) => {
      const [x, y] = this.toStage(event);

      this.mouseX = x;
      this.mouseY = y;
    });

    window.addEventListener("mouseup", (event) => {
      if (!this.mouseDownSeen) {
        return;
      }

      const [x, y] = this.toStage(event);

      this.upX = x;
      this.upY = y;
    });

    window.addEventListener("keydown", (event) => {
      const isShiftEnter = event.key === "Enter" && event.shiftKey;
      const scene = this.current;

      if (isShiftEnter || !scene || !scene.onKeyDown) {
        return;
      }

      event.preventDefault();
      scene.onKeyDown(event);
    });
  }

  get currentScene(): Scene | null {
    return this.current;
  }
}
