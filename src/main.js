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
import * as save from "./save.js";
import * as grid from "./grid.js";
import { loadItems, loadLoot, getItem } from "./items.js";
import { nearestWalkable } from "./node.js";
import { createPlayer, updatePlayer, damagePlayer, autoWalk, cancelAutoWalk } from "./entities/player.js";
import { createZombie, updateZombie, hearNoise } from "./entities/zombie.js";
import { renderNode, setNightTint } from "./render.js";
import { initHud, updateHud } from "./ui/hud.js";
import { initOverlay, showDeath, showStartScreen, showPause, hideOverlay } from "./ui/overlay.js";
import { playAnimation, advanceAnimation } from "./sprites.js";
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
const STARTING_ITEMS = [["bat", 1], ["pistol", 1], ["ammo_9mm", 12], ["flashlight", 1], ["candle", 2], ["water_bottle", 1, { fill: 100 }]];
// Later survivors start light; the rest is on the last one (docs/18).
const SURVIVOR_ITEMS = [["bat", 1], ["flashlight", 1], ["water_bottle", 1, { fill: 0 }]];
const AUTO_DRINK_AT = 60; // thirst level at which you drink from a carried bottle by yourself
const TURN_AT = 1.5; // seconds after death that the former self gets up
const CARD_AT = 3.2; // seconds after death that the death card appears
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
let survivor = 1; // how many characters this world has had
let death = null; // { t, cause, turned, carded } while the player is dead
let started = false; // a game has been started or continued; nothing saves before this
let pauseOpen = false;
let autosaveTimer = 0;
const AUTOSAVE_SECONDS = 60;

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
  const z = createZombie(spot[0], spot[1], { id: rec.id, hp: rec.hp, aggro: rec.aggro, dead: rec.state === "dead", former: rec.former, loot: rec.loot, searched: rec.searched, diedAt: rec.diedAt });
  zombies.push(z);
  return z;
}

// Dead zombies in the room: searchable like containers (docs/19-bodies.md).
function bodies() {
  return zombies.filter((z) => z.dead);
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
  saveGame();
}

// ---- save / load (docs/15-save-load.md) ----

// Each module serializes its own state; this only assembles the snapshot.
function snapshot() {
  return {
    version: save.SAVE_VERSION,
    savedAt: Date.now(),
    clock: clock.getElapsed(),
    survivor,
    player: {
      dead: gameOver,
      node: node.id,
      gx: player.gx,
      gy: player.gy,
      facing: player.facing,
      hp: player.hp,
      stamina: player.stamina,
      hunger: player.hunger,
      thirst: player.thirst,
      flashlightOn: player.flashlightOn,
    },
    inv: { items: inv.items.map((i) => ({ ...i })), equipped: inv.equipped },
    world: world.serialize(),
    sim: sim.serialize(zombies, node.id),
  };
}

// Build a fresh world, then lay the snapshot over it. Throws if the snapshot
// does not fit this world; callers fall back to a new game.
function applySnapshot(s) {
  startGame();
  for (const it of s.inv.items) getItem(it.id);
  for (const n of Object.values(s.world.nodes)) for (const it of n.items) getItem(it.item);
  world.restore(s.world);
  sim.restore(s.sim);
  clock.setElapsed(s.clock);
  node = world.getNode(s.player.node);
  world.setCurrent(node.id);
  centerNode(node);
  player.gx = s.player.gx;
  player.gy = s.player.gy;
  player.facing = s.player.facing || "s";
  player.hp = s.player.hp;
  player.stamina = s.player.stamina;
  player.hunger = s.player.hunger;
  player.thirst = s.player.thirst ?? player.maxThirst;
  player.flashlightOn = !!s.player.flashlightOn;
  player.beam = player.flashlightOn ? getItem("flashlight").beam : null;
  // Do not cross a door we happen to be standing in the moment we load.
  player.arrivedTile = [Math.round(player.gx), Math.round(player.gy)];
  inv.items = s.inv.items.map((i) => ({ ...i }));
  inv.equipped = s.inv.equipped;
  survivor = s.survivor || 1;
  light.resetCache();
  materializeNode();
  // Saved on the death card: the world goes on with someone new.
  if (s.player.dead) newSurvivor();
  updateHud(hudState());
}

