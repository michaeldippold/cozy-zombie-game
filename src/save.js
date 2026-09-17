// Local save storage: one slot in localStorage. See docs/15-save-load.md.
// This module only stores and retrieves a snapshot object. What goes in the
// snapshot is decided by the modules that own the state and assembled in main.js.

export const SAVE_VERSION = 3;
const KEY = "cozy-zombie-save";

function storage() {
  try {
    return window.localStorage;
  } catch {
    return null; // blocked (private mode, sandboxed frame)
  }
}

// Returns true if the snapshot was written.
export function write(snapshot) {
  const s = storage();
  if (!s) return false;
  try {
    s.setItem(KEY, JSON.stringify(snapshot));
    return true;
  } catch {
    return false; // quota or serialization failure: never crash the game over a save
  }
}

// Returns a snapshot of the current version, or null. Anything unreadable or
// from another version is discarded so it cannot be half-applied later.
export function read() {
  const s = storage();
  if (!s) return null;
  const raw = s.getItem(KEY);
  if (!raw) return null;
  try {
    const snap = JSON.parse(raw);
    if (!snap || snap.version !== SAVE_VERSION) {
      s.removeItem(KEY);
      return null;
    }
    return snap;
  } catch {
    s.removeItem(KEY);
    return null;
  }
}

export function clear() {
  const s = storage();
  if (s) s.removeItem(KEY);
}

export function exists() {
  return read() !== null;
}
