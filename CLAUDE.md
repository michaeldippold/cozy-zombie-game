# Cozy Zombie Game

A Habbo-style isometric cozy diorama game that gets invaded by zombies. Plain HTML, CSS, and JavaScript with ES modules. Canvas 2D for the world, DOM for UI. No build step, no engine, no framework.

## Start here every session

1. Read `TODO.md`. The **Status** block says where work stopped. Continue from there.
2. Read the doc linked from the current milestone before writing code.
3. When a design question comes up, the tiebreaker is `docs/00-vision.md`. Log any new ruling in `docs/09-decisions.md`.
4. Before ending a session, update the Status block in `TODO.md` and tick completed boxes.

## Docs

`docs/00` vision · `01` constraints and fixed numbers · `02` world model (nodes, edges, sim) · `03` rendering · `04` gameplay · `05` architecture and module ownership · `06` JSON data formats · `07` demo scope · `08` milestones with acceptance criteria · `09` decisions and tunables · `10` neighbourhood · `11` hunger and day/night · `12` flashlight and light map · `13` indoor light and coherent windows · **`14` lighting reference (as built; wins over 11 to 13 where they disagree)** · `15` save and load · `16` Zomboid systems and whether they fit (a menu, not a plan) · `17` moodles · `18` death, turning, and the next survivor · `19` bodies as containers · `20` thirst, water, and body despawn · `21` grid inventory.

## Rules that are easy to forget

- Tiles are 64×32. Internal canvas is 960×540, integer-scaled. Nodes are at most 12×12.
- Multi-tile furniture is per-tile drawables, never one wide sprite.
- An edge is one object shared by both nodes. Never copy edge state.
- Windows: zombies in, never out, ground floor only, glass breaks first. Player never uses windows.
- Aim and melee arcs are in screen space. Hitscan converts to grid once.
- Placeholder art is generated at boot through the same interface as real sprite sheets. Do not wait for art.
- Never draw UI into the canvas. Never scale in `drawImage`.
- Light is one function: `light.lightAt(node, gx, gy, player)`. Nothing else computes light. The flashlight is never baked into the light map.
- Door pairs sit on opposite screen sides (momentum). Every opening sits on the same edge inside as the wall it occupies outside (coherence). Interiors have low stub walls on the near edges; outdoor nodes do not.
- Fast states (health, stamina) are bars. Slow needs (hunger, later thirst and tired) are moodles with the number hidden: one entry in `src/moodles.js`. Keep the set minimal.
- Inventory is a grid and there is no weight. The player's bag, every container, and every body is a bag `{ cols, rows, items }`; all placement goes through `src/grid.js`. Entries carry position and per-instance state (`fill`): move the entry object, never rebuild it from `{ id, count }`. New items need `size` and `color`.
- Any new persistent state needs a line in its module's `serialize()` and `restore()`, and a `SAVE_VERSION` bump in `src/save.js` if the shape changes.
- A window glows only if the room behind it has its lights on. Candles never light windows.

## Running

```
python serve.py 8000
```

Then open http://localhost:8000. ES modules will not load from `file://`. `serve.py` disables caching; plain `http.server` serves stale modules after edits.

## Testing from a browser console

`window.__game` exposes the live state. The game boots to a start screen with the loop paused: call `window.__game.newGame()` (or `continueGame()`) first. Then call `window.__game.loop.setPaused(true)` first, then `window.__game.loop.advance(seconds)` to step time deterministically; otherwise the game runs in real time between commands. `?sheet=<sprite id>&scale=2` on the URL renders a sprite sheet instead of the game.
