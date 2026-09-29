import type { Drawable, Rect } from "./cast";
import type { Scene } from "./scene";

export type SpriteCallback = (sprite: Sprite) => void;

export const STAGE_RECT: Rect = { l: 0, t: 0, r: 640, b: 480 };
export const UNSET = 999999999;
const TIMER_SLOTS = 4;
const MAX_QUEUE = 12;

interface SequenceStep {
  cel: number;
  dx: number;
  dy: number;
  duration: number;
}

interface Sequence {
  loops: number;
  smooth: boolean;
  steps: SequenceStep[];
  onDone: SpriteCallback | null;
}

export interface Motion {
  at: number;
  duration: number;
}

interface Timer {
  at: number;
  callback: SpriteCallback | null;
}

export function makeRect(l: number, t: number, r: number, b: number): Rect {
  return { l, t, r, b };
}

export function intersectRect(a: Rect, b: Rect): Rect {
  const l = Math.max(a.l, b.l);
  const t = Math.max(a.t, b.t);
  const r = Math.min(a.r, b.r);
  const bottom = Math.min(a.b, b.b);

  return { l, t, r, b: bottom };
}

export function isRectEmpty(rect: Rect): boolean {
  return rect.r <= rect.l || rect.b <= rect.t;
}

export function rectContains(rect: Rect, x: number, y: number): boolean {
  return x >= rect.l && x < rect.r && y >= rect.t && y < rect.b;
}

function copyRect(rect: Rect): Rect {
  return { l: rect.l, t: rect.t, r: rect.r, b: rect.b };
}

function snapToDevicePixels(context: CanvasRenderingContext2D, rect: Rect): Rect {
  const transform = context.getTransform();
  const scaleX = transform.a;
  const scaleY = transform.d;
  const l = Math.round(rect.l * scaleX) / scaleX;
  const t = Math.round(rect.t * scaleY) / scaleY;
  const r = Math.round(rect.r * scaleX) / scaleX;
  const b = Math.round(rect.b * scaleY) / scaleY;

  return { l, t, r, b };
}

function advanceTime(current: number, now: number, ms: number): number {
  const base = current === 0 ? now : current;

  return base + ms;
}

export class Sprite {
  readonly scene: Scene;
  readonly name: string;
  visible = true;
  cels: Drawable[] = [];
  talkOverlays: (Drawable | null)[] = [];
  cel = 0;
  x = 0;
  y = 0;
  homeX = 320;
  homeY = 240;
  clip: Rect = copyRect(STAGE_RECT);
  bounds: Rect = copyRect(STAGE_RECT);
  parmOffsetX = UNSET;
  parmOffsetY = UNSET;
  noParm = false;
  enabled = true;
  clickable = false;
  userData = 0;
  attached: Sprite | null = null;
  onMove: SpriteCallback | null = null;
  onOutOfBounds: SpriteCallback | null = null;
  onClick: SpriteCallback | null = null;

  private readonly timers: Timer[] = [];
  private sequences: Sequence[] = [];
  private queue: number[] = [];
  private stepIndex = 0;
  private loopsDone = 0;
  private stepEnd = 0;
  private restoreCel = -1;
  private stopAfterLoop = false;

  cycling = false;
  private cycleInterval = 0;
  private cycleFirst = 0;
  private cycleCount = 0;
  private cycleNext = 0;

  private physics = false;
  private stepInterval = 0;
  private nextStep = 0;
  private vx = 0;
  private vy = 0;
  private gravity = 0;
  private accumulatedGravity = 0;
  private maxFall = UNSET;
  private decelerationGrowth = 0;
  private accumulatedDeceleration = 0;
  private bounceX = false;
  private bounceY = false;
  private latchX = false;
  private latchY = false;

  private gliding = false;
  private glideFromX = 0;
  private glideFromY = 0;
  private glideToX = 0;
  private glideToY = 0;
  private glideProgress = 0;
  private glideIncrement = 0;
  private glideSlowAt = 0;
  private glideCallbackAt = 0;
  private glideCallback: SpriteCallback | null = null;

  talking = false;
  talkPhase = 0;
  private talkNext = 0;
  private talkInterval = 0;

  private tweenX = 0;
  private tweenY = 0;
  private tweenStart = 0;
  private tweenDuration = 0;

