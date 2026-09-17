// Boot and game state.

import * as iso from "./iso.js";
import * as input from "./input.js";
import * as loop from "./loop.js";
import * as assets from "./assets.js";
import * as events from "./events.js";
import * as combat from "./combat.js";
import * as inventory from "./inventory.js";
import * as world from "./world.js";
import * as sim from "./sim.js";
import * as clock from "./clock.js";
import * as light from "./light.js";
import { loadItems, loadLoot, getItem } from "./items.js";
import { nearestWalkable } from "./node.js";
import { createPlayer, updatePlayer, damagePlayer, autoWalk, cancelAutoWalk } from "./entities/player.js";
import { createZombie, updateZombie, hearNoise } from "./entities/zombie.js";
import { renderNode, setNightTint } from "./render.js";
import { initHud, updateHud } from "./ui/hud.js";
import { initOverlay, showGameOver } from "./ui/overlay.js";
import { initPrompt, updatePrompt, showMessage, updateMessage } from "./ui/prompt.js";
import * as panel from "./ui/inventory-panel.js";
import * as menu from "./ui/context-menu.js";
import { actionsAt, nearestSimpleAction, startAction, updateAction, approachTile, distToTiles } from "./interact.js";
import { initSfx, sfx } from "./sfx.js";

const CANVAS_W = 960;
const CANVAS_H = 540;
const THRESHOLD_TRIGGER_DIST = 0.3; // tiles from a threshold tile center to cross
const EDGE_REARM_DIST = 0.6; // must move this far from the arrival tile before crossing again
const CONTAINER_CLOSE_DIST = 1.6;
const STARTING_ITEMS = [["bat", 1], ["pistol", 1], ["ammo_9mm", 12], ["flashlight", 1], ["candle", 2]];
const FLASHLIGHT_ALARM = 1.2; // alarm added to the current node per sim tick while on, outdoors, at night

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const ui = document.getElementById("ui");
const debugEl = document.getElementById("debug");
ctx.imageSmoothingEnabled = false;

let data = {};
let node = null;
let player = null;
let inv = null;
let zombies = [];
let gameOver = false;
let openContainer = null; // prop whose contents are shown beside the inventory

function resize() {
  const scale = Math.max(1, Math.floor(Math.min(window.innerWidth / CANVAS_W, window.innerHeight / CANVAS_H)));
  canvas.style.width = `${CANVAS_W * scale}px`;
  canvas.style.height = `${CANVAS_H * scale}px`;
  input.setScale(scale);
  // The UI layer is laid out in internal canvas pixels and scaled to match.
  const rect = canvas.getBoundingClientRect();
  ui.style.left = `${rect.left}px`;
  ui.style.top = `${rect.top}px`;
  ui.style.width = `${CANVAS_W}px`;
  ui.style.height = `${CANVAS_H}px`;
  ui.style.transform = `scale(${scale})`;
  ui.style.transformOrigin = "0 0";
}

function centerNode(n) {
  const w = n.width;
  const h = n.height;
  const originX = CANVAS_W / 2 + (h - w) * iso.HW / 2;
  const originY = CANVAS_H / 2 - (w + h - 2) * iso.HH / 2 + 24;
  iso.setOrigin(originX, originY);
}

// ---- zombies: records <-> entities ----

function tileOccupied(tx, ty) {
  for (const z of zombies) {
    if (z.dead) continue;
    if (Math.round(z.gx) === tx && Math.round(z.gy) === ty) return true;
  }
  return Math.round(player.gx) === tx && Math.round(player.gy) === ty;
}

function materialize(rec, tile) {
  const spot = nearestWalkable(node, tile[0], tile[1], tileOccupied) || tile;
  const z = createZombie(spot[0], spot[1], { id: rec.id, hp: rec.hp, aggro: rec.aggro, dead: rec.state === "dead" });
  zombies.push(z);
  return z;
}

function materializeNode() {
  zombies = [];
  for (const rec of sim.takeRecordsFor(node.id)) materialize(rec, rec.tile);
}

// ---- transitions ----

