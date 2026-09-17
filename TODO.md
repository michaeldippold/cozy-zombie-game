# TODO

Working checklist. A new session should read `CLAUDE.md`, then this file, then the doc a task links to. Tick boxes as work lands. Keep the **Status** block current at the end of every session.

## Status

- **Current milestone:** 24 complete (2026-09-17): melee that lands, knockdown and finishers, shove on Space, hit feedback, slower zombies (`docs/22-melee.md`). Earlier the same day: 23 grid inventory, 22 thirst, 21 body despawn, 20 bodies as containers, 19 death and survivors, 18 moodles, 17 save and load.
- **What exists:** seven-node neighbourhood with gates and stairs (M12); hunger and a day/night clock (M13); flashlight and light-aware zombie sight (M14); per-node light map with shadows (M15); room lights, candles, coherent windows, daylight through openings (M16); one-slot local autosave, start screen, Escape pause menu (M17); moodles for slow needs (M18); death turns you and a new survivor joins the same world (M19); bodies as containers with a loot table (M20) that despawn after 48 h (M21); thirst, fillable bottles, sinks and a fountain (M22); grid inventory with drag and drop, no weight (M23). Right-click menus with auto-walk, screen-space gun (no reloading or jams, by ruling), doorway thresholds, stamina-costed melee, plank refunds.
- **Last completed task (2026-09-17):** Milestone 17 built and verified by script. Also wrote `docs/16-zomboid-systems-fit.md`, a survey of Project Zomboid systems with a fit verdict for each; it is the menu for choosing the next survival systems and nothing in it is built.
- **History:** each milestone doc (10 to 13) ends with its scripted acceptance results; `docs/09-decisions.md` has every ruling with its reason, newest first, including the ones that were reversed.
- **Blocked on:** nothing
- **Next, in Michael's order:** sleep (tired moodle, beds, time skip, waking to break-ins; see section 4 of `docs/16`), then furniture. Furniture ruling already made (see `docs/09`): small pieces are grid items; any single large piece is carried in both hands with no sprint and no fighting, and no other penalty. **Tabled by Michael:** water and power shutoff, until the moment-to-moment game is fuller. Parked: flashlight battery, candle burn time, daylight pooled at windows, peeking through windows. Later: Tiled importer, real art last.
- **Notes for next session:** Melee was reworked in M24; if it still feels wrong in play, the lunge wind-up in `docs/22` is the held-back next step. Run with `python serve.py 8000` (a no-cache static server; plain `http.server` serves stale modules). For scripted tests in a browser console: the game now boots to a start screen, so call `window.__game.newGame()` first, then `window.__game.loop.setPaused(true)`, then drive time with `window.__game.loop.advance(seconds)`; the game otherwise runs in real time between commands. `?sheet=<id>&scale=2` on the URL renders a sprite sheet instead of the game. Interaction (E), prompt, pickups, container search, and plank boarding were built during milestone 8 in `src/interact.js` and `src/ui/prompt.js`; milestone 9 only needs the panel, container view, use/drop/equip, and food.

Milestone acceptance criteria live in [docs/08-milestones.md](docs/08-milestones.md). Fixed numbers live in [docs/01-constraints.md](docs/01-constraints.md). Tunable starting values live in [docs/09-decisions.md](docs/09-decisions.md).

---

## Milestone 1 — Canvas, loop, iso grid

- [x] `index.html`: a `<canvas id="game">`, a `<div id="ui">` overlay, a `<div id="debug">` corner, `<script type="module" src="src/main.js">`.
- [x] `style.css`: body black, canvas centered, `image-rendering: pixelated`, `#ui` absolutely positioned over the canvas, `#debug` small monospace top-left.
- [x] `src/iso.js`: export `TW`, `TH`, `toScreen`, `toGrid`, `setOrigin`, `DIRS` (the 8 facing table from docs/03), `facingFromVector(sx, sy)`, `sortKey(gx, gy, gz, tiebreak)`.
- [x] `src/input.js`: key state map, mouse position in canvas pixels (divide by display scale), left button pressed and just-pressed, `Tab` and `E` handled with `preventDefault`.
- [x] `src/loop.js`: `start({ update, render, simTick })`, 60 Hz accumulator with a clamp, sim tick every 1000 ms of game time, rAF render, frame counter.
- [x] `src/main.js`: create the canvas at 960×540, compute integer scale on resize, set origin so a 12×12 diamond is centered, draw placeholder floor diamonds, highlight the hovered tile, log clicked tile.
- [x] Verify acceptance: hover matches the mouse on every tile at several window sizes.

