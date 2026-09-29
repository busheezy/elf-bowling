import type { TextCast } from "../cast";
import { Scene, type Group } from "../scene";
import { makeRect, type Sprite } from "../sprite";
import { session } from "../state";

const MOUNTAIN_BASES = 20;
const HOVER_GRACE_MS = 3000;
const BABY_TALK_MS = 8000;
const CREDIT_PAGE_MS = 9000;
const CREDITS_SCROLL_MS = 80;
const HEAD_HALF_WIDTH = 16;
const HEAD_HALF_HEIGHT = 21;
const DANCERS = ["Elfx01", "Elfx00", "Elfx02"];
const MOUSE_ELF_TARGETS: [string, string][] = [
  ["MouseElf1", "Elfx02"],
  ["MouseElf2", "Elfx00"],
  ["MouseElf3", "Elfx01"],
];
const NORMAL_SPRITES = [
  "BLogo2",
  "ExitPlay",
  "ExitRules",
  "xMas",
  "MouseElf1",
  "MouseElf2",
  "MouseElf3",
  "Elfx00",
  "Elfx00 Body",
  "Elfx00 Arms",
  "Elfx01",
  "Elfx01 Body",
  "Elfx01 Arms",
  "Elfx02",
  "Elfx02 Body",
  "Elfx02 Arms",
  "DaScore",
  "ScorePadTextr2",
];

function formatCreditLine(line: string): { text: string; bold: boolean } {
  const bold = line.startsWith("#");
  const stripped = bold ? line.slice(1) : line;
  const text = stripped.replace("@", "&").replaceAll("*", '"');

  return { text, bold };
}

export class ExitScene extends Scene {
  private eggMode = false;
  private normalStartTime = 0;
  private lights!: Group;
  private eggText!: TextCast;
  private scorePad!: TextCast;

  protected init(alreadyInitialized: boolean): void {
    if (alreadyInitialized) {
      return;
    }

    this.onKeyDown = (event) => {
      this.handleKey(event);
    };

    this.createBackdrop();
    this.createMouseElves();
    this.createButtons();
    this.createDancers();
    this.createScore();
    this.createCrew();
    this.createLights();
  }

  private createBackdrop(): void {
    for (let index = 0; index < MOUNTAIN_BASES; index++) {
      const suffix = String(index).padStart(2, "0");

      this.addSprite(`Base${suffix}`, "MountainBase.bmp");
    }

    this.addSprite("MountainsR", "Mountains.bmp");
    this.addSprite("MountainsC", "Mountains.bmp");
    this.addSprite("MountainsL", "MountainsRx.bmp");
  }

  private createMouseElves(): void {
    for (const [name, target] of MOUSE_ELF_TARGETS) {
      const cover = this.addButton(name, "ElfCover.bmp", "ElfCover.bmp");

      cover.setHoverSound(null, 0);
      cover.onHoverEnter = () => {
        this.hoverElf(target);
      };
      cover.onClick = (sprite) => {
        this.elfHeadClicked(sprite);
      };
    }
  }

  private guarded(action: () => void): () => void {
    return () => {
      if (this.eggMode) {
        this.normalMode();
        return;
      }

      action();
    };
  }

  private createButtons(): void {
    this.addSprite("NStorm", "NStormLogo.bmp");
    this.addSprite("BLogo2", "BowlingLogo.bmp");

    const play = this.addButton("ExitPlay", "PlayOn.bmp", "PlayOff.bmp");

    play.onClick = this.guarded(() => {
      this.stage.gotoScene("Game");
    });

    const who = this.addButton("ExitRules", "Who1.bmp", "Who2.bmp");

    who.onClick = this.guarded(() => {
      this.stage.pushScene("About");
    });

    this.addSprite("xMas", "MerryChristmas.bmp");
  }

  private createDancers(): void {
    for (const name of DANCERS) {
      const body = this.addSprite(`${name} Body`, "Elf Body0.bmp");

      this.addCel(body, "ElfBodySideStep.bmp");
      this.addCel(body, "Elf Body0.bmp");
      this.addCel(body, "ElfBodySideStepRx.bmp");

      const head = this.addSprite(name, "Elf0.bmp");

      this.setTalkOverlay(head, "Elf0 Talk.bmp", 0);

      const arms = this.addSprite(`${name} Arms`, "ArmsDance1.bmp");

      this.addCel(arms, "ArmsDance1Rx.bmp");
    }
  }

  private createScore(): void {
    const scoreLabel = this.addSprite("DaScore", "Score.bmp");
    const pad = this.addTextSprite("ScorePadTextr2", scoreLabel, 2, 3, 3, 20, -175);

    pad.text.color = 0xffff;
    pad.text.font = 1;
    this.scorePad = pad.text;
  }

