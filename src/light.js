// Light as a game quantity: how lit is a grid position, 0..1? Read by zombie
// sight, the sim, and the renderer. Milestone 14 answers analytically from a
// short list of sources; milestone 15 will answer from a per-tile map with the
// same signature. See docs/12-lighting.md.

import * as iso from "./iso.js";
import * as clock from "./clock.js";
import { blocksShot } from "./node.js";
import { lineOfSight } from "./pathfind.js";
import { wallVariantAt } from "./world.js";

export const LAMP_RADIUS = 2.4; // tiles
export const WINDOW_RADIUS = 1.8; // tiles
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

// Light level at a grid position, 0..1.
export function lightAt(node, gx, gy, player = null) {
  if (!node.outdoor) return 1;
  let l = clock.getBrightness();
  for (const s of staticLights(node)) {
    const d = Math.hypot(gx - s.gx, gy - s.gy);
    if (d < s.radius) l += 1 - d / s.radius;
  }
  if (beamOf(player)) {
    if (Math.hypot(gx - player.gx, gy - player.gy) < 0.6) l += FLASHLIGHT_SELF_LIGHT;
    else if (inBeam(node, player, gx, gy)) l += 1;
  }
  return Math.min(1, l);
}
