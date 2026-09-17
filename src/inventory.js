// Player inventory: a weight-limited list of { id, count }. Non-stacking items
// may carry per-instance state such as `fill` (docs/20-thirst.md). See docs/04-gameplay.md.

import { getItem } from "./items.js";

export const INVENTORY_LIMIT = 15;

export function createInventory(limit = INVENTORY_LIMIT) {
  return { items: [], limit, equipped: null };
}

export function totalWeight(inv) {
  return inv.items.reduce((n, it) => n + getItem(it.id).weight * it.count, 0);
}

export function countItem(inv, id) {
  return inv.items.filter((it) => it.id === id).reduce((n, it) => n + it.count, 0);
}

// Add count of an item. Returns the number actually added (0 if over weight).
// `props` (e.g. { fill }) are copied onto each new non-stacking entry.
export function addItem(inv, id, count = 1, props = {}) {
  const def = getItem(id);
  const room = inv.limit - totalWeight(inv);
  const canAdd = Math.min(count, Math.floor(room / def.weight + 1e-9));
  if (canAdd <= 0) return 0;
  if (def.stack) {
    let remaining = canAdd;
    for (const it of inv.items) {
      if (it.id !== id || it.count >= def.stack) continue;
      const take = Math.min(remaining, def.stack - it.count);
      it.count += take;
      remaining -= take;
      if (remaining <= 0) break;
    }
    while (remaining > 0) {
      const take = Math.min(remaining, def.stack);
      inv.items.push({ id, count: take });
      remaining -= take;
    }
  } else {
    for (let i = 0; i < canAdd; i++) inv.items.push({ id, count: 1, ...props });
  }
  return canAdd;
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
  if (inv.equipped === id && countItem(inv, id) === 0) inv.equipped = null;
  return count - remaining;
}

// Remove and return one whole entry, matching `fill` when given. For moving
// items that carry per-instance state.
export function takeEntry(inv, id, fill = null) {
  const i = inv.items.findIndex((it) => it.id === id && (fill === null || it.fill === fill));
  if (i < 0) return null;
  const [entry] = inv.items.splice(i, 1);
  if (inv.equipped === id && countItem(inv, id) === 0) inv.equipped = null;
  return entry;
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
