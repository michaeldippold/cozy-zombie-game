# 12 — Milestones 14 and 15: Light as a game system

Milestone 13 made night look like night. These two milestones make light *matter*: zombies see you by it, a flashlight lets you see them and gives you away, and light eventually becomes a per-tile quantity the whole game can read. Michael's direction: darkness should make you harder to see, light in darkness easier, and putting a flashlight beam on a zombie should all but guarantee it comes for you. No Zomboid-level sophistication needed; it's the atmosphere that pays.

Both milestones share one module, `src/light.js`, which answers a single question: **how lit is grid position (gx, gy) in this node right now, 0..1?** Milestone 14 answers it analytically from a short list of sources. Milestone 15 answers it from a per-tile map with shadows. Everything that reads light (zombie sight, the sim, the renderer) calls the same function either way, so 15 replaces the inside of 14 without touching its callers.

---

> **Reading note.** The flashlight, zombie awareness, and light-map sections below are still accurate in substance. Three details were later changed by milestone 16 and are marked where they occur: interiors are no longer always lit, lamp and window radii changed, and the screen-space window pool was removed. The current design in one place: `14-lighting-reference.md`.

## Milestone 14 — Flashlight and light-aware zombies

### Light model (`src/light.js`, analytic)

- **Ambient.** ~~Interiors are 1.0 always (the player's own lamps).~~ *Superseded by milestone 16: an interior is 1.0 only with its lights on.* Outdoors, ambient is `clock.getBrightness()`: 1.0 by day, 0.22 at full night.
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

In `drawNightOverlay`, after the lamp and window pools, the beam polygon is erased from the night layer with a radial gradient from the chest (bright) to the range (nothing), then a warm additive fill goes over the scene with the same clip. Because the polygon is built from blocked rays, the beam stops at trees, cars, and walls without any extra shadow code. ~~Indoors nothing draws, since interiors are lit.~~ *Superseded: the beam draws in any dark room.*

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

### Model (as built)

- **Static light is a cached map per node**, at two cells per tile so shadows have soft edges. For every cell, each static source (lamp, intact window) adds `min(1, 1.4 × (1 − d / radius))` if the path from the source to the cell is clear of shot-blocking tiles. The source's own tile and the target's own tile never block, so a tree is lit on its lit side and dark behind. Lamps reach 4.5 tiles, windows 3.0 *(lamps later reduced to 3.0 at Michael's request)*: big soft pools with room for shadows to read. (5.5 and 3.5 were tried first; they lit nearly the whole street and undercut the darkness level chosen the same day.)
- The cache is keyed by the node's light signature (which sources exist, where). Boarding or breaking a window changes the signature and the map rebuilds. `light.update(node)` validates it once per step.
- **The flashlight is not in the map.** It is evaluated exactly at query time (`inBeam`), which is cheaper than re-marching a cone across the map every frame and keeps the drawn beam, the sight test, and the light value in perfect agreement.
- `lightAt(node, gx, gy, player)` = clock ambient + a bilinear sample of the static map + the beam and self-light terms, clamped. Same signature as milestone 14; no caller changed.
- ~~Interiors have no map: light is 1.~~ *Superseded by milestone 16: interiors have a map too (candles), and their ambient depends on the switch and the openings.*

### Rendering (as built)

The static map is also the picture. It is written into a tiny image, one pixel per cell with alpha = how much darkness to remove, and drawn onto the night layer under `destination-out` through the isometric transform with image smoothing on. The browser's bilinear filtering does the interpolation, so light pools and shadow edges come out smooth with no per-pixel work and no blocky tiles.

Two things stay in screen space on purpose: the warm glow at lamps, and the player's night-vision pool, which is vision, not light. *(A third, a small pool lighting the wall face around each lit window, was removed in milestone 16 along with the fake window glow; lit windows now show a lit pane.)* The flashlight keeps its crisp ray-cast polygon.

### What it unlocks

- Shadows: a lamp behind a car leaves the far side dark. A lit window lights the grass in front, not the hedge behind.
- The sim's "light through windows" weight now uses the actual static light on the window's outdoor tile. Board the window and the pull goes away with the glow.
- Peek-through-window later: the interior light map is what you'd see.
- A generator or candles as data: a prop with a light radius.

### Acceptance

All four checks scripted and passed on 2026-09-17. Measured in the yard at 01:00: light contribution 0.10 behind the tree versus 0.34 at the same distance in the open. A player in that shadow (light 0.32) is ignored by a zombie 4.8 tiles away with clear line of sight; one step into the lamp pool (light 1.0) at the same distance and it chases. A boarded window's tile drops from 1.0 to 0 and back when unboarded, so the sim's window pull follows the boards. The map builds in under 1 ms, a `lightAt` query costs about 2 microseconds, and a full update plus render at night with the flashlight on is under half a millisecond.

- A tile behind a `blocksShots` prop relative to a lamp is darker than the same distance in the open.
- Zombie sight uses the map: standing just inside a shadow at night is meaningfully safer than a step into the light.
- Frame time stays flat with the map recomputed every sim tick and every frame while the flashlight is on.
- No caller of `lightAt` changed.

### Cost

Estimated at a day; it took an afternoon, because two planned pieces turned out unnecessary. The flashlight never needed to be in the map (exact evaluation at query time is cheaper and always agrees with the drawn beam), and the renderer needed no per-tile diamond drawing (one tiny image through the iso transform, smoothed by the browser).

### Testing note

When scripting a node transition in a test, move the player off the threshold tile before advancing time, or the door's re-arm guard sends them straight back.
