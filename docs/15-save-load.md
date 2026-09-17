# 15 — Milestone 17: Save, load, and a start screen

Sessions now span in-game days, and a page refresh wipes everything. Also, the game drops a first-time player straight into a live world. This milestone fixes both.

Local only, on purpose. Michael: "Local is fine now, if the game is fun we'll set up real saves later." One slot, in the browser's `localStorage`.

## What is saved

Everything that makes the world *this* world, and nothing that is only about the current frame.

| Saved | Where it lives at runtime |
|---|---|
| Clock: total elapsed game seconds | `clock.js` |
| Player: node, position, facing, health, stamina, hunger, flashlight on/off | `entities/player.js` |
| Backpack: items and equipped weapon | `inventory.js` |
| Per node: floor items (including placed candles), room lights, each container's searched flag and contents | `node.js` |
| Per edge: glass state and hp, barricade (hp and plank count), noise and scent weights | `world.js` |
| Zombies: every off-screen record; every zombie in the current node, written as a record at its tile, including corpses | `sim.js` |
| Sim: per-node alarm, the trickle timer, the next spawn id | `sim.js` |

**Not saved:** animation state, cooldowns, paths, knockback, combat effects, an action in progress, an auto-walk, open panels and menus, the light-map cache (rebuilt from state). Loading drops you where you were, standing still.

Zombies in the player's node are saved as records and re-materialized on load, the same path a node transition uses. There is no second representation to keep in sync.

## Format

One JSON object under the key `cozy-zombie-save`:

```js
{
  version: 1,
  savedAt: 1789990000000,        // wall clock, for the "Continue" label
  clock: 12345.6,
  player: { node, gx, gy, facing, hp, stamina, hunger, flashlightOn },
  inv: { items: [{ id, count }], equipped },
  world: {
    edges: { "<edge id>": { glass, glassHp, barricade, noise, scent } },
    nodes: { "<node id>": { items, lightsOn, containers: { "<prop id>": { searched, contents } } } }
  },
  sim: { records: [...], alarm: { "<node id>": n }, trickleTimer, nextSpawnId }
}
```

- `version` is checked on load. A mismatch, malformed JSON, or an unknown node or edge id means the save is **discarded with a message**, never half-applied. Loading builds a fresh world first and then applies the snapshot inside a try/catch; on any error it falls back to a new game.
- Each module owns its own `serialize()` / `restore()`. `main.js` only assembles and applies the snapshot. Nothing outside a module knows its save shape.
- Bump `SAVE_VERSION` whenever a saved shape changes. There are no migrations yet; old saves are dropped.

## When it saves

- Every node transition.
- Every 60 seconds of game time.
- When the tab is hidden or closed (`visibilitychange`, `beforeunload`).
- "Save and quit to title" from the pause menu.
- Never while dead, and never before the player has started or continued a game.

## Death

Zomboid rules: **dying deletes the save.** The game-over screen offers a new game. This is the one real design call in the milestone; it matches the tone ("the systems stay serious") and is a one-line change if Michael prefers otherwise.

## Start screen and pause

- **Start screen** on every page load: title, one line of what the game is, the controls, and two buttons. **Continue** appears only if a valid save exists, labelled with its in-game day and time and the node name. **New game** warns that it overwrites when a save exists. The world is built and drawn behind the screen but the loop is paused, so nothing can hurt you until you press a button.
- **Pause menu** on `Escape` (when no context menu is open): Resume, or Save and quit to title. The loop is paused while it is open.

## Acceptance

- Round trip: build a messy world state (moved, damaged, hungry, flashlight on, items dropped and picked up, a container searched and partly emptied, a window broken, a door boarded twice, lights toggled in two buildings, a candle placed, a corpse, chasers mid-journey between nodes, non-zero alarm), snapshot it, load the snapshot, snapshot again: the two snapshots are deep-equal apart from `savedAt`.
- The same survives a real page reload through `localStorage` and the Continue button.
- A save with the wrong version, or corrupted JSON, is discarded cleanly and the start screen shows no Continue.
- Dying clears the save.
- No autosave happens on the start screen or after death.
- On first load with no save, the player cannot take damage until they press New game.

## Results (2026-09-17)

All six checks scripted in the browser and passed.

- Round trip deep-equal in the house (two planks on one window, the other window broken, lights off, a container searched and partly emptied, a candle on the floor, pistol equipped, ammo spent, hp 63, hunger 41.5, 23:37 at night, alarm raised on the street) and again on the street with five materialized zombies, one wounded and aggro. 15 records; the save is about 4.5 KB.
- The same state came back after a real page reload through the Continue button, which read "Day 1, 23:37 · Street".
- Version 99, corrupt JSON, and a save naming an unknown edge were each discarded; the last one fell back to a fresh game with a message.
- Death cleared the save; `saveGame()` refused afterwards; 61 s of further time wrote nothing.
- Before New game was pressed, 5 s of stepped time did no damage and no save was written.
- Escape pauses and resumes; Save and quit returns to the title with Continue present; Escape on the title does nothing.

As built, "New game warns about overwriting" is a line under the button rather than a confirmation dialog. After death the button is "New game", since there is no save to go back to.
