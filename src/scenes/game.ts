import type { TextCast } from "../cast";
import { resolveKnockdown } from "../knockdown";
import { Scene, type Group } from "../scene";
import {
  createFrames,
  EMPTY,
  firstBallMark,
  isGameOver,
  latestTotal,
  secondBallMark,
  updateTotals,
  type Frame,
} from "../scoring";
import { makeRect, type Sprite } from "../sprite";
import { session } from "../state";
import { Elves, PIN_COUNT } from "./elves";
import { buildGameScene } from "./game-setup";
import { Behavior, ElfBehaviors } from "./game-elves";
import { Critters } from "./game-critters";

const METER_INTERVAL = 20;
const METER_MAX = 1400;
const METER_STEP = 50;
const MARKER_COUNT = 15;
const BALL_START_X = 160;
const BALL_START_Y = 500;
const BALL_BOUNDS = makeRect(0, 212, 320, 502);
const BALL_STEP_MS = 20;
const RACKER_SPEED = 8000;
const RACKER_LEFT_SPEED = 2000;
const RACKER_DROP = 336;
const LEFT_RACKER_DROP = 84;
const TAUNT_IDLE_MS = 5000;

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function mapRange(value: number, fromX: number, fromY: number, toX: number, toY: number): number {
  const percent = Math.trunc(((value - fromY) * 100) / (toY - fromY));

  return fromX + Math.trunc(((toX - fromX) * percent) / 100);
}

function ballSizeCel(progress: number): number {
  if (progress >= 75) {
    return 3;
  }

  if (progress >= 50) {
    return 2;
  }

  if (progress > 24) {
    return 1;
  }

  return 0;
}

export class GameScene extends Scene {
  elves!: Elves;
  behaviors!: ElfBehaviors;
  critters!: Critters;
  standing: boolean[] = Array.from({ length: PIN_COUNT }, () => true);
  remaining: boolean[] = Array.from({ length: PIN_COUNT }, () => true);
  fellThisBall: boolean[] = Array.from({ length: PIN_COUNT }, () => false);
  ducked: boolean[] = Array.from({ length: PIN_COUNT }, () => false);
  knockedCount = 0;
  frame = -1;
  ball = 1;
  gutter = false;
  private frames: Frame[] = createFrames();
  private rowThresholds: number[] = [];
  private markers!: Group;
  private leftBalls!: Group;
  private rightBalls!: Group;
  private scoreBoxes!: Group;
  private scoreTexts!: Group;
  private markA!: Group;
  private markB!: Group;
  private ballMarkers: Sprite[] = [];
  private elfMarkers!: Group;
  private meterPosition = 0;
  private meterDirection = 1;
  private meterRunning = false;
  private aimPosition = 0;
  private drift = 0;
  private cheat: "none" | "strike" | "gutter" | "spare" | "random" = "none";
  private leftGutter = false;
  private rightGutter = false;
  private currentRow = 4;
  private flyTable: number[] | null = null;
  private delayTable: number[] | null = null;
  private mirrored = false;
  private waitingForThrow = false;
  private idleSince = 0;
  private tauntBusy = false;
  private tauntedNormal = false;
  private idleTaunts = 0;
  private idleTaunted = [false, false];
  private tauntPin = 0;
  private tauntIsGutter = false;
  private hintShown = false;
  private screamDone = false;

