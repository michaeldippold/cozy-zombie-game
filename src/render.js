// Draw passes: floor, far walls, sorted drawables. See docs/03-rendering.md.

import * as iso from "./iso.js";
import { getSheet } from "./assets.js";
import { drawFrame, drawCharacter, resolveFacing, frameName, frameRect } from "./sprites.js";
import { poly } from "./render-util.js";
import { wallSpriteAt } from "./node.js";
import * as clock from "./clock.js";
import * as light from "./light.js";
import { aimOrigin } from "./entities/player.js";

const SLAB = 8; // floor thickness under the near edges

function drawFloor(ctx, node) {
  const w = node.width;
  const h = node.height;
  const tl = iso.toScreen(-0.5, -0.5);
  const tr = iso.toScreen(w - 0.5, -0.5);
  const br = iso.toScreen(w - 0.5, h - 0.5);
  const bl = iso.toScreen(-0.5, h - 0.5);
  ctx.fillStyle = "#2a2420";
  poly(ctx, [[tl.x, tl.y + SLAB], [tr.x, tr.y + SLAB], [br.x, br.y + SLAB], [bl.x, bl.y + SLAB]]);
  ctx.fill();

  const base = getSheet(node.floor);
  for (let gy = 0; gy < h; gy++) {
    for (let gx = 0; gx < w; gx++) {
      const o = node.floorOverrides.get(`${gx},${gy}`);
      const sheet = o ? getSheet(o) : base;
      const p = iso.toScreen(gx, gy);
      const alt = (gx + gy) % 2 === 0 ? 0 : 1;
      drawFrame(ctx, sheet, `idle_${alt}`, Math.round(p.x), Math.round(p.y));
    }
  }

  // Door thresholds: a mat tile just outside the room, with its own slab and a
  // light rim so it reads as a step. Boarded doors on the open (near) edges
  // draw their planks across the mat, since there is no wall to hold them.
  const mat = getSheet("floor_door");
  for (const ref of node.thresholds.values()) {
    const [tx, ty] = ref.threshold;
    const p = iso.toScreen(tx, ty);
    const x = Math.round(p.x);
    const y = Math.round(p.y);
    ctx.fillStyle = "#2a2420";
    poly(ctx, [[x, y - iso.HH + SLAB], [x + iso.HW, y + SLAB], [x, y + iso.HH + SLAB], [x - iso.HW, y + SLAB]]);
    ctx.fill();
    drawFrame(ctx, mat, "idle_0", x, y);
    ctx.strokeStyle = "#a08a70";
    ctx.lineWidth = 1;
    iso.tilePath(ctx, x, y);
    ctx.stroke();
    const nearEdge = ref.wall === "south" || ref.wall === "east";
    if (nearEdge && ref.edge.barricade) {
      ctx.strokeStyle = "#8a6a3a";
      ctx.lineWidth = 4;
      for (const t of [-0.4, 0, 0.4]) {
        ctx.beginPath();
        ctx.moveTo(x - iso.HW + 6, y + t * iso.HH);
        ctx.lineTo(x + iso.HW - 6, y + t * iso.HH);
        ctx.stroke();
      }
    }
  }
}

// Entities standing in a far-wall doorway are outside the wall line and draw
// before it. Thresholds on the open near edges are in front of everything.
function isBehindWalls(node, e) {
  return Math.round(e.gx) < 0 || Math.round(e.gy) < 0;
}

// Wall segment variant for a tile position. Edges (doors, windows) override
// "plain" once the world is loaded; wallVariantAt is supplied by the caller.
// A soft warm glow over an intact window at night. Per docs/00-vision.md,
// this is the same light the sim uses to pull zombies toward the player's
// own node; the player sees the cause, not the number. Purely decorative —
// the actual visibility effect is the light-punch in drawNightOverlay below.
function drawWindowGlow(ctx, cx, cy) {
  const n = clock.nightFactor();
  if (n <= 0.02) return;
  const gy = cy - 38; // roughly the glass center above the tile anchor
  const grad = ctx.createRadialGradient(cx, gy, 0, cx, gy, 20);
  grad.addColorStop(0, `rgba(255, 214, 140, ${0.55 * n})`);
  grad.addColorStop(1, "rgba(255, 214, 140, 0)");
  ctx.fillStyle = grad;
  ctx.fillRect(cx - 20, gy - 20, 40, 40);
}

