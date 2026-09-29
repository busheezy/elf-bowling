import type { Group } from "../scene";
import { STAGE_RECT, type Sprite, type SpriteCallback } from "../sprite";

export const PIN_COUNT = 10;

export class Elves {
  readonly heads: Group;
  readonly bodies: Group;
  readonly arms: Group;
  readonly leftHeads: Group;
  readonly leftBodies: Group;
  readonly leftArms: Group;
  readonly rackers: Group;
  readonly leftRackers: Group;

  constructor(groups: {
    heads: Group;
    bodies: Group;
    arms: Group;
    leftHeads: Group;
    leftBodies: Group;
    leftArms: Group;
    rackers: Group;
    leftRackers: Group;
  }) {
    this.heads = groups.heads;
    this.bodies = groups.bodies;
    this.arms = groups.arms;
    this.leftHeads = groups.leftHeads;
    this.leftBodies = groups.leftBodies;
    this.leftArms = groups.leftArms;
    this.rackers = groups.rackers;
    this.leftRackers = groups.leftRackers;
  }

  head(pin: number): Sprite {
    return this.heads.at(pin);
  }

  body(pin: number): Sprite {
    return this.bodies.at(pin);
  }

  arm(pin: number): Sprite {
    return this.arms.at(pin);
  }

  leftHead(pin: number): Sprite {
    return this.leftHeads.at(pin);
  }

  leftBody(pin: number): Sprite {
    return this.leftBodies.at(pin);
  }

  leftArm(pin: number): Sprite {
    return this.leftArms.at(pin);
  }

  racker(pin: number): Sprite {
    return this.rackers.at(pin);
  }

  leftRacker(pin: number): Sprite {
    return this.leftRackers.at(pin);
  }

  parts(pin: number): Sprite[] {
    const body = this.body(pin);
    const head = this.head(pin);
    const arm = this.arm(pin);
    const leftBody = this.leftBody(pin);
    const leftHead = this.leftHead(pin);
    const leftArm = this.leftArm(pin);

    return [head, body, arm, leftHead, leftBody, leftArm];
  }

  private resetBodyClip(pin: number): Sprite {
    const body = this.body(pin);

    body.setClipRect(STAGE_RECT);

    return body;
  }

  setArmsCel(pin: number, cel: number): void {
    const arm = this.arm(pin);
    const leftArm = this.leftArm(pin);

    arm.setCel(cel);
    arm.cycling = false;
    leftArm.setCel(cel);
    leftArm.cycling = false;
  }

  cycleHead(pin: number, interval: number, first: number, count: number): void {
    this.head(pin).startCelCycle(interval, first, count);
    this.leftHead(pin).startCelCycle(interval, first, count);
  }

  cycleArms(pin: number, interval: number, first: number, count: number): void {
    this.arm(pin).startCelCycle(interval, first, count);
    this.leftArm(pin).startCelCycle(interval, first, count);
  }

  cycleBody(pin: number, interval: number, first: number, count: number): void {
    const body = this.resetBodyClip(pin);

    body.startCelCycle(interval, first, count);
    this.leftBody(pin).startCelCycle(interval, first, count);
  }

  stopCycles(pin: number): void {
    this.resetBodyClip(pin);

    for (const part of this.parts(pin)) {
      part.cycling = false;
    }
  }

  stopPhysics(pin: number): void {
    this.resetBodyClip(pin);

    for (const part of this.parts(pin)) {
      part.stopPhysics();
    }
  }

  landBodies(pin: number): void {
    const bodies = [this.body(pin), this.leftBody(pin)];

    for (const body of bodies) {
      body.moveTo(body.px, body.bounds.b - 1);
    }
  }

  fly(pin: number, vx: number, vy: number): void {
    const body = this.resetBodyClip(pin);

    body.startPhysicsMpx(vx, vy, 30, false, false, 2000);
    body.setBounds({ l: -1000, t: -1000, r: 1000, b: body.py + 1 });

    const leftBody = this.leftBody(pin);
    const leftVx = Math.trunc(vx / 4);
    const leftVy = Math.trunc(vy / 4);

    leftBody.startPhysicsMpx(leftVx, leftVy, 30, false, false, 500);
    leftBody.setBounds({ l: -1000, t: -1000, r: 1000, b: leftBody.py + 1 });
  }

  resetToHome(pin: number): void {
    this.resetBodyClip(pin);

    for (const part of this.parts(pin)) {
      part.resetToHome();
    }
  }

  setHeadCel(pin: number, cel: number): void {
    this.head(pin).setCel(cel);
    this.leftHead(pin).setCel(cel);
  }

  setBodyCel(pin: number, cel: number): void {
    this.resetBodyClip(pin);
    this.body(pin).setCel(cel);
    this.leftBody(pin).setCel(cel);
  }

  playBody(pin: number, sequence: number, onDone: SpriteCallback | null): void {
    this.resetBodyClip(pin);
    this.body(pin).playSequence(sequence, onDone);
    this.leftBody(pin).playSequence(sequence, null);
  }

  playArms(pin: number, sequence: number, onDone: SpriteCallback | null): void {
    this.arm(pin).playSequence(sequence, onDone);
    this.leftArm(pin).playSequence(sequence, null);
  }

  stopHeadSequences(pin: number): void {
    this.head(pin).stopSequences();
    this.leftHead(pin).stopSequences();
  }

  stopBodySequences(pin: number): void {
    this.resetBodyClip(pin);
    this.body(pin).stopSequences();
    this.leftBody(pin).stopSequences();
  }

  stopArmSequences(pin: number): void {
    this.arm(pin).stopSequences();
    this.leftArm(pin).stopSequences();
  }

  stopActions(pin: number): void {
    this.stopHeadSequences(pin);
    this.stopBodySequences(pin);
    this.stopArmSequences(pin);
    this.setArmsCel(pin, 0);
    this.arm(pin).clearTimer(0);

    const head = this.head(pin);

    head.clearTimer(0);
    head.stopTalking();
  }

  clearSway(pin: number): void {
    this.body(pin).clearTimer(1);
  }

  fullReset(pin: number): void {
    this.setHeadCel(pin, 0);
    this.setBodyCel(pin, 0);
    this.setArmsCel(pin, 0);

    for (const part of this.parts(pin)) {
      part.stopTalking();
      part.clearTimers();
    }

    this.clearSway(pin);
    this.stopActions(pin);
    this.stopCycles(pin);
  }

  hideAll(pin: number): void {
    this.resetBodyClip(pin);

    for (const part of this.parts(pin)) {
      part.hide();
    }
  }

  hideUpperParts(pin: number): void {
    this.head(pin).hide();
    this.arm(pin).hide();
    this.leftHead(pin).hide();
    this.leftArm(pin).hide();
  }

  showAll(pin: number): void {
    for (const part of this.parts(pin)) {
      part.setCel(0);
      part.show();
    }

    this.resetBodyClip(pin);
  }

  setRackerCel(pin: number, cel: number): void {
    const racker = this.racker(pin);
    const leftRacker = this.leftRacker(pin);

    racker.cycling = false;
    racker.setCel(cel);
    leftRacker.cycling = false;
    leftRacker.setCel(cel);
  }

  playRacker(pin: number, sequence: number, onDone: SpriteCallback | null): void {
    const racker = this.racker(pin);
    const leftRacker = this.leftRacker(pin);

    racker.cycling = false;
    racker.playSequence(sequence, onDone);
    leftRacker.cycling = false;
    leftRacker.playSequence(sequence, null);
  }

  stopRacker(pin: number): void {
    this.racker(pin).stopSequences();
    this.leftRacker(pin).stopSequences();
  }
}
