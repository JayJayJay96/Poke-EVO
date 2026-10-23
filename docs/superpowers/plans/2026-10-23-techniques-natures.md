# Techniques + Natures Implementation Plan (D40)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Normal level-ups offer learnset moves, ranked **Techniques** (5 slots) and trade-off **Natures**, replacing the 6 flat boosts.

**Architecture:**
- Technique data lives in `src/data/techniques.ts`.
- All runtime behaviour lives in `src/sim/techniques.ts`: pure functions called from the existing hot paths (`damageEnemy`, `hitPlayer`/`drainPlayer`, `fire`, `updateMoves`, `updateGems`, `step`).
- Natures reuse the existing `boosts` record and the `'boost'` card kind. Only the table contents change, plus a per-entry cap. This keeps the change small: the card kind, the snapshot field and the HUD all keep working.

**Tech stack:** TypeScript, Vitest, Phaser 4 (UI only).

**Spec:** `docs/superpowers/specs/2026-10-23-techniques-natures-design.md`

## Deviations from the spec (internal or forced)
- **Natures:**
  - they keep the internal names `BOOSTS`, `BoostId` and card kind `'boost'`; internal names are free under AGENTS.md
  - filler is marked by `maxPicks: Infinity`
- **Frostbite:** enemies have no frozen state (`StunKind` is only `sleep | paralysis`), and Ice moves slow. So Frostbite triggers on an enemy **killed while slowed**. To be confirmed with the owner.
- **Spore Cloud:** the puff is **instant**. Enemies in the radius are poisoned with the dying enemy's poison. There is no 2 s lingering zone, which keeps the zone system out of it.
- **Focus Energy:** it is a forced crit at ×2, not ×1.5.

## File map
| File | Change |
|---|---|
| `src/data/techniques.ts` | **new**: ids, defs (name, `requiresAny`, three ranks), `MAX_TECHNIQUE_SLOTS = 5`, `MAX_TECHNIQUE_RANK = 3`, `TECHNIQUE_TUNING` |
| `src/data/upgrades.ts` | `BoostId` becomes `brave / timid / bold / hasty / hp / pickup`; `UpgradeDef.maxPicks`; `NATURE_MAX_PICKS = 3`; `BOOST_MAX_PICKS` is removed |
| `src/sim/types.ts` | Card `{ kind: 'technique', techniqueId, rank }`; `World.techniques`, `World.tech` state; `MoveSlot.focusReady`; optional `Enemy.techMarked` |
| `src/sim/techniques.ts` | **new**: `owned` rank lookup, `techniquePool`, `updateTechniques`, `onTechniqueHit`, `onTechniqueKill`, `techniqueDamageMult`, `focusCrit`, `rolloutMult` + consume, `cooldownRate`, `endureSaves`, `onPlayerHit`, `onGemCollected` |
| `src/sim/stats.ts` | clamp `damageMult` ≥ 0.5, `moveSpeedMult` ≥ 0.5, max HP ≥ 20; `createSlot` gets `focusReady: false` |
| `src/sim/combat.ts` | `damageEnemy` uses the technique damage mult, focus crit, `onTechniqueHit` and `onTechniqueKill` |
| `src/sim/world.ts` | init state; `updateTechniques` in `step`; rollout in `fire`; `cooldownRate` in `updateMoves`; `endureSaves` + `onPlayerHit` in `hitPlayer`/`drainPlayer`; `onGemCollected` in `updateGems` |
| `src/sim/progression.ts` | the pool adds Technique cards, natures capped per entry, filler only when the pool has fewer than 3 cards; the offer guarantees ≥ 1 Technique; `applyCard` handles `'technique'` |
| `src/sim/buildSnapshot.ts` | saves and restores `techniques`; version 3 → 4 |
| `src/sim/stress.ts` | maxes the natures (filler capped at 5) and gives a full Technique set |
| `src/scenes/RunScene.ts` | Technique card + NATURE heading; a build-panel line; a small HUD row of Techniques |
| tests | `src/sim/techniques.test.ts` (new); update `world.test.ts`, `charmanderMoves.test.ts`, `sites.test.ts` for the new boost ids |

## Tasks

### Task 1: Data
- [ ] Create `src/data/techniques.ts` with the 13 Techniques. Rank values come from the spec.
- [ ] Rewrite `BOOSTS` in `upgrades.ts`:
  - Brave: `{ damagePct: 0.25, moveSpeedPct: -0.1 }`
  - Timid: `{ moveSpeedPct: 0.15, pickupPct: 0.25, damagePct: -0.1 }`
  - Bold: `{ maxHp: 40, damagePct: -0.1 }`
  - Hasty: `{ cooldownPct: 0.15, maxHp: -20 }`
  - Vitality: `{ maxHp: 20 }`, uncapped
  - Magnet: `{ pickupPct: 0.25 }`, uncapped
- [ ] Run `npm run typecheck`. Expected: errors at each old boost id use; fix them in Tasks 2–4.

### Task 2: Types + stats clamp
- [ ] Add the Card variant, `World.techniques: { id: TechniqueId; rank: number }[]` and the `World.tech` fields:
  - `rollout: number` (seconds moving)
  - `moxie: number` (stack)
  - `endureLeft: number`
  - `rageLeft: number`
  - `focusLeft: number`
  - `brawlerBudget: number`
  - `procDepth: number` (> 0 while a Technique effect resolves)
