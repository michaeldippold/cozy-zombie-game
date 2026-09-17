> The panel described here (rows and a Drink button) was replaced the same day by the grid inventory, `21-grid-inventory.md`. Bottles are now blocks with a blue water level and a right-click Drink.

# 20 — Thirst and water

Milestone 22. Michael's brief (2026-09-17): water containers in your inventory that you fill up, measured 0 to 100% and not in millilitres; a draw-down rate; consequences for being out too long; interactable ways to refill. **Water and power shutoff are tabled**: wanted eventually, but they are long-game structure and the moment-to-moment game comes first. Taps never run dry for now.

## The need

- `player.thirst` runs 100 to 0 and drains at `100 / 420` per second: empty in seven real minutes, about 14 in-game hours. Hunger takes ten. You think about water more often than food.
- Shown as a **moodle** (droplet), never a bar. Stages: Slightly thirsty under 60, Thirsty under 35, Parched under 15, Dying of thirst at 0.
- Consequences, in two steps:
  - **Parched** (under 15): stamina recovers at half speed. You can still fight, but not for long.
  - **Zero**: health drains at 3 per second, the same as starvation, with its own one-off warning and its own death card text.

## Drinking

- **Water bottle**: an inventory item with a fill level, 0 to 100%. A full bottle is worth 100 thirst, so one bottle is one full drink. Its row reads "Water bottle (75%)" and has a **Drink** button, which drinks only what you need.
- **You drink by yourself.** When thirst falls under 60 (the point where the moodle would appear) and you are carrying water, you take a drink automatically, emptiest bottle first, with a short message. Zomboid does this and it is right: remembering to click a bottle is a chore, not a decision. The decision is carrying water and keeping it filled. The result is that **the thirst moodle means "you are out of water"**.
- **Soda**: a one-shot drink (35 thirst, a little hunger). Drunk by hand only.
- Food can carry a `thirst` field too. Chips are salty: minus 8.

## Refilling

- **Sinks** in the house and the house across the street, and a **drinking fountain** in the park. Right-click, or `E`:
  - **Drink** (1.5 s): thirst to full. The `E` action, offered only when you are under 90.
  - **Fill bottles** (2 s): every bottle you carry to 100%. Greyed out with none to fill.
- Water sources are props with `"water": "sink"` (the name shown in the menu) in the node JSON. They are infinite until shutoff exists.

## Where bottles come from

You start with one full bottle. Later survivors start with one empty bottle. Bottles turn up in fridges, cabinets, shelves, and occasionally on bodies, at a random fill (0, 25, 50, 75, or 100%). Soda is in fridges and on shop shelves.

## Items with a fill level

Bottles are the first items with per-instance state. The rule is small: an inventory entry, a container entry, or a floor item may carry `fill`, and anything that moves a non-stacking item moves that one entry with its `fill`. The panel groups rows by id and fill, and its buttons pass the fill back so the right bottle is the one that moves. Saves already copy whole entries, so only floor items needed a field added. `SAVE_VERSION` 3 (the player gained `thirst`).

## Acceptance

- Thirst drains at the stated rate; the four moodle stages appear at 59, 34, 14, and 0; under 15 stamina regen is halved; at 0 health drains and death shows the thirst text.
- With a 100% bottle, crossing 60 auto-drinks: thirst returns to 100 and the bottle reads 59% or so. With no water, the moodle appears instead.
- Drink button takes only what is needed. An empty bottle's button is disabled.
- Sink: Drink fills thirst; Fill bottles sets every carried bottle to 100; disabled with no bottle or all full.
- A 40% bottle keeps its 40% through drop, pick up, store in a container, take back, save, and reload. Two bottles at different levels show as two rows.
- Soda and chips change thirst by their `thirst` field.

## Bodies despawn (Milestone 21, same session)

Dead zombies are removed **48 in-game hours** after death (1440 s of game clock), so nobody has to drag bodies outside and there is still plenty of time to loot. Rules: a body is only ever removed while you are in another area, so nothing vanishes in front of you; a **former survivor's body is kept for as long as anything is inside it**, because that is your backpack; an ordinary body goes on schedule even if you stored things on it. Records carry `diedAt`; old saves stamp it on load.

## Results (2026-09-17)

Scripted in the browser and passed. Thirst fell 10 in 42 s. Crossing 60 with a full bottle drank automatically (thirst 99.9, bottle 60%) and no moodle appeared; with an empty bottle the stages read Slightly thirsty, Thirsty, Parched. Stamina regen was 11 per second when parched against 22 normally. At the sink, Fill bottles was disabled with a full bottle and enabled at 40%, filled it to 100, and Drink restored thirst. A 40% bottle kept its level through drop, pick up ("Pick up Water bottle (40%)"), store in the fridge, a snapshot round trip (deep-equal), and take back; 40% and 75% bottles showed as two rows. The Drink button at thirst 80 took 20 from a 75% bottle. Soda gave 35; chips took 8. Sixty fridge rolls produced bottles at all five levels. Death at zero thirst showed "You died of thirst." and the next survivor carried an empty bottle. A body in another area was still there at 1430 s and gone at 1441 s; a former survivor's body with a backpack was kept at 5000 s.
