// Light as a game quantity: how lit is a grid position, 0..1? Read by zombie
// sight, the sim, and the renderer. Static sources (lamps, lit windows) live in
// a cached per-node map with shadows; the flashlight is evaluated exactly at
// query time. See docs/12-lighting.md.

import * as iso from "./iso.js";
import * as clock from "./clock.js";
import { blocksShot } from "./node.js";
import { lineOfSight } from "./pathfind.js";
import { wallVariantAt } from "./world.js";

export const LAMP_RADIUS = 4.5; // tiles
export const WINDOW_RADIUS = 3.0; // tiles
export const MAP_RES = 2; // light cells per tile, so shadow edges are soft
export const MAP_PAD = MAP_RES; // one tile of replicated border for clean filtering
const CORE_GAIN = 1.4; // the inner part of a pool is fully lit before it falls off
export const FLASHLIGHT_SELF_LIGHT = 0.5; // holding a torch makes you a visible point
export const LIGHT_PROP_SPRITES = new Set(["lamp"]);
export const BEAM_RAYS = 28;
const BEAM_STEP = 0.15; // tiles per march step

export function ambientLight(node) {
  return node.outdoor ? clock.getBrightness() : 1;
}

// Static light sources of a node in grid space: [{ gx, gy, radius, kind }].
export function staticLights(node) {
  const out = [];
  for (const prop of node.props) {
    if (!LIGHT_PROP_SPRITES.has(prop.sprite)) continue;
    out.push({ gx: prop.tile[0], gy: prop.tile[1], radius: LAMP_RADIUS, kind: "lamp" });
  }
  for (let gx = 0; gx < node.width; gx++) {
    if (wallVariantAt(node, gx, 0, "north") === "window") out.push({ gx, gy: 0, radius: WINDOW_RADIUS, kind: "window" });
  }
  for (let gy = 0; gy < node.height; gy++) {
    if (wallVariantAt(node, 0, gy, "west") === "window") out.push({ gx: 0, gy, radius: WINDOW_RADIUS, kind: "window" });
  }
  return out;
}

export function beamOf(player) {
  return player && player.flashlightOn && player.beam ? player.beam : null;
}

// March one ray from the player along a screen-space angle, in grid space.
// Stops at the first tile that blocks shots (never the player's own tile) or
// at `range` tiles. Returns the grid endpoint.
export function castRay(node, player, angle, range) {
  const g = iso.screenDirToGrid(Math.cos(angle), Math.sin(angle));
  const d = iso.normalize(g.gx, g.gy);
  const startX = Math.round(player.gx);
  const startY = Math.round(player.gy);
  let x = player.gx;
  let y = player.gy;
  let t = 0;
  while (t < range) {
    const nx = x + d.x * BEAM_STEP;
    const ny = y + d.y * BEAM_STEP;
    const tx = Math.round(nx);
    const ty = Math.round(ny);
    if (!(tx === startX && ty === startY) && blocksShot(node, tx, ty)) break;
    x = nx;
    y = ny;
    t += BEAM_STEP;
  }
  return { gx: x, gy: y };
}

// The fan of ray endpoints that outlines the beam, in grid space.
export function beamRays(node, player, beam) {
  const base = Math.atan2(player.aim.sy, player.aim.sx);
  const half = ((beam.arc * Math.PI) / 180) / 2;
  const pts = [];
  for (let i = 0; i <= BEAM_RAYS; i++) {
    const a = base - half + (2 * half * i) / BEAM_RAYS;
    pts.push(castRay(node, player, a, beam.range));
  }
  return pts;
}

// Is a grid position inside the flashlight beam: within the screen-space arc,
// within range, with clear line of sight?
export function inBeam(node, player, gx, gy) {
  const beam = beamOf(player);
  if (!beam) return false;
  const d = Math.hypot(gx - player.gx, gy - player.gy);
  if (d > beam.range) return false;
  if (d < 0.5) return true;
  const p = iso.toScreen(player.gx, player.gy);
  const q = iso.toScreen(gx, gy);
  const vx = q.x - p.x;
  const vy = q.y - p.y;
  const ang = Math.abs(Math.atan2(player.aim.sx * vy - player.aim.sy * vx, player.aim.sx * vx + player.aim.sy * vy));
  if (ang > ((beam.arc * Math.PI) / 180) / 2) return false;
  return lineOfSight(node, player.gx, player.gy, gx, gy);
}

// ---- static light map ----

const staticCache = new Map(); // node id -> { sig, cw, ch, contrib, canvas }

function lightSignature(node) {
  return staticLights(node).map((l) => `${l.kind}:${l.gx},${l.gy}`).join("|");
}