- [ ] Add `MoveSlot.focusReady` and `Enemy.techMarked?`.
- [ ] Add the clamps in `computeModifiers` and `refreshStats`.

### Task 3: Sim behaviour, `src/sim/techniques.ts`
- [ ] **Rollout:** `tech.rollout += dt` while `player.movingFor > 0`, otherwise 0. `fire()` multiplies damage by `1 + v` when `tech.rollout >= 2`, then resets it to 0 after a successful cast.
- [ ] **Moxie:** on a kill (not from a Technique), `moxie = min(cap, moxie + 0.01)`. A landed player hit resets it. It is a damage mult on every hit.
- [ ] **Endure:**
  - in `hitPlayer` and `drainPlayer`, before fainting: if Endure is owned and `endureLeft <= 0`, set hp = 1, `invulnLeft = 1`, `endureLeft = cooldown`, and do not faint
  - `endureLeft` ticks down in `updateTechniques`
- [ ] **Rage:** a landed hit sets `rageLeft = 3`. While it runs, `cooldownRate = 1 / (1 − v)`.
- [ ] **Pickup:** on gem collect, `rng < v` heals 5 HP. RNG is consumed only when Pickup is owned.
- [ ] **Focus Energy:** `focusLeft` counts down; at 0 every slot gets `focusReady = true` and the timer resets to v. A move's own hit with `focusReady` is a forced crit at ×2 and clears the flag.
- [ ] **Kindling, Spore Cloud, Frostbite (on kill):**
  - they run only when `procDepth === 0` and the dead enemy is not `techMarked`
  - Kindling: if the enemy was burning, burn the v nearest enemies within 120 px with its `burnDps`, and mark them
  - Spore Cloud: if it was poisoned, poison the enemies within the v-px radius with its `poisonDps`, and mark them
  - Frostbite: if it was slowed, deal `dealt × v` as a typeless proc hit to the enemies within 60 px, inside `procDepth++`
- [ ] **Riptide and Brawler (on hit, the move's own hits only):**
  - Riptide: Water hits call `applySlow(enemy, v, 2)`
  - Brawler: Melee/Contact hits heal `min(1, brawlerBudget)`; the budget refills by `v`/s, capped at v
- [ ] **Static Field and Sharpshooter (damage mult):**
  - Static Field: × (1 + v) when the target is paralysed
  - Sharpshooter: × (1 + v) when the move has the Projectile tag and the target is more than 300 px from the player

### Task 4: Progression
- [ ] `techniquePool(world)`:
  - rank-ups for owned Techniques below III
  - new eligible Techniques while fewer than 5 are owned
- [ ] Natures are offered while picks < `maxPicks`. Filler is appended only when the pool has fewer than 3 cards.
- [ ] `makeOffer`: draw 1 Technique first when any is available, then the rest, then shuffle.
- [ ] `applyCard`: rank up, or push a new Technique at rank 1.

### Task 5: Tests, `src/sim/techniques.test.ts`
- [ ] **Pool:**
  - tag gating (Kindling needs a Fire move)
  - slot cap (5 owned → only rank-ups)
  - ≥ 1 Technique in every offer while available
  - Nature cap of 3; filler only when the pool is short
- [ ] **Techniques:**
  - Rollout: next cast ×1.4 after 2 s of moving, then reset
  - Moxie: stacks to the cap and resets on a hit
  - Endure: saves once, the cooldown blocks a second save; no trigger on a non-lethal hit; also covers poison drain
  - Rage: cooldowns tick faster for 3 s
  - Pickup: heals with a seeded roll
  - Focus Energy: a ×2 forced crit once per timer
  - Kindling: spreads to N enemies, and a marked enemy's death spreads nothing
  - Spore Cloud: radius poison
  - Frostbite: splash on a slowed kill, and the splash kills trigger nothing
  - Riptide: slows on Water hits
  - Brawler: heal capped per second
  - Static Field and Sharpshooter: damage mults
- [ ] **Natures:** Brave adds damage and lowers speed; stacking Bold ×3 + Timid ×3 still leaves damage ≥ 0.5.
- [ ] **Snapshot:** round-trip with Techniques.
- [ ] Update the existing tests that use the old boost ids.
- [ ] Run `npm test`. Expected: all pass.

### Task 6: UI
- [ ] Card view:
  - `'technique'`: heading TECHNIQUE (or "TECHNIQUE · TYPE" for a tag-linked one), title `Name I/II/III`, body is that rank's description
  - `'boost'`: heading NATURE for natures, BOOST for filler
- [ ] Build panel: a "Techniques: Moxie II, Endure I" line.
- [ ] HUD: a one-line Technique row under the existing HUD text.

### Task 7: Verify and record
- [ ] Run `npm run typecheck`, `npm test`, `npm run build` and `npm run balance` (record the pacing).
- [ ] Browser check: Technique and Nature cards render, picking one works, the HUD row shows, no console errors.
- [ ] Add a `PROJECT_STATUS.md` entry and update PROJECT.md §8.3 (D40 built).
- [ ] Commit.
