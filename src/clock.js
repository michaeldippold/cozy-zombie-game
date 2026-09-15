// Game clock: a day/night cycle. Pure state, read by render, sim, and the HUD.
// See docs/11-hunger-and-night.md.

export const DAY_LENGTH = 720; // seconds of real time per full day-night cycle
const DAY_B = 1.0;
const NIGHT_B = 0.22; // never fully black; this is a cozy game

// Phase boundaries as fractions of one cycle.
const DAY_END = 0.45;
const DUSK_END = 0.55;
const NIGHT_END = 0.90;
// dawn is NIGHT_END..1.0

let elapsed = 0;

export function reset() {
  elapsed = 0;
}

export function update(dt) {
  elapsed += dt;
}

export function getElapsed() {
  return elapsed;
}

// 0..1 position within the current cycle.
export function cycleT() {
  return (elapsed % DAY_LENGTH) / DAY_LENGTH;
}

export function getDay() {
  return Math.floor(elapsed / DAY_LENGTH) + 1;
}

export function getPhase() {
  const t = cycleT();
  if (t < DAY_END) return "day";
  if (t < DUSK_END) return "dusk";
  if (t < NIGHT_END) return "night";
  return "dawn";
}

// Light level, 1 (full day) to NIGHT_B (deepest night), smoothed through dusk/dawn.
export function getBrightness() {
  const t = cycleT();
  if (t < DAY_END) return DAY_B;
  if (t < DUSK_END) return DAY_B + (NIGHT_B - DAY_B) * ((t - DAY_END) / (DUSK_END - DAY_END));
  if (t < NIGHT_END) return NIGHT_B;
  return NIGHT_B + (DAY_B - NIGHT_B) * ((t - NIGHT_END) / (1 - NIGHT_END));
}

// 0 in full day, 1 in full night. What the sim and renderer scale effects by.
export function nightFactor() {
  return Math.max(0, Math.min(1, (DAY_B - getBrightness()) / (DAY_B - NIGHT_B)));
}

// "Day 3, 22:15" for the HUD.
export function getLabel() {
  const t = cycleT();
  const hour = t * 24;
  const h = Math.floor(hour);
  const m = Math.floor((hour - h) * 60);
  return `Day ${getDay()}, ${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