  protected init(alreadyInitialized: boolean): void {
    if (alreadyInitialized) {
      return;
    }

    this.onKeyDown = (event) => {
      this.handleKey(event);
    };
    this.onMouseDown = () => {
      this.handleThrowInput("Space");
    };
    this.rowThresholds = buildGameScene(this, () => {
      this.stage.gotoScene("Exit");
    });
    this.elves = new Elves({
      heads: this.makeGroup("Elf??"),
      bodies: this.makeGroup("Elf?? Body"),
      arms: this.makeGroup("Elf?? Arms"),
      leftHeads: this.makeGroup("#Elf??"),
      leftBodies: this.makeGroup("#Elf?? Body"),
      leftArms: this.makeGroup("#Elf?? Arms"),
      rackers: this.makeGroup("Racker??"),
      leftRackers: this.makeGroup("#Racker??"),
    });
    this.markers = this.makeGroup("Marker??");
    this.leftBalls = this.makeGroup("LeftBall??");
    this.rightBalls = this.makeGroup("RightBall??");
    this.scoreBoxes = this.makeGroup("Score??");
    this.scoreTexts = this.makeGroup("ScoreText??");
    this.markA = this.makeGroup("ScoreMarkA??");
    this.markB = this.makeGroup("ScoreMarkB??");
    this.elfMarkers = this.makeGroup("ElfMarker??");
    this.ballMarkers = [this.find("BallMarker0"), this.find("BallMarker1")];
    this.behaviors = new ElfBehaviors(this);
    this.critters = new Critters(this);
  }

  protected start(): void {
    this.cheat = "none";
    session.finalScore = 0;
    session.cheated = false;
    session.key1 = (this.random() % 999999) + 1;
    this.frame = -1;
    this.ball = 1;
    this.behaviors.shuffleFrameOrder();
    this.resetScoreboard();
    this.critters.hideAll();
    this.critters.initDeer();
    this.blinkScoreLights(this.find("LightsOn"));
    this.find("Rake").hide();
    this.find("LeftRake").hide();
    this.idleTaunts = 0;
    this.idleTaunted = [false, false];
    this.tauntedNormal = false;
    this.advance();
    this.beginFirstBall();
    this.ballMarkers[0].setCel(0);
    this.ballMarkers[1].setCel(0);
    this.elfMarkers.showRange(0, PIN_COUNT);
    this.elfMarkers.setCelRange(0, PIN_COUNT, 0);
  }

  private beginFirstBall(): void {
    if (!this.hintShown) {
      this.hintShown = true;
      this.showHintAfter(3750);
    }

    this.nextBall();
  }

  private showHintAfter(ms: number): void {
    const hint = this.find("Hint1a");

    hint.setTimer(0, ms, (sprite) => {
      sprite.show();
      this.playSound(sprite, "BepBeep.wav", 4);
      sprite.setTimer(0, 3500, () => {
        this.hideHint();
      });
    });
  }

  private hideHint(): void {
    const hint = this.find("Hint1a");

    hint.hide();
    hint.clearTimers();
  }

  private blinkScoreLights(lights: Sprite): void {
    lights.show();
    lights.setCel(lights.cel === 0 ? 1 : 0);
    lights.setTimer(0, 350, (sprite) => {
      this.blinkScoreLights(sprite);
    });
  }

  private resetScoreboard(): void {
    for (let index = 0; index < this.scoreBoxes.count; index++) {
      const box = `Score${pad2(index)}`;

      this.applyParmOffset(box, `ScoreText${pad2(index)}`);
      this.applyParmOffset(box, `ScoreMarkA${pad2(index)}`);
      this.applyParmOffset(box, `ScoreMarkB${pad2(index)}`);
      this.textOf(this.scoreTexts.at(index)).setText(" ");
      this.textOf(this.markA.at(index)).setText(" ");
      this.textOf(this.markB.at(index)).setText(" ");
    }

    this.applyParmOffset("Score09", "ScoreMarkC09");
    this.textOf(this.find("ScoreMarkC09")).setText(" ");
    this.frames = createFrames();
  }

  private handleKey(event: KeyboardEvent): void {
    if (event.ctrlKey) {
      this.handleCheat(event.key.toUpperCase());
      return;
    }

    this.hideHint();

    if (event.key === "Escape") {
      this.stage.gotoScene("Exit");
      return;
    }

    const isThrowKey = event.key === " " || event.key === "Enter";

    if (isThrowKey) {
      this.handleThrowInput(event.key);
    }
  }