## Milestone 2 — Player movement

- [x] `src/node.js`: `createNode({ size })` with a `walkable` 2D array, `isWalkable(gx, gy)`, `setBlocked(gx, gy)`.
- [x] `src/entities/player.js`: `{ gx, gy, facing, speed, radius }`, `update(dt, input, node)`. WASD to screen vector, screen vector to grid vector via `DIRS`, normalize, move.
- [x] Circle-vs-grid collision with axis-separated resolution so the player slides.
- [x] Facing from mouse via `facingFromVector`, drawn as a short line from the player.
- [x] Temporary: block a few tiles in `main.js` to test sliding.
- [x] Verify acceptance: diagonal walking along a blocked row is smooth, never enters a blocked tile.

## Milestone 3 — Node loader and draw order

- [x] `data/nodes/house.json` per docs/06: 10×10, north and west walls, fridge, cabinet, dresser, table, 3×1 sofa, two chairs, one plank on the floor, player spawn.
- [x] `src/entities/prop.js`: `createProp(def)` returning drawables, one per footprint tile, each with its own `sortKey`.
- [x] `src/node.js`: `loadNode(json)` builds walkability from props marked `solid` and builds `blocksShots` grid. Store `props`, `entities`, `edgeRefs`.
- [x] `src/render.js`: passes in order per docs/03: floor, far walls, sorted drawables. `drawable = { key, draw(ctx) }`. Placeholder boxes for props, drawn with a top face and two side faces so height reads.
- [x] Player becomes a drawable using float `gx + gy`.
- [x] Verify acceptance: circle the table and the sofa, sorting never pops.

## Milestone 4 — Sprites and placeholder characters

- [x] `data/sprites/player.json`, `zombie.json`, and one file per prop, following docs/06. Use the `placeholder` block, no `image`.
- [x] `src/assets.js`: `loadSprite(id)` fetches the JSON, loads `image` if present, else calls the placeholder generator for the `placeholder.kind`. Returns `{ image, frames, animations, anchor, facings, mirror }`.
- [x] Placeholder generator: `character` draws a blocky big-headed figure into an offscreen canvas for every facing and animation frame with simple leg and arm offsets per walk frame, an attack lean, a hurt flash, and a die fall. `box`, `flat`, and `wall` kinds for props, floors, walls.
- [x] `src/sprites.js`: `Animation` with `{ name, frame, elapsed }` and `advance(dt)`. `drawSprite(ctx, sheet, animName, facing, frame, sx, sy)` handling mirror via `ctx.scale(-1, 1)`.
- [x] Player uses `idle` when still, `walk` when moving. Props use their single frame. Per-tile furniture uses `idle_<i>`.
- [x] Verify acceptance: hand-draw one tiny real PNG plus JSON for a chair, drop it in, nothing else changes.

## Milestone 5 — Zombies in-node

- [x] `src/pathfind.js`: grid A\* with 8-neighbor movement, no corner cutting through blocked tiles.
- [x] `src/entities/zombie.js`: states `idle`, `wander`, `chase`, `attack`, `hurt`, `die`. Sight check by ray against `blocksShots`. Repath every 300 ms or on player tile change. Soft separation between zombies.
- [x] Contact attack with cooldown. Player `hp`, `takeDamage`.
- [x] `src/ui/hud.js`: health bar, placeholder text for weapon and ammo.
- [x] `src/ui/overlay.js`: game over overlay with a restart button. Restart rebuilds world from data.
- [x] Temporary: spawn three zombies in the house.
- [x] Verify acceptance: zombies path around furniture, die and restart works twice without a reload.

## Milestone 6 — Combat

- [x] `src/events.js`: `on`, `off`, `emit`.
- [x] `data/items.json` with bat, pistol, ammo, food, plank per docs/06.
- [x] `src/combat.js`: `meleeSwing(player, zombies)` with windup, active frame, screen-space arc test, damage, knockback. `fireHitscan(player, node, zombies)` stepping a grid ray, ammo decrement, dry fire, `emit("noise", { node, tile, loudness })`.
- [x] Weapon switching with `1`, `2`, and scroll wheel. Player `attack` animation with `activeFrame`.
- [x] Zombie `hurt` interrupt and `die` with a corpse drawable that neither sorts as an entity nor collides.
- [x] Zombies subscribe to `noise` and aggro within radius.
- [x] HUD shows equipped weapon and ammo.
- [x] Verify acceptance: bat hits two in front, misses one behind. Shots stop at walls and first zombie.

