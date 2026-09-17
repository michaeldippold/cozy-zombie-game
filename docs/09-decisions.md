# 09 — Decisions and open questions

A log of rulings, each with the reason. Add to the top. If a ruling is reversed, strike it and add the new one rather than editing history.

Rulings follow the tiebreaker in `00-vision.md`: what best serves a cozy Habbo-style diorama invaded by zombies.

## Decisions

### 2026-09-17 — Firearm complexity is at the sweet spot (Michael)

- Michael is very happy with guns as they are: you need rounds in your bag and pulling the trigger uses them. **No magazines to juggle, no manual reloading, no racking, no jams.** Do not add firearm handling detail without being asked. (Matches the "not for this game" verdict in `16`.)
- Inventory cells enlarged from 28 to 38 internal pixels after first play: the panel was too small to read, and stack counts collided with labels. Counts now sit under the label.

### 2026-09-17 — Grid inventory, and how furniture is carried (Michael's rulings)

- **The inventory is a grid and weight is gone.** Michael: rows suit Zomboid because it has endless items; a grid suits a game with dozens, is visual, makes drag and drop natural, and shows "full" without a number. He never wants weight to slow the player, so nothing is lost. Settled before more loot is added. Built as `21-grid-inventory.md`.
- **Drag and drop between the bag and whatever is open**, in both directions, with rotation. Right-click item menus replace row buttons, so acting on things works one way everywhere.
- **Art is solid coloured blocks** for now, with the water bottle filling blue to its level.
- **Furniture (for the coming milestone):** small pieces are grid items. **Any single large piece can be carried in both hands: no sprint, no fighting, and no other penalty.** If you are willing to waddle, you can carry anything carryable (not cars). Michael: this makes decorating fun and not a chore, and it is the payoff of dropping weight and Zomboid's complexity with it.
- Plank is 1x4 on purpose: hauling boards home is a choice. Tunable, like every size.

### 2026-09-17 — Thirst, and what is tabled (Michael's brief)

- **Water containers have a fill level, 0 to 100%**, not millilitres. Draw-down, consequences, refill points. Built as `20-thirst.md`.
- **Water and power shutoff are tabled.** Michael: wanted eventually, but they are long-game structure; the moment-to-moment game gets fleshed out first. Taps are infinite until then.
- **You drink by yourself** when thirst passes 60 and you are carrying water (my call, after Zomboid). Clicking a bottle on a timer is a chore; carrying and refilling water is the decision. So the thirst moodle means "out of water".
- **Thirst is faster than hunger** (7 minutes against 10) and bites in two steps: halved stamina regen when parched, then health loss at zero.
- **Order of work set by Michael:** thirst, then sleep, then furniture.

### 2026-09-17 — Bodies despawn after 48 in-game hours (Michael's ruling)

- Long enough to loot, short enough that nobody needs a "drag bodies outside" action. Off-screen only, so nothing vanishes while you watch. My addition: a former survivor's body is kept while it still holds anything, because deleting the player's backpack on a timer would undo the point of `18`.

### 2026-09-17 — Bodies are containers (Michael's ruling)

- **Dead zombies are searched, not spilled.** Michael: it lets zombies have loot pools without items cascading over the floor. Ordinary bodies roll the `zombie` table on first search; a former survivor's body holds their backpack.
- The starting `zombie` table is deliberately thin (7 in 13 rolls are nothing) so that killing is not a way to farm supplies. It is a tunable.

### 2026-09-17 — Death loses the character, not the world (Michael's ruling)

- **You turn, and someone new arrives.** Michael: mostly protection against losing a good world, and watching your character go green and wander off is a fun system. This reverses "death deletes the save" from earlier the same day, which was my call. With decoration as a pillar, deleting the house on death punished the investment we want.
- **Everyone turns, whatever killed them.** One rule. Starving at home still leaves something in the house.
- **The former self carries the whole backpack and drops it when killed.** The first job of the next survivor writes itself.
- **Later survivors start with a bat and a flashlight only**, so dying is never a way to mint a second pistol.
- **The new survivor arrives in the quietest node that is not where you died**, interiors included. Waking up in a stranger's bedroom is on tone.
- Only New world and New game delete a save now.

### 2026-09-17 — Moodles for slow needs (Michael's ruling)