// `force` is for the one save made while dead, at the moment of turning.
function saveGame(force = false) {
  if (!started || (gameOver && !force)) return false;
  autosaveTimer = 0;
  return save.write(snapshot());
}

function loadSaved() {
  const s = save.read();
  if (!s) return false;
  try {
    applySnapshot(s);
    return true;
  } catch (err) {
    console.warn("Save could not be loaded and was discarded:", err);
    save.clear();
    startGame();
    return false;
  }
}

function saveLabel() {
  const s = save.read();
  if (!s) return null;
  const n = data.nodes.find((d) => d.id === s.player?.node);
  const who = (s.survivor || 1) > 1 || s.player?.dead ? `Survivor ${(s.survivor || 1) + (s.player?.dead ? 1 : 0)} · ` : "";
  const where = s.player?.dead ? "a new arrival" : n ? n.name : "somewhere";
  return { label: `${who}${clock.formatLabel(s.clock || 0)} · ${where}` };
}

// ---- start screen and pause ----

function openStartScreen() {
  started = false;
  pauseOpen = false;
  loop.setPaused(true);
  showStartScreen({ save: saveLabel(), onContinue: continueGame, onNew: newGame });
}

function newGame() {
  save.clear();
  startGame();
  started = true;
  hideOverlay();
  loop.setPaused(false);
}

function continueGame() {
  const ok = loadSaved();
  started = true;
  saveGame(); // a death save has just become a new survivor; record that now
  hideOverlay();
  loop.setPaused(false);
  if (!ok) showMessage("That save could not be loaded. Starting fresh.", 4);
  return ok;
}

