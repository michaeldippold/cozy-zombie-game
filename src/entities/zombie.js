// Zombies inside the player's node. Dumb on purpose. See docs/04-gameplay.md.

import * as iso from "../iso.js";
import { moveCircle, isWalkable } from "../node.js";
import { findPath, lineOfSight } from "../pathfind.js";
import { getSheet } from "../assets.js";
import { createAnimation, playAnimation, advanceAnimation, isActiveFrame } from "../sprites.js";
import { emit } from "../events.js";
import { lightAt, inBeam } from "../light.js";

export const ZOMBIE_SPEED = 1.2; // tiles per second
export const ZOMBIE_SIGHT = 6; // tiles, in full light
// In full dark with the player unlit, sight range is this fraction of ZOMBIE_SIGHT.
export const SIGHT_MIN_FRAC = 0.35;
export const ZOMBIE_CONTACT = 0.7; // tiles
export const ZOMBIE_DAMAGE = 8;
export const ZOMBIE_COOLDOWN = 1.2; // seconds
export const ZOMBIE_HP = 100;
export const ZOMBIE_REPATH = 0.3; // seconds
export const ZOMBIE_RADIUS = 0.3;
const WANDER_IDLE_MIN = 1.5;
const WANDER_IDLE_MAX = 4.0;
const SEPARATION = 0.55;

let nextId = 1;

export function createZombie(gx, gy, { id = null, hp = ZOMBIE_HP, aggro = false, dead = false } = {}) {
  if (dead) {
    const z = createZombie(gx, gy, { id, hp: 0 });
    z.dead = true;
    z.state = "die";
    playAnimation(z.anim, "die", true);
    z.anim.frame = 3;
    z.anim.done = true;
    return z;
  }
  return {
    kind: "zombie",
    sprite: "zombie",
    id: id || `z${nextId++}`,
    gx,
    gy,
    facing: "s",
    speed: ZOMBIE_SPEED,
    radius: ZOMBIE_RADIUS,
    hp,
    maxHp: ZOMBIE_HP,
    state: aggro ? "chase" : "idle",
    aggro,
    anim: createAnimation("idle"),
    path: [],
    repathTimer: 0,
    lastPlayerTile: null,
    idleTimer: WANDER_IDLE_MIN + Math.random() * (WANDER_IDLE_MAX - WANDER_IDLE_MIN),
    attackCooldown: 0,
    attackHit: false,
    hurtTimer: 0,
    dead: false,
    knock: { x: 0, y: 0 },
  };
}

function distTo(z, e) {
  return Math.hypot(e.gx - z.gx, e.gy - z.gy);
}

function faceToward(z, dx, dy) {
  if (dx === 0 && dy === 0) return;
  const s = iso.gridDirToScreen(dx, dy);
  z.facing = iso.facingFromScreenVector(s.sx, s.sy);
}

// Sight depends on how lit the player is (docs/12-lighting.md). A zombie
// caught in the flashlight beam always sees the player.
function canSee(z, node, player) {
  if (inBeam(node, player, z.gx, z.gy)) return true;
  const light = lightAt(node, player.gx, player.gy, player);
  const range = ZOMBIE_SIGHT * (SIGHT_MIN_FRAC + (1 - SIGHT_MIN_FRAC) * light);
  if (distTo(z, player) > range) return false;
  return lineOfSight(node, z.gx, z.gy, player.gx, player.gy);
}

function tileOf(e) {
  return [Math.round(e.gx), Math.round(e.gy)];
}

function repath(z, node, goalTile) {
  const from = tileOf(z);
  const path = findPath(node, from, goalTile);
  z.path = path || [];
  z.repathTimer = ZOMBIE_REPATH;
}

// Move along the current path. Returns true when the path is exhausted.
function followPath(z, dt, node, others) {
  if (!z.path.length) return true;
  const [tx, ty] = z.path[0];
  const dx = tx - z.gx;
  const dy = ty - z.gy;
  const d = Math.hypot(dx, dy);
  if (d < 0.08) {
    z.path.shift();
    return z.path.length === 0;
  }
  const step = Math.min(d, z.speed * dt);
  const nx = (dx / d) * step;
  const ny = (dy / d) * step;
  faceToward(z, dx, dy);
  const moved = moveCircle(node, z.gx, z.gy, z.radius, nx, ny);
  z.gx = moved.gx;
  z.gy = moved.gy;
  separate(z, dt, node, others);
  return false;
}

// Soft push away from other characters so zombies do not stack.
function separate(z, dt, node, others) {
  let px = 0;
  let py = 0;
  for (const o of others) {
    if (o === z || o.dead) continue;
    const dx = z.gx - o.gx;
    const dy = z.gy - o.gy;
    const d = Math.hypot(dx, dy);
    if (d > 0 && d < SEPARATION) {
      const f = (SEPARATION - d) / SEPARATION;
      px += (dx / d) * f;
      py += (dy / d) * f;
    } else if (d === 0) {
      px += Math.random() - 0.5;
      py += Math.random() - 0.5;
    }
  }
  if (px !== 0 || py !== 0) {
    const moved = moveCircle(node, z.gx, z.gy, z.radius, px * dt * 2, py * dt * 2);
    z.gx = moved.gx;
    z.gy = moved.gy;
  }
}

