// Draw passes: floor, far walls, sorted drawables. See docs/03-rendering.md.

import * as iso from "./iso.js";
import { getSheet } from "./assets.js";
import { drawFrame, drawCharacter, resolveFacing, frameName, frameRect } from "./sprites.js";
import { poly } from "./render-util.js";
import { wallSpriteAt } from "./node.js";
import * as clock from "./clock.js";

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
// own node; the player sees the cause, not the number.
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
    if (variant === "window") drawWindowGlow(ctx, Math.round(p.x), Math.round(p.y));
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
    if (variant === "window") drawWindowGlow(ctx, Math.round(p.x), Math.round(p.y));
    if (gx === node.width - 1) lastNorth = sheet;
  }
  if (lastNorth) {
    const pc = iso.toScreen(node.width - 1, 0);
    drawFrame(ctx, lastNorth, "north_cap_0", Math.round(pc.x), Math.round(pc.y), false, lastNorth.anchor);
  }
}

// Full-canvas night wash, drawn last so it darkens everything uniformly.
function drawNightOverlay(ctx) {
  const n = clock.nightFactor();
  if (n <= 0.01) return;
  ctx.fillStyle = `rgba(18, 16, 46, ${0.5 * n})`;
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
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

function entityDrawables(entities, out) {
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
      draw(ctx) {
        drawCharacter(ctx, sheet, e.anim, e.facing, x, y);
        if (e.kind === "zombie" && !e.dead && e.state !== "die") drawHealthBar(ctx, x, y - 56, e.hp / e.maxHp);
      },
    });
  }
}

const plainVariant = () => "plain";

export function renderNode(ctx, node, entities, { wallVariantAt = plainVariant, debug = null } = {}) {
  drawFloor(ctx, node);
  const drawables = [];
  propDrawables(node, drawables);
  itemDrawables(node, drawables);
  entityDrawables(entities, drawables);
  drawables.sort((a, b) => a.key - b.key);
  computeOcclusion(drawables);
  // Anyone in a doorway draws under the wall so the jambs frame them.
  for (const d of drawables) {
    if (d.kind === "entity" && isBehindWalls(node, d.entity)) {
      d.draw(ctx);
      d.drawn = true;
    }
  }
  drawWalls(ctx, node, wallVariantAt);
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
  for (const d of drawables) if (d.occluded) drawSilhouette(ctx, d);
  drawNightOverlay(ctx);
  if (debug) debug(ctx, drawables);
}
