# 16 — Project Zomboid's systems, and which belong here

Written 2026-09-17 at Michael's request. This is a menu with opinions, not a plan. Nothing in it is built or scheduled. Rulings happen in `09-decisions.md` when Michael picks from it.

The factual inventory comes from a research pass over PZwiki and The Indie Stone's Build 42.20 notes (Build 42 went stable in July 2026). A few specifics in that research were from memory, not a page, so treat exact Zomboid numbers here as approximate. They do not matter much: we are borrowing shapes, not values.

## The test each system has to pass

From `00-vision.md`: a cozy Habbo-style diorama that gets invaded. Four questions, in order.

1. **Does it make the home matter more?** The home is the thing the zombies threaten. Systems that give you reasons to build it up, stay in it, or defend it are the best fit.
2. **Does it work in small rooms seen from a fixed angle?** Nodes are at most 12×12 and you always see the whole room. Systems built on large maps, vision cones, or long travel do not transfer.
3. **Is it one rule or one meter?** Zomboid's depth comes from dozens of interlocking simulations. Ours should come from a few simple rules that collide. If a system needs a body map or a spreadsheet, it is out or cut down to one number.
4. **Can you see it?** Every state we take is visible on screen. *(Amended the same day by Michael's ruling: fast states are bars, slow needs are Zomboid-style moodles with the exact number hidden. See `17-moodles.md`.)*

Already ruled out by Michael: calories and macros, drivable cars, skill books and XP multipliers. Parked: flashlight battery, candle burn time.

## What we already have from Zomboid's list

Hunger and starvation. Stamina that melee spends. Noise as the cost of useful actions, read by an off-screen zombie simulation. Plank barricades with per-plank removal and refund. Light that attracts zombies through windows, light switches, a flashlight, candles. Trickle respawn so no area stays clear. One life, and death deletes the save.

That last one needs a second look. See "One open question" at the bottom.

## Build next: my recommended order

### 1. Furniture you can pick up, move, and rotate

**Zomboid:** nearly every object is movable, gated by tools, skill, break chance, and weight. Multi-tile pieces split into parts that can be lost.

**Take: yes, first, and much friendlier than Zomboid's.** This is the Habbo half of the pitch and the game has none of it yet. Drop the tools, the skill checks, and the break chance; those exist in Zomboid to make moving a fridge a project, and here rearranging the room should be a pleasure.

Suggested shape:

- Right-click a piece, "Pick up". You carry one piece at a time, in both hands: no weapon, no sprint. That is the whole cost, and it is a good one. Carrying a sofa home across the street at dusk is exactly this game.
- A ghost preview on the hovered tile, green or red. Rotate with a key or the wheel. Click to place.
- Containers keep their contents. Beds stay beds, lamps stay lamps and light the new spot.
- Furniture blocks paths, for zombies too. A dresser shoved in front of a door is a soft barricade that zombies have to break. That single rule connects decorating to defence.
- Decor as loot: rugs, paintings, plants, lamps, a radio. This is where loot variety pays off most (see 5).

The engine is ready for it. Furniture is already per-tile drawables, the walkable grid and the light map already rebuild, and the save format already stores per-node state, so placed furniture is one more list (with a version bump). The placeholder generator would need rotated variants.

### 2. Thirst and water

**Zomboid:** a thirst moodle; taps give unlimited water until an unannounced shutoff in the first month, after which each fixture holds a finite amount. Rain collectors, tainted water, boiling.

**Take: yes, in two steps.** Step one is a thirst bar under hunger, drinkable items, a sink you can drink from, and a bottle you can fill. Step two is the shutoff: on a random early day the taps sputter and each fixture has a small finite amount left. That turns water from a chore into a countdown, which is the interesting part. Pots left in the yard filling when it rains is a charming later addition, and only needs rain as a yes/no state rather than a weather system. Skip tainted water and boiling until there is cooking.

### 3. TV and radio

**Zomboid:** no speech audio. Lines of coloured text float above the device one at a time, on a fixed schedule tied to the calendar. News narrates the outbreak for about a week and then goes to static. An emergency radio band forecasts the weather, the helicopter, and the power cut, but only to players who found and tuned it. Volume is noise.

**Take: yes, and it is cheap.** A still TV sprite with a flickering frame, text floating over it, static when there is nothing on. The text is DOM positioned at a world point, like the prompt already is, so it respects the no-UI-in-canvas rule. It needs a line scheduler keyed to day and hour, and a script file.

It earns its place three ways. It is the cosiest object you can put in a living room. It tells the story of the outbreak without a single cutscene. And it is how the game forecasts its own events: "power crews are no longer responding" two days before the lights go out; "stay indoors tonight" before a horde night. Players who sit by the radio are rewarded, and a TV left on is noise and a lit room, so it costs what everything costs.

### 4. Sleep, and a Comfort rating for the room

**Zomboid:** a fatigue meter; sleep skips time; bed quality changes recovery; zombies may break in while you sleep, more likely with lights on and openings unbarricaded.

**Take: yes, and this is where decoration becomes a survival system.** Tiredness is one more bar. Sleeping in a bed skips time with the screen dimmed while the simulation keeps running. If something gets in, you wake up to it. That pays off every barricade and every light switch the game already has.

Then replace Zomboid's entire mood loop (boredom, stress, unhappiness, and the pills and magazines that feed it) with a single number owned by the room: **Comfort**. A bed, a rug, a lamp, a plant, a painting, intact windows, no corpses on the floor. High comfort means sleep restores more and hunger ticks slower while you are home. It gives the player a mechanical reason to do the thing the game is about, without asking them to manage a mood.

### 5. Loot variety

**Zomboid:** room type crossed with container type picks a weighted list. Zombies carry loot by outfit. Some rooms guarantee certain items.

**Take: yes, as a data pass alongside everything above, not a milestone of its own.** Our loot tables are keyed by container only. Key them by room type too (kitchen cabinet against garage cabinet), add junk with no use so that finds feel like finds, and let zombies drop a little. Each system above brings its own items: bottles, decor, a radio, bandages. Variety for its own sake is cheap; variety that feeds decoration is the point.

### 6. The power cut, and what it drags along

**Zomboid:** the grid dies on a random day in weeks two to four, forecast on the emergency band. Lights, fridges, ovens, and TVs stop. Fridges slow rot while powered. Generators restore power in a radius at the price of constant noise and fuel.

**Take: yes, after 3.** The cut is one timer, and our lighting system makes it land hard: every room light and streetlight goes out and candles and the flashlight become the game. Food spoilage becomes worth having at this point and not before: three states (fresh, stale, rotten), only for perishables, only ticking once the fridge is dead. A generator is a strong later addition, since "power, but loud" is the whole noise system in one object. This is also the natural moment to revisit the parked flashlight battery.

## Good fits, later

| System | Zomboid's version | Take |
|---|---|---|
| **Meta events** | Distant gunshots and a helicopter that drags zombies toward you | **Yes, nearly free.** The sim already has node alarm. A distant gunshot is one call that raises alarm on a random node. A forecast "horde night" is the helicopter without the helicopter. |
| **Curtains** | Block zombie sight in and light out | **Yes.** They plug straight into the light system and they are decor. Small. |
| **Weapon condition** | Everything degrades; repairs give diminishing returns | **Yes, simply.** One condition number per weapon, a visible bar, bats break. No repair recipes at first. Already on Michael's list. |
| **House alarms** | Hidden flag; opening a door sets off a huge noise | **Yes, sparingly.** One or two buildings. It is pure chaos on a plate, which is the vision. |
| **Cooking** | Heat sources, cook and burn timers, open-ended recipes | **One step only.** Put food on a stove or campfire, wait, get better food. No recipes. Gives the power cut and the campfire a job. |
| **Growing food** | Furrows, watering, diseases, seasons | **Adapt to planters.** A window box or a yard plot with three growth stages that needs water. It is cosy, it uses the water system, and it rewards staying home. No diseases, no seasons. |
| **Bleeding and bandages** | 17 body parts, wound types, dirty bandages, stitches, splints | **One status, not a body.** A hit can leave you bleeding (a visible icon, slow HP loss) until you use a bandage. Ripping a sheet into bandages is a nice reuse. Everything else stays out. |
| **Locked doors and keys** | Keys on zombies inside; windows forced or smashed | **Maybe.** A locked shop whose key is on a zombie nearby is a good small story. Do not make it a system. |
| **Crafting furniture** | Carpentry builds walls, floors, stairs, furniture | **Furniture only.** Rooms are fixed stage sets, so no walls or floors. Planks into a shelf or a crate fits decoration. After furniture moving exists. |
| **Outfits** | Over 100 clothing slots with protection, insulation, holes | **Cosmetic only, with real art.** Dressing your character is very Habbo. No stats. |
| **Occupations and traits** | Zero-sum point buy; a trait per system | **A handful, much later.** Pick one perk and one flaw at New game. Only once there are enough systems for them to bend. |
| **Found stories** | Hand-placed scenes: a barricaded safehouse, a party that ended badly | **Yes, as authoring.** Rooms are small and hand-made, which suits this perfectly. It is content rather than code. |

## Not for this game

| System | Why not |
|---|---|
| **Temperature, clothing insulation, seasons, a weather simulation** | The heaviest system in Zomboid and the least visible. Rain as a yes/no state is all we need, for ambience and for filling pots. |
| **The body-part injury model, fractures, burns, lodged glass, infection of wounds** | Fails the one-meter test outright. |
| **The Knox infection** | The hidden, always-fatal bite is the heart of Zomboid's dread, and it works there because a run is dozens of hours of accumulated skills. Here it would mean a coin flip quietly deleting the house you decorated. HP already makes zombies lethal. If it ever comes in, it should be treatable. Michael notes that moodles give a natural way to hint at it (a queasy icon that might be the bite), so this is a "not now", not a "never". |
| **Panic, stress, boredom, unhappiness, pain, drunkenness, pills** | Replaced wholesale by room Comfort (above). Panic could survive as presentation only: a heartbeat and a vignette when several zombies are close, with no stat penalty. |
| **Skills and XP** | Michael has left the door open, so not a hard no. But every Zomboid system leans on skill gates, and most of our "friendlier" versions above work by deleting them. I would hold off until something clearly needs them. |
| **Vision cone and hidden interiors** | The diorama view, where you see the whole room, is the identity of the game. Darkness already does the hiding. |
| **Sneaking as a stance** | Rooms are too small for stealth routes. Noise and light discipline already cover it. |
| **Firearm handling** (magazines, racking, jams, attachments) | The gun is fine as a loud emergency button. |
| **Foraging, fishing, trapping, animals** | Wilderness systems for a game with no wilderness. |
| **Wall and floor construction, sledgehammers, sheet ropes** | Nodes are authored stage sets and the facades are flats. Rebuilding them breaks the world model. |
| **Fire spread** | Burning down the player's decorated house is not the kind of chaos we want. |
| **Erosion, corpse sickness, hygiene, the in-game map, the liquid framework, the Build 42 crafting chains** | Scale or simulation depth that a seven-room neighbourhood does not need. |
| **Sandbox options** | Later, and only as two or three presets. It is the right home for "cosier" and "harsher". |

## Patterns worth stealing, more than any one system

- **The world decays on timers.** Water, then power, then the broadcasts stop. It gives a run a shape: an easy first few days, then a squeeze. Our day is 12 minutes, so the whole arc fits in a couple of sessions.
- **Finite, then renewable.** Taps, then rain pots. The grid, then a generator. Cans, then planters. Each convenience has a slower, home-made replacement, and every replacement is a thing you build at home.
- **Noise and light are the universal price.** We already do this. Every new object should cost one or the other: the TV, the generator, the alarm clock.
- **One object, many jobs.** A sheet is a curtain and a bandage. A campfire cooks and lights. A dresser is storage, decor, and a barricade. It keeps the item list short and the interactions rich.
- **Forecast through the radio.** Events are fairer and scarier when the player could have known.

~~Where we deliberately differ: Zomboid hides its numbers and we show ours.~~ Reversed by Michael the same day: slow needs are moodles (`17-moodles.md`), kept to a minimal set. Where "a thirst bar" or "one more bar" appears above, read "a moodle".

## One open question: what death does to the house

Milestone 17 shipped the simple rule, which was my choice and not Michael's: one life, and death deletes the save. Zomboid's actual rule is subtler. The *character* is gone; the *world* persists. You start a new survivor in the same world, your base is as you left it, and your old self is shambling around near where they died, carrying your things.

I think that version fits this game better than what I built, and better than it fits Zomboid. If decoration is a pillar, then deleting the house on death punishes exactly the investment we want players to make. Keeping the house while losing the character keeps death frightening, because a zombie got into your home, and gives the best possible first task for the new survivor: go home and deal with who you used to be.

It is a small change to the save code: on death, keep the world and the sim, reset the player and the inventory, and add one zombie record carrying the old inventory. I have not made it, because it reverses a rule I only just documented and it is Michael's call.
