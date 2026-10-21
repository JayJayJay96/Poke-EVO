# PROJECT_STATUS — PokeSurvivorEVO

## Current state
- **Phase:** P0, P1 and **P2 done**. The owner playtested P2 on 2026-10-17 and reported "i think is ok" (gate accepted; no tuning changes requested, and the individual checks for keys/Esc panel/build variety were not itemised). **P3a done** (2026-10-17): Charmander → Charmeleon → Charizard stages, auto evolution with cinematic + summary card, Blaze. **P3b done** (2026-10-17): Flame Burst / Blast Burn signature tiers, zone system, Wide Blast / Linger, Blaze Core / Mega Flare. **P3c done** (2026-10-17): on-hit pipeline + statuses; Pierce, Homing, Return, Knockback, Burn, Lifesteal. **P3 gate playtest (owner, 2026-10-17): "quite fun"** → revisions D11, built as **P3d**: 5 s skippable cinematic, crater once per projectile, augment replacement, guaranteed behaviour card, stage types + Flying moves + STAB, Charizard trait choice. Behaviour augments never appeared in the playtest (pool dilution: 17 options, 3 per window), which the guaranteed card fixes. **P3d done** (2026-10-17). **P3 re-playtest → D12, built as P3e** (2026-10-17): Return −30% damage, Back to move selection (cards kept per move), Oran Berry heal drops, visible Glass penalty + player damage numbers. Owner noted late-game damage is strong but acceptable until the difficulty ramp (P5). **P3 gate passed** (owner, 2026-10-17: "P3 is good"). **P4a done** (2026-10-17): multi-line engine + starter select. **P4b done** (2026-10-17): Squirtle line playable. **P4b rework** (2026-10-18, D14): kit rules, Squirtle redesign, knockback → stagger, type chart + weight resistance. **P4c done** (2026-10-18): Bulbasaur line (Leech Seed status, Frenzy Plant root field, Solar Beam Venusaur-only). **P4d done** (2026-10-18): Pikachu → Raichu and Lapras (level-based signature tiers) playable; first gamble balance pass with a headless `npm run balance` report. Mutation skill trees designed and approved (D15–D21). **P4e is folded into P4f** (D21). **P4f done** (P4f-1 to P4f-8, 2026-10-18): all **110 of 110** Mutations built and tested; Charmander has its 8-move learnset; D19 holds on the balance bot (narrowly for Charizard); the maxed-Mutation stress builds stay far under budget. **Next:** ~~the Mutation map sites~~ **done as P4g (2026-10-18, D23)**; the owner tested sites and asked for a separate Mutation track with ranks: **D24 approved (2026-10-19)**, built as **P4h**. **P4h-1 done** (2026-10-19). **P4h-2 approved** (owner, 2026-10-19: "RANKS.md approved as written"). **P4h done** (P4h-1…9: Mutation slot and ranks for every line, favoured augments, site-bot balance; D25 recorded). **Next: the P4 gate playtest** (owner). Open owner questions are listed in the P4f-8 entry and the P4 gate playtest. Owner said "continue" after P4f-3 without feel-check notes; the rule-4 utility question is still open.

## P4 plan (owner-approved 2026-10-17, D13)
**Gate:** do the starters feel truly different? Is picking a tier (3-stage / 2-stage / no evolution) a real gamble?

| Step | Build |
|---|---|
| **P4a** | Multi-line engine: more Pokémon types (Water, Grass, Poison, Electric, Ice, Dark, Steel); statuses slow / stun (sleep, paralysis) / poison on the burn tick system; Shell block and damage reduction; zone-cast form; 360° melee; innate chain (≤ 3 jumps); per-line final trait picks; non-evolver signature tiers by level; **simple starter select screen** |
| **P4b** | Squirtle line |
| **P4c** | Bulbasaur line |
| **P4d** | Pikachu (2-stage) + Lapras (non-evolver); first balance pass on the early-vs-late gamble (§5 target: non-evolver ahead at ~5 min, level ~9 min, behind at 15 min) |
| ~~P4e~~ | ~~Ability ↔ tag links (§8.7)~~ folded into P4f (D21): Bonds and evolved ability tiers are the ability ↔ move link |
| **P4f** | Mutations (owner-approved plan 2026-10-18, D21), sub-steps below |
| **Gate** | Owner playtest |

### P4f plan (owner-approved 2026-10-18, D21)
Design: `docs/moveset/` (110 Mutations, 17 ability tiers). Each sub-step: typecheck, tests, build, commit, status update.
| Step | Build | Checks |
|---|---|---|
| **P4f-1** | `src/data/mutations.ts` (all 110 entries + numbers), types, Mutation sockets (one per move, single rank), `mutationOffers` filter, `grantMutation` + debug grant (`?mutate=id,…`, dev `window.__grantMutation`), build-panel display; Lapras Frost Breath tier removed (D18); D20 speeds | INDEX ↔ mutations.ts sync test; ability-tier IDs; augment levels never offer Mutations; offer filter; baseline balance |
| **P4f-2** | Hook layer (`src/sim/hooks.ts`): INDEX HookIds that exist today, `healPlayer` + single kill path, per-form Mutation hooks, `fromProc` (no proc-from-proc); Puddle/Soaked, Scorch (cap 6 each); guard rails (stun fatigue for new effects only, slow cap 70%, 40 kg trap limit, boss flag) | hook tests; stress bench (no per-step allocation) |
| **P4f-3** | Proof slice: Water Gun (Slick, Steady Aim), Withdraw (Spiked Shell, Counter Shell); `npm run mutations` (rule 4: ±15% vs Power Up I) | unit tests; browser; owner feel check suggested |
| **P4f-4** | Line mechanics + evolved abilities, one commit per line: Shell rework / Shell Burst, Flare Up, Bulb / Bloom, Charge / Discharge, Tide; trait twists | tests; `npm run balance` after each line; browser |
| **P4f-5** | 15 signature Mutations evolving per tier | per-tier tests; balance |
| **P4f-6** | Remaining 82 Mutations, one commit per line | tests; `npm run mutations`; balance; bench |
| **P4f-7** | Smokescreen + Blinded, Slash (Charmeleon), Wing Attack + their 9 Mutations; kit-rule test exemptions (D15) | tests; balance; browser |
| **P4f-8** | D19 balance close-out (bot without Mutations; Lapras XP ×0.85 from Lv 30 only if tuning alone fails), maxed-Mutation stress variant | full suite, bench, balance |
| **P4h-1** | D24 socket split and rank plumbing: the Mutation slot leaves the augment sockets, `mutationRank`, `ranks` data shape, rank-up site cards, switching resets to rank I, build panel and card text; placeholder rank values | tests; browser |
| **P4h-2** | Design docs: rank II/III values (+ rank III twists where natural) and favoured augments for all 110 Mutations in `docs/moveset/`. **Stops for owner approval** | ID-sync test |
| **P4h-3…7** | Ranks built per line (Squirtle, Charmander, Bulbasaur, Pikachu, Lapras), one commit each; rule-4 report per rank | tests; `npm run mutations` |
| **P4h-8** | Favoured augments: gold tag, ×3 offer weight | tests; browser |
| **P4h-9** | Balance: bot takes site cards; D19 with Mutations; rank-III stress; browser FPS | full suite; bench; balance |
- **Builds:** yes (`npm run build` passes, 2026-10-17).
- **Committed:** `844afd4` (P0 + P1), `4fb5b98` (P2a), `778aff0` (P2b), `9d0c3b1` (P2c); P2d commit follows this update.
- **P2d done** (2026-10-17): projectile pool + 500 cap, `?stress=1` mode, `?perf=1` readout, `npm run bench`. Stress: ~160 FPS with 500 enemies + maxed build; sim 0.82 ms/step (bench mean).
- **P2 is code-complete. Next: the owner playtests the P2 gate** ("play again" unasked? does each tester build the same move differently?). That playtest should also cover keys 1–5 / R and the Esc build panel, which couldn't be checked in a hidden pane.
- **P2a done** (2026-10-17): XP gems + magnet, level curve, XP bar, wave table with Pidgey/Raticate variants and HP scaling, 15:00 "Survived!" screen.
- **P2b done** (2026-10-17): 4 move forms, Charmander learnset, generic boosts, held items, level-up card window. Owner playtest: "currently is good".
- **P2c done** (2026-10-17): sockets, augment levels, 2-window flow + reroll, ranks I–III, 10 augments, Power Surge fallback, build panel. **The build panel (Esc) still needs a check in the owner's playtest.**

## P2 plan (owner-approved 2026-10-17)
**Gate:** do testers press "play again" unasked? Do two testers build the same move differently?
Scope: grey boxes, Charmander line only, no evolution (P3). Each sub-step ends with a runnable build and a commit.

| Step | Build |
|---|---|
| **P2a** | XP gems + magnet pickup; level curve tuned toward ~Lv 40 at 15:00; level/XP HUD; **15:00 → "Survived!" victory screen** (until Mewtwo in P5); wave table as data (enemy HP and spawn scaling over time); **Pidgey (fast) and Raticate (tanky) as stat-only chase variants** |
| **P2b** | Move framework (tags + forms). Learnset moves: **Scratch** (Normal·Melee·Contact, arc), **Fire Spin** (Fire·Orbit), **Dragon Rage** (Dragon·Beam), plus Ember. Normal level window (3 cards, keys 1/2/3): new move (4 slots + signature), generic boost (HP, damage, cooldown, speed, pickup, crit; **max 5 picks each**), held item (3 slots: Leftovers, Quick Claw, Wide Lens, Exp. Share). The sim pauses while cards are shown |
| **P2c** | 3 sockets per move; augment level every 3rd level (gold frame); window 1 = skill, window 2 = augment + Reroll (2 per run); ranks I–III; fallback = big generic boost; ~10 🟢 augments (+Damage, −Cooldown, +Area, +Duration, +Crit, Concentrated, Glass, Multishot, Scatter, Velocity); build panel on pause |
| **P2d** | Projectile pool + 500 cap; `?stress=1` mode (500 enemies + maxed build) with an FPS readout; record FPS, fix if under 60 |
| **Gate** | Owner playtest |

Architecture: `src/data/{moves,augments,items,waves}.ts`; `src/sim/{stats,progression,augments}.ts` + `src/sim/forms/`; `src/scenes/` level-up overlay, build panel, FPS readout. Unit tests for the XP curve, rhythm, pools, ranks, stat stacking, each form's hits, and the projectile cap.

**P1 gate playtest (owner, 2026-10-17):** all OK, no tuning changes.
- Speed (150 vs Rattata 75): OK, kiting low-level Pokémon should be easy.
- Spawn pressure ramp: OK.
- Contact damage (10, 0.6 s invulnerability): OK.
- Ember power: OK.
- Readability: good.

---

## P3 plan (owner-approved 2026-10-17, D10)
**Gate:** is evolving the best moment of the run? Scope: Charmander line only.

| Step | Build |
|---|---|
| **P3a** | Stage data (provisional): Charmander Lv 1 / 100 HP / 150 speed / ×1.0 dmg → Charmeleon Lv 10 / 140 / 160 / ×1.15 → Charizard Lv 25 / 200 / 175 / ×1.35, sprite grows per stage. **Auto evolution** at Lv 10/25 with a ~2 s cinematic (pause, "What? Charmander is evolving!", flash, grow) + "what changed" card. Blaze ability (<30% HP → +50% damage, red aura). Charizard's hazard immunity waits for hazards (P5/P6) |
| **P3b** | Signature tiers: Flame Burst (impact explosion, splash) `[+Area]`, Blast Burn (explosion + burning crater) `[+Zone]`. Generic zone system (reused by Bulbasaur in P4). New pools: Wide Blast (Area), Linger (Zone). Exclusives: Blaze Core (any tier), Mega Flare (Blast Burn) |
| **P3c** | On-hit hooks (§8.8) + status effects (0.25 s ticks). Behaviour augments: Pierce I–III, Homing, Return, Knockback, Burn (Fire), Lifesteal |
| **Gate** | Owner playtest |

## Session log

### 2026-10-21 — Snorlax playtest tuning (owner)
**Owner feedback (first Snorlax playtest):**
- Snorlax should move a little faster, with longer telegraphs: "pressure to fight it but not impossible to evade".
- Before a berry: a 3 s no-damage shake animation, the berry popping up at the 2 s mark so the player always sees it first, then Snorlax rushes it ("hangry").
- Boss HP felt hard to bring down with the current build, but the owner wants it **unchanged** for now and will re-test after these two changes.

**Changes (provisional values)**
- `src/data/content.ts`: Snorlax speed 55 → **75**.
- `src/data/arena.ts` (`SNORLAX_KIT`):
  - telegraph times: Body Slam 0.8 → **1.1 s**, wake-up slam 0.4 → **0.6 s**, Yawn 0.6 → **0.9 s**, Hyper Beam 0.8 → **1.1 s**
  - Gluttony gains `shakeSeconds: 3`, `dropAt: 2`, `rushMult: 2.2`
- `src/sim/bosses.ts`:
  - Gluttony is now an action: once Snorlax is free and the timer is up (and fewer than 3 berries are down), it stands still and shakes for 3 s, and the berry pops up at 2 s
  - after that it rushes the nearest berry at ×2.2 speed and **doesn't attack while a berry is down** (hangry); the 15 s timer restarts after the shake
- `src/sim/types.ts`, `src/sim/arena.ts`: `shakeLeft`, `berryDropped`.
- `src/scenes/RunScene.ts`: camera shake while Snorlax shakes the ground.

**Checks (observed)**
- `npm run typecheck` clean. `npm test` **419/419 passed** (the Gluttony test was rewritten: still for the shake, no berry before 2 s, berry at 2 s with no rush yet, then rush at ×2.2 and +8% on eating).
- `npm run build` passed.
- Browser (stepped by hand; the pane was throttled): during the shake the berry appeared and Snorlax stood still; a second later it had rushed and eaten the berry. No console errors. The camera shake itself wasn't seen (static screenshots).

**Follow-up (owner OK, same day):** kiting now matters.
- Body Slam only starts when the player is within **350 px** (was 450, the whole arena); farther away, Snorlax walks closer first.
- Yawn only starts within its **240 px** cloud reach, so it isn't wasted on a far-off player.
- Snorlax never commits to a move before it's in range, so it can't get stuck. 1 new test; suite **420/420**, build passed.

**Second follow-up (owner playtest, same day):** "the snore rings move very fast and kinda impossible to move to the safe area"; also wants a rare surprise berry leap.
- **Rubble shelters you from Snore:** a rock shadows the area behind it, seen from Snorlax.
  - `snoreOpenings()` (the gap plus rock shadows) is shared by the hit test and the drawing.
  - Rings are drawn in short arcs that skip every opening, so safe spots are visible.
  - I picked this over "a second hole" because it uses the rubble already in the fight.
- **Snore rings slower:** 240 → **170 px/s**.
- **Rare berry leap:** when the shake ends there's a **20%** chance Snorlax Body Slams onto the new berry with the normal 1.1 s ring (it eats the berry after recovering), instead of running.
- Checks:
  - 2 new tests: rock shelter on vs off, and the leap happens sometimes but under 45% of 40 seeded runs, landing on the berry. Suite **422/422**, build passed.
  - Browser (stepped by hand): the inner ring is visibly open behind both rocks, and the outer ring shows narrower shadows. No console errors.
  - The leap wasn't seen on screen (unit-tested only).

**Third follow-up (owner, same day):** "the boss is intense enough… it should kick the user out of the area instead of ending the game".
- `hitPlayer`: reaching 0 HP inside an arena flags `knockedOut` instead of fainting.
- `resolveArena` treats a knockout like a time-out (no reward), with the notice "Snorlax knocked you out of the arena!", and puts the player back on the map at **25% max HP** (`ARENA_TUNING.knockoutHpPct`) with the usual 2 s invulnerability.
- Dying on the main map still ends the run.
- PROJECT.md D28 updated. 1 new test; suite **423/423**, build passed.

**Next:** owner re-playtests Snorlax.

### 2026-10-21 — B2: the rest of Snorlax
**Built (BOSSES.md §4), all numbers in `SNORLAX_KIT` (provisional):**
- **Phases:** Rest at 66% and at 33%. Each Rest moves Snorlax to the next phase, and phases never go back. Rest's heal can't undo a phase.
- **Rubble:** each Body Slam leaves 2 rocks on the ring's edge. They block the player (not Snorlax) for 20 s; max 6.
- **Rest:**
  - asleep for 5 s, healing 25% over that time
  - takes ×1.5 damage; damage dealt fills a wake meter (10% of max HP)
  - a full meter cancels the heal and Snorlax wakes into a quick Body Slam (0.4 s wind-up)
  - **Snore:** every 1.5 s an expanding ring with a 70° gap that turns 75° per ring; it hits for 0.6× contact unless you're in the gap
- **Phase 2:**
  - **Yawn:** cone telegraph (0.6 s, 90°, 240 px), then a 4 s drowsy cloud that slows the player 40% inside it (no sleep, per README §10)
  - Body Slams come **in pairs**
- **Phase 3:**
  - **Belly Drum** at the start: current HP halved, contact ×2 (so slams, snores and beams hit twice as hard)
  - **Hyper Beam:** a line telegraph aimed where you stand (lead 0, 0.8 s), 3× contact, then a **2 s recharge** with Snorlax frozen: the biggest punish window

**Files**
- `src/data/arena.ts`: `SNORLAX_KIT` extended.
- `src/sim/bosses.ts`:
  - rewritten into `updateSlam`, `updateBeam`, `updateRest`, `updateSnores`, `updateYawn` plus the Snorlax picker (beam > slam > yawn)
  - Snorlax's speed is now derived each step (0 while asleep, slamming or beaming)
  - `blockByRubble`
- `src/sim/types.ts`: new `ArenaFight` fields (phase, rest, snores, yawn, beam, rubble, playerSlow, slamsQueued…); notices `rest` / `woke` / `bellyDrum`.
- `src/sim/combat.ts`: `damageEnemy` applies ×1.5 to a sleeping arena boss and fills its wake meter.
- `src/sim/world.ts`: `movePlayer` applies the Yawn slow.
- `src/sim/arena.ts`: new fight state; rubble push-out after the arena wall.
- `src/scenes/RunScene.ts`:
  - grey rocks, Snore rings with their gap, Yawn cone (red outline, then pink cloud), Hyper Beam band (thickening telegraph, then a flash)
  - HUD "asleep, wake N%"
  - notices for rest, woke and Belly Drum

