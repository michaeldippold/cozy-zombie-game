# 10 — Milestone 12: Neighbourhood

The proof of concept held with two nodes. This milestone grows the graph to seven and answers the last engine question: does zombie persistence hold when the player moves between buildings and between floors, and does the world stay dangerous after the player clears a node?

## Goals

1. Zombies chasing you follow across several nodes, including up a staircase, arriving at plausible times.
2. Noise pulls zombies toward you from nodes you cannot see, hop by hop, without any zombie being clever.
3. A cleared node does not stay clear forever. The world restocks out of sight, never in front of the player.
4. The node/edge model absorbs gates, stairs, per-tile walls, and decorative upper windows as data, not special cases.

## The map

Seven nodes. Every door pair follows the momentum rule from `02-world-model.md`: the two ends sit on opposite screen sides.

| Node | Size | Kind | Edges |
|---|---|---|---|
| `house` | 10×10 | interior | door S pad ↔ `yard` N facade; two windows ↔ `yard` |
| `yard` | 12×10 | outdoor | gate S pad ↔ `street` N fence |
| `street` | 12×12 | outdoor, the hub | `yard` gate N; `shop` door N storefront; `house2` door W facade; `park` gate S pad; `house2` window W |
| `house2-ground` | 10×8 | interior | door E pad ↔ `street` W; stairs N ↔ `house2-upstairs` S pad; window N ↔ `street` W |
| `house2-upstairs` | 10×8 | interior | stairs S pad ↔ ground N. Decorative windows only. |
| `shop` | 10×8 | interior | door S pad ↔ `street` N |
| `park` | 12×12 | outdoor | gate N ↔ `street` S pad |

Outdoor nodes carry `outdoor: true` and a `zombieCap`. Interiors start empty.

## New edge kinds

- **`gate`**: door rules, drawn as a gap in a hedge or fence. Cannot be boarded.
- **`stairs`**: door rules, drawn as a staircase in the far wall at one end and a pad at the other. Cannot be boarded. Only ground floors have edges to outdoor nodes.

## New node data

- `walls.north` / `walls.west` may be an array of one sprite id per tile, so a street can be fence, then storefront.
- `wallDecor: [{ tile, wall, variant }]` draws a wall variant with no edge behind it. This is how upper-floor windows exist: pure decoration, per the vision.
- `outdoor`, `zombieCap`.
- `data/world.json` lists the node files so `main.js` stops hardcoding them.

## Sim changes

- **Graph distance.** Each tick, BFS from the player's node gives every node a hop distance. A record picks among edges that lead to a node one hop closer, weighted as before. This is the whole "pull": no pathing, no memory.
- **Crossing into a non-player node** keeps the record a record. It continues next tick. Arrivals only materialize in the player's node.
- **Alarm.** Noise adds to the source node's alarm and spreads to neighbours at 40% per hop, three hops max. Alarm decays 15% per tick. An idle, non-aggro record's chance to start moving is a small base plus a term from its node's alarm. Aggro records always move.
- **Trickle.** Every ~90 s of game time, one outdoor node at least two hops from the player and under its cap gains a record on a random walkable tile. Off-screen restock, never adjacent to the player.
- Only-follow still holds for aggro zombies; drift still exists for idle ones.

## Acceptance

All five checks below were scripted and passed on 2026-09-14. Numbers after tuning: base pull 0.001 per tick, alarm divisor 60, decay 0.92, trickle every 90 s.

- Three park chasers: crossed into the street by 10 s, the blue house by 20 s, upstairs between 22 and 25 s.
- Two shots in the house: five or six of fifteen arrive within 150 s, mostly from the yard; the park barely stirs. A calm house sees zero or one visitor in five minutes.
- Trickle: four restocks in six minutes across the street, yard, and park, none in the player's node or its neighbour.
- Upstairs decorative windows: no actions, no edge.

Original criteria:

- From the park, three chasers follow the player through the street, into house2, and up the stairs, materializing upstairs one by one. Debug per-node counts show them hopping.
- A pistol shot in the house raises alarm in the yard and street; within a couple of minutes zombies from the street arrive at the house through the yard.
- With the player idle in house2-upstairs for five minutes, the park and street stay populated near their caps.
- Boarding, windows, and doors behave exactly as before in every node.
- A `wallDecor` window upstairs is not an edge: right-click offers nothing, zombies never use it.
