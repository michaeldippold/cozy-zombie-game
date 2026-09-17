# TODO

Working checklist. A new session should read `CLAUDE.md`, then this file, then the doc a task links to. Tick boxes as work lands. Keep the **Status** block current at the end of every session.

## Status

- **Current milestone:** 14 (Flashlight and light-aware zombies) complete (2026-09-17). Milestone 15 (per-tile light map with shadows) is scoped in `docs/12-lighting.md` and next. Seven-node neighbourhood from milestone 12, hunger, day/night, and a real light-punch darkness system.
- **Last completed task (2026-09-17):** Night retuned so the flashlight is needed: darker far tint (35–60% brightness, never black) plus a subtle personal visibility pool around the player; hiding zombies in the dark was proposed and rejected (reads as spawning). Michael wants this settled before milestone 15.
- **Before that (2026-09-17):** Milestone 14, scripted acceptance in the yard at 01:00: an unlit player is unseen at 4 tiles and seen at the same distance by day; under a lamp at night a zombie 5 tiles away notices; the flashlight beam on a zombie 5 tiles away aggros it while one just outside the arc stays idle; the beam and sight both stop at a tree; the yard's alarm rises while the torch is on at night and not by day; F toggles, dropping the last flashlight switches it off, HUD shows the state. `src/light.js` is the single light function every reader uses; milestone 15 replaces its inside.
- **Earlier (2026-09-17):** Michael found the light-punch night too dark between lights. Night is now a blue moonlight tint composited with multiply (everything stays readable), with wider, softer lit pools and a warm glow at lamps. Verified in yard and street at 01:00. Open design question from Michael: a flashlight item casting a beam; see the decision log and the per-tile light map option in `docs/11`.
- **Before that (2026-09-15):** Michael caught that darkness hit at 3pm, because the clock's phase boundaries were cycle fractions that never got checked against real hours. Rewrote `clock.js` to work in real hours directly: full dark 23:00-06:00 with a one-hour taper each side, new games start at 08:00. Also answered "can lights matter without a lighting engine": yes, interiors are now always lit regardless of the clock, only outdoor nodes darken, and the darkness is drawn as a wash with `destination-out` circles erased at lamp posts and lit windows, giving real lit-vs-dark visibility instead of a flat tint. Verified in-browser: 15:00 is full day, house stays bright at 1am, yard and street show lit pools around lamps and windows with proper darkness between them, 60fps holds, no console errors.
- **Previously (2026-09-14):** Milestone 13 acceptance, scripted. Hunger drains to zero over 10 minutes with no food; eating restores hunger and health together; starvation drains health and ends the game with its own overlay ("You starved to death."). The clock cycled correctly by its (then-buggy) fractional boundaries; that bug is now fixed, see above. The clock cycles day → dusk → night → dawn correctly (verified brightness and phase at each boundary). A yard zombie was pulled toward a lit window during a paused-clock night test — that mechanic is unchanged by today's fix.
- **Before that:** Milestone 12 acceptance. Three park chasers followed the player park → street → blue house → upstairs, arriving one by one. Two pistol shots in the house pull about a third of the neighbourhood over 150 s, mostly from the yard. A calm house sees at most one visitor in five minutes. Trickle restocked the street, yard, and park four times in six minutes, never next to the player. Decorative upstairs windows are inert. Also that session: melee costs stamina (winded swings are half damage), "Remove boards" refunds planks, browser context menu suppressed on all game DOM. Before that: right-click context menus with auto-walk, screen-space gun hit test, doorway thresholds. Before that, milestone 11.
- **Blocked on:** nothing
- **Candidate next steps (not started, need Michael's call):** hands-on tuning of hunger drain rate and night pull strength, chosen to be provably present rather than tuned for feel; light-punch radii could use eyeballing now that they're visible; save/load, which matters more now that sessions span a day/night cycle; door open/close; weapon degradation; a "peek" through windows; Tiled importer once hand-written JSON nodes get tedious; real art last.
- **Notes for next session:** Run with `python serve.py 8000` (a no-cache static server; plain `http.server` serves stale modules). For scripted tests in a browser console: `window.__game.loop.setPaused(true)` first, then drive time with `window.__game.loop.advance(seconds)`; the game otherwise runs in real time between commands. `?sheet=<id>&scale=2` on the URL renders a sprite sheet instead of the game. Interaction (E), prompt, pickups, container search, and plank boarding were built during milestone 8 in `src/interact.js` and `src/ui/prompt.js`; milestone 9 only needs the panel, container view, use/drop/equip, and food.

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

## Milestone 15 — Per-tile light map with shadows (see docs/12-lighting.md)

- [ ] `light.js`: per-node `lightMap`, recomputed every sim tick and every frame while the flashlight is on; sources with `lineOfSight` shadows; `lightAt` becomes a bilinear read.
- [ ] `render.js`: night layer as per-tile diamonds with alpha from the map; beam polygon stays on top.
- [ ] `sim.js`: window light weight reads the map on the window's outdoor tile.
- [ ] Verify acceptance in docs/12.

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
