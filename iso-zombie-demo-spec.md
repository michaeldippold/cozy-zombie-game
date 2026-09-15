# Isometric Zombie Demo — Design Principles & Claude Code Handoff

Working title: TBD. Date: 2026-09-14.

## 1. What this is

A single-player survival game rendered in the Habbo Hotel / early-2000s isometric pixel style. The world is a graph of small hand-authored dioramas ("rooms" or "nodes") connected by doors, windows, and stairs. Zombies are persistently simulated across every node but only rendered in the one the player occupies. Think Project Zomboid boiled down to its essentials, wearing a cozy game's clothes.

The tone is the point: it should look twee, like a Pokémon interior or a cozy sim, and then a cute little zombie shambles through the doorway. The art stays cute. The systems stay serious.

**Not a Habbo clone.** Do not use Habbo's actual art. Same projection and sprite conventions, original or licensed assets.

## 2. Hard constraints

- **Web holy trinity.** Plain HTML, CSS, and JavaScript. No engine, no build step, no bundler. Script tags and ES modules. Small libraries are fine if they're a single include and don't take over the architecture.
- **Canvas 2D** for the game view. No WebGL, no Pixi, no Phaser. Sprite counts are low enough that canvas handles it.
- **DOM for UI.** HUD, inventory, prompts, and menus are HTML overlaid on the canvas. Don't draw UI into the canvas.
- Runs from a static folder. Double-clicking `index.html` should work (use a local server if ES modules complain, but no build).

## 3. Core principles (locked)

These came out of design discussion and should not be relitigated in implementation.

### 3.1 The world is a graph, not a map
- A **node** is a small tile grid with its own furniture, walls, and floor. Interiors, individual floors of a building, and outdoor areas (a street, a yard) are all nodes.
- An **edge** connects a tile in one node to a tile in another. Doors, windows, stairs, holes, and vents are all edges with different flags.
- An edge is **one object referenced by both nodes**. State (intact / broken / boarded, HP) lives on the edge. There is no "inside copy" and "outside copy" to sync.

```js
{
  id: "house-kitchen-window-e",
  a: { node: "house-kitchen", tile: [7, 2] },
  b: { node: "street",        tile: [12, 9] },
  kind: "window",            // "door" | "window" | "stairs"
  state: "intact",           // "intact" | "broken" | "boarded"
  hp: 40,
  traverse: {
    player: false,
    zombie: { aToB: false, bToA: true }   // zombies come in, never out
  }
}
```

### 3.2 Edge rules (demo defaults)
- **Doors:** anyone, either direction, unless barricaded.
- **Windows:** zombies only, inward only, and only once `state === "broken"`. Breaking a window is an attack on the edge from the outside. Zombies never exit through windows.
- **Stairs:** anyone, either direction. Only the ground floor connects to outside.
- Barricading/boarding an edge changes its state and adds HP. Both connected nodes render the new state for free because they read the same object.

### 3.3 Persistent off-screen simulation, one rendered node
- Every zombie always exists. In the player's current node it's a sprite with grid pathfinding. In any other node it's an abstract record: `{ node, targetEdge, arrivesIn }`.
- Crossing an edge into the player's node **materializes** the zombie at the edge's tile. Leaving the player's node **dematerializes** it back to a record.
- Off-screen zombies tick on a coarse timer (e.g., every 1s), not every frame.

### 3.4 One-way glass
- Windows are aesthetic from inside. Nothing outside is rendered while you're inside; there's no "out there" to see.
- The sim, however, knows where you are. Zombies in the adjacent node are **assigned an edge to attack** by a rule (weighted by edge weakness, noise you made nearby, light through windows at night). It's a lookup, not a path search. This is what keeps "barricade the door and forget it" from being a solved problem.
- Later, a "peek" mechanic can expose the adjacent node's counters through a window. Not in the demo.

### 3.5 Occlusion, not camera freedom
- Isometric shows two faces of any box. Design nodes so tall solid things sit on the far (top) edges and walkable space is in front of them, the way Habbo places its hotel in the corner.
- When the player or a zombie is behind a sprite that sorts in front of them: **fade** the occluder to ~40% alpha, and draw an **x-ray silhouette** (flat-color outline) of the occluded character on top. Both, not one.

