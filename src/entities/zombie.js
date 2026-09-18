// Zombies inside the player's node. Dumb on purpose. See docs/04-gameplay.md.

import * as iso from "../iso.js";
import { moveCircle, isWalkable } from "../node.js";
import { findPath, lineOfSight } from "../pathfind.js";
import { getSheet } from "../assets.js";
import { createAnimation, playAnimation, advanceAnimation, isActiveFrame } from "../sprites.js";
import { emit } from "../events.js";
import { lightAt, inBeam } from "../light.js";
import * as clock from "../clock.js";
import { containerGrid } from "../items.js";
import { BAG_COLS, BAG_ROWS } from "../inventory.js";

export const ZOMBIE_SPEED = 1.0; // tiles per second: Romero shamblers (docs/22)
export const ZOMBIE_SIGHT = 6; // tiles, in full light
// In full dark with the player unlit, sight range is this fraction of ZOMBIE_SIGHT.
export const SIGHT_MIN_FRAC = 0.35;
export const ZOMBIE_CONTACT = 0.7; // tiles
export const ZOMBIE_DAMAGE = 8;
export const ZOMBIE_COOLDOWN = 1.2; // seconds
export const ZOMBIE_HP = 100;
export const ZOMBIE_REPATH = 0.3; // seconds
export const ZOMBIE_RADIUS = 0.3;
const RISE_TIME = 1.2; // a former survivor getting back up (docs/18)
const DOWN_TIME = 2.0; // knocked down (docs/22)
// Wind-up and lunge (docs/22, built to be tried and maybe removed).
export const WINDUP_TIME = 0.4;
const LUNGE_PUSH = 0.35; // knock impulse: the total travel in tiles, like weapon knockback
const LEAN_PX = 5; // how far the sprite leans back during the wind-up
const LUNGE_HIT_REACH = ZOMBIE_CONTACT + 0.35;
const GET_UP_TIME = 0.6;
const WANDER_IDLE_MIN = 1.5;
const WANDER_IDLE_MAX = 4.0;
const SEPARATION = 0.55;

let nextId = 1;

// A body is a searchable container (docs/19-bodies.md): once dead, a zombie
// quacks like a container prop (`container`, `searched`, `contents`, `tiles`).
// `former` marks a turned survivor: it draws in the survivor's clothes and its
// `loot` is their backpack. Everyone else rolls the "zombie" table when first
// searched. `rising` starts it on the floor.
export function createZombie(gx, gy, { id = null, hp = ZOMBIE_HP, aggro = false, dead = false, former = false, loot = null, searched = false, rising = false, diedAt = null } = {}) {
  if (dead) {
    const z = createZombie(gx, gy, { id, hp: 0, former, loot, searched });
    z.dead = true;
    z.diedAt = diedAt;
    z.state = "die";
    playAnimation(z.anim, "die", true);
    z.anim.frame = 3;
    z.anim.done = true;
    return z;
  }
  const z = {
    kind: "zombie",
    sprite: former ? "zombie_survivor" : "zombie",
    former,
    container: former ? "your old self" : "body",
    lootTable: "zombie",
    searched,
    contents: loot ? loot.map((i) => ({ ...i })) : [],
    // A body is a grid bag. A former survivor's is the backpack they died with.
    cols: former ? BAG_COLS : containerGrid("zombie")[0],
    rows: former ? BAG_ROWS : containerGrid("zombie")[1],
    get items() {
      return this.contents;
    },
    get tiles() {
      return [[Math.round(this.gx), Math.round(this.gy)]];
    },
    riseTimer: 0,
    riseDuration: RISE_TIME,
    downTimer: 0,
    flashTimer: 0,
    hitCombo: 0,
    lastHitAt: -99,
    diedAt: null, // clock time of death; bodies despawn 48 in-game hours later
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
    windupTimer: 0,
    leanX: 0,
    leanY: 0,
    hurtTimer: 0,
    dead: false,
    knock: { x: 0, y: 0 },
  };
  if (rising) {
    z.state = "rise";
    z.riseTimer = RISE_TIME;
    z.riseDuration = RISE_TIME;
    playAnimation(z.anim, "die", true);
    z.anim.frame = 3;
    z.anim.done = true;
  }
  return z;
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
  if (player.dead) return false;
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
    if (o.state === "down") continue;
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
    z.diedAt = clock.getElapsed();
    z.state = "die";
    z.path = [];
    playAnimation(z.anim, "die", true);
    emit("zombieDied", { zombie: z });
  } else if (z.state === "down") {
    // Stays down; a hit buys a little more floor time.
    z.downTimer = Math.max(z.downTimer, 0.8);
  } else {
    stagger(z, 0.25);
  }
}

