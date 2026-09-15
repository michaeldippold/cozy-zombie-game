// The world graph: nodes, shared edge objects, traversal rules. See docs/02-world-model.md.

import { loadNode } from "./node.js";
import { emit } from "./events.js";

export const GLASS_HP = 40;

export const world = {
  nodes: new Map(),
  edges: new Map(),
  currentId: null,
};

export function loadWorld({ nodes, edges }) {
  world.nodes.clear();
  world.edges.clear();
  for (const json of nodes) world.nodes.set(json.id, loadNode(json));
  for (const json of edges) world.edges.set(json.id, createEdge(json));
  // Resolve each node's edge references to the shared objects.
  for (const node of world.nodes.values()) {
    node.edgeRefs = node.edgeRefs
      .map((ref) => {
        const edge = world.edges.get(ref.edge);
        if (!edge) throw new Error(`Node ${node.id} references unknown edge ${ref.edge}`);
        const ep = edge[ref.side];
        if (ep.node !== node.id) throw new Error(`Edge ${edge.id} side ${ref.side} is not in node ${node.id}`);
        const r = { edge, side: ref.side, tile: ep.tile, wall: ep.wall || "north", threshold: null };
        // Doors and stairs get a threshold tile one step outside the wall.
        // Standing on it is what crosses the edge. Windows have none.
        if (edge.kind === "door" || edge.kind === "gate" || edge.kind === "stairs") {
          const n = { north: [0, -1], west: [-1, 0], south: [0, 1], east: [1, 0] }[r.wall] || [0, -1];
          r.threshold = [ep.tile[0] + n[0], ep.tile[1] + n[1]];
          node.thresholds.set(`${r.threshold[0]},${r.threshold[1]}`, r);
        }
        return r;
      });
  }
}

// The ref for an edge as seen from a given node.
export function refFor(edge, nodeId) {
  return edgesOf(nodeId).find((r) => r.edge === edge) || null;
}

function createEdge(json) {
  return {
    id: json.id,
    kind: json.kind,
    a: { node: json.a.node, tile: [...json.a.tile], wall: json.a.wall || "north" },
    b: { node: json.b.node, tile: [...json.b.tile], wall: json.b.wall || "north" },
    inside: json.inside || "a",
    glass: json.kind === "window" ? (json.glass || "intact") : null,
    glassHp: json.kind === "window" ? GLASS_HP : 0,
    barricade: json.barricade ? { hp: json.barricade.hp } : null,
    noise: 0,
    scent: 0,
  };
}

export function getNode(id) {
  const n = world.nodes.get(id);
  if (!n) throw new Error(`Unknown node ${id}`);
  return n;
}

export function getEdge(id) {
  const e = world.edges.get(id);
  if (!e) throw new Error(`Unknown edge ${id}`);
  return e;
}

export function setCurrent(id) {
  world.currentId = id;
}

export function current() {
  return getNode(world.currentId);
}

export function otherSide(side) {
  return side === "a" ? "b" : "a";
}

// [{ edge, side, tile, wall }] for every edge touching a node.
export function edgesOf(nodeId) {
  return getNode(nodeId).edgeRefs;
}

export function edgeAtTile(nodeId, gx, gy) {
  for (const ref of edgesOf(nodeId)) {
    if (ref.tile[0] === gx && ref.tile[1] === gy) return ref;
  }
  return null;
}

// Traversal rules from docs/02-world-model.md. `who` is "player" or "zombie".
export function canTraverse(edge, fromSide, who) {
  if (edge.barricade) return false;
  switch (edge.kind) {
    case "door":
    case "gate":
    case "stairs":
      return true;
    case "window": {
      if (who !== "zombie") return false;
      if (edge.glass !== "broken") return false;
      return otherSide(fromSide) === edge.inside; // inward only
    }
    default:
      return false;
  }
}

// Could a zombie ever get through this edge from this side, given enough time?
// Windows are only ever entered from outside. Barricades and glass can be broken.
export function zombieCanApproach(edge, fromSide) {
  if (edge.kind === "window") return otherSide(fromSide) === edge.inside;
  return true;
}

// Why a zombie cannot cross right now: "glass", "barricade", or null if it can.
export function blockerFor(edge, fromSide) {
  if (canTraverse(edge, fromSide, "zombie")) return null;
  if (edge.kind === "window" && edge.glass === "intact" && zombieCanApproach(edge, fromSide)) return "glass";
  if (edge.barricade) return "barricade";
  return "never";
}

// Damage the current blocker. Returns what changed.
export function attackEdge(edge, fromSide, amount) {
  const result = { glassBroke: false, barricadeBroke: false };
  const blocker = blockerFor(edge, fromSide);
  if (blocker === "glass") {
    edge.glassHp -= amount;
    if (edge.glassHp <= 0) {
      edge.glassHp = 0;
      edge.glass = "broken";
      result.glassBroke = true;
      emit("edgeChanged", { edge, change: "glassBroke" });
    }
  } else if (blocker === "barricade") {
    edge.barricade.hp -= amount;
    if (edge.barricade.hp <= 0) {
      edge.barricade = null;
      result.barricadeBroke = true;
      emit("edgeChanged", { edge, change: "barricadeBroke" });
    }
  }
  return result;
}

export function barricadeEdge(edge, hp) {
  edge.barricade = { hp: (edge.barricade?.hp || 0) + hp, planks: (edge.barricade?.planks || 0) + 1 };
  emit("edgeChanged", { edge, change: "barricaded" });
}

// Take the boards down. Returns how many planks went into it.
export function removeBarricade(edge) {
  const planks = edge.barricade?.planks || 0;
  edge.barricade = null;
  emit("edgeChanged", { edge, change: "unboarded" });
  return planks;
}

// Wall sprite variant for a wall segment at (gx, gy) on a given wall side.
// Edges first, then decorative variants with nothing behind them.
export function wallVariantAt(node, gx, gy, wallSide) {
  const ref = edgeAtTile(node.id, gx, gy);
  if (ref && ref.wall === wallSide) {
    const e = ref.edge;
    if (e.kind === "door" || e.kind === "gate") return e.barricade ? "door_boarded" : "door";
    if (e.kind === "stairs") return "stairs";
    if (e.kind === "window") {
      if (e.barricade) return "boarded";
      return e.glass === "broken" ? "window_broken" : "window";
    }
  }
  for (const d of node.wallDecor) {
    if (d.wall === wallSide && d.tile[0] === gx && d.tile[1] === gy) return d.variant;
  }
  return "plain";
}