### 3.6 Zombies are dumb on purpose
- Inside a node: A\* toward the player, slow walk speed, no group tactics.
- Between nodes: follow the assignment rule. Optionally a decaying "scent" counter on edges the player has recently used, so idle zombies drift after you.
- Distribute across available edges rather than all picking one. Unpredictability comes from distribution, not intelligence.

## 4. Demo scope

One "set" to build. Prove the loop, not the game.

**Nodes (2):**
1. `house` — a single-room interior. One door edge to `yard`. Two window edges to `yard` (zombie-only, inward, must be broken first). A few furniture pieces.
2. `yard` — a small exterior. Fence or hedge on the far edges. A handful of trees and props to test fade/silhouette. The house appears as a facade on the top edge; its door and windows are the same edge objects as above.

**Zombies:**
- Spawn only in `yard` (3–6 at start). None inside.
- Wander idly. Aggro on sight or on noise (gunshot).
- Can walk through the door into the house. Can break a window and climb in. Never exit via window.
- Persist across node transitions. If you run inside, the ones chasing you keep coming.

**Player:**
- Twin-stick: WASD to move, mouse to aim, 8 facing directions.
- Melee weapon (bat): swing arc in facing direction, short range, small windup, knockback.
- Gun (pistol): hitscan along aim vector, limited ammo, makes noise that aggroes zombies in the current node and biases edge assignment in adjacent nodes.
- Health. Zombies deal contact damage with a cooldown. Death = simple game-over overlay and restart.

**Interaction & inventory:**
- Two or three searchable containers (fridge, cabinet, dresser). Loot table rolled on first open. Search takes ~1s with a progress indicator.
- One food item in the world. Eating restores health (stand-in for the eventual hunger system).
- Ammo pickup.
- One board/plank item that can barricade the door or board a window from inside.
- Inventory: simple weight-limited list. Pick up, drop, use, equip. DOM panel.

**Explicitly out of scope for the demo:**
- Hunger/thirst/fatigue/sleep, cooking, crafting recipes, spoilage
- Multiple floors, more than two nodes
- Save/load
- Audio (a couple of placeholder SFX is fine if trivial)
- Any narrative

## 5. Architecture

Suggested file layout. Keep modules small and dumb.

```
/index.html
/style.css
/src
  main.js            // boot, game loop
  loop.js            // fixed-timestep update, rAF render
  input.js           // keyboard/mouse state, aim vector, facing → 8-dir
  iso.js             // tile<->screen math, sort key
  assets.js          // image loading, sprite sheet JSON parsing
  sprites.js         // Sprite/Animation classes
  world.js           // graph: nodes, edges, current node, transitions
  node.js            // a single node: grid, walkability, furniture, entities
  pathfind.js        // grid A*
  entities/
    player.js
    zombie.js
    prop.js          // furniture, containers, trees
  sim.js             // off-screen zombie tick, edge assignment, materialize/dematerialize
  combat.js          // melee arc, hitscan, damage, noise events
  items.js           // item definitions, loot tables
  inventory.js       // player inventory model
  render.js          // draw order, occlusion (fade + silhouette), edge sprites
  ui/
    hud.js
    inventory-panel.js
    prompt.js        // "Press E to search"
/data
  nodes/house.json
  nodes/yard.json
  edges.json
  items.json
  loot.json
  sprites/*.json     // animation definitions
/assets
  sprites/*.png
  tiles/*.png
```

### 5.1 Game loop
- Fixed timestep for logic (60 Hz). Accumulator pattern. Render on `requestAnimationFrame`.
- Off-screen sim ticks every 1000ms of game time inside the same loop.
- `imageSmoothingEnabled = false`. Internal canvas resolution fixed (e.g., 640×360 or whatever the tile set implies), scaled up by CSS with `image-rendering: pixelated`.

### 5.2 Isometric math (this replaces "the engine")

This is the part that Godot normally hides. It's about ten lines.

- Tiles are 2:1 diamonds. Pick a tile size from the art you find; 64×32 is the Habbo-ish standard, 32×16 is common in cheap packs.
- Grid coordinates are `(gx, gy)`. Screen position of a tile's center:

