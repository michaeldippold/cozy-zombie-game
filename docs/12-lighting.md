# 12 — Milestones 14 and 15: Light as a game system

Milestone 13 made night look like night. These two milestones make light *matter*: zombies see you by it, a flashlight lets you see them and gives you away, and light eventually becomes a per-tile quantity the whole game can read. Michael's direction: darkness should make you harder to see, light in darkness easier, and putting a flashlight beam on a zombie should all but guarantee it comes for you. No Zomboid-level sophistication needed; it's the atmosphere that pays.

Both milestones share one module, `src/light.js`, which answers a single question: **how lit is grid position (gx, gy) in this node right now, 0..1?** Milestone 14 answers it analytically from a short list of sources. Milestone 15 answers it from a per-tile map with shadows. Everything that reads light (zombie sight, the sim, the renderer) calls the same function either way, so 15 replaces the inside of 14 without touching its callers.

---

## Milestone 14 — Flashlight and light-aware zombies

### Light model (`src/light.js`, analytic)

- **Ambient.** Interiors are 1.0 always (the player's own lamps). Outdoors, ambient is `clock.getBrightness()`: 1.0 by day, 0.22 at full night.
- **Static sources.** Lamp props (sprite id in `LIGHT_PROP_SPRITES`) and intact windows (wall variant `window`). Each adds `1 - d / radius` for grid distance `d` inside its radius. Lamps reach 2.4 tiles, windows 1.8.
- **Flashlight.** When on, the beam adds full light to any position inside its cone with line of sight, and the player carrying it gets a fixed self-light: holding a torch makes *you* a visible point in the dark. That is the trade the whole feature turns on.
- `lightAt(node, gx, gy, player)` sums these and clamps to 1.

### The flashlight item

- `flashlight` in `items.json`, kind `tool`, with a `beam: { range, arc }` in tiles and degrees. One in the starting kit for now, and one in the shop's shelf loot.
- **F** toggles it while one is in the backpack (the inventory row has a button too). Dropping the last one switches it off. No battery yet; that's a natural later limiter alongside weapon degradation.
- The beam is a cone from the chest along the aim vector, so it follows the mouse like everything else.

### Beam geometry

The cone is defined in screen space (it's what the hand aims) and marched in grid space (it's what walls are made of). `beamRays` casts a fan of rays across the arc: each ray converts its screen angle to a grid direction, steps in small increments, and stops at the first tile that blocks shots or at the range. The endpoints, in screen space, form the beam polygon; `inBeam(node, player, gx, gy)` is the same test for a single point: inside the arc, within range, clear line of sight.

### Rendering

In `drawNightOverlay`, after the lamp and window pools, the beam polygon is erased from the night layer with a radial gradient from the chest (bright) to the range (nothing), then a warm additive fill goes over the scene with the same clip. Because the polygon is built from blocked rays, the beam stops at trees, cars, and walls without any extra shadow code. Indoors nothing draws, since interiors are lit.

### Zombie awareness

- A zombie's sight range scales with the light *on the player*: `ZOMBIE_SIGHT × (0.35 + 0.65 × lightAt(player))`. Full dark and unlit: about 2 tiles. Under a lamp or in daylight: the full 6. Line of sight still applies.
- A zombie inside the flashlight beam is seen, full stop. If you put the beam on it, it aggros.
- Off-screen, a flashlight on outdoors at night adds alarm to the current node every sim tick. Light in darkness is a tell the neighbourhood can feel, exactly like a gunshot but quieter and continuous.

### Acceptance

All checks below scripted and passed on 2026-09-17 (yard, 01:00). Lesson for future tests: keep test zombies off tree tiles and their lines of sight clear of them, or line of sight fails for the wrong reason.

- At full night, unlit, a zombie 4 tiles away with clear line of sight does not notice the player; the same zombie in daylight does.
- Standing in a lamp pool at night, a zombie 5 tiles away notices.
- Flashlight on, beam across a zombie 5 tiles away in the dark: it aggros within a step. A zombie at the same distance just outside the arc does not.
- A zombie in the arc but behind a tree does not aggro, and the drawn beam visibly stops at the tree.
- Alarm on the current node rises while the flashlight is on outdoors at night and does not by day.
- F toggles, dropping the flashlight switches it off, HUD shows the state.

---

## Milestone 15 — Per-tile light map with shadows

### Why

The analytic model can't cast shadows and can't be read cheaply by anything that wants "light on this tile" for many tiles at once. A per-tile map makes light a first-class quantity: the renderer draws from it, zombies read it, the sim can read it, and future systems (stealth, sleep, a generator) get it for free.

### Model

- `lightMap` per node: `width × height` floats, plus the threshold tiles.
- Recomputed when it could have changed: on node entry, on a light source changing (window boarded or broken), on the flashlight moving or toggling, and on the clock advancing past a brightness step. In practice: cheaply, every sim tick, plus every frame the flashlight is on.
- For each source, for each tile within its radius: line of sight from source tile to target tile through the shot-blocking grid (the existing `lineOfSight`), falloff `1 - d / radius`. Solid-but-low props (tables, cars) block walking, not light; only `blocksShots` casts shadows. Add ambient, clamp.
- `lightAt` becomes a bilinear read from the map. Same signature, same callers.

### Rendering

The night layer becomes one diamond per tile with alpha from `(1 - light)` under the same multiply tint, drawn back to front. Stepped per-tile lighting suits the pixel look; if it reads too blocky, the step up is per-vertex gradients (each diamond filled with a gradient from its corner lights), which is still just canvas fills. The flashlight beam keeps its polygon draw on top; its light contribution is also in the map, so zombies and the picture agree.

### What it unlocks

- Shadows: a lamp behind a car leaves the far side dark. A lit window lights the grass in front, not the hedge behind.
- The sim's "light through windows" weight can use the actual light on the window's yard tile instead of a flat bonus.
- Peek-through-window later: the interior light map is what you'd see.
- A generator or candles as data: a prop with a light radius.

### Acceptance

- A tile behind a `blocksShots` prop relative to a lamp is darker than the same distance in the open.
- Zombie sight uses the map: standing just inside a shadow at night is meaningfully safer than a step into the light.
- Frame time stays flat with the map recomputed every sim tick and every frame while the flashlight is on.
- No caller of `lightAt` changed.

### Cost

Roughly a day. The ray march exists from milestone 14; the rest is a loop, a cache, and a renderer swap.