function applyKnockback(z, dt, node) {
  if (z.knock.x === 0 && z.knock.y === 0) return;
  const moved = moveCircle(node, z.gx, z.gy, z.radius, z.knock.x * dt * 8, z.knock.y * dt * 8);
  z.gx = moved.gx;
  z.gy = moved.gy;
  const decay = Math.max(0, 1 - dt * 8);
  z.knock.x *= decay;
  z.knock.y *= decay;
  if (Math.hypot(z.knock.x, z.knock.y) < 0.01) z.knock = { x: 0, y: 0 };
}

function pickWanderTarget(z, node) {
  for (let tries = 0; tries < 10; tries++) {
    const tx = Math.round(z.gx) + Math.floor(Math.random() * 7) - 3;
    const ty = Math.round(z.gy) + Math.floor(Math.random() * 7) - 3;
    if (isWalkable(node, tx, ty)) return [tx, ty];
  }
  return null;
}

export function damageZombie(z, amount, knock = null) {
  if (z.dead) return;
  z.hp -= amount;
  z.aggro = true;
  if (knock) z.knock = { x: knock.x, y: knock.y };
  if (z.hp <= 0) {
    z.hp = 0;
    z.state = "die";
    z.path = [];
    playAnimation(z.anim, "die", true);
    emit("zombieDied", { zombie: z });
  } else {
    z.state = "hurt";
    z.hurtTimer = 0.25;
    playAnimation(z.anim, "hurt", true);
  }
}

// Called by combat noise events: aggro if within range.
export function hearNoise(z, tile, loudness) {
  if (z.dead) return;
  const d = Math.hypot(tile[0] - z.gx, tile[1] - z.gy);
  if (d <= loudness) {
    z.aggro = true;
    if (z.state === "idle" || z.state === "wander") {
      z.state = "chase";
      z.path = [];
      z.repathTimer = 0;
    }
  }
}

export function updateZombie(z, dt, node, player, others) {
  const sheet = getSheet(z.sprite);
  if (z.dead) return;

  if (z.state === "die") {
    advanceAnimation(z.anim, sheet, dt);
    if (z.anim.done) z.dead = true;
    return;
  }

  applyKnockback(z, dt, node);
  z.attackCooldown = Math.max(0, z.attackCooldown - dt);
  z.repathTimer -= dt;

  switch (z.state) {
    case "idle": {
      playAnimation(z.anim, "idle");
      z.idleTimer -= dt;
      if (!z.aggro && canSee(z, node, player)) z.aggro = true;
      if (z.aggro) {
        z.state = "chase";
        z.repathTimer = 0;
      } else if (z.idleTimer <= 0) {
        const target = pickWanderTarget(z, node);
        if (target) {
          repath(z, node, target);
          z.state = "wander";
        }
        z.idleTimer = WANDER_IDLE_MIN + Math.random() * (WANDER_IDLE_MAX - WANDER_IDLE_MIN);
      }
      break;
    }
    case "wander": {
      playAnimation(z.anim, "walk");
      if (canSee(z, node, player)) {
        z.aggro = true;
        z.state = "chase";
        z.repathTimer = 0;
        break;
      }
      if (followPath(z, dt, node, others)) z.state = "idle";
      break;
    }
    case "chase": {
      const d = distTo(z, player);
      if (d <= ZOMBIE_CONTACT) {
        z.path = [];
        faceToward(z, player.gx - z.gx, player.gy - z.gy);
        if (z.attackCooldown <= 0) {
          z.state = "attack";
          z.attackHit = false;
          playAnimation(z.anim, "attack", true);
        } else {
          playAnimation(z.anim, "idle");
          separate(z, dt, node, others);
        }
        break;
      }
      const pt = tileOf(player);
      const tileChanged = !z.lastPlayerTile || z.lastPlayerTile[0] !== pt[0] || z.lastPlayerTile[1] !== pt[1];
      if (z.repathTimer <= 0 || tileChanged || !z.path.length) {
        z.lastPlayerTile = pt;
        repath(z, node, pt);
        // If we are already on the player's tile, path is empty: walk straight at them.
      }
      if (z.path.length) {
        playAnimation(z.anim, "walk");
        followPath(z, dt, node, others);
      } else {
        // Same tile or unreachable: nudge directly toward the player.
        playAnimation(z.anim, "walk");
        const dx = player.gx - z.gx;
        const dy = player.gy - z.gy;
        const n = iso.normalize(dx, dy);
        faceToward(z, dx, dy);
        const moved = moveCircle(node, z.gx, z.gy, z.radius, n.x * z.speed * dt, n.y * z.speed * dt);
        z.gx = moved.gx;
        z.gy = moved.gy;
        separate(z, dt, node, others);
      }
      break;
    }
    case "attack": {
      if (isActiveFrame(z.anim, sheet) && !z.attackHit) {
        z.attackHit = true;
        if (distTo(z, player) <= ZOMBIE_CONTACT + 0.2) {
          emit("playerHit", { zombie: z, damage: ZOMBIE_DAMAGE });
        }
      }
      if (z.anim.done) {
        z.attackCooldown = ZOMBIE_COOLDOWN;
        z.state = "chase";
      }
      break;
    }
    case "hurt": {
      z.hurtTimer -= dt;
      if (z.hurtTimer <= 0 || z.anim.done) {
        z.state = "chase";
        z.repathTimer = 0;
      }
      break;
    }
  }

  advanceAnimation(z.anim, sheet, dt);
}