```js
const TW = 64, TH = 32;
function toScreen(gx, gy) {
  return {
    x: (gx - gy) * (TW / 2) + originX,
    y: (gx + gy) * (TH / 2) + originY
  };
}
function toGrid(sx, sy) {
  const x = sx - originX, y = sy - originY;
  return {
    gx: (x / (TW / 2) + y / (TH / 2)) / 2,
    gy: (y / (TH / 2) - x / (TW / 2)) / 2
  };
}
```

- Entities have float grid positions (they move between tiles smoothly). Movement is applied in grid space; the camera-relative 8 directions map to grid vectors (e.g., screen "up" = `(-1, -1)` normalized, screen "right" = `(+1, -1)`).
- **Draw order:** sort everything by `gx + gy` (then by `gz` for stacked things, then by a small y-tiebreak). Draw floor tiles first, then walls and sorted sprites. Multi-tile furniture uses its far-most tile as its sort anchor.
- Sprites are anchored at their "feet" (bottom-center of the tile diamond), with a per-sprite offset for tall things.

### 5.3 Map authoring: use Tiled

Tiled (mapeditor.org) supports isometric orientation natively and exports JSON. This is the Godot replacement for tiling.

- One Tiled map per node, orientation `isometric`, tile size matching the art.
- Layers: `floor` (tile layer), `walls` (tile layer), `props` (object layer with `gid` for sprite and custom properties), `collision` (tile layer or object rects), `edges` (object layer: points with properties `edgeId`, `side: "a"|"b"`).
- A loader in `node.js` reads the Tiled JSON and builds the grid. Tiled's JSON is documented and stable; parse only what you need.
- If Tiled feels like too much for the demo, a hand-written JSON with a 2D array of tile IDs and a props list is fine. The loader interface should be the same either way so Tiled can slot in later.

### 5.4 Sprites
- Sprite sheets as PNG + JSON (Aseprite export format, or a simple hand-written `{frames: {name: {x,y,w,h}}, animations: {walk_s: [..]}}`).
- Characters: 8 facings for the player (draw S, SW, W, NW, N; mirror for SE, E, NE). Zombies can be 4 facings for the demo; nobody will notice on a slow shambler.
- Animations per character for the demo: `idle`, `walk`, `attack` (melee swing / shoot), `hurt`, `die`.
- Draw with `drawImage(sheet, sx, sy, sw, sh, dx, dy, sw, sh)`. Never scale in the draw call; scaling happens once at the canvas level.

### 5.5 Combat
- **Melee:** on click with bat equipped, play `attack` toward facing, and on the active frame test zombies within range `r` and within a ±60° arc of the aim vector. Apply damage and a short knockback along the aim vector. Cooldown.
- **Hitscan:** on click with gun equipped, cast a ray from player position along aim vector in grid space, step it in small increments, hit the first zombie whose footprint circle it intersects (or a wall). Decrement ammo. Emit a `noise` event with a radius.
- **Noise:** `combat.js` emits `{node, tile, loudness}`. Zombies in the current node within radius aggro. `sim.js` reads it too and shifts edge assignment weights for zombies in adjacent nodes.
- **Zombie attack:** contact range, ~1s cooldown, small damage. Grab/lunge later.

### 5.6 Sim (`sim.js`)
- Records: `{ id, node, state: "idle"|"moving"|"attackingEdge", targetEdge, timer }`.
- Every sim tick, for each off-screen zombie:
  - If idle and no target: maybe pick an edge toward the player's node (weighted), or stay idle.
  - If moving: decrement timer; at zero, arrive at the edge. If the edge is traversable in this direction and open, cross. If the edge is a window, switch to `attackingEdge`.
  - If attacking an edge: reduce edge HP per tick. At zero, `state = "broken"`, then cross.
- Crossing into the player's node calls `node.materialize(zombieRecord, edge.tile)`.
- When the player crosses an edge, every zombie in the node they left is dematerialized with `targetEdge = the edge the player used` if it was chasing, else idle.

