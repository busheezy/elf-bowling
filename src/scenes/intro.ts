import type { TextCast } from "../cast";
import { Scene, type Group } from "../scene";
import { makeRect, type Sprite } from "../sprite";

const SNOW_BITMAPS = ["SnowFlake1b.bmp", "SnowFlake2b.bmp", "SnowFlake3b.bmp"];
const SNOW_PATTERN = [
  0, 1, 2, 0, 1, 2, 0, 1, 2, 0, 1, 2, 0, 1, 2, 0, 1, 2, 0, 1, 0, 1, 2, 0, 1, 2, 0, 1, 2, 0, 1, 2, 0,
  1, 2, 0, 1, 2, 0, 1, 2, 2, 0, 1, 2, 0, 1, 2, 0, 1, 2, 2, 0, 1, 2, 0, 1, 2, 0, 1,
];
const SNOW_DRIFTS: [number, number][] = [
  [300, 1000],
  [300, 1200],
  [-300, 1000],
  [-300, 1200],
];
const STORY_FONT = 4;
const STORY_MS_PER_PIXEL = 70;
const RULES_FONT = 2;
const RULES_MS_PER_PIXEL = 120;
const SCROLL_RESTART_DELAY = 1200;
const PLAY_DELAY = 500;

function snowName(index: number): string {
  const suffix = String(index).padStart(2, "0");

  return `SnowFlake${suffix}`;
}

export class IntroScene extends Scene {
  private snow!: Group;
  private lights!: Group;
  private scrollText!: TextCast;

  protected init(alreadyInitialized: boolean): void {
    if (alreadyInitialized) {
      return;
    }

    this.onKeyDown = (event) => {
      this.handleKey(event);
    };

    this.createBackdrop();
    this.createScroll();
    this.createElves();
    this.createLights();
    this.createButtons();
    this.createSnow();
  }

  private createBackdrop(): void {
    for (let index = 0; index < 20; index++) {
      const suffix = String(index).padStart(2, "0");

      this.addSprite(`Base${suffix}`, "MountainBase.bmp");
    }

    this.addSprite("MountainsR", "Mountains.bmp");
    this.addSprite("MountainsC", "Mountains.bmp");
    this.addSprite("MountainsL", "MountainsRx.bmp");
    this.addSprite("SantaWalkBack", "SantaWalkBack.bmp");
    this.addSprite("Circle", "SantaCircle.bmp");
    this.addSprite("Copyright", "Copyright.bmp");
    this.addSprite("BLogo", "BowlingLogo.bmp");
    this.addSprite("NStormx", "NStormLogo.bmp");
  }

  private createScroll(): void {
    const scroll = this.addSprite("Scroll", "Scroll.bmp");
    const created = this.addTextSprite("ScrollText", scroll, 2, 20, 12, -24, -600);

    created.sprite.noParm = true;
    created.text.color = 0;
    this.scrollText = created.text;
  }

  private createElves(): void {
    this.addSprite("Elf00 Body", "Elf Body0.bmp");

    const smoker = this.addSprite("Elf00", "Elf0.bmp");

    this.addCel(smoker, "ElfSmoke.bmp");
    this.setTalkOverlay(smoker, "Elf0 Talk.bmp", 0);
    this.setTalkOverlay(smoker, "Elf0 Talk.bmp", 1);

    const smokerArms = this.addSprite("Elf00 Arms", "Elf ArmsSmoke1.bmp");

    this.addCel(smokerArms, "Elf ArmsSmoke2.bmp");
    smokerArms.newSequence(1);
    smokerArms.addSteps(0, 1, 1, 0, 0, 3200);
    smokerArms.addSteps(1, 1, 1, 0, 0, 600);
    smokerArms.addSteps(0, 1, 1, 0, 0, 250);
    smokerArms.addSteps(1, 1, 1, 0, 0, 600);
    smokerArms.addSteps(0, 1, 1, 0, 0, 250);

    this.addSprite("Elf01 Body", "Elf Body0.bmp");
    this.addSprite("Elf01", "Elf0.bmp");

    const signArms = this.addSprite("Elf01 Arms", "Elf ArmsSign2a.bmp");

    this.addCel(signArms, "Elf ArmsSign2b.bmp");
  }

  private createLights(): void {
    const bottom = this.addSprite("Lights00", "LightsOff.bmp");

    this.addCel(bottom, "LightsOn.bmp");

    const left = this.addSprite("Lights02", "LightsOff90.bmp");

    this.addCel(left, "LightsOn90.bmp");

    const right = this.addSprite("Lights03", "LightsOff90.bmp");

    this.addCel(right, "LightsOn90.bmp");
    this.lights = this.makeGroup("Lights??");
  }

  private createButtons(): void {
    const rules = this.addButton("IntroRules", "RulesOn.bmp", "RulesOff.bmp");

    rules.onClick = () => {
      this.startRules();
    };

    const play = this.addButton("IntroPlay", "PlayOn.bmp", "PlayOff.bmp");

    play.onClick = () => {
      this.stage.gotoScene("Game");
    };
  }

