import { makeRect, type Sprite } from "../sprite";
import { PIN_COUNT } from "./elves";
import type { GameScene } from "./game";
import { Behavior } from "./game-elves";

const RACKER_SPEED = 8000;
const RACKER_LEFT_SPEED = 2000;
const RACKER_DROP = 336;
const LEFT_RACKER_DROP = 84;

export class PinSetter {
  private readonly game: GameScene;

  constructor(game: GameScene) {
    this.game = game;
  }

  private get elves() {
    return this.game.elves;
  }

  private standingPins(): number[] {
    const pins: number[] = [];

    for (let pin = 0; pin < PIN_COUNT; pin++) {
      if (this.game.standing[pin]) {
        pins.push(pin);
      }
    }

    return pins;
  }

  private clearRackerHandlers(): void {
    for (const racker of this.elves.rackers.sprites) {
      racker.onMove = null;
      racker.onOutOfBounds = null;
    }
  }

  private rackerDropBounds(racker: Sprite): void {
    const x = racker.px;
    const y = racker.py;

    racker.setBounds(makeRect(x - 2, y - 1, x + 2, y + RACKER_DROP));
  }

  rackersPickUp(): void {
    this.clearRackerHandlers();

    const pins = this.standingPins();

    for (const pin of pins) {
      this.elves.leftRacker(pin).resetToHome();

      const racker = this.elves.racker(pin);

      racker.resetToHome();
      this.rackerDropBounds(racker);
      racker.startPhysicsMpx(0, RACKER_SPEED, 30, false, false, 0);
    }

    const lead = pins[0];

    if (lead === undefined) {
      this.rackersPickedUp(this.elves.racker(0));
      return;
    }

    const leader = this.elves.racker(lead);

    leader.onMove = () => {
      this.moveLeftRackers(pins, RACKER_LEFT_SPEED);
    };
    leader.onOutOfBounds = (sprite) => {
      this.rackersGrabbed(sprite, pins);
    };
    this.game.playSound(leader, "Rackpins.wav", 14);
  }

  private moveLeftRackers(pins: number[], dy: number): void {
    for (const pin of pins) {
      this.elves.leftRacker(pin).moveByMpx(0, dy);
    }
  }

  private rackersGrabbed(leader: Sprite, pins: number[]): void {
    this.game.critters.deerHeadDown();

    for (const racker of this.elves.rackers.sprites) {
      racker.stopPhysics();
    }

    this.resetStandingElves();
    leader.setTimer(0, 400, () => {
      this.liftStandingElves(pins);
    });
  }

  private resetStandingElves(): void {
    for (const pin of this.standingPins()) {
      this.elves.fullReset(pin);
      this.elves.setBodyCel(pin, 0);
      this.elves.setArmsCel(pin, 0);
      this.elves.resetToHome(pin);
    }
  }

  private liftStandingElves(pins: number[]): void {
    this.clearRackerHandlers();

    pins.forEach((pin, index) => {
      const racker = this.elves.racker(pin);

      racker.onOutOfBounds = null;
      racker.startPhysicsMpx(0, -RACKER_SPEED, 30, false, false, 0);

      if (index === 0) {
        racker.onMove = () => {
          this.liftStep(pins);
        };
        racker.onOutOfBounds = (sprite) => {
          this.rackersPickedUp(sprite);
        };
      }

      this.elves.stopActions(pin);
      this.elves.clearSway(pin);
    });

    const leader = this.elves.racker(pins[0]);

    this.game.playSound(leader, "Rackpins.wav", 14);
    this.game.behaviors.randomFlail();
  }

  private liftStep(pins: number[]): void {
    for (const pin of pins) {
      this.elves.leftRacker(pin).moveByMpx(0, -RACKER_LEFT_SPEED);
      this.elves.body(pin).moveByMpx(0, -RACKER_SPEED);
      this.elves.leftBody(pin).moveByMpx(0, -RACKER_LEFT_SPEED);
    }
  }