function togglePause() {
  if (!started || gameOver) return;
  if (pauseOpen) {
    pauseOpen = false;
    hideOverlay();
    loop.setPaused(false);
    return;
  }
  pauseOpen = true;
  loop.setPaused(true);
  showPause({
    onResume: togglePause,
    onQuit: () => {
      saveGame();
      openStartScreen();
    },
  });
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
function dropAt(id, count, props = {}) {
  const tile = [Math.round(player.gx), Math.round(player.gy)];
  // Items with their own state (a bottle's fill) never merge into a pile.
  const existing = props.fill == null && node.items.find((it) => it.item === id && it.fill == null && it.tile[0] === tile[0] && it.tile[1] === tile[1]);
  if (existing) existing.count += count;
  else node.items.push({ item: id, tile, count, ...props });
}

// Per-instance state that travels with an entry when it moves.
function propsOf(entry) {
  return entry.fill != null ? { fill: entry.fill } : {};
}

// Drink from one water container: only as much as is needed.
function drinkFrom(entry) {
  const cap = getItem(entry.id).capacity;
  const need = player.maxThirst - player.thirst;
  const have = (entry.fill / 100) * cap;
  const amount = Math.min(need, have);
  if (amount <= 0) return 0;
  player.thirst += amount;
  entry.fill = Math.max(0, Math.round(entry.fill - (amount / cap) * 100));
  return amount;
}

// You drink by yourself when thirsty and carrying water, emptiest bottle first
// (docs/20-thirst.md). The thirst moodle therefore means "out of water".
function autoDrink() {
  if (player.thirst >= AUTO_DRINK_AT) return;
  const bottles = inventory.waterContainers(inv).filter((it) => it.fill > 0).sort((a, b) => a.fill - b.fill);
  if (!bottles.length) return;
  for (const b of bottles) {
    drinkFrom(b);
    if (player.thirst >= player.maxThirst - 0.5) break;
  }
  showMessage("You take a drink from your bottle.");
  sfx.eat();
}

// ---- inventory panel (docs/21-grid-inventory.md) ----

// Use an entry from the backpack: eat, drink, toggle.
function useEntry(entry) {
  const def = getItem(entry.id);
  if (def.kind === "tool") {
    toggleFlashlight();
    return;
  }
  if (def.kind === "drink") {
    if (!(entry.fill > 0)) return;
    if (drinkFrom(entry) <= 0) showMessage("Not thirsty right now.");
    else sfx.eat();
    return;
  }
  if (def.kind !== "food") return;
  const wantsFood = player.hp < player.maxHp || player.hunger < player.maxHunger;
  const wantsDrink = (def.thirst || 0) > 0 && player.thirst < player.maxThirst;
  if (!wantsFood && !wantsDrink) {
    showMessage(def.verb === "Drink" ? "Not thirsty right now." : "Not hungry right now.");
    return;
  }
  entry.count -= 1;
  if (entry.count <= 0) inventory.removeEntry(inv, entry);
  player.hp = Math.min(player.maxHp, player.hp + (def.heal || 0));
  player.hunger = Math.min(player.maxHunger, player.hunger + (def.hunger || 0));
  player.thirst = Math.max(0, Math.min(player.maxThirst, player.thirst + (def.thirst || 0)));
  showMessage(`${def.verb === "Drink" ? "Drank" : "Ate"} ${def.name}.`);
  sfx.eat();
}

// Put a whole entry on the floor at the player's feet, from any open bag.
function dropEntry(entry, bag) {
  grid.remove(bag, entry);
  dropAt(entry.id, entry.count, propsOf(entry));
  inventory.fixEquipped(inv);
}

const panelHandlers = {
  // Anything moved: the equipped weapon may have left the bag.
  changed() {
    inventory.fixEquipped(inv);
  },
  dropToFloor(entry, bag) {
    dropEntry(entry, bag);
  },
  noRoom(intoBag) {
    showMessage(intoBag ? "No room in your bag." : "No room in there.");
  },
  // Right-click menu for an item. `other` is the other open bag, or null.
  itemMenu(entry, bag, other) {
    const def = getItem(entry.id);
    const mine = bag === inv;
    const out = [];
    if (mine && def.kind === "weapon") out.push({ label: inv.equipped === entry.id ? "Equipped" : "Equip", enabled: inv.equipped !== entry.id, onSelect: () => inventory.equip(inv, entry.id) });
    if (mine && def.kind === "food") out.push({ label: def.verb || "Eat", enabled: true, onSelect: () => useEntry(entry) });
    if (mine && def.kind === "drink") out.push({ label: `Drink (${Math.round(entry.fill || 0)}%)`, enabled: entry.fill > 0, onSelect: () => useEntry(entry) });
    if (mine && def.kind === "tool") out.push({ label: "Toggle (F)", enabled: true, onSelect: () => useEntry(entry) });
    if (other) {
      out.push({
        label: mine ? "Store" : "Take",
        enabled: true,
        onSelect: () => {
          if (!grid.transfer(bag, other, entry)) panelHandlers.noRoom(other === inv);
        },
      });
    }
    if (def.kind === "light") {
      // Placing sets down one candle, not the stack.
      out.push({
        label: "Place",
        enabled: true,
        onSelect: () => {
          entry.count -= 1;
          if (entry.count <= 0) grid.remove(bag, entry);
          dropAt(entry.id, 1);
        },
      });
      if (entry.count > 1) out.push({ label: "Drop all", enabled: true, onSelect: () => dropEntry(entry, bag) });
    } else {
      out.push({ label: "Drop", enabled: true, onSelect: () => dropEntry(entry, bag) });
    }
    return out;
  },
  // Kept for scripted tests.
  useEntry,
  dropEntry,
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
    const actions = actionsAt(m.x, m.y, player, node, inv, bodies());
    if (actions.length) {
      menu.openContextMenu(m.x, m.y, actions.map((a) => ({ label: a.label, enabled: a.enabled, onSelect: () => runAction(a) })), CANVAS_W, CANVAS_H);
    }
  }
  if (menu.isMenuOpen() && player.moving) menu.closeContextMenu();

  // E: the nearest simple thing (pick up, search).
  const simple = nearestSimpleAction(player, node, inv, bodies());
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
    afterlife(dt);
    input.endStep();
    return;
  }
  clock.update(dt);
  light.update(node);
  handleCombatInput();
  updatePlayer(player, dt, node);
  checkGameOver(player.starving ? "starvation" : player.dehydrated ? "thirst" : "zombie");
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
    const simple = nearestSimpleAction(player, node, inv, bodies());
    updatePrompt(simple ? { label: simple.label, tile: simple.tiles[0] } : null, null);
  }
  updateMessage(dt);
  updateInventoryUi();
  syncFlashlight();
  autoDrink();

  autosaveTimer += dt;
  if (autosaveTimer >= AUTOSAVE_SECONDS) saveGame();

  updateHud(hudState());
  input.endStep();
}