  private handleCheat(key: string): void {
    const cheats: Record<string, GameScene["cheat"]> = {
      X: "strike",
      D: "gutter",
      S: "spare",
      G: "random",
      N: "none",
    };
    const selected = cheats[key];

    if (!selected) {
      return;
    }

    this.cheat = selected;

    if (selected !== "none") {
      session.cheated = true;
    }
  }

  private handleThrowInput(_key: string): void {
    this.hideHint();

    if (!this.meterRunning) {
      return;
    }

    this.stopMeter();
    this.santaThrow();
  }

  private startMeter(): void {
    this.startIdleTauntWatch();
    this.markers.setCelAll(0);
    this.meterPosition = 0;
    this.meterDirection = 1;
    this.updateMarkers();
    this.markers.at(0).setTimer(0, METER_INTERVAL, (sprite) => {
      this.meterTick(sprite);
    });
  }

  private meterTick(marker: Sprite): void {
    this.meterPosition += this.meterDirection * METER_STEP;

    if (this.meterPosition > METER_MAX) {
      this.meterDirection = -1;
      this.meterPosition = METER_MAX;
    } else if (this.meterPosition < 0) {
      this.meterDirection = 1;
      this.meterPosition = 0;
    }

    this.updateMarkers();
    marker.setTimer(0, METER_INTERVAL, (sprite) => {
      this.meterTick(sprite);
    });
    this.meterRunning = true;
  }

  private updateMarkers(): void {
    for (let index = 0; index < MARKER_COUNT; index++) {
      const marker = this.markers.at(index);
      const distance = Math.abs(this.meterPosition - index * 100);

      if (distance === 0) {
        marker.setCel(2);
      } else if (distance < 51) {
        marker.setCel(1);
      } else if (distance < 101) {
        marker.setCel(0);
      }
    }
  }

  private stopMeter(): void {
    this.meterRunning = false;
    this.markers.at(0).clearTimers();
  }

  private startIdleTauntWatch(): void {
    this.tauntBusy = false;
    this.waitingForThrow = true;
    this.idleSince = this.now;

    if (this.ball !== 1) {
      return;
    }

    this.find("BlackLine").setTimer(1, 1000, () => {
      this.checkIdleTaunt();
    });
  }

  private checkIdleTaunt(): void {
    if (!this.waitingForThrow) {
      return;
    }

    const idle = this.now - this.idleSince;

    if (idle >= TAUNT_IDLE_MS) {
      this.idleTaunt();
      return;
    }

    this.find("BlackLine").setTimer(1, 1000, () => {
      this.checkIdleTaunt();
    });
  }

  private tauntCandidate(): number {
    for (let pin = PIN_COUNT - 1; pin >= 0; pin--) {
      const eligible =
        this.standing[pin] && this.behaviors.behaviorOf(pin) !== Behavior.BouncingHead;

      if (eligible) {
        return pin;
      }
    }

    return -1;
  }

  private idleTaunt(): void {
    if (this.idleTaunts >= 2) {
      return;
    }

    const pin = this.tauntCandidate();

    if (pin < 0) {
      return;
    }

    const choices = [0, 1].filter((index) => !this.idleTaunted[index]);
    const pick = choices[this.random() % choices.length] ?? 0;
    const sound = pick === 0 ? "Taunt2b.wav" : "Taunt3b.wav";

    this.idleTaunted[pick] = true;
    this.idleTaunts++;
    this.playSoundTalking(this.elves.head(pin), sound, 30, 100);
    this.tauntBusy = true;
  }

