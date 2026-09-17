# 11 — Milestone 13: Hunger and day/night

The neighbourhood proved the world holds together. This milestone gives the player a reason to leave the house: hunger, and a day/night cycle that makes staying in one lit room a real cost.

## Goals

1. Hunger drains continuously and only food fixes it. At zero it costs health, so starving is a real death, not a soft fail state.
2. A day/night clock runs in the background. Night visibly darkens the world and makes the player's own lit windows a stronger pull for nearby zombies, per `docs/00-vision.md` section 3.4: "light through windows at night" as an edge-assignment signal.
3. Neither system needs new controls. Eating is the existing "use" action on food in the inventory panel.

## Clock (`src/clock.js`)

A day is `DAY_LENGTH = 720` real seconds (12 minutes). Phases are defined in real clock hours, Zomboid-style: full dark holds for the whole `23:00–06:00` window, with a one-hour taper into it from `22:00` and out of it by `07:00` so it isn't an instant switch. Brightness interpolates from 1.0 (day) to 0.22 (night) across those tapers; it never reaches zero, because this is a cozy game and full black would fight the art. `nightFactor()` normalizes that to 0..1 for anything that should scale with darkness rather than read brightness directly. New games start at `08:00`, not midnight — waking up mid-morning reads better than starting in the dark.

An earlier version defined the phase boundaries as fractions of the cycle (`0.45`, `0.55`, `0.90`) without checking what real hour those actually landed on — they worked out to roughly 10:48, 13:12, and 21:36, so "night" covered early afternoon through evening. Fixed by working in real hours directly; see the decision log.

The clock is its own module with no dependents feeding it — `main.js` calls `clock.reset()` on start and `clock.update(dt)` once per logic step. Everything else (`sim.js`, `render.js`, `ui/hud.js`) reads it directly, the same pattern `assets.js`'s sheet cache already uses. `getLabel()` gives the HUD its "Day 3, 22:15" line.

## Hunger (`entities/player.js`)

- `hunger` drains at a constant rate, `HUNGER_MAX / 600`: a full bar empties over ten minutes of continuous play regardless of what the player is doing.
- Food items carry a `hunger` field in `items.json` alongside `heal`. Eating (the existing panel `use` action) restores both.
- At zero hunger the player is `starving`: health drains at `STARVE_DAMAGE` per second, quietly — no hurt animation, this isn't an attack. A message fires once when starving begins.
- Game over now has a `cause`: `"zombie"` or `"starvation"`, each with its own overlay text. `main.js` checks for game over once per update step regardless of cause, rather than only from the zombie-hit event, so starvation death is caught the moment it happens.

## Night pull (`sim.js`)

Two changes, both reusing the hop-distance and alarm machinery from `docs/10-neighbourhood.md` rather than adding new state:

- The whole idle pick chance scales by `1 + NIGHT_PICK_MULT * nightFactor()`. Zombies are more restless after dark, uniformly, no new per-zombie state.
- A window edge that leads directly into the player's current node gets a flat weight bonus scaled by `nightFactor()`, on top of its normal weight. This is the "light through the window" signal: it only applies one hop out, because that is the only place the glow would be visible from.

## Rendering: darkness with a light-punch (`render.js`)

> **Superseded.** This section describes the first two night renderers. Interiors now darken, the decorative window glow is gone, and light comes from a shadowed map. The current design is in `14-lighting-reference.md`. Kept as history.

Night is not a flat wash. **Interiors are assumed lit** — the player's own lamps and candles — and never darken regardless of the clock; only nodes flagged `outdoor: true` get night treatment at all. This is what makes going inside a real reprieve rather than a cosmetic one.

For an outdoor node, `drawNightOverlay` builds the darkness on a cached offscreen canvas the size of the viewport:

1. Fill it with the night tint, `rgba(70,80,140, 0.9 * nightFactor())`, then partially erase a wide, weak, gradual pool around the player (their inherent night vision; see the decision log for why it must not look like a spotlight). The layer is later composited with `"multiply"`, so colours darken proportionally and stay readable instead of sinking into a black fog: at full night a far, unlit tile keeps roughly 35–60% of its brightness per channel, blue-shifted: faintly visible, never black. A first version used a plain 50% indigo alpha wash and read as pitch black between lights; Michael rejected that, see the decision log.
2. Switch to `globalCompositeOperation = "destination-out"` and fill a soft radial gradient (opaque center fading to transparent) at every **light source** — this erases a circle of darkness rather than drawing anything visible. `destination-out` can't erase more alpha than the wash has, so this needs no separate scaling by `nightFactor()`; during dusk, when the wash is thin, the same erase has proportionally less to remove.
3. Switch back to `source-over` and composite the whole layer onto the scene with one `drawImage` under `"multiply"`.
4. Draw a small warm additive pool at each lamp so lamplight reads as light, not merely as "less dark".

Light sources are gathered fresh each frame: every prop whose sprite id is in `LIGHT_PROP_SPRITES` (currently just `lamp`), and every wall segment drawn with the `window` variant (intact glass, not broken, not boarded) — the same one that gets the small decorative warm glow described below. A window's light-punch is registered on whichever side is being rendered, so a lit house carves a lit patch into the yard outside it too, not just a cosmetic glow on the glass.

This is a standard cheap 2D lighting trick: a handful of gradient fills and one extra `drawImage` per frame, no per-pixel math, no WebGL. It reuses exactly the radial-gradient technique already built for the decorative glow below, generalized from "draw a warm blob" to "erase the darkness in a circle."

Separately, any `window` variant still gets a small additive warm radial glow drawn directly on the glass (`drawWindowGlow`), regardless of indoor or outdoor — purely decorative, the visible cue that a window is "lit," distinct from the light-punch that actually changes visibility around it.

## Tuning notes

Numbers as shipped, see `docs/09-decisions.md` for the values and reasoning. The day length, hunger drain rate, and night pull multiplier are the ones most likely to need hands-on adjustment — they were chosen to be provably present in a short test, not tuned for feel.

## Acceptance

The lighting lines below describe the milestone as first shipped; see `14-lighting-reference.md` for current behaviour.

- Hunger drains to zero over ten minutes with no food, and starving drains health until game over with the correct overlay text.
- Eating restores both hunger and health per the item's fields, and reports "not hungry" only when both are full.
- The clock reaches night after nine real minutes and cycles back to day; the HUD label matches `getLabel()`.
- At night, outdoor nodes darken to near-black except lit circles around lamp posts and windows; interiors stay fully lit regardless of the clock.
- A window shows its decorative glow from both the inside and the yard side of the same edge, and carves a visible lit patch into whichever outdoor node is being rendered.
- A yard zombie idling near the house is more likely to head for a window than during the day, without any pathing or per-zombie memory added.
- 15:00 is full daylight. Full dark holds for the entire 23:00–06:00 window and nowhere else.