  constructor(scene: Scene, name: string, cast: Drawable | null) {
    this.scene = scene;
    this.name = name;

    for (let slot = 0; slot < TIMER_SLOTS; slot++) {
      this.timers.push({ at: 0, callback: null });
    }

    if (cast) {
      this.cels.push(cast);
      this.talkOverlays.push(null);
    }

    this.setHome(320, 240);
  }

  get now(): number {
    return this.scene.stage.now;
  }

  get px(): number {
    return Math.trunc(this.x / 1000);
  }

  get py(): number {
    return Math.trunc(this.y / 1000);
  }

  get currentCast(): Drawable {
    return this.cels[this.cel];
  }

  get isPlayingSequence(): boolean {
    return this.queue.length > 0;
  }

  addCel(cast: Drawable): number {
    this.cels.push(cast);
    this.talkOverlays.push(null);

    return this.cels.length - 1;
  }

  setTalkOverlay(cast: Drawable, cel: number): void {
    cast.mode = 1;
    this.talkOverlays[cel] = cast;
  }

  setCel(cel: number): void {
    if (cel === this.cel || cel >= this.cels.length) {
      return;
    }

    this.cel = cel;
  }

  setAllCelsMode(mode: number): void {
    for (const cast of this.cels) {
      cast.mode = mode;
    }
  }

  show(): void {
    this.visible = true;
  }

  hide(): void {
    this.visible = false;
  }

  setHome(x: number, y: number): void {
    this.homeX = x;
    this.homeY = y;
    this.x = x * 1000;
    this.y = y * 1000;
    this.clearTween();
  }

  moveByMpx(dx: number, dy: number): void {
    const startPx = this.px;
    const startPy = this.py;

    this.x += dx;
    this.y += dy;
    this.trackMove(this.px - startPx, this.py - startPy);

    if (this.attached) {
      this.attached.moveByMpx(dx, dy);
    }
  }

  moveBy(dx: number, dy: number): void {
    this.moveByMpx(dx * 1000, dy * 1000);
  }

  moveTo(x: number, y: number): void {
    this.withMotion(null, () => {
      this.shiftTo(x, y);
    });
  }

  private shiftTo(x: number, y: number): void {
    const dx = x * 1000 - this.x;
    const dy = y * 1000 - this.y;

    this.moveByMpx(dx, dy);
  }

  private withMotion(motion: Motion | null, action: () => void): void {
    const scene = this.scene;
    const previous = scene.motion;

    scene.motion = motion;
    action();
    scene.motion = previous;
  }

  private tweenRemaining(time: number): number {
    if (this.tweenDuration <= 0) {
      return 0;
    }

    const elapsed = time - this.tweenStart;
    const progress = Math.min(Math.max(elapsed / this.tweenDuration, 0), 1);

    return 1 - progress;
  }

  private trackMove(dx: number, dy: number): void {
    const motion = this.scene.motion;
    const isStill = dx === 0 && dy === 0;

    if (isStill) {
      return;
    }

    if (!motion) {
      this.clearTween();
      return;
    }

    const remaining = this.tweenRemaining(motion.at);

    this.tweenX = this.tweenX * remaining - dx;
    this.tweenY = this.tweenY * remaining - dy;
    this.tweenStart = motion.at;
    this.tweenDuration = motion.duration;
  }

  private clearTween(): void {
    this.tweenX = 0;
    this.tweenY = 0;
    this.tweenDuration = 0;
  }

  inheritTween(source: Sprite): void {
    this.tweenX = source.tweenX;
    this.tweenY = source.tweenY;
    this.tweenStart = source.tweenStart;
    this.tweenDuration = source.tweenDuration;
  }

  resetToHome(): void {
    this.moveTo(this.homeX, this.homeY);
  }

  setClipRect(rect: Rect): void {
    this.clip = copyRect(rect);
  }

  setBounds(rect: Rect): void {
    this.bounds = copyRect(rect);
  }

  celRectToScreen(rect: Rect): Rect {
    const cast = this.currentCast;
    const offsetX = this.px - cast.hotspotX;
    const offsetY = this.py - cast.hotspotY;

    return {
      l: rect.l + offsetX,
      t: rect.t + offsetY,
      r: rect.r + offsetX,
      b: rect.b + offsetY,
    };
  }