**Checks (observed)**
- `npm run typecheck` clean. `npm test` **419/419 passed** (6 new; the B1-3 Gluttony test moved to 80% HP so it doesn't trigger Rest):
  - rubble blocks and crumbles
  - Rest at 66%: still, heals, snores, then phase 2
  - ×1.5 asleep and the wake meter gives a quick slam
  - Snore misses in the gap and hits outside it
  - phase 2 Yawn slows and slams pair up
  - phase 3 Belly Drum (contact ×2) and Hyper Beam with recharge
- `npm run build` passed. Bench 0.87 ms mean.
- Browser (Squirtle): the pane was throttled to ~1 fps, so I stepped the sim by hand from the page (dev server's `step`) and screenshotted:
  - Rest notice, wake meter on the HUD, Snore rings with rotating gaps, rubble
  - phase 2 Yawn cloud slowing the player (0.4)
  - phase 3 Hyper Beam telegraph
  - no console errors
  - Belly Drum's notice and the beam flash weren't seen on screen (unit-tested only)

**Risks**
- The whole fight is untested in real play. Its length now includes two Rests (+25% each unless interrupted), so the 120 s limit may be tight.
- The Hyper Beam band is drawn past the arena wall.
- Rubble blocks only the player, not Snorlax or adds (there are no adds yet).

**Next:** owner playtest of the full Snorlax fight; then the other arena bosses (birds) or tuning.

### 2026-10-21 — B1-3: Snorlax phase 1 kit
**Built (BOSSES.md §4 phase 1):**
- **Body Slam:**
  - lead-aimed ring telegraph (player position + velocity × 0.8 s × 0.5, locked at start, kept inside the arena)
  - Snorlax holds still during the 0.8 s wind-up, lands on the ring, and hits the player inside for 2× contact (Shell can block it)
  - 0.7 s recover window, then it chases again; 6 s cooldown, first slam 2 s into the fight
- **Gluttony:**
  - an Oran Berry drops somewhere in the arena every 15 s (max 3)
  - Snorlax walks to the nearest one and eats it to heal 8%; you can grab it first (normal berry heal)

**Not built:** rubble from Body Slam (needs obstacles) moves to B2 with Rest, Yawn, Belly Drum, Snore and Hyper Beam.

**Files**
- `src/data/arena.ts`: `SNORLAX_KIT` (all numbers provisional).
- `src/sim/bosses.ts` (new): `leadAim` (BOSSES.md §2 fairness rules), Snorlax's AI, `updateBoss` dispatch by boss id.
- `src/sim/types.ts`: `Player.vx/vy` (actual velocity, 0 when still); `ArenaFight.goal / slam / slamCooldown / berryTimer`.
- `src/sim/world.ts`:
  - `movePlayer` stores the velocity
  - `moveEnemies` sends the boss to `fight.goal` when one is set
  - contact damage now goes through the new exported `hitPlayer(world, damage, enemy)` (Shell block, weaken/Blinded, damage-taken, hooks), which Body Slam reuses; same behaviour as before, all old tests pass
- `src/sim/arena.ts`: runs `updateBoss` once the fight is engaged; sets Snorlax's opening timers. Shortcut (commented) until a second boss exists.
- `src/scenes/RunScene.ts`: red ring telegraph that fills during the wind-up; Mutation Sites hidden during an arena fight (they had been drawn inside the arena).

**Checks (observed)**
- `npm run typecheck` clean. `npm test` **413/413 passed** (3 new):
  - lead-aimed ring locked after movement; Snorlax still, then lands, recovers and resumes speed; standing still means no lead
  - 2× contact inside the ring, nothing when you step out
  - berry drops inside the arena, Snorlax targets it, eats it and heals 8%
- `npm run build` passed. Bench 0.87 ms mean.
- Browser (Pikachu, dev handle into the arena, standing still):
  - ring locked on the player and filled
  - a berry dropped
  - Snorlax landed on the player: HP 105 → 32
  - sites no longer drawn in the arena
  - no console errors

**Risks**
- Slam damage is heavy for a low-level player: 2× contact = ~70 at 3:00. A real Lv ~10 player has more HP, but tuning is needed.
- Not played by hand.
- The jump has no travel animation yet (instant landing plus a blast).

**Next:** owner playtest of the arena loop (event → fight → combine → reward), then B2.

### 2026-10-21 — B1-2: skill combine (D28)
**Owner decisions:**
- A move can be combined only with all 3 augment sockets filled (Mutations are on their own track and don't count).
- An absorbed move frees its learnset slot.
- The combo fires on the **average** of its members' cooldowns.

**Files**
- `src/sim/combo.ts` (new): `MAX_COMBO_MOVES` (4), `learnsetSlotsUsed`, `comboCandidates`, `comboCooldown`.
- `src/sim/world.ts`:
  - `World.combo` holds slot indices, base first.
  - `updateMoves`: members skip their own cooldown; when the base is ready every member fires, the base takes the average cooldown, then each fired move's `onCast` runs (same order as before).
  - Casting moved into `fire()`.
- `src/sim/arena.ts`:
  - A boss win opens `combine` (pick the base, or a move to absorb; Esc skips), then the `arenaReward` pick.
  - With no qualifying move, the reward says "no move with 3 augments to combine" (`combineMissed`).
- `progression.ts`, `sites.ts`, `mutations.ts`: the learnset-slot checks use `learnsetSlotsUsed`, so absorbed moves free a slot.
- `buildSnapshot.ts`: v3 stores the combo.
- `balance.ts`: the bot handles the combine window.
- `RunScene.ts`: combine window (COMBO BASE / ABSORB cards, footer explains the rules); ⛓ after combo moves in the HUD.

**Checks (observed)**
- `npm run typecheck` clean. `npm test` **410/410 passed** (5 new):
  - eligibility needs 3 augments; cap of 4
  - freed learnset slots bring new moves back to level cards
  - members fire with the base on the averaged cooldown and never on their own
  - win → combine (base) → reward; Esc skip → reward
  - no qualifying move → reward flagged as missed
- `npm run build` passed. Bench 0.90 ms mean (noise vs 0.84).
- Browser (Charmander, dev handle gave Ember 3 augments, then moved into the event and killed the boss):
  - combine window offered Ember as base
  - picking it set the combo, "Ember⛓" showed in the HUD, then the 5-card reward appeared
  - picking Haste applied it
  - no console errors
  - a number-key press didn't register in the pane (clicks did)

**Not verified / risks**
- Combo feel in real play.
- A combo of very different cooldowns (e.g. a 1 s projectile with a 6 s orbit) makes the fast move slower and the slow one faster. That's the intended trade, but untested for balance.
- A win with no qualifying move loses that combine step (nothing is banked).

**Next:** B1-3: Snorlax phase 1 kit (ring telegraphs, Body Slam with lead aim, Gluttony berries in the arena).

### 2026-10-21 — B1-1: arena boss events (D28)
**Owner decisions (D28):**
- Mewtwo is the only main-map boss; other bosses are arena bosses drawn at random.
- 4 events per run.
- The first event avoids a boss that counters the starter.
- The run clock keeps ticking in the arena.
- Reward is a combine step plus a mixed pick.
- Built in steps: B1, then B2.

BOSSES.md now carries a D28 note.

**B1 plan:**
- **B1-1** (this entry): events, arena, timer, scaling, mixed reward.
- **B1-2:** skill-combine engine and the combine-step reward.
- **B1-3:** Snorlax phase 1 kit (ring telegraphs, Body Slam with lead aim, Gluttony berries).
- **B2:** Rest with interrupt bar, Yawn, Belly Drum, Snore rings, Hyper Beam.

**Files**
- `src/data/arena.ts` (new): `ARENA_BOSSES` (Snorlax: mountain hole, 120 s) and `ARENA_TUNING`:
  - event times 180 / 390 / 600 / 680 s ± 20 s
  - open 60 s, entrance 600–900 px away
  - arena radius 450, engage within 250 px or after 6 s
  - 2 s invulnerability on return, 5 reward cards
- `src/sim/arena.ts` (new):
  - seeded `arenaSchedule`
  - `arenaBossChoices` (no repeats; event 1 skips bosses that resist the starter's types)
  - `updateArena`: open, close (missed) and enter the entrance; arena wall; engage; timer
  - `resolveArena`: win gives a reward, time-out gives nothing; XP left in the arena is collected on the way out
  - `rollRewardCards`: level, augment and site pools, ≥ 1 from each; never a socket replace
  - `chooseArenaReward`
- `src/sim/types.ts`: `RewardCard`, `ArenaEntrance`, `ArenaFight` (the main map is stored while you're inside), `ArenaNotice`, offer kind `arenaReward`, World arena fields.
- `src/sim/world.ts`: `updateArena` after movement; no spawner or sites during a fight; `resolveArena` after deaths.
- `src/sim/progression.ts`: `applyCard` and `applyAugmentCard` extracted. `src/sim/sites.ts`: `applySiteCard` extracted.
- `src/data/content.ts`: `snorlax` enemy (boss, 3000 HP base, 55 px/s, radius 40, 30 contact, 460 kg). A plain chaser for now.
- `src/sim/combat.ts`: `MAX_ENEMY_RADIUS` leaves bosses out; `queryEnemies` pads by the boss size only while a fight runs.
  - Shortcut (commented): melee targeting reaches a boss up to 23 px later.
  - Without this, the radius-40 boss slowed every step by ~30% (bench 0.85 → 1.11 ms).
- `src/sim/balance.ts`: the bot takes a random arena reward if it ever wins one.
- `src/scenes/RunScene.ts`:
  - entrance (dark hole, tan rim) and arena wall
  - edge arrow to the entrance (arrow code shared with sites)
  - HUD line: "A mountain hole is open: 0:42", "Walk to the middle", "Snorlax: 1:52 left"
  - boss HP bar
  - notices for opened / missed / won / lost
  - reward window "Boss defeated! Pick one"

**Checks (observed)**
- `npm run typecheck` clean. `npm test` **405/405 passed** (9 new in `arena.test.ts`):
  - schedule seeded and ends before 15:00
  - entrance opens near the player, never with spawns off
  - missed close
  - starter-fair pool
  - entering stores the map and scales the boss by the wave
  - engage, timer and wall
  - win restores the map and gives a mixed reward that applies
  - time-out gives no reward
  - reward never asks for a replace
- Found by test: with event 4 at 12:00, a late entry ran past 15:00, so it moved to 11:20.
- `npm run build` passed. `npm run bench`: 0.84 ms mean (maxed build).
- Browser (Charmander, 165 fps), driving the player with the dev handle:
  - entrance opened with banner, countdown and arrow
  - stepping in showed the arena wall, waiting Snorlax (5054 HP at 3:07), boss bar and "Walk to the middle"
  - engaging started the 120 s timer and Snorlax chased
  - killing it (hp set to 0) showed "Snorlax defeated!", restored the map and opened the 5-card mixed reward
  - picking Dragon Rage added the move
  - no console errors

**Not verified / risks**
- Snorlax's HP (3000 base × wave) is a guess; real fight length is untested in play.
- The fight wasn't played by hand.
- The edge arrow can sit under the HUD text in the top-left corner.
- The entry animation is a placeholder (instant).
- Combine step not built yet (B1-2).
- The counter rule is only testable once a boss with resistances joins the pool.

**Next:** B1-2 (skill combine). Owner checks first: whether "fully socketed" counts a Mutation socket, and what bonus the combo base gets.

### 2026-10-21 — Enemy design framework (D27, design only)
- **Phase:** P4 (gate playtest still pending). The owner made this session the **enemy designer**. Objective: a
  design (no code) for enemy stats, status resistance and type effectiveness. **Status:** framework drafted, waiting
  for the owner's answers.
- **Files:** `docs/enemies/README.md` (new framework: resistance tiers, a type-derived status table, a lore flavour
  table, Flying ignoring ground effects, existing + future lore statuses, elite/boss abilities, base-stat formulas,
  the current 6 enemies worked out); `PROJECT.md` §13 **D27** (the owner's 8 answers).
- **Commands:** none on the game. No code changed, so the build is unaffected (not re-run). Also added the caveman
  status-line badge to the user's global `~/.claude/settings.json` (owner request).
- **Decisions obtained:** D27 (1)–(8). **Pending:** `docs/enemies/README.md` §8: tier numbers, the flavour table +
  Flying rule, the boss rule, Speed ordering reversing today's fast enemies, and Raticate/Fearow/Tauros abilities.
- **Risks:** following official Speed makes Pidgey/Spearow slower and Raticate/Tauros faster, and Tauros much less
  tanky. Enemies are all Normal or Normal/Flying today, so the type chart barely matters until typed enemies arrive.
  The roster (P5 archetypes) is future-phase content: design only for now.
- **Follow-up (same day):** the owner approved §8 Q1–3. Speed now comes from **role bands** (README §6.2). Every
  species has an **ability, active only on its Elite/Boss variant**, and Elite is a variant of any species (README
  §7). There's a **horde-ready data block** for the owner's planned "Elite leads its horde" event (README §8; the event
  logic belongs to the game logic designer). Owner: a horde is the leader's **own species line** (Elite Raticate →
  Raticate + Rattata). **Approved:** the Elite multipliers (README §7) and Raticate = tank. **Owner raised:** the
  speed cap makes Agility pointless; enemy attack styles; statuses on the player. **Approved: two speed tiers**
  (README §6.2; flankers 115–145, replacing D26's invariant; the D26 unit test must change when this is built).
  **Written on owner request:** attack styles + telegraphs (README §9) and player statuses (README §10).
  ROSTER: flanker speeds updated (Pidgey 123, Spearow 127, Fearow 133) and an Attack row on every sheet.
  **Pending:** README §12 (the full roster go-ahead; the Ambusher veto).
- **Committed** on branch `enemy-design-d27` (`76e2a44`). Not merged to main.
- **Batch 2 (uncommitted):** ROSTER has 10 new species (Caterpie, Weedle, Zubat, Oddish, Psyduck, Geodude, Gastly,
  Abra, Voltorb, Chansey), type-chart rows for Bug/Rock/Ground/Ghost/Psychic defenders, a starter-element counter
  table, and spawn data (tier + rough threat). README §11 is the **spawn variety** proposal for the game logic
  designer (owner idea: random species per run, same difficulty curve). **Owner approved all of it** (README §12
  Q5–Q9): the Ambusher is kept, spawn variety is the gist, the batch 2 abilities and threat scores are OK, healers stay
  out of horde events. Committed on `enemy-design-d27`.
- **Bosses (uncommitted):** new `docs/enemies/BOSSES.md`: design levers, anti-speed tools (lead aim from the owner's
  预判 idea, bracket, past aim, cover, interrupt bar, tether, rhythm), the scripted boss framework with a cost table,
  Snorlax / Articuno / Zapdos / Moltres / Mewtwo with phases, and 7 future candidates. **Owner answered §7:**
  arena-only weather OK, Snorlax Gluttony, Mewtwo Pressure, bird adds OK. Owner added the **projectile layer**
  (BOSSES §2b plus a Projectiles row per boss). Committed on `enemy-design-d27`.
- **Next task:** the owner decides on the merge to main and the next enemy work (more species, or a P5 build plan).
- **Next task:** owner answers; then bosses (Snorlax, Articuno/Zapdos/Moltres, Mewtwo). New `docs/enemies/ROSTER.md` covers the 6 current species. **Pending:**
  README §9: the Elite multipliers,
  Raticate's role (tank vs bruiser), and a go-ahead for the full roster.
- **Next task (superseded):** owner answers §8, then the roster task (`docs/enemies/ROSTER.md`: the 18-type chart, a sheet for
  every enemy, a counter for each starter element in every wave window).

### 2026-10-20 — XP gem expiry, Magnet drop, difficulty over time (D26)
**Owner requests:** XP seemed to stop dropping; add a 3-min gem timer; a Magnet drop (cheapest option); stronger mobs with better XP and/or difficulty scaling over time.
**Cause found:** with 400 gems on the floor, `dropGem` folded new XP into the oldest gem (usually far away), so kills looked like they dropped nothing.

**Files**
- `src/data/content.ts`: `TUNING.xp.gemLifetimeSeconds = 60` (owner: 3 min → 1 min), `TUNING.magnet.dropChance = 0.01` (was 0.003; owner saw no Magnet in a test, ~1 per 330 kills was too rare); enemies Spearow (22 HP, 120 px/s, 13 dmg, 3 XP), Fearow (75 HP, 120 px/s, 24 dmg, 12 XP), Tauros (180 HP, 88 px/s, 32 dmg, 22 XP), all stat-only.
- `src/data/waves.ts`: keyframes gain `damageScale` (1 → 2) and `speedScale` (1 → 1.15); Spearow from 3:00, Fearow + Tauros from 10:00. **Fodder phases out** (owner left the timing to me): Rattata stops at 10:00, Pidgey at 13:00 (final mix Raticate 2 · Spearow 2.5 · Fearow 1.5 · Tauros 1).
- **Straggler recycling** (owner OK 2026-10-21): with spawns on, an enemy farther than 1.5× the spawn ring distance is moved onto the ring ahead of the player (facing ±60°), keeping HP and statuses (`recycleStragglers` in `world.ts`, `TUNING.spawn.recycleFactor / recycleSpread`). 1 new test; suite **396/396**, build passed.
- `src/sim/world.ts`: `waveAt` interpolates the new scales; the spawner applies them; gems expire unless already pulled; `pullGems`; berry pickup runs the Magnet. `src/sim/combat.ts`: `maybeDropMagnet` on every kill, gem `expiresAt`. `src/sim/types.ts`: `Gem.expiresAt`, `Berry.kind` ('oran' | 'magnet').
- `src/scenes/RunScene.ts`: Magnet drawn as a red U; colours for the 3 mobs.
- Tests: 3 new in `world.test.ts` (scales interpolate, rise and stay below the slowest stage, spawner applies them; gem expiry keeps pulled gems; Magnet pulls on-screen gems only), weight-count test made enemy-list-proof, 2 Lapras test gem literals gained `expiresAt`.

**Checks (observed)**
- `npm run typecheck` clean; `npm test` **395/395 passed**; `npm run build` passed.
- Browser (port 5181, own server): gems and a Magnet render (diamonds, red U). **Not verified live:** the pane ran at ~2 fps (app window not in view), so picking up the Magnet, the new mobs and the late-game difficulty weren't watched in play.

**Risks**
- More XP per kill late (new mobs) means faster levelling; damage ×2 by 13:00 makes the end harder. `npm run balance` (bot is invulnerable) won't show survivability; owner playtest needed. D19 DPS ordering untouched but not re-run.
- Magnet uses the gameplay RNG on every kill, so seeded runs differ from before (no test needed changing for it).

**Next:** owner playtest of the late game (10:00+), then the P4 gate playtest.

### 2026-10-19 — P4h-9: balance with the site-taking bot, rank-III stress, browser FPS (D25)
**Owner:** "Continue with P4h-9: balance and stress."

**Balance bot (test tooling):** `playLine(..., { sites: true })` walks to the nearest Mutation Site within the HUD arrow range (1500 px), stands near its centre until it opens and takes a random card. With no site in range it roams, picking a new random heading every 8 s from its own seeded stream, so card picks are unchanged. Checkpoints now record Mutations with ranks, sites opened and Power Surges. `npm run balance` prints both bots side by side: `dps` (no sites) and `site dps`.

**Findings that needed the owner (asked 2026-10-19):**
- A circling bot only found ~2 sites. A roaming bot opened **~60 sites per run** and held all 5 moves at rank III by ~9:00.
- Once nothing was eligible, every site gave the uncapped Power Surge (+15% damage each, ~40 per run). DPS reached ×5–9 at 15:00 (Venusaur 6086, Charizard 3593, Raichu 3421, Blastoise 3039, Lapras 2274).
- Without sites the bot now gets no items either (items are site-only since P4g). D19 fails there: Charizard 473 < Raichu 484, and Lapras 420 is 13% below Raichu.

**Decision D25 (owner, recorded in `PROJECT.md` §13):**
1. A site with nothing eligible gives a heal plus a time-limited Power Surge (owner: "maybe gives a heal and a surge but just for a limited of time").
2. D19 is judged on the site-taking bot.
3. Site density goes from 35% to 20% of chunks.

The build defaults I set (provisional, not asked): heal 30 HP, +15% damage for 30 s, and a new surge refreshes the timer (no stacking). Level-up Power Surge is unchanged.

**Built:**
- `SITE_TUNING.chance` 0.2, plus `SITE_TUNING.surge`.
- `SiteCard` `bigBoost` became `surge`.
- `World.surgeLeft` ticks down in `tickTimers` and refreshes stats when it ends; `refreshStats` adds the surge's damage while it lasts.
- The site card reads "NOTHING LEFT HERE · Heal + Power Surge".
- The Esc panel shows "Site surge N s".
- `sites.test.ts` fallback test: heal, +15% damage, a second surge refreshes rather than stacks, it wears off after 30 s, and `bigBoosts` stays 0.

**D19 on the site bot, after D25 (8 seeds, 15:00 DPS):** Venusaur 1286, Charizard 717, Blastoise 641, Lapras 610, Raichu 606. **D19 holds:** every 3-stage final form is above Lapras and Raichu, which are 1% apart. No tuning was needed.
- Blastoise is only 5% above Lapras.
- Venusaur is ~2× the rest (Bloom reads high on an always-full-HP bot, as before).
- The roaming bot opens ~35 sites per run and reaches 15 Mutation ranks (all rank III) by ~12:00.
- The roaming bot ends at Lv ~30, not ~40 like the circling bot. Fewer kills while roaming is the likely cause; not investigated.
- A timed site surge may be active during a measurement (up to +15% on that reading).
- §5 (provisional, not D19): Lapras does not lead at 5:00 (Ivysaur 429, Lapras 206).

**Rank-III stress (`npm run bench`, sim only):** maxed Mutation builds at rank III, 500 enemies. Mean per step: charmander 0.39 ms, squirtle 0.42, bulbasaur 0.37, pikachu 0.36, lapras 0.39 (p99 ≤ 0.9 ms). `?stress=1` build: 0.80 ms. All far under the 4 ms aim.

**Browser FPS (dev server, pane hidden):** `?stress=<line>` and `?stress=1`, 500 enemies held, no console errors.

| Build | FPS | Sim ms |
|---|---|---|
| charmander | 62–74 | 0.42–0.49 |
| squirtle | 61–69 | 0.40–0.58 |
| bulbasaur | 65–78 | 0.35–0.58 |
| pikachu | 59–64 | 0.47–0.52 |
| lapras | 61–65 | 0.36–0.54 |
| `?stress=1` | 61–70 | 0.8–1.0 |

Draw-cmd was 0.16–0.44 ms throughout. The hidden pane caps the frame rate: `?stress=1` read 159 FPS with the pane visible in P2d. So these FPS figures are a floor; real FPS on a visible screen is not measured.

**Checks (observed):** `npm run typecheck` clean; `npm test` **392/392 passed**; `npm run build` passed; `npm run balance` ran (3 runs this session, ~10 min each); `npm run bench` ran. Not checked: the new site fallback card on screen.

**Next:** the P4 gate playtest (owner). Worth watching there: how many sites a real player opens with the horde around (the bot is invulnerable), whether the 30 s surge feels worth a detour, and Blastoise's narrow lead over Lapras.

### 2026-10-19 — P4h-8: favoured augments (D24)
**Owner:** "Continue with P4h-8: favoured augments."

**Built:**
- **Data:** `MutationDef.favoured` lists each Mutation's 2–3 favoured augments, copied from the RANKS.md Favoured column (all 110). `MUTATION_RANKS.favouredOfferWeight` is 3 (provisional).
- **Offers:** `isFavoured(world, slotIndex, augmentId)` in `progression.ts` is true when the move's Mutation favours that augment. `drawAugmentCards` weights favoured cards (new and rank-up) ×3, both for the guaranteed behaviour/exclusive card and for the rest. There is no other bonus. The private `draw()` takes an optional weight; without one it draws exactly as before.
- **Scene:** favoured augment cards get a deeper gold frame (`COLORS.favoured`), a "★ FAVOURED ·" heading prefix and a "Suits <Mutation>." line.
- **Tests (`mutations.test.ts`):** the data matches the RANKS.md column. Over 4000 seeded draws, a favoured augment shows up more than 2× as often as other plain augments, and evenly (0.8–1.25×) without the Mutation. `isFavoured` holds only for the move that has the Mutation. The existing doc test still checks 2–3 legal, non-excluded augments.

**Checks (observed):** `npm run typecheck` clean; `npm test` **392/392 passed**; `npm run build` passed. Browser: not checked (the hidden pane can't draw cards), so the gold card is unverified on screen.

**Risk:** the weighting changes which augments the balance bot sees once it holds a Mutation, so the P4h-9 balance runs will differ from earlier ones.

### 2026-10-19 — P4h-7: Lapras-line Mutation ranks (D24)
**Owner:** "Continue with P4h-7: Lapras-line ranks."

**Built (11 Mutations):** all hooks in `bodySlam`, `iceBeam`, `surf` (Ferry Wave), `hydroPump` (Pressure Shell) and `iceShard` read their values at the slot's rank.
- **Tide ranks:** `MutationDef.tideRanks` holds rank II and III overrides for the Flood and Ebb values, and `rankedTide(id, rank)` builds them like `rankedValues` (cached; III on top of II). This scales both sides of the Tide, as the RANKS.md rule says.
- The four Lapras Bonds use it: Surging Slam (Flood 3/4/5 slams, Ebb 1/2/2), Flash Freeze (Flood freeze 0.6/0.7/0.8 s, Ebb width ×1.2/1.3/1.4), Ferry Wave (Flood gems ×1.5/1.75/2, Ebb ×1/1.2/1.4) and Pressure Shell (cap Flood 60/80/100, Ebb 30/40/50).
- New rank-I key: `iceShard.song.damageMult` (Song of the Sea is utility, so its ranks add move damage). Song gained a stats hook.
- **Placeholder removed:** every Mutation now has its own ranks, so `MUTATION_RANKS.placeholderDamageMult` and its uses in `stats.ts`, the rank-up card fallback in `RunScene.ts`, and the bench's "(placeholder)" tag are gone. `MUTATION_RANKS` keeps `max: 3`.
- `mutations.test.ts`: the placeholder test is replaced by "every Mutation has its own ranks and card text", and a new check that Tide overrides match the rank-I Flood/Ebb keys and types.
- `laprasRanks.test.ts`: 8 tests (Surging Slam Flood/Ebb slams, Pressure Shell caps, Flash Freeze freeze and width, Ferry Wave gem reach, rank-I Tide unchanged, Shockwave 200 px, Song damage, Frost Lance slow).

**Rank tuning (provisional; target II ≈ 1.15, III ≈ 1.30):**
- Shockwave slam ×0.82 / ×0.9 (doc 0.85 / 0.95).
- Surging Slam dmg ×0.97 / ×1.08 (doc 0.95 / 1.05).
- Aurora Beam, Flash Freeze and Ferry Wave dmg ×0.92 / ×1.04 (doc 0.9 / 1.0).
- Frost Lance cooldown ×1.2 / ×1.02 (doc 1.25 / 1.1).

RANKS.md and the card text were updated to match. Final readings: most at 1.14–1.17 / 1.27–1.33.
- Belly Flop 1.00 / 1.25 and Pressure Shell 1.20 / 1.20: whole-cast cooldown steps in the 10 s window. Kept at the doc values. At the steady cast rate Belly Flop is ≈1.14 / 1.29, and Pressure Shell is ≈1.09 / 1.20 plus the larger store cap (the bot never takes armour hits).
- Frost Lance II 1.09: the same cooldown step (steady rate ≈1.17).

**Checks (observed):** `npm run typecheck` clean; `npm test` **389/389 passed**; `npm run build` passed; `npm run mutations` (Lapras moves) ran. Browser: not rechecked (the hidden pane can't draw cards). The rank-up card now always shows the Mutation's own rank text.

### 2026-10-19 — P4h-6: Pikachu-line Mutation ranks (D24)
**Owner:** "Continue with P4h-6: Pikachu-line ranks."

**Built (21 Mutations):** all hooks in `quickAttack`, `spark`, `electroBall`, `thunderWave`, `ironTail`, `thunder` and `thunderShock` read their values at the slot's rank.
- Engine change: `ChainBias` gained `damageMult` (aggregated with max; `NO_BIAS` is 1). `chain()` in `forms/projectile.ts` multiplies the next jump's damage by it. This carries Conductor's rank II/III jump damage between fields.
- New rank-I keys (twists start off): `thunderWave.pulse.damageMult`, `thunderWave.conductor.chainDamageMult`, `thunder.thunderstorm.strikeRadiusMult`, `electroBall.plasma.damageMult`.
- Twists: Thunderstorm III widens the Discharge strike ×1.5; Static Spark III caps extra sparks at 4 (3); Ricochet III 3 bounces; Volt Tackle III dash 150 px; Static Pulse III ring 165 px.
- `pikachuRanks.test.ts`: 6 tests (Conductor jump damage between fields only, Static Spark 4 sparks, Thunderstorm strike radius, Volt Tackle dash, Static Pulse damage, Ricochet bounces).
- The placeholder check moved to Ice Shard Hail (Lapras), the last unranked line.

**Rank tuning (provisional; target II ≈ 1.15, III ≈ 1.30):**
- Double Hit second hit 80% / 90% (doc 75% / 90%).
- Arc Pair dmg ×0.69 / ×0.75 (doc III 0.78).
- Shower bolts 75% / 85%, cooldown ×1.05 / ×0.95 (new).
- Ricochet III dmg ×0.8 (doc 0.95): the third bounce over-delivered.
- Plasma Orb move dmg ×1.15 / ×1.27 (new): its growth alone read ≈1.05.
- Velocity Ball dmg ×0.66 / ×0.72 (doc 0.69 / 0.78).
- Static Pulse move dmg ×1.15 / ×1.08 (doc III 1.3) with the 165 px ring (doc 180).
- Iron Spin III dmg ×0.9, reach ×0.85 (doc 1.04 / 0.9).
- Storm Call strikes 92% / 105%, III radius 34 px (doc 40).
- Live Wire wires 27% / 32%, jumps ×0.82 / ×0.93.
- Return Arc dmg ×0.85 / ×0.95 (doc 0.92 / 1.04).

RANKS.md and the card text were updated to match. Final readings: most at 1.13–1.16 / 1.27–1.33.
- Iron Spin III 2.25: the longer reach crosses the bench's 80 px ring circle, so the bench reading jumps. In a real horde it is ≈1.3.
- Static Pulse III 1.08 on the bench: the 165 px ring no longer crosses a circle. In a crowd it is ≈1.31.
- Slam 1.33 / 1.33: whole-cast cooldown steps.
- Static Spark 1.05 / 1.18, Shock Shatter 1.12 / 1.25, Terrain 1.04 / 1.22: conditions the bot only partly meets.
- 1.00 (the bot never meets the condition): Volt Tackle, Conductor, Thunderstorm.

**Checks (observed):** `npm run typecheck` clean; `npm test` **381/381 passed**; `npm run build` passed; `npm run mutations` (Pikachu moves) ran. Browser: not rechecked (the hidden pane can't draw cards).

### 2026-10-19 — P4h-5: Bulbasaur-line Mutation ranks (D24)
**Owner:** "Continue with P4h-5: Bulbasaur-line ranks."

**Built (27 Mutations):** all hooks in `tackle`, `razorLeaf`, `leechSeed`, `poisonPowder`, `sleepPowder`, `sludge`, `petalDance`, `solarBeam` and `vineWhip` read their values at the slot's rank.
- Engine change: `Enemy.seedJumped` (boolean) became `seedJumps` (count), so Spreading Seed III can jump twice; its existing test now checks the count.
- New rank-I keys: `drift.damageMult` and `drowsy.damageMult` (the utility move damage from RANKS.md); `healthyGrowth.damageMultFull`, `frenzy.damageMult` and `longLash.damageMult` (tuning, below).
- Ingrain's damage-taken hook now reads its slot.
- `bulbasaurRanks.test.ts`: 7 tests (Spreading Seed two jumps, Healthy Growth pierce 2, Drift and Drowsy damage, Drowsy slow 60%, Ingrain 0.7 s, Thorn Garden 5 sprouts, Rollout 6 stacks).
- The placeholder check moved to Live Wire (Pikachu).

**Rank tuning (provisional; target II ≈ 1.15, III ≈ 1.30):**
- Healthy Growth gains +10% / +15% at full HP (its ranks only helped the hurt state, and the bot is always at full HP).
- Embed rip 66% / 85% (doc 60% / 75%).
- Seed Bomb 15.5% / 16% (doc 12% / 14%).
- Seed Network seed damage ×0.83 / ×0.95 (doc 0.8 / 0.9).
- Toxic +31% / +28% per stack (doc 23% / 26%; III also has the longer cloud).
- Frenzy Dance move damage ×1.1 / ×1.2 (new).
- Prism main beam ×0.95 / ×1.05 (new; only the fan beams scaled).
- Long Lash move damage ×1.08 / ×1.15 (new).
- Thorn Garden lashes 45% / 50% (doc 35% / 40%).

RANKS.md and the card text were updated to match. Final readings: most at 1.13–1.16 / 1.26–1.32.
- Seed Bomb II 1.10.
- Frenzy III 1.20: the 200 px petals overshoot the ring.
- Healthy Growth 1.10 / 1.15 at full HP only; ≈1.13 / 1.24 averaged with hurt.
- Ingrain II 1.05: the bot always stands still.
- 1.00 (the bot never meets the condition): Bowling (no collisions on the spread ring), Spreading Seed (no kills), Spore Sac, Sweet Dreams, Petal Blizzard.
- Nightmare 1.03 / 1.06: utility; its vulnerability helps other moves.

**Checks (observed):** `npm run typecheck` clean; `npm test` **375/375 passed**; `npm run build` passed; `npm run mutations` (Bulbasaur moves) ran. Browser: not rechecked (the hidden pane can't draw cards).

### 2026-10-19 — P4h-4: Charmander-line Mutation ranks (D24)
**Owner:** "Continue with P4h-4: Charmander-line ranks."

**Built (27 Mutations):** all hooks in `scratch`, `fireSpin`, `dragonRage`, `airSlash`, `hurricane`, `smokescreen`, `slash`, `wingAttack` and `ember` read their values at the slot's rank. New rank-I keys for twists:
- `corneredDragon.crossDamageMult`: the Flare Up cross hits ×1.5 at III. RANKS.md now says "hits", since the cross is instant.
- `searingSlash.cashInMult`: ×1.25 at III.
- `backdraft.damageMult`.
- `kindle.kindledBurnPct`: Kindled shots add Burn to their hit. The Blast Burn meteor (a strike zone) doesn't Burn.
- `afterimage.damageMult`.

Fan the Flames' growth cap now follows its rank. The other twists reuse existing keys (stacks, burst radius, HP thresholds, level step, homing delay, travel speed, stagger, kill count, cloud radius, trail time, mark time, lift time, arc, flame reach, wisp count). `charmanderRanks.test.ts`: 10 tests.

**Rank tuning (provisional; target II ≈ 1.15, III ≈ 1.30):**
- Fury Swipes +13.5% / +16% per stack (doc +10% / +12%; read 1.06 / 1.16).
- Vortex II burst ×2.0 (doc 1.85).
- Choking Smoke 4.6 / 5 per tick, III radius ×0.72 (doc 5 / 6 and ×0.85: past ×0.73 the cloud reaches the 80 px dummy circle, which read 3.0×).
- Afterimage gains move damage ×1.1 / ×1.2 (static dummies never walk into the mark; read 1.02 / 1.04).
- Backdraft III move damage ×1.05 (doc ×1.3: the 200° arc already adds ~25% area).
- Kindle ×2.75 at II and III, III Burn 5%/s (doc ×2.5 / ×2.8 with 20%/s; read 1.08 / 1.57).

RANKS.md and the card text were updated to match. Final readings: most at 1.12–1.17 / 1.23–1.33.
- Vortex II 1.08: the burst is a small share of the move.
- Backdraft III 1.75: ring geometry; ≈1.31 in a crowd.
- Tornado III 1.06: it travels off the ring faster.
- Blaze Claws, Cornered Dragon, Searing Slash, Aerial Ace: Bond conditions the bot never meets.
- Smoke Trail and Hidden Flame: no damage to measure.

`mutations.test.ts`'s placeholder check now uses Long Lash (Bulbasaur), since Kindle has its own ranks.

**Checks (observed):** `npm run typecheck` clean; `npm test` **368/368 passed**; `npm run build` passed; `npm run mutations` (Charmander moves) ran. Browser: not rechecked; the hidden pane can't draw cards, as in P4h-3.

### 2026-10-19 — P4h-3: Squirtle-line Mutation ranks (D24)
**Owner:** "RANKS.md approved as written. Start P4h-3 with the Squirtle line." (recorded in D24.)

**Plumbing (all lines):**
- `MutationDef.ranks` holds the rank II/III overrides (absolute; III builds on II; every key must exist at rank I, so twists start "off"). `MutationDef.rankText` holds the card text for II/III, taken from RANKS.md.
- `rankedValues(id, rank)` is cached per Mutation; `ranked(id)` in `mutationDefs/util.ts` reads it per slot.
- The P4h-1 placeholder (move damage ×1.15 / ×1.3) now applies only to Mutations that have no own ranks yet, i.e. every line except Squirtle.
- The site rank-up card shows the rank text, or the placeholder's "+N% damage".
- New engine support for twists:
  - `hitTaken` carries the attacker.
  - A stacking all-types vulnerability (`vulnAllPct`/`vulnAllLeft`, `applyVulnAll`), used only by Wash Down III. Acid and Nightmare keep the old single slot.
- `npm run mutations` now has "II / I" and "III / I" columns, and `MUTATIONS_ONLY=withdraw,bubble` limits a run to those moves. `src/node-fs.d.ts` also types `node:process` `env`.

**Squirtle line (24 Mutations):** every hook reads its values at the slot's rank. Rank III twists built:
- Spiked Shell: 4 s aura.
- Hunker Down: hits taken stagger the attacker.
- Counter Shell: the reset hit ×1.5.
- Spiral Spin: out to 140 px.
- Slick: 4.5 s puddles.
- Wash Down: +10% from all types.
- Steady Aim: Shell up ×1.2.
- Maelstrom: pull 45 px/s.
- Moat, Backwash, Rain Cannon and Bubble Trap: they Soak.
- Eye of the Storm: its whirlpool pulls.
- Ride the Wave: 2 s speed boost.
- Pressure Build: cooldown ×1.3.
- Shrapnel: shards pierce 1.
- Froth: 12 mines.
- Undertow: range ×0.9.

`squirtleRanks.test.ts` has 12 tests (twists and rank values); `mutations.test.ts` adds data checks (override keys, rank text, cache, placeholder for unranked lines).

**Rank tuning (provisional; target II ≈ 1.15, III ≈ 1.30 vs rank I):**
- Spiked Shell III ticks 0.3 (doc 0.36, read 1.57).
- Shell Spin dmg 0.92 / 1.04 (doc 0.88 / 0.96).
- Wash Down dmg 0.55 / 0.55 (doc 0.58 / 0.65; its own Water bonus amplifies it, 1.21 / 1.53).
- Steady Aim II also Shell up ×1.1.
- Maelstrom cooldown ×1.25 / ×1.15 (new).
- Pressure Build II cooldown ×1.35, III ramp 0.2.
- Shrapnel cooldown ×1.15 / ×1.0 (new).
- Armor Rounds dmg 0.92 / 1.04.
- Bubble Trap pop 100% / 120%; Froth mines 33% / 40%; Undertow III dmg 0.88.

RANKS.md was updated to match. Final readings:
- Most at 1.14–1.16 / 1.29–1.31.
- **Maelstrom 1.29 / 1.36, Shrapnel 1.20 / 1.40, Pressure Build 1.05 / 1.14:** the report's 10 s window counts whole casts, so cooldown changes read in steps; steady state ≈ 1.15 / 1.30.
- Steady Aim 1.10 / 1.20 (the bot's Shell is always up); Froth III 1.26.
- Spiral Spin III 1.14: 140 px overshoots the dummy ring.
- Eye of the Storm 1.00 / 1.00: no Shell Burst on the bot.

**Checks (observed):** `npm run typecheck` clean; `npm test` **358/358 passed**; `npm run build` passed; `npm run mutations` (Squirtle moves) ran. Browser: no console errors, but the forced rank-up card didn't draw (the hidden pane pauses the game loop), so the card text is unverified on screen.

### 2026-10-19 — P4h-2: rank II/III + favoured augments (docs, awaiting approval)
- `docs/moveset/RANKS.md` (new): one row per Mutation (all 110) with rank II, rank III (★ = twist, 75 of 110) and 2–3 favoured augments. Rules at the top: ranks only scale an existing lever or ease a cost; rank II ≈ +15% and rank III ≈ +30% DPS over rank I (provisional); pure-utility Mutations also get move damage ×1.15 / ×1.3; Lapras Bonds scale both Flood and Ebb; signature ranks stack with tiers. Linked from rule 2 in `docs/moveset/README.md`.
- Sync test in `mutations.test.ts`: the doc lists every Mutation ID exactly once, with both ranks. Favoured augments are 2–3, distinct, real augment IDs, legal for the move's tags (or any tier of the line's signature move), allowed by `exclusiveTo`, and not in `excludesAugments`. It caught one mistake while writing: Burn on Blaze Claws needs the Fire tag, and Scratch is Normal, so it was replaced with Enlarge.
- **Open for the owner** (also listed at the end of RANKS.md): the twist count; flat move damage on utility ranks (Smoke Trail and Hidden Flame are utility only, because Smokescreen has no damage); Ricochet III at 3 bounces paid with damage ×0.95.
- **Checks (observed):** `npm run typecheck` clean; `npm test` **342/342 passed**. No game code changed.

### 2026-10-19 — P4h-1: Mutation slot split and ranks (D24)
**Decision recorded:** D24 in `PROJECT.md` §13, rules 1/2/4 in `docs/moveset/README.md`, and the P4h plan rows above (commit `fce6986`). The site step is P4g, so this rework is **P4h**.

**What changed (sim):**
- A Mutation sits in its move's own slot. `socketsUsed` counts augments only, so every move has 3 augment sockets beside its Mutation.
- `MoveSlot.mutationRank` runs 1..3 (0 with no Mutation). `MUTATION_RANKS` in `src/data/mutations.ts` holds `max` 3 plus the **placeholder** rank effect: ×1.15 / ×1.30 move damage at rank II / III, applied after the Mutation's own stats hook. P4h-3…7 replace it with per-Mutation rank values.
- `grantMutation`: the same Mutation again ranks it up (`rankUp`, then `maxRank` at III); a different one replaces it at rank I; augment sockets are never touched. The Mutation replace window (`mutationReplace` offer, `chooseMutationReplace` / `cancelMutationReplace`) is gone, and the augment replace window no longer offers the Mutation as a socket.
- Sites: new `mutationRank` card from `mutationRankUps`. It counts as Pokémon-bound (longer capture) for Bonds and signatures, like their rank-I card. Power Surge appears only when every held Mutation is at rank III and nothing else is eligible.
- `buildSnapshot` v2 saves `mutationRank`; v1 snapshots are refused (no saved v1 data exists yet).
- The stress build puts every Mutation at rank III. The balance bot lost its now-unused replace-window branch.
- Switching branch is reachable through the debug grant only. Sites don't offer a different Mutation for a move that already has one (unchanged from D23). **Open for the owner:** should sites sometimes offer a branch switch?

**Scene:** the build panel shows the 3 sockets, then `✦ Name II (Mutation)` or `✧ no Mutation`. Site rank-up cards read "MUTATION / BOND / SIGNATURE RANK UP ⬆" with "+15% / +13% damage" (the placeholder step from rank I to II, and from II to III). The debug grant says "rank up".

**Tests:** `mutations.test.ts` was rewritten for the socket split, plus new tests for grant ranks and reset-on-switch, the placeholder damage, and the site rank-up card. Two `sites.test.ts` tests now set ranks (Power Surge at all-rank-III; the snapshot round-trip carries rank II).

**Checks (observed):** `npm run typecheck` clean; `npm test` **340/340 passed**; `npm run build` passed. Browser (dev, `?mutate=bubble.trap,bubble.trap,waterGun.slick`, Squirtle): Bubble Trap at rank II, Slick at rank I (learned Water Gun), no console errors. Not checked: the Esc build panel and a real site rank-up card on screen, because key presses don't reach the hidden pane (the same limitation as P2).

### 2026-10-18 — P4g: Mutation Sites + build snapshot (D23)
**Owner decisions (D23):** Mutations and held items only from sites; sites scattered per map chunk; stand in a site 5 s, +3 s when the roll (fixed on first entry) holds a Bond/signature Mutation; this map is Level 1; build snapshot code only (no save UI). Provisional defaults I set (listed in D23, not owner decisions): 5 cards (≥ 1 Mutation, ≥ 1 item when available), learn + Mutation cards for unowned learnset moves, 1 s/s drain outside, Esc skip uses the site up, Power Surge fallback, guaranteed site next to the start, 35% per chunk, arrows within 1500 px.

**Files**
- `src/data/sites.ts` (new): `SITE_TUNING`.
- `src/sim/sites.ts` (new): seeded per-chunk placement (`mapSeed`, independent of the gameplay RNG), lazy generation 2 chunks around the player, capture with drain, `rollSiteCards`, `chooseSiteCard` (Mutations go through `grantMutation`, so learning a move and the D11 replace window work as before), `skipSite`.
- `src/sim/buildSnapshot.ts` (new): `snapshotBuild` / `restoreBuild` (versioned JSON; refuses another line).
- `src/sim/types.ts`: `SiteCard`, `MutationSite`, `World.sites / siteChunks / mapSeed`, offer kind `site`. `src/sim/world.ts`: `mapSeed` option, `updateSites` each step; a site window opens before evolution/level cards. `src/sim/progression.ts`: items removed from normal level cards. `src/sim/balance.ts`: bot takes a random card if it crosses a site.
- `src/scenes/RunScene.ts`: site rings (cyan unknown, purple generic, gold bound) with a capture arc; "Something bound to X is inside! Hold 8 s" notice; edge arrows; 5-card site window with clickable Esc-skip footer; random map seed per run; victory banner says "Level 1 cleared".
- Docs: `PROJECT.md` §8.3, §9, D23; `docs/moveset/README.md`.

**Checks (observed)**
- `npm run typecheck` clean; `npm test` **338/338 passed** (12 new in `sites.test.ts`: same seed = same layout, guaranteed near-start site, lazy chunks + density, roll on first entry + 5 s / 8 s capture, drain + fixed roll, pause + skip, card eligibility (5 distinct, ≥ 1 Mutation + item), no items when full, Power Surge fallback, learn card + item card, snapshot JSON round-trip, wrong-line refusal; 1 level-pool test updated for site-only items). `npm run build` passed.
- `npm run bench`: maxed builds 0.81 ms mean; one run showed a 26 ms max on the Bulbasaur Mutation variant, two reruns 2.0–2.1 ms max (p99.9 ≤ 1.8 ms): machine noise, not reproducible.
- Browser (Charmander, 83 fps): arrows at the screen edge point at off-screen sites; moved the player onto a site with the dev handle: gold ring + "bound to Charmander, hold 8 s" notice + capture arc; window showed Learn+Bond, Learn+Mutation, Signature, Learn+Mutation, Held item; picking Will-o-Wisp put `ember.wisp` on Ember, removed the site, then the queued level card offered only a move and boosts. No console errors.

**Risks / follow-ups**
- **Balance bot doesn't visit sites**, so `npm run balance` runs now have no items (they used to come from level cards). D19 numbers were measured with items from levels; re-run and re-check before the gate.
- Site density/capture times are untested in real play (owner playtest). Walking the player there by hand wasn't done in the browser (moved via dev handle).
- Mutations on a move that already has one are not offered (no "replace Mutation" card yet).
- Next: owner P4 gate playtest including sites.

### 2026-10-18 — P4f-8: D19 close-out and maxed-Mutation stress
**Files**
- `src/sim/stress.ts`: `STRESS_MUTATION_BUILDS` plus `setupMutationStress`. Each line runs at its final stage, Lv 40 (so Lapras's Bonds are in Ebb and Sheer Cold is on), with a Mutation on all 5 moves; the builds are picked to spawn the most entities, zones and terrain. The other sockets get maxed Power Up and Quick Cast, plus all boosts and 3 items:
  - Charizard: Flamethrower, Flame Trail, Fan the Flames, Afterimage, Dragon Breath.
  - Blastoise: Froth, Maelstrom, Rain Cannon, Shrapnel, Spiral Spin.
  - Venusaur: Thorn Garden, Spreading Seed, Frenzy Dance, Toxic, Embed.
  - Raichu: Ball Lightning, Spark Shower, Ricochet, Electric Terrain, Afterglow.
  - Lapras: Hail, Ice Wall, Shockwave, Ride the Wave, Pressure Shell.
- `src/sim/stress.bench.ts`: one bench per line, next to the original maxed build. `src/sim/world.test.ts`: 5 tests (600 steps each against 500 enemies: projectiles and zones stay within budget, at most 400 entities, still running, kills happen).
- `?stress=<line>` (e.g. `?stress=lapras`) opens that line's Mutation stress build in the browser; `?stress=1` is unchanged.

**Bench (`npm run bench`, sim only, mean / p99 ms per step):** original maxed build 0.79 / 1.13; with Mutations: Charizard 0.52 / 0.82, Blastoise 0.54 / 0.81, Venusaur 0.43 / 0.94, Raichu 0.36 / 0.61, Lapras 0.50 / 1.10. Worst p99.9 is 1.46 ms (Lapras), against the < 4 ms aim. Multishot+Scatter Ember is still the heaviest build.

**Browser stress (dev, the pane was hidden, so FPS is only indicative):** Charizard 62 FPS (sim 0.38 / draw 0.15 ms), Blastoise 84 (0.43 / 0.26), Venusaur 64–67 (0.36–0.39 / 0.32), Raichu 103 (0.37 / 0.19), Lapras 75 (0.41 / 0.41); ~500 enemies; no console errors.

**D19 close-out (bot without Mutations, random picks that skip zero-damage moves, 8 seeds), 15:00:** Venusaur 852, Blastoise 711, **Charizard 630**, Lapras 537, Raichu 514. D19 holds: the three 3-stage finals are above Lapras and Raichu, and Lapras and Raichu are 4% apart. The **Lapras XP ×0.85 knob was not used**. Still not met (provisional §5): Lapras doesn't lead at 5 min (Venusaur 351, Raichu 232, Lapras 145).

**Open for the owner (decisions or playtest checks):**
1. **Rule-4 utility:** rule 4 is DPS-only. About 50 Mutations read below ±15% because their value is control, safety or a condition the bot never meets. Recommendation: judge those by playtest.
2. **Costs I added beyond the docs** (provisional): Crescent ×0.45, Dragon Breath ×0.6, Ricochet ×0.8, Electric Terrain field ticks ×0.35, Belly Flop cooldown ×2 (doc ×1.25), Flurry cuts at 100% (doc 50%, so the doc's cost is gone).
3. **Charmander's early game with 8 moves:** a random bot now stalls far more often (Lv 7 at 5 min, was 13), because early move cards are spread over 8 moves including Smokescreen. Check in the playtest whether it feels slow.
4. **Damage augments on Smokescreen:** the augment pool still offers Power Up, Crit and the like for a move with no damage; they do nothing unless Choking Smoke is on it. **Resolved (D22, 2026-10-18):** owner: "Leave the augment pool as is."

**Checks (observed):** `npm run typecheck` clean; `npm test` **326/326 passed**; `npm run build` passed; `npm run bench` ran (6 benches); `npm run balance` ran.

**Exact next task:** the Mutation map sites. The owner will have another agent add them; Mutations reach play only through the debug grant until then. After that, the owner's P4 gate playtest.

### 2026-10-18 — P4f-7: Smokescreen, Slash, Wing Attack + their 9 Mutations
Owner (2026-10-18, after the P4f-6 close-out): "i think you can continue with the rest, after youre done ill instruct other agent to change the game logic a bit to include the mutation site". So map sites (the way Mutations are offered in play) will be built by another agent after P4f-8; until then the debug grant (`?mutate=`, `__grantMutation`) is the only way to get Mutations.

**Files**
- `src/data/moves.ts`: three new moves with the base stats proposed in `docs/moveset/shared/` (provisional):
  - **Smokescreen**: `[Normal, Zone]`, cooldown 8, no damage, a 90 px cloud on you for 4 s that Blinds what's inside (1 s per 0.5 s tick). It casts once an enemy is within 150 px (build value).
  - **Slash**: `[Normal, Area, Slicing]`, cooldown 1.6, 18 dmg, an instant X 60 px across on the nearest enemy within 220 px, +25% innate crit.
  - **Wing Attack**: `[Flying, Melee, Contact]`, cooldown 1.4, 13 dmg, two 100° gusts at ±90° of your facing, reach 75, stagger 20.
  - New data fields: `ZoneMoveDef.target: 'self'`, `ZoneMoveDef.instant`, `MeleeMoveDef.sides`, `MoveDefBase.critChance`, `InnateEffects.blind`.
- `src/data/content.ts`: the Charmander learnset is now 8 moves (Smokescreen and Wing Attack from stage 0, Slash from stage 1, D15). `TUNING.status.blindContactMult` 0.7 and `blindWanderPx` 150.
- **Blinded** (D20): the enemy fields `blindLeft`/`wanderX`/`wanderY`, `applyBlind` and `pickWanderPoint` in `combat.ts`. Blinded enemies walk to a random point 150 px away (a new one when they reach it) and deal ×0.7 contact damage. Bosses are immune; no boss exists yet, so a test marks one.
- Engine:
  - Zones carry `blind` and skip the hit entirely when they have no damage and no status (smoke).
  - `castZone` handles self clouds and instant cuts (`cutAt`); `world.cuts` is used for drawing.
  - `castMelee` was split into `swingArc` (exported) plus side arcs (`turned`).
  - New `fakesBlaze` and `forceCrit` hooks. `isAbilityActive` and `blazeActive` read `blazeFaked`.
  - `PENDING_MOVE_IDS` was removed; every Mutation now sits on a real move.
- `src/sim/mutationDefs/{smokescreen,slash,wingAttack}.ts` (new): Choking Smoke, Smoke Trail, Hidden Flame, Afterimage, Flurry, Searing Slash, Updraft, Backdraft, Fan the Flames.
- Behaviour choices inside the doc text:
  - Hidden Flame turns on every Blaze bonus (damage, Blaze-linked Mutations, the HUD tag) while you stand in your own cloud. Flare Up still needs a real low-HP hit.
  - Searing Slash's cash-in is a proc hit, so it doesn't chain into other effects.
  - Updraft lifts only enemies that aren't already stunned, so the second wing doesn't lift twice.
  - Fan the Flames can grow a patch to 1.5× the base Scorch size at most, and moves it instantly.
  - Backdraft's rear arc follows your facing.
- Kit-rule test (D15): status moves with no damage don't count toward rule 2, and Slash is listed as the approved exception.
- The scene draws grey smoke clouds, a grey bar over Blinded enemies' eyes, Slash's X, the Afterimage mark and Updraft lift rings.
- `charmanderNewMoves.test.ts`: 18 tests (learnset, Blinded wander, contact and boss immunity, the 3 base moves, all 9 Mutations, Fan the Flames' `scorchSource` offer gate).

**Rule-4 tuning (provisional):** **Flurry cuts at 100%** (doc 50%, 0.43×). The base X already hits ~3 enemies in a crowd, so three half cuts were half its damage anywhere; full cuts read 0.87×. This removes the doc's cost ("one target only gets 50%"); the cost is now losing the X's area. **Flagged for the owner.** Not measurable: the three Smokescreen Mutations (the base deals no damage; Choking Smoke adds 16 DPS of its own). Low on the bot (condition, utility or geometry): Afterimage 0.84 (dummies never walk into the mark), Searing Slash 0.70 (nothing burns), Updraft 0.65, Backdraft 0.65 (the bot never kites, so nothing chases from behind), Fan the Flames 0.70 (no Scorch).

**Balance (`npm run balance`, 8 seeds):** the 8-move learnset made Charmander's random-bot runs much weaker. 15:00 went from 1148 DPS / Lv 41 to **563 / Lv 38**, and 5:00 from Lv 13 to **Lv 7**.
- Diagnosis: the new engine with the old 5-move learnset reproduces the old runs exactly, so this is not an engine regression.
- Charmander's early game hinges on its first move picks (one old seed already stalled at Lv 5 with Ember alone). Three more moves in the card pool make those stalls far more common, and the random bot also took Smokescreen and socketed it with Lifesteal or Concentrated.
- Measurement fix (test tooling): **the bot now skips zero-damage move cards when another card is offered**, since D19 measures firepower. With it, Charizard reads **630 DPS / Lv 37**. D19 still holds (Charizard, Venusaur 852 and Blastoise 711 all above Lapras 537 and Raichu 514; Lapras and Raichu are 4% apart), but Charizard is now third of the big three, not first, and only 17% above Lapras.
- Not tuned: the cause is the approved learnset meeting a random bot, not a number. Recommendation for the owner's playtest: check whether Charmander's first minutes feel slow when the early cards offer Smokescreen or Wing Attack.

**Checks (observed):** `npm run typecheck` clean; `npm test` **321/321** at this step; `npm run build` passed; `npm run mutations` ran. Browser (dev, Charmander `?mutate=smokescreen.hiddenFlame,wingAttack.updraft,slash.afterimage`): all three granted; ~100 s stepped from the page with no errors and no console errors; the smoke cloud blinded enemies inside it, and the HUD showed "BLAZE!" at 73/100 HP from inside the smoke (Hidden Flame). Not seen: the Blinded wander itself (unit-tested), because early waves die before they reach the cloud.

### 2026-10-18 — P4f-6 close-out
**Balance (`npm run balance`, 8 seeds, bot without Mutations; re-run after the 6b orbit-stagger fix and the spin hit-interval change):**

| line | 5 min | 9 min | 15 min |
|---|---|---|---|
| Charizard | 92 (Lv 13) | 390 | **1148** (Lv 41) |
| Venusaur | 351 (Lv 15) | 757 | **852** (Lv 42) |
| Blastoise | 121 (Lv 12) | 506 | **711** (Lv 42; was 762 before the fix) |
| Lapras | 145 (Lv 16) | 332 | **537** (Lv 43) |
| Raichu | 232 (Lv 16) | 426 | **514** (Lv 42) |

**D19 holds:** Charizard, Venusaur and Blastoise all out-damage Raichu and Lapras at 15:00, and Lapras and Raichu are 4% apart. Blastoise lost ~7% because Rapid Spin's stagger now really pushes enemies out of the spin. The Lapras XP knob is not needed. Still not met (provisional §5): Lapras doesn't lead at 5 min (Venusaur does).

**Rule-4 report (`npm run mutations`, all 101 built Mutations):** 52 inside ±15%, 49 outside. Above the band, every one is a recorded exception: Full Charge 3.48 (the ring overstates beam width; judged on one target), Ricochet 2.09 (the sparse ring undersells pierce; judged on the dense ring), Healthy Growth 1.74 at full HP (1.13 averaged with hurt), Drowsy Haze 1.74 (Sleep Powder ticks for 1), Belly Flop 1.16 (~1.04 at the steady cast rate), and **Ingrain 1.38**, not noted in 6c: the bot always stands still, so the 2× recharge is always on. Moving pays −20% with no recharge bonus (about 0.73×), so it averages about 1.05×. Left as is, like Healthy Growth. Below the band: utility, Bond conditions the invulnerable, standing bot never meets, or geometry, as listed per sub-step. The rule-4 utility question to the owner is still open.

**Bench (`npm run bench`, 500 enemies + maxed build, no Mutations):** mean **0.81 ms** per step (p99 1.17 ms); it was 0.79–0.80 before 6d/6e. The maxed-Mutation stress variant is P4f-8.

**Browser (dev server, Lapras with `?mutate=bodySlam.bellyFlop,iceBeam.iceWall,surf.ferryWave`):** all three granted; ~95 s of sim stepped from the page with no errors and no console errors; the Ice Wall bar, Belly Flop landing ring and the Tide HUD ("Tide: Flood (ebbs at Lv 30)") render. Not checked in the browser: Pressure Shell (the level-up card held the grant; a key press didn't reach the hidden pane). Its unit tests cover a real Shell Armor hit.

**Checks (observed):** `npm test` 303/303; `npm run build` passed.

### 2026-10-18 — P4f-6e: Lapras-line learnset Mutations (8)
**Files**
- `src/sim/mutationDefs/{bodySlam,iceBeam}.ts` (new), plus Ferry Wave in `surf.ts` and Pressure Shell in `hydroPump.ts`: Belly Flop, Shockwave, Surging Slam, Ice Wall, Aurora Beam, Flash Freeze, Ferry Wave, Pressure Shell. The four Bonds read their Flood or Ebb values (the Tide, Lv 30) live.
- Engine: an enemy contact-damage debuff (`weakenMult` / `weakenLeft`, Aurora Beam); Shell Armor's `armorAbsorb` amount uses the weakened contact damage. The scene draws the Belly Flop landing ring, the Shockwave front, Ice Walls and a pale ring on weakened enemies.
- Behaviour choices inside the doc text: Belly Flop lands wherever you are when the hop ends; each Surging Slam level-up adds its slams (two quick level-ups in Flood = 6); Flash Freeze freezes once per beam (later ticks don't refresh it) and uses a plain stun; Ice Wall pushes enemies out along its normal, so they slide along it and round its ends (it blocks every enemy, bosses included); Pressure Shell adds `store ÷ ticks` to each tick of the next Hydro Pump.
- Build values (provisional): Shockwave front speed 450 / radius 30; Ice Wall thickness 12, at most 3 at once.
- `laprasMoves.test.ts`: 15 tests, Flood and Ebb for every Bond.

**Rule-4 tuning (provisional; doc value and first reading in brackets):** Belly Flop cooldown ×2 (×1.25, 1.74×: the 360° 90 px slam covers ~4× the area of the 140° cone, about Surf's footprint). It reads 1.16× but is about 1.04× at the steady cast rate: the report's 10 s window fits 4 slams at both 2.8 s and 3.08 s, so long cooldowns read in steps. Shockwave slam −25% (−15%, 1.23×). Still low on the bot (condition never true, or utility): Surging Slam 0.74 (no level-ups on the dummy ring), Ice Wall 0.61, Aurora Beam 0.70, Flash Freeze 0.70, Ferry Wave 0.70, Pressure Shell 0.72 (the bot is never hit, so nothing is stored).

**Checks (observed):** `npm run typecheck` clean; `npm test` **303/303 passed**; `npm run build` passed; `npm run mutations` ran. Browser: not checked yet (planned for the P4f-6 close-out).

### 2026-10-18 — P4f-6d: Pikachu-line learnset Mutations (18)
**Files**
- `src/sim/mutationDefs/{quickAttack,spark,electroBall,thunderWave,ironTail,thunder}.ts` (new): Blink Strike, Double Hit, Volt Tackle, Arc Pair, Spark Shower, Static Spark, Ricochet, Plasma Orb, Velocity Ball, Static Pulse, Electric Terrain, Conductor, Iron Spin, Iron Slam, Shock Shatter, Storm Call, Afterglow, Thunderstorm.
- Engine:
  - `holdsCharge` hook and `chargeHeld`: while Volt Tackle is owned, full Charge waits for it (no Charged shot, no auto Discharge). `discharge` is exported so Volt Tackle can release it.
  - `chainBias` hook, used by the signature chain jump (Conductor: prefer enemies in Thunder Wave fields, longer jumps between them).
  - The scene draws the Static Pulse ring, Spark Shower bolts, the Iron Slam telegraph and the Afterglow field.
- Build values (provisional): Arc Pair line width 10; Shower bolts speed 350 / range 140 / size 5; Shock Shatter leap at 50% of the shatter hit.
- Rule-4 bench: `measureDps` takes a `DummyRing`. Spark orbits at 55 px, between the default ring's circles, so its Power Up I baseline read 0 DPS. Spark Mutations are now measured on a denser ring of 32 dummies from 30 to 205 px; every other move keeps the 16-dummy ring, so earlier readings stand.

**Rule-4 tuning (provisional; doc value and first reading in brackets):** Arc Pair −40% damage (−25%, 1.30×); Shower bolts 65% (35%, 0.81×: the spin dominates); **Ricochet ×0.8 damage** (no cost beyond losing pierce, 2.61× on the 16 ring, 1.30× on the dense ring; the sparse ring undersells pierce 2, so it's judged on the dense one and still reads 2.09× on the default ring); **Electric Terrain field ticks ×0.35** (new value, 2.90×: the 5 s boosted field triples Thunder Wave's own 1-damage ticks; the +25% for other Electric moves is unchanged); Iron Slam cooldown ×1.6 (×1.3, 1.39×); Storm Call strikes 80% (50%, 0.47×; reads 0.75× here and about 0.98× on the dense ring). Ricochet and Terrain gain costs the doc didn't have, flagged for the owner. Still low on the bot (condition never true, or utility): Blink Strike 0.65 (one target), Static Spark 0.74 (the bot is never touched, so Static never procs), Static Pulse 0.58 (paralysis instead of ticks), Shock Shatter 0.70 (nothing paralysed without another move), Afterglow 0.70 (paralysis field).

**Checks (observed):** `npm run typecheck` clean; `npm test` **288/288 passed** (19 new in `mutationDefs/pikachuMoves.test.ts`); `npm run build` passed; `npm run mutations` ran.

### 2026-10-18 — P4f-6c: Bulbasaur-line learnset Mutations (24)
**Files**
- `src/sim/mutationDefs/{tackle,razorLeaf,leechSeed,poisonPowder,sleepPowder,sludge,petalDance,solarBeam}.ts` (new): Rollout, Bowling, Bulb Bash, Leaf Spiral, Embed, Healthy Growth, Spreading Seed, Seed Bomb, Seed Network, Drift Cloud, Toxic, Spore Sac, Drowsy Haze, Nightmare, Sweet Dreams, Sludge Pool, Acid, Sludge Bomb, Frenzy Dance, Pollen Ring, Petal Blizzard, Full Charge, Prism, Ingrain.
- Engine:
  - **Stun kinds** (`sleep` / `paralysis`, data `onHit.stunKind`): Sleep Powder sleeps; Spark, Thunder Wave, Thunder, Body Slam, Static, Discharge, Dragon Breath and Live Wire paralyse; Song of the Sea sleeps. New `targetAsleep` / `targetParalysed`.
  - The `kill` event carries the fainted enemy.
  - `leechBonus` hook (summed into Lifesteal on non-proc hits).
  - Enemy `seedJumped` and `poisonStacks`.
  - `MoveStats.spinMult` and `widthMult`. A faster spin now also shortens the orbit's per-enemy hit interval; that only changes anything while a Mutation speeds the spin (Frenzy Dance).
- Build values: seed jump range 140, Sludge Bomb splash 50%, Frenzy petals (speed 300, range 150, size 6), Prism beams half width, Sludge Pool poisons at half the glob's poison.

**Rule-4 tuning (provisional; doc value and first reading in brackets):** Rollout +7% damage / +2% reach per stack (20% / 10%, 2.34×); Embed rip 45% (60%, 1.21×); Healthy Growth −40% when hurt (−20%; 1.74× at full HP, now 1.13× averaged over full / hurt); Seed Bomb 10% strength (40%, 1.69×); Sludge Pool at half poison (1.26×); Frenzy Dance needed the spin-speed hit-interval fix (0.60× → 0.92×). **Full Charge** is 1.5× width and 1.2× damage (doc ×2 / +60%). The dummy ring overstates width: past ~31 px a beam catches 4 ring dummies instead of 1, so it reads 3.48× on the ring while it is ~0.8× of the plain beam on one target. Judged on that, not the ring. Still low on the bot (utility, condition, or geometry): Bowling 0.74, Bulb Bash 0.70 (no Bulb at stage 0), Leaf Spiral 0.70, Seed Network 0.66, Drift Cloud 0.72, Spore Sac 0.79, Acid 0.74, Sludge Bomb 0.74, Pollen Ring 0.65. Drowsy Haze reads 1.74× but Sleep Powder deals 1 damage per tick (a CC move), so it's left.

**Checks (observed):** `npm run typecheck` clean; `npm test` **269/269 passed** (24 new in `mutationDefs/bulbasaurMoves.test.ts`); `npm run build` passed.

### 2026-10-18 — P4f-6b: Charmander-line learnset Mutations (15)
**Files**
- `src/sim/mutationDefs/{scratch,fireSpin,dragonRage,airSlash,hurricane}.ts` (new): Fury Swipes, Crescent, Blaze Claws, Vortex, Flame Trail, Tail Flame, Fixed Rage, Dragon Breath, Cornered Dragon, Crosscut, Tailwind, Aerial Ace, Tornado, Gale Wall, Inferno Storm.
- Engine: `MoveStats.arcMult` (melee arcs), orbit ball count follows `extraCount` (Tail Flame), orbits can circle an anchor point (Tornado), `orbitCenter`. The scene draws the Dragon Breath cone.
- **Bug found and fixed:** orbit hits carried no direction, so innate orbit stagger never pushed anything. Rapid Spin's 15 px stagger (P4b) has been doing nothing. Orbit hits now push away from the orbit's centre. This changes a base move, so the balance numbers need a re-run (planned at the end of P4f-6).
- Build value: Crosscut blades start 12 px apart.

**Rule-4 tuning (provisional; doc value and first reading in brackets):** Fury Swipes +8% per stack (15%, 1.36×); **Crescent ×0.45 damage** (no cost in the doc, 2.46×: a 200° arc plus the wave); Vortex 1.6× burst (2×, 1.20×); Fixed Rage 7 (10, 1.45× at Lv 1; it ignores every boost, so it falls off later); **Dragon Breath ×0.6 damage** (no cost in the doc, 1.74×: the 60° cone covers far more than the beam). Crescent and Dragon Breath gain a damage cost the doc didn't have. That's a provisional number, flagged for the owner. Still low on the bot (condition never true, or utility, or the storm leaves the pinned ring): Blaze Claws 0.74, Tail Flame 0.65, Cornered Dragon 0.65, Tailwind 0.70, Aerial Ace 0.65, Tornado 0.66, Gale Wall 0.57, Inferno Storm 0.74.

**Checks (observed):** `npm run typecheck` clean; `npm test` **245/245 passed** (15 new in `mutationDefs/charmanderMoves.test.ts`); `npm run build` passed.

### 2026-10-18 — P4f-6a: Squirtle-line learnset Mutations (17)
**Files**
- `src/sim/mutationDefs/{rapidSpin,whirlpool,surf,hydroPump,flashCannon}.ts` (new), plus Hunker Down in `withdraw.ts` and Wash Down in `waterGun.ts`: Hunker Down, Spiral Spin, Deflector, Shell Spin, Wash Down, Maelstrom, Moat, Eye of the Storm, Ride the Wave, Backwash, Last Wave, Split Stream, Pressure Build, Rain Cannon, Shrapnel, Railgun, Armor Rounds. The Surf and Hydro Pump generics are shared with Lapras.
- Engine: `beamDirs` hook (split beams or none, also drawn by the scene), `onProjectileExpire`, `MoveStats.orbitRadiusMult`, enemy vulnerability debuff (`applyVuln`: +X% from one type or all), zone-cast zones record their move, `fireScaled` moved to `mutationDefs/util.ts`. The scene draws the moat ring, the rolling wave wall, the rain circle and shards.
- **Deflector** has no effect yet beyond its cost: enemy projectiles arrive with ranged enemies in P5.
- Build values (provisional): wave speed 300 / travel 220 / carry 40 px / thickness 24, Backwash delay 0.3 s, shard speed / range / size.

**Rule-4 (`npm run mutations`) tuning (provisional; doc value and first reading in brackets):** Spiral Spin ×0.9 (0.85, 0.84×), Maelstrom collapse 1.6× ticks (3, 1.33×), Moat ×0.5 (0.6, 1.17×), Backwash return 30% (50%, 1.30×), Split Stream 33% per beam (60%, 2.09×), Pressure Build +12% per tick (25%, 1.34×), **Rain Cannon ×0.1** (×0.7, **7.3×**: a 130 px rain on every enemy each tick instead of one beam line). All are now within ±15%. Still low because their condition never comes true on the bot, or they pay in utility (rule-4 question open): Hunker Down 0.70, Counter Shell 0.70, Shell Spin 0.70, Last Wave 0.70, Armor Rounds 0.70, Wash Down 0.52, Slick 0.61, Deflector 0.61, Shrapnel 0.62 (no lines in the dummy ring).

**Checks (observed):** `npm run typecheck` clean; `npm test` **230/230 passed** (17 new in `mutationDefs/squirtleMoves.test.ts`, one or more per Mutation); `npm run build` passed. Browser: not checked for this sub-step (the drawing is grey-box lines and circles; the in-page sim stepping covers it at P4f-6 end).

### 2026-10-18 — P4f-5: the 15 signature Mutations
**Files**
- `src/sim/mutationDefs/{bubble,ember,vineWhip,thunderShock,iceShard}.ts` (new): every signature Mutation, each adding its tier parts as the signature evolves (rule 10). `signatureTier` reads the line's chain (Bubble 0 → Water Pulse 1 → Hydro Cannon 2; Ice Shard 0 → Sheer Cold 1).
  - Squirtle: **Bubble Trap** (engulfs a light enemy, which takes no hit damage, then pops; T1 pulls in first; T2 traps up to 3 and leaves a puddle), **Froth Mines** (3 mines per shot that pop on touch, cap 9; T1 stagger ring; T2 drift), **Undertow** (bubbles return; T1 drag back; T2 Soak + puddle trail; Return no longer offered).
  - Charmander: **Kindle** (every 3rd shot, every 2nd with Blaze; T1 Scorch ring; T2 telegraphed meteor + crater), **Flamethrower** (4 flames in a 40° cone, short reach, longer with Blaze; T1 Burn; T2 Scorch line), **Will-o-Wisp** (casts store wisps, 3 or 5 with Blaze, that launch within 110 px; T1 splash comes with Flame Burst; T2 half-size crater).
  - Bulbasaur: **Long Lash** (reach ×1.8, 50° arc, tip crits, close −40%; T1 360°; T2 tip root field; a Bloom cracks a free sweep, as a proc), **Thorn Garden** (sprouts that lash, cap 4; T1 all in range + slow; T2 expire into root fields; a Bloom makes all lash ×2), **Sap Lash** (1 HP per hit, max 4 per swing, half-rate Bulb fill while hurt; T1 Seeds; T2 heals inside your root fields).
  - Pikachu: **Live Wire** (chain jumps leave wires; T1 paralyse; longer above 50% Charge), **Ball Lightning** (a slow zapping orb with no chain; T1 ends in the full Thunderbolt chain; Charge speeds it up), **Return Arc** (+4 Charge per jump, the arc back to you; T1 hurts along the way).
  - Lapras: **Hail** (2 delayed strikes within 200 px; T1 small freezing fields), **Frost Lance** (pierces all, slow, cooldown ×1.4; T1 freezing strip), **Song of the Sea** (every 4th cast sleeps light enemies around you; T1 calm-sea field).
- Shared plumbing: `World.entities` (generic Mutation entities: mines, sprouts, orbs, wires, landing meteors), enemy `trapLeft` / `trapDamage`, projectile `tag`, zone `source` (root fields). New hooks `onProjectileHit`, `onChainJump`, `onChainEnd`; `onHit` now gets the hit info. `MutationDef.excludesAugments`, `pushEnemy`, `applySeed`, `strikeZone` (one-tick delayed zones), `blazeActive`, `chargeLevel`, `spawnZone` returns the zone. `mutationDefs/util.ts` helpers.
- **Bug found and fixed:** a one-tick strike zone lived only 0.01 s past its tick (less than one 1/60 s step), so float drift could skip the strike. It now lingers 0.05 s (engine constant).
- `RunScene.ts`: draws mines, sprouts, orbs, live wires, trap bubbles, and wisps orbiting the player.
- Build values not in the docs (provisional, in `mutations.ts`): mine radius / ring / drift range, wisp launch interval 0.15 s, Long Lash "close" = inner 40%, wire width / tick, Return Arc line width, Hail impact radius, Frost Lance strip size / count.

**Rule-4 report (`npm run mutations`, first tier, dense 16-dummy ring)**
- Tuned (provisional; the doc numbers measured as shown): Bubble Trap pop 80% of the hit (was 1.30×), Froth mines 0.5 → **0.25** (1.52×), Undertow ×0.75 → **×0.65** (1.25×), Flamethrower flames 0.35 → **0.3** (1.22×), Will-o-Wisp ×1.4 → **×1.3** (1.22×), Ball Lightning zap 0.25 → **0.65** (0.34×). All are now within ±15%.
- Within ±15%: Kindle 0.94, Thorn Garden 0.90, Live Wire 1.01, Hail 0.97, Ball Lightning 0.88, Bubble Trap 1.13, Froth 1.07, Undertow 1.08, Flamethrower 1.04, Wisp 1.13.
- Below on the dummy, by design or geometry (left for the owner rule-4 call): **Long Lash 0.46** (needs spacing; the ring has few tip targets), **Frost Lance 0.64** (no two dummies share a line), **Sap Lash 0.65** (paid in healing), **Return Arc 0.70** (paid in Charge), **Song 0.70** (sleep).

**Checks (observed)**
- `npm run typecheck` clean; `npm test` **213/213 passed** (19 new in `mutationDefs/signature.test.ts`, at least one per Mutation plus the tier additions: trap no-damage / pop / T2 triple + puddle; mines on path / pop on touch / cap; Undertow returns, Return excluded, drag only on the way back; Kindle rhythm ×2.2 / ×0.6 and Blaze every 2nd, T1 Scorch, T2 meteor + crater; Flamethrower reach, 4 × 30%, Burn, Scorch line; wisps store, no own fire, launch ×1.3; Long Lash tip / close / arc, 360° at T1, T2 tip field, Bloom sweep; sprouts lash / cap / root fields; Sap heals / seeds / root heal; wires hurt crossers; orb zaps, T1 end chain; Return Arc Charge and the T1-only line damage; Hail targets / shadow / range / T1 fields; Frost Lance pierce / slow / cooldown / strip; Song sleeps without damage, T1 field). `npm run build` passed. `npm run bench` mean **0.79 ms**/step.
- Browser (:5181, sim stepped from the page): `?mutate=bubble.froth` on Squirtle drew 3 pale mines along the shot line; `?mutate=ember.wisp` on Charmander showed 3 orange wisps orbiting and no Ember shots. **Not seen live:** the other 13 (unit-tested only).
- `npm run balance` not re-run: the bot never gets Mutations.

**Next:** P4f-6, the remaining 82 Mutations, one commit per line.

### 2026-10-18 — P4f-4: line mechanics + evolved ability tiers, D19 tuning
**Files**
- `src/data/content.ts`: evolved tiers `shell.tidalGuard`, `blaze.flareUp`, `leech.bloom`, `static.discharge` (`EvolutionStage.ability` grants them at Wartortle / Charmeleon / Ivysaur / Raichu; a trait pick then replaces it). New ability data `ShellDef`, `FlareUpDef`, `BulbDef`, `ChargeDef`; final traits keep the mechanic and add their twist (Torrent+ Burst every 2nd block, Rain Dish +3% max HP per block, Blaze+ Flare Up at 40% / 15 s, Solar Power +50% wider nova + 6 Scorch, Overgrow+ emergency Bulb heal, Chlorophyll Bulb ×0.7, Static+ +30 Charge per paralysis, Lightning Rod Discharge +40% wider). The base Shell (Squirtle) and Static (Pikachu) change too, as approved (D21).
- `src/sim/abilities.ts` (new): Shell pop ring + recharge cut, Shell Burst (10% max HP Water, stagger, Soak), Flare Up (3× signature hit, Burn, 1 s invulnerable, 25 s cooldown), Bloom (stored × mult around you, slow), Overgrow+ emergency heal, Charge (1 per 20 px, +15 per Static paralysis), Pikachu's Charged shot (×2), Raichu's Discharge (3× signature hit, 0.4 s paralysis with fatigue). All proc hits; they emit `shellBurst` / `flareUp` / `bloom` / `chargeFull` / `discharge`.
- `src/sim/hooks.ts`: `healPlayer` overflow fills the Bulb; `bulbCapacity`, `tideFlood`. `combat.ts`: `applySlow`. `world.ts`: contact → Shell block / recharge cut / Flare Up / emergency heal, Static → Charge, running → Charge, Charged shot on the signature cast, `updateAbilities` each step. `evolution.ts`: grants the stage's tier. `types.ts`: player mechanic state; `Blast.type`.
- `src/scenes/RunScene.ts`: ability bursts drawn in their type colour; Bulb ring (fills, pink near full); red Charge cheek dots; Lapras HUD "≋ Tide: Flood (ebbs at Lv 30)" / "~ Tide: Ebb".
- The lines share files, so P4f-4 landed as **one commit**, not one per line as planned. One balance run still gives each line's numbers, since lines don't affect each other.

**Balance (`npm run balance`, 8 seeds, observed)**
- After the mechanics, before tuning: **Venusaur 1174** (was 804) and Ivysaur 398 at 5 min (was 194). Bloom at 1.5× every 3 s hits a crowd, about 8 dummies per burst, so it far exceeds the doc's ~4% single-target estimate. Raichu evolves by 5 min (232). Squirtle and Charmander are unchanged (the bot is never hit, so Shell, Shell Burst and Flare Up never fire).
- **Tuning (provisional):** Bloom 0.5× stored, at most every 4 s; **Blastoise stage damage ×1.3 → ×1.7**; **Sheer Cold damage 12 → 10.5**.
- After tuning:

| Line | 5 min | 9 min | 15 min |
|---|---|---|---|
| Charmander | 92 / Lv 13 | 390 / Lv 24 | **1148** / Lv 41 |
| Squirtle | 102 / Lv 12 | 478 / Lv 27 | **762** / Lv 43 |
| Bulbasaur | 351 / Lv 15 | 757 / Lv 27 | **852** / Lv 42 |
| Pikachu | 232 / Lv 16 | 426 / Lv 29 | **514** / Lv 42 |
| Lapras | 145 / Lv 16 | 332 / Lv 28 | **537** / Lv 43 |

  **D19 met:** every 3-stage final form (1148 / 852 / 762) is above Raichu (514) and Lapras (537), which are 4.5% apart. The Lapras XP knob was not needed.
- **Still off (§5, provisional, not D19):** Lapras doesn't lead at 5 min (Ivysaur 351, Raichu 232, Lapras 145). Bloom reads high because the bot is always at full HP, the only state where it fills. Ivysaur's 5-min jump (194 → 351) is bigger than Bloom alone explains, so card-pick noise is likely part of it. Worth a dedicated check if it holds.

**Checks (observed)**
- `npm run typecheck` clean; `npm test` **194/194 passed** (16 new in `abilities.test.ts`: each evolution grants its tier; Shell recharge cut + pop ring; Shell Burst every 3rd / Torrent+ every 2nd / Rain Dish heal; Flare Up nova + Burn + invulnerability + cooldown; plain Blaze has none; Blaze+ 40% / 15 s; Solar Power wider + Scorch; no Bulb before Ivysaur; overheal fills to 40%; Bloom damage / slow / rate limit; Chlorophyll + Overgrow+; Charge from running and paralysis; Charged shot ×2 then reset; Discharge + fatigue + trait twists; Tide; Bloom kills don't heal or count). The registry test now requires all 17 ability tiers in `content.ts`. `npm run build` passed.
- Browser (:5181, sim stepped from the page because the pane's loop stalls): Ivysaur Bulb ring at 60%; a full Bulb Bloomed (green 140 px burst, 8 enemies hit and slowed, Bulb emptied); Lapras HUD Tide text; Pikachu's Charge dots were invisible (yellow on a yellow body, drawn underneath it), **fixed** to red cheeks drawn on top and re-checked. **Not seen in the browser:** Shell Burst, Flare Up, Discharge (unit-tested).
- `npm run bench`: one sim step **mean 0.80 ms**, p99 1.18 ms (P4f-3: 0.74). The small rise is the per-step hook and ability checks; still under 5% of a 16.7 ms frame.

**Next:** P4f-5 signature Mutations.

### 2026-10-18 — P4f-3: proof slice (Water Gun + Withdraw)
**Files**
- `src/sim/mutationDefs/waterGun.ts`: **Slick** (generic: −30% damage; each cast lays puddles edge to edge along the beam, 3 s, light enemies 15%/s slip for a 0.6 s stun with fatigue) and **Steady Aim** (Bond, `shellReady`: Shell up → beam +40% long, push ×2; Shell down → −25% damage).
- `src/sim/mutationDefs/withdraw.ts`: **Spiked Shell** (generic: Withdraw becomes a 3 s aura hitting everything in reach every 0.5 s with stagger and no stun; −20% walk speed while up; cooldown ×1.6) and **Counter Shell** (Bond, `shellBlock`: a block resets Withdraw and that bash staggers ×2; −20% damage).
- `src/sim/mutations.bench.ts` (new) + `npm run mutations`: rule-4 report → `mutations-report.md` (gitignored): each built Mutation alone on the dummy ring vs the same move with Power Up I (3 seeds). `balance.ts`: `measureDps` exported with an inner-ring option (the report uses 30 px so melee reaches count).
- **Tuning (provisional):** Spiked Shell's aura ticks deal **28%** of a bash each (`tickDamageFraction`, new data value). As written (full damage every 0.5 s) it measured **3.9×** Power Up I.

**Rule-4 report** (`npm run mutations`, observed):
| Mutation | vs Power Up I | Note |
|---|---|---|
| Spiked Shell | 1.10 ✓ | after the 28% tuning |
| Steady Aim | 0.87 ✓ | bot never hit, so Shell is always up (best case) |
| Counter Shell | 0.70 ✗ | the invulnerable bot never blocks, so only the −20% shows. By hand, swarmed (a block every ~8 s adds one bash): ≈ 0.91 |
| Slick | 0.61 ✗ | as designed: −30% damage paid for puddles, Soak and slips, which aren't damage |

**Checks (observed)**
- `npm test` **178/178 passed** (8 new in `mutationDefs/proofSlice.test.ts`: Slick puddle line + Soak + −30%, seeded slips, Steady Aim with Shell up/down, Spiked Shell aura ticks / no stun / walk speed / cooldown, no cast without a target, Counter Shell reset + ×2 stagger then back, offers and wrong line). `npm run build` passed. `npm run bench` mean **0.74 ms**/step (unchanged).
- `npm run balance` **not re-run**: the bot never gets Mutations (site-only), so P4f-3 can't change its numbers.
- Browser (:5181, 1280×720): `?mutate=waterGun.slick,withdraw.spikedShell` on Squirtle showed both notices and learned Water Gun + Withdraw with the Mutations. The pane's game loop stalled again (sim time stuck at 0.1 s), so the sim was stepped from the page via the dev module import: the beam laid 3 pale-blue puddles along its line, 5 enemies Soaked, the Spiked Shell aura drew as a ring and hit the touching Rattatas. **Not verified live:** slips at real speed, the feel of the aura (it redraws a 0.15 s ring every 0.5 s).

**Owner question (raised at the feel check):** rule 4 is DPS-only, so pure-utility Mutations (Slick, later Wash Down, Moat…) will always read low. Count utility by playtest instead, or raise their damage?

**Next:** owner feel check; then P4f-4.

### 2026-10-18 — P4f-2: Mutation hook layer, shared terrain, guard rails
**Files**
- `src/sim/hooks.ts` (new): `MutationHooks` (§8.8 names: `stats`, `live`, `cast`, `onCast`, `update`, `onExpire`, `damageMult`, `onHit`, `onKill`, `onEvent`, `moveSpeedMult`, `damageTakenMult`), `defineMutation` (also marks it built), `emit` for INDEX event hooks, `healPlayer` (the one healing path), state helpers (`shellReady`, `hpBelow`, `missingHp`, `atFullHp`, `movingFor`, `standingStill`, `levelBelow`, `targetBurning`). The built registry moved here from `mutations.ts`.
- `src/sim/terrain.ts` (new): puddles (Soak; optional slip for light enemies) and Scorch (Burn), each capped at 6, oldest dries first, applied every 0.25 s.
- `src/sim/combat.ts`: hits carry their source `slot` and `fromProc`; `procHit()`; Mutation `damageMult` / `onHit` / `onKill` only for the move's own hits; kill event (not from procs); Lifesteal and Leech Seed heals through `healPlayer`; Soaked ×1.5 stagger, bosses ×0.5; `applyNewStun` (stun fatigue 1.5 s, new effects only, bosses immune), `canTrap` (< 40 kg, not boss), `soak`, `enemySpeedFactor` (slow + Soaked, capped at 70%).
- `src/sim/world.ts`: player `movingFor` / `stillFor` / facing; Mutation move-speed and damage-taken factors; per-step `live` stats from `baseStats`; `cast` override + `onCast` + `update`; events `shellBlock`, `hitTaken`, `staticProc` (new Static paralysis), `armorAbsorb` (Shell Armor's share); regen and berries heal through `healPlayer`; terrain update. `progression.ts`: `levelUp` event, Potion heal. Forms: hits carry the slot, `reachMult` for beam length / melee reach, beam and orbit `onExpire`, `chainJump` event.
- `src/sim/mutationDefs/index.ts` (new, empty): where built Mutations register (imported by `world.ts`).
- `src/data/content.ts`: `EnemyDef.boss` (none yet; P5). `RunScene.ts`: draws puddles (pale blue) and Scorch (orange).
- Not yet emitted (their sources arrive in P4f-4): `shellBurst`, `flareUp`, `bloom`, `chargeFull`, `discharge`. Sleep vs paralysis aren't told apart yet (`targetAsleep` / `targetParalysed`), needed by P4f-6 Bonds.

**Checks (observed)**
- `npm run typecheck` clean; `npm test` **170/170 passed** (13 new in `hooks.test.ts`: event amounts for Shell block / hit taken / Static / Shell Armor, level-up / kill / healing routing with the heal cap, `stats` + non-compounding `live`, `cast` override order, `damageMult` / `onHit` / `onKill`, proc hits trigger nothing, beam `reachMult` + `onExpire`, move-speed / damage-taken products + movement tracking, puddle cap + Soak, Soaked stagger ×1.5, slip + Scorch burn, stun fatigue vs base stuns, 70% slow cap). All 157 earlier tests unchanged and passing.
- `npm run build` passed. `npm run bench`: one sim step **mean 0.74 ms**, p99 1.04 ms (P4d: 0.74).
- Not checked in the browser: nothing creates terrain yet (P4f-3).

### 2026-10-18 — P4f-1: Mutation data + registry plumbing
**Objective:** first P4f step (owner-approved plan, D21): all Mutation data, sockets, offer filter, debug grant; Lapras Sheer Cold-only tier (D18); D20 speeds.

**Decisions this session (owner, recorded in `PROJECT.md` §13 as D21):** P4f replaces P4e; D20 speeds for every stage; stun fatigue only for new effects; every per-line open point approved as written; Lapras XP ×0.85 knob only as a last resort; D19 judged on the bot without Mutations.

**Files**
- `src/data/mutations.ts` (new): all **110** Mutations from `docs/moveset/INDEX.md` (62 generic, 33 Bond, 15 signature) with every doc number in `values` (signature per-tier additions under `tier1`/`tier2`; Lapras Bonds `tide.flood`/`tide.ebb`); `HOOK_IDS` (32), `REQUIREMENT_IDS`, `REQUIREMENTS` (scorchSource), `PENDING_MOVE_IDS` (Smokescreen, Slash, Wing Attack until P4f-7), `MUTATION_TUNING` (Puddle, Soaked, Scorch, stun fatigue, slow cap, 40 kg trap limit, boss stagger, `tideLevel` 30).
- `src/sim/mutations.ts` (new): `socketsUsed`, `mutationOffers` (INDEX offer filter for future map sites), `grantMutation` (debug: ignores stage/requirements, learns the move if a slot is free, replaces an existing Mutation, opens a replace window on 3 augments), `chooseMutationReplace` / `cancelMutationReplace`, `registerBuilt` / `isBuilt` (only built Mutations can be granted; **none are built yet**).
- `src/sim/types.ts`: `MoveSlot.mutation` (takes one of the 3 sockets, single rank); offer kind `mutationReplace`. `progression.ts`: full-socket check counts the Mutation; the augment replace window can replace the Mutation socket. `balance.ts`: handles the new offer kind.
- `src/scenes/RunScene.ts`: `?mutate=id,id` (all builds) and dev `window.__grantMutation(id)`; on-screen notice per grant (console warning on failure); replace windows show the Mutation socket; Mutation replace window (purple frame generic, gold Bond/signature); build panel lists `✦ Name (Mutation | Bond · Line | Signature · Line)`.
- `src/data/content.ts`: **D20 speeds** (Charmander 153, Charmeleon 160, Charizard 170, Squirtle 142, Wartortle 149, Blastoise 159, Bulbasaur 143, Ivysaur 150, Venusaur 160, Pikachu 165, Raichu 175, Lapras 150); Lapras `signatureTiers` = Sheer Cold at Lv 25 only. `moves.ts`: Frost Breath removed.
- `src/sim/balance.bench.ts`: 8 seeds (was 4), D19 target and an invulnerable-bot caveat in the report.
- Docs: `PROJECT.md` (§6 Lapras, §8.7, §12 P4 row, D21), `docs/moveset/*` status headers + open points resolved, README engine notes use INDEX hook names.

**Checks (observed)**
- `npm run typecheck` clean; `npm test` **157/157 passed** (14 new: INDEX ↔ mutations.ts ID sync (110), per-row name/kind/move/line/stage/hook/requires/Tide/pool, hook + requirement vocabularies, Mutations on real line moves, ability-tier IDs (4 evolved tiers pending P4f-4), values finite, augment windows never contain a Mutation (5 lines × 300 seeded windows), Mutation socket + augment replacing it, grant notBuilt/wrongLine/learn move/replace Mutation/replace window cancel+choose, offer filter, scorchSource; Lapras tier tests rewritten for Lv 25 only; D20 speed table). `npm run build` passed.
- `npm run balance` (8 seeds, 8m47s), **baseline without Mutations**:

| Line | 5 min | 9 min | 15 min |
|---|---|---|---|
| Charmander | 92 / Lv 13 | 390 / Lv 24 | **1148** / Lv 41 |
| Squirtle | 102 / Lv 12 | 368 / Lv 26 | **473** / Lv 42 |
| Bulbasaur | 194 / Lv 15 | 559 / Lv 25 | **804** / Lv 41 |
| Pikachu | 156 / Lv 15 | 373 / Lv 26 | **509** / Lv 38 |
| Lapras | 145 / Lv 16 | 367 / Lv 28 | **585** / Lv 44 |

  D19 not met yet: Blastoise (473) is below Raichu (509) and Lapras (585); Lapras is 15% above Raichu (target ≤ 10%). §5: Lapras no longer leads at 5 min (Bulbasaur 194, Pikachu 156). Tuning is planned per line in P4f-4 onward. (The P4d 4-seed numbers aren't directly comparable: more seeds, new speeds, no Frost Breath.)
- Browser (dev server :5182, 1280×720): select card reads "Signature: Ice Shard (stronger at Lv 25)"; `?mutate=waterGun.slick,notAThing` on a Squirtle run showed both notices ("Can't grant Slick (Mutation): notBuilt", "Can't grant notAThing: unknownId") and console warnings. **Not verified:** the Esc build panel with a Mutation (synthetic keys don't reach Phaser in this pane; same limit as earlier phases) and the Mutation replace window (no built Mutation to grant yet; unit-tested).
- Found: at ~400 px pane width the select screen's cards overlap and are unreadable (pre-existing, not in P4f scope).

**Next:** P4f-2 hook layer (`src/sim/hooks.ts`, heal/kill routing, per-form Mutation hooks, `fromProc`, Puddle/Soaked, Scorch, guard rails).
**Build:** runs.

### 2026-10-18 — Skill design: Squirtle line proposal (no code)
- **Objective:** the owner appointed the agent head skill designer: make moves *change behaviour*, not just stats, and keep lines balanced. Squirtle line first, the others after review.
- **Added (PROPOSAL only), `docs/moveset/`:**
  - `README.md`: system rules. Mutations are a move-specific augment kind: one per move, single rank, always has a cost, ±15% DPS vs Power Up I on the dummy. **Generic** Mutations belong to the move; **Bond** Mutations belong to a line and hook into its ability (keyed on ability + stage, never on a final trait). The file also covers shared Water terrain (Puddles + Soaked), CC guard rails and engine notes.
  - `shared/<move>.md`: one file per shared move (Withdraw, Rapid Spin, Water Gun, Whirlpool, Surf, Hydro Pump, Flash Cannon), each with 2 generic Mutations and an index of each line's Bond. A future Water line reuses these files and adds only its own Bonds.
  - `squirtle/README.md`: a hook map, the Shell rework (each hit taken cuts the recharge by 1 s, the block pops a stagger ring, Wartortle adds a Shell Burst every 3rd block, Blastoise traits get Shell twists), 3 evolving signature Mutations (Bubble Trap / Froth Mines / Undertow), 1 Bond per learnset move (each on a different hook), and example builds.
  - The first draft (`docs/design/squirtle-skill-tree.md`) was replaced by this layout at the owner's request.
  - **Labels:** every Mutation and ability tier has a stable ID (`<moveId>.<mutation>`, `<abilityId>.<tier>`), listed in `docs/moveset/INDEX.md` (42 Mutations + 8 ability tiers). That supports the owner's planned **map site** mechanic (find a random site → Mutation choice or an item). How Mutations are acquired is recorded as open.
  - **Charmander line:** `charmander/README.md` (Blaze → Charmeleon **Flare Up**, a panic nova with 1 s invulnerability; trait twists; signature Mutations Kindle / Flamethrower / Will-o-Wisp, each with a Blaze link; Bonds Blaze Claws, Tail Flame, Cornered Dragon, Aerial Ace, Inferno Storm). New shared files: Scratch, Fire Spin, Dragon Rage, Air Slash, Hurricane. Shared Fire terrain **Scorch** added to the rules.
- **Not changed:** code, `PROJECT.md`. No commands beyond reading files; no tests needed.
- **Pending owner decisions:** approve Mutations, Puddles/Soaked, the Shell rework, signature Mutations evolving with the Pokémon, and which phase builds it (it's a new system, outside P4e as written).
  - **Owner feedback 2026-10-18:** the Charmander set is "neat"; Inferno Storm needs **30 kills** in one cast (was 3). The owner says this skill-tree design "is the one ill be adopting into the game" (formal approval of the open points is still pending).
  - **New Charmander moves designed** (proposal, not built): Smokescreen (Normal status zone, new **Blinded** status), Slash (Normal·Area·Slicing, from Charmeleon), Wing Attack (Flying melee, from stage 0). Each has 2 generic Mutations and a Bond: Hidden Flame (inside your smoke, Blaze counts as active), Searing Slash (cashes in Burns), Fan the Flames (flares your Scorch; the first Bond with a prerequisite). Registry: 51 Mutations + 8 ability tiers.
  - **Kit-rule conflicts raised to the owner:** rule 2 (Slash is a second Normal attack; recommend allowing it from Charmeleon), Smokescreen as a no-damage status move not counting toward rule 2, Blinded as a new status.
  - **Config audit (owner question):** gameplay numbers already live in `src/data/` (moves, augments, content incl. `TUNING`, waves, upgrades, typeChart). Only engine/visual constants are hardcoded in the sim: `SPREAD_RADIANS` 0.21 (Multishot fan angle), `BLAST_SECONDS`, `ARC_SECONDS`, `SWING_SECONDS`, `MAX_HIT_MEMORY`, default `spawnRadius` 600; plus colours and fonts in `RunScene`. Mutations would go in a new `src/data/mutations.ts`, keyed by the `INDEX.md` IDs.
  - **Decision D15 (owner, 2026-10-18), recorded in `PROJECT.md` §13 and §6:** Slash allowed as a kit-rule-2 exception from Charmeleon; Smokescreen doesn't count (no damage); Inferno Storm 30 kills.
  - **Bulbasaur line:** `bulbasaur/README.md`. Line mechanic **the Bulb**: from Ivysaur, overheal fills a Bulb (40% max HP); when full it **Blooms** (140 px burst, 1.5× stored, slow; at most once per 3 s). Trait twists: Overgrow+ emergency heal from the Bulb; Chlorophyll smaller Bulb. Signature Mutations Long Lash (tip crits, spacing) / Thorn Garden (sprout turrets) / Sap Lash (sustain, fills the Bulb while hurt). 8 Bonds on 8 different hooks. New shared files: Tackle, Razor Leaf, Leech Seed, Poison Powder, Sleep Powder, Sludge, Petal Dance, Solar Beam. Registry: 78 Mutations + 12 ability tiers. Balance risk noted: Bloom is the strongest evolved-ability burst late (~44 DPS at ~1000 DPS, only at full HP); re-run `npm run balance` when built.
  - **Decision D16 (owner, 2026-10-18), recorded in `PROJECT.md` §13:** augment levels offer only stat / trade-off / behaviour augments; Mutations (generic, Bond, signature) come **only from map sites**, which roll a generic Mutation, a Bond or an item. The owner also OK'd the Bulbasaur moveset. The map-site mechanic itself is a new system to be specified. The registry now labels every Mutation `Pool = site`, gives hooks as code identifiers (hook vocabulary + requirement IDs), and has a "For the implementer" section: the `MutationDef` shape and the offer filter.
  - **Pikachu line:** `pikachu/README.md`. Line mechanic **Charge** (running fills it, 1 per 20 px; Static paralysis +15). Pikachu: full Charge → a Charged signature shot ×2. Raichu (Lv 16): **Discharge** (150 px, 3× signature hit, paralysis 0.4 s). Trait twists: Static+ more Charge per paralysis, Lightning Rod wider Discharge. Signature Mutations Live Wire / Ball Lightning / Return Arc (chain cap 3 respected). Bonds: Volt Tackle (5% max HP recoil), Static Spark, Velocity Ball, Conductor, Shock Shatter, Thunderstorm. New shared files: Quick Attack, Spark, Electro Ball, Thunder Wave, Iron Tail, Thunder. Registry: 99 Mutations + 16 ability tiers.
  - **Decision D17 (owner, 2026-10-18), recorded in `PROJECT.md` §13 and §6:** Pikachu moveset approved, Volt Tackle keeps 5% HP recoil for now; **Lapras's signature evolves only once, at Lv 25**; Lapras is early-to-mid focused (level fast and safe), and its final firepower must be below the 3-stage final forms.
  - **Lapras:** `lapras/README.md`. Proposed path Ice Shard → **Sheer Cold** at Lv 25 (Frost Breath dropped; owner to confirm). Line mechanic **Tide**: Lapras Bonds have Flood values before Lv 30 and smaller Ebb values from Lv 30. Shell Armor unchanged (no upgrade, no trait). Signature Mutations Hail / Frost Lance / Song of the Sea (upgrade once at Lv 25). Bonds: Surging Slam (`levelUp`), Flash Freeze (`levelBelow`), Ferry Wave (`xpGem`, Surf), Pressure Shell (`armorAbsorb`, Hydro Pump). Surf and Hydro Pump reuse the Squirtle-line generic Mutations. New shared files: Body Slam, Ice Beam. Registry: **110 Mutations + 17 ability tiers**, all five P4 lines covered.
  - **Found:** the owner described Lapras as having better speed, but `content.ts` has Lapras at 135, the slowest starter. Raised as Lapras open point 5.
  - **Code is now behind the design** (to build later): Lapras `signatureTiers` still has the Lv 10 Frost Breath tier; none of the Mutations, line mechanics (Puddles/Soaked, Scorch, Bulb, Charge, Tide), ability tiers (Shell Burst, Flare Up, Bloom, Discharge), new moves (Smokescreen, Slash, Wing Attack) or map sites exist in code.
  - **Decision D18 (owner, 2026-10-18), recorded in `PROJECT.md` §13 and §6:** Lapras keeps **Sheer Cold** as its single Lv 25 tier (Frost Breath dropped from Lapras); the **Tide** (Flood before Lv 30, Ebb from Lv 30) is approved. Still open for Lapras: speed (135), Shell Armor staying un-upgraded, the optional XP ×0.85 knob.
  - **Decision D19 (owner, 2026-10-18), recorded in `PROJECT.md` §5 and §13:** at 15:00 every 3-stage final form out-damages Raichu and Lapras, which are roughly equal (±10%). Today Blastoise (523) is *below* Lapras (732) and Raichu (478), so the balance math needs fixing in the build session. Speeds follow official base Speed (data already ≈ 120 + 0.5 × base, ±5), and Lapras must out-run Charmander and Squirtle: **Lapras 135 → 155** (provisional, not yet in code).
  - **Decision D20 (owner, 2026-10-18), recorded in `PROJECT.md` §13:** every stage's speed follows the official base Speed exactly, as round(120 + 0.5 × base): Squirtle 142, Wartortle 149, Blastoise 159, Charmander 153, Charmeleon 160, Charizard 170, Bulbasaur 143, Ivysaur 150, Venusaur 160, Pikachu 165, Raichu 175, Lapras 150. This replaces D19's Lapras 155; not yet in code. Lapras's Shell Armor stays un-upgraded. Blinded approved. Still open: the Combine rule for Mutations (needed before P5).
  - **Session split (owner):** this session stays the skill-evolution designer; the Mutation **build** runs in a separate session the owner starts, from a brief given in chat.
- **Next:** the build plan for the Mutation system (it needs a phase decision: new systems are outside P4e as written). P4e is still the next *build* task until the owner says otherwise.
- **Build:** unchanged, still runs.

### 2026-10-18 — P4d: Pikachu, Lapras, first gamble balance pass
**Files**
- `src/data/content.ts`: Pikachu (Lv 1, Electric, HP 105, speed 165, ×1.05, Static) → Raichu (Lv 16, HP 170, ×1.25, traits Static+ / Lightning Rod); learnset Quick Attack, Spark, Electro Ball, Thunder Wave, Iron Tail, Raichu-only Thunder. Lapras (Water/Ice, HP 170, speed 135, ×1.2, Shell Armor, one stage) with `signatureTiers` Ice Shard → Frost Breath (Lv 10) → Sheer Cold (Lv 25); learnset Body Slam, Surf, Ice Beam, Hydro Pump. New `SignatureTier` / `PokemonDef.signatureTiers`.
- `src/data/moves.ts`: 12 new moves. Thunder Shock (chain 2 × 0.7) → Thunderbolt (burst + chain 3 × 0.8); Thunder = delayed 0.5 s strike zone with stun. `CraterDef.slow` (Sheer Cold's freezing field).
- `src/sim/evolution.ts`: `upgradeSignatureByLevel` swaps the signature in place by level (augments kept), called each step; sets `World.signatureTierUp` for the scene.
- `src/sim/forms/projectile.ts`, `types.ts`: crater slow.
- `src/scenes/SelectScene.ts`: 5 cards; cards grow to fit wrapped text; Lapras card says "stronger at Lv 10 / 25". `RunScene.ts`: 3 s "Ice Shard → Frost Breath!" notice.
- **Balance tool:** `src/sim/balance.ts` + `balance.bench.ts`, `npm run balance` (~4 min): a bot plays each line 15 min (invulnerable, random card picks, collects every gem) and at 5 / 9 / 15 min measures DPS on a pinned 16-dummy ring. Report → `balance-report.md` (gitignored). `npm run bench` now runs only the stress bench. `src/node-fs.d.ts` types the one Node call instead of adding @types/node.
- **Tuning (provisional):** Bulbasaur was the outlier (Ivysaur by 5 min, 1371 DPS at 15): Vine Whip 13→11, Power Whip 18→15 / reach 85, Frenzy Plant 26→21 / reach 95 / field 0.3. Lapras tiers made smaller (Frost Breath 13, Sheer Cold 12). Thunderbolt 16, chain 0.8; Raichu ×1.25.

**Balance report after tuning (4 seeds, DPS / level)**
| Line | 5 min | 9 min | 15 min |
|---|---|---|---|
| Charmander | 47 / Lv 7 | 180 / Lv 14 | 841 / Lv 36 |
| Squirtle | 102 / Lv 10 | 223 / Lv 17 | 523 / Lv 36 (highest eHP 285) |
| Bulbasaur | 255 / Lv 15 | 428 / Lv 26 | 1001 / Lv 42 |
| Pikachu | 121 / Lv 14 | 339 / Lv 23 | 478 / Lv 36 |
| Lapras | 197 / Lv 17 | 462 / Lv 29 | 732 / Lv 46 |

- §5 target: Lapras ahead at 5 min ✓; at 9 min still ahead of Charmander/Squirtle (target "about level") ✗; at 15 min behind Charizard and Venusaur ✓, ahead of Blastoise (which trades DPS for eHP) and Pikachu ✗.
- Random picks make it noisy (Lapras's 5-min DPS rose after a nerf), so no further tuning against it. **Owner input needed at the gate:** (1) Charmander reaches only Lv 7 by 5 min, so Charmeleon arrives ~6 min, not the §5 target of 3–4 min (owner-playtested line, untouched); (2) Lapras snowballs levels from early kills (Lv 46 at 15:00); (3) Pikachu's late game sits below Lapras.

**Checks (observed)**
- `npm run typecheck` clean; `npm test` **143/143 passed** (11 new: per-line data/kit rules for Pikachu and Lapras; Pikachu start + Lv 16 evolution + traits, Thunder Shock 2 jumps / Thunderbolt 3, Raichu-only Thunder delayed strike + stun; Lapras start vs Charmander + Shell Armor + never evolves, tiers at 10 / 25 keeping augments + scene notice, tier-up during play, Sheer Cold slowing field, Ice ×2 on Pidgey). `npm run build` passed; bench 0.74 ms/step mean. `npm run balance` completed (table above); every line ran 15 min headless without errors.
- Browser: select screen shows 5 cards with wrapped text fitting; Lapras run starts (Lv 1, HP 170, Ice Shard). **Not visually verified:** the pane was throttled to ~2 fps (window not in view), so the run clock did not advance; Pikachu/Lapras play, chain arcs, Thunder strike, tier-up notice and Raichu evolution are covered only by unit tests and the headless runs.

**Notes**
- Windows Python wrote CRLF into some files mid-session; normalised back to LF.
- Next: P4e (ability ↔ tag links §8.7), then the owner's P4 gate playtest (do starters feel different? is the tier a real gamble?).

### 2026-10-18 — P4c: Bulbasaur line
**Files**
- `PROJECT.md`: §6 Bulbasaur kit gains Solar Beam as the Venusaur-only unlock (kit rule 4).
- `src/data/content.ts`: Bulbasaur → Ivysaur (Lv 10) → Venusaur (Lv 25), Grass/Poison, Leech ability, Venusaur traits Overgrow+ / Chlorophyll; learnset Tackle, Razor Leaf, Leech Seed, Poison Powder, Sleep Powder, Sludge, Petal Dance, Solar Beam (stage 2). `TUNING.status.seedSeconds 4`, `seedHealFraction 0.5`.
- `src/data/moves.ts`: Vine Whip (arc 140°) → Power Whip (360°) → Frenzy Plant (360° + root field: r60, 2.5 s, 35% damage ticks, slow 40%); Razor Leaf (2 leaves), Leech Seed (`seedPct`), Poison Powder / Sleep Powder zones, Sludge, Petal Dance orbit, Solar Beam beam. `FieldDef` on melee moves.
- `src/sim/*`: new **seed** status (`Enemy.seedDps/seedLeft/seedTickLeft`, `HitInfo.seedDps`, `MoveStats.seedPct`); seed ticks heal the player half the damage dealt (a plain tick, no procs). `castMelee` spawns the move's field zone at the target.
- `src/scenes/RunScene.ts`: green seed status ring.

**Checks (observed)**
- `npm run typecheck` clean; `npm test` **132/132 passed** (7 new Bulbasaur tests: start state + Leech, Vine Whip front-only vs Power Whip 360°, Frenzy Plant slowing field, Leech Seed 4 s drain + 50% heal, Poison/Sleep Powder statuses, Solar Beam Venusaur-gated, Grass ×0.5 on Pidgey). The per-line data and kit-rule tests now cover Bulbasaur too. `npm run build` passed; bench 0.77 ms/step mean.
- Browser: select screen shows 3 cards; Bulbasaur run starts (Lv 1, HP 110, Vine Whip), front arc drawn, Lv 2 card offered Sludge and adding it worked; no new console errors. **Not visually verified:** Ivysaur/Venusaur evolution, Frenzy Plant field, seed ring (unit-tested only).

**Notes**
- Swing arcs are drawn white for every melee move (existing behaviour), not in type colour.
- Next: P4d — Pikachu (Thunder Shock chain → Thunderbolt; Raichu Lv 16 unlocks Thunder) and Lapras (level-based signature tiers), then the gamble balance pass.

### 2026-10-18 — P4b rework: kit rules, Squirtle redesign, type chart, weight (D14)
**Owner feedback:** Squirtle's kit felt incoherent (Ice Beam, Bite) compared with Charmander's; knockback too strong for Lv 1 (wants a stagger); wants type effectiveness and heavier enemies resisting knockback.

**Files**
- `PROJECT.md`: §4.1 kit rules (6 rules); §6 Squirtle learnset redesigned, knockback = stagger, Raichu unlocks Thunder; §9 type chart (pulled into P4) + weight resistance; D14.
- `src/data/typeChart.ts` (new): real chart for the 11 current types, multiplied for dual types, immunities → ×0.5; `moveType`, `effectiveness`.
- `src/data/moves.ts`: Squirtle learnset now Withdraw (360° shell bash, stagger 20 + stun 0.3 s), Rapid Spin, Water Gun (beam, push 10/tick), Whirlpool (zone, slow 60%), Surf; Blastoise-only Hydro Pump (heavy beam) and Flash Cannon (Steel, innate pierce 2). Bite removed (Tackle/Ice Beam kept for Bulbasaur/Lapras). Innate knockback nerfed: Water Pulse 15, Hydro Cannon 30, Rapid Spin 15, Surf 25; projectile `pierce`.
- `src/data/augments.ts`: Knockback augment 20/35/55 ("staggers").
- `src/data/content.ts`: enemy `weightKg` (Rattata 3.5, Pidgey 1.8, Raticate 18.5); `TUNING.knockbackWeightK = 25`; Squirtle learnset.
- `src/sim/*`: `HitInfo`/`MoveStats`/`Zone` carry `attackType`; `damageEnemy` applies the chart and records `lastEffectiveness`; knockback × (1 − weight resistance); projectiles add innate pierce; craters and zones keep their move's type.
- `src/scenes/RunScene.ts`: hit flash yellow (super effective) / grey (not very) / white.

**Checks (observed)**
- `npm run typecheck` clean; `npm test` **123/123 passed**. Squirtle block rewritten for the new kit (Withdraw 360° + stun, Water Gun line, Whirlpool slow zone, Flash Cannon pierce 2, Blastoise-gated cards, small Water Pulse stagger). New: chart matchups/dual/immunity, attack type, chart in damage + effectiveness, heavier = less push, a kit-rules test per line (≥ half own-type, ≤ 1 Normal, final-stage unlock). Knockback augment test now checks the weight-reduced push. `npm run build` passed; bench 0.79 ms/step.
- Browser: Squirtle run with Whirlpool + Water Gun picked via cards; zone and beam drawn in Water colours. Current enemies are Normal (± Flying), so live hits stay white (neutral). **Not visually verified:** yellow/grey flashes (unit-tested only); the page went hidden mid-check, so one card pick (Withdraw) didn't register.

**Notes**
- The chart matters little until P5 brings typed enemies (Geodude, Voltorb…); the engine is ready.

### 2026-10-17 — P4b: Squirtle line
**Files**
- `src/data/content.ts`: `squirtle` line. Squirtle (Lv 1, Water, 120 HP, 140 speed, ×0.95) → Wartortle (Lv 10, 170 HP, ×1.1) → Blastoise (Lv 25, 250 HP, ×1.3, traits Torrent+ / Rain Dish, both keep Shell). Ability Shell. Learnset Tackle, Bite, Rapid Spin, Ice Beam, Surf. Numbers provisional.
- `src/data/moves.ts`: Bubble `[Water, Projectile]` (slow 35%) → Water Pulse `+Pulse` (45 px splash, slow, knockback 40) → Hydro Cannon `+Area` (65 px splash, slow 40%, knockback 70); Tackle (melee), Bite (Dark melee, 0.4 s flinch), Rapid Spin (3-ball orbit, knockback 50), Ice Beam (beam, slow 50%), Surf (360° melee, reach 110, knockback 60); innate `knockback` on `InnateEffects`.
- `src/sim/stats.ts`: innate knockback stacks with the Knockback augment.
- `src/scenes/RunScene.ts`: `TYPE_COLORS`; player body coloured by the stage's first type; projectiles, orbit balls and beams coloured by their move's type.

**Checks (observed)**
- `npm run typecheck` clean; `npm test` **115/115 passed** (8 new: a data-rules test per line (stages rise, tiers only add tags, evolving lines end in a 2-trait pick), Squirtle start (Shell, Bubble, more HP than Charmander), Bubble slows, Water Pulse knockback + splash, Blastoise traits keep Shell, Surf 360° + Ice Beam slow + Bite flinch, Squirtle card pool = its learnset); `npm run build` passed.
- Browser: the select screen shows Charmander and Squirtle; picking Squirtle → blue player with the Shell bubble, Bubble slowed enemies (light-blue rings), HUD "Squirtle Lv 1 · HP 120/120".

### 2026-10-17 — P4a: multi-line engine + starter select
**Files**
- `src/data/content.ts`: types + Poison/Electric/Ice/Dark/Steel; `PokemonDef.role`; ability fields `blockEvery`, `damageTakenPct`, `contactStun`, `lifesteal`, `regenPerSec`, `moveSpeedPct`, `cooldownPct`; abilities for the P4 lines (Shell, Torrent+, Rain Dish, Leech, Overgrow+, Chlorophyll, Static, Static+, Lightning Rod, Shell Armor). Final-stage traits keep the base ability and add to it; `TUNING.chain` (140 px), slow 1.5 s, poison 3 s.
- `src/data/moves.ts`: innate `onHit` (slow / stun / poisonPct), projectile `chain`, new `zone` form (`ZoneMoveDef`).
- `src/sim/types.ts`: enemy poison/slow/stun state; `HitInfo` slow/stun/poisonDps; zone status effects; `Player.blockReadyLeft`; `World.arcs`; projectile chain fields.
- `src/sim/combat.ts`: `applyStatuses` (strongest wins, durations refresh); poison ticks like burn; slow/stun timers.
- `src/sim/stats.ts`: innate effects into move stats; abilities feed damage taken, regen, speed, cooldown and per-move lifesteal.
- `src/sim/world.ts`: stunned enemies don't move or deal contact damage; slowed enemies move slower; contact handles Static (stuns touchers) and Shell (blocks a hit, recharges); dispatches the zone form.
- `src/sim/zones.ts`: zones can carry statuses applied each tick. `src/sim/forms/zoneCast.ts` (new): zone on the nearest enemy. `src/sim/forms/projectile.ts`: innate chain (nearest unhit enemy within 140 px, up to the jump count, never back; arcs for drawing).
- `src/scenes/SelectScene.ts` (new): starter select (lines from data, tier label, role, ability, signature; keys or click); `?stress=1` skips it. `main.ts`: Select then Run. `src/scenes/RunScene.ts`: starts with the chosen line; R restarts the same line; C changes Pokémon; status rings (burn/poison/slow/stun), status-coloured zones, chain arcs, Shell bubble.

**Checks (observed)**
- `npm run typecheck` clean; `npm test` **107/107 passed** (10 new: slow halves movement, stun stops movement and contact, poison ticks, Shell blocks then recharges, Shell Armor −15%, Static stuns touchers, Leech/Chlorophyll/Rain Dish, zone-cast drops a poison zone on the target, chain hits 2 extra and not a 4th, 360° melee hits behind); `npm run build` passed; bench 0.75 ms/step.
- Browser: the select screen shows Charmander's card; click → run as Charmander; faint + R → new run, same starter; faint + C → select; key 1 starts; `?stress=1` skips select, 500 enemies at 117 FPS. Console: only old HMR-stamped errors from earlier phases.

**Notes**
- Only Charmander exists yet, so the select screen shows one card; the P4b–d lines add theirs.
- Static stuns enemies after their hit lands (you still take the first touch).

### 2026-10-17 — P3e: re-playtest revisions (D12)
**Owner feedback:** Return too strong (pierce + double hit); couldn't back out of an augment choice and got stuck replacing; late damage strong but OK for now; Glass on Fire Spin "didn't work" (no visible HP change); wanted some regen but saw the risk/reward.

**Files**
- `src/data/augments.ts`: Return gains −30% damage (provisional).
- `src/data/content.ts`: `EnemyDef.berryChance` (Rattata/Pidgey 0.4%, Raticate 30%); `TUNING.heal` (berry +25 HP, 6 px pickup padding, 12-berry budget).
- `src/sim/types.ts`: `DrawnAugments` cache on pickSkill/augment/replace offers; `Berry`; `World.berries`.
- `src/sim/progression.ts`: `drawAugmentCards`; `makeAugmentOffer` reuses cached cards per move; `backToSkills`; reroll updates the cache; replace/back carry the cache.
- `src/sim/combat.ts`: `maybeDropBerry` on kills (budgeted). `world.ts`: walk-over berry pickup (not magnetized).
- `src/scenes/RunScene.ts`: Back card (key 4 / Esc) in the augment window; Esc in replace = Back; blue berries; red HUD line "⚠ Glass: you take +X% damage"; floating red damage numbers on the player, tagged "(Glass +X%)" when it applies.

**Checks (observed)**
- `npm run typecheck` clean; `npm test` **97/97 passed** (7 new: Return −30%, Back keeps cards across moves, reroll updates the cache, berries chance/no magnet/heal, berry budget, Raticate ≫ Rattata drop rate, Glass from a non-signature move = 1.1× contact damage); `npm run build` passed; bench 0.76 ms/step.
- Browser (visible pane): Glass II showed the HUD warning and a "-12 (Glass +15%)" floater on a 10-damage hit; berry drawn; augment window had 2 green behaviour cards + "[4] BACK"; key 4 → move selection, key 1 → the same 3 cards. Console: only HMR-stamped mid-edit errors from before the reload.

**Diagnosis:** Glass was working before (unit test proves it from any move); it was just invisible: +10% of a 10-damage hit = 1 HP.

### 2026-10-17 — P3d: playtest revisions (D11)
**Files**
- `src/data/content.ts`: stages carry `types` (Charizard Fire/Flying) and `abilityChoices` (Charizard: Blaze+ / Solar Power); learnset entries are `{ move, fromStage }` with Air Slash + Hurricane from stage 2; abilities generalised (low-HP boost, type boost, HP drain); `TUNING.stabBonus = 0.2`.
- `src/data/moves.ts`: `airSlash` (Flying·Projectile·Slicing, 2 × 16 dmg, fast) and `hurricane` (Flying·Orbit·Wind, 4 × 14 dmg, wide). Provisional.
- `src/data/augments.ts`: kind `'behaviour'` for Pierce/Homing/Return/Knockback/Burn/Lifesteal; `isSpecialAugment` (behaviour or exclusive).
- `src/sim/stats.ts`: `typeDamageFactor` (STAB + Solar Power's Fire boost) folded into move damage via the user's stage types and trait.
- `src/sim/combat.ts`: low-HP boost reads the player's current trait. `world.ts`: player starts with the line's trait; Solar Power drains 1 HP/s, never below 1.
- `src/sim/evolution.ts`: the summary carries `traitChoices`; `chooseEvolutionTrait`; dismiss is blocked until a trait is chosen.
- `src/sim/progression.ts`: stage-gated learnset; augment pool always includes new augments; a new augment on a full move opens `replace` (`chooseReplace` → rank I in the chosen socket, `backFromReplace` → same cards, no reroll spent); `makeAugmentOffer` guarantees ≥ 1 behaviour/exclusive card and shuffles.
- `src/sim/forms/projectile.ts`: one crater per projectile (`craterSpawned`).
- `src/scenes/RunScene.ts`: 5 s cinematic, skippable after 2 s (Enter/Space/1/click) with a hint; summary shows the type change; Charizard's trait pick (keys 1/2 or click; Enter blocked); replace window (sockets 1–3, Back = 4/Esc) and a "Sockets full" hint; behaviour cards green "NEW · BEHAVIOUR"; HUD trait follows the player.

**Checks (observed)**
- `npm run typecheck` clean; `npm test` **90/90 passed** (9 new: crater once with Pierce, replace → Back keeps cards, replace sets rank I, 300 seeded augment windows each with a special card, STAB on/off, Flying moves gated to Charizard with STAB, trait choice blocks dismiss, Blaze+ 40%/+70%, Solar Power +30% and drain floor 1). 8 older assertions updated for STAB / replacement (expected design shifts). `npm run build` passed; `npm run bench` mean **0.71 ms**/step.
- Browser (pane visible): Charizard summary showed "Type Fire → Fire/Flying" and two trait cards; Enter did not dismiss; clicking Solar Power set the trait (Blast Burn damage 36.45 = 18 × 1.35 × 1.5) and handed over to queued cards. Replace: the full-sockets hint showed; Mega Flare → replace window (3 sockets + Back); Back restored the same cards with rerolls unchanged; replacing Knockback gave `[pierce II, megaFlare I, burn I]`, knockback 0, zone duration ×1.3. Skip timing on a manually started cinematic: Enter at ~1.0 s ignored, Enter at ~2.3 s skipped to summary (~2.4 s).
- Console: only HMR-stamped mid-edit errors from before the reload.

**Notes**
- With replacement, the Power Surge fallback now only triggers if no move can take any augment (practically never); kept as a safety net.
- Air Slash / Hurricane numbers are first guesses; watch Charizard's late-game power with Solar Power + STAB.

### 2026-10-17 — P3c: behaviour augments
**Files**
- `src/data/augments.ts`: Pierce I–III (1/2/4 enemies), Homing (single rank), Return (`boomerang`, single rank: out and back, passing through enemies both ways), Knockback I–III (40/70/110 px; Melee/Projectile), Burn I–III (20/35/50% of the hit per second for 3 s; Fire only), Lifesteal I–III (2/4/6% of damage dealt). `ranks` is now 1–3 entries; `maxRankOf`.
- `src/data/content.ts`: `TUNING.status` (burn 3 s, 0.25 s ticks, knockback decay) and `TUNING.homing` (250 px search, 6 rad/s turn).
- `src/sim/types.ts`: `HitInfo` (on-hit effects); enemy knockback velocity + burn state; projectile `hit`, pierce/homing/return state, `hitIds` (reused, max 16) so pierce/return never re-hit the same enemy on a leg.
- `src/sim/combat.ts` (rewritten): `damageEnemy(world, enemy, damage, hit)` applies crit, Blaze, Blaze Core, lifesteal (on damage actually dealt), burn, knockback; `NO_HIT`/`makeHitInfo`; `updateStatuses` (knockback motion + burn ticks as plain hits, i.e. no proc-from-proc); `findNearestEnemy` can search around any point.
- `src/sim/forms/projectile.ts` (rewritten): pierce, homing steering with a turn limit, Return legs; `createProjectile` for the pool and tests. Melee/orbit/beam pass `HitInfo` (melee and beam set the knockback direction); zones deal plain hits.
- `src/sim/progression.ts`: rank-ups honour each augment's max rank. `src/sim/stress.ts`: the stress build now uses Homing, Knockback, Burn and Lifesteal.
- `src/scenes/RunScene.ts`: orange ring on burning enemies; single-rank augments show no numeral.

**Checks (observed)**
- `npm run typecheck` clean; `npm test` **81/81 passed** (10 new: no pierce stops at first, Pierce I stops at the second, Homing curves to an off-line enemy, Return hits once per leg and ends at the player, Knockback > 60 px at rank III, Burn = dps × 3 s in ticks, burn ticks don't lifesteal, lifesteal capped at max HP, single-rank never ranks up, Burn/Knockback tag gating); `npm run build` passed; `npm run bench` (stress now with homing/burn/knockback/lifesteal) **mean 0.78 ms, p99 1.20 ms, max 4.0 ms**.
- Browser: Burn, Knockback and Pierce were picked on Ember through the real augment window (page-dispatched key 1, then mouse clicks); stats updated (burn 0.2, knockback 40, pierce 1). **Live combat effects were not observable**: the pane's page stayed `visibilityState: hidden`, so game time barely advanced. No new console errors from this load.

**Design note (my call within D10, flag for the owner):** Return passes through enemies on **both** legs (a boomerang). Dying on the first outbound hit would almost never return.

**Risks**
- Homing re-targets with a linear enemy scan when its target dies; fine at current counts (bench max 4 ms), but switch to a hash query if projectile counts grow.

### 2026-10-17 — P3b: signature tiers, zones, tag/exclusive augments
**Files**
- `src/data/moves.ts`: `flameBurst` `[Fire, Projectile, Area]` (13 dmg, explosion r45 × 60% splash) and `blastBurn` `[+Zone]` (18 dmg, cd 1.2, explosion r65 × 70%, crater r55 for 2.5 s ticking every 0.5 s at 30%); optional `explosion` / `crater` on projectile defs. Numbers provisional.
- `src/data/content.ts`: each `EvolutionStage` names its `signatureMove` (ember → flameBurst → blastBurn); `TUNING.budget.maxZones = 40`.
- `src/data/augments.ts`: Wide Blast (Area: blast radius), Linger (Zone: duration), Blaze Core (exclusive to the 3 signature tiers: up to +30/50/80% damage as HP drops), Mega Flare (exclusive to Blast Burn: crater size/duration/damage); `exclusiveTo` field.
- `src/sim/zones.ts` (new): `spawnZone` (respects the budget), `updateZones` (ticks damage; zones never spawn effects).
- `src/sim/forms/projectile.ts`: projectiles carry explosion/crater payloads scaled by area, blast radius, duration, zone multipliers; `detonate` on hit splashes everyone else in the radius and drops the crater; explosion flashes recorded in `world.blasts`.
- `src/sim/evolution.ts`: evolving swaps slot 0 to the new tier in place, keeping its sockets.
- `src/sim/stats.ts` / `combat.ts` / `progression.ts`: new move stats (blast radius, zone duration/damage, missing-HP bonus); `damageEnemy` applies Blaze Core live; the pool honours `exclusiveTo`.
- `src/scenes/RunScene.ts`: crater fill + ring fading out, explosion flash, summary card shows signature change + new tags + "Augments carried over", exclusive augment cards (orange, "NEW · EXCLUSIVE").

**Checks (observed)**
- `npm run typecheck` clean; `npm test` **71/71 passed** (8 new: tiers only add tags, signature swap keeps augments + correct damage, carried augments rank up and never duplicate, Flame Burst splash near/far, Blast Burn crater ticks 4–5 times over 2.5 s then expires, zone budget, tag/exclusive pools per move, Blaze Core scaling); `npm run build` passed; `npm run bench` 0.91 ms/step mean.
- Browser (pane visible): a 1300 XP gem → Lv 25; two cinematics chained (Charmander → Charmeleon with `flameBurst`, → Charizard with `blastBurn`); against a 12-enemy cluster Blast Burn hurt 9 enemies via splash and left 3 craters, drawn as orange rings; HUD "Charizard Lv 25 … Moves: Blast Burn".
- Console: only HMR-stamped errors from mid-edit states before the reload.

**Notes**
- The explosion flash lasts 0.18 s and wasn't caught in a screenshot; the splash damage was observed through the sim.
- The stress build still uses Ember; consider a Blast Burn stress variant when zones get heavier (Bulbasaur, P4).

### 2026-10-17 — P3a: evolution core
**Files**
- `src/data/content.ts`: `PokemonDef` is now an evolution line with `stages` (Charmander Lv 1 / 100 HP / 150 / r12 / ×1.0 → Charmeleon Lv 10 / 140 / 160 / r15 / ×1.15 → Charizard Lv 25 / 200 / 175 / r19 / ×1.35, provisional), `ability`; `ABILITIES.blaze` (<30% HP → +50% damage).
- `src/sim/evolution.ts` (new): `dueEvolutionStage`, `startEvolutionIfDue`, `finishEvolutionCinematic`, `dismissEvolution`. Evolution runs before queued level-up cards; multi-stage jumps resolve one at a time.
- `src/sim/types.ts`: `Player.stage`, `EvolutionState` (`cinematic` → `summary`), `World.evolution` (pauses the sim).
- `src/sim/stats.ts`: `currentStage`; `refreshStats` applies stage max HP (the gain heals), speed, radius and damage multiplier.
- `src/sim/combat.ts`: `isAbilityActive` / `abilityDamageMult`, applied live when hits land.
- `src/sim/world.ts`: first-stage player stats; the step pauses during evolution; evolution is checked before making an offer. `stress.ts` skips evolutions.
- `src/scenes/RunScene.ts`: the overlay is keyed by evolution phase or offer; a 2 s cinematic (70% dim, "What? X is evolving!", player flashing 4 → 20 Hz while growing to the new size, expanding ring, reveal line at 80%); a summary card with stat deltas (Enter / Space / 1 / click to continue); Blaze red pulsing aura + "BLAZE!" in the HUD; the HUD name follows the stage.

**Checks (observed)**
- `npm run typecheck` clean; `npm test` **63/63 passed** (7 new: stage data rises, cinematic pre-empts cards and pauses, stage applied with heal, summary → queued cards, double jump evolves twice, wrong-phase calls ignored, Blaze ×1.5 below 30%); `npm run build` passed.
- Browser (pane visible): a 175 XP gem took Lv 1 → 10 → cinematic shown (reveal line, white/orange flashing, ring), then the summary card (100 → 140 HP, 150 → 160 speed, ×1.00 → ×1.15, size 12 → 15) with the HUD switched to "Charmeleon … 140/140"; Enter (dispatched on the page) dismissed it and the queued level-up cards opened; at 20% HP the red aura + "BLAZE!" showed.
- The browser tool's own "Return" key press didn't reach the page; a page-dispatched Enter did. Treated as a tool quirk: worth confirming Enter/Space in the owner playtest.
- Console: only stale errors stamped with HMR `?t=` timestamps from mid-edit states before the reload.

**Notes**
- The signature move stays Ember at every stage until P3b adds Flame Burst / Blast Burn.
- Charizard's flight perk waits for hazards (P5/P6); for now it's speed only.

### 2026-10-17 — P2d: performance budgets and stress test
**Files**
- `src/data/content.ts`: `TUNING.budget.maxProjectiles = 500`.
- `src/sim/forms/projectile.ts`: pooled projectiles (`acquireProjectile`); the cap clips a cast to fewer projectiles carrying the same total damage; a full budget spends the cast.
- `src/sim/types.ts` / `world.ts`: `projectilePool`; dead projectiles return to the pool.
- `src/sim/stress.ts` (new): `setupStress` (4 moves with all 3 sockets at rank III, Ember = Multishot + Scatter + Velocity, all boosts maxed, 3 items, invulnerable) and `topUpStress` (holds 500 enemies at HP ×8, skips level-up windows).
- `src/sim/stress.bench.ts` (new) + `npm run bench`: Vitest 5 `bench` test-context fixture (API checked via Context7: v5 removed the top-level `bench` export).
- `src/scenes/RunScene.ts`: `?stress=1` runs stress mode; `?stress=1` or `?perf=1` shows FPS, sim ms, draw-command ms and entity counts (top right); dev builds expose `window.__perf`.

**Checks (observed)**
- `npm run typecheck` clean; `npm test` **56/56 passed** (4 new: clipped cast keeps total damage, full budget spends the cast, pool reuse by identity, stress mode holds 500 enemies / never pauses or faints / stays ≤ the cap over 240 steps); `npm run build` passed.
- `npm run bench` (Node 24, sim only): **one step mean 0.82 ms, p99 1.27 ms, max 1.56 ms**, i.e. under 10% of a 16.7 ms frame.
- Browser `?stress=1` (pane visible, 1466×402 viewport): **159–162 FPS**, sim 0.27–0.46 ms/frame, 500 enemies held, ~45 KOs/s, status running, no offers. Screenshot taken.

**Caveats**
- In this scenario projectiles and gems sit near 0: the horde hugs the player, so Ember's 10-projectile casts (cooldown ≈ 1.6 s) hit instantly and the magnet clears gems. The 500-projectile cap is covered by unit tests, not by this browser run.
- "draw-cmd ms" only measures building Phaser Graphics commands; GPU rendering cost shows up in FPS. FPS was measured on this machine's display (refresh > 60 Hz). A slower laptop still needs checking.
- The enemy cap for normal play stays 300 (§11.1); stress mode deliberately exceeds it.

### 2026-10-17 — P2c: augments
**Files**
- `src/data/augments.ts` (new): 10 augments with ranks I–III (rank values are totals). Stat: Power Up, Quick Cast, Enlarge, Extend (Projectile/Orbit/Beam only), Keen Edge, Multishot, Velocity (Projectile only). Trade-offs: Concentrated, Glass (player takes more damage), Scatter (Projectile only). Multishot and Scatter pay for extra projectiles with cooldown. 3 sockets, max rank III, augment every 3rd level, 2 rerolls per run.
- `src/data/upgrades.ts`: `BIG_BOOST` (Power Surge: +15% damage, +20 max HP, uncapped) as the augment-level fallback.
- `src/sim/types.ts`: `AugmentSocket`, `MoveSlot.sockets`, `MoveStats.extraCount/speedMult`, `Modifiers.damageTakenMult`, `LevelUpOffer` is now a union (`cards` | `pickSkill` | `augment`), world `bigBoosts`/`rerollsLeft`.
- `src/sim/stats.ts`: augments fold into `computeMoveStats` (damage/area floors so trade-offs can't zero a move); Glass feeds `damageTakenMult`.
- `src/sim/progression.ts`: `isAugmentLevel`, `resolvingLevel`, tag-filtered `augmentPool` (rank-ups + new augments while a socket is free), `chooseSkill`, `chooseAugment` (rank-up in place, never a duplicate), `canReroll`/`rerollAugments`, Power Surge/Potion fallbacks.
- `src/sim/forms/projectile.ts`: extra projectiles and speed from augments. `world.ts`: contact damage × `damageTakenMult`.
- `src/scenes/RunScene.ts`: one overlay builder for all three windows (gold frame on augment levels, red border = trade-off, gold = rank-up), keys 1–5 or click, R / click to reroll, card width shrinks to fit up to 5 moves, title shows the level being resolved, pause = build panel (moves, sockets, boosts, items, rerolls).

**Checks (observed)**
- `npm run typecheck` clean; `npm test` **52/52 passed** (11 new: augment-level rhythm + pickSkill offer, tag-filtered pools, skill → 3 distinct augments → socketed, rank-up in place, full sockets → rank-ups only, Power Surge fallback, reroll limit, augment stat math, Multishot fires 3, Glass damage taken, rank data present); `npm run build` passed.
- Browser (:5180): an injected 13 XP gem queued Lv 2 + Lv 3. The Lv 2 card window opened; clicking Fire Spin opened the gold "AUGMENT LEVEL 3!" window with Ember and Fire Spin showing empty sockets; clicking Ember showed 3 rank-I cards (trade-offs in red) with "[R] Reroll (2 left)"; clicking Reroll dealt new cards ("1 left"); picking Power Up gave Ember `powerUp` rank 1 and damage 11.5 (10 × 1.15). No new console errors (only the stale pre-reload HMR entries).
- **Found and fixed during the check:** the window title showed the current level instead of the level being resolved when several level-ups were queued.
- **Not verified in the browser:** keyboard picks (1–5, R) and the Esc build panel. The pane's page was reported hidden, so Phaser's loop barely ran and dropped key input. Keys worked in earlier phases, and the pick/reroll logic is covered by unit tests and click checks.

**Notes**
- Augment numbers are provisional; watch Scatter/Multishot stacking on Ember in playtests (worst case 10 projectiles per cast at cooldown ×2.9).

### 2026-10-17 — P2b: move framework and level-up cards
**Files**
- `src/data/moves.ts` (new): typed `MoveDef` union by form. Ember (projectile), Scratch (melee arc 110°, reach 60), Fire Spin (2 orbiting balls, 3.5 s out of every 6 s, 0.5 s per-enemy hit interval), Dragon Rage (260 px beam, 3 ticks over 0.6 s). Numbers provisional.
- `src/data/upgrades.ts` (new): 6 generic boosts (max 5 picks each, D9), 4 held items (3 slots), Potion fallback, crit ×1.5, 4 learnset slots, 3 cards per offer.
- `src/data/content.ts`: move data moved out; Charmander `learnset`; Flying/Dragon types.
- `src/sim/stats.ts` (new): `computeModifiers` (boosts additive, cooldown multiplicative, items), `computeMoveStats` (the hook point for P2c augments), `refreshStats` (max-HP gain also heals), `createSlot`.
- `src/sim/combat.ts` (new): `queryEnemies`, `findNearestEnemy`, `damageEnemy` (crit roll only when crit > 0, to keep runs reproducible), `dropGem`.
- `src/sim/progression.ts` (new): XP functions moved here; `buildCardPool`, `makeOffer` (3 distinct, or a Potion), `chooseCard` (applies, refreshes stats, chains pending level-ups).
- `src/sim/forms/{projectile,melee,orbit,beam}.ts` (new): cast + update per form. Moves cast and act in the same step.
- `src/sim/world.ts`: dispatches moves by form; the sim pauses while `world.offer` is set; regen; swings.
- `src/scenes/RunScene.ts`: card window (keys 1/2/3 or click; 250 ms input guard), beam/swipe/orbit drawing, HUD line listing moves and items. The P2a toast was removed.

**Checks (observed)**
- `npm run typecheck` clean; `npm test` **41/41 passed** (14 new: melee arc hit/miss and no-target, orbit hit interval, beam line hit/miss, modifier stacking, refreshStats, move stats, crit ×1.5, Leftovers regen, card pool contents and exclusions, 3 distinct cards / Potion fallback, pause-while-offering + chained offers, Potion cap); `npm run build` passed.
- Browser (:5180): the level-up opened the card window and froze the clock; key 2 took Leftovers (regen 1/s); forced offers added Scratch, Fire Spin and Dragon Rage via key 1; orbit balls, purple beam, swipe slice and hit flashes all drew; a mouse click on the middle card took Focus (crit 0.05).
- The console showed only stale errors stamped with `?t=` HMR timestamps from mid-edit module states before the reload. No new errors during the checks.

**Notes**
- Every level is currently a normal (card) level; the augment rhythm arrives in P2c.
- Card layout is fixed at 3 × 210 px wide; check that it still fits narrow windows during the playtest.

### 2026-10-17 — P2a: XP, levels, waves, 15-min run
**Files**
- `src/data/waves.ts` (new): 6 spawn keyframes (0, 1, 3, 6, 10, 13 min). Interval and HP scale interpolate; weights switch per keyframe.
- `src/data/content.ts`: Pidgey (fast) and Raticate (tanky) stat-only variants; enemy `xp`; `TUNING.runSeconds` (900), magnet radius 64, XP curve `5 + 3n + 0.08n²` (~3.9k XP to Lv 40), gem pull speed, 400-gem budget. The old spawn ramp was removed.
- `src/sim/types.ts`: `Gem`, world `gems/level/xp/pendingLevelUps`, player `pickupRadius`, status `survived`.
- `src/sim/world.ts`: `waveAt`, `pickEnemyKind`, HP-scaled `spawnEnemy`, `xpToNext`, `gainXp` (multi-level), `dropGem` (merges into the oldest gem past the budget), gem magnet/collect, victory at 15:00.
- `src/scenes/RunScene.ts`: gem diamonds (blue = 1, green ≥ 5), per-kind enemy colours, top XP bar, level-up toast (temporary until the P2b card window), "Survived 15:00!" banner, R restarts after a win too.

**Checks (observed)**
- `npm run typecheck` clean; `npm test` **27/27 passed** (11 new: wave order/interpolation/weight odds/HP scale, XP curve, level threshold, multi-level, kill drops gem, magnet collect, out-of-range gem, gem budget merge, victory freeze); `npm run build` passed.
- Browser (:5180): walking over gems raised XP; an injected 20 XP gem went Lv 1 → 3; the "LEVEL UP! Lv 4" toast showed; at t = 400 s the spawns mixed Rattata 18 / Pidgey 5 / Raticate 2; at t = 899.8 → status `survived` and the banner showed.
- The console showed one stale `updateGems is not defined` error stamped from an HMR update mid-edit. After a fresh reload the sim ran without new errors.

**Notes / tuning to watch**
- In P2a the player still has Ember only, so later waves (HP ×2.5–6) will overwhelm it. Expected until P2b/P2c add power.
- On wide screens the spawn ring is ~800 px out, so the first Rattata takes ~10 s to arrive. Consider a closer ring or an early burst if the opening feels slow.

### 2026-10-17 — P0 + P1 start
**Objective:** finish P0 (design doc, process docs, repo) and build the P1 toy.

**P0 — done**
- `PROJECT.md`: design doc with owner decisions D1–D8 (fire model, combine/rifts, evolution gamble, sprites, title, engine, skill building, augment ranks).
- `AGENTS.md`: agent process and architecture rules.
- `.gitignore`, `git init -b main`. **Nothing committed yet.**

**P1 — code complete, not yet verified in the browser**
- Stack: Phaser **4.2.1** (latest stable on npm), Vite 8.3.4, Vitest 5.0.5, TypeScript 7.0.2.
- `src/data/content.ts`: typed content (Ember, Charmander, Rattata, tag types) and tuning values (all provisional).
- `src/sim/` (pure TS, no Phaser):
  - `world.ts`: fixed-step sim (player movement with normalised diagonals; spawn ring off-screen with a ramping interval and a 300-enemy cap; enemies chase and push apart; Ember auto-targets the nearest enemy in range; projectile hits; contact damage with an invulnerability window; faint freezes the run).
  - `spatialHash.ts`: grid broad-phase with pooled buckets.
  - `rng.ts`: seeded mulberry32 plus a crypto seed.
  - `types.ts`: sim state types.
- `src/scenes/RunScene.ts`: grey-box renderer (grid ground, circles and squares), camera follow, HUD (HP, timer, KOs, enemy count), Esc pause, faint banner, R to restart, a 60 Hz fixed-step accumulator with a 0.25 s cap per frame.
- `.claude/launch.json`: `pokesurvivor-dev` on port 5180.

**Commands and observed results**
- `npm run typecheck`: clean.
- `npm test`: **16/16 passed**. Covers rng determinism, spatial hash, movement, Ember targeting and kills, contact damage and invulnerability, faint freeze, spawner ring/ramp/cap, and separation.
- `npm run build`: passed; one 1.38 MB JS chunk (361 kB gzip), mostly Phaser.

**Browser check (2026-10-17, dev server on :5180, browser pane)**
- Renders the grey-box field, the Charmander square with its HP bar, Rattata circles and the HUD. **No console errors.**
- Idle for 17 s: Ember killed 5 Rattata; contact damage took HP to 80 with the white hurt flash.
- Idle until fainting: fainted at 0:22. The faint banner shows time and KOs.
- Input via synthetic key events: holding D for 1 s moved +150 px (= speed); W+A for 1 s moved (−107.8, −107.8), so diagonals are normalised.
- Esc pause freezes sim time; Esc again resumes.
- R after a faint gives a fresh world (HP 100, KOs 0, timer reset).
- Added a dev-only `window.__world` handle in `RunScene` for these checks. Confirmed it is absent from the production bundle.
- The preview tool only reads `.claude/launch.json` from the session's original folder (KOFv1). I temporarily added a `pokesurvivor-dev` entry there and **reverted it** (KOF `git status` is clean).

**Not verified**
- Feel and fun: this needs a human playtest (the P1 gate).
- FPS under load: the stress-test scene comes in P2.

**Decisions:** D1–D8 approved (see `PROJECT.md` §13). Nothing pending.

**Risks and technical debt**
- Projectiles and enemies are plain arrays, compacted in place; true object pooling comes when P2 adds more projectiles.
- Contact and projectile queries use the hash built before enemies move, plus an 8 px margin. Fine at current speeds; revisit if enemies get much faster.
- The spatial-hash key is unique within ~2 million px of the origin. That's enough for a 15-min run; recheck with the endless map in P6.
- The whole scene redraws one Graphics object per frame. Fine for grey boxes; it will be replaced by sprites and batching in P6.