  private ballEndTaunt(): number {
    const alreadyTaunted = !this.gutter && this.tauntedNormal;

    if (this.tauntBusy || this.ball !== 1 || alreadyTaunted) {
      return 0;
    }

    const pin = this.tauntCandidate();

    if (pin < 0) {
      return 0;
    }

    if (!this.gutter) {
      this.tauntedNormal = true;
    }

    this.tauntPin = pin;
    this.tauntIsGutter = this.gutter;

    const delay = this.gutter ? 800 : 1200;

    this.find("BlackLine").setTimer(2, delay, () => {
      this.playBallEndTaunt();
    });
    this.tauntBusy = true;

    return this.gutter ? 2300 : 2700;
  }

  private playBallEndTaunt(): void {
    const head = this.elves.head(this.tauntPin);
    const sound = this.tauntIsGutter ? "GutterBall2b.wav" : "Taunt1b.wav";
    const talkMs = this.tauntIsGutter ? 0 : 100;

    this.playSoundTalking(head, sound, 30, talkMs);
  }

  private aimFromMeter(): number {
    if (this.cheat === "strike") {
      return (this.random() % 2) * 2 + 13;
    }

    if (this.cheat === "gutter") {
      return 0;
    }

    if (this.cheat === "spare") {
      return this.ball === 0 ? 14 : (this.random() % 2) * 10 + 9;
    }

    if (this.cheat === "random") {
      return (this.random() % 8) + (this.random() % 2) * 20 + 1;
    }

    return Math.trunc(this.meterPosition / 50);
  }

  private computeDrift(): number {
    this.aimPosition = this.aimFromMeter();

    const base = this.cheat === "none" ? this.meterPosition : this.aimPosition * 50;

    return Math.trunc(base / 14) - 50;
  }

  private santaThrow(): void {
    this.waitingForThrow = false;

    const santa = this.find("Santa");
    const y = santa.py;

    santa.setBounds(makeRect(0, y - 100, 320, y + 2));
    santa.startPhysics(0, -10, 30);
    santa.onMove = (sprite) => {
      this.santaMoved(sprite);
    };
    santa.onOutOfBounds = (sprite) => {
      sprite.stopPhysics();
      sprite.setTimer(0, 800, () => {
        sprite.setCel(0);
      });
    };
  }

  private santaMoved(santa: Sprite): void {
    const releasePoint = santa.bounds.b - 60;

    if (santa.cel !== 0 || santa.py >= releasePoint) {
      return;
    }

    santa.setCel(1);
    this.launchBall();
  }

  private santaWalkIn(): void {
    const santa = this.find("Santa");

    santa.setCel(0);
    santa.resetToHome();
    santa.show();

    const y = santa.py;

    santa.setBounds(makeRect(0, y - 72, 320, y + 2));
    santa.startPhysics(0, -6, 60);
    santa.onOutOfBounds = (sprite) => {
      sprite.stopPhysics();
    };
  }

  private computeKnockdown(): void {
    const variant = this.random() % 3;
    const result = resolveKnockdown(
      this.stage.assets.data,
      this.aimPosition,
      this.standing,
      variant,
    );

    this.fellThisBall.fill(false);
    this.remaining = this.standing.map((isStanding, pin) => isStanding && !result.knocked[pin]);
    this.knockedCount = result.count;
    this.flyTable = result.fly;
    this.delayTable = result.delay;
    this.mirrored = result.mirrored;
  }

  private launchBall(): void {
    this.leftGutter = false;
    this.rightGutter = false;
    this.gutter = false;
    this.screamDone = false;
    this.currentRow = 4;
    this.drift = this.computeDrift();
    this.computeKnockdown();

    const ball = this.leftBalls.at(this.currentRow);

    ball.setCel(0);
    ball.moveTo(BALL_START_X, BALL_START_Y);
    this.leftBalls.hideAll();
    ball.show();
    this.rollBall(ball, 0, -16);
    this.playSound(ball, "BowlDrop.wav", 8);
    this.stage.sound.setBackgroundLoop(this, "BowlBack.wav");
  }

