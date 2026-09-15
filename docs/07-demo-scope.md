# 07 — Demo scope

One set. Prove the loop, not the game.

## Nodes

### `house`

A single-room ground-floor interior, about 10×10 tiles.

- Far walls on the north and west.
- One **door** edge on the north wall to `yard`.
- Two **window** edges on the north wall to `yard`. Zombie-only, inward, glass must be broken first.
- Furniture: a fridge and a cabinet (containers), a dresser (container), a table, a sofa made of per-tile pieces, a couple of chairs. Enough to test sorting and sliding collision.
- One plank on the floor. Optionally a second in a container.
- The player starts here.

### `yard`

A small exterior, about 12×10 tiles.

- Hedge or fence along the far edges, drawn as wall sprites.
- The house facade along the north edge, made of wall segments. Its door and windows are the same edge objects as above, rendered from the yard side.
- Several trees and a lamp post placed where the player will walk behind them, to exercise fade and silhouette.
- Zombie spawns: 3 to 6 at start, scattered.

## Zombies

- Spawn only in `yard`. None inside at start.
- Wander idly. Aggro on sight or noise.
- Walk through the door into the house. Break a window and climb in. Never leave through a window.
- Persist across transitions. Run inside and the chasers keep coming.

## Player

- WASD, mouse aim, 8 facings.
- Bat and pistol.
- Health, contact damage, death overlay, restart.

## Interaction and inventory

- Three containers with loot tables.
- One food item type.
- Ammo pickups.
- Planks that board the door or a window from inside.
- A DOM inventory panel with use, drop, equip.

## Explicitly out of scope

- Thirst, fatigue, sleep, cooking, crafting, spoilage. Hunger and a day/night cycle were added in milestone 13; see `docs/11-hunger-and-night.md`.
- Multiple floors. More than two nodes.
- Save and load.
- Audio, beyond placeholder sounds. The demo synthesizes short WebAudio blips in `src/sfx.js` for shots, swings, hits, glass, pickups, and boarding. No audio files.
- Narrative of any kind.
- Peeking through windows. Escaping through windows.
- Day and night, lighting.
- Real art. Placeholders are the plan for the whole demo.