  private createCrew(): void {
    const crew = this.addSprite("ElfCrew", "ElfCrew75.bmp");
    const egg = this.addTextSprite("EggText", crew, 2, -84, -88, 220, -600);

    egg.sprite.noParm = true;
    egg.text.color = 0;
    this.eggText = egg.text;
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

  protected start(): void {
    const digits = String(Math.min(session.finalScore, 999)).padStart(3, "0");
    const pad = this.find("ScorePadTextr2");

    this.scorePad.setText(digits);
    this.applyParmOffset("ElfCrew", "EggText");
    pad.resetToHome();
    pad.setClipRect(pad.screenRect());
    this.normalMode();
  }

  private normalMode(): void {
    this.onMouseUp = null;
    this.eggMode = false;
    this.resetAllSprites();
    this.find("ElfCrew").hide();
    this.find("EggText").hide();

    for (const name of NORMAL_SPRITES) {
      this.find(name).show();
    }

    this.startDancing();
    this.startLights();
    this.normalStartTime = this.now;
  }

  private startDancing(): void {
    this.find("Elfx00").setTimer(0, 1400, () => {
      this.babyTalk();
    });

    for (const name of DANCERS) {
      this.find(`${name} Body`).startCelCycle(300, 0, 4);
      this.find(`${name} Arms`).startCelCycle(300, 0, 2);
    }
  }

  private startLights(): void {
    for (const light of this.lights.sprites) {
      light.setTimer(0, this.random() % 600, (sprite) => {
        this.toggleLight(sprite);
      });
    }
  }

  private toggleLight(light: Sprite): void {
    light.setCel(light.cel ^ 1);
    light.setTimer(0, (this.random() % 200) + 400, (sprite) => {
      this.toggleLight(sprite);
    });
  }

  private eggModeOn(): void {
    this.onMouseUp = () => {
      this.eggClick();
    };
    this.eggMode = true;
    this.resetAllSprites();

    for (const name of NORMAL_SPRITES) {
      this.find(name).hide();
    }

    this.find("ElfCrew").show();
    this.find("EggText").show();
    this.startCredits();
    this.startLights();
  }

  private babyTalk(): void {
    const baby = this.find("Elfx00");

    baby.setTimer(0, BABY_TALK_MS, () => {
      this.babyTalk();
    });
    this.playSoundTalking(baby, "ElfBaby.wav", 4, 100);

    for (const name of ["Elfx01", "Elfx02"]) {
      const elf = this.find(name);

      elf.startTalking(0);
      elf.setTimer(0, 1000, (sprite) => {
        sprite.stopTalking();
      });
    }
  }

  private hoverElf(target: string): void {
    const tooEarly = this.now < this.normalStartTime + HOVER_GRACE_MS;

    if (this.eggMode || tooEarly) {
      return;
    }

    this.find("Elfx00").setTimer(0, BABY_TALK_MS, () => {
      this.babyTalk();
    });

    const elf = this.find(target);

    this.playSoundTalking(elf, "ClickMe.wav", 3, 100);
  }

  private elfHeadClicked(button: Sprite): void {
    if (this.eggMode) {
      this.normalMode();
      return;
    }

    this.playSound(button, "Click.wav", 5);
    button.setTimer(0, 200, () => {
      this.eggModeOn();
    });
  }

  private writeCredits(lines: string[]): void {
    this.eggText.clear();

    lines.forEach((line, index) => {
      const formatted = formatCreditLine(line);

      this.eggText.font = formatted.bold ? 0 : 3;

      if (index === 0) {
        this.eggText.setText(formatted.text);
        return;
      }

      this.eggText.appendText(formatted.text);
    });
  }

  private creditsClip(): ReturnType<typeof makeRect> {
    const crewRect = this.find("ElfCrew").screenRect();
    const crewHeight = crewRect.b - crewRect.t;
    const top = crewRect.b + 10;

    return makeRect(0, top, 640, top + crewHeight - 54);
  }

  private startCredits(): void {
    const text = this.find("EggText");
    const crew = this.find("ElfCrew");
    const intro = this.stage.assets.data.credits.intro;

    this.eggText.font = 3;
    text.show();
    text.resetToHome();
    this.eggText.setText(" ");

    const lineHeight = this.eggText.lineHeight;
    const crewRect = crew.screenRect();
    const startY = text.homeY + (crewRect.b - crewRect.t) - 100;

    text.moveTo(text.homeX, startY);

    const clip = this.creditsClip();
    const total = lineHeight * intro.length + (clip.b - clip.t);

    text.setClipRect(clip);
    this.writeCredits(intro);
    text.startPhysics(0, -1, CREDITS_SCROLL_MS);
    text.setBounds(
      makeRect(text.homeX - 1, startY - total - lineHeight - 20, text.homeX + 2, startY + 1000),
    );
    text.onOutOfBounds = () => {
      this.showPage(0);
    };
  }

  private showPage(page: number): void {
    const text = this.find("EggText");
    const pages = this.stage.assets.data.credits.crewCredits;
    const lines = pages[page];

    text.stopPhysics();
    this.eggText.font = 3;
    text.show();
    text.resetToHome();
    text.moveTo(text.homeX, text.homeY - 60);
    text.setClipRect(this.creditsClip());
    this.writeCredits(lines);
    this.playSound(text, "light.wav", 5);
    text.setTimer(0, CREDIT_PAGE_MS, () => {
      this.nextPage(page);
    });
  }

  private nextPage(page: number): void {
    const isLast = page >= 4;

    if (isLast) {
      this.startCredits();
      return;
    }

    this.showPage(page + 1);
  }

  private eggClick(): void {
    const crew = this.find("ElfCrew");
    const crewRect = crew.screenRect();
    const localX = this.stage.upX - crewRect.l;
    const localY = this.stage.upY - crewRect.t;
    const { headX, headY } = this.stage.assets.data.credits;
    const hitIndex = headX.findIndex((x, index) => {
      const nearX = Math.abs(localX - x) < HEAD_HALF_WIDTH;
      const nearY = Math.abs(localY - headY[index]) < HEAD_HALF_HEIGHT;

      return nearX && nearY;
    });

    if (hitIndex >= 0) {
      this.showPage(hitIndex >> 1);
      return;
    }

    this.playSound(crew, "Click.wav", 5);
    crew.setTimer(0, 200, () => {
      this.normalMode();
    });
  }

  private handleKey(event: KeyboardEvent): void {
    const isEscape = event.key === "Escape";

    if (isEscape && this.eggMode) {
      this.normalMode();
    }
  }
}
