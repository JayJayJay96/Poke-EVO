# Enemy roster (D27)

Species sheets that follow the rules in [`README.md`](README.md). Every number is provisional (formulas in README §6–§7,
tuned with `npm run balance`). **(now)** = today's value in `src/data/content.ts`, for comparison.

Covered so far: the 6 enemies in the game today. The full roster (Caterpie, Weedle, Geodude, Voltorb, Chansey, Abra,
Snorlax, the three birds, Mewtwo, and the type counters per wave window) is the next task.

---

## Summary
| Species | Types | Role | Normal HP | Normal contact | Speed | Normal XP | Elite HP | Elite contact | Elite XP | Ability (Elite only) |
|---|---|---|---|---|---|---|---|---|---|---|
| Rattata | Normal | fodder | 20 (20) | 10 (10) | 81 (75) | 1 (1) | 120 | 13 | 6 | Run Away |
| Pidgey | Normal/Flying | fast | 23 (12) | 8 (8) | 123 (115) | 1 (1) | 138 | 10 | 6 | Tangled Feet |
| Spearow | Normal/Flying | fast | 21 (22) | 11 (13) | 127 (120) | 1 (3) | 126 | 14 | 6 | Sniper |
| Raticate | Normal | tank | 36 (70) | 15 (16) | 59 (62) | 3 (6) | 216 | 20 | 17 | Guts |
| Fearow | Normal/Flying | fast | 38 (75) | 16 (24) | 133 (120) | 3 (12) | 228 | 21 | 19 | Keen Eye |
| Tauros | Normal | bruiser | 47 (180) | 18 (32) | 90 (88) | 3 (22) | 282 | 23 | 21 | Anger Point |

Before wave scaling. Every species currently pays less XP than now and the evolved ones have less HP than now. The
global HP and XP factors (README §6.1) are tuned in the balance pass, so read the columns as **ratios between
species**, not final values.

## Shared defence rows
Two type profiles cover all 6 enemies, so the rows are listed once.

### Normal (Rattata, Raticate, Tauros)
- **Damage taken from player move types:** every type ×1. Normal has no weakness or resistance among the player's
  types (Fighting ×2 and Ghost ×0.5 matter only once those moves exist).
- **Status:** every status ×1.

### Normal/Flying (Pidgey, Spearow, Fearow)
- **Damage taken:** **Electric ×2, Ice ×2**, **Grass ×0.5**, all others ×1.

| Status | × | Why |
|---|---|---|
| Paralysis | **1.5** | Electric is super effective on Flying |
| Freeze *(future)* | **1.5** | Ice is super effective on Flying |
| Leech Seed | 0.5 | Grass is not very effective on Flying |
| Powder statuses (Sleep Powder, Poison Powder) | 0.5 | The Grass row, on top of the status's own row |
| Slow | 0.5 | Airborne (§3.2) |
| Trap / Bound / slip / drag | 0.5 | Airborne (§3.2) |
| Ground effects (Puddle Soaked, Scorch, root fields) | 0.5 | Grounded rule (§3.3) |
| Burn, poison, sleep, Soaked (not from a puddle), Blinded, weaken | 1 | No chart or lore reason |

---

## Rattata
| | |
|---|---|
| **Types** | Normal |
| **Role** | fodder (75–90 band; base Speed 72) |
| **Official base** | HP 30 · Atk 56 · Def 35 · SpA 25 · SpD 35 · Spe 72 · exp 51 · 0.3 m · 3.5 kg |
| **Normal** | HP 20 · contact 10 · speed 81 · XP 1 · radius 10 · knockback resist 12% |
| **Elite** | HP 120 · contact 13 · speed 81 · XP 6 · radius 13 · half stagger |
| **Defence** | Normal row |
| **Attack** (README §9) | Chaser: contact only. No player status |
| **Ability: Run Away** *(reaction)* | The first time the Elite drops below 30% HP, it sprints away from the player at ×1.5 speed for 3 s, then turns back. Lore: it flees wild battles. It punishes slow melee builds, while DoT keeps ticking on it |
| **Horde** | `leader` Elite Rattata · `followers` Rattata · `hordeSpeed` 81 |

## Pidgey
| | |
|---|---|
| **Types** | Normal/Flying |
| **Role** | fast (115–145 band; base Speed 56) |
| **Official base** | HP 40 · Atk 45 · Def 40 · SpA 35 · SpD 35 · Spe 56 · exp 50 · 0.3 m · 1.8 kg |
| **Normal** | HP 23 · contact 8 · speed 123 · XP 1 · radius 10 · knockback resist 7% |
| **Elite** | HP 138 · contact 10 · speed 123 · XP 6 · radius 13 · half stagger |
| **Defence** | Normal/Flying row |
| **Attack** (README §9) | Chaser (flanker): contact only. No player status |
| **Ability: Tangled Feet** *(reaction)* | While slowed, trapped or confused, the Elite takes ×0.7 hit damage. Lore: it gets evasive when its footing is disrupted. It counters crowd-control builds |
| **Horde** | `leader` Elite Pidgey · `followers` Pidgey · `hordeSpeed` 123 |