function transition(ref) {
  const edge = ref.edge;
  const dest = edge[world.otherSide(ref.side)];
  sim.dematerializeAll(zombies, node.id, ref);
  sim.onPlayerCrossed(edge);
  node = world.getNode(dest.node);
  world.setCurrent(node.id);
  centerNode(node);
  const destRef = world.refFor(edge, node.id);
  const landing = destRef?.threshold || dest.tile;
  player.gx = landing[0];
  player.gy = landing[1];
  player.arrivedTile = [...landing];
  player.action = null;
  cancelAutoWalk(player);
  menu.closeContextMenu();
  openContainer = null;
  combat.effects.length = 0;
  materializeNode();
  events.emit("playerMoved", { node: node.id, edge });
}

function checkTransitions() {
  if (player.arrivedTile) {
    const d = Math.hypot(player.gx - player.arrivedTile[0], player.gy - player.arrivedTile[1]);
    if (d < EDGE_REARM_DIST) return;
    player.arrivedTile = null;
  }
  for (const ref of world.edgesOf(node.id)) {
    if (!ref.threshold) continue;
    const d = Math.hypot(player.gx - ref.threshold[0], player.gy - ref.threshold[1]);
    if (d <= THRESHOLD_TRIGGER_DIST && world.canTraverse(ref.edge, ref.side, "player")) {
      transition(ref);
      return;
    }
  }
}

// ---- inventory actions ----

// Put items on the floor at the player's tile, merging with a matching pile.
function dropAt(id, count) {
  const tile = [Math.round(player.gx), Math.round(player.gy)];
  const existing = node.items.find((it) => it.item === id && it.tile[0] === tile[0] && it.tile[1] === tile[1]);
  if (existing) existing.count += count;
  else node.items.push({ item: id, tile, count });
}

// How many of an item move at once: whole stack for stackables, one otherwise.
function moveCount(id, available) {
  return getItem(id).stack ? available : 1;
}

const panelHandlers = {
  equip(id) {
    inventory.equip(inv, id);
  },
  use(id) {
    const def = getItem(id);
    if (def.kind === "tool") {
      toggleFlashlight();
      return;
    }
    if (def.kind !== "food") return;
    if (player.hp >= player.maxHp && player.hunger >= player.maxHunger) {
      showMessage("Not hungry right now.");
      return;
    }
    inventory.removeItem(inv, id, 1);
    player.hp = Math.min(player.maxHp, player.hp + (def.heal || 0));
    player.hunger = Math.min(player.maxHunger, player.hunger + (def.hunger || 0));
    showMessage(`Ate ${def.name}.`);
    sfx.eat();
  },
  drop(id) {
    const n = moveCount(id, inventory.countItem(inv, id));
    const removed = inventory.removeItem(inv, id, n);
    if (removed > 0) dropAt(id, removed);
  },
  take(id) {
    if (!openContainer) return;
    const stack = openContainer.contents.find((it) => it.id === id);
    if (!stack) return;
    const added = inventory.addItem(inv, id, stack.count);
    if (added <= 0) {
      showMessage("Too heavy to carry.");
      return;
    }
    stack.count -= added;
    if (stack.count <= 0) openContainer.contents.splice(openContainer.contents.indexOf(stack), 1);
  },
  store(id) {
    if (!openContainer) return;
    const n = moveCount(id, inventory.countItem(inv, id));
    const removed = inventory.removeItem(inv, id, n);
    if (removed <= 0) return;
    const stack = openContainer.contents.find((it) => it.id === id);
    if (stack) stack.count += removed;
    else openContainer.contents.push({ id, count: removed });
  },
};

function updateInventoryUi() {
  if (input.wasPressed("Tab")) {
    panel.toggle();
    if (!panel.isOpen()) openContainer = null;
  }
  if (openContainer) {
    let d = Infinity;
    for (const [tx, ty] of openContainer.tiles) d = Math.min(d, Math.hypot(player.gx - tx, player.gy - ty));
    if (d > CONTAINER_CLOSE_DIST) openContainer = null;
  }
  panel.renderInventoryPanel(inv, openContainer);
}