function simTick(dt) {
  // The sim keeps running while the player is dead: the world goes on.
  // Light in darkness is a tell the neighbourhood can feel.
  if (!gameOver && player.flashlightOn && node.outdoor && clock.nightFactor() > 0.2) sim.addAlarm(node.id, FLASHLIGHT_ALARM * clock.nightFactor());
  const arrivals = sim.tick(node.id, dt);
  for (const a of arrivals) {
    const ref = a.edge ? world.refFor(a.edge, node.id) : null;
    materialize(a.record, ref?.threshold || a.tile);
  }
}

function render() {
  ctx.fillStyle = "#1c1c24";
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  renderNode(ctx, node, death?.turned ? zombies : [player, ...zombies], { wallVariantAt: world.wallVariantAt, player });
  combat.renderEffects(ctx);

  debugEl.textContent =
    `fps ${loop.getFps()}\n` +
    `node ${node.id}\n` +
    `player ${player.gx.toFixed(2)},${player.gy.toFixed(2)} ${player.facing} hp ${player.hp}\n` +
    `zombies here ${zombies.filter((z) => !z.dead).length}/${zombies.length}  records ${sim.count()}\n` +
    `nodes ${Object.entries(sim.nodeCounts()).map(([k, v]) => `${k}:${v}`).join(" ")}\n` +
    `alarm ${[...sim.alarm.entries()].map(([k, v]) => `${k}:${v.toFixed(1)}`).join(" ")}\n` +
    `${clock.getLabel()} phase=${clock.getPhase()} bright=${clock.getBrightness().toFixed(2)} hunger=${player.hunger.toFixed(0)} thirst=${player.thirst.toFixed(0)} starving=${player.starving}\n` +
    `sim ${sim.debugSummary()}`;
}

// ---- events ----

// Single gate for ending the game, regardless of cause (zombie contact,
// starvation, and anything added later).
function checkGameOver(cause) {
  if (gameOver || player.hp > 0) return;
  gameOver = true;
  death = { t: 0, cause, turned: false, carded: false };
  player.dead = true;
  player.flashlightOn = false;
  player.beam = null;
  player.action = null;
  cancelAutoWalk(player);
  menu.closeContextMenu();
  panel.setOpen(false);
  openContainer = null;
  updatePrompt(null, null);
  playAnimation(player.anim, "die", true);
  // Nothing left to chase.
  for (const z of zombies) {
    if (z.dead || z.state === "die") continue;
    z.aggro = false;
    z.state = "idle";
    z.path = [];
  }
}

// ---- death and the next survivor (docs/18-death-and-survivors.md) ----