export function stagger(z, seconds) {
  if (z.dead || z.state === "die" || z.state === "down") return;
  z.state = "hurt";
  z.hurtTimer = seconds;
  z.path = [];
  playAnimation(z.anim, "hurt", true);
}

// Floor a zombie for DOWN_TIME. Drawn lying (a fall frame), does nothing.
export function knockDown(z) {
  if (z.dead || z.state === "die") return;
  z.state = "down";
  z.downTimer = DOWN_TIME;
  z.path = [];
  z.attackHit = true; // cancels a bite in progress
  playAnimation(z.anim, "die", true);
  z.anim.frame = 2;
  z.anim.done = true;
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

  // Getting back up: the fall animation, backwards.
  if (z.state === "rise") {
    z.riseTimer -= dt;
    z.anim.frame = Math.max(0, Math.min(3, Math.ceil((z.riseTimer / z.riseDuration) * 4) - 1));
    if (z.riseTimer <= 0) {
      z.state = z.aggro ? "chase" : "idle";
      z.repathTimer = 0;
      playAnimation(z.anim, "idle", true);
    }
    return;
  }

  // Knocked down: lying still, then getting up (docs/22-melee.md).
  if (z.state === "down") {
    applyKnockback(z, dt, node);
    z.downTimer -= dt;
    if (z.downTimer <= 0) {
      z.state = "rise";
      z.riseTimer = GET_UP_TIME;
      z.riseDuration = GET_UP_TIME;
    }
    return;
  }

  applyKnockback(z, dt, node);
  z.attackCooldown = Math.max(0, z.attackCooldown - dt);
  z.repathTimer -= dt;
  z.leanX = 0;
  z.leanY = 0;

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
          // Wind up first: a beat the player can read and act on.
          z.state = "windup";
          z.windupTimer = WINDUP_TIME;
          playAnimation(z.anim, "attack", true);
          z.anim.frame = 0;
          emit("zombieWindup", { zombie: z });
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
    case "windup": {
      // Stand still, face the player, lean back; then lunge. A hit in this
      // window staggers the zombie (damageZombie) and cancels the bite.
      faceToward(z, player.gx - z.gx, player.gy - z.gy);
      z.anim.frame = 0;
      z.windupTimer -= dt;
      const sd = iso.gridDirToScreen(player.gx - z.gx, player.gy - z.gy);
      const sn = Math.hypot(sd.sx, sd.sy) || 1;
      const t = 1 - Math.max(0, z.windupTimer / WINDUP_TIME);
      z.leanX = (-sd.sx / sn) * LEAN_PX * t;
      z.leanY = (-sd.sy / sn) * LEAN_PX * t;
      if (z.windupTimer <= 0) {
        z.state = "attack";
        z.attackHit = false;
        playAnimation(z.anim, "attack", true);
        const n = iso.normalize(player.gx - z.gx, player.gy - z.gy);
        z.knock = { x: n.x * LUNGE_PUSH, y: n.y * LUNGE_PUSH };
        emit("zombieLunge", { zombie: z });
      }
      break;
    }
    case "attack": {
      if (isActiveFrame(z.anim, sheet) && !z.attackHit) {
        z.attackHit = true;
        if (distTo(z, player) <= LUNGE_HIT_REACH) {
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