- **Slow needs are moodles, not bars.** Michael: they are a perfect pictorial way to show status, and hiding the exact number adds a hint of immersion, the same reason Zomboid hides it. This overrides my line in `16` that every need gets a visible bar, and it replaces the hunger bar from milestone 13.
- **The set stays minimal.** Hunger, thirst, and tired at least. No food sickness, no temperature, no per-limb health, no clothing simulation.
- **Bars stay where you react within a second:** health, stamina, zombie HP. If you plan around it, it is a moodle.
- **Moodles leave the door open for an infection hint**, if infection is ever wanted. Nothing is decided.
- The debug corner still prints exact values. That is a testing aid, not part of the game.

### 2026-09-17 — Milestone 17, save and load

- **One local slot, autosave only, death deletes it.** Zomboid rules. A manual save you can reload after a bad night would turn the zombies into a puzzle to retry rather than a threat to live with, which undercuts the vision's "chaos and horror". Local only for now; real saves wait until the game has earned them.
- **A start screen on every load**, with the world drawn but frozen behind it. Michael's reason: nobody should be dropped straight into danger. It also carries the controls, which the game had nowhere to show.
- **A save that does not fit the world is thrown away whole**, never half-applied. Content will keep changing during development and a half-loaded world is worse than a new one. The version number is bumped whenever the snapshot shape changes.
- **Zombies in the room are saved as records** and re-materialized on load. Animations, cooldowns, paths, and in-progress actions are not saved; the cost is that a zombie mid-lunge is merely standing next to you after a reload.

### 2026-09-17 — Lighting called done for now

- Michael confirmed indoor darkness with boarded windows, candles, and the flashlight indoors all behave as expected, and called the lighting arc finished for now. `14-lighting-reference.md` is the as-built source of truth; docs 11 to 13 are history and are marked where they were superseded. Next priority, per Michael: other survival systems, before limiters like a flashlight battery.

### 2026-09-17 — Milestone 16, indoor light and coherent windows

- **Every opening sits on the same edge inside as the wall it occupies outside.** Michael found the starter house impossible: windows flanking the door outside, on the back wall inside. Boarding the "back" windows boarded the front. My fault: the momentum fix moved the door to the near edge and left the windows behind. The house is north of the yard, so its south wall is the facade; door and windows now share that edge in the same order. Same for the blue house (east edge) and the shop's decorative windows.
- **Near edges get a low cutaway stub wall, interiors only.** Habbo draws nothing there; The Sims draws stubs. A stub gives near-edge doors (a gap), windows (a short frame), and the light switch somewhere to live, never hides anything, and frames the room as a dollhouse.
- **Room lights are a boolean per interior.** On: the whole room is lit, its windows cast real light outside through the light map, and the sim pull follows. Off: ~~the room follows the clock~~ the room gets only the daylight its openings admit (amended the same day, see the daylight ruling below). The starter house starts on; everything else off.
- **A window glows only if the room behind it is lit.** The rounded fake glow is gone, at Michael's request. A lit window is a lit pane plus real light on the ground. Decorative windows have no room and never glow.
- **Candles light the room and never the windows.** A placed candle is a static source in the interior light map, shadows included. Window emission is driven only by the room-light boolean, so candlelight is the stealthy option.
- **The switch is always beside the entrance, with an LED.** Michael's worry: Zomboid's switches are already hard to find. Convention plus an always-visible LED (orange off, green on) drawn over the darkness. It is a simple action so E reaches it.
- **Indoor daylight depends on the openings.** Michael boarded both windows, turned the lights off at noon, and expected darkness; the room stayed bright because lights-off just followed the clock. Now an unlit room gets daylight in proportion to its unboarded windows and doorways, down to night-dark when sealed. Uniform across the room, by design, to match the room-light boolean. Unlit rooms cap at 0.88 so the switch has visible feedback by day.
- **Street lamps reach 3 tiles** (was 4.5). Michael: 4ish blocks was generous.
- **No flashlight battery or candle burn time yet.** Michael finds it fiddly for the current game and wants other survival systems first. Parked as a future idea in `13-indoor-light.md`.

### 2026-09-17 — Milestone 15, light map with shadows

