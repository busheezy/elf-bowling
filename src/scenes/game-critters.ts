import type { Group } from "../scene";
import type { Sprite } from "../sprite";
import type { GameScene } from "./game";

const DEAD_FROG_CEL = 6;
const LANE_CENTER = 160;

export class Critters {
  private readonly game: GameScene;
  private readonly turds: Group;
  private deerFrame = 1;
  private deerActive = false;
  private deerHit = false;
  private isBunny = false;
  private kalvinInactive = true;
  private kalvinFled = false;
  private kalvinY = 0;
  private kalvinLimitY = 0;
  private turdIndex = 0;

  constructor(game: GameScene) {
    this.game = game;
    this.turds = game.makeGroup("Turd??");
  }

  private sprite(name: string): Sprite {
    return this.game.find(name);
  }

  private random(): number {
    return this.game.random();
  }

  private resetSprite(sprite: Sprite): void {
    sprite.resetToHome();
    sprite.hide();
    sprite.stopSequences();
    sprite.clearTimers();
  }

  private resetKalvin(): void {
    this.resetSprite(this.sprite("Kalvin"));
  }

  private resetBird(): void {
    const bird = this.sprite("Bird");

    this.resetSprite(bird);
    bird.cycling = false;
  }

  hideAll(): void {
    this.resetKalvin();

    for (const turd of this.turds.sprites) {
      turd.hide();
      turd.resetToHome();
    }

    this.turdIndex = 0;
    this.resetBird();
  }

  initDeer(): void {
    this.sprite("Deer").resetToHome();
    this.sprite("DeerHead").setCel(0);
    this.deerFrame = (this.random() % 5) + 1;
    this.deerHit = false;
    this.deerActive = false;
  }

  maybeWalkInDeer(frame: number): void {
    if (this.deerFrame > frame || this.deerActive) {
      return;
    }

    const deer = this.sprite("Deer");

    deer.resetToHome();
    deer.show();
    deer.playSequence(0, (sprite) => {
      sprite.setTimer(0, 400, () => {
        this.deerActive = true;
        this.deerHeadUp();
      });
    });

    const head = this.sprite("DeerHead");

    head.setCel(0);
    head.show();
    this.deerHit = false;
  }

  deerHeadUp(): void {
    if (this.deerActive) {
      this.sprite("DeerHead").setCel(1);
    }
  }

  deerHeadDown(): void {
    if (this.deerActive) {
      this.sprite("DeerHead").setCel(0);
    }
  }

  deerCatches(aimPosition: number): boolean {
    const catches = this.deerActive && !this.deerHit && aimPosition === 0;

    if (catches) {
      this.deerHit = true;
    }

    return catches;
  }

  ballToDeer(ball: Sprite): void {
    this.game.stopBalls();

    const deerBall = this.sprite("DeerBall");

    deerBall.show();
    deerBall.moveTo(ball.px, ball.py);
    this.game.stage.sound.clearBackgroundLoop();
    this.game.playSound(deerBall, "BowlDrop.wav", 6);
    deerBall.playSequence(0, (sprite) => {
      this.deerStruck(sprite);
    });
  }

  private deerStruck(deerBall: Sprite): void {
    this.game.deerBallHit();
    this.sprite("DeerHead").hide();
    this.sprite("Deer").playSequence(1, null);
    this.game.playSound(deerBall, "hit.wav", 50);
    deerBall.playSequence(1, (sprite) => {
      this.game.deerBallSettled(sprite);
    });
  }

  setupKalvin(bunny: boolean): void {
    this.isBunny = bunny;
    this.resetBird();
    this.resetKalvin();
    this.kalvinInactive = true;
    this.kalvinFled = false;

    if (this.game.frame < 0) {
      return;
    }

    const kalvin = this.sprite("Kalvin");

    this.kalvinY = kalvin.py;
    this.kalvinLimitY = kalvin.py - 10;
    kalvin.setTimer(0, (this.random() % 1000) + 2400, (sprite) => {
      this.hop(sprite);
    });
    this.kalvinInactive = false;
  }

  private sequenceBase(): number {
    return this.isBunny ? 6 : 0;
  }

  private hop(kalvin: Sprite): void {
    const base = this.sequenceBase();

    kalvin.show();

    const sequence =
      kalvin.px < LANE_CENTER ? (this.random() % 3) + base : (this.random() % 2) + base + 3;

    kalvin.playSequence(sequence, (sprite) => {
      sprite.setTimer(0, 100, () => {
        this.afterHop(sprite);
      });
    });

    if (!this.isBunny) {
      this.game.playSound(kalvin, "FrogCroak.wav", 7);
    }
  }

  private afterHop(kalvin: Sprite): void {
    const nearLane = Math.abs(kalvin.px - LANE_CENTER) < 60;
    const canDrop = this.isBunny && this.turdIndex < this.turds.count && nearLane;

    if (canDrop) {
      const turd = this.turds.at(this.turdIndex);

      this.turdIndex++;
      turd.show();
      turd.moveTo(kalvin.px, kalvin.py);
      turd.setCel(this.random() % 3);
    }

    this.hop(kalvin);
  }

  checkBallCollision(ball: Sprite): void {
    if (this.kalvinInactive || this.kalvinFled || ball.py > this.kalvinY) {
      return;
    }

    const kalvin = this.sprite("Kalvin");

    if (kalvin.overlaps(ball)) {
      this.kalvinHit(kalvin, ball);
    }

    if (ball.py <= this.kalvinLimitY) {
      this.kalvinInactive = true;
    }
  }

  private kalvinHit(kalvin: Sprite, ball: Sprite): void {
    const squished = !this.isBunny && Math.abs(kalvin.px - ball.px) < 10;

    if (!squished) {
      this.ballPassed();
      return;
    }

    kalvin.stopSequences();
    kalvin.clearTimers();
    kalvin.setCel(DEAD_FROG_CEL);
    this.game.playSound(kalvin, "FrogUh.wav", 12);
  }

  ballPassed(): void {
    const kalvin = this.sprite("Kalvin");

    if (!kalvin.visible || this.kalvinFled) {
      return;
    }

    this.kalvinFled = true;

    if (kalvin.cel === DEAD_FROG_CEL) {
      this.birdSwoop(kalvin);
      return;
    }

    kalvin.stopSequences();
    kalvin.clearTimers();
    kalvin.playSequence(this.sequenceBase() + 5, null);

    if (!this.isBunny) {
      this.game.playSound(kalvin, "FrogCroak.wav", 7);
    }
  }

  private birdSwoop(kalvin: Sprite): void {
    const bird = this.sprite("Bird");

    bird.resetToHome();
    bird.show();
    bird.startCelCycle(200, 0, 3);
    bird.glide(
      bird.px,
      bird.py,
      kalvin.px,
      kalvin.py - 10,
      20,
      30,
      80,
      (sprite) => this.birdArrived(sprite),
      100,
    );
    this.game.playSound(bird, "BirdDie.wav", 7);
  }

  private birdArrived(bird: Sprite): void {
    bird.cycling = false;
    bird.setCel(2);
    bird.setTimer(0, 200, () => {
      bird.cycling = false;
      bird.setCel(2);
      bird.setTimer(0, 200, () => {
        this.birdLeaves(bird);
      });
    });
  }

  private birdLeaves(bird: Sprite): void {
    this.resetKalvin();
    bird.startCelCycle(200, 3, 3);
    bird.glide(bird.px, bird.py, bird.homeX, bird.homeY, 50, 30, 100, null, 100);
    this.game.playSound(bird, "BirdDie.wav", 7);
  }
}
