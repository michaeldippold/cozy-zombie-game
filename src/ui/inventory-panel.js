// Inventory panel (Tab) with an optional container view beside it. See docs/04-gameplay.md.

import { getItem } from "../items.js";
import { totalWeight } from "../inventory.js";

let root = null;
let open = false;
let handlers = {};
let lastSignature = "";

export function initInventoryPanel(h) {
  handlers = h;
  root = document.getElementById("inventory");
  root.hidden = true;
  root.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;
    const { action, id, fill } = btn.dataset;
    handlers[action]?.(id, fill === undefined || fill === "" ? null : Number(fill));
    lastSignature = ""; // force re-render
  });
}

export function isOpen() {
  return open;
}

export function setOpen(v) {
  open = v;
  root.hidden = !v;
  lastSignature = "";
}

export function toggle() {
  setOpen(!open);
}

function fmtWeight(w) {
  return `${Math.round(w * 10) / 10}`;
}

// Group identical stacks for display: [{ id, count, def }].
function grouped(items) {
  const map = new Map();
  for (const it of items) {
    // Items with a fill level group by level, so each bottle is its own row.
    const key = it.fill != null ? `${it.id}|${it.fill}` : it.id;
    const g = map.get(key) || { id: it.id, count: 0, def: getItem(it.id), fill: it.fill ?? null };
    g.count += it.count;
    map.set(key, g);
  }
  return [...map.values()];
}

function fillAttr(g) {
  return g.fill != null ? ` data-fill="${g.fill}"` : "";
}

function rowButtons(g, inv, container) {
  const b = [];
  const fa = fillAttr(g);
  if (g.def.kind === "weapon") {
    const eq = inv.equipped === g.id;
    b.push(`<button data-action="equip" data-id="${g.id}" ${eq ? "disabled" : ""}>${eq ? "Equipped" : "Equip"}</button>`);
  }
  if (g.def.kind === "food") b.push(`<button data-action="use" data-id="${g.id}">${g.def.verb || "Eat"}</button>`);
  if (g.def.kind === "drink") b.push(`<button data-action="use" data-id="${g.id}"${fa} ${g.fill > 0 ? "" : "disabled"}>Drink</button>`);
  if (g.def.kind === "tool") b.push(`<button data-action="use" data-id="${g.id}">Toggle (F)</button>`);
  if (container) b.push(`<button data-action="store" data-id="${g.id}"${fa}>Store</button>`);
  b.push(`<button data-action="drop" data-id="${g.id}"${fa}>${g.def.kind === "light" ? "Place" : "Drop"}</button>`);
  return b.join("");
}

function itemRow(g, buttons) {
  return `
    <div class="inv-row">
      <span class="inv-name">${g.def.name}${g.fill != null ? ` <span class="inv-count">${Math.round(g.fill)}%</span>` : ""}${g.count > 1 ? ` <span class="inv-count">x${g.count}</span>` : ""}</span>
      <span class="inv-weight">${fmtWeight(g.def.weight * g.count)}</span>
      <span class="inv-buttons">${buttons}</span>
    </div>`;
}

// Re-render if anything changed. container is a prop with .contents or null.
export function renderInventoryPanel(inv, container) {
  if (!open) return;
  const sig = JSON.stringify([inv.items, inv.equipped, container?.id, container?.contents]);
  if (sig === lastSignature) return;
  lastSignature = sig;

  const invRows = grouped(inv.items).map((g) => itemRow(g, rowButtons(g, inv, container))).join("") || `<div class="inv-empty">Empty</div>`;
  let containerHtml = "";
  if (container) {
    const rows = grouped(container.contents).map((g) => itemRow(g, `<button data-action="take" data-id="${g.id}"${fillAttr(g)}>Take</button>`)).join("") || `<div class="inv-empty">Nothing here</div>`;
    containerHtml = `
      <div class="inv-column">
        <div class="inv-header">${capitalize(container.container)}</div>
        ${rows}
      </div>`;
  }
  // The backpack always sits in the top-right corner; anything opened appears to its left.
  root.innerHTML = `
    ${containerHtml}
    <div class="inv-column">
      <div class="inv-header">Backpack <span class="inv-weight">${fmtWeight(totalWeight(inv))} / ${inv.limit}</span></div>
      ${invRows}
      <div class="inv-hint">Tab closes · 1/2 or wheel switches weapons</div>
    </div>`;
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
