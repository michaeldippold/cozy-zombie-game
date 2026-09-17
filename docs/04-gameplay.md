# 04 — Gameplay

## Player

- **Twin-stick.** WASD moves in screen-relative directions mapped to grid vectors. Mouse aims. Facing snaps to the nearest of 8 directions from the aim vector, not the movement vector. The aim origin is the chest, about 22 px above the feet.
- **Auto-walk.** Context-menu actions can walk the player to their target along a path. Keys always override.
- Float grid position. Collision against the node's walkability grid using a small circular footprint so the player slides along furniture rather than sticking.
- Health. Death shows a game-over overlay with a restart button. Restart reloads the world state from data.
- Walk speed is faster than zombie walk speed.
- **Hunger** drains continuously. Only food restores it. At zero the player starves: health drains steadily until they eat or die. See `docs/11-hunger-and-night.md`.

## Weapons

Two weapons. The player can hold both and switch with the number keys or scroll wheel.

### Bat (melee)

- Left click plays `attack` toward the facing.
- On the active frame, every zombie within range `r` and within ±60° of the aim vector in screen space takes damage and a short knockback along the aim vector.
- Small windup before the active frame. Cooldown after.
- Single swing. No combo.

### Pistol (hitscan)

- Left click plays `attack`, spends one ammo, and fires along the aim vector.
- **The hit test is in screen space.** The shot is a ray from the player's chest toward the cursor. Each zombie is a vertical body segment on screen, from feet to head, about 26 px wide. The nearest zombie the ray passes through is the candidate. If the cursor is on any part of a zombie's sprite, that zombie is hit. Casting in grid space from the feet was tried first and missed whenever the cursor was on the head, because a head pixel maps to a floor point well behind the zombie.
- The candidate must have a clear grid-space line of sight from the player (walls and props flagged `blocksShots`). Otherwise the shot stops at the wall.
- Emits a noise event.
- No ammo, no shot. Click gives a dry-fire feedback and no noise.

## Noise

Noise is an event: `{ node, tile, loudness }`.

- Zombies in the same node within `loudness` tiles aggro toward the noise tile, then toward the player once they see them.
- The sim reads the same event and adds to the `noise` weight of edges near the tile, biasing which edge adjacent-node zombies pick. See `02-world-model.md`.
- Gunshots are loud. Breaking glass is moderate. Melee and footsteps are silent in the demo.

## Light and being seen

See `docs/12-lighting.md`. Zombies see the player by the light on the player's tile: full range in daylight or a lamp pool, about a third of it unlit at night. A **flashlight** (F) casts a cone along the aim that stops at walls and trees; any zombie in the beam sees the player, full stop, and the light itself raises the neighbourhood's alarm at night. Carrying a lit torch also makes the player a visible point in the dark.

## Indoor light

See `docs/13-indoor-light.md`. Each interior has room lights, flipped at a switch that is always on the low wall beside the entrance and carries an LED visible in the dark. Lights on: the room is bright and its windows cast light outside, which draws zombies at night. Lights off: the room is as dark as the night outside, and you work by flashlight or by candles. A candle is placed from the inventory, lights the room around it, and is never visible through the windows.

## Zombies

Dumb on purpose. Any cleverness comes from distribution and persistence, not from the individual.

### In the player's node

- States: `idle`, `wander`, `chase`, `attack`, `hurt`, `die`.
- **Aggro** on line of sight within a sight range, or on noise within range. Line of sight is a ray against the shot-blocking grid. Sight range scales with the light on the player (`docs/12-lighting.md`); the flashlight beam is guaranteed sight.
- **Chase** uses grid A\* to the player's tile. Repath every 300 ms or when the player changes tile, not every frame. Move along the path at slow walk speed.
- **Attack** when within contact range. Small damage, ~1 s cooldown per zombie. No grab or lunge in the demo.
- Zombies are solid to each other loosely: a soft separation push so they do not stack on one tile, no hard collision.
- Zombies that reach an edge while chasing follow the player through it. See `02-world-model.md` for what happens next.

### Off screen

Records, per `02-world-model.md`. They only follow the player and attack edges. A small idle drift keeps them from being perfectly predictable.

### Health

Zombies have hp. The bat does moderate damage with knockback. The pistol does high damage. `hurt` interrupts the current action briefly. `die` plays once and leaves a corpse drawable that does not sort or collide.

## Interaction

**Right-click is the complete interface.** Right-click anything in the world and a menu lists every action available on it, Project Zomboid style. Everything the player can do to the environment is reachable this way, so new interactions are new menu entries, never new keys.

- Targets are whatever is under the cursor: floor items, containers (by footprint tile or sprite), doors and windows (by wall segment, room tile, or threshold), and bare walkable floor.
- Entries the player cannot do right now stay visible but disabled, with the reason: "(need a plank)", "(boarded up)".
- If the target is out of range, choosing an action **auto-walks** the player over along an A\* path and performs it on arrival. Any movement key cancels the walk. "Walk here" on bare floor is the same mechanism.
- Current entries: Pick up, Search / Open, Board up / Reinforce door or window (inside only), Remove boards (inside only, refunds every plank that went in, even if damaged), Go to Yard / House (walks onto the threshold), Walk here.

**`E` is a shortcut** for the nearest simple action within range: pick up or search. Nothing else. A DOM prompt near that target shows what `E` will do.

- **Containers** (fridge, cabinet, dresser): first search rolls a loot table and fills the container. Searching takes about 1 s with a progress bar in the prompt. Moving cancels. After the search, a container view opens beside the inventory panel.
- **Pickups** on the floor: instant.
- **Boarding** (right-click only): with a plank in inventory, boarding a door or window consumes the plank and adds barricade hp. Takes about 2 s with a progress bar. Only from the inside endpoint. A boarded door's threshold becomes unwalkable.

## Items and inventory

- Items have an id, name, weight, and a kind: `weapon`, `ammo`, `food`, `material`, `tool`, `light`. A `light` item carries `light: { radius }` and emits while it stands on the floor.
- Inventory is a weight-limited list. Over the limit, pickup is refused with a message.
- Actions per item: use, drop, equip. Weapons equip. Food is used to restore health. Ammo is used automatically by the pistol. Planks are used through the world interaction, not the panel.
- The inventory panel is a DOM panel toggled with `Tab`. When a container is open, its contents show beside the inventory with move buttons.
- The demo contains: bat, pistol, pistol ammo, one food item, a few planks.

## HUD

DOM, absolutely positioned over the canvas: a row of moodles (status icons for slow needs such as hunger, see `17-moodles.md`), health bar, stamina bar, equipped weapon name, ammo count, the current node name, and the clock label ("Day 3, 22:15").

## Day and night

A background clock cycles day to night and back over 12 real minutes. Night darkens the view and increases zombie activity, including a bias toward any of the player's own windows that are showing light. See `docs/11-hunger-and-night.md` for the mechanism.

## Game over and restart

Health at zero, from any cause (zombie contact or starvation): freeze the sim, show a cause-specific overlay, offer restart. Restart rebuilds the world from data files and resets the clock. No save or load.
