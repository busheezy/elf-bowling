import type { Drawable } from "./cast";
import type { Scene } from "./scene";
import { rectContains, Sprite, type SpriteCallback } from "./sprite";

const DEFAULT_HOVER_SOUND = "roll6.wav";
const DEFAULT_HOVER_PRIORITY = 2;
const DEFAULT_CLICK_SOUND = "Click.wav";
const DEFAULT_CLICK_PRIORITY = 8;

export class Button extends Sprite {
  onHoverEnter: SpriteCallback | null = null;
  hoverSound: string | null = DEFAULT_HOVER_SOUND;
  hoverPriority = DEFAULT_HOVER_PRIORITY;
  silent = false;
  private hover = false;
  private blinking = false;
  private blinkPhase = 0;
  private blinkCounter = 0;
  private blinksPerBurst = 0;
  private blinkPeriod = 0;
  private blinkPause = 0;
  private blinkNext = 0;
  private blinkSound: string | null = null;
  private blinkPriority = 0;

  constructor(scene: Scene, name: string, idle: Drawable, active: Drawable) {
    super(scene, name, idle);
    this.addCel(active);
  }

  setHoverSound(name: string | null, priority: number): void {
    this.hoverSound = name;
    this.hoverPriority = priority;
    this.silent = name === null;
  }

  startBlink(blinksPerBurst: number, firstDelay: number, period: number, pause: number): void {
    this.blinking = true;
    this.blinksPerBurst = blinksPerBurst;
    this.blinkPeriod = period;
    this.blinkPause = pause;
    this.blinkCounter = 0;
    this.blinkPhase = 0;
    this.blinkNext = this.now + firstDelay;
  }

  setBlinkSound(name: string | null, priority: number): void {
    this.blinkSound = name;
    this.blinkPriority = priority;
  }

  override reset(): void {
    super.reset();
    this.hover = false;
    this.blinking = false;
    this.blinkPhase = 0;
  }

  override handleInput(): void {
    const stage = this.scene.stage;
    const rect = this.drawRect();
    const upInside = stage.upPending && rectContains(rect, stage.upX, stage.upY);

    if (stage.downPending && rectContains(rect, stage.downX, stage.downY)) {
      stage.consumeDown();
    }

    if (upInside) {
      stage.consumeUp();
      this.handleClick();
    }

    this.updateBlink();
    this.updateHover(rect);
  }

  private handleClick(): void {
    if (!this.enabled || !this.onClick) {
      return;
    }

    if (!this.silent) {
      this.scene.stage.sound.play(null, this, DEFAULT_CLICK_SOUND, DEFAULT_CLICK_PRIORITY);
    }

    this.onClick(this);
  }

  private updateBlink(): void {
    if (!this.blinking || this.blinkNext >= this.now) {
      return;
    }

    this.blinkPhase ^= 1;

    const delay = this.nextBlinkDelay();

    this.blinkNext += delay;
    this.setCel(this.blinkPhase | (this.hover ? 1 : 0));
  }

  private nextBlinkDelay(): number {
    if (this.blinkPhase === 1) {
      this.playBlinkSound();

      return this.blinkPeriod;
    }

    this.blinkCounter++;

    if (this.blinkCounter < this.blinksPerBurst) {
      return this.blinkPeriod;
    }

    this.blinkCounter = 0;

    return this.blinkPause;
  }

  private playBlinkSound(): void {
    if (!this.blinkSound) {
      return;
    }

    this.scene.stage.sound.play(null, this, this.blinkSound, this.blinkPriority);
  }

  private updateHover(rect: ReturnType<Sprite["drawRect"]>): void {
    const stage = this.scene.stage;
    const inside = rectContains(rect, stage.mouseX, stage.mouseY);

    if (!this.hover && this.enabled && inside) {
      this.enterHover();
      return;
    }

    if (this.hover && !inside) {
      this.hover = false;
      this.setCel(this.blinkPhase);
    }
  }

  private enterHover(): void {
    if (this.hoverSound) {
      this.scene.stage.sound.play(null, this, this.hoverSound, this.hoverPriority);
    }

    this.hover = true;
    this.setCel(this.blinkPhase | 1);

    if (this.onHoverEnter) {
      this.onHoverEnter(this);
    }
  }
}
