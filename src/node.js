// One node: grid, walkability, shot blocking, props, entities. See docs/02 and docs/06.

import { createProp } from "./entities/prop.js";

// Build a node from the JSON shape in docs/06-data-formats.md.
export function loadNode(json) {
  const node = createNode({
    id: json.id,
    name: json.name || json.id,
    width: json.size[0],
    height: json.size[1],
  });
  node.floor = json.floor;
  for (const o of json.floorOverrides || []) {
    node.floorOverrides.set(`${o.tile[0]},${o.tile[1]}`, o.sprite);
  }
  node.walls = {
    north: json.walls?.north || null,
    west: json.walls?.west || null,
    // Near edges: low cutaway stubs, interiors only. See docs/13-indoor-light.md.
    south: json.walls?.south || null,
    east: json.walls?.east || null,
  };
  node.lightsOn = !!json.lightsOn;
  node.switch = json.switch ? { tile: [...json.switch.tile], wall: json.switch.wall || "south" } : null;
  node.wallDecor = json.wallDecor || [];
  node.outdoor = !!json.outdoor;
  node.zombieCap = json.zombieCap || 0;
  for (const r of json.floorRects || []) {
    const [x0, y0, w, h] = r.rect;
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) node.floorOverrides.set(`${x},${y}`, r.sprite);
  }
  node.spawns = json.spawns || node.spawns;
  node.edgeRefs = json.edges || [];
  node.items = (json.items || []).map((it) => ({ item: it.item, tile: [...it.tile], count: it.count || 1 }));
  for (const p of json.props || []) {
    const prop = createProp(p);
    node.props.push(prop);
  }
  rebuildGrids(node);
  return node;
}

// Recompute walkability and shot blocking from props. Call after props change.
export function rebuildGrids(node) {
  for (let y = 0; y < node.height; y++) {
    node.walkable[y].fill(true);
    node.blocksShots[y].fill(false);
  }
  for (const prop of node.props) {
    for (const [tx, ty] of prop.tiles) {
      setBlocked(node, tx, ty, { walk: prop.solid, shots: prop.blocksShots });
    }
  }
}

export function createNode({ id = "node", name = "", width, height }) {
  const walkable = [];
  const blocksShots = [];
  for (let y = 0; y < height; y++) {
    walkable.push(new Array(width).fill(true));
    blocksShots.push(new Array(width).fill(false));
  }
  return {
    id,
    name,
    width,
    height,
    walkable,
    blocksShots,
    props: [],
    entities: [],
    edgeRefs: [],
    thresholds: new Map(), // "gx,gy" -> edge ref, for door tiles outside the grid
    floor: "floor",
    floorOverrides: new Map(),
    walls: { north: null, west: null, south: null, east: null },
    lightsOn: false,
    switch: null,
    wallDecor: [],
    outdoor: false,
    zombieCap: 0,
    spawns: { player: [0, 0], zombies: [] },
    items: [],
  };
}

// Wall sprite id for segment `index` along a wall side. walls.north/west may be
// a single id or one id per tile.
export function wallSpriteAt(node, side, index) {
  const w = node.walls[side];
  if (!w) return null;
  if (Array.isArray(w)) return w[index] || null;
  return w;
}

export function inBounds(node, gx, gy) {
  return gx >= 0 && gy >= 0 && gx < node.width && gy < node.height;
}

// Door thresholds sit one tile outside the grid. They are walkable unless the
// edge is barricaded. world.js registers them after edges are resolved.
export function thresholdAt(node, gx, gy) {
  return node.thresholds.get(`${gx},${gy}`) || null;
}

export function isWalkable(node, gx, gy) {
  if (inBounds(node, gx, gy)) return node.walkable[gy][gx];
  const t = thresholdAt(node, gx, gy);
  return !!t && !t.edge.barricade;
}

export function blocksShot(node, gx, gy) {
  return !inBounds(node, gx, gy) || node.blocksShots[gy][gx];
}

export function setBlocked(node, gx, gy, { walk = true, shots = false } = {}) {
  if (!inBounds(node, gx, gy)) return;
  if (walk) node.walkable[gy][gx] = false;
  if (shots) node.blocksShots[gy][gx] = true;
}

// Circle at float (gx, gy) with radius r against blocked tiles.
// Returns true if the circle overlaps any non-walkable tile or leaves the grid.
export function circleBlocked(node, gx, gy, r) {
  const minX = Math.floor(gx - r + 0.5);
  const maxX = Math.floor(gx + r + 0.5);
  const minY = Math.floor(gy - r + 0.5);
  const maxY = Math.floor(gy + r + 0.5);
  for (let ty = minY; ty <= maxY; ty++) {
    for (let tx = minX; tx <= maxX; tx++) {
      if (isWalkable(node, tx, ty)) continue;
      // Tile square spans [tx - 0.5, tx + 0.5]. Closest point to the circle center:
      const cx = Math.max(tx - 0.5, Math.min(gx, tx + 0.5));
      const cy = Math.max(ty - 0.5, Math.min(gy, ty + 0.5));
      const dx = gx - cx;
      const dy = gy - cy;
      if (dx * dx + dy * dy < r * r) return true;
    }
  }
  return false;
}

// Move a circle by (dx, dy) with axis-separated resolution so it slides.
// If the circle is already inside something blocked (a tile that closed under
// it, for example a freshly boarded threshold), movement is unrestricted so it
// can walk out instead of being frozen.
export function moveCircle(node, gx, gy, r, dx, dy) {
  if (circleBlocked(node, gx, gy, r)) return { gx: gx + dx, gy: gy + dy };
  let nx = gx + dx;
  if (circleBlocked(node, nx, gy, r)) nx = gx;
  let ny = gy + dy;
  if (circleBlocked(node, nx, ny, r)) ny = gy;
  return { gx: nx, gy: ny };
}

// Nearest walkable tile to (gx, gy), searching in expanding rings.
export function nearestWalkable(node, gx, gy, occupied = () => false) {
  for (let ring = 0; ring < Math.max(node.width, node.height); ring++) {
    for (let dy = -ring; dy <= ring; dy++) {
      for (let dx = -ring; dx <= ring; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue;
        const tx = gx + dx;
        const ty = gy + dy;
        if (isWalkable(node, tx, ty) && !occupied(tx, ty)) return [tx, ty];
      }
    }
  }
  return null;
}
