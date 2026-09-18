# 22 — Melee that lands

Milestone 24. Michael (2026-09-17): melee has the problem the gun had at first. Swings that visibly cover a zombie do not land, spamming clicks does odd things, and no amount of extra range would make it predictable. Keep it simple: fix the hits, add knockdown and feedback and a shove on Space, slow zombies a touch. No lunge wind-up unless it still feels wrong afterwards. No weapon condition yet. No zombie variety: Romero shamblers, probably never runners. Never Zomboid's hold-to-aim swivel, and never "where you hit matters" (the models are not detailed enough; headshots might someday be a firearms-only thing; a shotgun hitting several zombies needs no limbs).

## Why hits were missing

Three things, all fixed here.

1. **The drawn arc and the tested arc were different shapes in different places.** The white arc was a screen-space circle drawn from the chest. The test was a grid-space circle (a tilted ellipse on screen) measured foot to foot, with the angle also foot to foot. A zombie whose sprite sat inside the white arc could easily have its feet outside the tested ellipse, or at the wrong angle from your feet.
2. **Only feet counted.** The zombie is a 60 px tall sprite; the test used a single point at its feet. Swinging at a body directly below you on screen, with its head overlapping your legs, missed, because its feet were a tile away.
3. **The swing resolved 83 ms after the click, on the attack animation's active frame, and was thrown away if the animation was interrupted.** A zombie biting you plays the hurt animation, which cancels the attack animation, which cancels the swing. So the swing you most needed was the one that vanished. Spamming clicks between cooldowns compounded it.

## The fix

- **One reach shape, drawn as tested.** Reach is a grid-space circle of `range` tiles around the player's feet, cut to the aim arc measured in screen space from the player's chest. The swing effect draws exactly that wedge (an ellipse on screen), at the feet.
- **The body counts, not the feet.** A zombie is hit if any of its body sample points (feet, knees, chest, head, with the body's half-width) falls inside the wedge. Sample points are taken on screen, converted back to grid for the distance test. That is the same idea as the gun's body-segment fix.
- **Point blank always hits.** A zombie within `POINT_BLANK` tiles (0.55) is hit whatever the angle. If it is on you, you are flailing at it.
- **Swings resolve on the click.** Instant, and never lost. The animation is cosmetic. The cooldown is the only rate limit, so extra clicks do nothing.
- Range goes 1.2 to 1.35 tiles and is per weapon as before.

## Knockdown and finishers

- Every hit has a **knockdown chance** (30%). The third hit in a row on the same zombie within 2 s always knocks down.
- A downed zombie lies on the floor for 2 s, does nothing, and blocks nothing, then gets up (0.6 s, the fall animation backwards) and resumes.
- A hit on a downed zombie is a **finisher**: double damage. Bat: 68, which kills anything that has taken a hit before.
- Knockback stays, slightly stronger (0.8).

## Shove (Space)

- A shove in the aim direction: 1.0 tile reach, 100° arc, no damage, strong knockback (1.6), a 0.6 s stagger, and a 25% knockdown chance. Costs 5 stamina, 0.45 s cooldown, no noise. Works with any weapon or none.
- It is the "get off me" move. Shove, one falls, finish it.

## Feedback

- **Hit-stop:** the world freezes for 45 ms on a melee hit, 90 ms on a kill.
- **Screen kick:** the canvas jolts 3 px in the swing direction for 80 ms.
- **Flash:** the zombie is drawn white for 90 ms after a hit.
- **Sounds:** a heavier thud for a knockdown and a crunch for a finisher, alongside the existing hit and death sounds.

## Zombies

- Walk speed 1.2 to 1.0 tiles per second. Romero shamblers. The player walks at 3.0 and sprints at 5.25.

## Not doing

Lunge wind-up (held in reserve), weapon condition (parked), zombie variety (no), aim-swivel (never), hit locations (never), bleeding or body parts (never).

## Acceptance

- Scripted: a zombie placed so its sprite overlaps the drawn wedge is hit from all eight aim directions, including straight down-screen where only its head is near the player; a zombie clearly outside the wedge is not hit; a zombie at 0.4 tiles behind the player is hit (point blank).
- A swing during the hurt animation still lands.
- Ten rapid clicks produce exactly the swings the cooldown allows, all resolved.
- Third consecutive hit knocks down; a hit on a downed zombie does 68; it gets up after 2 s if alive.
- Space shoves: zombie pushed back, staggered, no damage; sometimes knocked down.
- Hit-stop, kick, and flash are observable (state flags in `__game`).
- Zombie speed constant is 1.0.

## As built

- Body samples run feet to chest, not to the head: counting the head let a swing straight up-screen catch a zombie standing fully beside you.
- Down-screen slack is bounded: a zombie whose feet are a full body height below yours gets up to 0.8 tiles of extra reach, scaling with how far below it is. So a zombie 1.9 tiles down-screen with its body over your legs is hit, and one at 2.2 is not.

## Results (2026-09-17)

Scripted in the browser and passed. A zombie 1.2 tiles away was hit from all eight screen directions and one at 2.3 was missed from all eight. Down-screen: hit at 1.5 and 1.9, missed at 2.2 and 2.5. A zombie beside you was hit when aiming 30° and 52° off, missed at 90°. Point blank behind the player hit. Ten clicks in one second produced two swings (the cooldown) and both resolved. A swing while the player's hurt animation was playing landed for 34. Three hits in a row: the first happened to roll a knockdown, the next two were finishers at 68, the zombie stayed down and got up into chase after its timer. Hit-stop 45 ms, kick and flash set on a hit. Shove: no damage, pushed 0.26 tiles in the first 0.4 s, staggered, cooldown running. Zombie speed constant 1.0.

## Wind-up and lunge (added the same day, on trial)

*Tuned after play: wind-up 0.2 s and no groan. Michael: just enough relief that clipping a zombie is not an instant hit, not so much that it trivialises melee.*

Michael, after playing the rework: it already feels much more dynamic; everything above is locked in as good for now. The lunge is built knowing it might be stripped back out.

- A zombie in reach with its bite ready no longer bites at once. It enters a **wind-up** (`WINDUP_TIME`, 0.4 s): stands still, faces you, and its sprite leans back up to 5 px away from you. A low groan plays.
- Then it **lunges**: a 0.35-tile push toward where you are now, into the bite. The bite's reach is contact plus 0.35 to match.
- **A hit during the wind-up cancels it** (any damage staggers; a shove or knockdown also does). **Stepping out of reach makes it bite air**, and its cooldown is spent either way.
- Code: a `windup` state in `zombie.js` between `chase` and `attack`; `leanX/leanY` read by the renderer; events `zombieWindup` and `zombieLunge`. Nothing in `combat.js` changed. To remove it: make `chase` go straight to `attack` again and delete the state.

Verified by script: wind-up entered with the lean growing to 3.7 px at 0.35 s, lunge travelled 0.30 tiles, a standing player was bitten once, a player who stepped 1.3 tiles back during the wind-up was not, and a hit during the wind-up left the zombie staggered with no bite. (First attempt lunged 2.4 tiles: the knock impulse is total travel, not a velocity.)
