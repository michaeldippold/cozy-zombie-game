# 03 — Rendering

This is the part an engine would normally hide. It is about ten lines of math plus a sort.

## Isometric math

Tiles are 2:1 diamonds, 64×32 px. Grid coordinates are `(gx, gy)`, floats for entities and integers for tiles. `originX, originY` place the node on the canvas so that the whole diamond is centered.

```js
const TW = 64, TH = 32;

function toScreen(gx, gy) {
  return {
    x: (gx - gy) * (TW / 2) + originX,
    y: (gx + gy) * (TH / 2) + originY,
  };
}

function toGrid(sx, sy) {
  const x = sx - originX, y = sy - originY;
  return {
    gx: (x / (TW / 2) + y / (TH / 2)) / 2,
    gy: (y / (TH / 2) - x / (TW / 2)) / 2,
  };
}
```

`toScreen` returns the ground point of a position: the diamond center for a tile, or the point under an entity's feet for a float position. Every sprite's `anchor` is the pixel in its frame that lands on that ground point. Characters anchor at their feet, props and floor tiles at the tile center, wall segments at the vertex column of the tile they belong to.

## Directions

Movement happens in grid space. Screen directions map to grid vectors:

| Screen | Grid vector | Facing name |
|---|---|---|
| Up | (-1, -1) | `n` |
| Up-right | (0, -1) | `ne` |
| Right | (+1, -1) | `e` |
| Down-right | (+1, 0) | `se` |
| Down | (+1, +1) | `s` |
| Down-left | (0, +1) | `sw` |
| Left | (-1, +1) | `w` |
| Up-left | (-1, 0) | `nw` |

Normalize the vector before applying speed so diagonals are not faster. Screen-space speed will differ by direction because of the projection. That is expected and correct.

**Keyboard movement snaps to these eight grid directions.** W alone is `n`, W+D is `ne`, which walks straight along the north wall. Without this, diagonal keys would point 45° on screen and drift into walls, because the iso axes sit at about 27°.

**Aiming is done in screen space.** The mouse gives a screen vector from the player's screen position. Facing is the nearest of the eight screen directions. Melee arc tests compare screen-space angles to zombie feet positions. Hitscan converts the screen vector to a grid direction once and then steps in grid space.

## Draw order

Everything drawn is a **drawable** with a sort key. Sort ascending and draw in order.

```
key = (gx + gy) * 1000 + gz * 10 + tiebreak
```

- `gx + gy` is the depth. Higher is nearer the camera.
- `gz` is the stacking height for things on top of other things. Rarely used in the demo.
- `tiebreak` is a small value derived from screen y to stabilize sorts between equal-depth items.

Passes, in order:

1. Floor tiles. No sorting needed, draw back to front by row.
2. Far walls (the north and west edges of the room). These always sort behind everything, so they draw before the sorted pass. Edge sprites (door, window, boarded states) are wall pieces and draw here.
3. All sorted drawables: props, the player, zombies, dropped items.
4. Occlusion silhouettes (below).

Entities use their float `gx + gy`, so a character halfway across a tile sorts between the two tiles. This is correct and free.

## Per-tile furniture

**Multi-tile furniture is split into one drawable per tile.** A 1×3 sofa is three sprites, each anchored to its own tile with its own sort key. This is the only way a single sort key handles long furniture correctly, and it is what Habbo does.

Consequence for art: furniture sprite sheets must be authored as per-tile slices. A placeholder sofa is three 64 px wide slices, not one 192 px sprite. The node loader accepts a `footprint` on a prop and expects the sprite definition to provide one frame per footprint tile.

Tall single-tile props (trees, lamp posts, fridges) are one drawable with a tall sprite anchored at the tile's feet.

## Walls

Habbo convention: walls exist only on the far two edges (north row and west column in grid terms). There are no walls on the near edges, so nothing on the near side ever occludes the room. Wall segments are one sprite per tile along those edges. Doors and windows are wall segments with different sprites that read the edge object's state.

Walls have visible thickness: a lit top face a few pixels deep and an end cap at the near end of each wall. This is what makes the room read as a solid diorama instead of two planes. Wall sheets carry a `cap` variant drawn once per wall.

## Sprites

- Sprite sheets are a PNG plus a JSON description. See `06-data-formats.md`.
- Characters have animations `idle`, `walk`, `attack`, `hurt`, `die`, each with per-facing frames.
- The player has 8 facings. Five are drawn (`s`, `sw`, `w`, `nw`, `n`) and three are mirrored (`se` from `sw`, `e` from `w`, `ne` from `nw`). Mirroring is `ctx.scale(-1, 1)` around the anchor. Mirroring flips which hand holds a weapon. Accepted.
- Zombies have 4 facings (`s`, `w`, `n`, `e`), with `e` mirrored from `w`.
- Animation state is a `{ name, frame, elapsed }` record advanced at the fixed timestep.

### Placeholder characters

The demo does not wait for character art. At boot, `assets.js` generates placeholder sprite sheets into offscreen canvases: small blocky Habbo-proportioned figures, a distinct palette for the player and for zombies, all facings and animations. They are consumed through exactly the same PNG-plus-JSON interface as real art, so real art drops in by replacing files and touching no code.

Placeholder tiles and props are flat-colored diamonds and boxes generated the same way.

## Draw passes as built

The pass list above is the original four. With thresholds, stub walls, and lighting it is now, in order:

1. Floor tiles and door threshold pads.
2. Near-edge stub walls (interiors only): low, drawn under everything that follows.
3. Characters standing in a far-wall doorway, so the jambs frame them.
4. Far walls, with door, window, stairs, and boarded variants read from edge state.
5. All sorted drawables, with occluders faded.
6. X-ray silhouettes of occluded characters.
7. The night layer (`14-lighting-reference.md`).
8. Things that must show over the darkness: the flashlight's warm fill, lamp glows, lit window panes, candle flames, the switch LED.
9. Combat effects (tracers, swing arcs), from `main.js`.

## Occlusion

Tall props on the near side of a character will cover it. Rule: **fade the occluder and draw a silhouette. Both, not one.**

After sorting, for each character:

1. Find every drawable with a later sort key whose screen rectangle overlaps the character's screen rectangle.
2. If any, mark the character occluded and mark those drawables as occluders.

During the sorted draw pass, occluders draw at `globalAlpha = 0.4`. After the pass, each occluded character is drawn again as a flat-color silhouette: render the sprite frame to an offscreen canvas, fill with the silhouette color using `globalCompositeOperation = "source-in"`, then draw that on top.

Trees and lamp posts in the yard are the intended test case. Far walls never occlude by construction.