  unclippedRect(): Rect {
    const bbox = this.currentCast.surface().bbox;

    return this.celRectToScreen(bbox);
  }

  screenRect(): Rect {
    const rect = this.unclippedRect();

    return intersectRect(rect, STAGE_RECT);
  }

  drawRect(): Rect {
    const rect = this.screenRect();

    return intersectRect(rect, this.clip);
  }

  setTimer(slot: number, ms: number, callback: SpriteCallback | null): void {
    const timer = this.timers[slot];

    timer.at = this.now + ms;
    timer.callback = callback;
  }

  clearTimer(slot: number): void {
    this.timers[slot].at = 0;
  }

  clearTimers(): void {
    for (const timer of this.timers) {
      timer.at = 0;
    }
  }

  fireDueTimers(): void {
    for (const timer of this.timers) {
      const isDue = timer.at !== 0 && timer.at <= this.now;

      if (!isDue) {
        continue;
      }

      timer.at = 0;

      if (timer.callback) {
        timer.callback(this);
      }
    }
  }

  newSequence(loops: number, smooth = false): number {
    this.sequences.push({ loops, smooth, steps: [], onDone: null });

    return this.sequences.length - 1;
  }

  addStepsMpx(
    startCel: number,
    repeat: number,
    count: number,
    dx: number,
    dy: number,
    duration: number,
  ): void {
    const sequence = this.sequences[this.sequences.length - 1];

    for (let round = 0; round < repeat; round++) {
      for (let offset = 0; offset < count; offset++) {
        const cel = startCel + offset;

        sequence.steps.push({ cel, dx, dy, duration });
      }
    }
  }

  addSteps(
    startCel: number,
    repeat: number,
    count: number,
    dx: number,
    dy: number,
    duration: number,
  ): void {
    this.addStepsMpx(startCel, repeat, count, dx * 1000, dy * 1000, duration);
  }

  copySequencesFrom(source: Sprite, divisor: number): void {
    const copyStep = (step: SequenceStep): SequenceStep => {
      const dx = Math.trunc(step.dx / divisor);
      const dy = Math.trunc(step.dy / divisor);

      return { cel: step.cel, dx, dy, duration: step.duration };
    };

    this.sequences = source.sequences.map((sequence) => {
      const steps = sequence.steps.map(copyStep);

      return { loops: sequence.loops, smooth: sequence.smooth, steps, onDone: null };
    });
  }

  playSequence(index: number, onDone: SpriteCallback | null): void {
    this.queue = [];
    this.enqueueSequence(index, onDone);
  }

  enqueueSequence(index: number, onDone: SpriteCallback | null): void {
    const exists = index < this.sequences.length;

    if (!exists || this.queue.length >= MAX_QUEUE) {
      return;
    }

    this.sequences[index].onDone = onDone;
    this.queue.push(index);

    if (this.queue.length !== 1) {
      return;
    }

    this.restoreCel = -1;
    this.beginSequence();
  }

  stopSequences(): void {
    this.queue = [];

    if (this.restoreCel >= 0) {
      this.setCel(this.restoreCel);
      this.restoreCel = -1;
    }
  }

  private beginSequence(): void {
    this.stopAfterLoop = false;
    this.loopsDone = 0;
    this.stepEnd = this.now;
    this.startStep(0);
  }

  private startStep(index: number): void {
    const sequence = this.sequences[this.queue[0]];
    const step = sequence.steps[index];

    this.stepIndex = index;

    if (!step) {
      return;
    }

    const at = this.stepEnd;
    const duration = step.duration;

    this.stepEnd += duration;
    this.setCel(step.cel);

    if (!sequence.smooth) {
      this.moveByMpx(step.dx, step.dy);
      return;
    }

    const motion = { at, duration };

    this.withMotion(motion, () => {
      this.moveByMpx(step.dx, step.dy);
    });
  }

  private stepSequence(): void {
    if (this.stepEnd > this.now) {
      return;
    }

    const sequence = this.sequences[this.queue[0]];
    const nextIndex = this.stepIndex + 1;

    if (nextIndex < sequence.steps.length) {
      this.startStep(nextIndex);
      return;
    }

    this.loopsDone++;

    const loopsRemain = sequence.loops === 0 || this.loopsDone < sequence.loops;

    if (loopsRemain && !this.stopAfterLoop) {
      this.startStep(0);
      return;
    }

    this.finishSequence(sequence);
  }

