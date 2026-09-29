import { Button } from "./button";
import { TextCast, type Rect } from "./cast";
import { Sprite, type SpriteCallback } from "./sprite";
import type { Stage } from "./stage";

export type KeyHandler = (key: KeyboardEvent) => void;

const MAX_TICKS_PER_FRAME = 3;

function matchesPattern(name: string, pattern: string): boolean {
  if (name.length !== pattern.length) {
    return false;
  }

  const lowerName = name.toLowerCase();
  const lowerPattern = pattern.toLowerCase();

  for (let index = 0; index < pattern.length; index++) {
    const expected = lowerPattern[index];
    const matches = expected === "?" || expected === lowerName[index];

    if (!matches) {
      return false;
    }
  }

  return true;
}

export class Group {
  readonly sprites: Sprite[];

  constructor(sprites: Sprite[]) {
    this.sprites = sprites;
  }

  get count(): number {
    return this.sprites.length;
  }

  at(index: number): Sprite {
    return this.sprites[index];
  }

  hideAll(): void {
    for (const sprite of this.sprites) {
      sprite.hide();
    }
  }

  setCelAll(cel: number): void {
    for (const sprite of this.sprites) {
      sprite.setCel(cel);
    }
  }

  showRange(start: number, count: number): void {
    for (let offset = 0; offset < count; offset++) {
      const index = (start + offset) % this.sprites.length;

      this.sprites[index].show();
    }
  }

  setCelRange(start: number, count: number, cel: number): void {
    for (let offset = 0; offset < count; offset++) {
      const index = (start + offset) % this.sprites.length;

      this.sprites[index].setCel(cel);
    }
  }
}

export abstract class Scene {
  readonly stage: Stage;
  readonly name: string;
  readonly tickPeriod: number;
  readonly sprites: Sprite[] = [];
  onKeyDown: KeyHandler | null = null;
  onMouseDown: (() => void) | null = null;
  onMouseUp: (() => void) | null = null;
  private initialized = false;
  private startTime = 0;
  private ticksDone = 0;

  constructor(stage: Stage, name: string, fps: number) {
    this.stage = stage;
    this.name = name;
    this.tickPeriod = Math.max(4, Math.trunc(1000 / fps));
  }

  protected abstract init(alreadyInitialized: boolean): void;

  protected abstract start(): void;

  get now(): number {
    return this.stage.now;
  }

  enter(): void {
    this.startTime = this.now;
    this.ticksDone = 0;
    this.init(this.initialized);
    this.initialized = true;
    this.stage.applyLayout(this);
    this.resetAllSprites();
    this.start();
  }

  resetAllSprites(): void {
    for (const sprite of this.sprites) {
      sprite.reset();
    }
  }

  logic(): void {
    const elapsedTicks = Math.trunc((this.now - this.startTime) / this.tickPeriod);
    const backlog = elapsedTicks - this.ticksDone;
    const ticks = Math.min(MAX_TICKS_PER_FRAME, backlog);

    for (let tick = 0; tick < ticks; tick++) {
      this.tick();
    }

    this.ticksDone += Math.max(0, ticks);
  }

  private tick(): void {
    for (let index = this.sprites.length - 1; index >= 0; index--) {
      const sprite = this.sprites[index];

      sprite.fireDueTimers();

      if (!sprite.visible) {
        continue;
      }

      sprite.handleInput();
      sprite.animate();
    }

    this.dispatchSceneMouse();
  }

  private dispatchSceneMouse(): void {
    const stage = this.stage;

    if (stage.downPending && this.onMouseDown) {
      this.onMouseDown();
    }

    if (stage.upPending && this.onMouseUp) {
      this.onMouseUp();
    }

    stage.consumeDown();
    stage.consumeUp();
  }

  draw(context: CanvasRenderingContext2D): void {
    for (const sprite of this.sprites) {
      sprite.draw(context);
    }
  }

  find(name: string): Sprite {
    const lower = name.toLowerCase();
    const sprite = this.sprites.find((candidate) => candidate.name.toLowerCase() === lower);

    if (!sprite) {
      throw new Error(`${this.name} Scene is unable to locate sprite ${name}`);
    }

    return sprite;
  }

  addSprite(name: string, bitmap: string): Sprite {
    const cast = this.stage.assets.cast(bitmap);
    const sprite = new Sprite(this, name, cast);

    this.sprites.push(sprite);

    return sprite;
  }

  addCel(sprite: Sprite, bitmap: string): number {
    const cast = this.stage.assets.cast(bitmap);

    return sprite.addCel(cast);
  }

  setTalkOverlay(sprite: Sprite, bitmap: string, cel: number): void {
    const cast = this.stage.assets.cast(bitmap);

    sprite.setTalkOverlay(cast, cel);
  }

  addButton(name: string, idleBitmap: string, activeBitmap: string): Button {
    const idle = this.stage.assets.cast(idleBitmap);
    const active = this.stage.assets.cast(activeBitmap);
    const button = new Button(this, name, idle, active);

    this.sprites.push(button);

    return button;
  }

  addQuarterClone(name: string, source: Sprite): Sprite {
    const sprite = new Sprite(this, name, null);

    for (const cast of source.cels) {
      const quarter = this.stage.assets.cast(`#${cast.name}`);

      sprite.addCel(quarter);
    }

    source.talkOverlays.forEach((overlay, cel) => {
      if (!overlay) {
        return;
      }

      const quarter = this.stage.assets.cast(`#${overlay.name}`);

      sprite.setTalkOverlay(quarter, cel);
    });

    this.sprites.push(sprite);

    return sprite;
  }

  addTextSprite(
    name: string,
    parent: Sprite,
    mode: number,
    insetLeft: number,
    insetRight: number,
    insetTop: number,
    insetBottom: number,
  ): { sprite: Sprite; text: TextCast } {
    const parentRect = parent.unclippedRect();
    const rect: Rect = {
      l: parentRect.l + insetLeft,
      t: parentRect.t + insetTop,
      r: parentRect.r - insetRight,
      b: parentRect.b - insetBottom,
    };
    const width = rect.r - rect.l;
    const height = rect.b - rect.t;
    const text = new TextCast(name, width, height, mode);
    const sprite = new Sprite(this, name, text);
    const centerX = Math.trunc((rect.l + rect.r) / 2);
    const centerY = Math.trunc((rect.t + rect.b) / 2);

    sprite.setHome(centerX, centerY);
    this.sprites.push(sprite);

    return { sprite, text };
  }

  textOf(sprite: Sprite): TextCast {
    return sprite.cels[0] as TextCast;
  }

  makeGroup(pattern: string): Group {
    const matching = this.sprites.filter((sprite) => matchesPattern(sprite.name, pattern));

    return new Group(matching);
  }

  applyParmOffset(fromName: string, toName: string): void {
    const from = this.find(fromName);
    const to = this.find(toName);
    const isSet = from.parmOffsetX !== 999999999;

    if (!isSet) {
      return;
    }

    to.moveBy(from.parmOffsetX, from.parmOffsetY);
  }

  playSound(
    sprite: Sprite | null,
    name: string,
    priority: number,
    onDone: SpriteCallback | null = null,
  ): void {
    this.stage.sound.play(this, sprite, name, priority, onDone);
  }

  playSoundTalking(sprite: Sprite, name: string, priority: number, talkMs: number): void {
    this.stage.sound.playTalking(this, sprite, name, priority, talkMs);
  }

  random(): number {
    return this.stage.random();
  }
}
