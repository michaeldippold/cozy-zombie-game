# 13 — Milestone 16: Indoor light and coherent windows

Two problems Michael found by playing, solved together because they touch the same walls.

1. **Windows were impossible.** Outside, the starter house's windows flank the front door. Inside, the same two windows sat on the back wall, opposite the door. He only realised they were the same windows when boarding the "back" ones boarded the front. Cause: the door moved to the near edge for the momentum rule (`02-world-model.md`) and the windows stayed behind on the far wall.
2. **Interiors were always lit.** That was a shortcut. Now that light is a map (`12-lighting.md`), rooms can be dark, and whether a window glows can be a fact about the room behind it instead of a decoration.

## Near-edge stub walls (the Sims cutaway)

Habbo draws no walls on the near edges. We keep that spirit but add a **low stub wall** (about 8 px) along the near (south and east) edges of interiors, the way The Sims shows walls in cutaway view. It never hides anything, it frames the room as a dollhouse, and it gives near-edge openings somewhere to live:

- a **door** is a gap in the stub, with its threshold pad outside (unchanged);
- a **window** is a short frame standing on the stub, with glass, broken, and boarded variants;
- the **light switch** is a small plate on the stub.

Interiors list `south` and `east` wall sprites in their JSON; outdoor nodes do not, so yards and streets are unchanged. Stubs draw right after the floor, under props and characters.

### Coherence rule

**Every opening of a building sits on the same edge inside as the wall it occupies outside.** The starter house is north of the yard, so its south wall *is* the yard's facade: door and both windows on the house's south edge, in the same left-to-right order as on the facade. The blue house is west of the street, so its door and window are on its east edge, in the same order as on the street's west wall. Decorative shopfront windows follow the same rule. Upstairs decorative windows can stay on the far walls: they face the back and sides, which no outdoor node shows.

This composes with the momentum rule rather than fighting it: the door pair already sat on opposite screen sides; now the windows travel with their door.

## Room lights

- Each interior has `lightsOn` (boolean). The starter house starts on; everywhere else starts off.
- **On**: the whole room is fully lit, no shadows, regardless of the clock. Its intact or broken windows become real light sources in the outdoor node they face: light on the ground through the light map, and the sim's night pull toward that window (both already read the map, so this is free).
- **Off**: the room follows the clock. By day it is bright (daylight); at night it is as dark as outdoors, and the night layer, the player's night-vision pool, the flashlight, and zombie sight all work indoors exactly as they do outside.
- A window glows only if the room behind it is lit. The rounded fake glow is gone. A lit window is a lit pane (drawn over the darkness) plus real light from the map.
- Decorative windows have no room behind them and never glow.

## Daylight comes through the openings

Added the same day, after Michael boarded both windows, switched the lights off at noon, and expected darkness. He was right to: with the lights off a room was simply following the clock, as if it had no walls.

- With the lights off, a room's light is `floor + (cap - floor) x dayFactor x openness`. The floor is the clock's night brightness (0.22), so a sealed room at noon is exactly as dark as midnight.
- **Openness** is how much daylight the openings admit: 0.5 per unboarded window (intact or broken; a broken one is a hole), 0.5 per unboarded doorway or gate, 0.5 per decorative window, clamped to 1. Stairs admit none. Two windows and a door saturate it; the door alone gives half; board everything and it is 0.
- It is uniform across the room, like the room-light boolean, not pooled at the windows. Pools of daylight on the floor are a possible refinement; the light map could do it.
- **The cap is 0.88, not 1.** A room lit only through its windows sits slightly dimmer and cooler than one with its lamps on. This is the switch's daytime feedback: before it, flipping the lights at noon changed nothing on screen.
- Zombie sight, the night layer, the flashlight, and candles all read the same value, so a boarded-up house by day plays exactly like night: dark, hard to see in, hard to be seen in. Barricading now costs you your free light.

## Finding the switch

Zomboid's switches are hard to find, and ours would be worse. Two rules:

1. **Convention:** the switch is on the stub wall on the tile beside the entrance, in every interior. Step in and it is at your elbow.
2. **LED:** the plate carries a tiny light drawn on top of the darkness, orange when the room is off, green when on. It is the one thing in a dark room that is always visible.

Flipping it is a **simple action**: `E` when it is the nearest simple thing, and an entry in the right-click menu.

## Candles

- `candle`: an item with `light: { radius }`. Dropping it from the inventory (the button reads **Place**) stands it on the floor, lit. Pick it up to move it.
- A placed candle is a static source in that node's light map: a soft pool with shadows behind furniture that blocks shots.
- **Candles never light windows.** Window emission is driven only by `lightsOn`. A candle-lit room is dim, atmospheric, and invisible from the street, which is the point of choosing it.
- No burn time yet. Like the flashlight battery, that is a later limiter; Michael prefers other survival systems first.

## Light model changes (`light.js`)

- Ambient: outdoors, the clock. Indoors, 1 if `lightsOn`, else the clock.
- Static sources: outdoors, lamp posts and windows whose interior is lit. Indoors, placed candles. (Indoor lamp props are furniture; the room light is the boolean.)
- The cache signature includes which windows are lit and where candles stand, so flipping a switch, boarding a window, or moving a candle rebuilds the affected maps.
- `darknessOf(node)` tells the renderer how much night to draw: the night factor outdoors, the same indoors only when the lights are off.

## Acceptance

- In the starter house, the door pad and both windows are on the south edge; in the yard they are on the facade in the same order. Boarding the left window inside boards the left window outside.
- Zombies breaking in through a window arrive at that window's tile on the south edge.
- At night with lights on: the room is bright, the yard windows show lit panes and cast light on the grass, and the window tiles outside read lit in the light map. Lights off: panes dark, no light on the grass, map reads 0, room dark.
- In a dark room the switch LED is visible; `E` next to it toggles the lights.
- A placed candle lights its surroundings indoors at night, casts a shadow behind the fridge, and the yard-side window tiles stay at 0.
- Zombie sight indoors follows the same light rule as outdoors.
- Street lamps reach 3 tiles.
- At noon with the lights off: all openings clear reads 0.88 (slightly dim), both windows boarded reads about 0.55, everything boarded reads 0.22 and looks like night. Lights on reads 1 in every case.

## Future ideas, deliberately not now

- Flashlight battery and candle burn time (fiddly for the current game; other survival systems first).
- Power going out neighbourhood-wide after some days, which turns every `lightsOn` off and makes candles matter.
- Peeking through a window: the interior's light map is what you would see.
