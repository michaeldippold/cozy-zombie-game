# 02 — World model

The world is a graph, not a map. This is the most important structural idea in the game and must not be relitigated during implementation.

## Nodes

A **node** is one small diorama: a tile grid with its own floor, walls, furniture, containers, and entities. Interiors, individual floors of a building, and outdoor areas are all nodes. Every node is small enough to be fully visible on screen (see `01-constraints.md`).

A node owns:

- A walkability grid derived from floor tiles and solid props.
- A shot-blocking grid derived from walls and props flagged `blocksShots`.
- A list of props (furniture, trees, containers).
- A list of materialized entities (the player and any zombies currently rendered here).
- References to the edges that touch it, and which side of each edge it is.

Only one node is rendered and fully simulated at a time: the one the player is in.

## Edges

An **edge** connects a tile in one node to a tile in another. Doors, windows, and stairs are all edges with different rules. Later: holes, vents, ladders.

**An edge is one object referenced by both nodes.** Its state lives on the edge. There is no inside copy and outside copy to keep in sync. When a window is boarded from inside, the yard renders it boarded because it reads the same object.

Each edge has:

- Two endpoints, `a` and `b`, each a node id and a tile.
- A `kind`: `door`, `window`, or `stairs`.
- An `inside` marker naming which endpoint is the interior. Used for "inward only" rules and for deciding who can barricade.
- A `glass` state for windows: `intact` or `broken`. Doors and stairs have no glass.
- A `barricade`: `null`, or `{ hp }`. Any edge can be barricaded from the inside endpoint. When hp reaches zero the barricade is removed.
- Traversal rules derived from kind and state (below). Nothing hand-authored beyond kind and inside.

## Doors are doorways with a threshold tile

A door is not a panel on the wall. It is an opening in the wall with a **threshold tile** one step outside the room grid, in the doorway. The player crosses the edge only by walking into the doorway and reaching the center of that tile. Standing next to the door, boarding it, or brushing past it never crosses. This came from play: with a flat panel, walking up to the door to board it kept teleporting the player outside.

- Each door endpoint has `tile` (the room tile in front of the door) and a derived `threshold` (one step outward through the wall).
- The threshold is walkable only while the edge is not barricaded. Boarding physically closes the doorway.
- Arriving through a door places the player on the far side's threshold, facing into the room. The edge re-arms once they step off it.
- Zombies arriving through a door materialize on the threshold and walk in.
- Windows have no threshold. They stay flat panels in the wall, which visually separates "a way through for me" from "a way in for them".

### Place the two ends of a door on opposite screen sides

Momentum must carry through a door. If you walk up-right into a facade door, you should arrive walking up-right into the room, and leaving should be a walk down-left that continues down-left into the yard. So the two endpoints of one door sit on **opposite screen edges**: the yard's end is in its far (north) wall, the house's end is on its near (south) edge. Putting both ends in the top-right corner meant every exit deposited the player pressing into the corner that leads straight back in.

Near-edge doors have no wall. The threshold is a fully visible outset pad on the open edge of the diorama, the Pokémon-style door mat. Boarding one draws the planks across the pad. Far-wall doors are openings in the wall, and the mat shows through the doorway.

### Nodes are not Euclidean

Inside and outside are never on screen together, so nothing forces them to agree. A building's facade on an outdoor node is a stage flat: it can be six tiles wide while the interior is ten, and a whole house can be one door in a fence. Use this freely. It is what keeps outdoor nodes small enough to be dioramas while interiors stay roomy, and it means a street of eight buildings costs eight doors, not eight footprints.

## Traversal rules

| Kind | Player | Zombies | Notes |
|---|---|---|---|
| Door | Either direction unless barricaded | Either direction unless barricaded | Zombies attack a barricade until it breaks, then pass |
| Window (ground floor) | Never | **Inward only**, and only once `glass === "broken"` | Zombies break the glass by attacking the edge from outside. Then attack any barricade. Then climb in. |
| Window (upper floor) | Not an edge | Not an edge | Pure decoration. A wall sprite that looks like a window. |
| Stairs | Either direction | Either direction | Only ground-floor nodes have edges to outdoor nodes. Not boardable. Drawn as a staircase in a far wall at one end and a pad at the other |
| Gate | Either direction | Either direction | A gap in a hedge or fence between outdoor nodes. Not boardable |

