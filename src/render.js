// Draw passes: floor, far walls, sorted drawables. See docs/03-rendering.md.

import * as iso from "./iso.js";
import { getSheet } from "./assets.js";
import { drawFrame, drawCharacter, resolveFacing, frameName, frameRect } from "./sprites.js";
import { poly } from "./render-util.js";
import { wallSpriteAt } from "./node.js";
import { getItem } from "./items.js";
import { NEAR_STUB } from "./placeholders.js";
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
// Floor lighting comes from the light map (light.js). This radius only sizes
// the warm glow drawn at outdoor lamps on top of the night layer.
const LAMP_LIGHT_RADIUS = 140;
// Night is dark but never black: things in the open are faintly visible, and
// light sources make them meaningfully brighter. The layer is composited with
// "multiply" so colours darken proportionally; at full night a far, unlit tile
// keeps roughly 15-35% of its brightness per channel, blue-shifted: dark
// enough that a still zombie and a small tree are hard to tell apart.
// Chosen by eye on 2026-09-17 (docs/09-decisions.md). Not settled law: try
// other levels live with __game.setNightTint(tint, alpha).
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

function drawWalls(ctx, node, wallVariantAt) {
  // West wall, far to near. Each segment may use its own sprite.
  let lastWest = null;
  for (let gy = node.height - 1; gy >= 0; gy--) {
    const id = wallSpriteAt(node, "west", gy);
    if (!id) continue;
    const sheet = getSheet(id);
    const p = iso.toScreen(0, gy);
    const variant = wallVariantAt(node, 0, gy, "west");
    drawFrame(ctx, sheet, `west_${variant}_0`, Math.round(p.x), Math.round(p.y), false, sheet.anchorWest);
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
    if (gx === node.width - 1) lastNorth = sheet;
  }
  if (lastNorth) {
    const pc = iso.toScreen(node.width - 1, 0);
    drawFrame(ctx, lastNorth, "north_cap_0", Math.round(pc.x), Math.round(pc.y), false, lastNorth.anchor);
  }
}

// Lamp posts and anything else tagged as a light source, in screen space.
function collectPropLights(node, out) {
  if (!node.outdoor) return; // indoor lamps are furniture; the room light is the switch
  for (const prop of node.props) {
    if (!LIGHT_PROP_SPRITES.has(prop.sprite)) continue;
    const [tx, ty] = prop.tile;
    const p = iso.toScreen(tx, ty);
    out.push({ x: Math.round(p.x), y: Math.round(p.y) - 14, radius: LAMP_LIGHT_RADIUS, warm: true });
  }
}

// The night layer. One offscreen canvas is filled with the night tint, has light
// erased out of it (player night vision, the static light map, the flashlight
// beam), and is composited over the scene with "multiply". Used outdoors at
// night and in any interior whose lights are off and whose openings do not admit
// full daylight. See docs/14-lighting-reference.md.
let nightCanvas = null;
let nightCtx = null;

function drawNightOverlay(ctx, node, lightSources, player) {
  const n = light.darknessOf(node);
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

  // Floor light with shadows: the cached static map, one pixel per light cell,
  // drawn through the iso transform. Image smoothing does the interpolation.
  const layer = light.getRenderLayer(node);
  if (layer) {
    const org = iso.getOrigin();
    // Clip to the floor diamond so the padded border of the map never lights
    // the void outside the node.
    nightCtx.save();
    floorPath(nightCtx, node);
    nightCtx.clip();
    nightCtx.globalCompositeOperation = "destination-out";
    nightCtx.imageSmoothingEnabled = true;
    nightCtx.imageSmoothingQuality = "high";
    nightCtx.setTransform(iso.HW, iso.HH, -iso.HW, iso.HH, org.x, org.y);
    nightCtx.translate(-0.5, -0.5);
    nightCtx.scale(1 / layer.res, 1 / layer.res);
    nightCtx.translate(-layer.pad, -layer.pad);
    nightCtx.drawImage(layer.canvas, 0, 0);
    nightCtx.restore();
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
    floorPath(nightCtx, node);
    nightCtx.clip();
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
    floorPath(ctx, node);
    ctx.clip();
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

// The floor diamond of a node in screen space (with the slab), as a path.
// Light drawn on the ground is clipped to it so nothing lights the void.
function floorPath(c, node) {
  const c0 = iso.toScreen(-0.5, -0.5);
  const c1 = iso.toScreen(node.width - 0.5, -0.5);
  const c2 = iso.toScreen(node.width - 0.5, node.height - 0.5);
  const c3 = iso.toScreen(-0.5, node.height - 0.5);
  poly(c, [[c0.x, c0.y], [c1.x, c1.y], [c2.x, c2.y + SLAB], [c3.x, c3.y + SLAB]]);
}

// Offscreen canvas for tinted silhouettes.
let silCanvas = null;
let silCtx = null;
function drawSilhouette(ctx, d, color = null, alpha = SILHOUETTE_ALPHA) {
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
  silCtx.fillStyle = color || SILHOUETTE_COLORS[e.kind] || "#ffffff";
  silCtx.fillRect(0, 0, f.w, f.h);
  ctx.globalAlpha = alpha;
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
        // A hit flashes the zombie white for a moment (docs/22).
        if (e.flashTimer > 0) drawSilhouette(ctx, this, "#ffffff", 0.85);
        if (e.kind === "zombie" && !e.dead && e.state !== "die" && barVisible(e)) drawHealthBar(ctx, x, y - 56, e.hp / e.maxHp);
      },
    });
  }
}