// Is the straight path from a source to a point clear of shot-blocking tiles?
// The tile of the source and the tile of the target never block, so a tree is
// lit on its lit side and dark behind it.
function clearPath(node, ax, ay, bx, by) {
  const sx = Math.round(ax);
  const sy = Math.round(ay);
  const tx = Math.round(bx);
  const ty = Math.round(by);
  const steps = Math.ceil(Math.hypot(bx - ax, by - ay) * 4);
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const x = Math.round(ax + (bx - ax) * t);
    const y = Math.round(ay + (by - ay) * t);
    if ((x === sx && y === sy) || (x === tx && y === ty)) continue;
    if (blocksShot(node, x, y)) return false;
  }
  return true;
}

function cellToGrid(i) {
  return (i + 0.5) / MAP_RES - 0.5;
}

function buildStatic(node, sig) {
  const cw = node.width * MAP_RES;
  const ch = node.height * MAP_RES;
  const contrib = new Float32Array(cw * ch);
  const lights = staticLights(node);
  for (let j = 0; j < ch; j++) {
    const gy = cellToGrid(j);
    for (let i = 0; i < cw; i++) {
      const gx = cellToGrid(i);
      let c = 0;
      for (const l of lights) {
        const d = Math.hypot(gx - l.gx, gy - l.gy);
        if (d >= l.radius) continue;
        if (!clearPath(node, l.gx, l.gy, gx, gy)) continue;
        c += Math.min(1, CORE_GAIN * (1 - d / l.radius));
      }
      contrib[j * cw + i] = Math.min(1, c);
    }
  }

  // The same data as a tiny image: alpha = how much darkness to remove. The
  // renderer draws it through the iso transform with smoothing on.
  const w = cw + MAP_PAD * 2;
  const h = ch + MAP_PAD * 2;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  const img = ctx.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    const j = Math.max(0, Math.min(ch - 1, y - MAP_PAD));
    for (let x = 0; x < w; x++) {
      const i = Math.max(0, Math.min(cw - 1, x - MAP_PAD));
      const o = (y * w + x) * 4;
      img.data[o] = 255;
      img.data[o + 1] = 255;
      img.data[o + 2] = 255;
      img.data[o + 3] = Math.round(contrib[j * cw + i] * 255);
    }
  }
  ctx.putImageData(img, 0, 0);
  return { sig, cw, ch, contrib, canvas };
}

// Validate (and rebuild if needed) the static map of a node. Cheap when unchanged.
export function getStatic(node) {
  if (!node.outdoor) return null;
  const sig = lightSignature(node);
  let entry = staticCache.get(node.id);
  if (!entry || entry.sig !== sig) {
    entry = buildStatic(node, sig);
    staticCache.set(node.id, entry);
  }
  return entry;
}

// Call once per logic step for the current node so a changed window rebuilds promptly.
export function update(node) {
  getStatic(node);
}

export function resetCache() {
  staticCache.clear();
}

// Bilinear sample of the static contribution at a grid position, 0..1.
export function staticContribAt(node, gx, gy) {
  const st = getStatic(node);
  if (!st) return 0;
  const { cw, ch, contrib } = st;
  const u = Math.max(0, Math.min(cw - 1, (gx + 0.5) * MAP_RES - 0.5));
  const v = Math.max(0, Math.min(ch - 1, (gy + 0.5) * MAP_RES - 0.5));
  const i0 = Math.floor(u);
  const j0 = Math.floor(v);
  const i1 = Math.min(cw - 1, i0 + 1);
  const j1 = Math.min(ch - 1, j0 + 1);
  const fu = u - i0;
  const fv = v - j0;
  const a = contrib[j0 * cw + i0] * (1 - fu) + contrib[j0 * cw + i1] * fu;
  const b = contrib[j1 * cw + i0] * (1 - fu) + contrib[j1 * cw + i1] * fu;
  return a * (1 - fv) + b * fv;
}

// The erase image and how it maps to the grid, for the renderer.
export function getRenderLayer(node) {
  const st = getStatic(node);
  return st ? { canvas: st.canvas, res: MAP_RES, pad: MAP_PAD } : null;
}

// Light level at a grid position, 0..1: ambient + static map + flashlight.
export function lightAt(node, gx, gy, player = null) {
  if (!node.outdoor) return 1;
  let l = clock.getBrightness() + staticContribAt(node, gx, gy);
  if (beamOf(player)) {
    if (Math.hypot(gx - player.gx, gy - player.gy) < 0.6) l += FLASHLIGHT_SELF_LIGHT;
    else if (inBeam(node, player, gx, gy)) l += 1;
  }
  return Math.min(1, l);
}
