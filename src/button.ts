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

  constructor(scene: Scene, name: string, idle: Drawable, active: Drawable) {
    super(scene, name, idle);
    this.addCel(active);
  }

  setHoverSound(name: string | null, priority: number): void {
    this.hoverSound = name;
    this.hoverPriority = priority;
    this.silent = name === null;
  }

  protected override get handlesClicks(): boolean {
    return true;
  }

  override reset(): void {
    super.reset();
    this.hover = false;
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

  private updateHover(rect: ReturnType<Sprite["drawRect"]>): void {
    const stage = this.scene.stage;
    const inside = rectContains(rect, stage.mouseX, stage.mouseY);

    if (!this.hover && this.enabled && inside) {
      this.enterHover();
      return;
    }

    if (this.hover && !inside) {
      this.hover = false;
      this.setCel(0);
    }
  }

  private enterHover(): void {
    if (this.hoverSound) {
      this.scene.stage.sound.play(null, this, this.hoverSound, this.hoverPriority);
    }

    this.hover = true;
    this.setCel(1);

    if (this.onHoverEnter) {
      this.onHoverEnter(this);
    }
  }
}
