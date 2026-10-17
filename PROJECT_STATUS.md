# PROJECT_STATUS — PokeSurvivorEVO

## Current state
- **Phase:** P0, P1 and **P2 done**. The owner playtested P2 on 2026-10-17 and reported "i think is ok" (gate accepted; no tuning changes requested, and the individual checks for keys/Esc panel/build variety were not itemised). **P3a done** (2026-10-17): Charmander → Charmeleon → Charizard stages, auto evolution with cinematic + summary card, Blaze. **P3b done** (2026-10-17): Flame Burst / Blast Burn signature tiers, zone system, Wide Blast / Linger, Blaze Core / Mega Flare. **P3c done** (2026-10-17): on-hit pipeline + statuses; Pierce, Homing, Return, Knockback, Burn, Lifesteal. **P3 gate playtest (owner, 2026-10-17): "quite fun"** → revisions D11, built as **P3d**: 5 s skippable cinematic, crater once per projectile, augment replacement, guaranteed behaviour card, stage types + Flying moves + STAB, Charizard trait choice. Behaviour augments never appeared in the playtest (pool dilution: 17 options, 3 per window), which the guaranteed card fixes. **P3d done** (2026-10-17). **P3 re-playtest → D12, built as P3e** (2026-10-17): Return −30% damage, Back to move selection (cards kept per move), Oran Berry heal drops, visible Glass penalty + player damage numbers. Owner noted late-game damage is strong but acceptable until the difficulty ramp (P5). **P3 gate passed** (owner, 2026-10-17: "P3 is good"). **Next: build P4a** (see the P4 plan below).

## P4 plan (owner-approved 2026-10-17, D13)
**Gate:** do the starters feel truly different? Is picking a tier (3-stage / 2-stage / no evolution) a real gamble?

| Step | Build |
|---|---|
| **P4a** | Multi-line engine: more Pokémon types (Water, Grass, Poison, Electric, Ice, Dark, Steel); statuses slow / stun (sleep, paralysis) / poison on the burn tick system; Shell block and damage reduction; zone-cast form; 360° melee; innate chain (≤ 3 jumps); per-line final trait picks; non-evolver signature tiers by level; **simple starter select screen** |
| **P4b** | Squirtle line |
| **P4c** | Bulbasaur line |
| **P4d** | Pikachu (2-stage) + Lapras (non-evolver); first balance pass on the early-vs-late gamble (§5 target: non-evolver ahead at ~5 min, level ~9 min, behind at 15 min) |
| **P4e** | Ability ↔ tag links (§8.7) across lines |
| **Gate** | Owner playtest |
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
