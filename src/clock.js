// Game clock: a day/night cycle. Pure state, read by render, sim, and the HUD.
// See docs/11-hunger-and-night.md.

export const DAY_LENGTH = 720; // seconds of real time per full 24-hour cycle
const DAY_B = 1.0;
const NIGHT_B = 0.22; // never fully black; this is a cozy game

// Real clock hours (0-24), Zomboid-style: full dark 23:00-06:00, with a
// one-hour taper on each side so it's not an instant switch.
const DUSK_START = 22; // brightness starts falling
const NIGHT_START = 23; // fully dark from here...
const NIGHT_END = 6; // ...until here (wraps past midnight)
const DAWN_END = 7; // brightness is back to full by here

// New games start mid-morning, not at midnight.
const START_HOUR = 8;
const START_ELAPSED = (START_HOUR / 24) * DAY_LENGTH;

let elapsed = START_ELAPSED;

export function reset() {
  elapsed = START_ELAPSED;
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

// 0..24, real clock hours.
export function getHour() {
  return cycleT() * 24;
}

export function getPhase() {
  const h = getHour();
  if (h >= NIGHT_START || h < NIGHT_END) return "night";
  if (h < DAWN_END) return "dawn";
  if (h < DUSK_START) return "day";
  return "dusk";
}

// Light level, 1 (full day) to NIGHT_B (deepest night), tapered through
// dusk and dawn. Full darkness holds for the entire 23:00-06:00 window.
export function getBrightness() {
  const h = getHour();
  if (h >= DUSK_START && h < NIGHT_START) {
    return DAY_B + (NIGHT_B - DAY_B) * ((h - DUSK_START) / (NIGHT_START - DUSK_START));
  }
  if (h >= NIGHT_START || h < NIGHT_END) return NIGHT_B;
  if (h < DAWN_END) {
    return NIGHT_B + (DAY_B - NIGHT_B) * ((h - NIGHT_END) / (DAWN_END - NIGHT_END));
  }
  return DAY_B;
}

// 0 in full day, 1 in full night. What the sim and renderer scale effects by.
export function nightFactor() {
  return Math.max(0, Math.min(1, (DAY_B - getBrightness()) / (DAY_B - NIGHT_B)));
}

// "Day 3, 22:15" for the HUD.
export function getLabel() {
  const h = getHour();
  const hh = Math.floor(h);
  const mm = Math.floor((h - hh) * 60);
  return `Day ${getDay()}, ${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}
