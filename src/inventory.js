// Player inventory: a grid bag { cols, rows, items, equipped }. Placement rules
// live in grid.js (docs/21-grid-inventory.md). Entries may carry per-instance
// state such as `fill` (docs/20-thirst.md).

import { getItem } from "./items.js";
import * as grid from "./grid.js";

export const BAG_COLS = 6;
export const BAG_ROWS = 4;

export function createInventory(cols = BAG_COLS, rows = BAG_ROWS) {
  return { cols, rows, items: [], equipped: null };
}

export function countItem(inv, id) {
  return inv.items.filter((it) => it.id === id).reduce((n, it) => n + it.count, 0);
}

// Add count of an item, placed wherever it fits. Returns the number actually
// added (0 if there is no room). `props` (e.g. { fill }) go on each new entry.
export function addItem(inv, id, count = 1, props = {}) {
  return grid.add(inv, id, count, props);
}

// Remove count of an item. Returns the number actually removed.
export function removeItem(inv, id, count = 1) {
  let remaining = count;
  for (let i = inv.items.length - 1; i >= 0 && remaining > 0; i--) {
    const it = inv.items[i];
    if (it.id !== id) continue;
    const take = Math.min(remaining, it.count);
    it.count -= take;
    remaining -= take;
    if (it.count <= 0) inv.items.splice(i, 1);
  }
  fixEquipped(inv);
  return count - remaining;
}

// Remove one specific entry.
export function removeEntry(inv, entry) {
  const ok = grid.remove(inv, entry);
  fixEquipped(inv);
  return ok;
}

// The equipped weapon must still be in the bag.
export function fixEquipped(inv) {
  if (inv.equipped && countItem(inv, inv.equipped) === 0) inv.equipped = null;
}

// Entries that hold water: [{ id, count, fill }].
export function waterContainers(inv) {
  return inv.items.filter((it) => getItem(it.id).capacity);
}

export function equip(inv, id) {
  if (id === null) {
    inv.equipped = null;
    return true;
  }
  if (countItem(inv, id) === 0) return false;
  if (getItem(id).kind !== "weapon") return false;
  inv.equipped = id;
  return true;
}

export function equippedWeapon(inv) {
  return inv.equipped ? getItem(inv.equipped) : null;
}

export function weaponIds(inv) {
  const seen = new Set();
  for (const it of inv.items) if (getItem(it.id).kind === "weapon") seen.add(it.id);
  return [...seen];
}

// Cycle equipped weapon by direction (+1 / -1).
export function cycleWeapon(inv, dir) {
  const ids = weaponIds(inv);
  if (!ids.length) return;
  const i = ids.indexOf(inv.equipped);
  const next = ids[((i + dir) % ids.length + ids.length) % ids.length];
  inv.equipped = next;
}