- **Static light is a cached map; the flashlight is not in it.** Lamps and lit windows are baked per node at two cells per tile with line-of-sight shadows, rebuilt only when the set of sources changes (a window boarded or broken). The beam is evaluated exactly at query time. That keeps the drawn beam, the sight test, and the light value in agreement and avoids re-marching a cone every frame.
- **The map is also the picture.** One pixel per cell, alpha = darkness to remove, drawn through the isometric transform with image smoothing. Smooth pools and soft shadow edges with no per-pixel code and no blocky tiles. Clipped to the floor diamond so the padded border never lights the void.
- **Light lies on the floor; walls keep a small screen-space pool.** The map covers the ground plane only, so the glow on the wall face around a lit window stays a small screen-space erase. The player night-vision pool also stays screen-space: it is vision, not light.
- **The sim reads real light.** The night pull toward a window is scaled by the static light on that window tile outdoors. Board the window and both the glow and the pull go away.
- **Radii 4.5 (lamp) and 3.0 (window) tiles.** Large enough for shadows to read, small enough that a street with two lamps still has dark stretches.

### 2026-09-17 — Darker night with a personal visibility radius

- **The flashlight has to be needed, so the dark got darker, but never black.** With the moonlight tint at 55–80% brightness the torch was a decoration: Michael could see every corner without it. Far, unlit tiles now keep roughly 35–60% per channel: things out there are faintly visible, and light makes them meaningfully brighter.
- **Rejected: hiding zombies in the dark.** I proposed not drawing zombies on unlit tiles. Michael's objection stands: if the tree in the corner is visible but a zombie blips into existence when it reaches light, it reads as spawning, not as revealed. Everything in the dark dims together.
- **The player has inherent night vision: a wide, weak, gradual lift around them.** About three tiles, 42% of the darkness removed at the centre, long smooth falloff. Deliberately too weak and too soft-edged to read as a spotlight following you. Visual only; zombie sight does not use it.
- **Second pass, same day: darker again, and the dark stops giving zombies away.** Michael's target: not 100% certain whether the shape in the far corner is a tree or a zombie. Far unlit tiles now keep about 19–40% per channel. Three tells were removed for zombies that are neither lit (light ≥ 0.45 on their tile) nor within 3 tiles: the red health bar, the x-ray occlusion silhouette, and the fade of the prop they stand behind. All three were making a zombie in the dark easier to spot than one in daylight.
- **Locked in, for now: tint rgb(30,35,82) at 0.96.** Michael compared two adjacent steps side by side and picked the darker: the far corner is "genuinely dark but not completely unseeable", and dark enough that a flashlight makes sense. Explicitly not settled law. `__game.setNightTint(tint, alpha)` and the `]` clock-skip key exist so it can be re-judged in a minute whenever art, monitors, or the light map change the picture.
- **Per-tile lighting (milestone 15) inherits these levels.**

### 2026-09-17 — Milestone 14, flashlight and light-aware zombies

- **Light is one function.** `light.lightAt(node, gx, gy, player)` returns 0..1 and everything reads it: zombie sight, the sim's flashlight alarm, the debug line. Milestone 15 swaps its inside for a per-tile map without touching callers. Scoped in `docs/12-lighting.md` at Michael's request; he expects the map to pay for itself as the game grows.
- **Zombie sight scales with the light on the player, not on the zombie.** What matters is whether *you* are visible. Full dark and unlit gives about a third of the daylight range; a lamp pool or daylight gives all of it.
- **A zombie in the beam always sees you.** Michael: throwing a flashlight beam on a zombie should basically guarantee aggro. It does, subject only to line of sight, which the beam already respects.
- **Carrying a lit flashlight adds light to the player.** You can see, and you can be seen. Without this the torch would be free.
- **The beam is screen-space in angle, grid-space in reach.** Aim is a screen vector, walls are grid tiles. Rays fan across the screen arc, march in grid space, and stop at shot-blocking tiles, so the drawn beam and the sight test share one geometry and the beam stops at trees for free.
- **No battery yet.** A later limiter, alongside weapon degradation. One flashlight in the starting kit for now so it gets played with.

### 2026-09-17 — Night is moonlight, not fog

- **Unlit outdoors at night is a blue moonlight tint, never black.** The first light-punch version used a 50% indigo alpha wash over an already dark palette; Michael: "pitch black outside of lit places is definitely not going to work." Switched the night layer to a lighter tint composited with `multiply`, so colours darken proportionally and stay readable (an unlit tile keeps 55–80% per channel), widened the lit pools with a softer falloff, and added a warm additive glow at lamps. The mechanic (lamps and lit windows are meaningfully brighter) survives; the fog does not. Also matches the vision doc's "never fully black".

### 2026-09-15 — Night fixes and the light-punch