## Milestone 7 — Second node and edges

- [x] `data/edges.json`: `house-door`, `house-window-1`, `house-window-2` per docs/06.
- [x] `data/nodes/yard.json`: 12×10, hedge walls, house facade on the north edge, trees, lamp post, zombie spawns.
- [x] `src/world.js`: loads all nodes and edges, resolves edge references on both nodes, tracks `currentNode`, `transition(edge)`.
- [x] Edge wall sprites: door and window segments drawn from the edge object's state on both sides.
- [x] Player stepping onto an edge endpoint tile with a traversable edge triggers `transition`. Player appears on the far endpoint tile.
- [x] `src/sim.js`: `records` map, `dematerializeAll(node, exitEdge)`, `materialize(record, node, tile)`, `materializeArrivals(node)`. Chasers get `targetEdge` and a distance-based timer.
- [x] Node name shown on the HUD.
- [x] Verify acceptance: three chasers follow through the door one by one; non-chasers are where you left them.

## Milestone 8 — Off-screen sim and windows

- [x] `sim.tick()`: idle records roll to pick an edge by weighted random per docs/02, moving records count down, arrival checks traversability, `attackingEdge` reduces glass then barricade.
- [x] Edge `glass` and `barricade` state changes emit `edgeChanged` so both nodes redraw the segment and `node.js` rebuilds grids if needed.
- [x] Window traversal: zombies only, inward only, glass broken. Player never.
- [x] Noise and scent weights on edges, decaying per tick.
- [x] Plank interaction from inside: `E` on a door or window endpoint tile, 2 s progress, consumes plank, sets `barricade.hp`.
- [x] Glass breaking emits a moderate noise.
- [x] Verify acceptance: barricading only the door is not safe; a window entry is visibly distinct.

## Milestone 9 — Interaction and inventory

- [x] `data/loot.json` for fridge, cabinet, dresser.
- [x] `src/items.js`: item defs lookup, `rollLoot(tableId)`.
- [x] `src/inventory.js`: weight-limited list, `add`, `remove`, `use`, `equip`, stacking for ammo.
- [x] `src/ui/prompt.js`: nearest interactable in front of the player, screen-positioned prompt via `toScreen`, progress bar for timed actions, cancel on move.
- [x] Containers: first `E` rolls loot, opens container view.
- [x] `src/ui/inventory-panel.js`: `Tab` toggles, list with weight, use, drop, equip; container side view with move buttons.
- [x] Floor pickups including ammo. Dropped items become floor drawables.
- [x] Food restores health.
- [x] Verify acceptance: full loop of search, eat, plank, board, run dry, resupply.

## Milestone 10 — Occlusion

- [x] In `render.js`, after sorting, compute screen rects for characters and later-keyed drawables, mark occluders and occluded.
- [x] Occluders draw at alpha 0.4.
- [x] Silhouette pass via an offscreen canvas with `source-in`.
- [x] Verify acceptance in the yard behind trees with player and a zombie together.

## Milestone 24 — Melee that lands (see docs/22-melee.md)

- [x] `combat.js`: `inWedge` tests the body (feet to chest samples, screen-space arc from the chest, grid reach from the feet with bounded down-screen slack, point blank always). Swings resolve on the click. The drawn wedge is the tested shape.
- [x] Knockdown (30%, guaranteed on the third hit in a row), 2 s on the floor, finisher double damage. `zombie.js` `down` state, `knockDown`, `stagger`; get-up reuses the rise animation.
- [x] Shove on Space: push, stagger, 25% knockdown, no damage.
- [x] Feedback: hit-stop, screen kick, white flash, thud and crunch sounds.
- [x] Zombie speed 1.2 to 1.0. Bat range 1.35, knockback 0.8.
- [x] Verify acceptance in docs/22 (scripted and passed 2026-09-17).

## Milestone 23 — Grid inventory (see docs/21-grid-inventory.md)

- [x] `src/grid.js`: pure placement rules (`fits`, `findSpot`, `add`, `moveEntry`, `transfer`, `tidy`, `fill`).
- [x] `inventory.js`: a 6x4 bag; weight and `limit` removed. Props and bodies are bags too (`cols`, `rows`, `items` aliasing `contents`); container grids come from `loot.json`.
- [x] `ui/inventory-panel.js` rewritten: coloured blocks, bottle water level, drag within and between bags and onto the floor, R / right-click / wheel to rotate, shift-click and double-click to send across, Tidy, right-click item menu replacing row buttons.
- [x] Items gained `size`, `color`, `short`; lost `weight`. Candles stack to 4. `SAVE_VERSION` 4.
- [x] Verify acceptance in docs/21 (scripted with real pointer events and passed 2026-09-17).

