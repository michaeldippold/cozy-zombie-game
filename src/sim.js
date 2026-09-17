// Off-screen zombie simulation: records, edge assignment across the graph,
// alarm, trickle spawning, materialize and dematerialize.
// See docs/02-world-model.md and docs/10-neighbourhood.md.
//
// A zombie is either an entity in the player's node or a record here. Never both.

import * as world from "./world.js";
import * as clock from "./clock.js";
import { staticContribAt } from "./light.js";
import { isWalkable } from "./node.js";
import { ZOMBIE_SPEED } from "./entities/zombie.js";
import { emit } from "./events.js";

export const EDGE_ATTACK_DAMAGE = 10; // per sim tick
// A calm world barely moves on its own: at 0.001 a zombie waits about 17
// minutes on average before wandering one hop toward you. Noise and pursuit do
// the rest. With fifteen zombies in the neighbourhood even 0.004 was a stream.
export const PICK_EDGE_BASE = 0.001;
export const ALARM_PICK_DIV = 60; // chance += min(0.5, alarm / this)
// Zombies are worse at night. Per docs/00-vision.md, the sim knows where the
// player is; at night, light through the player's windows is the tell.
// NIGHT_PICK_MULT scales the whole pick chance; NIGHT_WINDOW_LIGHT is a flat
// weight added to any window edge that leads straight into the player's node.
export const NIGHT_PICK_MULT = 1.5;
export const NIGHT_WINDOW_LIGHT = 5;
export const ALARM_SPREAD = 0.4; // per hop
export const ALARM_HOPS = 3;
export const ALARM_DECAY = 0.92; // per tick; a gunshot keeps a node restless for about a minute
export const DRIFT_CHANCE = 0.05;
export const NOISE_DECAY = 0.5;
export const SCENT_DECAY = 0.7;
export const NOISE_WEIGHT = 4;
export const SCENT_WEIGHT = 3;
export const GLASS_NOISE = 6;
export const TRICKLE_INTERVAL = 90; // seconds of game time between restock attempts
export const TRICKLE_MIN_HOPS = 2; // never restock the player's node or its neighbours
const BASE_WEIGHT = { door: 3, gate: 3, stairs: 3, window: 1, windowBroken: 2 };
const BARRICADE_MULT = 0.5;

export const records = new Map();
export const alarm = new Map(); // nodeId -> value
let trickleTimer = 0;
let nextSpawnId = 1000;

export function reset() {
  records.clear();
  alarm.clear();
  trickleTimer = 0;
}

// ---- save / load (docs/15-save-load.md) ----

function copyRecord(r) {
  return {
    id: r.id,
    node: r.node,
    tile: [...r.tile],
    state: r.state,
    targetEdge: r.targetEdge ?? null,
    targetSide: r.targetSide ?? null,
    timer: r.timer || 0,
    hp: r.hp,
    aggro: !!r.aggro,
    former: !!r.former,
    loot: r.loot ? r.loot.map((i) => ({ ...i })) : null,
  };
}

// Every zombie as a record: the off-screen ones as they are, and the ones in
// the current node written at their tile, corpses included. Does not touch the
// live sim.
export function serialize(zombiesHere, nodeId) {
  const out = [...records.values()].map(copyRecord);
  for (const z of zombiesHere) {
    out.push({
      id: z.id,
      node: nodeId,
      tile: [Math.round(z.gx), Math.round(z.gy)],
      state: z.dead || z.state === "die" ? "dead" : "idle",
      targetEdge: null,
      targetSide: null,
      timer: 0,
      hp: z.dead ? 0 : z.hp,
      aggro: !!z.aggro && !z.dead && z.state !== "die",
      former: !!z.former,
      loot: z.loot ? z.loot.map((i) => ({ ...i })) : null,
    });
  }
  return {
    records: out,
    alarm: Object.fromEntries(alarm),
    trickleTimer,
    nextSpawnId,
  };
}

export function restore(s) {
  records.clear();
  alarm.clear();
  for (const r of s.records) {
    world.getNode(r.node); // throws on an unknown node
    if (r.targetEdge) world.getEdge(r.targetEdge);
    records.set(r.id, copyRecord(r));
  }
  for (const [id, v] of Object.entries(s.alarm || {})) alarm.set(id, v);
  trickleTimer = s.trickleTimer || 0;
  nextSpawnId = s.nextSpawnId || nextSpawnId;
}

export function addRecord(rec) {
  records.set(rec.id, rec);
  return rec;
}

export function count() {
  return records.size;
}

// Live records per node, for the debug line and the trickle cap.
export function nodeCounts() {
  const out = {};
  for (const rec of records.values()) {
    if (rec.state === "dead") continue;
    out[rec.node] = (out[rec.node] || 0) + 1;
  }
  return out;
}

export function alarmOf(nodeId) {
  return alarm.get(nodeId) || 0;
}

