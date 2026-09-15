# 00 — Vision

This document is the tiebreaker. When a design or implementation question has no answer elsewhere in `docs/`, answer it by asking: **which option best serves a cozy Habbo-style diorama game that gets invaded by zombies?** Then log the ruling in `09-decisions.md`.

## The idea in one paragraph

A twee isometric pixel world in the Habbo Hotel / early-2000s style: small, warm, hand-placed rooms with chunky furniture and a character who looks like they belong in a cozy sim. Then a cute little zombie shambles through the doorway. The world keeps looking cute. The zombie keeps coming. Underneath the sweetness is a serious survival simulation in the spirit of Project Zomboid, boiled down to its essentials.

## The tone rules

- **The art stays cute.** Nothing in the visual language should read as grimdark. Blood is optional and stylized. Zombies are recognizably zombies but drawn with the same soft proportions as everyone else.
- **The systems stay serious.** Health, ammo, barricades, and off-screen threats are real. The player should feel that going outside is a decision.
- **Contrast is the joke and the horror.** The dissonance between the diorama and the danger is the product. Do not resolve it in either direction.
- **Every room is a diorama.** Nodes are small enough to see all at once. No scrolling camera, no fog of war. You look at your little house the way you look at a dollhouse, and something is scratching at the window.

## What "Habbo style" means here

- 2:1 isometric diamonds, sprites anchored at the feet, walls only on the far two edges so the room sits in a corner like a stage set.
- Chunky, readable pixel art. Small characters with big heads.
- Furniture is placed on tiles, and long furniture is made of per-tile pieces.
- **Not a Habbo clone.** No Habbo art, no Habbo trademarks. Same projection and sprite conventions, original or licensed assets.

## What the demo must prove

1. Walking around a Habbo-style diorama with twin-stick controls feels good.
2. The node/edge world model handles doors, windows, and room transitions with no special cases.
3. Zombies persisting across nodes creates pressure even when you cannot see them.
4. Melee and hitscan both work and feel right in isometric space.
5. Searching a container and managing a small inventory is a strong enough hook to justify building the survival layer.

If those five hold, hunger, sleep, cooking, barricade durability, and multiple floors are data and UI work, not engine work.

## What the demo is not

Not a full game, not a level, not a content pass. One house, one yard, a handful of zombies, one loop. Prove the loop.

## Guiding principles for rulings

- Prefer the option that keeps nodes small and readable.
- Prefer the option that adds no special cases to the edge model.
- Prefer dumb, distributed zombies over clever ones. Unpredictability comes from distribution, not intelligence.
- Prefer placeholder art that exercises the real pipeline over waiting for final art.
- When in doubt, cut. The survival layer comes later and will be data.
