// Melee arc, hitscan, damage, knockback, noise. See docs/04-gameplay.md.

import * as iso from "./iso.js";
import { blocksShot } from "./node.js";
import { lineOfSight } from "./pathfind.js";
import { getSheet } from "./assets.js";
import { playAnimation, isActiveFrame } from "./sprites.js";
import { equippedWeapon, countItem, removeItem } from "./inventory.js";
import { damageZombie } from "./entities/zombie.js";
import { aimOrigin, AIM_Y } from "./entities/player.js";
import { emit } from "./events.js";

const HITSCAN_STEP = 0.1; // tiles, for the wall-stop point on a miss
export const MELEE_STAMINA_COST = 12; // per swing, out of 100
export const WINDED_DAMAGE_MULT = 0.5;
export const WINDED_COOLDOWN_MULT = 1.8;
// Screen-space body of a zombie for shot tests: this wide, from feet to head.
const BODY_HALF_W = 13;
const BODY_TOP = 58;
const BODY_BOTTOM = 2;

// Short-lived visual effects for feedback: { kind, ttl, ... }.
export const effects = [];

function screenAngleBetween(ax, ay, bx, by) {
  const dot = ax * bx + ay * by;
  const cross = ax * by - ay * bx;
  return Math.abs(Math.atan2(cross, dot));
}

// Called on the fire button. Starts a melee swing or fires a shot.
export function tryAttack(player, inv, node, zombies) {
  if (player.attackCooldown > 0 || player.hp <= 0) return;
  const weapon = equippedWeapon(inv);
  if (!weapon) return;

  if (weapon.melee) {
    // Swings cost stamina. A winded player still swings, but weaker and slower,
    // so the bat is never a free infinite zombie killer.
    const cost = weapon.staminaCost ?? MELEE_STAMINA_COST;
    player.stamina = Math.max(0, player.stamina - cost);
    if (player.stamina <= 0) player.winded = true;
    const tired = player.winded;
    player.pendingMelee = { weapon, done: false, damageMult: tired ? WINDED_DAMAGE_MULT : 1, knockMult: tired ? 0.5 : 1 };
    player.attackCooldown = weapon.cooldown * (tired ? WINDED_COOLDOWN_MULT : 1);
    playAnimation(player.anim, "attack", true);
    effects.push({ kind: "swing", ttl: 0.15, gx: player.gx, gy: player.gy, sx: player.aim.sx, sy: player.aim.sy, range: weapon.range, arc: weapon.arc });
    emit("meleeSwing", { player });
    return;
  }

  // Gun
  if (countItem(inv, weapon.ammo) <= 0) {
    player.attackCooldown = 0.25;
    emit("dryFire", { player });
    return;
  }
  removeItem(inv, weapon.ammo, 1);
  player.attackCooldown = weapon.cooldown;
  playAnimation(player.anim, "attack", true);
  fireHitscan(player, weapon, node, zombies);
  emit("noise", { node: node.id, tile: [Math.round(player.gx), Math.round(player.gy)], loudness: weapon.loudness, source: "gun" });
}

// Advance cooldowns and apply melee hits on the active frame.
export function updateCombat(player, inv, node, zombies, dt) {
  player.attackCooldown = Math.max(0, (player.attackCooldown || 0) - dt);
  for (let i = effects.length - 1; i >= 0; i--) {
    effects[i].ttl -= dt;
    if (effects[i].ttl <= 0) effects.splice(i, 1);
  }
  const pm = player.pendingMelee;
  if (!pm || pm.done) return;
  const sheet = getSheet(player.sprite);
  if (player.anim.name !== "attack") {
    pm.done = true;
    return;
  }
  if (!isActiveFrame(player.anim, sheet)) return;
  pm.done = true;
  applyMeleeArc(player, pm.weapon, zombies, pm.damageMult, pm.knockMult);
}

function applyMeleeArc(player, weapon, zombies, damageMult = 1, knockMult = 1) {
  const arcRad = (weapon.arc * Math.PI) / 180;
  const p = iso.toScreen(player.gx, player.gy);
  const g = iso.screenDirToGrid(player.aim.sx, player.aim.sy);
  const kn = iso.normalize(g.gx, g.gy);
  let hits = 0;
  for (const z of zombies) {
    if (z.dead || z.state === "die") continue;
    const d = Math.hypot(z.gx - player.gx, z.gy - player.gy);
    if (d > weapon.range) continue;
    const zs = iso.toScreen(z.gx, z.gy);
    const vx = zs.x - p.x;
    const vy = zs.y - p.y;
    const ang = vx === 0 && vy === 0 ? 0 : screenAngleBetween(player.aim.sx, player.aim.sy, vx, vy);
    if (ang <= arcRad) {
      const kb = weapon.knockback * knockMult;
      damageZombie(z, Math.round(weapon.damage * damageMult), { x: kn.x * kb, y: kn.y * kb });
      hits++;
    }
  }
  if (hits) emit("meleeHit", { count: hits });
  return hits;
}