function dist(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

// ---- graph ----

function neighbours(nodeId) {
  const out = new Set();
  for (const ref of world.edgesOf(nodeId)) out.add(ref.edge[world.otherSide(ref.side)].node);
  return [...out];
}

// Hop distance from a node to every reachable node.
export function hopDistances(fromId) {
  const d = new Map([[fromId, 0]]);
  const queue = [fromId];
  while (queue.length) {
    const n = queue.shift();
    for (const m of neighbours(n)) {
      if (d.has(m)) continue;
      d.set(m, d.get(n) + 1);
      queue.push(m);
    }
  }
  return d;
}

// ---- records <-> entities ----

// Convert a materialized zombie entity into a record. Chasers head for exitRef.
export function dematerialize(z, nodeId, exitRef) {
  const tile = [Math.round(z.gx), Math.round(z.gy)];
  const rec = {
    id: z.id,
    node: nodeId,
    tile,
    state: z.dead ? "dead" : "idle",
    targetEdge: null,
    targetSide: null,
    timer: 0,
    hp: z.hp,
    aggro: z.aggro && !z.dead,
    former: !!z.former,
    loot: z.loot || null,
  };
  if (rec.aggro && exitRef) {
    rec.state = "moving";
    rec.targetEdge = exitRef.edge.id;
    rec.targetSide = exitRef.side;
    rec.timer = dist(tile, exitRef.tile) / ZOMBIE_SPEED;
  }
  return addRecord(rec);
}

export function dematerializeAll(zombies, nodeId, exitRef) {
  for (const z of zombies) dematerialize(z, nodeId, exitRef);
}

// Remove and return every record in a node, for materializing.
export function takeRecordsFor(nodeId) {
  const out = [];
  for (const rec of records.values()) if (rec.node === nodeId) out.push(rec);
  for (const rec of out) records.delete(rec.id);
  return out;
}

// ---- behaviour ----

// Weighted choice among edges that lead one hop closer to the player.
function pickEdge(nodeId, hops, playerNodeId) {
  const here = hops.get(nodeId);
  if (here === undefined) return null;
  const candidates = [];
  let total = 0;
  for (const ref of world.edgesOf(nodeId)) {
    const e = ref.edge;
    const other = e[world.otherSide(ref.side)];
    const there = hops.get(other.node);
    if (there === undefined || there >= here) continue;
    if (!world.zombieCanApproach(e, ref.side)) continue;
    let w = e.kind === "window" ? (e.glass === "broken" ? BASE_WEIGHT.windowBroken : BASE_WEIGHT.window) : BASE_WEIGHT[e.kind] || 1;
    if (e.barricade) w *= BARRICADE_MULT;
    w += e.noise + e.scent;
    // A lit window is a tell only from right next to the player's own node.
    // The pull is the actual light falling on the window tile out here, so a
    // boarded or broken window stops glowing and stops pulling.
    if (e.kind === "window" && other.node === playerNodeId) {
      const lit = staticContribAt(world.getNode(nodeId), ref.tile[0], ref.tile[1]);
      w += NIGHT_WINDOW_LIGHT * clock.nightFactor() * lit;
    }
    candidates.push({ ref, w });
    total += w;
  }
  if (!candidates.length) return null;
  let r = Math.random() * total;
  for (const c of candidates) {
    r -= c.w;
    if (r <= 0) return c.ref;
  }
  return candidates[candidates.length - 1].ref;
}

function randomWalkableTile(node) {
  for (let i = 0; i < 20; i++) {
    const x = Math.floor(Math.random() * node.width);
    const y = Math.floor(Math.random() * node.height);
    if (isWalkable(node, x, y)) return [x, y];
  }
  return null;
}

function decayWeights() {
  for (const e of world.world.edges.values()) {
    e.noise *= NOISE_DECAY;
    e.scent *= SCENT_DECAY;
    if (e.noise < 0.05) e.noise = 0;
    if (e.scent < 0.05) e.scent = 0;
  }
  for (const [id, v] of alarm) {
    const nv = v * ALARM_DECAY;
    if (nv < 0.05) alarm.delete(id);
    else alarm.set(id, nv);
  }
}

function startMoving(rec, ref) {
  rec.state = "moving";
  rec.targetEdge = ref.edge.id;
  rec.targetSide = ref.side;
  rec.timer = dist(rec.tile, ref.tile) / ZOMBIE_SPEED;
}

function goIdle(rec) {
  rec.state = "idle";
  rec.targetEdge = null;
  rec.targetSide = null;
}

// Restock: one outdoor node far from the player, under its cap.
function trickle(dt, hops, playerNodeId) {
  trickleTimer += dt;
  if (trickleTimer < TRICKLE_INTERVAL) return;
  trickleTimer = 0;
  const counts = nodeCounts();
  const candidates = [];
  for (const node of world.world.nodes.values()) {
    if (!node.outdoor || node.id === playerNodeId) continue;
    const h = hops.get(node.id);
    if (h === undefined || h < TRICKLE_MIN_HOPS) continue;
    if ((counts[node.id] || 0) >= (node.zombieCap || 0)) continue;
    candidates.push(node);
  }
  if (!candidates.length) return;
  const node = candidates[Math.floor(Math.random() * candidates.length)];
  const tile = randomWalkableTile(node);
  if (!tile) return;
  addRecord({ id: `s${nextSpawnId++}`, node: node.id, tile, state: "idle", targetEdge: null, targetSide: null, timer: 0, hp: 100, aggro: false });
  emit("zombieSpawned", { node: node.id });
}

// One coarse tick. Returns arrivals into the player's node:
// [{ record, edge, tile }] where tile is the endpoint tile in the player's node.
export function tick(playerNodeId, dt = 1) {
  decayWeights();
  const hops = hopDistances(playerNodeId);
  trickle(dt, hops, playerNodeId);
  const arrivals = [];
  for (const rec of [...records.values()]) {
    if (rec.state === "dead") continue;
    if (rec.node === playerNodeId) {
      // Should not happen; hand it back to be materialized where it stands.
      records.delete(rec.id);
      arrivals.push({ record: rec, edge: null, tile: rec.tile });
      continue;
    }
    switch (rec.state) {
      case "idle": {
        const baseChance = PICK_EDGE_BASE + Math.min(0.5, alarmOf(rec.node) / ALARM_PICK_DIV);
        const chance = rec.aggro ? 1 : baseChance * (1 + NIGHT_PICK_MULT * clock.nightFactor());
        if (Math.random() < chance) {
          const ref = pickEdge(rec.node, hops, playerNodeId);
          if (ref) {
            startMoving(rec, ref);
            break;
          }
        }
        if (Math.random() < DRIFT_CHANCE) {
          const t = randomWalkableTile(world.getNode(rec.node));
          if (t) rec.tile = t;
        }
        break;
      }
      case "moving": {
        rec.timer -= dt;
        if (rec.timer > 0) break;
        const edge = world.getEdge(rec.targetEdge);
        const side = rec.targetSide;
        rec.tile = [...edge[side].tile];
        if (!stillCloser(rec, edge, side, hops)) {
          goIdle(rec); // the player moved on; only follow
          break;
        }
        if (world.canTraverse(edge, side, "zombie")) {
          cross(rec, edge, side, arrivals, playerNodeId);
        } else if (world.blockerFor(edge, side) !== "never") {
          rec.state = "attackingEdge";
        } else {
          goIdle(rec);
        }
        break;
      }
      case "attackingEdge": {
        const edge = world.getEdge(rec.targetEdge);
        const side = rec.targetSide;
        if (!stillCloser(rec, edge, side, hops)) {
          goIdle(rec);
          break;
        }
        const result = world.attackEdge(edge, side, EDGE_ATTACK_DAMAGE);
        if (result.glassBroke) {
          const inside = edge[edge.inside];
          emit("noise", { node: inside.node, tile: inside.tile, loudness: GLASS_NOISE, source: "glass" });
        }
        if (world.canTraverse(edge, side, "zombie")) cross(rec, edge, side, arrivals, playerNodeId);
        break;
      }
    }
  }
  return arrivals;
}

// Does this edge still lead toward the player?
function stillCloser(rec, edge, side, hops) {
  const other = edge[world.otherSide(side)];
  const here = hops.get(rec.node);
  const there = hops.get(other.node);
  return here !== undefined && there !== undefined && there < here;
}

function cross(rec, edge, side, arrivals, playerNodeId) {
  const dest = edge[world.otherSide(side)];
  rec.node = dest.node;
  rec.tile = [...dest.tile];
  goIdle(rec);
  if (dest.node === playerNodeId) {
    rec.aggro = true; // it came for you
    records.delete(rec.id);
    arrivals.push({ record: rec, edge, tile: rec.tile });
  }
}

// ---- inputs from the world ----

// Noise raises nearby edge weights and the alarm of the node and its neighbours.
export function onNoise({ node: nodeId, tile, loudness }) {
  for (const ref of world.edgesOf(nodeId)) {
    const d = dist(tile, ref.tile);
    if (d <= loudness) ref.edge.noise += NOISE_WEIGHT * (1 - d / loudness);
  }
  const hops = hopDistances(nodeId);
  for (const [id, h] of hops) {
    if (h > ALARM_HOPS) continue;
    alarm.set(id, alarmOf(id) + loudness * Math.pow(ALARM_SPREAD, h));
  }
}

// Direct alarm without a noise event: light in darkness, for example. Spreads
// one hop at the usual rate.
export function addAlarm(nodeId, amount, hops = 1) {
  for (const [id, h] of hopDistances(nodeId)) {
    if (h > hops) continue;
    alarm.set(id, alarmOf(id) + amount * Math.pow(ALARM_SPREAD, h));
  }
}

export function onPlayerCrossed(edge) {
  edge.scent += SCENT_WEIGHT;
}

export function debugSummary() {
  return [...records.values()].map((r) => `${r.id}:${r.node}:${r.state}${r.targetEdge ? ">" + r.targetEdge : ""}${r.state === "moving" ? "(" + r.timer.toFixed(1) + ")" : ""}`).join(" ");
}
