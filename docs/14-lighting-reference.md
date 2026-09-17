# 14 — Lighting reference (as built)

This is the single source of truth for how light works in the game today. Milestone docs `11`, `12`, and `13` record how it got here, including several versions that were replaced; where they disagree with this page, this page wins. Status: **done for now** (2026-09-17). Every number here was chosen by eye or to be provably present in a test, and is expected to be retuned.

## The idea in four sentences

Light is one number per position, 0 to 1, and everything reads it: what the player sees, what zombies see, and what the off-screen sim is drawn to. Night outdoors is dark but never black, and light sources carve real, shadowed pools into it. Indoors, light is a fact about the room: its switch, its openings, and any candles. A flashlight lets you see at the cost of being seen.

## One function

```js
light.lightAt(node, gx, gy, player)   // src/light.js
  = clamp( ambientLight(node)
         + staticContribAt(node, gx, gy)      // cached light map, with shadows
         + flashlight terms (beam, self-light) )
```

No caller computes light any other way. If you need light somewhere new, call this.

## Ambient: `ambientLight(node)`

| Node | Ambient |
|---|---|
| Outdoor | `clock.getBrightness()`: 1.0 by day, 0.22 at full night |
| Interior, lights on | 1.0, always |
| Interior, lights off | `0.22 + (0.88 − 0.22) × dayFactor × openness(node)` |

- The clock (`src/clock.js`): a 12-minute day. Full dark holds for 23:00–06:00 with a one-hour taper each side. New games start at 08:00. Brightness never drops below 0.22.
- **Openness** is how much daylight an unlit room's openings admit: 0.5 per unboarded window (intact or broken), 0.5 per unboarded doorway or gate, 0.5 per decorative window, clamped to 1; stairs admit none. Board everything and a room at noon is exactly as dark as midnight.
- The 0.88 cap makes a window-lit room slightly dimmer than a lamp-lit one, which is the light switch's visible feedback by day.
- `darknessOf(node)` = how much night the renderer draws = `(1 − ambient) / (1 − 0.22)`.

## Static sources and the light map

`staticLights(node)` lists a node's sources:

- **Outdoors:** lamp-post props (sprite id in `LIGHT_PROP_SPRITES`), radius 3 tiles; and windows on the far walls whose **room behind them has its lights on**, radius 3 tiles. Boarded windows emit nothing; broken ones still do. Decorative windows have no room and never emit.
- **Indoors:** candles standing on the floor (any floor item whose definition has `light: { radius }`), radius 3.2. Indoor lamp props are furniture; the room light is the switch.

`getStatic(node)` bakes these into a cached map at 2 cells per tile. For each cell, each source adds `min(1, 1.4 × (1 − d / radius))` if the straight path from source to cell is clear of shot-blocking tiles; the source's and the target's own tiles never block, so a tree is lit on its lit side and dark behind. The cache key is the node's light signature (which sources, where), so flipping a switch, boarding or breaking a window, or moving a candle rebuilds exactly the maps that changed. `light.update(node)` validates the current node's map once per logic step. Building a map takes under a millisecond; a `lightAt` query about two microseconds.

## The flashlight

- Item `flashlight`, kind `tool`, `beam: { range: 6, arc: 44 }`. **F** toggles it; the inventory row has a button; losing the last one switches it off. One in the starting kit.
- The beam is a cone from the chest along the aim vector. Angle is measured in screen space (it is what the hand aims); reach is marched in grid space (it is what walls are made of). `beamRays` fans 28 rays that stop at shot-blocking tiles; `inBeam` is the same test for one point.
- It is **not** in the light map. It is evaluated exactly at query time, so the drawn beam, the sight test, and the light value always agree.
- In `lightAt`: +1 inside the beam, +0.5 on the carrier's own tile. Holding a lit torch makes you a visible point in the dark.
- No battery. Parked by Michael as fiddly for the current game.

## Who reads light

- **Zombie sight** (`entities/zombie.js`): range = `6 × (0.35 + 0.65 × lightAt(player position))`, plus line of sight. Unlit at night, about 2 tiles; in a lamp pool or daylight, 6. A zombie inside the flashlight beam sees the player, full stop.
- **Off-screen sim** (`sim.js`): at night, a window edge leading into the player's node gets extra weight scaled by the real static light on that window's outdoor tile. Lights off or window boarded: no glow, no pull. Separately, a flashlight on outdoors at night adds alarm to the current node each sim tick (`main.js`).
- **Health bars, x-ray silhouettes, and occluder fade** for zombies (`render.js`): shown only if the zombie's tile is lit (≥ 0.45) or it is within 3 tiles of the player. Otherwise the dark would give zombies away.

## How it is drawn (`render.js`, `drawNightOverlay`)

One offscreen layer per frame, composited over the finished scene with `multiply` so colours darken proportionally:

1. Fill with the night tint, `rgb(30, 35, 82)` at alpha `0.96 × darknessOf(node)`. Far unlit ground keeps roughly 15–35% of its brightness: faintly visible, never black.
2. Erase (`destination-out`) the **player's night vision**: a wide, weak pool, 190 px, 42% at the centre, long falloff. Visual only. Deliberately too soft to read as a spotlight.
3. Erase the **static light map**: the cached map as a tiny image, alpha = darkness to remove, drawn through the isometric transform with image smoothing, clipped to the floor diamond. The browser's filtering gives smooth pools and soft shadow edges.
4. Erase the **flashlight beam**: the ray-cast polygon with a chest-to-range gradient, clipped to the floor.
5. Composite, then draw on top of the darkness: a warm fill in the beam, a warm glow at outdoor lamps, **lit window panes** (outdoors, for windows whose room is lit), **candle flames**, and the **switch LED** (orange off, green on).

Interiors use the same path whenever `darknessOf` is above zero. A lit room draws no night layer at all.

## Walls, openings, and the switch

- Far walls (north, west) are full height. **Interiors also have low cutaway stub walls on the near edges** (south, east): doors are gaps, windows are short frames, and the switch plate sits on the stub.
- **Coherence rule:** every opening of a building sits on the same edge inside as the wall it occupies outside, in the same order. Together with the momentum rule in `02-world-model.md`.
- **The light switch** is always on the stub beside the entrance and carries an always-visible LED. It is a simple action: `E` when nearest, or the right-click menu.
- **Candles** are placed by dropping them ("Place" in the inventory) and never light windows. Candlelight is the stealthy option; room lights are the visible one.

## Debug aids

- `]` skips the clock forward one hour.
- `__game.setHour(h)`, `__game.setNightTint("r, g, b", alpha)` from the console.
- `POST /__screenshot/<name>.png` to the dev server saves a canvas capture into `screenshots/` (gitignored).
- The debug corner shows the phase, brightness, and `light@player`.

## Tunables

All in `09-decisions.md`. The ones most worth a second look: the night tint (chosen between two adjacent steps by Michael, explicitly not settled law), the player night-vision pool, lamp and window radii, sight's dark fraction (0.35), and the unlit-room cap (0.88).

## Parked ideas

- Flashlight battery and candle burn time.
- Daylight pooled on the floor by each window instead of uniform across the room.
- A neighbourhood power cut after some days.
- Peeking through a window, using the interior's light map.
- Lighting wall faces from the map (today the map covers the floor only).

## History, briefly

Flat uniform wash (M13) → dark wash with circles erased at lights, rejected as pitch black → multiply "moonlight" tint, too readable → darker tint plus player night vision, tuned by eye over three steps → per-tile map with shadows (M15) → room lights, coherent windows, candles, daylight through openings (M16). Proposed and rejected along the way: not drawing zombies on unlit tiles (it reads as spawning).