// Where a shot along the aim direction stops on a miss: the first shot-blocking
// tile, or max range. Returned as a grid position.
function wallStop(player, weapon, node) {
  const g = iso.screenDirToGrid(player.aim.sx, player.aim.sy);
  const dir = iso.normalize(g.gx, g.gy);
  let x = player.gx;
  let y = player.gy;
  let traveled = 0;
  while (traveled < weapon.maxRange) {
    const nx = x + dir.x * HITSCAN_STEP;
    const ny = y + dir.y * HITSCAN_STEP;
    if (blocksShot(node, Math.round(nx), Math.round(ny))) break;
    x = nx;
    y = ny;
    traveled += HITSCAN_STEP;
  }
  return { x, y };
}

// Screen-space hit test: the shot is a ray from the chest along the aim vector.
// A zombie is a vertical body segment from feet to head; the nearest one the
// ray passes through, with a clear grid line of sight, is hit. Aiming at any
// part of the sprite works, which is what the hand expects.
function fireHitscan(player, weapon, node, zombies) {
  const o = aimOrigin(player);
  const { sx, sy } = player.aim;
  const candidates = [];
  for (const z of zombies) {
    if (z.dead || z.state === "die") continue;
    if (Math.hypot(z.gx - player.gx, z.gy - player.gy) > weapon.maxRange) continue;
    const zs = iso.toScreen(z.gx, z.gy);
    let best = Infinity;
    let bestT = 0;
    for (let k = 0; k <= 6; k++) {
      const py = zs.y + BODY_BOTTOM - ((BODY_TOP + BODY_BOTTOM) * k) / 6;
      const vx = zs.x - o.x;
      const vy = py - o.y;
      const t = vx * sx + vy * sy; // distance along the ray
      if (t <= 0) continue;
      const perp = Math.abs(vx * sy - vy * sx);
      if (perp < best) {
        best = perp;
        bestT = t;
      }
    }
    if (best <= BODY_HALF_W) candidates.push({ z, t: bestT });
  }
  candidates.sort((a, b) => a.t - b.t);

  let hit = null;
  for (const c of candidates) {
    if (lineOfSight(node, player.gx, player.gy, c.z.gx, c.z.gy)) {
      hit = c.z;
    }
    // Either we hit this one or a wall is in the way before it; stop looking.
    break;
  }

  let end;
  if (hit) {
    const g = iso.screenDirToGrid(sx, sy);
    const dir = iso.normalize(g.gx, g.gy);
    damageZombie(hit, weapon.damage, { x: dir.x * 0.15, y: dir.y * 0.15 });
    const zs = iso.toScreen(hit.gx, hit.gy);
    end = { x: zs.x, y: zs.y - AIM_Y };
  } else {
    const w = wallStop(player, weapon, node);
    const ws = iso.toScreen(w.x, w.y);
    end = { x: ws.x, y: ws.y - AIM_Y };
  }
  effects.push({ kind: "tracer", ttl: 0.08, x0: o.x, y0: o.y, x1: end.x, y1: end.y, hit: hit ? "zombie" : "none" });
  return hit;
}

// Draw effects on top of the scene.
export function renderEffects(ctx) {
  for (const e of effects) {
    if (e.kind === "tracer") {
      ctx.strokeStyle = "rgba(255, 240, 180, 0.9)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(Math.round(e.x0), Math.round(e.y0));
      ctx.lineTo(Math.round(e.x1), Math.round(e.y1));
      ctx.stroke();
    } else if (e.kind === "swing") {
      const p = iso.toScreen(e.gx, e.gy);
      const base = Math.atan2(e.sy, e.sx);
      const arc = (e.arc * Math.PI) / 180;
      const g = iso.screenDirToGrid(e.sx, e.sy);
      const n = iso.normalize(g.gx, g.gy);
      const rs = iso.gridDirToScreen(n.x, n.y);
      const r = Math.hypot(rs.sx, rs.sy) * e.range;
      ctx.strokeStyle = `rgba(255,255,255,${Math.min(1, e.ttl * 6)})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(Math.round(p.x), Math.round(p.y) - 20, r, base - arc, base + arc);
      ctx.stroke();
    }
  }
}
