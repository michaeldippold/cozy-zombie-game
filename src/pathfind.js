// Grid A* with 8-neighbor movement and no corner cutting. See docs/04-gameplay.md.
// Nodes are at most 12x12 so a plain array open list is fine.

import { isWalkable } from "./node.js";

const SQRT2 = Math.SQRT2;
const NEIGHBORS = [
  [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
  [1, 1, SQRT2], [1, -1, SQRT2], [-1, 1, SQRT2], [-1, -1, SQRT2],
];

function octile(ax, ay, bx, by) {
  const dx = Math.abs(ax - bx);
  const dy = Math.abs(ay - by);
  return Math.max(dx, dy) + (SQRT2 - 1) * Math.min(dx, dy);
}

// Returns an array of [gx, gy] tiles from start (exclusive) to goal (inclusive),
// or null if unreachable. `passable(gx, gy)` defaults to node walkability.
export function findPath(node, start, goal, passable = (x, y) => isWalkable(node, x, y)) {
  const [sx, sy] = start;
  const [gx, gy] = goal;
  if (sx === gx && sy === gy) return [];
  if (!passable(gx, gy)) return null;

  // Keys pack (x, y) into one integer. Door thresholds sit one tile outside
  // the grid, so offset by PAD to keep every coordinate non-negative; a
  // negative key would decode wrongly because % keeps the sign in JS.
  const PAD = 2;
  const w = node.width + PAD * 2;
  const key = (x, y) => (y + PAD) * w + (x + PAD);
  const unkey = (k) => [(k % w) - PAD, Math.floor(k / w) - PAD];
  const gScore = new Map();
  const cameFrom = new Map();
  const closed = new Set();
  const open = [{ x: sx, y: sy, f: octile(sx, sy, gx, gy) }];
  gScore.set(key(sx, sy), 0);

  while (open.length) {
    // Pop the lowest f.
    let bi = 0;
    for (let i = 1; i < open.length; i++) if (open[i].f < open[bi].f) bi = i;
    const cur = open[bi];
    open[bi] = open[open.length - 1];
    open.pop();
    const ck = key(cur.x, cur.y);
    if (closed.has(ck)) continue;
    closed.add(ck);

    if (cur.x === gx && cur.y === gy) {
      const path = [];
      let k = ck;
      while (cameFrom.has(k)) {
        path.push(unkey(k));
        k = cameFrom.get(k);
      }
      path.reverse();
      return path;
    }

    const g = gScore.get(ck);
    for (const [dx, dy, cost] of NEIGHBORS) {
      const nx = cur.x + dx;
      const ny = cur.y + dy;
      if (!passable(nx, ny)) continue;
      // No corner cutting: a diagonal step needs both orthogonal neighbors open.
      if (dx !== 0 && dy !== 0 && (!passable(cur.x + dx, cur.y) || !passable(cur.x, cur.y + dy))) continue;
      const nk = key(nx, ny);
      if (closed.has(nk)) continue;
      const ng = g + cost;
      if (ng < (gScore.get(nk) ?? Infinity)) {
        gScore.set(nk, ng);
        cameFrom.set(nk, ck);
        open.push({ x: nx, y: ny, f: ng + octile(nx, ny, gx, gy) });
      }
    }
  }
  return null;
}

// Bresenham-style line of sight across the shot-blocking grid.
export function lineOfSight(node, ax, ay, bx, by) {
  const steps = Math.ceil(Math.hypot(bx - ax, by - ay) * 4);
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const x = Math.round(ax + (bx - ax) * t);
    const y = Math.round(ay + (by - ay) * t);
    if (node.blocksShots[y]?.[x] ?? true) return false;
  }
  return true;
}