  private rackersPickedUp(leader: Sprite): void {
    for (const racker of this.elves.rackers.sprites) {
      racker.stopPhysics();
      racker.clearTimers();
    }

    this.game.critters.deerHeadUp();
    leader.setTimer(3, 100, () => {
      this.sweepOrContinue();
    });
  }

  private sweepOrContinue(): void {
    const anyFell = this.game.fellThisBall.some((fell) => fell);
    const rake = this.game.find("Rake");

    if (!anyFell) {
      this.game.finishBall(rake);
      return;
    }

    this.rakeDown(rake);
  }

  private rakeDown(rake: Sprite): void {
    rake.resetToHome();
    rake.show();

    const leftRake = this.game.find("LeftRake");

    leftRake.resetToHome();
    leftRake.show();

    for (const sprite of [rake, leftRake]) {
      const rect = sprite.screenRect();

      sprite.setClipRect(makeRect(rect.l, 0, rect.r, 480));
    }

    rake.startPhysics(0, 8, 20);
    rake.setBounds(makeRect(320, rake.homeY - 1, 640, 152));
    rake.onMove = () => {
      leftRake.moveTo(leftRake.px, leftRake.py + 2);
    };
    rake.onOutOfBounds = (sprite) => {
      sprite.stopPhysics();
      sprite.setTimer(0, 300, () => {
        this.rakeUp(sprite);
      });
    };
  }

  private rakeUp(rake: Sprite): void {
    rake.stopPhysics();
    rake.startPhysics(0, -8, 20);
    rake.setBounds(makeRect(320, rake.homeY - 1, 640, 152));
    rake.onMove = (sprite) => {
      this.rakeSweep(sprite);
    };
    rake.onOutOfBounds = (sprite) => {
      sprite.stopPhysics();
      sprite.hide();
      sprite.setTimer(0, 100, () => {
        this.game.finishBall(sprite);
      });
    };
  }

  private rakeSweep(rake: Sprite): void {
    const rakeRect = rake.screenRect();
    const bottom = rakeRect.b;

    if (bottom > 209) {
      const clip = rake.clip;

      rake.setClipRect(makeRect(clip.l + 4, clip.t, clip.r - 4, clip.b));
    }

    for (let pin = 0; pin < PIN_COUNT; pin++) {
      if (this.game.fellThisBall[pin]) {
        this.dragFallenBody(this.elves.body(pin), bottom);
      }
    }

    this.sweepLeftRake(bottom);
  }

  private dragFallenBody(body: Sprite, rakeBottom: number): void {
    const bodyRect = body.screenRect();

    if (rakeBottom + 10 < bodyRect.b) {
      body.moveBy(0, rakeBottom + 10 - bodyRect.b);
    }

    if (rakeBottom >= 211) {
      return;
    }

    body.setClipRect(makeRect(0, 0, 640, 194));

    const y = Math.trunc((210 - rakeBottom) / 3) + 194;

    body.moveTo(body.px, y);
  }

  private sweepLeftRake(rakeBottom: number): void {
    const leftRake = this.game.find("LeftRake");

    if (rakeBottom > 209) {
      const clip = leftRake.clip;

      leftRake.setClipRect(makeRect(clip.l + 1, clip.t, clip.r - 1, clip.b));
    }

    leftRake.moveTo(leftRake.px, leftRake.py - 2);

    const leftBottom = leftRake.screenRect().b;

    for (let pin = 0; pin < PIN_COUNT; pin++) {
      if (!this.game.fellThisBall[pin]) {
        continue;
      }

      const body = this.elves.leftBody(pin);
      const bodyBottom = body.screenRect().b;

      if (leftBottom + 2 < bodyBottom) {
        body.moveBy(0, leftBottom + 2 - bodyBottom);
      }

      if (leftBottom < 225) {
        body.hide();
      }
    }
  }