  private finishSequence(sequence: Sequence): void {
    this.queue.shift();

    if (this.queue.length > 0) {
      this.beginSequence();
    }

    if (this.queue.length === 0 && this.restoreCel >= 0) {
      this.setCel(this.restoreCel);
    }

    if (sequence.onDone) {
      sequence.onDone(this);
    }
  }

  startCelCycle(interval: number, first: number, count: number): void {
    this.cycling = true;
    this.cycleInterval = interval;
    this.cycleFirst = first;
    this.cycleCount = count;
    this.cycleNext = this.now + interval;
    this.setCel(first);
  }

  private stepCelCycle(): void {
    const next = this.cel + 1;
    const wrapped = next >= this.cycleFirst + this.cycleCount ? this.cycleFirst : next;

    this.setCel(wrapped);
    this.cycleNext = advanceTime(this.cycleNext, this.now, this.cycleInterval);
  }

  startPhysicsMpx(
    vx: number,
    vy: number,
    interval: number,
    bounceX: boolean,
    bounceY: boolean,
    gravity: number,
  ): void {
    this.physics = true;
    this.onMove = null;
    this.latchX = false;
    this.latchY = false;
    this.stepInterval = interval;
    this.nextStep = this.now + interval;
    this.bounceX = bounceX;
    this.bounceY = bounceY;
    this.vx = vx;
    this.vy = vy;
    this.gravity = gravity;
    this.accumulatedGravity = gravity;
    this.decelerationGrowth = 0;
    this.accumulatedDeceleration = 0;
  }

  startPhysics(
    vx: number,
    vy: number,
    interval: number,
    bounceX = false,
    bounceY = false,
    gravity = 0,
  ): void {
    this.startPhysicsMpx(vx * 1000, vy * 1000, interval, bounceX, bounceY, gravity);
  }

  stopPhysics(): void {
    this.physics = false;
    this.vx = 0;
    this.vy = 0;
    this.gravity = 0;
    this.accumulatedGravity = 0;
    this.accumulatedDeceleration = 0;
  }

  private horizontalStep(): number {
    const deceleration = this.accumulatedDeceleration;

    this.accumulatedDeceleration += this.decelerationGrowth;

    if (this.vx >= 1) {
      return Math.max(this.vx - deceleration, 0);
    }

    return Math.min(this.vx + deceleration, 0);
  }

  private verticalStep(): number {
    const dy = this.vy + this.accumulatedGravity;

    this.accumulatedGravity += this.gravity;

    if (this.vy + this.accumulatedGravity > this.maxFall) {
      this.accumulatedGravity = this.maxFall - this.vy;
    }

    return dy;
  }

  private clampToBounds(): void {
    const minX = this.bounds.l * 1000;
    const maxX = (this.bounds.r - 1) * 1000;
    const minY = this.bounds.t * 1000;
    const maxY = (this.bounds.b - 1) * 1000;

    this.x = Math.min(Math.max(this.x, minX), maxX);
    this.y = Math.min(Math.max(this.y, minY), maxY);
  }

  private physicsStep(at: number): void {
    const duration = this.stepInterval;
    const motion = { at, duration };

    this.withMotion(motion, () => {
      this.physicsMove();
    });

    if (!this.physics) {
      return;
    }

    this.applyBounce();
    this.checkOutOfBounds();
  }

  private physicsMove(): void {
    const startX = this.x;
    const startY = this.y;
    const startPx = this.px;
    const startPy = this.py;
    const dx = this.horizontalStep();
    const dy = this.verticalStep();

    this.x += dx;
    this.y += dy;
    this.clampToBounds();

    const movedX = this.x - startX;
    const movedY = this.y - startY;
    const pixelChanged = this.px !== startPx || this.py !== startPy;

    this.trackMove(this.px - startPx, this.py - startPy);

    if (this.attached) {
      this.attached.moveByMpx(movedX, movedY);
    }

    if (pixelChanged && this.onMove) {
      this.onMove(this);
    }
  }