  private rollBall(ball: Sprite, vx: number, vy: number): void {
    ball.setBounds(BALL_BOUNDS);
    ball.startPhysics(vx, vy, BALL_STEP_MS);
    ball.onMove = (sprite) => {
      this.ballMoved(sprite);
    };
    ball.onOutOfBounds = (sprite) => {
      this.ballFinished(sprite);
    };
  }

  private gutterX(y: number): number {
    if (this.leftGutter) {
      return mapRange(y, 0, 480, 126, 220);
    }

    return mapRange(y, 320, 480, 194, 220);
  }

  private laneX(ball: Sprite, y: number, progress: number): number | null {
    if (this.leftGutter || this.rightGutter) {
      return this.gutterX(y);
    }

    const x = Math.trunc((this.drift * progress) / 60) + BALL_START_X;

    if (progress >= 97) {
      return x;
    }

    const leftEdge = mapRange(y, 24, 480, 130, 220);

    if (leftEdge >= x) {
      return this.enterLeftGutter(ball, y);
    }

    const rightEdge = mapRange(y, 296, 480, 190, 220);

    if (rightEdge > x) {
      return x;
    }

    this.rightGutter = true;
    this.gutter = true;
    this.playSound(ball, "BowlDrop.wav", 6);

    return mapRange(y, 320, 480, 194, 220);
  }

  private enterLeftGutter(ball: Sprite, y: number): number | null {
    this.leftGutter = true;
    this.gutter = true;

    const deerTakes = this.critters.deerCatches(this.aimPosition);

    if (deerTakes) {
      this.critters.ballToDeer(ball);
      return null;
    }

    this.playSound(ball, "BowlDrop.wav", 6);

    return mapRange(y, 0, 480, 126, 220);
  }

  private ballMoved(ball: Sprite): void {
    const y = ball.py;
    const progress = Math.trunc(((500 - y) * 100) / 288);
    const x = this.laneX(ball, y, progress);

    if (x === null) {
      return;
    }

    ball.moveTo(x, y);

    if (y < 331) {
      this.critters.deerHeadDown();
      this.behaviors.moonerDodge();
      this.scareElvesOnce();
    }

    if (y < 267) {
      this.updateRightView(x, y);
    }

    const active = this.switchBallSprite(ball, x, y);
    const cel = this.scaledCel(active, progress);
    const vy = cel - 16;

    this.rollBall(active, 0, vy);
    this.critters.checkBallCollision(active);
  }

  private switchBallSprite(ball: Sprite, x: number, y: number): Sprite {
    const target = this.leftBalls.at(this.currentRow);

    if (target === ball) {
      return ball;
    }

    ball.hide();
    ball.stopPhysics();
    target.setCel(ball.cel);
    target.show();
    target.moveTo(x, y);

    return target;
  }

  private scaledCel(ball: Sprite, progress: number): number {
    const thresholds = this.stage.assets.data.ballScale;
    const offset = thresholds.slice(ball.cel).findIndex((threshold) => threshold > progress);
    const cel = ball.cel + offset;

    ball.setCel(cel);

    return cel;
  }

  private updateRightView(x: number, y: number): void {
    const progress = Math.trunc(((y - 266) * 100) / -54);
    const leftEdge = mapRange(y, 24, 480, 130, 220);
    const rightEdge = mapRange(y, 296, 480, 190, 220);
    const lateral = Math.trunc(((x - leftEdge) * 100) / (rightEdge - leftEdge));
    const rightY = Math.trunc((progress * -362) / 100) + 530;
    const rightX = this.rightViewX(rightY, lateral);
    const row = this.rowForY(rightY);

    if (row !== this.currentRow) {
      this.knockRow(row);
      this.currentRow = row;
    }

    const ball = this.rightBalls.at(row);

    this.rightBalls.hideAll();
    ball.show();
    ball.setCel(ballSizeCel(progress));
    ball.moveTo(rightX, rightY);
  }