// ---- world interaction ----

// Do an action now if in range, else walk over and do it on arrival.
function runAction(action) {
  if (action.enabled === false) return;
  if (distToTiles(player, action.tiles) <= action.range) {
    startAction(player, action);
    return;
  }
  const goal = approachTile(node, action, player);
  const onArrive = (arrived) => {
    if (arrived) startAction(player, action);
    else if (action.kind !== "floor") showMessage("Can't reach that.");
  };
  if (!goal || !autoWalk(player, node, goal, { tiles: action.tiles, range: action.range, onArrive })) {
    showMessage("Can't get there from here.");
  }
}

function handleInteractionInput() {
  const m = input.getMouse();
  if (input.mouseRightPressed()) {
    const actions = actionsAt(m.x, m.y, player, node, inv);
    if (actions.length) {
      menu.openContextMenu(m.x, m.y, actions.map((a) => ({ label: a.label, enabled: a.enabled, onSelect: () => runAction(a) })), CANVAS_W, CANVAS_H);
    }
  }
  if (menu.isMenuOpen() && player.moving) menu.closeContextMenu();

  // E: the nearest simple thing (pick up, search).
  const simple = nearestSimpleAction(player, node, inv);
  if (input.wasPressed("KeyE") && simple && !player.action) startAction(player, simple);
}

// ---- flashlight ----

function toggleFlashlight() {
  if (inventory.countItem(inv, "flashlight") <= 0) {
    showMessage("No flashlight.");
    return;
  }
  player.flashlightOn = !player.flashlightOn;
  player.beam = getItem("flashlight").beam;
  showMessage(player.flashlightOn ? "Flashlight on." : "Flashlight off.");
}

// Dropping or storing the last flashlight switches it off.
function syncFlashlight() {
  if (player.flashlightOn && inventory.countItem(inv, "flashlight") <= 0) player.flashlightOn = false;
}

// ---- input ----

function hudState() {
  const weapon = inventory.equippedWeapon(inv);
  let ammoText = "";
  if (weapon && !weapon.melee) ammoText = `${inventory.countItem(inv, weapon.ammo)} rounds`;
  const hasLight = inventory.countItem(inv, "flashlight") > 0;
  const lightText = hasLight ? `Flashlight ${player.flashlightOn ? "on" : "off"} (F)` : "";
  return { player, node, weaponName: weapon ? weapon.name : "Unarmed", ammoText, lightText };
}

function handleCombatInput() {
  if (input.wasPressed("KeyF")) toggleFlashlight();
  // Debug: ] skips the clock forward one hour, so night can be tested without waiting.
  if (input.wasPressed("BracketRight")) {
    clock.update(clock.DAY_LENGTH / 24);
    showMessage(`Skipped to ${clock.getLabel()}.`);
  }
  if (input.wasPressed("Digit1")) inventory.equip(inv, "bat");
  if (input.wasPressed("Digit2")) inventory.equip(inv, "pistol");
  const wheel = input.takeWheel();
  if (wheel !== 0) inventory.cycleWeapon(inv, wheel > 0 ? 1 : -1);
  const dismissed = menu.tookClick();
  if (input.mouseLeftPressed() && !dismissed && !menu.isMenuOpen()) combat.tryAttack(player, inv, node, zombies);
}

// ---- loop hooks ----

function update(dt) {
  if (gameOver) {
    input.endStep();
    return;
  }
  clock.update(dt);
  light.update(node);
  handleCombatInput();
  updatePlayer(player, dt, node);
  checkGameOver(player.starving ? "starvation" : "zombie");
  if (gameOver) {
    input.endStep();
    return;
  }
  combat.updateCombat(player, inv, node, zombies, dt);
  const others = [player, ...zombies];
  for (const z of zombies) updateZombie(z, dt, node, player, others);
  checkTransitions();

  handleInteractionInput();
  const progress = updateAction(player, dt);
  if (player.action) {
    updatePrompt({ label: player.action.action.label, tile: player.action.action.tiles[0] }, progress);
  } else {
    const simple = nearestSimpleAction(player, node, inv);
    updatePrompt(simple ? { label: simple.label, tile: simple.tiles[0] } : null, null);
  }
  updateMessage(dt);
  updateInventoryUi();
  syncFlashlight();

  updateHud(hudState());
  input.endStep();
}