- **The day/night clock was wrong: it went dark at 3pm.** The phase boundaries were fractions of the cycle (0.45/0.55/0.90) chosen without checking what real hour they landed on — they worked out to roughly 10:48am, 1:12pm, and 9:36pm. Rewrote `clock.js` to define phases directly in real clock hours. Full dark now holds for exactly `23:00–06:00`, Zomboid-style, with a one-hour taper on each side so it isn't an instant cut. New games start at `08:00` instead of midnight, since waking up mid-morning is a better first moment than starting in the dark.
- ~~**Interiors never darken; only outdoor nodes do.**~~ *Reversed by milestone 16 (2026-09-17): interiors darken when their lights are off and their openings admit no daylight.* Original reasoning, kept for the record: Michael asked whether "lights matter" could be more than a flat overlay without a real lighting engine. The answer that didn't need new art: assume the player's own building is lit (lamps, candles), so night is entirely an outdoor problem. That alone makes "go inside" a real mechanical reprieve, not just cosmetic.
- **Darkness is drawn with a light-punch, not a flat wash.** The night layer is filled dark, then `destination-out` erases soft circles at each light source (lamp posts, lit windows) before compositing once onto the scene. This is a standard, cheap Canvas2D technique — gradient fills and one `drawImage`, no per-pixel lighting, no WebGL — and it reuses the exact radial-gradient code already written for the decorative window glow. The result: standing near a lamp or a lit window is visibly and meaningfully safer than the open dark, which is the actual gameplay payoff of "lights matter" without any new art or a lighting engine.
- **A window's light-punch registers on whichever side is currently rendered.** Since the edge is shared, this needed no new state — the existing per-side wall-variant check that already draws the glow just also pushes a light-source entry.

### 2026-09-14 — Milestone 13, hunger and night

- **Hunger and the day/night clock are the reason to leave the house.** Nothing before this forced the player outside; boarding up and waiting worked forever. A 10-minute hunger drain with finite, single-roll food (per the existing loot rule) makes exploring a requirement, not an option.
- **Starvation is a distinct death, not a soft penalty.** It drains health at a fixed rate once hunger hits zero and ends the game with its own overlay text, using the same `hp <= 0` gate as a zombie kill so there is one game-over path, not two.
- **The clock is a standalone module other systems read directly.** No event wiring, no dependency injection — `sim.js`, `render.js`, and `ui/hud.js` each import `clock.js` and call it, the same pattern `assets.js`'s sheet cache already uses. Simplest option, and nothing needs to react to a phase change, only to read the current one.
- **Night pull reuses hop distance and alarm rather than adding new zombie state.** The whole idle pick chance scales by a night multiplier, and windows leading into the player's own node get an extra weight scaled the same way. This is the vision doc's "light through windows at night" made literal, and it cost two lines in `pickEdge`, not a new system.
- **The window glow is drawn at runtime, not baked into the sprite sheet.** Placeholder wall sheets are generated once at boot; a glow that must track a continuously changing night factor has to be a separate draw call layered on top each frame.
- **Brightness never reaches full black.** This is a cozy game; a wash capped at 0.22 keeps the dollhouse visible at 2am.

### 2026-09-14 — Milestone 12, neighbourhood

- **Zombies never dry up for free.** Michael: clearing a node must not make it permanently safe before the player has earned that. Two mechanisms, both dumb: alarm from noise spreads across the graph and pulls idle zombies one hop at a time, and a trickle spawner restocks outdoor nodes at least two hops away up to a per-node cap. No zombie ever appears in view or next door.
- **Records route by hop distance, not paths.** A record only considers edges into nodes one hop closer to the player. Cheap, stateless, and it distributes across parallel routes on its own.
- **Nodes are not Euclidean.** Michael's observation: interiors and exteriors never share a canvas, so facades are stage flats and a big interior can hide behind a small front. Recorded as a rule in `02-world-model.md`.
- **Gates and stairs are doors with different pictures.** Same traversal rules, not boardable, thresholds like doors. No new special cases in the sim.
- **Upper-floor windows are `wallDecor`.** Decoration with no edge, which is the original window ruling made literal.

### 2026-09-14 — End of proof of concept

- **Melee swings cost stamina (12 of 100).** Michael: the bat must not be a free infinite zombie killer. A winded player can still swing, at half damage and knockback with 1.8× cooldown, rather than being locked out, because a hard lockout in a doorway would feel like a control failure. Weapon degradation is a later, complementary limiter.
- **Dev art stays.** It is better than serviceable; do not spend on real art yet.

