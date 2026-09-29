import type { Sprite } from "../sprite";
import { PIN_COUNT } from "./elves";
import type { GameScene } from "./game";

export enum Behavior {
  Idle = 0,
  Smoke = 1,
  Sign = 2,
  HeySanta = 3,
  Baby = 4,
  Fewer = 5,
  BouncingHead = 6,
  Fart = 7,
  Mooner = 8,
}

const NONE = -2;
const EVERYONE = -1;
const FRAME_SLOTS = 12;
const HEAD_PIN = 9;

interface Specials {
  sign: number;
  signStyle: number;
  heySanta: number;
  mooner: number;
  bouncingHead: number;
  farter: number;
  fartWitness: number;
  baby: number;
  fewer: number;
}

function noSpecials(): Specials {
  return {
    sign: NONE,
    signStyle: 0,
    heySanta: NONE,
    mooner: NONE,
    bouncingHead: NONE,
    farter: NONE,
    fartWitness: NONE,
    baby: NONE,
    fewer: NONE,
  };
}

function matches(pin: number, special: number): boolean {
  return pin === special || special === EVERYONE;
}

export class ElfBehaviors {
  private readonly game: GameScene;
  private readonly behaviors: Behavior[] = Array.from({ length: PIN_COUNT }, () => Behavior.Idle);
  private frameOrder: number[] = Array.from({ length: FRAME_SLOTS }, () => -1);
  private specials: Specials = noSpecials();
  private slapCount = 0;
  private slapTime = 0;
  private bounceCount = 0;

  constructor(game: GameScene) {
    this.game = game;
  }

  private get elves() {
    return this.game.elves;
  }

  private random(): number {
    return this.game.random();
  }

  behaviorOf(pin: number): Behavior {
    return this.behaviors[pin];
  }

  shuffleFrameOrder(): void {
    this.frameOrder = Array.from({ length: FRAME_SLOTS }, () => -1);

    for (let gag = 0; gag < 10; gag++) {
      const slot = this.freeSlot();

      this.frameOrder[slot] = gag;
    }
  }

  private freeSlot(): number {
    const slot = this.random() % 10;

    if (this.frameOrder[slot] === -1) {
      return slot;
    }

    return this.freeSlot();
  }

  private sevenOrEight(): number {
    return (this.random() % 2) + 7;
  }

  private setSign(specials: Specials, style: number): void {
    specials.sign = this.sevenOrEight();
    specials.signStyle = style;
  }

  private gagSetups(): Record<number, (specials: Specials) => void> {
    return {
      0: (specials) => {
        specials.farter = HEAD_PIN;
        specials.fartWitness = this.sevenOrEight();
      },
      1: (specials) => {
        specials.heySanta = EVERYONE;
      },
      2: () => this.game.critters.setupKalvin(false),
      3: (specials) => {
        specials.mooner = HEAD_PIN;
        this.setSign(specials, this.random() % 2);
      },
      4: (specials) => this.setSign(specials, 0),
      5: (specials) => this.setSign(specials, 1),
      6: (specials) => {
        specials.baby = EVERYONE;
      },
      7: (specials) => {
        specials.fewer = EVERYONE;
        this.setSign(specials, 2);
      },
      8: () => this.game.critters.setupKalvin(true),
      9: (specials) => {
        specials.bouncingHead = (this.random() % 3) + 7;
      },
    };
  }

  assignFrame(frame: number): void {
    const gag = this.frameOrder[frame] ?? -1;
    const specials = noSpecials();
    const setup = this.gagSetups()[gag];

    this.specials = specials;

    if (setup) {
      setup(specials);
    }

    for (let pin = 0; pin < PIN_COUNT; pin++) {
      this.behaviors[pin] = Behavior.Idle;
      this.resetElf(pin);
      this.behaviors[pin] = this.chooseBehavior(pin);
    }
  }

  private resetElf(pin: number): void {
    const elves = this.elves;
    const parts = [...elves.parts(pin), elves.racker(pin), elves.leftRacker(pin)];

    elves.setHeadCel(pin, 0);
    elves.setBodyCel(pin, 0);
    elves.setArmsCel(pin, 0);

    for (const part of parts) {
      part.stopTalking();
      part.stopSequences();
      part.clearTimers();
    }

    elves.clearSway(pin);
    elves.stopActions(pin);
    elves.stopCycles(pin);
  }

