# Elf Bowling

A browser port of NStorm's 1998 Christmas game _Elf Bowling_, written in TypeScript on a `<canvas>` and built with Vite. It uses the original bitmaps and sounds.

Play it at https://busheezy.github.io/elf-bowling/

## Running locally

```bash
pnpm install
pnpm dev
```

`pnpm build` type-checks and writes a static build to `dist/`. Pushing to `main` deploys it to GitHub Pages.

## Controls

| Key                   | Action                       |
| --------------------- | ---------------------------- |
| Click / Space / Enter | Bowl                         |
| Esc                   | Ask to quit the current game |
| M                     | Mute or unmute (remembered)  |
| F                     | Toggle fullscreen            |

## Changes from the original port

The first commit is a direct port of the original game. Everything since then, and why:

**Removed web integrations**

The original game linked out to sites that no longer exist, so those links were removed rather than left pointing at dead or re-registered domains.

- Removed the online high score submission ("click here" button) that posted to `nstorm.com`, since the server is gone.
- Removed the "Hosting and bandwidth provided by The Planet" button. The Planet no longer exists, and the credit doesn't apply to a GitHub Pages build.
- The blinking nstorm.com button on the exit screen is kept as part of the original look, but it no longer links anywhere.
- Removed the Quit button and the "Thanks for playing" screen, since a browser tab doesn't need them.

**Gameplay and UX**

- Pressing Esc during a game opens a "Quit this game?" confirmation scroll with Play and Exit buttons (Enter confirms, Esc cancels). This replaces the removed Quit button. The game clock and audio pause while it's open.
- Your best score is saved in `localStorage` and shown on the exit screen, since there's no online high score list any more.
- M toggles mute, and the setting is saved.
- F toggles fullscreen.
- No "Click to play" screen: the game starts once loading finishes, and audio starts on the first click or key press, which browsers require before playing sound.
- Audio suspends while the tab is hidden, and frame time is capped so the game doesn't jump ahead after the tab was in the background.
- All pending logic ticks run each frame instead of at most three, so the game keeps its original speed on devices that can't hit a high frame rate.
- Uses pointer events, so touch works. Only the primary button counts, and the right-click menu is disabled.
- The cursor turns into a pointer over clickable sprites.
- Only game keys are captured, so browser shortcuts keep working. Held keys don't auto-repeat.

**Visuals**

- The game is no longer rendered at 640×480 and then upscaled. It draws at the display's native resolution (taking `devicePixelRatio` into account) and scales smoothly, so it isn't blurry on modern screens.
- Text is rendered at high resolution, scaled to the screen size, so it stays sharp in fullscreen.
- Sprite movement is smoothly interpolated between animation steps rather than snapping, and sprite edges are snapped to device pixels.
- Sprites are drawn from cached `ImageBitmap`s prescaled to the render size, straight into the on-screen canvas, which keeps rendering fast on mobile.
- A new transparency mode flood-fills the background color from the edges of a bitmap, used for cutouts such as the confirmation scroll.
- Adds the Dancing Script and Cormorant Garamond fonts for the new UI text.
- The layout uses `dvh` units so it fits mobile browsers with collapsing toolbars.
- The Play and Rules buttons are centered under the intro scroll, and the NStorm logo is centered on the exit screen, since both were noticeably off-center.

**Internals**

- Split the pinsetter logic out of `game.ts` into `game-pinsetter.ts`.
- Asset loading reports a clear error when a file fails to fetch.
- Added the GitHub Pages deploy workflow.
- Switched from npm to pnpm.
