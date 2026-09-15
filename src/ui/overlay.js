// Full-screen overlays: game over and restart. See docs/04-gameplay.md.

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
      <button class="overlay-restart">Try again</button>
    </div>
  `;
  root.querySelector(".overlay-restart").addEventListener("click", () => {
    hideOverlay();
    onRestart();
  });
  root.hidden = false;
}

export function hideOverlay() {
  root.hidden = true;
  root.innerHTML = "";
}