  private chooseBehavior(pin: number): Behavior {
    const specials = this.specials;

    if (matches(pin, specials.sign)) {
      return Behavior.Sign;
    }

    if (matches(pin, specials.heySanta)) {
      return Behavior.HeySanta;
    }

    if (matches(pin, specials.baby)) {
      return Behavior.Baby;
    }

    if (matches(pin, specials.fewer)) {
      return Behavior.Fewer;
    }

    if (matches(pin, specials.bouncingHead)) {
      return Behavior.BouncingHead;
    }

    if (matches(pin, specials.mooner)) {
      return Behavior.Mooner;
    }

    if (specials.farter !== NONE) {
      return Behavior.Fart;
    }

    return this.idleOrSmoke(pin);
  }

  private idleOrSmoke(pin: number): Behavior {
    if (pin === HEAD_PIN) {
      return Behavior.Smoke;
    }

    const roll = this.random() % 100;

    return roll > 29 ? Behavior.Idle : Behavior.Smoke;
  }

  startFrameBehaviors(): void {
    for (let pin = 0; pin < PIN_COUNT; pin++) {
      if (!this.game.standing[pin]) {
        continue;
      }

      this.startBehavior(pin);
      this.startSway(pin);
    }
  }

  private armTimer(pin: number, ms: number, action: (arm: Sprite) => void): void {
    this.elves.arm(pin).setTimer(0, ms, action);
  }

  private startBehavior(pin: number): void {
    if (this.game.ball !== 0) {
      return;
    }

    const behavior = this.behaviors[pin];
    const starters: Partial<Record<Behavior, () => void>> = {
      [Behavior.Idle]: () => this.elves.setArmsCel(pin, 0),
      [Behavior.Smoke]: () => this.startSmoking(pin),
      [Behavior.Sign]: () => this.startSign(pin),
      [Behavior.HeySanta]: () => this.delayed(pin, () => this.heySanta(pin)),
      [Behavior.Baby]: () => this.delayed(pin, () => this.babyDance(pin)),
      [Behavior.Fewer]: () => this.delayed(pin, () => this.fewer(pin)),
      [Behavior.Fart]: () => this.delayed(pin, () => this.fartCheck(pin)),
    };
    const starter = starters[behavior];

    if (starter) {
      starter();
    }
  }

  private delayed(pin: number, action: () => void): void {
    this.elves.setArmsCel(pin, 0);
    this.armTimer(pin, 600, action);
  }

  private startSmoking(pin: number): void {
    this.elves.setArmsCel(pin, 2);
    this.armTimer(pin, (this.random() % 2000) + 1000, () => this.smokeDrag(pin));
  }

  private smokeDrag(pin: number): void {
    this.elves.setArmsCel(pin, 3);
    this.armTimer(pin, 1500, () => this.smokePuff(pin));
  }

  private smokePuff(pin: number): void {
    this.elves.setArmsCel(pin, 2);
    this.armTimer(pin, 300, () => this.smokeExhale(pin));
    this.elves.setHeadCel(pin, 1);
    this.elves.head(pin).startTalking(250);
  }

  private smokeExhale(pin: number): void {
    this.armTimer(pin, (this.random() % 2000) + 1000, () => this.smokeDrag(pin));
    this.elves.setHeadCel(pin, 0);
    this.elves.head(pin).stopTalking();
  }

  private startSign(pin: number): void {
    const firstCel = this.specials.signStyle * 2 + 8;

    this.elves.setArmsCel(pin, 0);
    this.armTimer(pin, 400, () => this.elves.cycleArms(pin, 400, firstCel, 2));
  }

  private heySanta(pin: number): void {
    if (pin === HEAD_PIN) {
      this.game.playSoundTalking(this.elves.head(pin), "HeySanta.wav", 30, 100);
    }

    this.armTimer(pin, 1000, () => this.turnAround(pin));
  }

  private turnAround(pin: number): void {
    this.elves.setArmsCel(pin, 0);
    this.elves.setHeadCel(pin, 3);
    this.elves.setBodyCel(pin, 2);
    this.armTimer(pin, 700, () => this.bendOver(pin));
  }

  private nextDaddyTime(): number {
    return this.game.now + (this.random() % 1500) + 3000;
  }