  rackersSetElves(): void {
    this.clearRackerHandlers();

    const pins = this.standingPins();

    for (let pin = 0; pin < PIN_COUNT; pin++) {
      this.prepareRackerDescent(pin);
    }

    for (const pin of pins) {
      const racker = this.elves.racker(pin);

      this.rackerDropBounds(racker);
      racker.startPhysicsMpx(0, RACKER_SPEED, 30, false, false, 0);
    }

    this.showRackedElves();
    this.game.behaviors.randomFlail();

    const lead = pins[0];

    if (lead === undefined) {
      return;
    }

    const leader = this.elves.racker(lead);

    leader.onMove = () => {
      this.lowerStep(pins);
    };
    leader.onOutOfBounds = (sprite) => {
      this.elvesSet(sprite);
    };
    this.game.playSound(leader, "Rackpins2.wav", 34);
  }

  private prepareRackerDescent(pin: number): void {
    this.elves.stopPhysics(pin);

    for (const part of this.elves.parts(pin)) {
      part.clearTimers();
    }

    this.elves.stopRacker(pin);
    this.elves.setRackerCel(pin, 0);

    const body = this.elves.body(pin);

    body.moveTo(body.homeX, body.homeY - RACKER_DROP);

    const leftBody = this.elves.leftBody(pin);

    leftBody.moveTo(leftBody.homeX, leftBody.homeY - LEFT_RACKER_DROP);
    this.elves.leftRacker(pin).resetToHome();
    this.elves.racker(pin).resetToHome();
  }

  private showRackedElves(): void {
    for (let pin = 0; pin < PIN_COUNT; pin++) {
      if (this.game.standing[pin]) {
        this.elves.showAll(pin);
        continue;
      }

      this.elves.hideAll(pin);
    }
  }

  private lowerStep(pins: number[]): void {
    for (const pin of pins) {
      this.elves.body(pin).moveByMpx(0, RACKER_SPEED);
      this.elves.leftBody(pin).moveByMpx(0, RACKER_LEFT_SPEED);
      this.elves.leftRacker(pin).moveByMpx(0, RACKER_LEFT_SPEED);
    }
  }

  private elvesSet(leader: Sprite): void {
    for (const racker of this.elves.rackers.sprites) {
      racker.stopPhysics();
    }

    this.game.updatePinMarkers();
    leader.setTimer(0, 450, () => {
      this.resetStandingElves();
      leader.setTimer(0, 400, () => {
        this.rackersRelease(leader);
      });
    });
  }

  private rackersRelease(sprite: Sprite): void {
    this.clearRackerHandlers();

    const pins = this.standingPins();
    const risers: number[] = [];
    for (const pin of pins) {
      const handled = this.game.behaviors.releaseSpecial(pin, sprite);

      if (!handled) {
        risers.push(pin);
      }
    }

    const playSound = risers.length === pins.length;

    risers.forEach((pin, index) => {
      const racker = this.elves.racker(pin);

      racker.onOutOfBounds = null;
      racker.startPhysicsMpx(0, -RACKER_SPEED, 30, false, false, 0);

      if (index !== 0) {
        return;
      }

      racker.onMove = () => {
        this.raiseLeftRackers();
      };
      racker.onOutOfBounds = (leader) => {
        this.rackersGone(leader);
      };
    });

    if (risers.length === 0) {
      this.rackersGone(sprite);
      return;
    }

    if (playSound) {
      this.game.playSound(sprite, "Rackpins.wav", 14);
    }
  }

  private raiseLeftRackers(): void {
    for (let pin = 0; pin < PIN_COUNT; pin++) {
      const keepsHead =
        this.game.ball === 0 && this.game.behaviors.behaviorOf(pin) === Behavior.BouncingHead;

      if (!keepsHead) {
        this.elves.leftRacker(pin).moveByMpx(0, -RACKER_LEFT_SPEED);
      }
    }
  }

  private rackersGone(leader: Sprite): void {
    for (const racker of this.elves.rackers.sprites) {
      racker.stopPhysics();
      racker.clearTimers();
    }

    leader.onMove = null;
    this.game.behaviors.startFrameBehaviors();
    this.game.startMeter();
  }
}
