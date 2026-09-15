# 11 — Milestone 13: Hunger and day/night

The neighbourhood proved the world holds together. This milestone gives the player a reason to leave the house: hunger, and a day/night cycle that makes staying in one lit room a real cost.

## Goals

1. Hunger drains continuously and only food fixes it. At zero it costs health, so starving is a real death, not a soft fail state.
2. A day/night clock runs in the background. Night visibly darkens the world and makes the player's own lit windows a stronger pull for nearby zombies, per `docs/00-vision.md` section 3.4: "light through windows at night" as an edge-assignment signal.
3. Neither system needs new controls. Eating is the existing "use" action on food in the inventory panel.

## Clock (`src/clock.js`)

A day is `DAY_LENGTH = 720` real seconds (12 minutes), split `day 0–45% · dusk 45–55% · night 55–90% · dawn 90–100%`. Brightness interpolates from 1.0 (day) to 0.22 (night) through dusk and dawn; it never reaches zero, because this is a cozy game and full black would fight the art. `nightFactor()` normalizes that to 0..1 for anything that should scale with darkness rather than read brightness directly.

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

## Rendering (`render.js`)

- A full-canvas wash (`rgba(18,16,46, 0.5 * nightFactor())`) draws last in `renderNode`, after occlusion, so it darkens the whole scene uniformly.
- Any wall segment drawn with the `window` variant (intact glass, not broken, not boarded) gets a soft warm radial glow behind it, scaled by `nightFactor()`. This is the visible half of the same signal the sim uses to pull zombies — the player sees the cause, not the number. It draws on whichever side of the edge is being rendered, so a lit house glows from the street too.

## Tuning notes

Numbers as shipped, see `docs/09-decisions.md` for the values and reasoning. The day length, hunger drain rate, and night pull multiplier are the ones most likely to need hands-on adjustment — they were chosen to be provably present in a short test, not tuned for feel.

## Acceptance

- Hunger drains to zero over ten minutes with no food, and starving drains health until game over with the correct overlay text.
- Eating restores both hunger and health per the item's fields, and reports "not hungry" only when both are full.
- The clock reaches night after nine real minutes and cycles back to day; the HUD label matches `getLabel()`.
- At night, the interior darkens and its intact windows show a warm glow, visible from both the inside and the yard side of the same edge.
- A yard zombie idling near the house is more likely to head for a window than during the day, without any pathing or per-zombie memory added.