  private bendOver(pin: number): void {
    this.slapTime = this.nextDaddyTime();
    this.slapCount = 0;
    this.elves.setArmsCel(pin, 14);
    this.elves.setBodyCel(pin, 2);
    this.armTimer(pin, 700, () => this.slapWindUp(pin));
  }

  private slapWindUp(pin: number): void {
    this.elves.setArmsCel(pin, 14);
    this.elves.setBodyCel(pin, 3);
    this.armTimer(pin, 150, () => this.slapPull(pin));
  }

  private slapPull(pin: number): void {
    this.elves.setArmsCel(pin, 0);
    this.elves.setBodyCel(pin, 3);
    this.armTimer(pin, 150, (arm) => this.slap(pin, arm));
  }

  private slap(pin: number, arm: Sprite): void {
    if (this.slapCount === 0 && pin === HEAD_PIN) {
      this.game.playSoundTalking(this.elves.head(pin), "ElvesLaugh.wav", 20, 100);
    }

    this.elves.setArmsCel(pin, 14);
    this.elves.setBodyCel(pin, 3);

    if (this.game.now < this.slapTime) {
      this.game.playSound(arm, "SlapAss.wav", 5);
    } else {
      this.game.playSound(arm, "WhosyrDaddy.wav", 30);
      this.slapTime = this.nextDaddyTime();
    }

    this.armTimer(pin, 150, () => this.slapRecover(pin));
  }

  private slapRecover(pin: number): void {
    this.elves.setArmsCel(pin, 0);
    this.elves.setBodyCel(pin, 3);
    this.armTimer(pin, (this.random() % 600) + 1000, () => this.slapWindUp(pin));
    this.slapCount++;
  }

  private babyDance(pin: number): void {
    const head = this.elves.head(pin);

    if (pin === HEAD_PIN) {
      this.game.playSoundTalking(head, "ElfBaby.wav", 30, 100);
    } else {
      head.startTalking(0);
      this.armTimer(pin, 1000, () => head.stopTalking());
    }

    this.elves.playBody(pin, 5, null);
    this.elves.playArms(pin, 0, () => this.danceAgain(pin));
  }

  private danceAgain(pin: number): void {
    this.elves.playBody(pin, 5, null);
    this.elves.playArms(pin, 0, () => this.babyDance(pin));
  }

  private fewer(pin: number): void {
    if (pin !== HEAD_PIN) {
      return;
    }

    this.game.playSoundTalking(this.elves.head(pin), "Fewer.wav", 30, 100);
    this.armTimer(pin, 2300, () => this.fewer(pin));

    for (let other = 0; other < 9; other++) {
      if (this.behaviors[other] === Behavior.Sign) {
        continue;
      }

      this.elves.head(other).startTalking(0);
      this.armTimer(other, 1850, () => this.hushLoop(other));
    }
  }

  private hushLoop(pin: number): void {
    this.elves.head(pin).stopTalking();
    this.armTimer(pin, 1950, () => this.hushLoop(pin));
  }

  private fartCheck(pin: number): void {
    if (pin !== this.specials.farter) {
      this.armTimer(pin, 1200, () => this.fartReact(pin));
      return;
    }

    this.game.playSound(this.elves.arm(pin), "fart.wav", 32);
    this.elves.setHeadCel(pin, 7);
    this.armTimer(pin, 450, () => this.fartHop(pin));
  }

  private fartHop(pin: number): void {
    this.elves.setHeadCel(pin, 2);
    this.elves.playBody(pin, 6, null);
    this.armTimer(pin, 1000, () => this.elves.setHeadCel(pin, 6));
  }

  private fartReact(pin: number): void {
    if (pin === this.specials.fartWitness) {
      this.game.playSoundTalking(this.elves.head(pin), "ElliotFarted.wav", 30, 100);
    }

    this.armTimer(pin, 1000, () => this.fartLaugh(pin));
  }

  private fartLaugh(pin: number): void {
    const head = this.elves.head(pin);

    if (pin === this.specials.fartWitness) {
      this.game.playSoundTalking(head, "ElvesLaugh.wav", 20, 100);
    } else {
      head.startTalking(100);
    }

    this.armTimer(pin, 560, () => this.fartStopLaugh(pin));
  }

  private fartStopLaugh(pin: number): void {
    this.elves.head(pin).stopTalking();
    this.armTimer(pin, (this.random() % 1200) + 250, () => this.holdNose(pin));
  }