// The world keeps going while the player is dead: they fall, get back up as a
// zombie carrying their backpack, and wander while the death card is shown.
function afterlife(dt) {
  death.t += dt;
  clock.update(dt);
  light.update(node);
  if (!death.turned) advanceAnimation(player.anim, assets.getSheet("player"), dt);
  if (!death.turned && death.t >= TURN_AT) turn();
  for (const z of zombies) updateZombie(z, dt, node, player, zombies);
  updateMessage(dt);
  if (!death.carded && death.t >= CARD_AT) {
    death.carded = true;
    showDeath({ cause: death.cause, survivor, onSurvivor: newSurvivor, onWorld: newGame });
  }
  updateHud(hudState());
}

function turn() {
  death.turned = true;
  const z = createZombie(player.gx, player.gy, {
    id: `former${survivor}`,
    former: true,
    loot: inv.items.map((i) => ({ ...i })),
    rising: true,
  });
  zombies.push(z);
  inv.items = [];
  inv.equipped = null;
  saveGame(true);
}

// Same world, new character. Arrives wherever is quietest, away from the body.
function newSurvivor() {
  const diedIn = node.id;
  sim.dematerializeAll(zombies, node.id, null);
  zombies = [];
  const counts = sim.nodeCounts();
  const hops = sim.hopDistances(diedIn);
  let best = null;
  for (const n of world.world.nodes.values()) {
    if (n.id === diedIn) continue;
    const c = counts[n.id] || 0;
    const h = hops.get(n.id) || 0;
    if (!best || c < best.c || (c === best.c && h > best.h)) best = { n, c, h };
  }
  node = best ? best.n : node;
  world.setCurrent(node.id);
  centerNode(node);
  const want = node.id === data.start ? node.spawns.player : [Math.floor(node.width / 2), Math.floor(node.height / 2)];
  const spot = nearestWalkable(node, want[0], want[1]) || want;
  survivor += 1;
  player = createPlayer(spot[0], spot[1]);
  inv = inventory.createInventory();
  for (const [id, count, props] of SURVIVOR_ITEMS) inventory.addItem(inv, id, count, props);
  inventory.equip(inv, "bat");
  combat.effects.length = 0;
  gameOver = false;
  death = null;
  materializeNode();
  hideOverlay();
  loop.setPaused(false);
  saveGame();
  showMessage(`Survivor ${survivor}. Somewhere out there, the last one is still walking.`, 5);
  updateHud(hudState());
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
  for (const [id, count, props] of STARTING_ITEMS) inventory.addItem(inv, id, count, props);
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
  death = null;
  survivor = 1;
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
    assets.loadSprite("zombie_survivor"),
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

  // Save when the tab goes away, and pause on Escape. The Escape listener is
  // here rather than in input.js because input is not polled while paused.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") saveGame();
  });
  window.addEventListener("beforeunload", () => saveGame());
  window.addEventListener("keydown", (e) => {
    if (e.code !== "Escape") return;
    if (menu.isMenuOpen()) return; // the context menu closes itself on Escape
    togglePause();
  });

  // The world is built and drawn, but nothing moves until a button is pressed.
  openStartScreen();
  window.__game = {
    iso, input, loop, assets, events, combat, inventory, grid, world, sim, clock, light, getItem, menu,
    get node() { return node; },
    get player() { return player; },
    get inv() { return inv; },
    get zombies() { return zombies; },
    get gameOver() { return gameOver; },
    get openContainer() { return openContainer; },
    panel,
    panelHandlers,
    restart: startGame,
    // Save and start-screen hooks. Scripted tests call newGame() first.
    newGame,
    continueGame,
    newSurvivor,
    get survivor() { return survivor; },
    get death() { return death; },
    saveGame,
    snapshot,
    applySnapshot,
    save,
    get started() { return started; },
    setNightTint,
    setHour(h) {
      const target = (h / 24) * clock.DAY_LENGTH;
      clock.update(target - (clock.getElapsed() % clock.DAY_LENGTH));
    },
    transition,
    runAction,
    actionsAt: (sx, sy) => actionsAt(sx, sy, player, node, inv, bodies()),
  };
}

boot().catch((err) => {
  console.error(err);
  debugEl.textContent = `boot failed: ${err.message}`;
});
