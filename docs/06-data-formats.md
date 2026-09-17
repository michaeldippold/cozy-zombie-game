> Additions since this was written: items may have `capacity` (a water container; its inventory, container, and floor entries carry `fill`, 0 to 100), `thirst`, and `verb`; props may have `"water": "sink"` to be a water source. See `20-thirst.md`.

# 06 — Data formats

All game content is JSON under `/data`. These shapes are the contract between data and code. Add fields freely, but do not rename or repurpose existing ones without updating this document.

## Node — `data/nodes/<id>.json`

```json
{
  "id": "house",
  "name": "House",
  "size": [10, 10],
  "floor": "wood",
  "floorOverrides": [
    { "tile": [3, 4], "sprite": "rug" }
  ],
  "walls": {
    "north": "wall_plain",
    "west": "wall_plain"
  },
  "props": [
    {
      "id": "fridge",
      "sprite": "fridge",
      "tile": [0, 2],
      "footprint": [1, 1],
      "solid": true,
      "blocksShots": true,
      "container": "fridge"
    },
    {
      "id": "sofa",
      "sprite": "sofa",
      "tile": [4, 8],
      "footprint": [3, 1],
      "solid": true,
      "blocksShots": false
    }
  ],
  "edges": [
    { "edge": "house-door", "side": "a" },
    { "edge": "house-window-1", "side": "a" }
  ],
  "spawns": {
    "player": [5, 5],
    "zombies": []
  },
  "items": [
    { "item": "plank", "tile": [6, 6] }
  ]
}
```

- `size` is `[width, height]` in tiles, max 12×12.
- `outdoor: true` and `zombieCap: n` mark nodes the trickle spawner may restock, and how far.
- `floorRects: [{ rect: [x, y, w, h], sprite }]` override floor sprites in bulk, for roads and paths.
- `walls.north` / `walls.west` may be a single sprite id or an array with one id per tile, so a street can be fence and then storefront.
- `wallDecor: [{ tile, wall, variant }]` draws a wall variant (`window`, usually) with no edge behind it. Upper-floor windows are exactly this.
- `data/world.json` lists the node files in load order, the edges file, and the starting node.
- Interiors may name `walls.south` and `walls.east`: these draw as low cutaway stubs, never full walls. Outdoor nodes leave them out.
- `lightsOn: true|false` is the room-light state of an interior. `switch: { tile, wall }` places the light switch on a near stub; by convention it is the tile beside the entrance.
- `wallDecor` entries may use `south` or `east` to put a decorative window on a stub.
- `floor` is the default floor sprite. `floorOverrides` replace single tiles.
- `walls` names the wall sprite for the north row and west column. Edge tiles along those walls are drawn from the edge object's state instead.
- `footprint` is `[w, h]` in tiles extending from `tile` in the +gx and +gy directions. The sprite definition must provide one frame per footprint tile. See below.
- `container` names a loot table in `loot.json`. Absent means not a container.
- `edges` lists which edges touch this node and which side of the edge this node is.
- Outdoor nodes use the same shape. A hedge or fence is a wall sprite. The house facade is a set of props and wall segments on the far edges.

## Edges — `data/edges.json`

```json
[
  {
    "id": "house-door",
    "kind": "door",
    "a": { "node": "house", "tile": [5, 0] },
    "b": { "node": "yard", "tile": [5, 11] },
    "inside": "a",
    "glass": null,
    "barricade": null
  },
  {
    "id": "house-window-1",
    "kind": "window",
    "a": { "node": "house", "tile": [2, 0] },
    "b": { "node": "yard", "tile": [2, 11] },
    "inside": "a",
    "glass": "intact",
    "barricade": null
  }
]
```

- `kind` is `door`, `window`, `stairs`, or `gate`.
- Traversal is derived from `kind`, `glass`, `barricade`, and `inside`. It is never authored.
- Each endpoint may carry `"wall": "north" | "west" | "south" | "east"` naming which room edge the door sits on. `north` and `west` are the far walls and get a doorway drawn in the wall sprite; `south` and `east` are the open near edges and get a visible outset pad. Defaults to `north`. The threshold tile is derived by stepping one tile outward from `tile` across that edge.
- `glass` is `"intact"`, `"broken"`, or `null` for kinds without glass.
- `barricade` is `null` or `{ "hp": 60 }`. Authoring a starting barricade is allowed.
- Endpoint tiles must be walkable tiles adjacent to the wall, not the wall tile itself. The wall segment sprite is drawn at the wall position implied by the endpoint tile.

## Sprites — `data/sprites/<id>.json`

