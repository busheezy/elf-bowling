import { Scene } from "../scene";
import type { Sprite } from "../sprite";

const INTRO_DELAY = 2500;
const CLICK_DELAY = 150;

export class PreIntroScene extends Scene {
  protected init(alreadyInitialized: boolean): void {
    if (alreadyInitialized) {
      return;
    }

    this.onKeyDown = (event) => {
      this.handleKey(event);
    };

    this.addSprite("xNVDMessHdr", "Top3Aggressive.bmp");

    const logo = this.addSprite("xNVDLogo", "Top2Logo.bmp");

    logo.clickable = true;
    logo.onClick = (sprite) => {
      this.logoClicked(sprite);
    };
  }

  protected start(): void {
    const logo = this.find("xNVDLogo");

    logo.setTimer(0, INTRO_DELAY, () => {
      this.goIntro();
    });
  }

  private goIntro(): void {
    this.stage.gotoScene("Intro");
  }

  private logoClicked(logo: Sprite): void {
    logo.clearTimers();
    this.playSound(logo, "Click.wav", 3);
    logo.setTimer(0, CLICK_DELAY, () => {
      this.goIntro();
    });
  }

  private handleKey(event: KeyboardEvent): void {
    if (event.key === "Escape") {
      this.stage.quit();
      return;
    }

    if (event.key === "Enter") {
      const logo = this.find("xNVDLogo");

      this.logoClicked(logo);
    }
  }
}
