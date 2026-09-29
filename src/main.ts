import "@fontsource/dancing-script/latin-600.css";
import "@fontsource/cormorant-garamond/latin-600-italic.css";
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

async function loadFonts(): Promise<void> {
  const handwriting = document.fonts.load("600 16px 'Dancing Script'");
  const calligraphy = document.fonts.load("italic 600 16px 'Cormorant Garamond'");

  await Promise.all([handwriting, calligraphy]);
}

async function boot(): Promise<void> {
  const audio = new AudioContext();

  showMessage("Loading…");

  const assets = await Assets.load(audio, (fraction) => {
    const percent = Math.round(fraction * 100);

    showMessage(`Loading… ${percent}%`);
  });

  await loadFonts();

  overlay.hidden = true;

  const stage = new Stage(canvas, assets, audio);
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
}

window.addEventListener("contextmenu", (event) => {
  event.preventDefault();
});

boot().catch((error: unknown) => {
  const text = error instanceof Error ? error.message : String(error);

  showMessage(`Failed to start: ${text}`);
});