// Radii (screen px) of the light-punch a source carves into the night wash.
const WINDOW_LIGHT_RADIUS = 95;
const LAMP_LIGHT_RADIUS = 140;
// Night is dark but never black: things in the open are faintly visible, and
// light sources make them meaningfully brighter. The layer is composited with
// "multiply" so colours darken proportionally; at full night a far, unlit tile
// keeps roughly 15-35% of its brightness per channel, blue-shifted: dark
// enough that a still zombie and a small tree are hard to tell apart.
// Previous step, the "happy medium" candidate: "38, 44, 95" at 0.95.
let NIGHT_TINT = "30, 35, 82";
let NIGHT_TINT_ALPHA = 0.96;

// Debug: try a night level live from the console without editing constants.
export function setNightTint(tint, alpha) {
  NIGHT_TINT = tint;
  NIGHT_TINT_ALPHA = alpha;
}
// The player's own night vision: a wide, weak, very gradual lift around them.
// Low centre strength and a long falloff so it never reads as a spotlight that
// follows you around. Visual only; zombie sight does not use it.
const PLAYER_VIS_RADIUS = 190; // px, about three tiles
const PLAYER_VIS_STRENGTH = 0.42; // fraction of the darkness removed at the centre
// Warm additive pool drawn at lamps on top of the tint, so light reads as
// light and not just as "less dark".
const LAMP_GLOW_ALPHA = 0.22;
// Props with these sprite ids act as light sources after dark.
const LIGHT_PROP_SPRITES = new Set(["lamp"]);

function drawWalls(ctx, node, wallVariantAt, lightSources) {
  // West wall, far to near. Each segment may use its own sprite.
  let lastWest = null;
  for (let gy = node.height - 1; gy >= 0; gy--) {
    const id = wallSpriteAt(node, "west", gy);
    if (!id) continue;
    const sheet = getSheet(id);
    const p = iso.toScreen(0, gy);
    const variant = wallVariantAt(node, 0, gy, "west");
    drawFrame(ctx, sheet, `west_${variant}_0`, Math.round(p.x), Math.round(p.y), false, sheet.anchorWest);
    if (variant === "window") {
      drawWindowGlow(ctx, Math.round(p.x), Math.round(p.y));
      lightSources.push({ x: Math.round(p.x), y: Math.round(p.y) - 38, radius: WINDOW_LIGHT_RADIUS });
    }
    if (gy === node.height - 1) lastWest = sheet;
  }
  if (lastWest) {
    const pc = iso.toScreen(0, node.height - 1);
    drawFrame(ctx, lastWest, "west_cap_0", Math.round(pc.x), Math.round(pc.y), false, lastWest.anchorWest);
  }
  let lastNorth = null;
  for (let gx = 0; gx < node.width; gx++) {
    const id = wallSpriteAt(node, "north", gx);
    if (!id) continue;
    const sheet = getSheet(id);
    const p = iso.toScreen(gx, 0);
    const variant = wallVariantAt(node, gx, 0, "north");
    drawFrame(ctx, sheet, `north_${variant}_0`, Math.round(p.x), Math.round(p.y), false, sheet.anchor);
    if (variant === "window") {
      drawWindowGlow(ctx, Math.round(p.x), Math.round(p.y));
      lightSources.push({ x: Math.round(p.x), y: Math.round(p.y) - 38, radius: WINDOW_LIGHT_RADIUS });
    }
    if (gx === node.width - 1) lastNorth = sheet;
  }
  if (lastNorth) {
    const pc = iso.toScreen(node.width - 1, 0);
    drawFrame(ctx, lastNorth, "north_cap_0", Math.round(pc.x), Math.round(pc.y), false, lastNorth.anchor);
  }
}

// Lamp posts and anything else tagged as a light source, in screen space.
function collectPropLights(node, out) {
  for (const prop of node.props) {
    if (!LIGHT_PROP_SPRITES.has(prop.sprite)) continue;
    const [tx, ty] = prop.tile;
    const p = iso.toScreen(tx, ty);
    out.push({ x: Math.round(p.x), y: Math.round(p.y) - 14, radius: LAMP_LIGHT_RADIUS, warm: true });
  }
}

// Night darkening with light-punch. Interiors are assumed lit (the player's
// own lamps and candles) and never darken; only outdoor nodes get the wash,
// see docs/09-decisions.md. A single offscreen layer is filled with the dark
// wash, then `destination-out` erases soft circles at each light source
// before it's composited onto the scene — a cheap Canvas2D trick, no
// per-pixel lighting math, that makes staying near a lamp or a lit window
// meaningfully brighter than the open dark.
let nightCanvas = null;
let nightCtx = null;

