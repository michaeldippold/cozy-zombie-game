# 21 — Grid inventory

Milestone 23. Michael's ruling (2026-09-17): the inventory becomes a grid of cells and every item has a size in cells, replacing rows and a weight limit. Settled now, before much more loot exists. It is one package: a rewrite for the player and every container, plus the controls that make it pleasant: drag and drop (including between the bag and whatever is open), rotation, and a few shortcuts.

## Why

- It is a picture. "Full" is something you see, the same argument that made needs into moodles. "6.3 / 15" was the last spreadsheet number in the UI.
- Zomboid needs rows because it has thousands of items. This game will have dozens.
- Weight was only ever a cap; Michael does not want weight to slow you down, ever. A cap is what a grid is. **Weight is removed entirely.**
- Containers get character: a fridge is tall, a body is small. A bigger backpack is more rows or columns.

## Model

- A **bag** is `{ cols, rows, items }`. The player's inventory is a bag. Every container prop and every body is a bag (their `items` is an alias of `contents`).
- An **entry** is `{ id, count, x, y, rot }` plus any per-instance state (`fill`). `x, y` is the top-left cell. `rot` swaps width and height.
- An item definition has `size: [w, h]` and a `color`. Stackable items stack inside one entry up to `stack`.
- `src/grid.js` owns the rules and is pure: `sizeOf`, `fits`, `findSpot` (first fit, top to bottom, unrotated then rotated), `add` (tops up stacks, then places), `moveEntry` (within or between bags, merging onto a matching stack), `tidy` (repack, biggest first).
- Picking something up places it for you. If nothing fits: "No room in your bag."
- Rolled loot is placed the same way into its container. Anything that does not fit is not spawned.

## Sizes

Backpack **6×4**. Later backpacks are bigger grids.

| Item | Size | Notes |
|---|---|---|
| Baseball bat | 1×3 | |
| Pistol | 2×1 | |
| 9mm rounds | 1×1 | stacks to 30 |
| Plank | 1×4 | hauling planks is a real choice |
| Water bottle | 1×2 | |
| Flashlight | 1×2 | |
| Candle | 1×1 | stacks to 4 |
| Beans, chips, soda | 1×1 | |

| Container | Grid |
|---|---|
| Fridge | 4×6 |
| Cabinet, shop counter | 5×3 |
| Dresser | 4×4 |
| Shop shelf | 3×6 |
| Body | 3×3 |
| Your old self | the backpack they died with, laid out as it was |

Container grids live on the loot table (`"grid": [cols, rows]` in `loot.json`).

## Art

Solid blocks in a colour that makes sense for the item, with a short name when it fits and the full name on hover. Stack counts in the corner. The equipped weapon has a gold outline. **The water bottle fills with blue up to its level**, from the bottom when upright and from the left when on its side. Real icons come with real art.

## Controls

- **Drag** an item to move it: within a grid, between the bag and the open container in either direction, or **out of the panel onto the floor**. Cells under the item show green where it fits and red where it does not. Dropping on a matching stack tops it up. An invalid drop snaps back.
- **R**, right-click, or the wheel **rotates** while dragging.
- **Shift-click** or **double-click** sends an item to the other open grid, placed for you.
- **Right-click** an item for the same kind of menu the world uses: Equip, Eat or Drink, Toggle, Take or Store, Drop or Place, Rotate. This replaces the per-row buttons, so there is one way of acting on things everywhere.
- **Tidy** in each grid's header repacks it.
- Tab still opens and closes the bag. Containers still close when you walk away.

## What changes elsewhere

- `inventory.js` loses weight and `limit`; `addItem` places through the grid.
- Bodies and props get `cols` and `rows`. A former survivor's body keeps the layout of the backpack.
- Saves carry positions because entries are copied whole. `SAVE_VERSION` 4.
- Item `weight` is deleted from `items.json`.

## Acceptance

- Starter kit lands in the 6×4 bag without overlap. Picking up planks until full gives "No room in your bag." and leaves the rest on the floor.
- `fits` rejects overlap and out-of-bounds, including rotated; `findSpot` finds a rotated slot when only that fits.
- Drag within the bag, bag to fridge, fridge to bag, and onto the floor all work with real pointer events; rotating mid-drag works; an invalid drop leaves everything where it was.
- Ammo dropped on ammo merges up to 30.
- Two bottles at different levels are two blocks, each with its own blue level.
- Shift-click moves to the other grid. Tidy repacks with no overlap and nothing lost.
- Right-click menu: equip, eat, drink, drop all act on that entry.
- A container's rolled loot never overlaps and never exceeds its grid.
- Die, come back, search your old self: the layout is as you left it.
- Snapshot round trip is deep-equal with items in the bag, a container, a body, and on the floor.

## After first play (2026-09-17)

Michael: loves it, but too small. Cells went from 28 to 38 internal pixels, labels and counts to 11 px, and a stacked item puts its label at the top so the count has the bottom corner to itself.

## Results (2026-09-17)

Scripted in the browser and passed, with real pointer events for the panel. The starter kit placed without overlap; two more planks fit before "No room". `fits` rejected out-of-bounds and overlap; `findSpot` found a rotated slot for a bat in a 3x2 bag. 45 rounds became stacks of 30 and 15; dropping 5 onto 28 merged to 30 and left 3. Tidy kept every item and produced no overlap. 200 over-stuffed loot fills never overlapped or left the grid. A plank dragged from the bag into the fridge landed at 0,4. R mid-drag rotated the bat into row 3; a drop on occupied cells showed red and changed nothing; a drag outside the panel put the candle stack on the floor; shift-click took the soda; 8 rounds dragged onto 12 made 20. The bottle menu read "Drink (100%)" and drank 50. Equip worked from the menu and cleared when the pistol was stored. Place sets down one candle. A snapshot round trip with a custom layout, a filled fridge, a floor bottle, and a searched body was deep-equal. After death the former self kept a 6x4 grid that matched the backpack cell for cell.

As built beyond the scope above: items also carry `short`, a label for the block; candles got "Drop all" beside "Place".