  private applyBounce(): void {
    const rect = this.drawRect();

    if (this.bounceX && rect.r >= this.bounds.r) {
      this.vx = -Math.abs(this.vx);
    } else if (this.bounceX && rect.l <= this.bounds.l) {
      this.vx = Math.abs(this.vx);
    }

    if (this.bounceY && rect.b >= this.bounds.b) {
      this.vy = -Math.abs(this.vy);
    } else if (this.bounceY && rect.t <= this.bounds.t) {
      this.vy = Math.abs(this.vy);
    }
  }

  private isInsideX(): boolean {
    return this.bounds.l + 1 <= this.px && this.px < this.bounds.r - 1;
  }

  private isInsideY(): boolean {
    return this.bounds.t + 1 <= this.py && this.py < this.bounds.b - 1;
  }

  private checkOutOfBounds(): void {
    const insideX = this.isInsideX();
    const insideY = this.isInsideY();

    this.latchX = this.latchX && !insideX;
    this.latchY = this.latchY && !insideY;

    const callback = this.onOutOfBounds;

    if (!callback) {
      return;
    }

    if (!insideX && !this.latchX) {
      this.latchX = true;
      callback(this);
      return;
    }

    if (!insideY && !this.latchY) {
      this.latchY = true;
      callback(this);
    }
  }

  glide(
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    interval: number,
    steps: number,
    slowPercent: number,
    callback: SpriteCallback | null,
    callbackPercent: number,
  ): void {
    this.glideFromX = fromX;
    this.glideFromY = fromY;
    this.glideToX = toX;
    this.glideToY = toY;
    this.glideProgress = 0;
    this.glideCallbackAt = callbackPercent * 100;
    this.glideIncrement = Math.trunc(10000 / steps);
    this.glideSlowAt = slowPercent * 100;
    this.glideCallback = callback;
    this.stepInterval = interval;
    this.nextStep = this.now;
    this.gliding = true;
    this.moveTo(fromX, fromY);
  }

  private glideStep(at: number): void {
    this.glideProgress = Math.min(this.glideProgress + this.glideIncrement, 10000);

    if (this.glideProgress >= this.glideSlowAt) {
      this.glideIncrement = Math.max(Math.trunc((this.glideIncrement * 2) / 3), 100);
    }

    const progress = this.glideProgress;
    const x = this.glideFromX - Math.trunc(((this.glideFromX - this.glideToX) * progress) / 10000);
    const y = this.glideFromY - Math.trunc(((this.glideFromY - this.glideToY) * progress) / 10000);

    const duration = this.stepInterval;
    const motion = { at, duration };

    this.withMotion(motion, () => {
      this.shiftTo(x, y);
    });

    if (progress >= 10000) {
      this.gliding = false;
    }

    const shouldCall = this.glideCallback && progress >= this.glideCallbackAt;

    if (!shouldCall) {
      return;
    }

    const callback = this.glideCallback as SpriteCallback;

    this.glideCallback = null;
    callback(this);
  }

  startTalking(interval: number): void {
    const effective = interval === 0 ? 160 : interval;

    this.talking = true;
    this.talkInterval = effective;
    this.talkPhase = 1;
    this.talkNext = this.now + effective;
  }

  stopTalking(): void {
    this.talking = false;
    this.talkPhase = 0;
  }

  animate(): void {
    const now = this.now;

    if (this.queue.length > 0) {
      this.stepSequence();
      this.animateTalking();
      return;
    }

    if (this.cycling && this.cycleNext < now) {
      this.stepCelCycle();
    }

    if (this.physics && this.nextStep < now) {
      const at = this.nextStep;

      this.nextStep = advanceTime(this.nextStep, now, this.stepInterval);
      this.physicsStep(at);
    }

    if (this.gliding && this.nextStep < now) {
      const at = this.nextStep;

      this.nextStep = advanceTime(this.nextStep, now, this.stepInterval);
      this.glideStep(at);
    }

    this.animateTalking();
  }

  private animateTalking(): void {
    if (!this.talking || this.talkNext >= this.now) {
      return;
    }

    this.talkPhase ^= 1;
    this.talkNext += this.talkInterval;
  }