```json
{
  "image": "assets/sprites/player.png",
  "anchor": [32, 60],
  "frames": {
    "idle_s_0": [0, 0, 64, 64],
    "walk_s_0": [64, 0, 64, 64],
    "walk_s_1": [128, 0, 64, 64]
  },
  "animations": {
    "idle": { "fps": 2, "loop": true, "frames": 2 },
    "walk": { "fps": 8, "loop": true, "frames": 4 },
    "attack": { "fps": 12, "loop": false, "frames": 4, "activeFrame": 2 },
    "hurt": { "fps": 12, "loop": false, "frames": 2 },
    "die": { "fps": 8, "loop": false, "frames": 4 }
  },
  "facings": ["s", "sw", "w", "nw", "n"],
  "mirror": { "se": "sw", "e": "w", "ne": "nw" }
}
```

- Frame names are `<animation>_<facing>_<index>`. The loader resolves them; code never builds the string.
- `anchor` is the feet point within a frame, in pixels from the frame's top-left.
- `activeFrame` on `attack` is the frame on which hit tests run.
- Static props use the same file with a single `idle` animation of one frame and no facings.
- **Per-tile furniture** provides frames named `idle_<i>` for `i` in footprint order (row-major, gx fastest). A 3×1 sofa has `idle_0`, `idle_1`, `idle_2`.
- `image` may be absent. Then `assets.js` generates a placeholder sheet from a `placeholder` block:

```json
{
  "placeholder": { "kind": "character", "color": "#7fb069", "height": 44 }
}
```

Placeholder kinds and their fields:

| Kind | Fields | Notes |
|---|---|---|
| `character` | `variant` (`player` or `zombie`), optional `palette`, `facings`, `mirror` | 48×72 frames, all five animations |
| `box` | `color`, `height`, optional `inset` | One frame per footprint tile |
| `post` | `color`, `height`, `width` | Trunk plus blob; declares tight `bounds` for occlusion |
| `flat` | `color`, optional `alt` | Two frames for a subtle checker |
| `wall` | `color`, `height`, optional `thickness` | Frames `north_<variant>_0` and `west_<variant>_0` for `plain`, `door`, `window`, `window_broken`, `boarded`, `door_boarded`, `cap` |

A sheet may declare `bounds: { x, y, w, h }` (relative to the frame) as its visible extent. Occlusion uses it instead of the full frame when present.

## Items — `data/items.json`

```json
[
  { "id": "bat",    "name": "Baseball bat", "kind": "weapon", "weight": 2, "damage": 25, "range": 1.2, "knockback": 0.6, "cooldown": 0.5 },
  { "id": "pistol", "name": "Pistol",       "kind": "weapon", "weight": 1.5, "damage": 60, "ammo": "ammo_9mm", "loudness": 12, "cooldown": 0.35 },
  { "id": "ammo_9mm", "name": "9mm rounds", "kind": "ammo", "weight": 0.05, "stack": 30 },
  { "id": "can_beans", "name": "Can of beans", "kind": "food", "weight": 0.5, "heal": 30, "hunger": 45 },
  { "id": "flashlight", "name": "Flashlight", "kind": "tool", "weight": 0.6, "beam": { "range": 6, "arc": 44 } },
  { "id": "plank",  "name": "Plank",        "kind": "material", "weight": 1.5, "barricadeHp": 60 }
]
```

## Loot — `data/loot.json`

```json
{
  "fridge":   { "rolls": [1, 3], "entries": [ { "item": "can_beans", "weight": 5 }, { "item": "nothing", "weight": 3 } ] },
  "cabinet":  { "rolls": [1, 2], "entries": [ { "item": "ammo_9mm", "count": [4, 10], "weight": 2 }, { "item": "plank", "weight": 2 }, { "item": "nothing", "weight": 4 } ] },
  "dresser":  { "rolls": [1, 2], "entries": [ { "item": "plank", "weight": 1 }, { "item": "nothing", "weight": 3 } ] }
}
```

Rolled once on first search. `nothing` is a valid entry so containers can be empty.

## Sim record — in memory only

```js
{
  id: "z3",
  node: "yard",
  tile: [8, 4],
  state: "idle",          // "idle" | "moving" | "attackingEdge"
  targetEdge: null,       // edge id or null
  timer: 0,               // seconds until arrival at targetEdge when moving
  hp: 100,
  aggro: false,           // was chasing the player when last seen
}
```

`tile` is the last known position. While off screen it is where the zombie is. When the player enters a node, idle records there materialize at their `tile`. Records that arrive through an edge materialize at the edge tile instead.