  private rightViewX(rightY: number, lateral: number): number {
    if (this.leftGutter) {
      return mapRange(rightY, 170, 480, 356, 195);
    }

    if (this.rightGutter) {
      return mapRange(rightY, 790, 480, 604, 195);
    }

    const leftEdge = mapRange(rightY, 232, 480, 384, 195);
    const rightEdge = mapRange(rightY, 728, 480, 576, 195);

    return Math.trunc(((rightEdge - leftEdge) * lateral) / 100) + leftEdge;
  }

  private rowForY(rightY: number): number {
    const row = this.rowThresholds.findIndex((threshold) => rightY <= threshold);

    return row === -1 ? 4 : row;
  }

  private knockRow(row: number): void {
    const ranges = [
      [0, 4],
      [4, 7],
      [7, 9],
      [9, 10],
    ];
    const range = ranges[row];

    if (!range) {
      return;
    }

    for (let pin = range[0]; pin < range[1]; pin++) {
      this.knockPin(pin);
    }
  }

  private tableIndex(pin: number): number {
    if (!this.mirrored) {
      return pin;
    }

    return this.stage.assets.data.mirror[pin];
  }

  private knockPin(pin: number): void {
    const shouldFall = this.standing[pin] && !this.remaining[pin];

    if (!shouldFall) {
      return;
    }

    const index = this.tableIndex(pin);
    const delay = this.delayTable ? this.delayTable[index] : 0;
    const body = this.elves.body(pin);

    if (delay === 0) {
      this.flyElf(pin);
    } else {
      body.setTimer(3, delay, () => {
        this.flyElf(pin);
      });
    }

    this.standing[pin] = false;
    this.fellThisBall[pin] = true;
  }

  private flyElf(pin: number): void {
    const index = this.tableIndex(pin);
    const flyType = this.flyTable ? this.flyTable[index] : 1;
    const speeds: Record<number, number> = { 2: 3000, 3: 8000 };
    const speed = speeds[flyType] ?? 0;
    const direction = this.mirrored ? -1 : 1;
    const vx = speed * direction;
    const baseCel = this.random() % 2 === 0 ? 10 : 6;
    const cel = (this.random() % 2) + baseCel;

    this.elves.stopActions(pin);
    this.elves.clearSway(pin);
    this.elves.hideUpperParts(pin);
    this.elves.setBodyCel(pin, cel);
    this.elves.fly(pin, vx, -18000);
    this.elves.body(pin).onOutOfBounds = () => {
      this.elfLanded(pin);
    };
  }

  private elfLanded(pin: number): void {
    const body = this.elves.body(pin);
    const deadBase = body.cel < 10 ? 8 : 12;
    const cel = (this.random() % 2) + deadBase;

    this.elves.stopPhysics(pin);
    this.elves.landBodies(pin);
    this.elves.setBodyCel(pin, cel);
  }

  private scareElvesOnce(): void {
    if (this.screamDone) {
      return;
    }

    this.screamDone = true;

    const scared = this.behaviors.scareStandingElves();

    if (scared > 0) {
      this.playSound(this.elves.head(0), "ElfScream.wav", 42);
    }
  }

  stopBalls(): void {
    const balls = [...this.leftBalls.sprites, ...this.rightBalls.sprites];

    for (const sprite of balls) {
      sprite.stopPhysics();
      sprite.clearTimers();
      sprite.hide();
    }
  }

  private ballFinished(ball: Sprite): void {
    this.stopBalls();
    this.stage.sound.clearBackgroundLoop();

    const sound = this.knockedCount === 0 ? "GutterBall.wav" : "Pins.wav";
    const priority = this.knockedCount === 0 ? 44 : 46;

    this.playSound(ball, sound, priority);
    this.recoverDuckedElves();

    const tauntDelay = this.ballEndTaunt();

    this.recordBall();
    this.critters.ballPassed();
    ball.setTimer(0, tauntDelay + 500, () => {
      this.afterBall(ball);
    });
  }