function simTick(dt) {
  if (gameOver) return;
  // Light in darkness is a tell the neighbourhood can feel.
  if (player.flashlightOn && node.outdoor && clock.nightFactor() > 0.2) sim.addAlarm(node.id, FLASHLIGHT_ALARM * clock.nightFactor());
  const arrivals = sim.tick(node.id, dt);
  for (const a of arrivals) {
    const ref = a.edge ? world.refFor(a.edge, node.id) : null;
    materialize(a.record, ref?.threshold || a.tile);
  }
}

function render() {
  ctx.fillStyle = "#1c1c24";
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  renderNode(ctx, node, [player, ...zombies], { wallVariantAt: world.wallVariantAt, player });
  combat.renderEffects(ctx);

  debugEl.textContent =
    `fps ${loop.getFps()}\n` +
    `node ${node.id}\n` +
    `player ${player.gx.toFixed(2)},${player.gy.toFixed(2)} ${player.facing} hp ${player.hp}\n` +
    `zombies here ${zombies.filter((z) => !z.dead).length}/${zombies.length}  records ${sim.count()}\n` +
    `nodes ${Object.entries(sim.nodeCounts()).map(([k, v]) => `${k}:${v}`).join(" ")}\n` +
    `alarm ${[...sim.alarm.entries()].map(([k, v]) => `${k}:${v.toFixed(1)}`).join(" ")}\n` +
    `${clock.getLabel()} phase=${clock.getPhase()} bright=${clock.getBrightness().toFixed(2)} hunger=${player.hunger.toFixed(0)} starving=${player.starving}\n` +
    `sim ${sim.debugSummary()}`;
}

// ---- events ----

// Single gate for ending the game, regardless of cause (zombie contact,
// starvation, and anything added later).
function checkGameOver(cause) {
  if (gameOver || player.hp > 0) return;
  gameOver = true;
  menu.closeContextMenu();
  showGameOver(startGame, cause);
}

function onPlayerHit({ damage }) {
  if (gameOver) return;
  damagePlayer(player, damage);
  checkGameOver("zombie");
}

function onNoise(ev) {
  if (ev.node === node.id) for (const z of zombies) hearNoise(z, ev.tile, ev.loudness);
  sim.onNoise(ev);
  if (ev.source === "glass" && ev.node === node.id) showMessage("Glass shatters somewhere in the house.");
}

function onEdgeChanged({ edge, change }) {
  if (change === "barricadeBroke") showMessage(`The boards on the ${edge.kind} give way!`, 3);
}

// ---- lifecycle ----

