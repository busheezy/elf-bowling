import { Assets } from "./assets";
import { AboutScene } from "./scenes/about";
import { ExitScene } from "./scenes/exit";
import { GameScene } from "./scenes/game";
import { IntroScene } from "./scenes/intro";
import { PreIntroScene } from "./scenes/preintro";
import { Stage } from "./stage";

const canvas = document.getElementById("stage") as HTMLCanvasElement;
const overlay = document.getElementById("overlay") as HTMLDivElement;
const message = document.getElementById("message") as HTMLParagraphElement;

function showMessage(text: string): void {
  message.textContent = text;
  overlay.hidden = false;
}

function onQuit(): void {
  showMessage("Thanks for playing. Click to start again.");
  overlay.onclick = () => {
    window.location.reload();
  };
}

async function boot(): Promise<void> {
  const audio = new AudioContext();

  showMessage("Loading…");

  const assets = await Assets.load(audio, (fraction) => {
    const percent = Math.round(fraction * 100);

    showMessage(`Loading… ${percent}%`);
  });

  showMessage("Click to play");

  overlay.onclick = async () => {
    overlay.hidden = true;
    overlay.onclick = null;
    await audio.resume();

    const stage = new Stage(canvas, assets, audio, onQuit);
    const scenes = [
      new PreIntroScene(stage, "PreIntro", 100),
      new IntroScene(stage, "Intro", 100),
      new GameScene(stage, "Game", 100),
      new AboutScene(stage, "About", 30),
      new ExitScene(stage, "Exit", 100),
    ];

    for (const scene of scenes) {
      stage.register(scene);
    }

    stage.gotoScene("PreIntro");
    stage.run();
  };
}

boot().catch((error: unknown) => {
  const text = error instanceof Error ? error.message : String(error);

  showMessage(`Failed to start: ${text}`);
});