  private holdNose(pin: number): void {
    if (pin === this.specials.farter) {
      return;
    }

    this.elves.setArmsCel(pin, 15);
  }

  private startSway(pin: number): void {
    const body = this.elves.body(pin);

    body.setTimer(1, (this.random() % 3000) + 1500, (sprite) => this.sway(sprite));
  }

  private sway(body: Sprite): void {
    if (!body.isPlayingSequence) {
      const offset = (this.random() % 5) - 2;

      body.moveTo(body.homeX + offset, body.homeY);
    }

    body.setTimer(1, (this.random() % 3000) + 1500, (sprite) => this.sway(sprite));
  }

  moonerDodge(): void {
    const pin = this.specials.mooner;

    if (pin === NONE || this.game.ball !== 0 || this.game.remaining[pin]) {
      return;
    }

    this.specials.mooner = NONE;

    if (this.random() % 2 !== 0) {
      return;
    }

    this.game.remaining[pin] = true;
    this.game.knockedCount--;
    this.elves.playBody(pin, 4, () => {
      this.game.playSoundTalking(this.elves.head(pin), "ElvesLaugh.wav", 47, 100);
    });
  }

  scareStandingElves(): number {
    for (let pin = 0; pin < PIN_COUNT; pin++) {
      this.game.ducked[pin] = false;

      const canDuck = this.game.standing[pin] && this.isScareable(pin);

      if (!canDuck || this.game.gutter) {
        continue;
      }

      this.game.ducked[pin] = true;
      this.elves.stopActions(pin);
      this.elves.setHeadCel(pin, 2);
      this.elves.cycleArms(pin, 100, 6, 2);
    }

    const scared = this.game.ducked.filter(Boolean);

    return scared.length;
  }

  private isScareable(pin: number): boolean {
    const behavior = this.behaviors[pin];
    const isPerforming =
      this.game.ball === 0 && (behavior === Behavior.HeySanta || behavior === Behavior.Mooner);

    return !isPerforming && behavior !== Behavior.BouncingHead;
  }

  recoverDucked(): void {
    for (let pin = 0; pin < PIN_COUNT; pin++) {
      const recovers = this.game.standing[pin] && this.game.ducked[pin];

      if (!recovers) {
        continue;
      }

      this.elves.stopCycles(pin);
      this.elves.stopActions(pin);
      this.elves.setHeadCel(pin, 0);
      this.elves.setArmsCel(pin, 0);
    }
  }

  randomFlail(): void {
    for (let pin = 0; pin < PIN_COUNT; pin++) {
      if (!this.game.standing[pin]) {
        continue;
      }

      const roll = this.random() % 3;

      if (roll === 0) {
        this.flail(pin, 80);
      } else if (roll === 1) {
        this.flail(pin, 200);
      }
    }
  }

  private flail(pin: number, base: number): void {
    this.elves.showAll(pin);
    this.elves.cycleBody(pin, (this.random() % base) + base, 0, 2);
    this.elves.cycleArms(pin, (this.random() % base) + base, 0, 2);
  }

  private bloodyNeck(pin: number): void {
    this.elves.setArmsCel(pin, 0);
    this.elves.cycleHead(pin, 170, 4, 2);
  }

  releaseSpecial(pin: number, leader: Sprite): boolean {
    if (this.behaviors[pin] !== Behavior.BouncingHead) {
      return false;
    }

    if (this.game.ball !== 0) {
      this.elves.setRackerCel(pin, 1);
      this.bloodyNeck(pin);

      return false;
    }

    this.bloodyNeck(pin);
    this.bounceCount = 0;
    this.elves.playRacker(pin, 0, (racker) => this.bounceHead(racker));
    this.game.playSound(leader, "Bounce.wav", 31);

    return true;
  }

  private bounceHead(racker: Sprite): void {
    const pin = racker.userData;
    const count = this.bounceCount;

    this.bounceCount++;

    if (count < 2) {
      this.elves.playRacker(pin, 0, (sprite) => this.bounceHead(sprite));
      this.game.playSound(racker, "Bounce.wav", 31);
      return;
    }

    this.elves.playRacker(pin, 1, null);
    this.game.playSound(racker, "HeadPop.wav", 31);
  }
}
