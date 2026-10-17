# PROJECT_STATUS — PokeSurvivorEVO

## Current state
- **Phase:** P0 done. **P1 done: the owner playtest passed the gate on 2026-10-17.**
- **Builds:** yes (`npm run build` passes, 2026-10-17).
- **Committed:** `844afd4` (P0 + P1), `4fb5b98` (P2a); P2b commit follows this update.
- **P2a done** (2026-10-17): XP gems + magnet, level curve, XP bar, wave table with Pidgey/Raticate variants and HP scaling, 15:00 "Survived!" screen.
- **P2b done** (2026-10-17): 4 move forms, Charmander learnset, generic boosts, held items, level-up card window.
- **Next task:** build **P2c**: 3 sockets per move, augment level every 3rd level, the 2-window augment flow + Reroll, ranks I–III, ~10 🟢 augments, build panel on pause.

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

## Session log

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
