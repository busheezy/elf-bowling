import { Scene } from "../scene";

export class AboutScene extends Scene {
  protected init(alreadyInitialized: boolean): void {
    if (alreadyInitialized) {
      return;
    }

    this.onKeyDown = (event) => {
      const isExitKey = event.key === "Escape" || event.key === "Enter";

      if (isExitKey) {
        this.stage.returnToCaller(this);
      }
    };

    this.addSprite("NVDMess2", "NVDMess2.bmp");
    this.addSprite("NVDMessHdr", "Top3Aggressive.bmp");
    this.addSprite("NVDAddress", "NVDAddress.bmp");
    this.addSprite("NVDLogo", "Top2Logo.bmp");

    const returnButton = this.addButton("ReturnButton", "OtherOK1.bmp", "OtherOK2.bmp");

    returnButton.onClick = () => {
      this.stage.returnToCaller(this);
    };
  }

  protected start(): void {}
}