// Build (or rebuild) the world from data. Called at boot and on restart.
function startGame() {
  events.clearAll();
  events.on("playerHit", onPlayerHit);
  events.on("noise", onNoise);
  events.on("edgeChanged", onEdgeChanged);
  events.on("message", ({ text }) => showMessage(text));
  events.on("pickedUp", ({ item, count }) => showMessage(`Picked up ${getItem(item).name}${count > 1 ? ` x${count}` : ""}.`));
  events.on("containerOpened", ({ prop }) => {
    openContainer = prop;
    panel.setOpen(true);
  });
  events.on("dropAtPlayer", ({ item, count }) => dropAt(item, count));
  events.on("lightsToggled", ({ node: n }) => {
    showMessage(n.lightsOn ? "Lights on." : "Lights off.");
    sfx.dry();
  });
  // Placeholder sounds.
  events.on("noise", (ev) => (ev.source === "glass" ? sfx.glass() : sfx.gunshot()));
  events.on("meleeSwing", () => sfx.swing());
  events.on("meleeHit", () => sfx.hit());
  events.on("zombieDied", () => sfx.die());
  events.on("pickedUp", () => sfx.pickup());
  events.on("dryFire", () => sfx.dry());
  events.on("playerHit", () => sfx.hurt());
  events.on("edgeChanged", ({ change }) => (change === "barricaded" ? sfx.board() : null));
  combat.effects.length = 0;
  openContainer = null;
  panel.setOpen(false);
  menu.closeContextMenu();

  world.loadWorld({ nodes: data.nodes, edges: data.edges });
  sim.reset();
  clock.reset();
  light.resetCache();
  node = world.getNode(data.start);
  world.setCurrent(node.id);
  centerNode(node);
  player = createPlayer(node.spawns.player[0], node.spawns.player[1]);
  inv = inventory.createInventory();
  for (const [id, count] of STARTING_ITEMS) inventory.addItem(inv, id, count);
  inventory.equip(inv, "bat");

  // Every zombie starts as a record in its spawn node.
  let n = 1;
  for (const nd of world.world.nodes.values()) {
    for (const tile of nd.spawns.zombies || []) {
      sim.addRecord({ id: `z${n++}`, node: nd.id, tile: [...tile], state: "idle", targetEdge: null, timer: 0, hp: 100, aggro: false });
    }
  }
  materializeNode();
  gameOver = false;
  updateHud(hudState());
}

// Debug: ?sheet=<sprite id>[&scale=2] renders a sprite sheet instead of the game.
async function showSheet(id, scale) {
  const sheet = await assets.loadSprite(id);
  ctx.fillStyle = "#223";
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  const img = sheet.image;
  ctx.drawImage(img, 0, 0, img.width, img.height, 8, 8, img.width * scale, img.height * scale);
  debugEl.textContent = `sheet ${id} ${img.width}x${img.height} frames ${Object.keys(sheet.frames).length}`;
}

async function boot() {
  input.init(canvas);
  window.addEventListener("resize", resize);
  resize();

  const params = new URLSearchParams(location.search);
  if (params.has("sheet")) {
    await showSheet(params.get("sheet"), Number(params.get("scale") || 2));
    return;
  }

  const worldJson = await assets.loadJson("data/world.json");
  const [nodes, edges, items, loot] = await Promise.all([
    Promise.all(worldJson.nodes.map((id) => assets.loadJson(`data/nodes/${id}.json`))),
    assets.loadJson(worldJson.edges || "data/edges.json"),
    assets.loadJson("data/items.json"),
    assets.loadJson("data/loot.json"),
  ]);
  data = { nodes, edges, start: worldJson.start || nodes[0].id };
  loadItems(items);
  loadLoot(loot);
  await Promise.all([
    ...nodes.map((n) => assets.loadNodeSprites(n)),
    assets.loadSprite("player"),
    assets.loadSprite("zombie"),
    assets.loadSprite("floor_door"),
    // Any item can end up on the floor, so every item sprite loads up front.
    ...items.map((def) => assets.loadSprite(`item_${def.id}`)),
  ]);

  initHud();
  initOverlay();
  initPrompt();
  initSfx();
  menu.initContextMenu();
  panel.initInventoryPanel(panelHandlers);
  startGame();

  loop.start({ update, render, simTick }, { simIntervalMs: 1000 });
  window.__game = {
    iso, input, loop, assets, events, combat, inventory, world, sim, clock, light, getItem, menu,
    get node() { return node; },
    get player() { return player; },
    get inv() { return inv; },
    get zombies() { return zombies; },
    get gameOver() { return gameOver; },
    get openContainer() { return openContainer; },
    panel,
    panelHandlers,
    restart: startGame,
    setNightTint,
    setHour(h) {
      const target = (h / 24) * clock.DAY_LENGTH;
      clock.update(target - (clock.getElapsed() % clock.DAY_LENGTH));
    },
    transition,
    runAction,
    actionsAt: (sx, sy) => actionsAt(sx, sy, player, node, inv),
  };
}

boot().catch((err) => {
  console.error(err);
  debugEl.textContent = `boot failed: ${err.message}`;
});