### Why windows work this way

This is deliberate and the reasoning matters more than the rule. Windows exist to give zombies a **second way into a room** so that barricading the one door is not a solved problem. That is the entire gameplay surface of a window. They are not doors for the player, and zombies never leave a building through them, so when you are outside there is no chaos of zombies pouring out of every window. Inside, an intact window is a quiet risk. Outside, it is a picture on a wall. Windows above the ground floor are not edges at all.

If a future feature wants more from windows (peeking, escaping with a stagger), it should be added as a new rule on top of this, not by turning windows into doors.

## Persistent off-screen simulation

Every zombie always exists. Where it is determines how it is represented.

- **In the player's node:** a full entity with a sprite, a float grid position, A\* pathing, animation, and hit detection.
- **In any other node:** an abstract **record** `{ id, node, tile, state, targetEdge, timer, hp, aggro }`. See `06-data-formats.md`. No sprite, no pathing.

Records tick on the coarse sim timer, not every frame. Their behavior:

- **Idle:** with some probability per tick, pick an edge that leads toward the player's node using the assignment rule below, and switch to moving. Otherwise stay idle. Optionally drift to a random tile.
- **Moving:** decrement `timer`. The timer was set from the grid distance between the record's tile and the target edge tile, divided by zombie walk speed. At zero the zombie is at the edge tile.
- **At the edge:** if the edge is traversable in this direction, cross. If it is a window with intact glass, or has a barricade, switch to attacking.
- **Attacking edge:** reduce glass or barricade hp each tick. Glass breaks first, then barricade. When the edge becomes traversable, cross.

### Crossing an edge

Crossing moves the record's `node` and `tile` to the other endpoint.

- If the destination is the player's node, the zombie **materializes**: the record becomes a full entity at the edge's tile. If that tile is occupied, spill to the nearest free walkable neighbor.
- If the player leaves a node, every zombie in it **dematerializes**: each entity becomes a record at its current tile. Zombies that were chasing the player get `targetEdge` set to the edge the player used and a timer based on their distance to it. Zombies that were idle stay idle.
- A materialized zombie that walks through an edge while the player is present dematerializes into the far node and behaves as a record there.

Zombies in a node the player is not in **only follow**. They do not wander off to other nodes on their own, except for a small idle drift chance kept for unpredictability. Default drift chance is low and tunable.

## Across the graph: hop distance, alarm, trickle

With more than two nodes, three rules keep the world dangerous without making any zombie clever. All three live in `sim.js`.

- **Hop distance.** Each sim tick, a breadth-first search from the player's node gives every node its hop count. A record only ever picks an edge that leads to a node one hop closer. Aggro records always pick; idle ones pick with a small base chance plus a term from their node's alarm. Crossing into a node that is not the player's keeps the zombie a record, and it continues next tick. This is the whole "pull toward you": no pathing, no memory.
- **Alarm.** Noise adds its loudness to the source node's alarm and to neighbours at 40% per hop, three hops out. Alarm decays 15% per tick. A gunshot in the house makes the street restless for a minute or two.
- **Trickle.** Every ~90 s of game time, one outdoor node at least two hops from the player and below its `zombieCap` gains a zombie on a random tile. A cleared park refills while you are elsewhere, and nothing ever appears in the node you are in or the one next door.

## Edge assignment rule (one-way glass)

The player cannot see the adjacent node, but the sim knows where the player is. Zombies in a node adjacent to the player's node are assigned an edge to approach by a **weighted lookup**, not a path search.

For each candidate edge from the zombie's node into the player's node, the weight is:

```
weight = base(kind)
       * weakness(edge)          // intact window < broken window < open door; barricades reduce
       + noise(edge)             // recent loudness near the edge's far-side tile, decays
       + scent(edge)             // raised when the player crosses this edge, decays
```

Pick by weighted random, not by highest weight. Distribution across edges is the whole point: several zombies in the yard should split between the door and the windows, not all pile on one. Tunables live in `sim.js` and their starting values are listed in `09-decisions.md`.

Light through windows at night is a later addition and not in the demo.
