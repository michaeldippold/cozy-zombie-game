# Cozy Zombie Game (working title)

A single-player survival game in the Habbo Hotel / early-2000s isometric pixel style. Small hand-authored dioramas connected by doors and stairs. Zombies are simulated everywhere but drawn only where you are. The art stays cute. The systems stay serious.

Plain HTML, CSS, and JavaScript. Canvas 2D for the game view, DOM for the UI. No engine, no build step.

## Running

ES modules will not load from `file://` in Chrome, so serve the folder:

```bash
python serve.py 8000
```

Then open http://localhost:8000. The script is a plain static server with caching disabled so edited modules reload; any other static server works too.

## Controls

| Key | Action |
|---|---|
| WASD / arrows | Move (diagonal keys walk along the room's axes) |
| Mouse | Aim; left click attacks with the equipped weapon |
| Shift | Sprint while moving (drains stamina) |
| 1 / 2 / wheel | Switch between bat and pistol |
| F | Flashlight on/off (when carrying one). A beam that follows the mouse; it lights zombies up and gives you away |
| Right click | Context menu with every action on the target: pick up, search, board, go through a door, walk here. Out of range actions auto-walk first |
| E | Shortcut for the nearest pick up or search |
| Tab | Inventory panel |

Doors are doorways: walk into the opening and onto the threshold tile to go through. Standing near a door never crosses it.

Debug: `]` skips the clock forward one hour. `?sheet=<sprite id>&scale=2` on the URL renders a sprite sheet instead of the game. `window.__game` exposes the live state in the console; `window.__game.loop.setPaused(true)` then `window.__game.loop.advance(seconds)` steps time deterministically.

## Documents

Read them in order the first time. After that, `docs/00-vision.md` is the tiebreaker for any ruling, and `docs/09-decisions.md` is the log of rulings already made.

| Doc | What it holds |
|---|---|
| [00-vision.md](docs/00-vision.md) | Why the game exists, the tone, what the demo must prove. The north star. |
| [01-constraints.md](docs/01-constraints.md) | Hard technical constraints and the fixed numbers: tile size, canvas resolution, timestep. |
| [02-world-model.md](docs/02-world-model.md) | Nodes, edges, door and window rules, off-screen simulation, materialization. |
| [03-rendering.md](docs/03-rendering.md) | Isometric math, draw order, per-tile furniture, sprites, occlusion. |
| [04-gameplay.md](docs/04-gameplay.md) | Player, controls, combat, noise, zombie behavior, interaction, inventory. |
| [05-architecture.md](docs/05-architecture.md) | Module layout, game loop, and who owns what. |
| [06-data-formats.md](docs/06-data-formats.md) | JSON shapes for nodes, edges, sprites, items, loot, and sim records. |
| [07-demo-scope.md](docs/07-demo-scope.md) | Exactly what the demo contains and what it deliberately leaves out. |
| [08-milestones.md](docs/08-milestones.md) | Build order with acceptance criteria per step. |
| [09-decisions.md](docs/09-decisions.md) | Decision log with rationale, plus open questions. |

The original brainstorm this was derived from is `iso-zombie-demo-spec.md` at the repo root. It is superseded by `docs/` and kept for reference only.
