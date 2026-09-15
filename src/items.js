// Item definitions and loot tables. See docs/04-gameplay.md and docs/06-data-formats.md.

const items = new Map();
let lootTables = {};

export function loadItems(list) {
  items.clear();
  for (const def of list) items.set(def.id, def);
}

export function loadLoot(tables) {
  lootTables = tables;
}

export function getItem(id) {
  const def = items.get(id);
  if (!def) throw new Error(`Unknown item ${id}`);
  return def;
}

export function hasItemDef(id) {
  return items.has(id);
}

function randInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

// Roll a loot table once. Returns [{ id, count }].
export function rollLoot(tableId) {
  const table = lootTables[tableId];
  if (!table) return [];
  const rolls = randInt(table.rolls[0], table.rolls[1]);
  const total = table.entries.reduce((n, e) => n + e.weight, 0);
  const out = [];
  for (let i = 0; i < rolls; i++) {
    let r = Math.random() * total;
    for (const e of table.entries) {
      r -= e.weight;
      if (r <= 0) {
        if (e.item !== "nothing") {
          const count = e.count ? randInt(e.count[0], e.count[1]) : 1;
          out.push({ id: e.item, count });
        }
        break;
      }
    }
  }
  return out;
}