### 5.7 Occlusion (`render.js`)
- After sorting, for each character, check whether any sprite with a later sort key overlaps its screen rect. If yes, mark occluded.
- Draw pass: occluders of a marked character draw at `globalAlpha = 0.4`. Then a final pass draws a silhouette of each occluded character (tinted flat color via an offscreen canvas with `globalCompositeOperation = "source-in"`).
- Trees, lamp posts, the gazebo-type props are the ones that will trigger this. Walls on the near edges shouldn't exist (Habbo convention).

### 5.8 UI (DOM)
- HUD: health, equipped weapon, ammo. Absolutely positioned over the canvas.
- Prompt: "E — Search fridge" near the target when in range. Compute screen position from `toScreen` and offset.
- Inventory panel: toggled with Tab. List with weight, buttons for use/drop/equip. Container view side-by-side when a container is open.
- Michael's Dead Air project already has a windowed panel system; lift it if convenient, but a plain panel is fine.

## 6. Art assets for the proof of concept

Places to look for cheap or free isometric pixel art in this style:
- **Kenney** (kenney.nl) — CC0. Has isometric tile and furniture packs. Cleaner than Habbo but the right projection and grid.
- **itch.io** — search "isometric pixel," "isometric interior," "isometric tileset." Many packs are $5–20 with commercial licenses. Look for 2:1 tile ratios.
- **OpenGameArt** — mixed quality, check licenses per asset.
- **Characters** are the hard part. 8-direction isometric pixel characters exist on itch but are rarer. For the POC, accept 4-direction or a placeholder, or commission a single character + zombie later. A paper-doll system (body / head / clothes layered) is the long-term answer and is what Habbo does, but not for the demo.
- Match tile sizes across everything you buy; mixing 32×16 and 64×32 is painful.

Placeholder-first is fine. Colored diamonds for tiles and rectangles for characters get the whole engine working before any art is spent.

## 7. Milestones for Claude Code

Build in this order. Each step should run and be visible.

1. **Canvas + loop + iso grid.** Draw a 12×12 diamond grid. Click a tile, it highlights. Proves the math.
2. **Player movement.** A rectangle that moves with WASD in grid space, faces the mouse, snaps to 8 facings. Collision against a walkability grid.
3. **Node loader.** Load `house.json` (hand-written or Tiled). Floor, walls, a few props with sort order working. Player walks behind/in front of a table correctly.
4. **Sprites.** Swap rectangles for sprite sheets. Idle/walk animations. Facing selection with mirroring.
5. **Zombies in-node.** Spawn a few in the house temporarily. A\*, slow chase, contact damage, health, death overlay.
6. **Combat.** Melee arc and hitscan. Zombie hurt/die states. Ammo.
7. **Second node + edges.** Build `yard`. Door edge. Player transitions. Zombies dematerialize/materialize correctly when the player crosses.
8. **Off-screen sim + windows.** Zombies in the yard get assigned edges, break windows, come in. Noise from gunfire aggroes and biases assignment. Board/barricade item.
9. **Interaction + inventory.** Containers, search timer, loot tables, pickups, the DOM panel.
10. **Occlusion.** Fade + silhouette. Test with trees in the yard.
11. **Polish pass.** Move zombie spawns to yard-only, tune speeds and damage, placeholder SFX, restart flow.

## 8. Open questions (decide during build, don't block on them)

- Tile size: 64×32 or 32×16? Depends on the art pack. 64×32 reads better at 1x but needs more pixels per asset.
- Should the player be able to escape through a window at all (one-way, with a stagger)? Default no for the demo.
- Do zombies inside a node leave it on their own when the player isn't there, or only follow? Default: only follow, plus a small idle drift chance.
- Melee: single swing or a short combo? Single.

## 9. What this demo is meant to prove

- Walking around a Habbo-style diorama feels good with twin-stick controls.
- The node/edge model handles doors, windows, and node transitions without special cases.
- Zombies persisting across nodes creates pressure even when you can't see them.
- Melee and hitscan both work in isometric space.
- Searching a container and managing a small inventory is enough of a hook to justify building the survival layer on top.

If those five hold, the survival systems (hunger, sleep, cooking, barricade durability, multi-floor) are data and UI, not engine work.
