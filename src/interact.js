// Interaction: what can be done to the world, and timed actions.
// See docs/04-gameplay.md.
//
// An action is { kind, label, tiles, range, duration, enabled, perform() }.
// `tiles` is where the target is; the player must be within `range` of one of
// them to perform it. Right-click builds a menu of every action under the
// cursor (actionsAt). E runs the nearest simple action (nearestSimpleAction).

import * as iso from "./iso.js";
import * as world from "./world.js";
import { getSheet } from "./assets.js";
import { isWalkable, inBounds, wallSpriteAt } from "./node.js";
import { getItem, rollLoot } from "./items.js";
import { addItem, removeItem, countItem, waterContainers } from "./inventory.js";
import { emit } from "./events.js";

export const INTERACT_RANGE = 1.15; // tiles
export const SEARCH_TIME = 1.0;
export const BOARD_TIME = 2.0;
export const UNBOARD_TIME = 1.5;

export function distToTiles(player, tiles) {
  let best = Infinity;
  for (const [tx, ty] of tiles) best = Math.min(best, Math.hypot(player.gx - tx, player.gy - ty));
  return best;
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ---- action builders ----

function itemActions(it, node, inv) {
  const def = getItem(it.item);
  return [{
    kind: "item",
    simple: true,
    label: `Pick up ${def.name}${it.fill != null ? ` (${Math.round(it.fill)}%)` : ""}${it.count > 1 ? ` (${it.count})` : ""}`,
    tiles: [it.tile],
    range: INTERACT_RANGE,
    duration: 0,
    enabled: true,
    perform() {
      const added = addItem(inv, it.item, it.count, it.fill != null ? { fill: it.fill } : {});
      if (added <= 0) {
        emit("message", { text: "Too heavy to carry." });
        return false;
      }
      it.count -= added;
      if (it.count <= 0) node.items.splice(node.items.indexOf(it), 1);
      emit("pickedUp", { item: it.item, count: added });
      return true;
    },
  }];
}

function containerActions(prop) {
  const name = prop.container;
  return [{
    kind: "container",
    simple: true,
    label: prop.searched ? `Open ${name}` : `Search ${name}`,
    tiles: prop.tiles,
    range: INTERACT_RANGE,
    duration: prop.searched ? 0 : SEARCH_TIME,
    enabled: true,
    perform() {
      if (!prop.searched) {
        prop.searched = true;
        // Anything already inside (a former survivor's backpack) stays as it is.
        if (!prop.contents.length) prop.contents = rollLoot(prop.lootTable || prop.container);
      }
      emit("containerOpened", { prop });
      return true;
    },
  }];
}

// Sinks and fountains (docs/20-thirst.md). Infinite until water shutoff exists.
const DRINK_TIME = 1.5;
const FILL_TIME = 2;

function waterActions(prop, player, inv) {
  const toFill = () => waterContainers(inv).filter((it) => (it.fill ?? 0) < 100);
  return [
    {
      kind: "water",
      simple: player.thirst < 90, // E only offers it when it would do something
      label: `Drink from ${prop.water}`,
      tiles: prop.tiles,
      range: INTERACT_RANGE,
      duration: DRINK_TIME,
      enabled: true,
      perform() {
        player.thirst = player.maxThirst;
        emit("drank", {});
        emit("message", { text: "You drink your fill." });
        return true;
      },
    },
    {
      kind: "fill",
      simple: false,
      label: "Fill bottles",
      tiles: prop.tiles,
      range: INTERACT_RANGE,
      duration: FILL_TIME,
      enabled: toFill().length > 0,
      perform() {
        const list = toFill();
        for (const it of list) it.fill = 100;
        emit("message", { text: list.length > 1 ? `Filled ${list.length} bottles.` : "Filled your bottle." });
        return list.length > 0;
      },
    },
  ];
}

function edgeActions(ref, node, inv, player) {
  const e = ref.edge;
  const out = [];
  const isInside = ref.side === e.inside;

  if (ref.threshold) {
    const dest = e[world.otherSide(ref.side)];
    const destName = world.getNode(dest.node).name;
    const open = world.canTraverse(e, ref.side, "player");
    const verb = e.kind === "stairs" ? "Take stairs to" : "Go to";
    out.push({
      kind: "edge",
      simple: false,
      label: open ? `${verb} ${destName}` : `${verb} ${destName} (boarded up)`,
      tiles: [ref.threshold],
      range: 0, // walk all the way onto the threshold; the crossing happens there
      duration: 0,
      enabled: open,
      goal: ref.threshold,
      perform() {
        return true;
      },
    });
  }

  if (isInside && (e.kind === "door" || e.kind === "window")) {
    const planks = countItem(inv, "plank");
    const verb = e.barricade ? "Reinforce" : "Board up";
    const hp = e.barricade ? ` (${e.barricade.hp} hp)` : "";
    out.push({
      kind: "edge",
      simple: false,
      label: planks > 0 ? `${verb} ${e.kind}${hp}` : `${verb} ${e.kind} (need a plank)`,
      tiles: [ref.tile],
      range: INTERACT_RANGE,
      duration: BOARD_TIME,
      enabled: planks > 0,
      perform() {
        if (countItem(inv, "plank") <= 0) return false;
        removeItem(inv, "plank", 1);
        world.barricadeEdge(e, getItem("plank").barricadeHp);
        // The threshold just became solid. Anyone with a toe over the line
        // steps back onto the room tile so they are not stuck inside it.
        if (ref.threshold && player) {
          const [tx, ty] = ref.threshold;
          const reach = 0.5 + (player.radius || 0.3);
          if (Math.abs(player.gx - tx) < reach && Math.abs(player.gy - ty) < reach) {
            player.gx = ref.tile[0];
            player.gy = ref.tile[1];
          }
        }
        emit("message", { text: `${verb === "Board up" ? "Boarded up" : "Reinforced"} the ${e.kind}.` });
        return true;
      },
    });
    if (e.barricade) {
      const n = e.barricade.planks || 1;
      out.push({
        kind: "edge",
        simple: false,
        label: `Remove boards (get ${n} plank${n > 1 ? "s" : ""} back)`,
        tiles: [ref.tile],
        range: INTERACT_RANGE,
        duration: UNBOARD_TIME,
        enabled: true,
        perform() {
          const planks = world.removeBarricade(e);
          const added = addItem(inv, "plank", planks);
          if (added < planks) emit("dropAtPlayer", { item: "plank", count: planks - added });
          emit("message", { text: `Took the boards off the ${e.kind}.` });
          return true;
        },
      });
    }
  }
  return out;
}

// The light switch: a simple action so E reaches it, since finding it matters.
function switchActions(node) {
  if (!node.switch) return [];
  return [{
    kind: "switch",
    simple: true,
    label: node.lightsOn ? "Turn lights off" : "Turn lights on",
    tiles: [node.switch.tile],
    range: INTERACT_RANGE,
    duration: 0,
    enabled: true,
    perform() {
      node.lightsOn = !node.lightsOn;
      emit("lightsToggled", { node });
      return true;
    },
  }];
}

function walkAction(tile) {
  return {
    kind: "floor",
    simple: false,
    label: "Walk here",
    tiles: [tile],
    range: 0,
    duration: 0,
    enabled: true,
    goal: tile,
    perform() {
      return true;
    },
  };
}

// ---- hit testing ----

function pointInRect(x, y, r) {
  return r && x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
}

function propRects(prop) {
  const sheet = getSheet(prop.sprite, prop.tiles.length);
  const b = sheet.bounds;
  return prop.tiles.map(([tx, ty], i) => {
    const f = sheet.frames[`idle_${i}`];
    if (!f) return null;
    const p = iso.toScreen(tx, ty);
    const x = Math.round(p.x) - sheet.anchor[0];
    const y = Math.round(p.y) - sheet.anchor[1];
    return b ? { x: x + b.x, y: y + b.y, w: b.w, h: b.h } : { x, y, w: f[2], h: f[3] };
  });
}

function wallSegmentRect(node, ref) {
  if (ref.wall !== "north" && ref.wall !== "west") return null; // near edges have no wall
  const wallSprite = wallSpriteAt(node, ref.wall, ref.wall === "west" ? ref.tile[1] : ref.tile[0]);
  if (!wallSprite) return null;
  const sheet = getSheet(wallSprite);
  const f = sheet.frames[`${ref.wall}_plain_0`];
  if (!f) return null;
  const p = iso.toScreen(ref.tile[0], ref.tile[1]);
  const anchor = ref.wall === "west" ? sheet.anchorWest : sheet.anchor;
  return { x: Math.round(p.x) - anchor[0], y: Math.round(p.y) - anchor[1], w: f[2], h: f[3] };
}

// Every action for whatever is under a canvas point.
// `bodies` are dead zombies, which are searchable containers.
export function actionsAt(sx, sy, player, node, inv, bodies = []) {
  const g = iso.toGrid(sx, sy);
  const tx = Math.round(g.gx);
  const ty = Math.round(g.gy);
  const out = [];
  const sameTile = (t) => t[0] === tx && t[1] === ty;

  for (const it of node.items) if (sameTile(it.tile)) out.push(...itemActions(it, node, inv));

  for (const prop of node.props) {
    if (!prop.container && !prop.water) continue;
    const onTile = prop.tiles.some(sameTile);
    const onSprite = propRects(prop).some((r) => pointInRect(sx, sy, r));
    if (!onTile && !onSprite) continue;
    if (prop.container) out.push(...containerActions(prop));
    if (prop.water) out.push(...waterActions(prop, player, inv));
  }

  for (const body of bodies) if (body.tiles.some(sameTile)) out.push(...containerActions(body));

  for (const ref of world.edgesOf(node.id)) {
    const onTile = sameTile(ref.tile) || (ref.threshold && sameTile(ref.threshold));
    const onWall = pointInRect(sx, sy, wallSegmentRect(node, ref));
    if (onTile || onWall) out.push(...edgeActions(ref, node, inv, player));
  }

  if (node.switch && sameTile(node.switch.tile)) out.push(...switchActions(node));

  if (!out.length && inBounds(node, tx, ty) && isWalkable(node, tx, ty)) out.push(walkAction([tx, ty]));
  return out;
}

// The nearest simple action (pick up, search) within range, for the E key.
export function nearestSimpleAction(player, node, inv, bodies = []) {
  let best = null;
  let bestD = Infinity;
  const consider = (actions) => {
    for (const a of actions) {
      if (!a.simple) continue;
      const d = distToTiles(player, a.tiles);
      if (d <= a.range && d < bestD) {
        best = a;
        bestD = d;
      }
    }
  };
  for (const it of node.items) consider(itemActions(it, node, inv));
  for (const prop of node.props) if (prop.container) consider(containerActions(prop));
  for (const prop of node.props) if (prop.water) consider(waterActions(prop, player, inv));
  for (const body of bodies) consider(containerActions(body));
  consider(switchActions(node));
  return best;
}

// ---- performing ----

// Start an action the player is already in range of. Timed ones go on player.action.
export function startAction(player, action) {
  if (!action || action.enabled === false) return false;
  if (action.duration <= 0) {
    action.perform();
    return true;
  }
  player.action = { action, elapsed: 0 };
  return true;
}

// Advance a timed action. Returns progress 0..1 or null when idle. Keyboard
// movement or drifting out of range cancels it.
export function updateAction(player, dt) {
  const a = player.action;
  if (!a) return null;
  if (player.moving || distToTiles(player, a.action.tiles) > a.action.range + 0.2) {
    player.action = null;
    return null;
  }
  a.elapsed += dt;
  if (a.elapsed >= a.action.duration) {
    player.action = null;
    a.action.perform();
    return null;
  }
  return a.elapsed / a.action.duration;
}

// A walkable tile within range of the action's tiles, nearest to the player.
export function approachTile(node, action, player) {
  if (action.goal) return action.goal;
  let best = null;
  let bestD = Infinity;
  for (const [tx, ty] of action.tiles) {
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const x = tx + dx;
        const y = ty + dy;
        if (!isWalkable(node, x, y)) continue;
        if (Math.hypot(dx, dy) > action.range) continue;
        const d = Math.hypot(player.gx - x, player.gy - y);
        if (d < bestD) {
          bestD = d;
          best = [x, y];
        }
      }
    }
  }
  return best;
}