### 2026-09-14 — After Michael's second play session

- **The two ends of a door sit on opposite screen sides.** Michael's sketch: entering from the yard is a walk up-right, so exiting the house must be a walk down-left, or the player's momentum after teleporting pushes them straight back into the door. The house door moved to the near south edge as a visible outset pad; the yard end stays in the facade. Rule recorded in `02-world-model.md` for future nodes.
- **Context-menu clicks were swallowed by the dismiss listener.** Fixed, and noted here because the scripted test called the entry's click directly and missed it. Menu tests should dispatch real mousedown events on entries.

### 2026-09-14 — After Michael's first play session

- **Right-click menus are the complete interaction interface; E is a shortcut for pick up and search only.** Michael wants the Zomboid property that one input can reach everything you can do to the environment, and menus scale to many actions where keys do not. Actions out of range auto-walk the player there first.
- **Gun hit test moved to screen space.** Casting from the feet in grid space missed whenever the cursor was on the zombie's head or just past it. Now: ray from the chest, zombie as a feet-to-head body segment on screen, nearest one wins, then a grid line-of-sight check for walls. Melee was already screen-space and felt right, so it is unchanged.
- **Doors are doorways with a threshold tile outside the wall.** Michael kept teleporting outside while trying to board the door. The crossing now requires walking into the doorway and reaching the threshold tile center. Boarding makes the threshold unwalkable. Windows stay flat panels so the two read differently. Note that true isometric projection means the neighbouring wall segment covers part of an outset tile, so the mat shows through the doorway opening rather than as a fully visible pad; revisit if it reads wrong in play.

### 2026-09-14 — Rulings made during the build

- **Keyboard movement snaps to the eight iso directions.** Diagonal keys walk along the room's axes instead of 45° on screen. Walking along a wall with W+D felt wrong otherwise. Mouse aim stays exact.
- **Sprint on Shift with a stamina bar.** Requested by Michael. 1.75× speed, drains 40/s while moving, regenerates 22/s, empties into a "winded" state until stamina is back above 20. Stamina is the first survival stat and sits under health in the HUD.
- **Walls have thickness.** Requested by Michael. A lit top face and end caps sell the diorama. Six pixels deep.
- **Zombies show a floating health bar.** Requested by Michael for readability of hits. Kept small and red. Whether it stays for the final tone is an open question.
- **Placeholder characters are 48×72 frames, feet at (24, 66).** Big head, short body. Zombies hold their arms out in the facing direction in every animation, which reads as "zombie" at a glance.
- **Interaction range is 1.15 tiles, nearest target wins, no facing cone.** Simpler and it felt fine. Edge endpoint tiles are both the transition trigger (within 0.35 tiles) and the boarding target, so boarding is done from a step back.
- **Edges re-arm after arrival.** The player must move 0.6 tiles off the arrival tile before the same edge can trigger again, so crossing does not bounce.
- **Records are removed when materialized.** A zombie is either an entity in the current node or a record in the sim, never both. Simpler than a live flag.
- **Corpses persist as dead records.** Leaving a node and returning finds the bodies where they fell.
- **Whole stacks move for stackables, one unit otherwise.** Ammo moves as a pile; planks and food move one at a time.
- **Dropped items merge into a pile on the tile.**
- **Dev server disables caching.** `serve.py` replaces plain `http.server` because Chrome served stale modules during development.
- **Only props with frames 64 px or taller can occlude.** Tables and sofas in front of a character are normal; trees, lamps, the fridge, and plants fade. Only the character's upper body counts for the overlap test.

### 2026-09-14 — Initial rulings from spec review

