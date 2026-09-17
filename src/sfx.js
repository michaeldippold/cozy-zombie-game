// Placeholder sound effects synthesized with WebAudio. No files. See docs/07-demo-scope.md.
// The context unlocks on the first key or click; until then calls are silent no-ops.

let ctx = null;

function ensure() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

export function initSfx() {
  const unlock = () => ensure();
  window.addEventListener("keydown", unlock);
  window.addEventListener("mousedown", unlock);
}

function noiseBurst(duration, { freq = 1000, q = 1, gain = 0.3, decay = duration } = {}) {
  const c = ensure();
  if (!c || c.state !== "running") return;
  const len = Math.floor(c.sampleRate * duration);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  const filt = c.createBiquadFilter();
  filt.type = "bandpass";
  filt.frequency.value = freq;
  filt.Q.value = q;
  const g = c.createGain();
  g.gain.setValueAtTime(gain, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + decay);
  src.connect(filt).connect(g).connect(c.destination);
  src.start();
}

function tone(freq, duration, { type = "square", gain = 0.15, slide = 0 } = {}) {
  const c = ensure();
  if (!c || c.state !== "running") return;
  const osc = c.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, c.currentTime);
  if (slide) osc.frequency.linearRampToValueAtTime(Math.max(20, freq + slide), c.currentTime + duration);
  const g = c.createGain();
  g.gain.setValueAtTime(gain, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
  osc.connect(g).connect(c.destination);
  osc.start();
  osc.stop(c.currentTime + duration);
}

export const sfx = {
  gunshot() {
    noiseBurst(0.25, { freq: 700, q: 0.6, gain: 0.5, decay: 0.2 });
    tone(110, 0.12, { type: "sine", gain: 0.3, slide: -70 });
  },
  swing() {
    noiseBurst(0.12, { freq: 900, q: 2, gain: 0.1 });
  },
  hit() {
    tone(170, 0.08, { type: "square", gain: 0.18, slide: -100 });
  },
  glass() {
    noiseBurst(0.3, { freq: 4200, q: 1, gain: 0.25 });
    tone(2400, 0.15, { type: "triangle", gain: 0.08, slide: 900 });
  },
  pickup() {
    tone(660, 0.08, { type: "square", gain: 0.07, slide: 330 });
  },
  dry() {
    tone(320, 0.05, { type: "square", gain: 0.08 });
  },
  hurt() {
    tone(140, 0.12, { type: "sawtooth", gain: 0.14, slide: -60 });
  },
  die() {
    tone(90, 0.3, { type: "sawtooth", gain: 0.12, slide: -50 });
  },
  board() {
    tone(220, 0.06, { type: "square", gain: 0.12, slide: -40 });
    setTimeout(() => tone(200, 0.06, { type: "square", gain: 0.12, slide: -40 }), 90);
  },
  thud() {
    tone(70, 0.18, { type: "sine", gain: 0.3, slide: -40 });
    noiseBurst(0.1, { freq: 300, q: 1, gain: 0.15 });
  },
  crunch() {
    noiseBurst(0.14, { freq: 1600, q: 0.7, gain: 0.25 });
    tone(120, 0.12, { type: "square", gain: 0.14, slide: -90 });
  },
  shove() {
    noiseBurst(0.08, { freq: 500, q: 1.5, gain: 0.12 });
  },
  eat() {
    tone(440, 0.1, { type: "sine", gain: 0.1, slide: 120 });
  },
};
