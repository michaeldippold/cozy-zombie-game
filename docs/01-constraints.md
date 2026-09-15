# 01 — Constraints and fixed numbers

## Hard constraints

- **Web trinity only.** Plain HTML, CSS, JavaScript. ES modules via `<script type="module">`. No engine, no bundler, no build step, no TypeScript, no framework.
- **Canvas 2D** for the game view. No WebGL, no Pixi, no Phaser.
- **DOM for UI.** HUD, prompts, inventory, menus, and overlays are HTML positioned over the canvas. Nothing UI-like is drawn into the canvas.
- **Static folder.** The whole game is servable by any static file server. No server-side logic.
- **Small libraries are allowed** if they are a single include and do not dictate architecture. None are currently planned.

## Fixed numbers

These are decided. Change them only by updating this file and `09-decisions.md`.

| Thing | Value | Why |
|---|---|---|
| Tile size | 64×32 px | Habbo standard, reads well at 1x, common in asset packs |
| Internal canvas | 960×540 px | Fits a 12×12 node with wall height; 16:9 |
| Display scale | Largest integer that fits the window, minimum 1 | Crisp pixels, no fractional scaling |
| Max node footprint | 12×12 tiles | Whole node visible at once, no scrolling |
| Logic timestep | 60 Hz fixed, accumulator pattern | Deterministic movement and combat |
| Render | `requestAnimationFrame`, uncapped | Standard |
| Off-screen sim tick | Every 1000 ms of game time | Cheap, coarse, sufficient |
| Player facings | 8 (5 drawn, 3 mirrored) | Twin-stick aim needs 8 |
| Zombie facings | 4 | Slow shamblers, nobody will notice |

## Rendering rules

- `ctx.imageSmoothingEnabled = false` on every context, including offscreen ones.
- The canvas element uses `image-rendering: pixelated`.
- Sprites are drawn 1:1 with `drawImage(sheet, sx, sy, sw, sh, dx, dy, sw, sh)`. Never scale in the draw call. Scaling happens once at the canvas element level.
- All draw coordinates are rounded to integers before drawing.

## Running locally

Chrome refuses ES modules from `file://`. Serve the folder with any static server, for example `python -m http.server 8000`. This is documented in the README and is an accepted limitation.
