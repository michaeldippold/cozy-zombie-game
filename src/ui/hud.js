// HUD: health, stamina, hunger, weapon, ammo, node and clock. DOM over the
// canvas. See docs/04-gameplay.md.

import * as clock from "../clock.js";

let root = null;
let els = {};

export function initHud() {
  root = document.getElementById("hud");
  root.innerHTML = `
    <div class="hud-row">
      <div class="hud-health"><div class="hud-health-fill"></div><span class="hud-health-text"></span></div>
    </div>
    <div class="hud-row">
      <div class="hud-stamina"><div class="hud-stamina-fill"></div></div>
    </div>
    <div class="hud-row">
      <div class="hud-hunger"><div class="hud-hunger-fill"></div></div>
    </div>
    <div class="hud-row hud-weapon"><span class="hud-weapon-name">Unarmed</span><span class="hud-ammo"></span></div>
    <div class="hud-light"></div>
    <div class="hud-node"></div>
    <div class="hud-clock"></div>
  `;
  els = {
    fill: root.querySelector(".hud-health-fill"),
    text: root.querySelector(".hud-health-text"),
    stamina: root.querySelector(".hud-stamina-fill"),
    hunger: root.querySelector(".hud-hunger-fill"),
    weapon: root.querySelector(".hud-weapon-name"),
    ammo: root.querySelector(".hud-ammo"),
    light: root.querySelector(".hud-light"),
    node: root.querySelector(".hud-node"),
    clock: root.querySelector(".hud-clock"),
  };
  root.hidden = false;
}

export function updateHud({ player, node, weaponName = "Unarmed", ammoText = "", lightText = "" }) {
  const pct = Math.max(0, Math.min(1, player.hp / player.maxHp));
  els.fill.style.width = `${Math.round(pct * 100)}%`;
  els.fill.style.background = pct > 0.5 ? "#6fbf5f" : pct > 0.25 ? "#d9b84a" : "#d05050";
  els.text.textContent = `${Math.ceil(player.hp)} / ${player.maxHp}`;

  const st = Math.max(0, Math.min(1, player.stamina / player.maxStamina));
  els.stamina.style.width = `${Math.round(st * 100)}%`;
  els.stamina.style.background = player.winded ? "#8a6a3a" : "#5a9ad8";

  const hu = Math.max(0, Math.min(1, player.hunger / player.maxHunger));
  els.hunger.style.width = `${Math.round(hu * 100)}%`;
  els.hunger.style.background = player.starving ? "#d05050" : hu < 0.3 ? "#d99a3a" : "#c8934a";

  els.weapon.textContent = weaponName;
  els.ammo.textContent = ammoText;
  els.light.textContent = lightText;
  els.light.classList.toggle("on", !!player.flashlightOn);
  els.node.textContent = node.name;
  els.clock.textContent = clock.getLabel();
}
