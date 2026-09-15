# 08 — Milestones

Build in this order. Every step runs in the browser and is visible. Each step has acceptance criteria. Do not start the next step until the current one meets them.

## 1. Canvas, loop, iso grid

Build `index.html`, `style.css`, `main.js`, `loop.js`, `iso.js`, `input.js`.

- A 960×540 canvas, integer-scaled to the window, pixelated.
- A 12×12 diamond grid drawn with placeholder floor tiles.
- Hovering highlights the tile under the mouse. Clicking logs its grid coordinate.
- Fixed timestep and rAF render are in place and a frame counter shows in a debug corner.

**Accept when:** the highlighted tile matches the mouse across the whole grid, including edges, at every window size.

## 2. Player movement

Add `entities/player.js`, a walkability grid in `node.js`, and the direction tables.

- A placeholder rectangle moves with WASD in grid space at constant speed in all 8 directions.
- Faces the mouse, snapped to 8 facings, shown as a small indicator.
- Slides along blocked tiles instead of sticking.

**Accept when:** walking diagonally along a wall feels smooth and the player never enters a blocked tile.

## 3. Node loader and draw order

Add the node JSON loader, `entities/prop.js`, `render.js` with the sorted pass, and `data/nodes/house.json`.

- The house loads from JSON: floor, far walls, props with placeholder boxes.
- Per-tile furniture (the sofa) renders as slices.
- The player walks behind and in front of furniture with correct sorting.

**Accept when:** the player can circle the table and the sofa and never pops in front of or behind them incorrectly.

## 4. Sprites and placeholder characters

Add `assets.js`, `sprites.js`, sprite JSON files, and placeholder generation.

- Player rectangle replaced by a generated placeholder character with idle and walk animations and 8 facings using mirroring.
- Props switch to generated placeholder sheets through the same interface.

**Accept when:** the pipeline would accept a real PNG plus JSON with no code changes, verified by dropping in one hand-made test sheet.

## 5. Zombies in-node

Add `entities/zombie.js`, `pathfind.js`, health, and `ui/overlay.js`.

- Three zombies spawn in the house temporarily.
- They idle, then chase on sight using A\*, repathing on an interval.
- Contact damage with cooldown. Health bar in a placeholder HUD. Death overlay and restart.

**Accept when:** zombies path around furniture, reach the player, and the game-over and restart flow works twice in a row without a reload.

## 6. Combat

Add `combat.js`, `events.js`, weapon switching, and `ui/hud.js`.

- Bat: windup, arc hit test, damage, knockback, cooldown.
- Pistol: hitscan, ammo, dry fire, noise event that aggroes zombies in the node.
- Zombie hurt and die animations. Corpses remain.

**Accept when:** the bat hits two zombies standing side by side in front of the player and misses one behind. A pistol shot stops at a wall and at the first zombie.

## 7. Second node and edges

Add `world.js`, `data/edges.json`, `data/nodes/yard.json`, and transitions.

- The yard loads. The door is one edge object rendered from both sides.
- Walking into the door tile transitions the player and the camera to the other node.
- Zombies in the left node dematerialize into records. Chasers get the door as their target. They materialize in the new node when their timer expires.

**Accept when:** running from three chasing zombies through the door into the house results in them arriving through the door one by one, and going back out finds any non-chasers where they were.

## 8. Off-screen sim and windows

Add `sim.js` edge assignment, window glass, barricades, and the plank interaction.

- Zombies in the yard pick edges by weighted random while the player is inside.
- Windows get their glass broken by attacks, then zombies climb in. They never exit via window.
- Gunfire inside biases assignment toward nearby edges.
- Boarding a door or window from inside with a plank adds barricade hp. Zombies attack barricades.

**Accept when:** barricading the door alone does not make the house safe, and a zombie coming through a window is visibly a different event from one coming through the door.

## 9. Interaction and inventory

Add `items.js`, `inventory.js`, `ui/prompt.js`, `ui/inventory-panel.js`, loot tables.

- Containers with search timer and loot rolled once.
- Floor pickups. Food restores health. Ammo stacks.
- Inventory panel with weight limit, use, drop, equip, and container side view.

**Accept when:** a full loop works: search the fridge, eat, pick up a plank, board a window, run out of ammo, find more.

## 10. Occlusion

Add fade and silhouette to `render.js`.

- Trees and the lamp post in the yard fade when a character is behind them.
- The occluded character draws as a flat silhouette on top.

**Accept when:** the player and a zombie behind the same tree are both visible as silhouettes and the tree is faded, and nothing fades when no one is behind it.

## 11. Polish

- Zombie spawns yard-only. Tune speeds, damage, cooldowns, edge weights.
- Restart flow from the overlay rebuilds everything.
- A couple of placeholder sounds if trivial.
- Update `09-decisions.md` with final tunables.

**Accept when:** the five proofs in `00-vision.md` can each be demonstrated in one sitting.