- **Tile size 64×32, internal canvas 960×540, integer display scaling.** A 12×12 node at 64×32 needs about 770 px width plus wall height, which does not fit 640×360. 960×540 fits and is 16:9. 64×32 reads better than 32×16 and matches most asset packs.
- **Multi-tile furniture is split into per-tile drawables.** A single sort key cannot correctly order a long single sprite against characters standing partly behind it. Per-tile slices are exactly what Habbo does and cost nothing but art discipline.
- **Edge state is `glass` plus `barricade`, not one `state` string.** A single string loses whether the glass is gone once boarded, and the spec's `intact | broken | boarded` cannot express "broken and boarded". Two fields make both zombies and rendering simpler.
- **Traversal is derived from kind and state, never authored per edge.** The original spec had a `traverse` block on each edge. Authoring it invites inconsistency. The rules table in `02-world-model.md` is the single source.
- **Windows are zombie-only, inward, ground floor, glass first.** This is the minimum surface that gives an interior a second entry so barricading the door is not a solved problem. Player never uses windows. Zombies never exit through them. Upper-floor windows are decoration, not edges. See the rationale in `02-world-model.md`.
- **Sim records carry a `tile`.** Without a position, the arrival timer has nothing to derive from and a returning player finds zombies nowhere. Records keep the last tile and timers are distance over speed.
- **Materializing onto an occupied tile spills to the nearest free neighbor.** Prevents stacking in doorways.
- **Aim and melee arc are computed in screen space.** The mouse is a screen vector and the swing should feel like it points where the cursor is. Hitscan converts to grid space once.
- **Props carry `blocksShots` separately from `solid`.** Low furniture blocks walking but not bullets. Walls and tall props block both.
- **Zombies repath on an interval, not per frame.** 300 ms or on player tile change.
- **Zombies only follow between nodes, plus a small idle drift.** No independent roaming in the demo. Drift keeps them from being perfectly predictable.
- **Zombie facings are 4, player facings are 8.** Nobody notices on a slow shambler. Halves the placeholder and art work.
- **Single melee swing, no combo.**
- **Placeholder characters, tiles, and props are generated at boot.** Character art is the biggest risk to the demo and this removes it. The interface is identical to real PNG plus JSON sheets.
- **Hand-written JSON nodes, Tiled later.** The loader takes an internal structure. A Tiled importer is a second function producing the same structure.
- **No panel system lifted from other projects.** A plain DOM panel is enough.
- **ES modules require a static server.** Double-clicking `index.html` will not work in Chrome. Documented in the README, accepted.

## Tunables

Values as of the end of milestone 11 (2026-09-14). Tuned only lightly; hands-on play should revisit these.

