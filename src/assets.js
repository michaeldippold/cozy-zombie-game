// Sprite definitions and sheets. A sheet built from a real PNG + JSON and a
// generated placeholder sheet have the same shape. See docs/03 and docs/06.

import * as placeholders from "./placeholders.js";

const defs = new Map();
const sheets = new Map();

export async function loadJson(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Failed to load ${path}`);
  return res.json();
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image ${src}`));
    img.src = src;
  });
}

export async function loadSpriteDef(id) {
  if (defs.has(id)) return defs.get(id);
  const def = await loadJson(`data/sprites/${id}.json`);
  def.id = id;
  defs.set(id, def);
  return def;
}

export function getDef(id) {
  const d = defs.get(id);
  if (!d) throw new Error(`Sprite definition not loaded: ${id}`);
  return d;
}

// Build a sheet from a definition. Real art if `image` is present, else a
// generated placeholder. `tileCount` lets box props provide one frame per
// footprint tile.
export async function loadSprite(id, { tileCount = 1 } = {}) {
  const key = tileCount > 1 ? `${id}#${tileCount}` : id;
  if (sheets.has(key)) return sheets.get(key);
  const def = await loadSpriteDef(id);
  let sheet;
  if (def.image) {
    const image = await loadImage(def.image);
    sheet = {
      image,
      frames: def.frames,
      anchor: def.anchor,
      animations: def.animations || {},
      facings: def.facings || [],
      mirror: def.mirror || {},
    };
  } else if (def.placeholder) {
    const ph = def.placeholder;
    switch (ph.kind) {
      case "character": sheet = placeholders.generateCharacter(ph); break;
      case "box": sheet = placeholders.generateBox(ph, tileCount); break;
      case "post": sheet = placeholders.generatePost(ph); break;
      case "flat": sheet = placeholders.generateFlat(ph); break;
      case "wall": sheet = placeholders.generateWall(ph); break;
      default: throw new Error(`Unknown placeholder kind ${ph.kind} for ${id}`);
    }
  } else {
    throw new Error(`Sprite ${id} has neither image nor placeholder`);
  }
  sheet.id = id;
  sheets.set(key, sheet);
  return sheet;
}

export function getSheet(id, tileCount = 1) {
  const key = tileCount > 1 ? `${id}#${tileCount}` : id;
  const s = sheets.get(key);
  if (!s) throw new Error(`Sprite sheet not loaded: ${key}`);
  return s;
}

// Load every sheet a node's data refers to.
export async function loadNodeSprites(json) {
  const jobs = [loadSprite(json.floor)];
  for (const o of json.floorOverrides || []) jobs.push(loadSprite(o.sprite));
  for (const r of json.floorRects || []) jobs.push(loadSprite(r.sprite));
  for (const side of ["north", "west"]) {
    const w = json.walls?.[side];
    if (!w) continue;
    for (const id of new Set(Array.isArray(w) ? w.filter(Boolean) : [w])) jobs.push(loadSprite(id));
  }
  for (const p of json.props || []) {
    const [w, h] = p.footprint || [1, 1];
    jobs.push(loadSprite(p.sprite, { tileCount: w * h }));
  }
  for (const it of json.items || []) jobs.push(loadSprite(`item_${it.item}`));
  await Promise.all(jobs);
}
