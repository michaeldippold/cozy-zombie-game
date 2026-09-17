# 05 — Architecture

Keep modules small and dumb. Each file has one job. Data flows down from `world` into nodes and entities, events flow up through a tiny event bus.

## File layout

```
/index.html
/style.css
/README.md
/docs/                  design documents (this folder)
/src
  main.js               boot: load data, build world, start loop
  loop.js               fixed-timestep update, rAF render, sim tick scheduling
  events.js             minimal pub/sub for noise, edge changes, player moves
  input.js              keyboard and mouse state, aim vector, facing
  iso.js                toScreen, toGrid, direction tables, sort key
  assets.js             image loading, sprite sheet JSON, placeholder generation
  sprites.js            Sprite and Animation classes
  world.js              graph: nodes, edges, current node, transitions
  node.js               one node: grid, walkability, props, entities, loader
  pathfind.js           grid A*
  sim.js                off-screen records, edge assignment, materialize and dematerialize
  combat.js             melee arc, hitscan, damage, knockback, noise emission
  items.js              item definitions and loot tables
  inventory.js          player inventory model
  render.js             draw passes, sort, occlusion, edge sprites
  entities/
    player.js
    zombie.js
    prop.js             furniture, containers, trees, dropped items
  ui/
    hud.js
    prompt.js
    inventory-panel.js
    overlay.js          game over and restart
/data
  nodes/house.json
  nodes/yard.json
  edges.json
  items.json
  loot.json
  sprites/*.json
/assets
  sprites/*.png         real art, when it exists; absent for placeholder mode
  tiles/*.png
```

## Modules added since this layout was written

The tree above is the original plan. Built since:

| Module | Job |
|---|---|
| `src/interact.js` | Every world action: what is under the cursor, the E shortcut, timed actions, auto-walk approach tiles |
| `src/ui/context-menu.js` | The right-click menu |
| `src/clock.js` | Day/night clock: hour, phase, brightness, night factor |
| `src/moodles.js`, `src/ui/moodles.js` | Moodle registry (pure logic) and its HUD row |
| `src/save.js` | One versioned `localStorage` slot: write, read, clear. Knows nothing about the game |
| `src/light.js` | The single light function, the cached static light map, the flashlight beam, room daylight |
| `src/sfx.js` | Synthesized placeholder sounds |
| `src/placeholders.js`, `src/render-util.js` | Generated placeholder sheets and drawing helpers |
| `data/world.json` | Node list, edges file, start node |
| `serve.py` | No-cache dev server, plus a dev-only screenshot endpoint |

Ownership additions: **time** is owned by `clock.js` and read directly by anything that needs it; **light** is owned by `light.js` and nothing else computes it; **room light state** (`lightsOn`) lives on the node, like edge state lives on the edge. **Saving**: each module serializes and restores its own state (`world`, `sim`, `clock`); `main.js` only assembles the snapshot and decides when to save. See `15-save-load.md`.

## Game loop

`loop.js` owns time.

- Fixed logic step at 60 Hz with an accumulator. Clamp the accumulator so a background tab does not spiral.
- `update(dt)` runs input, player, current-node entities, combat, and UI state.
- Every 1000 ms of accumulated game time, run `sim.tick()`. This is inside the same loop, not a separate timer, so pausing pauses everything.
- `render()` runs on `requestAnimationFrame` and reads state only. No game logic in render.

## Ownership

| Concern | Owner | Notes |
|---|---|---|
| Which node is current | `world.js` | Transitions call `sim.dematerializeAll(oldNode)` then `sim.materializeArrivals(newNode)` |
| Edge state | The edge object in `world.edges` | Both nodes hold references, never copies |
| Zombie truth | `sim.js` | Owns every zombie record. Materialized zombies are entities whose record is flagged live |
| Walkability and shot blocking | `node.js` | Rebuilt when a prop moves or an edge changes state |
| Noise | `combat.js` emits, `zombie.js` and `sim.js` subscribe via `events.js` | |
| Sort and occlusion | `render.js` | Entities and props expose `getDrawable()` |
| Player state | `player.js` and `inventory.js` | Health lives on the player |
| All UI | `ui/*` | Reads state each frame, writes only through explicit actions |

## Data loading

`main.js` fetches every JSON in `/data` at boot, then builds `world` from it. Nodes are hand-written JSON for the demo. The loader in `node.js` exposes `loadNode(json)` and nothing else depends on the file shape, so a Tiled importer can be added later as a second function that produces the same internal structure.

## Placeholder mode

When an asset PNG is missing, `assets.js` generates a placeholder sheet for that sprite id and returns it under the same interface. The rest of the code never knows. This lets every milestone run with zero art.

## Conventions

- ES modules, named exports, no default exports.
- No classes for data, plain objects. Classes only where behavior lives: `Sprite`, `Animation`, `Player`, `Zombie`.
- Tunables are top-level constants in the module that uses them, collected in `09-decisions.md` so they can be found.
- No globals except a `window.__game` debug handle in development.