  reset(): void {
    this.cel = 0;
    this.stopTalking();
    this.clearTimers();
    this.queue = [];
    this.restoreCel = -1;
    this.cycling = false;
    this.stopPhysics();
    this.gliding = false;
    this.maxFall = UNSET;
    this.x = this.homeX * 1000;
    this.y = this.homeY * 1000;
    this.clearTween();
    this.enabled = true;
    this.onMove = null;
    this.onOutOfBounds = null;
  }

  protected get handlesClicks(): boolean {
    return this.clickable;
  }

  isClickableAt(x: number, y: number): boolean {
    const isInteractive = this.visible && this.enabled && this.onClick !== null;

    if (!isInteractive || !this.handlesClicks) {
      return false;
    }

    const rect = this.drawRect();

    return rectContains(rect, x, y);
  }

  handleInput(): void {
    if (!this.clickable) {
      return;
    }

    const stage = this.scene.stage;
    const rect = this.drawRect();
    const downInside = stage.downPending && rectContains(rect, stage.downX, stage.downY);
    const upInside = stage.upPending && rectContains(rect, stage.upX, stage.upY);

    if (downInside) {
      stage.consumeDown();
    }

    if (!upInside) {
      return;
    }

    stage.consumeUp();

    if (this.enabled && this.onClick) {
      this.onClick(this);
    }
  }

  draw(context: CanvasRenderingContext2D): void {
    if (!this.visible || this.cels.length === 0) {
      return;
    }

    const remaining = this.tweenRemaining(this.now);
    const drawX = this.px + this.tweenX * remaining;
    const drawY = this.py + this.tweenY * remaining;

    this.drawCast(context, this.currentCast, drawX, drawY);

    const overlay = this.talkOverlays[this.cel];
    const showOverlay = this.talking && this.talkPhase === 1 && overlay;

    if (showOverlay) {
      this.drawCast(context, overlay, drawX, drawY);
    }
  }

  private drawCast(
    context: CanvasRenderingContext2D,
    cast: Drawable,
    drawX: number,
    drawY: number,
  ): void {
    const surface = cast.surface();
    const offsetX = drawX - cast.hotspotX;
    const offsetY = drawY - cast.hotspotY;
    const screen = {
      l: surface.bbox.l + offsetX,
      t: surface.bbox.t + offsetY,
      r: surface.bbox.r + offsetX,
      b: surface.bbox.b + offsetY,
    };
    const visibleArea = intersectRect(intersectRect(screen, this.clip), STAGE_RECT);

    if (isRectEmpty(visibleArea)) {
      return;
    }

    const width = visibleArea.r - visibleArea.l;
    const height = visibleArea.b - visibleArea.t;
    const scaleX = surface.canvas.width / cast.width;
    const scaleY = surface.canvas.height / cast.height;
    const sourceX = (visibleArea.l - offsetX) * scaleX;
    const sourceY = (visibleArea.t - offsetY) * scaleY;
    const sourceWidth = width * scaleX;
    const sourceHeight = height * scaleY;
    const isScaled = scaleX !== 1 || scaleY !== 1;
    const target = snapToDevicePixels(context, visibleArea);
    const targetWidth = target.r - target.l;
    const targetHeight = target.b - target.t;

    context.imageSmoothingEnabled = isScaled;
    context.imageSmoothingQuality = "high";
    context.drawImage(
      surface.canvas,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      target.l,
      target.t,
      targetWidth,
      targetHeight,
    );
  }

  isOpaqueAt(x: number, y: number): boolean {
    const cast = this.currentCast;
    const surface = cast.surface();
    const localX = x - this.px + cast.hotspotX;
    const localY = y - this.py + cast.hotspotY;

    if (!surface.mask) {
      return true;
    }

    const pixel = localY * cast.width + localX;

    return surface.mask[pixel] === 0;
  }

  overlaps(other: Sprite): boolean {
    const area = intersectRect(this.drawRect(), other.drawRect());

    if (isRectEmpty(area)) {
      return false;
    }

    for (let y = area.t; y < area.b; y++) {
      for (let x = area.l; x < area.r; x++) {
        const shared = this.isOpaqueAt(x, y) && other.isOpaqueAt(x, y);

        if (shared) {
          return true;
        }
      }
    }

    return false;
  }
}
