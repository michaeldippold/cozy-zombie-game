// Full-screen overlays: start screen, pause, game over. See docs/04 and docs/15.

let root = null;

const CAUSES = {
  zombie: { title: "You were eaten.", body: "The house is quiet again." },
  starvation: { title: "You starved to death.", body: "There was food out there. You didn't reach it in time." },
};

export function initOverlay() {
  root = document.getElementById("overlay");
  root.hidden = true;
}

export function showGameOver(onRestart, cause = "zombie") {
  const { title, body } = CAUSES[cause] || CAUSES.zombie;
  root.innerHTML = `
    <div class="overlay-card">
      <h1>${title}</h1>
      <p>${body}</p>
      <button class="overlay-restart">New game</button>
    </div>
  `;
  root.querySelector(".overlay-restart").addEventListener("click", () => {
    hideOverlay();
    onRestart();
  });
  root.hidden = false;
}

// Start screen. `save` is null or { label } describing the save to continue.
export function showStartScreen({ save, onContinue, onNew }) {
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
      <p class="overlay-note">The game saves by itself, in this browser only. Dying deletes the save.</p>
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
  root.hidden = true;
  root.innerHTML = "";
}