  private createSnow(): void {
    SNOW_PATTERN.forEach((bitmapIndex, index) => {
      const bitmap = SNOW_BITMAPS[bitmapIndex];

      this.addSprite(snowName(index), bitmap);
    });

    this.addSprite(snowName(50), SNOW_BITMAPS[2]);
    this.snow = this.makeGroup("SnowFlake??");

    for (const flake of this.snow.sprites) {
      this.setupFlake(flake);
    }
  }

  private setupFlake(flake: Sprite): void {
    flake.noParm = true;
    flake.setAllCelsMode(1);

    const y = -(this.random() % 480);
    const x = this.random() % 640;

    flake.setHome(x, y);

    for (const [dx, dy] of SNOW_DRIFTS) {
      flake.newSequence(1, true);

      for (let step = 0; step < 6; step++) {
        flake.addStepsMpx(0, 2, 1, dx, dy, 20);
      }
    }

    flake.setBounds(makeRect(0, -481, 640, 492));
  }

  protected start(): void {
    for (const flake of this.snow.sprites) {
      flake.resetToHome();
      flake.setTimer(0, this.random() % 100, (sprite) => {
        this.snowStep(sprite);
      });
    }

    this.startStory();

    for (const light of this.lights.sprites) {
      light.setTimer(0, this.random() % 600, (sprite) => {
        this.toggleLight(sprite);
      });
    }

    this.find("Elf01 Arms").startCelCycle(450, 0, 2);

    const circleRect = this.find("Circle").screenRect();

    this.find("SantaWalkBack").setClipRect(circleRect);
    this.find("Elf00 Arms").playSequence(0, (sprite) => {
      this.smokeCycleDone(sprite);
    });
  }

  private snowStep(flake: Sprite): void {
    const x = flake.px;
    const y = flake.py;

    if (y >= flake.bounds.b) {
      const newY = -(this.random() % 480);
      const newX = this.random() % 640;

      flake.setHome(newX, newY);
      flake.resetToHome();
    }

    const drift = this.chooseDrift(x);

    flake.playSequence(drift, (sprite) => {
      this.snowStep(sprite);
    });
  }

  private chooseDrift(x: number): number {
    if (x >= 588) {
      return 2 + (this.random() % 2);
    }

    if (x < 53) {
      return this.random() % 2;
    }

    return this.random() % 4;
  }

  private toggleLight(light: Sprite): void {
    const next = (light.cel + 1) % 2;

    light.setCel(next);
    light.setTimer(0, (this.random() % 200) + 400, (sprite) => {
      this.toggleLight(sprite);
    });
  }

  private smokeCycleDone(arms: Sprite): void {
    arms.playSequence(0, (sprite) => {
      this.smokeCycleDone(sprite);
    });

    const head = this.find("Elf00");

    head.startTalking(2000);
    head.setTimer(0, 200, () => {
      this.puffSmoke(head);
    });
  }

  private puffSmoke(head: Sprite): void {
    head.setCel(1);
    head.setTimer(0, 300, () => {
      head.stopTalking();
      head.setTimer(0, 200, () => {
        head.setCel(0);
      });
    });
  }

  private startStory(): void {
    const story = this.stage.assets.data.story;

    this.startScroll(STORY_FONT, story, STORY_MS_PER_PIXEL);
  }

  private startRules(): void {
    const rules = this.stage.assets.data.rules;

    this.startScroll(RULES_FONT, rules, RULES_MS_PER_PIXEL);
  }

  private startScroll(font: number, lines: string[], msPerPixel: number): void {
    const text = this.find("ScrollText");
    const scroll = this.find("Scroll");

    this.scrollText.font = font;
    text.show();
    text.resetToHome();
    this.scrollText.setText(" ");

    const lineHeight = this.scrollText.lineHeight;
    const scrollRect = scroll.screenRect();
    const textRect = text.screenRect();
    const textHalfHeight = Math.trunc((textRect.b - textRect.t) / 2);
    const scrollHalfHeight = Math.trunc((scrollRect.b - scrollRect.t) / 2);
    const startY = text.homeY + textHalfHeight + scrollHalfHeight;

    text.moveTo(text.homeX, startY);

    const clip = makeRect(scrollRect.l, scrollRect.t + 10, scrollRect.r, scrollRect.b - 18);
    const total = lineHeight * lines.length + (clip.b - clip.t);
    const joined = lines.map((line) => line.replace("*", '"')).join("\r");

    text.setClipRect(clip);
    this.scrollText.setText(joined);
    text.startPhysics(0, -1, msPerPixel);
    text.setBounds(
      makeRect(text.homeX - 1, startY - total - lineHeight, text.homeX + 2, startY + 1000),
    );
    text.onOutOfBounds = (sprite) => {
      sprite.setTimer(0, SCROLL_RESTART_DELAY, () => {
        this.startStory();
      });
    };
  }

  private handleKey(event: KeyboardEvent): void {
    if (event.key === "Enter") {
      this.enterPlay();
    }
  }

  private enterPlay(): void {
    const logo = this.find("NStormx");

    logo.clearTimers();
    this.playSound(logo, "Click.wav", 3);

    for (const sprite of this.sprites) {
      sprite.hide();
    }

    logo.setTimer(0, PLAY_DELAY, () => {
      this.stage.gotoScene("Game");
    });
  }
}