  deerBallHit(): void {
    this.recoverDuckedElves();
  }

  deerBallSettled(ball: Sprite): void {
    ball.setTimer(0, 1500, () => {
      this.recordBall();
      this.critters.ballPassed();
      ball.setTimer(0, 500, () => {
        this.afterBall(ball);
      });
    });
  }

  private recoverDuckedElves(): void {
    this.find("BlackLine").setTimer(0, 200, () => {
      this.behaviors.recoverDucked();
    });
  }

  private afterBall(ball: Sprite): void {
    this.critters.deerHeadUp();
    this.santaReaction();
    ball.setTimer(3, 1000, () => {
      this.rackersPickUp();
    });
  }

  private santaReaction(): void {
    const santa = this.find("Santa");
    const walkBack = () => {
      santa.setTimer(0, 300, () => {
        santa.playSequence(1, null);
      });
    };
    const allDown = this.standing.every((isStanding) => !isStanding);

    if (!allDown) {
      walkBack();
      return;
    }

    santa.playSequence(0, walkBack);
    this.playSound(santa, "HoHoHo.wav", 48);
  }

  private recordBall(): void {
    const frame = this.frames[this.frame];

    frame.balls[this.ball] = this.knockedCount;
    updateTotals(this.frames);
    this.renderScores();
    session.finalScore = latestTotal(this.frames);
    this.updatePinMarkers();
  }

  private markSprite(frameIndex: number, ballIndex: number): Sprite {
    const tenthFirst = this.frames[9].balls[0];

    if (frameIndex === 11 || (frameIndex === 10 && ballIndex === 1)) {
      return this.find("ScoreMarkC09");
    }

    if (frameIndex === 10) {
      return tenthFirst === 10 ? this.markB.at(9) : this.find("ScoreMarkC09");
    }

    if (ballIndex === 1) {
      return this.markB.at(frameIndex);
    }

    const first = this.frames[frameIndex].balls[0];
    const strikeInRightBox = first === 10 && frameIndex < 9;

    return strikeInRightBox ? this.markB.at(frameIndex) : this.markA.at(frameIndex);
  }

  private renderScores(): void {
    this.frames.forEach((frame, frameIndex) => {
      this.renderMarks(frame, frameIndex);

      if (frameIndex >= 10 || frame.total === EMPTY) {
        return;
      }

      const text = this.textOf(this.scoreTexts.at(frameIndex));

      text.setText(String(frame.total));
    });
  }

  private renderMarks(frame: Frame, frameIndex: number): void {
    const first = frame.balls[0];
    const second = frame.balls[1];

    if (first >= 0 && !frame.shownBalls[0]) {
      const mark = firstBallMark(first);

      this.writeMark(this.markSprite(frameIndex, 0), mark);
      frame.shownBalls[0] = true;
    }

    if (second >= 0 && !frame.shownBalls[1]) {
      const mark = secondBallMark(first, second, frameIndex);

      this.writeMark(this.markSprite(frameIndex, 1), mark);
      frame.shownBalls[1] = true;
    }
  }

  private writeMark(sprite: Sprite, mark: string): void {
    const text: TextCast = this.textOf(sprite);

    text.setText(mark);
  }

  private updatePinMarkers(): void {
    this.ballMarkers[0].show();
    this.ballMarkers[0].setCel(1);
    this.ballMarkers[1].show();
    this.ballMarkers[1].setCel(this.ball);

    for (let pin = 0; pin < PIN_COUNT; pin++) {
      const marker = this.elfMarkers.at(pin);

      marker.show();
      marker.setCel(this.standing[pin] ? 1 : 0);
    }
  }