## Milestone 22 — Thirst and water (see docs/20-thirst.md)

- [x] `player.js`: thirst drains over 7 minutes; under 15 stamina regen halves; at 0 health drains. Thirst moodle. Death cause `thirst`.
- [x] Items with per-instance `fill`: `water_bottle` (0 to 100%), carried through inventory, floor, containers, bodies, and saves. Panel rows per fill level.
- [x] Drink button, automatic drinking under 60, soda, salty chips.
- [x] Water sources: `"water"` props (sinks in both houses, fountain in the park) with Drink and Fill bottles.
- [x] Loot tables updated. `SAVE_VERSION` 3.
- [x] Verify acceptance in docs/20 (scripted and passed 2026-09-17).

## Milestone 21 — Bodies despawn (see end of docs/20-thirst.md)

- [x] `diedAt` on zombies and records; `sim.tick` removes dead records after `BODY_LIFETIME` (48 in-game hours), off-screen only; a former survivor's body is kept while it holds anything.

## Milestone 20 — Bodies are containers (see docs/19-bodies.md)

- [x] Dead zombies are searchable containers; ordinary ones roll the `zombie` loot table on first search; a former survivor holds their backpack. Nothing drops on the floor.
- [x] Records carry `loot` and `searched`. Verified by script 2026-09-17.

## Milestone 19 — Death, turning, the next survivor (see docs/18-death-and-survivors.md)