| Tunable | Value | Where |
|---|---|---|
| Backpack grid | 6x4 | `inventory.js` |
| Item sizes, container grids | see `21-grid-inventory.md` | `items.json`, `loot.json` |
| Thirst drain / parched threshold / parched regen / dehydration damage | 100 per 420 s / 15 / ×0.5 / 3 hp per s | `player.js` |
| Auto-drink threshold | thirst under 60 | `main.js` |
| Bottle capacity / soda / chips | 100 thirst / +35 / −8 | `items.json` |
| Body lifetime | 48 in-game hours (1440 s) | `sim.js` |
| Player walk speed | 3.0 tiles/s | `player.js` |
| Sprint multiplier / drain / regen / recover threshold | 1.75× / 40 per s / 22 per s / 20 | `player.js` |
| Player stamina | 100 | `player.js` |
| Zombie walk speed | 1.2 tiles/s | `zombie.js` |
| Zombie sight range | 6 tiles | `zombie.js` |
| Zombie contact range | 0.7 tiles | `zombie.js` |
| Zombie contact damage | 8 (was 10; three zombies killed a standing player in 3 s) | `zombie.js` |
| Zombie attack cooldown | 1.2 s (was 1.0) | `zombie.js` |
| Zombie hp | 100 | `zombie.js` |
| Zombie repath interval | 300 ms | `zombie.js` |
| Zombie separation radius | 0.55 tiles | `zombie.js` |
| Player hp | 100 | `player.js` |
| Bat damage / range / arc / knockback / cooldown | 34 (three hits kill) / 1.2 tiles / ±60° / 0.6 tiles / 0.5 s | `items.json` |
| Pistol damage / loudness / cooldown | 60 / 12 tiles / 0.35 s | `items.json` |
| Window glass hp | 40 | `world.js` |
| Plank barricade hp | 60 | `items.json` |
| Zombie edge attack damage per sim tick | 10 | `sim.js` |
| Sim tick | 1000 ms | `loop.js` |
| Idle record base chance to pick an edge per tick | 0.001 (was 0.05 with two nodes; at 0.004 a calm house still drew seven zombies in three minutes) | `sim.js` |
| Alarm: spread per hop / hops / decay per tick / pick divisor | 0.4 / 3 / 0.92 / 60 (at 20, two shots pulled twelve of fifteen zombies) | `sim.js` |
| Trickle: interval / min hops from player | 90 s / 2 | `sim.js` |
| Aggro record chance to pick an edge per tick | 1.0 | `sim.js` |
| Idle drift chance per tick | 0.05 | `sim.js` |
| Interaction range | 1.15 tiles | `interact.js` |
| Edge trigger / re-arm distance | 0.35 / 0.6 tiles | `main.js` |
| Container view auto-close distance | 1.6 tiles | `main.js` |
| Edge base weight: door / window intact / window broken | 3 / 1 / 2 | `sim.js` |
| Barricade weight multiplier | 0.5 | `sim.js` |
| Noise weight added per gunshot near edge | 4, decays 50% per tick | `sim.js` |
| Scent weight when player crosses edge | 3, decays 30% per tick | `sim.js` |
| Container search time | 1.0 s | `prompt.js` |
| Board time | 2.0 s | `prompt.js` |
| Inventory weight limit | 15 | `inventory.js` |
| Occluder alpha / silhouette alpha / occluder min frame height | 0.4 / 0.55 / 64 px | `render.js` |
| Day length | 720 s (12 min) real time per full cycle | `clock.js` |
| Day / dusk / night / dawn boundaries | day 07:00–22:00, dusk 22:00–23:00, night 23:00–06:00, dawn 06:00–07:00 (was fractions of the cycle that didn't map to sane hours) | `clock.js` |
| New game start time | 08:00 (was 00:00) | `clock.js` |
| Brightness: day / night | 1.0 / 0.22 (never full black) | `clock.js` |
| Night tint colour / alpha / blend | **rgb(30,35,82) / 0.96** × nightFactor / multiply, outdoor nodes only (chosen by eye 2026-09-17, revisitable). History: 50% indigo alpha wash (too black), rgb(120,135,200) at 0.85 (too readable), rgb(70,80,140) at 0.9 (still certain what was out there), rgb(38,44,95) at 0.95 (the runner-up) | `render.js` |
| Zombie bar / silhouette / occluder-fade visibility | only if light on its tile ≥ 0.45 or within 3 tiles of the player | `render.js` |
| Player night-vision pool radius / centre strength | 190 px / 0.42 of the darkness removed, long falloff | `render.js` |
| Screen-space wall pool at lit windows | 60 px (floor light comes from the map) | `render.js` |
| Lamp warm glow alpha / radius | 0.22 × nightFactor / 60% of the lamp punch radius | `render.js` |
| Light model: lamp / window radius (tiles) | 3.0 / 3.0 (lamps were 4.5; Michael asked for about 3) | `light.js` |
| Candle light radius | 3.2 tiles | `items.json` |
| Indoor daylight: per opening / cap when unlit | 0.5 openness each, saturating at 1 / 0.88 | `light.js` |
| Near-edge stub height / window frame height | 8 px / 26 px | `placeholders.js` |
| Light map resolution / core gain | 2 cells per tile / 1.4 (inner ~30% of a pool is fully lit) | `light.js` |
| Flashlight beam range / arc | 6 tiles / 44° | `items.json` |
| Flashlight self-light | +0.5 on the player's tile while on | `light.js` |
| Zombie sight in full dark, unlit | 35% of ZOMBIE_SIGHT (about 2 tiles) | `zombie.js` |
| Flashlight alarm | 1.2 × nightFactor per sim tick, outdoors, when nightFactor > 0.2 | `main.js` |
| Window glow radius / peak alpha (decorative only) | 20 px / 0.55 × nightFactor | `render.js` |
| Hunger max / drain | 100, full drain over 600 s (10 min) of continuous play | `entities/player.js` |
| Starvation damage | 3 hp/s while hunger is 0 | `entities/player.js` |
| Food hunger restore: beans / chips | 45 / 18 | `items.json` |
| Night pick-chance multiplier | up to 2.5× at full night (`1 + 1.5 × nightFactor`) | `sim.js` |
| Night window light bonus | up to 5 added weight at full night, only for windows into the player's own node | `sim.js` |

## Open questions

Decide during the build. Do not block on them.

- Should the pistol have a spread or be perfectly accurate? Default perfectly accurate.
- Should corpses block movement? Default no.
- Does breaking glass make a noise that aggroes zombies inside the house? Default yes, moderate loudness.
- Should the door be openable and closable, or always open? Default always open. Closing doors is a survival-layer feature.
- How does the player see that a window is broken from inside? Default a distinct wall sprite. Later, a sound and a flash.
- Should the HUD show the number of zombies in the current node? Default no for tone, yes in the debug corner.
