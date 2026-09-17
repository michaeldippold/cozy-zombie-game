# 17 — Moodles

Milestone 18. Michael's ruling (2026-09-17): slow needs are shown as **moodles**, Zomboid's pictorial status icons, and not as bars. They are a better picture of "how am I doing" than a number, and hiding the exact value adds a hint of immersion, for the same reason Zomboid hides it. The set stays small: only what the game needs.

This reverses the line in `16-zomboid-systems-fit.md` that said every need gets a bar.

## What is a bar and what is a moodle

| State | Shown as | Why |
|---|---|---|
| Health | Bar with number | You act on it second by second in a fight |
| Stamina | Bar | Same: it gates the next swing and sprint |
| Zombie HP | Floating bar | Combat feedback Michael asked for |
| **Hunger** | **Moodle** | Slow need. Replaces the hunger bar |
| Thirst (when built) | Moodle | Slow need |
| Tired (when built) | Moodle | Slow need |
| Bleeding (if built) | Moodle | On/off state |
| Infection hint (if ever built) | Moodle | A queasy icon that could be bad beans or could be the bite is exactly the ambiguity Zomboid uses. The framework allows it; nothing is decided |

Not planned, by ruling: food sickness, temperature, wetness, panic, stress, boredom, unhappiness, pain, per-limb anything, clothing.

The rule of thumb: **if you react to it within a second, it is a bar. If you plan around it, it is a moodle.** The debug corner still prints exact numbers for testing.

## Behaviour

- A moodle is hidden when the state is fine. It appears at stage 1 and escalates to stage 4.
- Each stage has a name and one line of flavour text, shown on hover.
- The icon's background goes from amber through orange to red with the stage. The glyph does not change.
- When a moodle appears or gets worse it pops once (a short scale animation), so a change is noticed without a message. Getting better does not animate.
- Moodles sit in a row directly above the health bar, in the HUD. Order is fixed by the registry so icons do not jump around.
- DOM, not canvas, like the rest of the UI. Glyphs are inline SVG placeholders, to be replaced with real art along with everything else.

## Hunger stages

Hunger runs 100 (full) to 0. Drain and starvation damage are unchanged from `11-hunger-and-night.md`.

| Stage | Hunger | Name | Text |
|---|---|---|---|
| none | 60 and up | | |
| 1 | under 60 | Peckish | Could eat. |
| 2 | under 35 | Hungry | Your stomach is making itself heard. |
| 3 | under 15 | Very hungry | Hard to think about anything but food. |
| 4 | 0 | Starving | You are wasting away. Eat something. |

The one-off "You are starving" message stays, since stage 4 costs health.

## Code

- `src/moodles.js`: the registry. Each entry is `{ id, glyph, stages: [{ name, text }], stageOf(player) }` and returns 0 to 4. `activeMoodles(player)` returns the ones above 0. Pure logic, no DOM. Adding thirst later is one entry.
- `src/ui/moodles.js`: renders `activeMoodles` into the HUD row, diffing by id and stage so the DOM only changes when a stage does.
- `src/ui/hud.js`: the hunger bar goes; a moodle row is added above health.
- Nothing new is saved. Moodles are derived from state that is already saved.

## Acceptance

- Fresh game: no moodle visible, no hunger bar.
- Stepping hunger through 59, 34, 14, 0 shows stages 1 to 4 with the right names, and the icon pops on each worsening.
- Eating from stage 3 back above 60 removes the icon without a pop.
- Hover shows name and text.
- Starving still drains health and still ends the game with the starvation message.

## Results (2026-09-17)

Scripted in the browser and passed: no icon and no hunger bar on a fresh game; hunger 59, 34, 14, and 0 gave Peckish, Hungry, Very hungry, and Starving, each with the pop class; going from 14 back to 80 removed the icon with no pop; hover shows the name and text beside the icon.