- [x] `zombie.js`: `former`, `loot`, and a `rise` state; `canSee` is false for a dead player. Sprite `zombie_survivor` (zombie skin, the player's clothes).
- [x] `sim.js`: `former` and `loot` carried through dematerialize, serialize, restore. `SAVE_VERSION` 2.
- [x] `main.js`: death sequence (fall, turn at 1.5 s, card at 3.2 s) with the world still running; `newSurvivor()` into the quietest other node with a bat and a flashlight; former self drops its loot when killed; save on turning with `player.dead`; Continue from that save makes a new survivor.
- [x] `ui/overlay.js`: death card with New survivor and New world over a light backdrop.
- [x] Verify acceptance in docs/18 (scripted and passed 2026-09-17).

## Milestone 18 — Moodles (see docs/17-moodles.md)

- [x] `src/moodles.js`: registry of `{ id, glyph, stages, stageOf(player) }` and `activeMoodles(player)`. Hunger is the first entry.
- [x] `src/ui/moodles.js`: HUD row above health; hidden when fine; amber to red by stage; pops when it appears or worsens; hover shows name and flavour text.
- [x] `ui/hud.js` and `style.css`: hunger bar removed. Health and stamina stay as bars.
- [x] Verify acceptance in docs/17 (scripted and passed 2026-09-17).

## Milestone 17 — Save, load, start screen (see docs/15-save-load.md)

- [x] `src/save.js`: one `localStorage` slot, versioned, unreadable or wrong-version saves discarded.
- [x] `serialize()` / `restore()` owned by each module: `world.js` (edge state, floor items, room lights, container contents), `sim.js` (all zombies as records, alarm, trickle timer, spawn id), `clock.setElapsed`.
- [x] `main.js`: `snapshot()`, `applySnapshot()` over a fresh world inside try/catch, autosave on node transition, every 60 s, on tab hide and unload, and on quit to title. Never before start or after death. Death deletes the save.
- [x] `ui/overlay.js`: start screen (Continue with day, time, and place; New game; controls) and Escape pause menu (Resume; Save and quit to title). Loop paused behind both.
- [x] `assets.js`: concurrent requests for the same sprite definition share one fetch (boot made 150 requests, now 82).
- [x] Verify acceptance in docs/15 (scripted and passed 2026-09-17).

## Milestone 16 — Indoor light and coherent windows (see docs/13-indoor-light.md)

- [x] Near-edge stub walls for interiors (`placeholders.js` near variants, `render.js` `drawNearWalls`, `node.js` loads `walls.south/east`).
- [x] Coherence: house windows to the south edge, blue house window to the east edge, shop decor windows to the south stub (`edges.json`, node JSON).
- [x] Room lights: `lightsOn`, `switch`, switch action (E and menu), LED drawn over the darkness.
- [x] `light.js`: ambient by room lights, windows lit only when the room behind is lit, candles as indoor static sources, `darknessOf`.
- [x] Renderer: night layer indoors when dark, lit panes, candle flames, fake window glow removed, beam clipped to the floor.
- [x] Candle item, loot entries, starting kit.
- [x] Street lamp radius 3.
- [x] Indoor daylight through openings: unlit rooms read 0.88 open, 0.55 with windows boarded, 0.22 sealed at noon (`light.js` `openness`, `ambientLight`).
- [x] Verify acceptance in docs/13 (scripted, passed 2026-09-17).

## Milestone 15 — Per-tile light map with shadows (see docs/12-lighting.md)

- [x] `light.js`: per-node `lightMap`, recomputed every sim tick and every frame while the flashlight is on; sources with `lineOfSight` shadows; `lightAt` becomes a bilinear read.
- [x] `render.js`: night layer as per-tile diamonds with alpha from the map; beam polygon stays on top.
- [x] `sim.js`: window light weight reads the map on the window's outdoor tile.
- [x] Verify acceptance in docs/12.

## Milestone 14 — Flashlight and light-aware zombies (see docs/12-lighting.md)

- [x] `src/light.js`: `ambientLight`, `staticLights`, `inBeam`, `beamRays`, `lightAt`.
- [x] `items.json`: `flashlight` (kind `tool`, `beam`); sprite `item_flashlight`; starting kit and shop loot.
- [x] Player `flashlightOn`; F toggles; panel button; dropping the last one switches it off; HUD state line.
- [x] `render.js`: beam polygon erased from the night layer with a chest-to-range gradient, warm additive fill, stops at blocking tiles.
- [x] `zombie.js`: sight range scales with `lightAt(player)`; in-beam is guaranteed sight.
- [x] `sim.js`: `addAlarm`; main adds flashlight alarm outdoors at night per tick.
- [x] Docs: 04 gameplay, 06 data, 09 decisions, README controls.
- [x] Verify acceptance in docs/12.

## Milestone 13 — Hunger and day/night (see docs/11-hunger-and-night.md)

- [x] `src/clock.js`: day length, phase, brightness, nightFactor, label. `main.js` calls `reset()`/`update(dt)`.
- [x] `entities/player.js`: `hunger`/`maxHunger`/`starving`, drain, starvation damage, one-time message.
- [x] `items.json`: `hunger` field on food; added `chips` as a second, cheaper food; `loot.json` shelf table includes it.
- [x] `ui/hud.js`: hunger bar, clock label. `ui/overlay.js`: cause-specific game-over text (`zombie` / `starvation`). `main.js`: single `checkGameOver(cause)` gate.
- [x] `sim.js`: night multiplier on idle pick chance; window-into-player's-node light weight bonus.
- [x] `render.js`: full-canvas night wash; warm glow on intact window wall segments.
- [x] Verify acceptance in docs/11 (scripted and passed 2026-09-14: hunger drain/eat/starve/game-over, day→night→day cycle, night darkening + window glow visible both sides, night pull demonstrated).

## Milestone 12 — Neighbourhood (see docs/10-neighbourhood.md)

- [x] `sim.js`: BFS hop distance from the player's node each tick; records pick edges toward closer nodes; crossing into a non-player node keeps the record.
- [x] `sim.js`: node alarm from noise, spreads 3 hops at 40%, decays; idle pick chance = base + alarm term.
- [x] `sim.js`: trickle spawner for outdoor nodes ≥ 2 hops away and under `zombieCap`.
- [x] Edge kinds `gate` and `stairs` in `world.js` (door rules, not boardable) and wall variants `stairs`.
- [x] `node.js` / `render.js` / `interact.js` / `assets.js`: per-tile wall sprite arrays and `wallDecor`.
- [x] `data/world.json` listing nodes; `main.js` loads from it. Debug line shows per-node counts.
- [x] Nodes: `street`, `house2-ground`, `house2-upstairs`, `shop`, `park`; yard gains the gate. Sprites: fence, storefront, road, car, bench, mailbox, shelf, counter, bed.
- [x] Loot table `shelf`.
- [x] Verify acceptance in docs/10 (all five checks scripted and passed 2026-09-14).

## Milestone 11 — Polish

- [x] Remove temporary house spawns. Yard-only spawns, 3 to 6.
- [x] Tune speeds, damage, cooldowns, edge weights. Record final values in docs/09.
- [x] Restart from overlay rebuilds everything cleanly, including sim records and edge state.
- [x] Optional trivial placeholder sounds.
- [x] Walk through the five proofs in docs/00 and note the result in the Status block.