// Near-edge stub walls (interiors only): low cutaway walls along the south and
// east edges. Doors are gaps, windows are short frames. Drawn right after the
// floor so they never hide anything. See docs/13-indoor-light.md.
function drawNearWalls(ctx, node, wallVariantAt) {
  for (let gy = 0; gy < node.height; gy++) {
    const id = wallSpriteAt(node, "east", gy);
    if (!id) continue;
    const sheet = getSheet(id);
    if (!sheet.anchorEast) continue;
    const p = iso.toScreen(node.width - 1, gy);
    const variant = wallVariantAt(node, node.width - 1, gy, "east");
    drawFrame(ctx, sheet, `east_${variant}_0`, Math.round(p.x), Math.round(p.y), false, sheet.anchorEast);
  }
  for (let gx = 0; gx < node.width; gx++) {
    const id = wallSpriteAt(node, "south", gx);
    if (!id) continue;
    const sheet = getSheet(id);
    if (!sheet.anchorSouth) continue;
    const p = iso.toScreen(gx, node.height - 1);
    const variant = wallVariantAt(node, gx, node.height - 1, "south");
    drawFrame(ctx, sheet, `south_${variant}_0`, Math.round(p.x), Math.round(p.y), false, sheet.anchorSouth);
  }
}

// A window glows only if the room behind it is lit: a lit pane drawn over the
// darkness. The light it casts on the ground comes from the light map.
function drawLitPanes(ctx, node) {
  const n = clock.nightFactor();
  if (n <= 0.02 || !node.outdoor) return;
  for (const src of light.staticLights(node)) {
    if (src.kind !== "window" || src.broken) continue;
    const idx = src.wall === "west" ? src.gy : src.gx;
    const id = wallSpriteAt(node, src.wall, idx);
    if (!id) continue;
    const h = getSheet(id).wallHeight || 72;
    const c = iso.toScreen(src.gx, src.gy);
    const cx = Math.round(c.x);
    const cy = Math.round(c.y);
    const a = src.wall === "north" ? [cx, cy - iso.HH] : [cx - iso.HW, cy];
    const b = src.wall === "north" ? [cx + iso.HW, cy] : [cx, cy - iso.HH];
    const lerp = (t, y) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - y];
    ctx.fillStyle = `rgba(255, 214, 140, ${0.85 * n})`;
    poly(ctx, [lerp(0.27, h * 0.37), lerp(0.73, h * 0.37), lerp(0.73, h * 0.78), lerp(0.27, h * 0.78)]);
    ctx.fill();
  }
}

// The light switch: a small plate on the near stub beside the entrance, with an
// LED drawn over the darkness. Orange when the room is off, green when on.
function drawSwitch(ctx, node) {
  if (!node.switch) return;
  const [tx, ty] = node.switch.tile;
  const c = iso.toScreen(tx, ty);
  const mx = Math.round(c.x + (node.switch.wall === "east" ? iso.HW / 2 : -iso.HW / 2));
  const my = Math.round(c.y + iso.HH / 2) - NEAR_STUB;
  ctx.fillStyle = "#d8d4c8";
  ctx.fillRect(mx - 3, my - 10, 6, 9);
  ctx.strokeStyle = "#4a463e";
  ctx.lineWidth = 1;
  ctx.strokeRect(mx - 3.5, my - 10.5, 7, 10);
  const on = node.lightsOn;
  const led = on ? "#7adf7a" : "#ffb040";
  if (!on && light.darknessOf(node) > 0.2) {
    const g = ctx.createRadialGradient(mx, my - 7, 0, mx, my - 7, 9);
    g.addColorStop(0, "rgba(255, 176, 64, 0.55)");
    g.addColorStop(1, "rgba(255, 176, 64, 0)");
    ctx.fillStyle = g;
    ctx.fillRect(mx - 9, my - 16, 18, 18);
  }
  ctx.fillStyle = led;
  ctx.fillRect(mx - 1, my - 8, 2, 2);
}

// A placed candle shows its flame over the darkness.
function drawCandleFlames(ctx, node) {
  for (const it of node.items) {
    if (!getItem(it.item).light) continue;
    const p = iso.toScreen(it.tile[0], it.tile[1]);
    const x = Math.round(p.x);
    const y = Math.round(p.y) - 11;
    const g = ctx.createRadialGradient(x, y, 0, x, y, 10);
    g.addColorStop(0, "rgba(255, 220, 140, 0.7)");
    g.addColorStop(1, "rgba(255, 220, 140, 0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - 10, y - 10, 20, 20);
    ctx.fillStyle = "#fff2b0";
    ctx.fillRect(x - 1, y - 2, 2, 3);
  }
}

const plainVariant = () => "plain";

export function renderNode(ctx, node, entities, { wallVariantAt = plainVariant, debug = null, player = null } = {}) {
  drawFloor(ctx, node);
  drawNearWalls(ctx, node, wallVariantAt);
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
  drawWalls(ctx, node, wallVariantAt);
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
  drawLitPanes(ctx, node);
  drawCandleFlames(ctx, node);
  drawSwitch(ctx, node);
  if (debug) debug(ctx, drawables);
}
