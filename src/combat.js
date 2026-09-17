// Melee arc, hitscan, damage, knockback, noise. See docs/04-gameplay.md.

import * as iso from "./iso.js";
import { blocksShot } from "./node.js";
import { lineOfSight } from "./pathfind.js";
import { getSheet } from "./assets.js";
import { playAnimation, isActiveFrame } from "./sprites.js";
import { equippedWeapon, countItem, removeItem } from "./inventory.js";
import { damageZombie, knockDown, stagger } from "./entities/zombie.js";
import { aimOrigin, AIM_Y } from "./entities/player.js";
import { emit } from "./events.js";

const HITSCAN_STEP = 0.1; // tiles, for the wall-stop point on a miss
export const MELEE_STAMINA_COST = 12; // per swing, out of 100
export const WINDED_DAMAGE_MULT = 0.5;
export const WINDED_COOLDOWN_MULT = 1.8;
// Melee that lands (docs/22-melee.md).
export const POINT_BLANK = 0.55; // tiles: a zombie this close is hit whatever the angle
export const KNOCKDOWN_CHANCE = 0.3;
export const COMBO_HITS = 3; // the nth hit in a row always knocks down
export const COMBO_WINDOW = 2; // seconds between hits to count as a row
export const FINISHER_MULT = 2; // damage multiplier on a downed zombie
export const SHOVE = { range: 1.0, arc: 100, knockback: 1.6, stagger: 0.6, knockdown: 0.25, stamina: 5, cooldown: 0.45 };
export const HITSTOP_HIT = 0.045;
export const HITSTOP_KILL = 0.09;
export const KICK_PX = 3;
export const KICK_TIME = 0.08;
export const FLASH_TIME = 0.09;

// Feedback state read by main.js: a freeze and a screen jolt.
export const feedback = { hitstop: 0, kick: { x: 0, y: 0, ttl: 0 } };

let combatTime = 0; // for hit combos
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
    player.attackCooldown = weapon.cooldown * (tired ? WINDED_COOLDOWN_MULT : 1);
    playAnimation(player.anim, "attack", true);
    effects.push({ kind: "swing", ttl: 0.15, gx: player.gx, gy: player.gy, sx: player.aim.sx, sy: player.aim.sy, range: weapon.range, arc: weapon.arc });
    emit("meleeSwing", { player });
    // The swing resolves now, on the click: never lost to an interrupted animation.
    applyMeleeArc(player, weapon, zombies, tired ? WINDED_DAMAGE_MULT : 1, tired ? 0.5 : 1);
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

// The shove (Space): no damage, a strong push, a stagger, sometimes a knockdown.
export function tryShove(player, node, zombies) {
  if ((player.shoveCooldown || 0) > 0 || player.hp <= 0) return;
  player.shoveCooldown = SHOVE.cooldown;
  player.stamina = Math.max(0, player.stamina - SHOVE.stamina);
  playAnimation(player.anim, "attack", true);
  effects.push({ kind: "swing", ttl: 0.12, gx: player.gx, gy: player.gy, sx: player.aim.sx, sy: player.aim.sy, range: SHOVE.range, arc: SHOVE.arc, shove: true });
  const g = iso.screenDirToGrid(player.aim.sx, player.aim.sy);
  const kn = iso.normalize(g.gx, g.gy);
  let hits = 0;
  for (const z of zombies) {
    if (z.dead || z.state === "die" || !inWedge(player, SHOVE, z)) continue;
    hits++;
    z.flashTimer = FLASH_TIME;
    z.knock = { x: kn.x * SHOVE.knockback, y: kn.y * SHOVE.knockback };
    if (z.state !== "down" && Math.random() < SHOVE.knockdown) knockDown(z);
    else if (z.state !== "down") stagger(z, SHOVE.stagger);
  }
  emit("shove", { hits });
  if (hits) {
    feedback.hitstop = Math.max(feedback.hitstop, HITSTOP_HIT * 0.6);
    kick(player.aim.sx, player.aim.sy);
  }
}

// Advance cooldowns, effects, and feedback timers.
export function updateCombat(player, inv, node, zombies, dt) {
  combatTime += dt;
  player.attackCooldown = Math.max(0, (player.attackCooldown || 0) - dt);
  player.shoveCooldown = Math.max(0, (player.shoveCooldown || 0) - dt);
  for (let i = effects.length - 1; i >= 0; i--) {
    effects[i].ttl -= dt;
    if (effects[i].ttl <= 0) effects.splice(i, 1);
  }
  feedback.kick.ttl = Math.max(0, feedback.kick.ttl - dt);
}