  private standingPins(): number[] {
    const pins: number[] = [];

    for (let pin = 0; pin < PIN_COUNT; pin++) {
      if (this.standing[pin]) {
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

  private rackersPickUp(): void {
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
    this.playSound(leader, "Rackpins.wav", 14);
  }

  private moveLeftRackers(pins: number[], dy: number): void {
    for (const pin of pins) {
      this.elves.leftRacker(pin).moveByMpx(0, dy);
    }
  }

  private rackersGrabbed(leader: Sprite, pins: number[]): void {
    this.critters.deerHeadDown();

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

    this.playSound(leader, "Rackpins.wav", 14);
    this.behaviors.randomFlail();
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

    this.critters.deerHeadUp();
    leader.setTimer(3, 100, () => {
      this.sweepOrContinue();
    });
  }

  private sweepOrContinue(): void {
    const anyFell = this.fellThisBall.some((fell) => fell);
    const rake = this.find("Rake");

    if (!anyFell) {
      this.finishBall(rake);
      return;
    }

    this.rakeDown(rake);
  }

  private rakeDown(rake: Sprite): void {
    rake.resetToHome();
    rake.show();

    const leftRake = this.find("LeftRake");

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
        this.finishBall(sprite);
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
      if (this.fellThisBall[pin]) {
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
    const leftRake = this.find("LeftRake");

    if (rakeBottom > 209) {
      const clip = leftRake.clip;

      leftRake.setClipRect(makeRect(clip.l + 1, clip.t, clip.r - 1, clip.b));
    }

    leftRake.moveTo(leftRake.px, leftRake.py - 2);

    const leftBottom = leftRake.screenRect().b;

    for (let pin = 0; pin < PIN_COUNT; pin++) {
      if (!this.fellThisBall[pin]) {
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

  private finishBall(sprite: Sprite): void {
    const gameOver = isGameOver(this.frames, this.frame);

    if (gameOver) {
      this.playSound(sprite, "gameovr.wav", 58);
      sprite.setTimer(3, 3000, () => {
        this.stage.gotoScene("Exit");
      });
      return;
    }

    this.advance();
    this.nextBall();
  }

  private advance(): void {
    this.stepFrame();

    if (this.ball === 0) {
      this.standing.fill(true);
    }

    this.highlightFrame();

    for (let pin = 0; pin < PIN_COUNT; pin++) {
      this.elves.hideAll(pin);
    }

    this.stopMeter();
    this.waitingForThrow = false;
  }

  private stepFrame(): void {
    if (this.ball === 1) {
      this.frame++;
      this.ball = 0;
      return;
    }

    const current = this.frames[this.frame];
    const isStrike = current && current.balls[this.ball] === 10;

    if (isStrike) {
      this.frame++;
      this.ball = 0;
      return;
    }

    this.ball++;
  }

  private highlightFrame(): void {
    const index = Math.min(this.frame, 9);

    this.scoreBoxes.setCelAll(0);
    this.scoreBoxes.setCelRange(index, 1, 1);
  }

  private nextBall(): void {
    this.critters.maybeWalkInDeer(this.frame);

    if (this.ball === 0) {
      this.behaviors.assignFrame(this.frame);
    }

    this.elves.racker(0).setTimer(0, 300, () => {
      this.rackersSetElves();
    });
    this.santaWalkIn();
  }

  private rackersSetElves(): void {
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
    this.behaviors.randomFlail();

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
    this.playSound(leader, "Rackpins2.wav", 34);
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
      if (this.standing[pin]) {
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

    this.updatePinMarkers();
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
      const handled = this.behaviors.releaseSpecial(pin, sprite);

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
      this.playSound(sprite, "Rackpins.wav", 14);
    }
  }

  private raiseLeftRackers(): void {
    for (let pin = 0; pin < PIN_COUNT; pin++) {
      const keepsHead = this.ball === 0 && this.behaviors.behaviorOf(pin) === Behavior.BouncingHead;

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
    this.behaviors.startFrameBehaviors();
    this.startMeter();
  }
}