## Spearow
| | |
|---|---|
| **Types** | Normal/Flying |
| **Role** | fast (115–145 band; base Speed 70). PROJECT.md §9 plans Spearow as the **ranged** archetype; when that behaviour is built in P5, its band becomes ranged (65–80 → 71 px/s) |
| **Official base** | HP 40 · Atk 60 · Def 30 · SpA 31 · SpD 31 · Spe 70 · exp 52 · 0.3 m · 2.0 kg |
| **Normal** | HP 21 · contact 11 · speed 127 · XP 1 · radius 10 · knockback resist 7% |
| **Elite** | HP 126 · contact 14 · speed 127 · XP 6 · radius 13 · half stagger |
| **Defence** | Normal/Flying row |
| **Attack** (README §9) | Today: chaser (flanker). P5: **Ranged**, a Peck dart (line telegraph 0.4 s, damage ×0.8 contact, cooldown 3 s) fired from 220–320 px. No player status |
| **Ability: Sniper** *(reaction)* | The Elite's hits on a player below 50% HP deal ×1.5. Lore: its critical hits hit harder. It punishes low-HP play such as Blaze |
| **Horde** | `leader` Elite Spearow · `followers` Spearow · `hordeSpeed` 127 |

## Raticate
| | |
|---|---|
| **Types** | Normal |
| **Role** | tank (50–65 band; base Speed 97). Keeps today's slow, tanky Raticate (D9); owner-approved 2026-10-21 |
| **Official base** | HP 55 · Atk 81 · Def 60 · SpA 50 · SpD 70 · Spe 97 · exp 145 · 0.7 m · 18.5 kg |
| **Normal** | HP 36 · contact 15 · speed 59 · XP 3 · radius 13 · knockback resist 43% |
| **Elite** | HP 216 · contact 20 · speed 59 · XP 17 · radius 17 · half stagger. The §7 4:00 elite with the chest is an **Elite Raticate** |
| **Defence** | Normal row |
| **Attack** (README §9) | Chaser: contact only. No player status |
| **Ability: Guts** *(reaction)* | While burned, poisoned or paralysed, the Elite deals ×1.5 contact damage. It punishes DoT and paralysis builds |
| **Horde** | `leader` Elite Raticate · `followers` Raticate, Rattata · `hordeSpeed` 59 |

## Fearow
| | |
|---|---|
| **Types** | Normal/Flying |
| **Role** | fast (115–145 band; base Speed 100) |
| **Official base** | HP 65 · Atk 90 · Def 65 · SpA 61 · SpD 61 · Spe 100 · exp 155 · 1.2 m · 38 kg |
| **Normal** | HP 38 · contact 16 · speed 133 · XP 3 · radius 16 · knockback resist 60% |
| **Elite** | HP 228 · contact 21 · speed 133 · XP 19 · radius 21 · half stagger |
| **Defence** | Normal/Flying row |
| **Attack** (README §9) | Flanker plus **Diver** (P5): Drill Peck, ring telegraph 0.8 s on the player, damage ×1.5 contact, cooldown 6 s. No player status |
| **Ability: Keen Eye** *(status resistance)* | The Elite takes Blinded ×0.25. Lore: its accuracy can't be lowered |
| **Horde** | `leader` Elite Fearow · `followers` Fearow, Spearow · `hordeSpeed` 127 |

## Tauros
| | |
|---|---|
| **Types** | Normal |
| **Role** | bruiser (80–95 band; base Speed 110) |
| **Official base** | HP 75 · Atk 100 · Def 95 · SpA 40 · SpD 70 · Spe 110 · exp 172 · 1.4 m · 88.4 kg |
| **Normal** | HP 47 · contact 18 · speed 90 · XP 3 · radius 17 · knockback resist 78% |
| **Elite** | HP 282 · contact 23 · speed 90 · XP 21 · radius 23 · half stagger |
| **Defence** | Normal row |
| **Attack** (README §9) | **Bruiser** (P5): Take Down charge, line telegraph 0.7 s, dashes ~250 px at ×3 speed (a burst), damage ×1.5 contact, cooldown 5 s. No player status |
| **Ability: Anger Point** *(reaction)* | A critical hit on the Elite enrages it: ×1.5 contact damage for 4 s. It punishes crit builds |
| **Horde** | `leader` Elite Tauros · `followers` Tauros · `hordeSpeed` 90 |

---

## Notes for the implementer (after approval)
- `EnemyDef` gains: `role`, `ability`, the official `base` stats (so the formulas live in one function, not in
  hand-typed numbers), and a `statusResist` row derived from `types` plus the ability. Elite is a **variant flag on a
  spawned enemy**, not a separate `EnemyId`, so any species can be an Elite.
- `MAX_ENEMY_RADIUS` (`src/sim/combat.ts:8`) is taken from `ENEMIES`. It must include the Elite radius (×1.35), or
  hit queries on large Elites will miss.
- Speed tests (README §6.2): the fastest **horde-body** band (110) × the final speed scale stays below the slowest
  starter stage (142), and the flanker band max (145) × the final scale (167) stays below the fastest final stage
  (Raichu 175). Bursts (Run Away, charges, dives) are exempt but must be telegraphed.
- The Normal/Flying rows say Normal/Flying enemies take ×0.5 from ground effects. Diving enemies count as airborne
  during the dive.