function kick(sx, sy) {
  const n = Math.hypot(sx, sy) || 1;
  feedback.kick = { x: (sx / n) * KICK_PX, y: (sy / n) * KICK_PX, ttl: KICK_TIME };
}

// Is the zombie inside the swing wedge? Reach is a grid circle of `range`
// tiles around the player's feet, plus a little slack for a zombie drawn
// down-screen, whose body overlaps the player before its feet are close
// (up to BODY_SLACK tiles when its feet are a full body height below). The
// arc is measured in screen space from the chest against sample points over
// the zombie's whole body, so a sprite inside the drawn wedge is hit. Point
// blank always hits.
const BODY_SLACK = 0.8;
export function inWedge(player, weapon, z) {
  const feet = Math.hypot(z.gx - player.gx, z.gy - player.gy);
  if (feet <= POINT_BLANK) return true;
  const pf = iso.toScreen(player.gx, player.gy);
  const zs = iso.toScreen(z.gx, z.gy);
  const slack = Math.max(0, Math.min(1, (zs.y - pf.y) / BODY_TOP)) * BODY_SLACK;
  if (feet > weapon.range + slack) return false;
  const arcRad = (weapon.arc * Math.PI) / 180;
  const o = aimOrigin(player);
  // Feet to chest only: counting the head lets a swing straight up-screen
  // catch a zombie standing fully beside you.
  for (const dy of [BODY_BOTTOM, 20, 38]) {
    for (const dx of [-BODY_HALF_W, 0, BODY_HALF_W]) {
      const vx = zs.x + dx - o.x;
      const vy = zs.y - dy - o.y;
      if (vx === 0 && vy === 0) return true;
      if (screenAngleBetween(player.aim.sx, player.aim.sy, vx, vy) <= arcRad) return true;
    }
  }
  return false;
}

function applyMeleeArc(player, weapon, zombies, damageMult = 1, knockMult = 1) {
  const g = iso.screenDirToGrid(player.aim.sx, player.aim.sy);
  const kn = iso.normalize(g.gx, g.gy);
  let hits = 0;
  let kills = 0;
  let knockdowns = 0;
  let finishers = 0;
  for (const z of zombies) {
    if (z.dead || z.state === "die" || !inWedge(player, weapon, z)) continue;
    hits++;
    // Hit combos: the nth hit in a row on the same zombie always floors it.
    z.hitCombo = combatTime - (z.lastHitAt || -99) <= COMBO_WINDOW ? (z.hitCombo || 0) + 1 : 1;
    z.lastHitAt = combatTime;
    const finisher = z.state === "down";
    const kb = weapon.knockback * knockMult * (finisher ? 0 : 1);
    const dmg = Math.round(weapon.damage * damageMult * (finisher ? FINISHER_MULT : 1));
    damageZombie(z, dmg, { x: kn.x * kb, y: kn.y * kb });
    z.flashTimer = FLASH_TIME;
    if (z.state === "die") {
      kills++;
    } else if (finisher) {
      finishers++;
    } else if (z.hitCombo >= COMBO_HITS || Math.random() < KNOCKDOWN_CHANCE) {
      knockDown(z);
      knockdowns++;
    }
  }
  if (hits) {
    feedback.hitstop = Math.max(feedback.hitstop, kills ? HITSTOP_KILL : HITSTOP_HIT);
    kick(player.aim.sx, player.aim.sy);
    emit("meleeHit", { count: hits, kills, knockdowns, finishers });
  }
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
      // The reach as tested: a grid circle around the feet (an ellipse on
      // screen), cut to the aim arc in screen space.
      const p = iso.toScreen(e.gx, e.gy);
      const base = Math.atan2(e.sy, e.sx);
      const arc = (e.arc * Math.PI) / 180;
      ctx.strokeStyle = e.shove ? `rgba(160,200,255,${Math.min(1, e.ttl * 8)})` : `rgba(255,255,255,${Math.min(1, e.ttl * 6)})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      const steps = 14;
      for (let i = 0; i <= steps; i++) {
        const a = base - arc + (2 * arc * i) / steps;
        // A unit screen direction, scaled so the grid length equals the range.
        const g = iso.screenDirToGrid(Math.cos(a), Math.sin(a));
        const n = iso.normalize(g.gx, g.gy);
        const s = iso.gridDirToScreen(n.x * e.range, n.y * e.range);
        const x = p.x + s.sx;
        const y = p.y + s.sy;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }
}
