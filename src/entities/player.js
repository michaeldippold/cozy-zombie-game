// The player. See docs/04-gameplay.md.

import * as iso from "../iso.js";
import * as input from "../input.js";
import { moveCircle } from "../node.js";
import { findPath } from "../pathfind.js";
import { getSheet } from "../assets.js";
import { createAnimation, playAnimation, advanceAnimation } from "../sprites.js";
import { emit } from "../events.js";

export const PLAYER_SPEED = 3.0; // tiles per second
export const PLAYER_RADIUS = 0.3;
export const PLAYER_HP = 100;
export const PLAYER_STAMINA = 100;
export const SPRINT_MULT = 1.75;
export const SPRINT_DRAIN = 40; // stamina per second while sprinting and moving
export const STAMINA_REGEN = 22; // stamina per second while not sprinting
export const SPRINT_RECOVER_AT = 20; // after emptying, cannot sprint until above this
// Aim and shots originate from the chest, this many pixels above the feet.
export const AIM_Y = 22;

export const HUNGER_MAX = 100;
// Full drain over 10 minutes of continuous play. Food is the counter.
export const HUNGER_DRAIN = HUNGER_MAX / 600;
export const STARVE_DAMAGE = 3; // hp per second while hunger is at 0

export function createPlayer(gx, gy) {
  return {
    kind: "player",
    sprite: "player",
    gx,
    gy,
    facing: "s",
    aim: { sx: 0, sy: 1 }, // unit screen vector from the chest toward the mouse
    speed: PLAYER_SPEED,
    radius: PLAYER_RADIUS,
    hp: PLAYER_HP,
    maxHp: PLAYER_HP,
    stamina: PLAYER_STAMINA,
    maxStamina: PLAYER_STAMINA,
    sprinting: false,
    winded: false,
    hunger: HUNGER_MAX,
    maxHunger: HUNGER_MAX,
    starving: false,
    flashlightOn: false,
    beam: null, // { range, arc } from the flashlight item while one is carried
    moving: false, // keyboard movement this step
    anim: createAnimation("idle"),
    attackCooldown: 0,
    pendingMelee: null,
    action: null, // timed interaction in progress
    arrivedTile: null, // edge threshold we just arrived on; re-arms after moving away
    auto: null, // auto-walk: { path, tiles, range, onArrive }
  };
}

export function damagePlayer(player, amount) {
  if (player.hp <= 0) return;
  player.hp = Math.max(0, player.hp - amount);
  if (player.hp > 0) playAnimation(player.anim, "hurt", true);
}

// Hunger drains steadily; at zero it costs health instead, quietly (no hurt
// flinch, this isn't an attack). Returns true the instant starving begins.
function updateHunger(player, dt) {
  player.hunger = Math.max(0, player.hunger - HUNGER_DRAIN * dt);
  const wasStarving = player.starving;
  player.starving = player.hunger <= 0;
  if (player.starving) player.hp = Math.max(0, player.hp - STARVE_DAMAGE * dt);
  if (player.starving && !wasStarving) emit("message", { text: "You are starving. Find food." });
}

// Screen position of the aim origin (chest).
export function aimOrigin(player) {
  const p = iso.toScreen(player.gx, player.gy);
  return { x: p.x, y: p.y - AIM_Y };
}

// Walk to goalTile along a path, or stop as soon as any of `tiles` is within
// `range`. Calls onArrive once. Returns false if there is no path.
export function autoWalk(player, node, goalTile, { tiles = [goalTile], range = 0, onArrive = null } = {}) {
  const from = [Math.round(player.gx), Math.round(player.gy)];
  const path = findPath(node, from, goalTile);
  if (!path) return false;
  player.auto = { path, tiles, range, onArrive, goalTile };
  return true;
}

export function cancelAutoWalk(player) {
  player.auto = null;
}

function distToTiles(player, tiles) {
  let best = Infinity;
  for (const [tx, ty] of tiles) best = Math.min(best, Math.hypot(player.gx - tx, player.gy - ty));
  return best;
}

