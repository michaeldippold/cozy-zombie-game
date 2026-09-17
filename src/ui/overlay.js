// Full-screen overlays: start screen, pause, game over. See docs/04 and docs/15.

let root = null;

const CAUSES = {
  zombie: { title: "You were eaten.", body: "And then you got back up." },
  starvation: { title: "You starved to death.", body: "There was food out there. Something else is wearing your clothes now." },
};

export function initOverlay() {
  root = document.getElementById("overlay");
  root.hidden = true;
}

// Death card (docs/18). The backdrop is lighter than usual so the player can
// watch their former self wander behind it.
export function showDeath({ cause = "zombie", survivor = 1, onSurvivor, onWorld }) {
  const { title, body } = CAUSES[cause] || CAUSES.zombie;
  root.innerHTML = `
    <div class="overlay-card">
      <h1>${title}</h1>
      <p>${body}</p>
      <div class="overlay-buttons">
        <button class="overlay-survivor">New survivor<span class="overlay-sub">same world, survivor ${survivor + 1}</span></button>
        <button class="overlay-world secondary">New world<span class="overlay-sub">start over</span></button>
      </div>
      <p class="overlay-note">Everything you carried is still on you. Well. On it.</p>
    </div>
  `;
  root.querySelector(".overlay-survivor").addEventListener("click", () => onSurvivor());
  root.querySelector(".overlay-world").addEventListener("click", () => onWorld());
  root.classList.add("overlay-light");
  root.hidden = false;
}

// Start screen. `save` is null or { label } describing the save to continue.
export function showStartScreen({ save, onContinue, onNew }) {
  root.classList.remove("overlay-light");
  root.innerHTML = `
    <div class="overlay-card overlay-start">
      <h1>Cozy Zombie Game</h1>
      <p>A snug little house. A quiet street. Something is scratching at the window.</p>
      <div class="overlay-buttons">
        ${save ? `<button class="overlay-continue">Continue<span class="overlay-sub">${save.label}</span></button>` : ""}
        <button class="overlay-new${save ? " secondary" : ""}">New game${save ? `<span class="overlay-sub">overwrites your save</span>` : ""}</button>
      </div>
      <table class="overlay-controls">
        <tr><td>WASD</td><td>Move</td><td>Mouse</td><td>Aim, left click attacks</td></tr>
        <tr><td>Shift</td><td>Sprint</td><td>Right click</td><td>Everything you can do to a thing</td></tr>
        <tr><td>E</td><td>Pick up, search, light switch</td><td>Tab</td><td>Backpack</td></tr>
        <tr><td>F</td><td>Flashlight</td><td>1 / 2</td><td>Bat / pistol</td></tr>
        <tr><td>Esc</td><td>Pause, save and quit</td><td></td><td></td></tr>
      </table>
      <p class="overlay-note">The game saves by itself, in this browser only. If you die, the world carries on without you.</p>
    </div>
  `;
  root.querySelector(".overlay-continue")?.addEventListener("click", () => onContinue());
  root.querySelector(".overlay-new").addEventListener("click", () => onNew());
  root.hidden = false;
}

export function showPause({ onResume, onQuit }) {
  root.innerHTML = `
    <div class="overlay-card">
      <h1>Paused</h1>
      <div class="overlay-buttons">
        <button class="overlay-resume">Resume</button>
        <button class="overlay-quit secondary">Save and quit to title</button>
      </div>
    </div>
  `;
  root.querySelector(".overlay-resume").addEventListener("click", () => onResume());
  root.querySelector(".overlay-quit").addEventListener("click", () => onQuit());
  root.hidden = false;
}

export function isOverlayOpen() {
  return !root.hidden;
}

export function hideOverlay() {
  root.classList.remove("overlay-light");
  root.hidden = true;
  root.innerHTML = "";
}
