import { containerGrid } from "../items.js";

// Furniture, containers, trees. A prop occupies a footprint of tiles and
// contributes one drawable per tile. See docs/03-rendering.md.

export function createProp(def) {
  const [w, h] = def.footprint || [1, 1];
  const [ox, oy] = def.tile;
  const tiles = [];
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      tiles.push([ox + dx, oy + dy]);
    }
  }
  const [cols, rows] = def.container ? containerGrid(def.container) : [0, 0];
  return {
    kind: "prop",
    id: def.id,
    sprite: def.sprite,
    tile: [ox, oy],
    footprint: [w, h],
    tiles,
    solid: def.solid !== false,
    blocksShots: !!def.blocksShots,
    container: def.container || null,
    water: def.water || null, // name of a water source ("sink"), or null
    searched: false,
    contents: [],
    // A container is a grid bag (docs/21): `items` is the same list as `contents`.
    cols,
    rows,
    get items() {
      return this.contents;
    },
  };
}