function moveToward(player, dt, node, dx, dy, mult = 1) {
  const n = iso.normalize(dx, dy);
  const step = player.speed * mult * dt;
  const moved = moveCircle(node, player.gx, player.gy, player.radius, n.x * step, n.y * step);
  player.gx = moved.gx;
  player.gy = moved.gy;
}

// Returns true while still walking.
function followAuto(player, dt, node) {
  const a = player.auto;
  if (a.range > 0 && distToTiles(player, a.tiles) <= a.range) return finishAuto(player);
  while (a.path.length) {
    const [tx, ty] = a.path[0];
    const dx = tx - player.gx;
    const dy = ty - player.gy;
    const d = Math.hypot(dx, dy);
    if (d < 0.08) {
      a.path.shift();
      continue;
    }
    const before = [player.gx, player.gy];
    moveToward(player, dt, node, dx, dy, player.sprinting ? SPRINT_MULT : 1);
    if (Math.hypot(player.gx - before[0], player.gy - before[1]) < 1e-4) return finishAuto(player); // stuck
    return true;
  }
  return finishAuto(player);
}

// Ends the walk. onArrive receives whether the player actually got there, so
// a blocked walk never performs the action from across the room.
function finishAuto(player) {
  const a = player.auto;
  player.auto = null;
  if (!a?.onArrive) return false;
  const arrived = a.range > 0
    ? distToTiles(player, a.tiles) <= a.range
    : Math.hypot(player.gx - a.goalTile[0], player.gy - a.goalTile[1]) <= 0.35;
  a.onArrive(arrived);
  return false;
}

export function updatePlayer(player, dt, node) {
  const sheet = getSheet(player.sprite);
  updateHunger(player, dt);

  // Movement: keys snap to the eight iso directions (docs/03). Any key press
  // cancels an auto-walk.
  const axis = input.moveAxis();
  player.moving = axis.x !== 0 || axis.y !== 0;
  if (player.moving) player.auto = null;

  // Sprint: hold Shift. Drains stamina while moving; empties into a "winded"
  // state that lasts until stamina recovers a little.
  const wantSprint = input.isDown("ShiftLeft") || input.isDown("ShiftRight");
  const anyMovement = player.moving || !!player.auto;
  if (player.winded && player.stamina >= SPRINT_RECOVER_AT) player.winded = false;
  player.sprinting = wantSprint && anyMovement && !player.winded && player.stamina > 0;
  if (player.sprinting) {
    player.stamina = Math.max(0, player.stamina - SPRINT_DRAIN * dt);
    if (player.stamina <= 0) player.winded = true;
  } else {
    player.stamina = Math.min(player.maxStamina, player.stamina + STAMINA_REGEN * dt);
  }

  let walking = false;
  if (player.moving) {
    const f = iso.facingFromScreenVector(axis.x, axis.y);
    const [dx, dy] = iso.DIRS[f];
    moveToward(player, dt, node, dx, dy, player.sprinting ? SPRINT_MULT : 1);
    walking = true;
  } else if (player.auto) {
    walking = followAuto(player, dt, node);
  }

  // Aim: mouse relative to the chest.
  const m = input.getMouse();
  const o = aimOrigin(player);
  const ax = m.x - o.x;
  const ay = m.y - o.y;
  if (ax !== 0 || ay !== 0) {
    const n = iso.normalize(ax, ay);
    player.aim.sx = n.x;
    player.aim.sy = n.y;
    player.facing = iso.facingFromScreenVector(ax, ay);
  }

  // Animation: one-shot animations (attack, hurt) play out before idle/walk resume.
  const oneShot = player.anim.name === "attack" || player.anim.name === "hurt";
  if (!oneShot || player.anim.done) {
    playAnimation(player.anim, walking ? "walk" : "idle");
  }
  advanceAnimation(player.anim, sheet, dt);
}