function drawNightOverlay(ctx, node, lightSources, player) {
  if (!node.outdoor) return;
  const n = clock.nightFactor();
  if (n <= 0.01) return;
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  if (!nightCanvas) {
    nightCanvas = document.createElement("canvas");
    nightCtx = nightCanvas.getContext("2d");
  }
  if (nightCanvas.width !== w || nightCanvas.height !== h) {
    nightCanvas.width = w;
    nightCanvas.height = h;
  }
  nightCtx.globalCompositeOperation = "source-over";
  nightCtx.clearRect(0, 0, w, h);
  nightCtx.fillStyle = `rgba(${NIGHT_TINT}, ${NIGHT_TINT_ALPHA * n})`;
  nightCtx.fillRect(0, 0, w, h);

  // The player's inherent visibility: partial erase, long smooth falloff.
  if (player) {
    const o = aimOrigin(player);
    const r = PLAYER_VIS_RADIUS;
    nightCtx.globalCompositeOperation = "destination-out";
    const pg = nightCtx.createRadialGradient(o.x, o.y + 10, 0, o.x, o.y + 10, r);
    pg.addColorStop(0, `rgba(255,255,255,${PLAYER_VIS_STRENGTH})`);
    pg.addColorStop(0.35, `rgba(255,255,255,${PLAYER_VIS_STRENGTH * 0.8})`);
    pg.addColorStop(0.7, `rgba(255,255,255,${PLAYER_VIS_STRENGTH * 0.35})`);
    pg.addColorStop(1, "rgba(255,255,255,0)");
    nightCtx.fillStyle = pg;
    nightCtx.fillRect(o.x - r, o.y + 10 - r, r * 2, r * 2);
  }

  // Erase soft pools at each light source. Wide falloff so pools blend into
  // the moonlight instead of ending in a hard ring.
  nightCtx.globalCompositeOperation = "destination-out";
  for (const src of lightSources) {
    const grad = nightCtx.createRadialGradient(src.x, src.y, 0, src.x, src.y, src.radius);
    grad.addColorStop(0, "rgba(255,255,255,0.9)");
    grad.addColorStop(0.45, "rgba(255,255,255,0.5)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    nightCtx.fillStyle = grad;
    nightCtx.fillRect(src.x - src.radius, src.y - src.radius, src.radius * 2, src.radius * 2);
  }
  // Flashlight beam: a polygon built from blocked rays, erased with a
  // gradient from the chest (bright) to the range (nothing). Because the rays
  // stop at blocking tiles, the beam ends at trees, cars, and walls for free.
  let beamPoly = null;
  let beamOrigin = null;
  let beamRadius = 0;
  const beam = light.beamOf(player);
  if (beam) {
    const pts = light.beamRays(node, player, beam).map((g) => iso.toScreen(g.gx, g.gy));
    beamOrigin = aimOrigin(player);
    beamPoly = [[beamOrigin.x, beamOrigin.y], ...pts.map((p) => [p.x, p.y])];
    for (const p of pts) beamRadius = Math.max(beamRadius, Math.hypot(p.x - beamOrigin.x, p.y - beamOrigin.y));
    beamRadius = Math.max(1, beamRadius);
    nightCtx.save();
    poly(nightCtx, beamPoly);
    nightCtx.clip();
    const grad = nightCtx.createRadialGradient(beamOrigin.x, beamOrigin.y, 0, beamOrigin.x, beamOrigin.y, beamRadius);
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(0.7, "rgba(255,255,255,0.85)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    nightCtx.fillStyle = grad;
    nightCtx.fillRect(beamOrigin.x - beamRadius, beamOrigin.y - beamRadius, beamRadius * 2, beamRadius * 2);
    nightCtx.restore();
  }
  nightCtx.globalCompositeOperation = "source-over";

  ctx.globalCompositeOperation = "multiply";
  ctx.drawImage(nightCanvas, 0, 0);
  ctx.globalCompositeOperation = "source-over";

  if (beamPoly) {
    ctx.save();
    poly(ctx, beamPoly);
    ctx.clip();
    const grad = ctx.createRadialGradient(beamOrigin.x, beamOrigin.y, 0, beamOrigin.x, beamOrigin.y, beamRadius);
    grad.addColorStop(0, `rgba(255, 230, 170, ${0.3 * n})`);
    grad.addColorStop(1, "rgba(255, 230, 170, 0)");
    ctx.fillStyle = grad;
    ctx.fillRect(beamOrigin.x - beamRadius, beamOrigin.y - beamRadius, beamRadius * 2, beamRadius * 2);
    ctx.restore();
  }

  // Warm glow at lamps so their pools read as lamplight.
  for (const src of lightSources) {
    if (!src.warm) continue;
    const r = src.radius * 0.6;
    const grad = ctx.createRadialGradient(src.x, src.y, 0, src.x, src.y, r);
    grad.addColorStop(0, `rgba(255, 205, 130, ${LAMP_GLOW_ALPHA * n})`);
    grad.addColorStop(1, "rgba(255, 205, 130, 0)");
    ctx.fillStyle = grad;
    ctx.fillRect(src.x - r, src.y - r, r * 2, r * 2);
  }
}

// Props at least this tall (frame height in px) can occlude characters.
const OCCLUDER_MIN_HEIGHT = 64;
const OCCLUDER_ALPHA = 0.4;
const SILHOUETTE_ALPHA = 0.55;
const SILHOUETTE_COLORS = { player: "#ffe08a", zombie: "#a8e898" };

function propDrawables(node, out) {
  for (const prop of node.props) {
    const sheet = getSheet(prop.sprite, prop.tiles.length);
    prop.tiles.forEach(([tx, ty], i) => {
      const name = `idle_${i}`;
      const f = sheet.frames[name];
      const p = iso.toScreen(tx, ty);
      const x = Math.round(p.x);
      const y = Math.round(p.y);
      out.push({
        key: iso.sortKey(tx, ty),
        kind: "prop",
        prop,
        sheet,
        frame: name,
        tx,
        ty,
        // Occlusion rect: the sheet's visible bounds if it declares them, else the frame.
        rect: f
          ? sheet.bounds
            ? { x: x - sheet.anchor[0] + sheet.bounds.x, y: y - sheet.anchor[1] + sheet.bounds.y, w: sheet.bounds.w, h: sheet.bounds.h }
            : { x: x - sheet.anchor[0], y: y - sheet.anchor[1], w: f[2], h: f[3] }
          : null,
        canOcclude: !!f && f[3] >= OCCLUDER_MIN_HEIGHT,
        occluder: false,
        draw(ctx) {
          drawFrame(ctx, sheet, name, x, y);
        },
      });
    });
  }
}

function rectsOverlap(a, b) {
  return a && b && a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

// Mark characters hidden behind tall props that draw after them, and mark those props.
function computeOcclusion(drawables) {
  for (let i = 0; i < drawables.length; i++) {
    const d = drawables[i];
    if (d.kind !== "entity" || d.entity.dead || !d.rect) continue;
    // A zombie nobody can make out does not fade the tree it stands behind.
    if (d.revealable === false) continue;
    // Only the upper body counts; feet overlapping a prop base is normal.
    const body = { x: d.rect.x, y: d.rect.y, w: d.rect.w, h: Math.max(1, d.rect.h - 14) };
    for (let j = i + 1; j < drawables.length; j++) {
      const o = drawables[j];
      if (o.kind !== "prop" || !o.canOcclude) continue;
      if (rectsOverlap(body, o.rect)) {
        d.occluded = true;
        o.occluder = true;
      }
    }
  }
}

// Offscreen canvas for tinted silhouettes.
let silCanvas = null;
let silCtx = null;
function drawSilhouette(ctx, d) {
  const { sheet, entity: e } = d;
  const f = d.rect;
  if (!silCanvas) {
    silCanvas = document.createElement("canvas");
    silCtx = silCanvas.getContext("2d");
  }
  if (silCanvas.width < f.w || silCanvas.height < f.h) {
    silCanvas.width = Math.max(silCanvas.width, f.w);
    silCanvas.height = Math.max(silCanvas.height, f.h);
  }
  silCtx.imageSmoothingEnabled = false;
  silCtx.globalCompositeOperation = "source-over";
  silCtx.clearRect(0, 0, silCanvas.width, silCanvas.height);
  drawCharacter(silCtx, sheet, e.anim, e.facing, sheet.anchor[0], sheet.anchor[1]);
  silCtx.globalCompositeOperation = "source-in";
  silCtx.fillStyle = SILHOUETTE_COLORS[e.kind] || "#ffffff";
  silCtx.fillRect(0, 0, f.w, f.h);
  ctx.globalAlpha = SILHOUETTE_ALPHA;
  ctx.drawImage(silCanvas, 0, 0, f.w, f.h, f.x, f.y, f.w, f.h);
  ctx.globalAlpha = 1;
}

function itemDrawables(node, out) {
  for (const it of node.items) {
    const sheet = getSheet(`item_${it.item}`);
    const [tx, ty] = it.tile;
    out.push({
      key: iso.sortKey(tx, ty, 0, 1),
      kind: "item",
      item: it,
      draw(ctx) {
        const p = iso.toScreen(tx, ty);
        drawFrame(ctx, sheet, "idle_0", Math.round(p.x), Math.round(p.y));
      },
    });
  }
}

// Small floating health bar centered at (x, y). Red fill on a dark track.
const HP_BAR_W = 22;
const HP_BAR_H = 3;
function drawHealthBar(ctx, x, y, frac) {
  const f = Math.max(0, Math.min(1, frac));
  const x0 = x - HP_BAR_W / 2;
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(x0 - 1, y - 1, HP_BAR_W + 2, HP_BAR_H + 2);
  ctx.fillStyle = "#3a1010";
  ctx.fillRect(x0, y, HP_BAR_W, HP_BAR_H);
  ctx.fillStyle = "#e03030";
  ctx.fillRect(x0, y, Math.round(HP_BAR_W * f), HP_BAR_H);
}

// A health bar over a dim shape gives the dark away, so bars only show on
// zombies that are lit or close enough to make out.
const BAR_LIGHT_MIN = 0.45;
const BAR_NEAR_TILES = 3;

function entityDrawables(entities, out, node, player) {
  const barVisible = (e) => {
    if (!node || !player) return true;
    if (Math.hypot(e.gx - player.gx, e.gy - player.gy) <= BAR_NEAR_TILES) return true;
    return light.lightAt(node, e.gx, e.gy, player) >= BAR_LIGHT_MIN;
  };
  for (const e of entities) {
    const sheet = getSheet(e.sprite);
    const p = iso.toScreen(e.gx, e.gy);
    const x = Math.round(p.x);
    const y = Math.round(p.y);
    const r = resolveFacing(sheet, e.facing);
    const rect = frameRect(sheet, frameName(sheet, e.anim.name, r.facing, e.anim.frame), x, y);
    out.push({
      // Corpses sort under living characters on the same tile.
      key: iso.sortKey(e.gx, e.gy, 0, e.dead ? 0 : 2),
      kind: "entity",
      entity: e,
      sheet,
      rect,
      occluded: false,
      // Zombies in the dark get no x-ray silhouette either; it would make a
      // hidden zombie easier to spot than one standing in the open.
      revealable: e.kind !== "zombie" || barVisible(e),
      draw(ctx) {
        drawCharacter(ctx, sheet, e.anim, e.facing, x, y);
        if (e.kind === "zombie" && !e.dead && e.state !== "die" && barVisible(e)) drawHealthBar(ctx, x, y - 56, e.hp / e.maxHp);
      },
    });
  }
}

const plainVariant = () => "plain";

export function renderNode(ctx, node, entities, { wallVariantAt = plainVariant, debug = null, player = null } = {}) {
  drawFloor(ctx, node);
  const drawables = [];
  propDrawables(node, drawables);
  itemDrawables(node, drawables);
  entityDrawables(entities, drawables, node, player);
  drawables.sort((a, b) => a.key - b.key);
  computeOcclusion(drawables);
  // Anyone in a doorway draws under the wall so the jambs frame them.
  for (const d of drawables) {
    if (d.kind === "entity" && isBehindWalls(node, d.entity)) {
      d.draw(ctx);
      d.drawn = true;
    }
  }
  const lightSources = [];
  drawWalls(ctx, node, wallVariantAt, lightSources);
  collectPropLights(node, lightSources);
  for (const d of drawables) {
    if (d.drawn) continue;
    if (d.occluder) {
      ctx.globalAlpha = OCCLUDER_ALPHA;
      d.draw(ctx);
      ctx.globalAlpha = 1;
    } else {
      d.draw(ctx);
    }
  }
  for (const d of drawables) if (d.occluded && d.revealable !== false) drawSilhouette(ctx, d);
  drawNightOverlay(ctx, node, lightSources, player);
  if (debug) debug(ctx, drawables);
}
