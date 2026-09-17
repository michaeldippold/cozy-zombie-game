# 18 — Death, turning, and the next survivor

Milestone 19. Michael's ruling (2026-09-17): dying loses the character, not the world. You watch your character turn green and wander off, and you can spawn back into the same world as someone new. It is mostly protection against losing a good world, and watching yourself turn is fun in its own right.

This replaces "death deletes the save" from `15-save-load.md`.

## The turn

1. Health reaches zero, from any cause. Control stops. Every zombie in the room loses interest and goes back to idling.
2. The character plays the fall animation and lies there (about 1.5 s).
3. They get back up green: the same clothes and hair, zombie skin, arms out. This is a real zombie in the simulation from this moment.
4. The world keeps running. Your former self wanders the room, and the death card fades in over a lighter backdrop than usual so you can watch.
5. The card offers **New survivor** (same world) and **New world** (start over).

Everyone turns, whatever killed them. One rule, and starving to death at home still leaves something waiting in the house.

## Your former self

- An ordinary zombie in every way (health, speed, senses, off-screen wandering between nodes), plus two things: it draws with the `zombie_survivor` sprite, and it **carries your whole backpack**.
- Killing it drops everything it carried on the floor where it falls.
- It is saved like any zombie. Its record has `former: true` and `loot: [{ id, count }]`.
- There can be several. Each death adds one.

## The next survivor

- Same world: clock, edges, barricades, room lights, containers, floor items, every zombie, all as they were.
- New character: full health, hunger, and stamina. Starts with **a bat and a flashlight** only. The pistol and everything else are on your former self; that is the point, and it stops death from being a way to duplicate a starter kit.
- Arrives in the node, other than the one you died in, with the **fewest zombies**; ties go to the one farthest from where you died. Interiors count, so you may wake up in the upstairs bedroom across the street. Placed on the node's player spawn if it has one, else the nearest free tile to its centre.
- A survivor counter goes up. The Continue button reads "Survivor 2 · Day 3, 22:15 · Street".

## Saving

- On death the game saves at once, with the former self already in the sim and `player.dead: true`. Closing the tab on the death card loses nothing.
- Continuing a save with `player.dead` goes straight to a new survivor.
- **New world** and the start screen's **New game** are now the only things that delete a save.
- `SAVE_VERSION` is 2 (records gained `former` and `loot`; the snapshot gained `survivor` and `player.dead`).

## Code

- `data/sprites/zombie_survivor.json`: the zombie placeholder with the player's clothes and hair.
- `entities/zombie.js`: `createZombie` takes `former`, `loot`, and `rising`. A `rise` state plays the fall animation backwards, then idles. `canSee` is false for a dead player.
- `sim.js`: `former` and `loot` carried through `dematerialize`, `serialize`, and `restore`.
- `main.js`: `checkGameOver(cause)` now starts the death sequence instead of ending the game; an afterlife update keeps the clock, the room's zombies, and the sim running while dead; `newSurvivor()`; loot drop on `zombieDied`.
- `ui/overlay.js`: death card with two buttons and the lighter backdrop.

## Acceptance

- Dying with a known inventory: within 3 s a `zombie_survivor` entity stands where the player fell, carrying exactly that inventory; the room's zombies are no longer aggro; the save exists and has `player.dead`.
- The former self wanders while the death card is up.
- New survivor: different node, full stats, bat and flashlight only, survivor 2, world state (a barricade, a dropped item, the clock) unchanged, not counted as game over.
- Going back and killing the former self drops the old inventory on the floor, and it can be picked up.
- Reloading the page on the death card and pressing Continue gives a new survivor in the same world.
- A save, reload, and Continue with a former self off-screen keeps its loot.
- New world gives a fresh world and survivor 1.

## Results (2026-09-17)

All seven checks scripted in the browser and passed. Died in the house with the starter kit: `former1` stood up on the player's tile in the `zombie_survivor` sprite holding all six stacks, wandered while the card was up, and the save had `player.dead`. New survivor arrived in the upstairs bedroom across the street as survivor 2 with a bat and a flashlight, with the clock, a barricade, and a dropped bag of chips unchanged. A snapshot round trip with the former self off-screen was deep-equal. Walking home and killing it dropped the full kit on its tile. Reloading on the death card and pressing Continue ("Survivor 3 · Day 1, 09:17 · a new arrival") produced a new survivor, and the save was rewritten as alive at once. New world reset to survivor 1 with no former selves.
