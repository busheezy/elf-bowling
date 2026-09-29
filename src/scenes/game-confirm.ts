import type { Button } from "../button";
import { ButtonCast, ScaledCast, type ButtonColors, type TextCast } from "../cast";
import type { Sprite } from "../sprite";
import type { GameScene } from "./game";

const CENTER_X = 320;
const CENTER_Y = 240;
const SCROLL_WIDTH = 240;
const SCROLL_HEIGHT = 128;
const BUTTON_WIDTH = 72;
const BUTTON_HEIGHT = 28;
const BUTTON_Y = 268;
const PLAY_X = 280;
const QUIT_X = 360;
const IDLE_COLORS: ButtonColors = { fill: "#efe6c4", border: "#5c4a26", text: "#2b1d0e" };
const HOVER_COLORS: ButtonColors = { fill: "#b3202a", border: "#5e0f14", text: "#f7efd2" };
const MESSAGE_FONT = 4;
const CUTOUT_MODE = 3;
const MESSAGE = "Quit this game?";

export class QuitConfirm {
  private readonly game: GameScene;
  private readonly scroll: Sprite;
  private readonly message: Sprite;
  private readonly messageText: TextCast;
  private readonly play: Button;
  private readonly quit: Button;
  private open = false;

  constructor(game: GameScene) {
    this.game = game;

    const scrollSource = game.stage.assets.cast("~Scroll.bmp");
    const scrollCast = new ScaledCast(scrollSource, SCROLL_WIDTH, SCROLL_HEIGHT);

    this.scroll = game.addSpriteCast("ConfirmScroll", scrollCast);
    this.scroll.setHome(CENTER_X, CENTER_Y);
    this.scroll.setAllCelsMode(CUTOUT_MODE);

    const created = game.addTextSprite("ConfirmText", this.scroll, 2, 30, 30, 34, 62);

    this.message = created.sprite;
    this.messageText = created.text;
    this.messageText.color = 0;
    this.messageText.font = MESSAGE_FONT;
    this.messageText.setText(MESSAGE);

    this.play = this.addChoice("ConfirmPlay", "Play", PLAY_X);
    this.play.onClick = () => {
      this.close();
    };

    this.quit = this.addChoice("ConfirmQuit", "Exit", QUIT_X);
    this.quit.onClick = () => {
      this.confirmQuit();
    };
  }

  private addChoice(name: string, label: string, x: number): Button {
    const idle = new ButtonCast(label, BUTTON_WIDTH, BUTTON_HEIGHT, MESSAGE_FONT, IDLE_COLORS);
    const hover = new ButtonCast(label, BUTTON_WIDTH, BUTTON_HEIGHT, MESSAGE_FONT, HOVER_COLORS);
    const button = this.game.addButtonCasts(name, idle, hover);

    button.setHome(x, BUTTON_Y);
    button.setHoverSound(null, 0);

    return button;
  }

  private get sprites(): Sprite[] {
    return [this.scroll, this.message, this.play, this.quit];
  }

  hide(): void {
    for (const sprite of this.sprites) {
      sprite.hide();
    }
  }

  show(): void {
    if (this.open) {
      return;
    }

    this.open = true;

    for (const sprite of this.sprites) {
      sprite.reset();
      sprite.show();
    }

    const buttons = [this.play, this.quit];

    this.game.stage.openModal({
      sprites: buttons,
      onKeyDown: (event) => {
        this.handleKey(event);
      },
    });
  }

  private handleKey(event: KeyboardEvent): void {
    if (event.key === "Escape") {
      this.close();
      return;
    }

    if (event.key === "Enter") {
      this.confirmQuit();
    }
  }

  private close(): void {
    this.open = false;
    this.hide();
    this.game.stage.closeModal();
  }

  private confirmQuit(): void {
    this.close();
    this.game.stage.gotoScene("Exit");
  }
}
