# 19 — Bodies are containers

Milestone 20. Michael's ruling (2026-09-17): a dead zombie does not spill its items on the floor. The body is a searchable container. This lets zombies have loot pools without every kill scattering items across the room.

It replaces the "drops everything where it falls" rule in `18-death-and-survivors.md`.

## Rules

- Any dead zombie can be searched: right-click the body, or `E` when it is the nearest simple action. Searching takes the same 1 s as furniture. After that the label reads "Open body".
- **Ordinary zombies** roll the `zombie` table in `data/loot.json` the first time they are searched, not when they die. Most bodies have nothing. Unsearched bodies cost nothing to store.
- **A former survivor** holds exactly the backpack they died with. It is labelled "your old self". Nothing is rolled.
- A body works like any container afterwards: Take and Store both work, so a body can hold things you leave on it.
- The panel closes when you walk away, as with furniture.

## Code

- `entities/zombie.js`: every zombie carries the container fields (`container`, `lootTable`, `searched`, `contents`, and a `tiles` getter for its current tile). They are only consulted once it is dead.
- `interact.js`: `containerActions` is shared by props and bodies. It rolls `lootTable || container`, and only if nothing is inside already. `actionsAt` and `nearestSimpleAction` take a `bodies` list.
- `main.js`: `bodies()` is the dead zombies in the room. The loot-drop handler is gone.
- `sim.js`: records carry `loot` (the contents, or null when empty) and `searched`. No save version bump: older version 2 saves simply have unsearched bodies.

## Results (2026-09-17)

Scripted in the browser and passed: killing a former self left nothing on the floor; its menu read "Search your old self"; after 1 s the panel showed the full starter kit under "Your old self"; taking the pistol moved it to the backpack. An ordinary body read "Search body", rolled the zombie table once (3 rounds), and then read "Open body". A snapshot round trip with both bodies was deep-equal and kept contents and searched flags.
