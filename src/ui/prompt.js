// "E — Search fridge" prompt near the target, with a progress bar for timed actions.

import * as iso from "../iso.js";

let root = null;
let labelEl = null;
let barEl = null;
let fillEl = null;
let messageEl = null;
let messageTimer = 0;

export function initPrompt() {
  root = document.getElementById("prompt");
  root.innerHTML = `
    <div class="prompt-label"></div>
    <div class="prompt-bar"><div class="prompt-fill"></div></div>
  `;
  labelEl = root.querySelector(".prompt-label");
  barEl = root.querySelector(".prompt-bar");
  fillEl = root.querySelector(".prompt-fill");
  messageEl = document.createElement("div");
  messageEl.id = "message";
  messageEl.hidden = true;
  document.getElementById("ui").appendChild(messageEl);
}

// target: { label, tile, enabled } or null. progress: 0..1 or null.
export function updatePrompt(target, progress) {
  if (!target) {
    root.hidden = true;
    return;
  }
  const p = iso.toScreen(target.tile[0], target.tile[1]);
  root.style.left = `${Math.round(p.x)}px`;
  root.style.top = `${Math.round(p.y) - 56}px`;
  labelEl.textContent = `E — ${target.label}`;
  root.classList.toggle("disabled", target.enabled === false);
  if (progress !== null && progress !== undefined) {
    barEl.hidden = false;
    fillEl.style.width = `${Math.round(progress * 100)}%`;
  } else {
    barEl.hidden = true;
  }
  root.hidden = false;
}

export function showMessage(text, seconds = 2) {
  messageEl.textContent = text;
  messageEl.hidden = false;
  messageTimer = seconds;
}

export function updateMessage(dt) {
  if (messageEl.hidden) return;
  messageTimer -= dt;
  if (messageTimer <= 0) messageEl.hidden = true;
}
