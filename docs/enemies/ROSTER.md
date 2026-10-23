# Enemy roster (D27)

Species sheets that follow the rules in [`README.md`](README.md). Every number is provisional (formulas in README §6–§7,
tuned with `npm run balance`). **(now)** = today's value in `src/data/content.ts`, for comparison.

Covered so far: the 6 enemies in the game today, plus **batch 2** (10 new species, 2026-10-21): Caterpie, Weedle,
Zubat, Oddish, Psyduck, Geodude, Gastly, Abra, Voltorb, Chansey. Bosses (Snorlax, the three birds,
Mewtwo) live in [`BOSSES.md`](BOSSES.md).

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
| **Attack** (README §9) | Today: chaser (flanker). P5: **Ranged**, a Peck dart (line telegraph 0.6 s, damage ×0.8 contact, cooldown 3 s) fired from 220–320 px. No player status |
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
| **Attack** (README §9) | Flanker plus **Diver** (P5): Drill Peck, ring telegraph 1 s on the player (38 px), damage ×1.5 contact, cooldown 6 s. No player status |
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
| **Attack** (README §9) | **Bruiser** (P5): Take Down charge, line telegraph 0.9 s, dashes ~250 px at ×3 speed (a burst), damage ×1.5 contact, cooldown 5 s. No player status |
| **Ability: Anger Point** *(reaction)* | A critical hit on the Elite enrages it: ×1.5 contact damage for 4 s. It punishes crit builds |
| **Horde** | `leader` Elite Tauros · `followers` Tauros · `hordeSpeed` 90 |

---

# Batch 2 (2026-10-21; **built 2026-10-23, D37**)
In the game: the stats below (`content.ts`), the types and type-chart rows (`typeChart.ts`), the wave mix by tier
(`waves.ts`), the attacks (`enemyAttacks.ts`), the Elite abilities and horde lines (`hordes.ts`). One gap:
**Gastly's Levitate** is named but not built, because it needs the shared terrain code. Rollout rolls straight,
because the map has no walls to bounce off.
Chosen so **every starter element meets a counter** and every §9 archetype has an example:

| Player element | Resisted by (batch 2) | Weak (batch 2) |
|---|---|---|
| Fire | Psyduck, Geodude (×0.5) | Caterpie, Weedle, Oddish (×2) |
| Water | Oddish, Psyduck (×0.5) | Geodude (×4) |
| Grass | Weedle, Zubat, Oddish (×0.25); Caterpie, Gastly (×0.5) | Psyduck (×2), Geodude (×4) |
| Electric | Oddish, Voltorb, Geodude (×0.5, immunity softened) | Zubat, Psyduck (×2) |
| Ice | Psyduck (×0.5) | Zubat, Oddish, Geodude (×2) |

**XP is shown with one decimal** (raw `base exp ÷ 50`) so the ratios stay visible; the global XP factor rounds it later.

## Type chart additions (needed for batch 2)
The rows the player's move types need against the new defender types (modern chart; immunities → ×0.5, D14):

| Attack ↓ / Defender → | Bug | Rock | Ground | Ghost | Psychic |
|---|---|---|---|---|---|
| Normal | 1 | 0.5 | 1 | **0.5** (immune) | 1 |
| Fire | 2 | 0.5 | 1 | 1 | 1 |
| Water | 1 | 2 | 2 | 1 | 1 |
| Grass | 0.5 | 2 | 2 | 1 | 1 |
| Electric | 1 | 1 | **0.5** (immune) | 1 | 1 |
| Ice | 1 | 1 | 2 | 1 | 1 |
| Poison | 1 | 0.5 | 0.5 | 0.5 | 1 |
| Flying | 2 | 0.5 | 1 | 1 | 1 |
| Dragon | 1 | 1 | 1 | 1 | 1 |
| Dark | 1 | 1 | 1 | 2 | 2 |
| Steel | 1 | 2 | 1 | 1 | 1 |

## Caterpie
| | |
|---|---|
| **Types** | Bug |
| **Role** | fodder (75–90; base Speed 45) |
| **Official base** | HP 45 · Atk 30 · Def 35 · SpA 20 · SpD 20 · Spe 45 · exp 39 · 0.3 m · 2.9 kg |
| **Normal** | HP 22 · contact 5 · speed 78 · XP 0.8 · radius 10 · knockback resist 10% |
| **Elite** | HP 132 · contact 7 · speed 78 · XP 4.7 · radius 14 · half stagger |
| **Damage taken** | **Fire ×2, Flying ×2**; Grass ×0.5; others ×1 |
| **Status** | Burn **1.5** · Leech Seed / powders 0.5 · all others 1 |
| **Attack** | **Web layer:** spits String Shot at you (line telegraph 0.7 s, cooldown 6 s). It lands as a 34 px web patch for 5 s. **Player status: slow** while standing in the web (+1 s after) |
| **Ability: Shield Dust** *(status resistance)* | Statuses that come **from a damaging hit** (Ember's burn, Thunder Shock's paralysis…) land ×0.25 on the Elite. Statuses from status moves and zones (Sleep Powder, Poison Powder, Smokescreen, Scorch) land normally. Lore: it blocks moves' added effects |
| **Horde** | `leader` Elite Caterpie · `followers` Caterpie · `hordeSpeed` 78 |

## Weedle
| | |
|---|---|
| **Types** | Bug/Poison |
| **Role** | fodder (75–90; base Speed 50) |
| **Official base** | HP 40 · Atk 35 · Def 30 · SpA 20 · SpD 20 · Spe 50 · exp 39 · 0.3 m · 3.2 kg |
| **Normal** | HP 20 · contact 6 · speed 78 · XP 0.8 · radius 10 · knockback resist 11% |
| **Elite** | HP 120 · contact 8 · speed 78 · XP 4.7 · radius 14 · half stagger |
| **Damage taken** | **Fire ×2, Flying ×2**; Poison ×0.5; **Grass ×0.25**; others ×1 |
| **Status** | Burn **1.5** · poison **0.25** (Poison type) · Leech Seed / powders **0.25** · all others 1 |
| **Attack** | Chaser. **Poison Sting:** its contact hit **poisons the player** (3 s) |
| **Ability: Run Away** *(reaction)* | As Rattata: the first time it drops below 30% HP, it sprints away at ×1.5 speed for 3 s, then turns back |
| **Horde** | `leader` Elite Weedle · `followers` Weedle · `hordeSpeed` 78 |

## Zubat
| | |
|---|---|
| **Types** | Poison/Flying |
| **Role** | fast (115–145; base Speed 55) |
| **Official base** | HP 40 · Atk 45 · Def 35 · SpA 30 · SpD 40 · Spe 55 · exp 49 · 0.8 m · 7.5 kg |
| **Normal** | HP 23 · contact 8 · speed 123 · XP 1.0 · radius 13 · knockback resist 23% |
| **Elite** | HP 138 · contact 10 · speed 123 · XP 5.9 · radius 18 · half stagger |
| **Damage taken** | **Electric ×2, Ice ×2**; Poison ×0.5; **Grass ×0.25**; others ×1 |
| **Status** | Paralysis **1.5** · freeze **1.5** · poison **0.25** · Leech Seed / powders **0.25** · slow 0.5 · trap 0.5 · ground effects 0.5 · all others 1 |
| **Attack** | Flanker that flies in a weaving line. **Supersonic:** cone telegraph 0.7 s (90°, 102 px, cooldown 6 s), no damage, **player status: confusion** (2 s) |
| **Ability: Infiltrator** *(reaction)* | The Elite's hits **go through Squirtle's Shell** (they're not blocked, and they don't use up the block). Lore: it slips past barriers and Substitute |
| **Horde** | `leader` Elite Zubat · `followers` Zubat · `hordeSpeed` 123 |

## Oddish
| | |
|---|---|
| **Types** | Grass/Poison |
| **Role** | fodder (75–90; base Speed 30) |
| **Official base** | HP 45 · Atk 50 · Def 55 · SpA 75 · SpD 65 · Spe 30 · exp 64 · 0.5 m · 5.4 kg |
| **Normal** | HP 32 · contact 14 · speed 76 · XP 1.3 · radius 11 · knockback resist 18% |
| **Elite** | HP 192 · contact 18 · speed 76 · XP 7.7 · radius 15 · half stagger |
| **Damage taken** | **Fire ×2, Ice ×2, Flying ×2**; Water ×0.5, Electric ×0.5; **Grass ×0.25**; others ×1 |
| **Status** | Burn **1.5** · freeze **1.5** · paralysis 0.5 · poison **0.25** · Leech Seed / powders **0.25** · Soaked 0.5 · all others 1 |
| **Attack** | **Poison Powder:** every 5 s it puffs a cloud around itself (ring telegraph 1 s, 51 px). **Player status: poison** (3 s). It's a powder, so a Grass player takes ×0.25 (Bulbasaur line) |
| **Ability: Run Away** *(reaction)* | As Rattata (Oddish's other ability, Chlorophyll, needs sun; weather is out of MVP) |
| **Horde** | `leader` Elite Oddish · `followers` Oddish · `hordeSpeed` 76 |

## Psyduck
| | |
|---|---|
| **Types** | Water |
| **Role** | ranged (65–80; base Speed 55) |
| **Official base** | HP 50 · Atk 52 · Def 48 · SpA 65 · SpD 50 · Spe 55 · exp 64 · 0.8 m · 19.6 kg |
| **Normal** | HP 30 · contact 12 · speed 69 · XP 1.3 · radius 13 · knockback resist 44% |
| **Elite** | HP 180 · contact 16 · speed 69 · XP 7.7 · radius 18 · half stagger |
| **Damage taken** | **Electric ×2, Grass ×2**; Fire, Water, Ice, Steel ×0.5; others ×1 |
| **Status** | Burn 0.5 · freeze 0.5 · paralysis **1.5** · Leech Seed / powders **1.5** · Soaked **0.25** · all others 1 |
| **Attack** | **Ranged:** holds 220–320 px from you and fires **Water Gun** (line telegraph 0.6 s, damage ×0.8 contact, cooldown 3 s). **Player status: Soaked** (2 s) |
| **Ability: Swift Swim** *(reaction)* | The Elite moves ×1.5 while standing in a Puddle (puddles stand in for rain; weather is out of MVP). It punishes Squirtle-line puddle builds |
| **Horde** | `leader` Elite Psyduck · `followers` Psyduck · `hordeSpeed` 69 |

## Geodude
| | |
|---|---|
| **Types** | Rock/Ground |
| **Role** | tank (50–65; base Speed 20) |
| **Official base** | HP 40 · Atk 80 · Def 100 · SpA 30 · SpD 30 · Spe 20 · exp 60 · 0.4 m · 20 kg |
| **Normal** | HP 32 · contact 14 · speed 50 · XP 1.2 · radius 11 · knockback resist 44% |
| **Elite** | HP 192 · contact 18 · speed 50 · XP 7.2 · radius 15 · half stagger |
| **Damage taken** | **Water ×4, Grass ×4**, Ice ×2, Steel ×2; Normal, Fire, Flying, Electric ×0.5; **Poison ×0.25**; Dragon, Dark ×1 |
| **Status** | Burn 0.5 · freeze **1.5** · paralysis **0.25** (Ground) · poison **0.25** · Leech Seed / powders **1.5** · Soaked **1.5** · all others 1 |
| **Attack** | **Roller:** Rollout, line telegraph 0.8 s, rolls up to 300 px at ×4 speed (a burst), bounces off obstacles up to 3 times (faster each time), damage ×1.5 contact, cooldown 6 s. Can't be staggered while rolling. No player status |
| **Ability: Sturdy** *(reaction)* | Once per life, a hit that would kill the Elite leaves it at 1 HP. Lore: it endures one KO hit. It blunts a single big nuke (Blast Burn, Solar Beam), while DoT and fast hits finish it |
| **Horde** | `leader` Elite Geodude · `followers` Geodude · `hordeSpeed` 50 |

## Gastly
| | |
|---|---|
| **Types** | Ghost/Poison |
| **Role** | fodder (75–90; base Speed 80) |
| **Official base** | HP 30 · Atk 35 · Def 30 · SpA 100 · SpD 35 · Spe 80 · exp 62 · 1.3 m · 0.1 kg |
| **Normal** | HP 19 · contact 18 · speed 82 · XP 1.2 · radius 16 · knockback resist 0% |
| **Elite** | HP 114 · contact 23 · speed 82 · XP 7.4 · radius 22 · half stagger |
| **Damage taken** | **Dark ×2**; Normal ×0.5 (immune), Grass ×0.5; **Poison ×0.25**; others ×1 |
| **Status** | Poison **0.25** · sleep 0.5 (Ghost) · trap / slip / drag **0.25** (Ghost) · Leech Seed / powders 0.5 · all others 1 |
| **Attack** | **Phaser:** drifts **through** other enemies (it ignores the push-apart force) and flickers. It can always be hit. **Lick:** its contact hit **paralyses the player** (2 s) |
| **Ability: Levitate** *(status resistance)* | The Elite takes ground effects (Puddle Soaked, Scorch, root fields, slip) at ×0.25. Lore: it ignores Ground and terrain |
| **Horde** | `leader` Elite Gastly · `followers` Gastly · `hordeSpeed` 82 |

## Abra
| | |
|---|---|
| **Types** | Psychic |
| **Role** | teleporter (55–70; base Speed 90) |
| **Official base** | HP 25 · Atk 20 · Def 15 · SpA 105 · SpD 55 · Spe 90 · exp 62 · 0.9 m · 19.5 kg |
| **Normal** | HP 18 · contact 19 · speed 63 · XP 1.2 · radius 14 · knockback resist 44% |
| **Elite** | HP 108 · contact 25 · speed 63 · XP 7.4 · radius 19 · half stagger |
| **Damage taken** | **Dark ×2**; others ×1 |
| **Status** | Sleep 0.5 · confusion 0.5 · all others 1 |
| **Attack** | **Teleporter:** every 4 s it blinks to a spot 150–220 px **ahead of where you're walking** (inside the screen; near you if you stand still). A ring marks the landing spot 0.6 s before it appears. On landing it releases a **Confusion pulse** (60 px, damage ×0.6 contact). **Player status: confusion** (2 s) |
| **Ability: Synchronize** *(reaction)* | When the player burns, poisons or paralyses the Elite, the **player gets the same status** (the soft player version, §10). Lore: Synchronize passes exactly these three back. Sleep, slow and the rest don't sync |
| **Horde** | `leader` Elite Abra · `followers` Abra · `hordeSpeed` 63 |

## Voltorb
| | |
|---|---|
| **Types** | Electric |
| **Role** | exploder (95–110; base Speed 100) |
| **Official base** | HP 40 · Atk 30 · Def 50 · SpA 55 · SpD 55 · Spe 100 · exp 66 · 0.5 m · 10.4 kg |
| **Normal** | HP 28 · contact 10 · speed 104 · XP 1.3 · radius 11 · knockback resist 29% |
| **Elite** | HP 168 · contact 13 · speed 104 · XP 7.9 · radius 15 · half stagger |
| **Damage taken** | Electric, Flying, Steel ×0.5; others ×1 |
| **Status** | Paralysis **0.25** · all others 1 |
| **Attack** | **Exploder:** within ~60 px it stops and **fuses for 1.2 s** (ring telegraph), then Self-Destructs (60 px, damage ×3 contact). **Killing it during the fuse defuses it.** It can't be stunned during the fuse. A Voltorb that self-destructs drops **no XP** (lore: no exp for a self-KO). No player status |
| **Ability: Aftermath** *(reaction)* | When the Elite is killed, it leaves a 0.6 s ring and then explodes anyway (70 px, ×2 contact). Kill it from range |
| **Horde** | `leader` Elite Voltorb · `followers` Voltorb · `hordeSpeed` 104 |

## Chansey
| | |
|---|---|
| **Types** | Normal |
| **Role** | healer (60–75; base Speed 50) |
| **Official base** | HP 250 · Atk 5 · Def 5 · SpA 35 · SpD 105 · Spe 50 · exp 395 · 1.1 m · 34.6 kg |
| **Normal** | HP 92 · contact 6 · speed 63 · XP 7.9 · radius 15 · knockback resist 58% |
| **Elite** | HP 552 · contact 8 · speed 63 · XP 47.4 · radius 20 · half stagger |
| **Damage taken** | Normal row (every player type ×1) |
| **Status** | Every status ×1 |
| **Attack** | **Healer:** keeps 200–300 px from you, behind other enemies. Every 5 s, **Soft-Boiled**: a green ring telegraph 0.8 s, then it heals every enemy within 140 px by 15% of their max HP (not itself). No player status. A rare, high-XP priority target. *(Idea: a higher berry drop chance; lore: Chansey's eggs heal)* |
| **Ability: Healer** *(reaction)* | The Elite's Soft-Boiled also **clears statuses** from the enemies it heals (DoT, slow, stuns). It counters DoT and crowd-control builds |
| **Horde** | **None: healers never join horde events** (owner, 2026-10-21). Elite Chansey can still spawn on its own |

---

# Spawn data (for the game logic designer, see README §11)
**Tier** groups species of similar strength, so the spawn director can swap one for another without changing the
difficulty. **Threat** is a first rough estimate: `HP × contact ÷ 100 × speed ÷ 80` (Normal variant, before wave
scaling). Attacks and statuses aren't priced yet; the balance bot will measure real threat once P5 behaviours exist.

| Tier | Species (threat) |
|---|---|
| **1: early fodder** | Caterpie (1.1), Weedle (1.2), Rattata (2.0), Pidgey (2.8), Zubat (2.8) |
| **2: mid** | Abra (2.7), Geodude (2.8), Psyduck (3.1), Gastly (3.5), Voltorb (3.6), Spearow (3.7), Raticate (4.0), Oddish (4.3) |
| **2: support** (not counted as a body; capped per screen) | Chansey (4.4) |
| **3: late** | Tauros (9.5), Fearow (10.1) |

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

---

# Batch 3 (DRAFT for owner approval, 2026-10-23; design only, nothing built)
The owner asked overnight for "the next 10 enemies with their respective roles". These fill four gaps:
- the attack styles no species uses yet: burrower, roller, barrier, splitter (README §9.2)
- new defender types: Fighting, Fairy, Dragon
- the boss adds that don't exist yet: **Seel** (Articuno), **Ponyta** (Moltres), **Magnemite** (Zapdos)
- more late-game threat (tier 3 had only Tauros and Fearow)

Stats use the D27 formulas (README §6.1), speed comes from the role band (§6.2), and every number is provisional.
Healers never join hordes; every other species leads its own line.

## Summary
| Species | Types | Role / style | HP | Contact | Speed | XP | Tier (threat) | Elite ability |
|---|---|---|---|---|---|---|---|---|
| Diglett | Ground | fodder · **burrower** | 14 | 10 | 84 | 1.1 | 1 (1.5) | Arena Trap |
| Seel | Water | tank · Icy Wind cone | 38 | 8 | 53 | 1.3 | 1 (2.0) | Thick Fat |
| Koffing | Poison | tank · **zoner** (Smog clouds) | 33 | 12 | 52 | 1.4 | 1 (2.6) | Neutralizing Gas |
| Magnemite | Electric/Steel | ranged · paralysing darts | 26 | 17 | 68 | 1.3 | 2 (3.8) | Magnet Pull |
| Exeggcute | Grass/Psychic | fodder · **splitter** | 37 | 11 | 77 | 1.3 | 2 (3.9) | Harvest |
| Sandshrew | Ground | bruiser · **roller** (Rollout ×3) | 32 | 14 | 82 | 1.2 | 2 (4.6) | Sand Veil |
| Machop | Fighting | bruiser · **combo** (Karate Chop ×3) | 34 | 14 | 82 | 1.2 | 2 (4.9) | No Guard |
| Dratini | Dragon | fast · rare **Dragon Rage** sniper | 27 | 12 | 122 | 1.2 | 2 (4.9), rare | Marvel Scale |
| Mr. Mime | Psychic/Fairy | ranged · **barrier** | 40 | 18 | 73 | 3.2 | 3 (6.6) | Filter |
| Ponyta | Fire | fast · **flame trail** | 33 | 15 | 131 | 1.6 | 3 (8.1) | Flash Fire |

## Counters to each starter (batch 3)
| Your type | Resisted by | Weak |
|---|---|---|
| Fire | Ponyta, Seel, Dratini, Mr. Mime (×0.5) | Magnemite, Exeggcute (×2) |
| Water | Seel, Dratini, Exeggcute (×0.5) | Diglett, Sandshrew, Ponyta (×2) |
| Grass | Koffing, Ponyta, Magnemite, Dratini, Exeggcute (×0.5) | Diglett, Sandshrew, Seel (×2) |
| Electric | Diglett, Sandshrew (×0.5, immunity softened), Magnemite, Dratini, Exeggcute (×0.5) | Seel (×2) |
| Ice | Ponyta, Seel, Magnemite (×0.5) | Diglett, Sandshrew, Exeggcute, Dratini (×2) |

**Dratini** resists Fire, Water, Grass and Electric: it's the rare "you can't one-element this" enemy. Only Ice and
Dragon hit it hard.

## Type-chart additions needed (Fighting and Fairy defenders)
| Attack | vs Fighting | vs Fairy |
|---|---|---|
| Flying | 2 | 1 |
| Poison | 1 | 2 |
| Steel | 1 | 2 |
| Fire | 1 | 0.5 |
| Dark | 0.5 | 0.5 |
| Dragon | 1 | **0.5** (immune) |
| others | 1 | 1 |

## Sheets
**Diglett** · Ground · fodder band (base Speed 95) · HP 10/Atk 55/Def 25/SpA 35/SpD 45, exp 53, 0.2 m, 0.8 kg
- **Attack: Burrower.** It digs in (can't be hit; a dirt trail shows its path) and pops up under you. Ring 0.6 s, ×1.2 contact, cooldown 5 s.
- **Defence:** Water, Grass, Ice ×2; Electric ×0.5 (immune), Poison ×0.5. Status: paralysis 0.25, poison 0.5, Leech Seed and Soaked 1.5, freeze 1.5.
- **Elite, Arena Trap:** within 150 px of it you move 20% slower (lore: you can't flee). The slow is drawn as a ring.

**Seel** · Water · tank band (Speed 45) · HP 65/Atk 45/Def 55/SpA 45/SpD 70, exp 65, 1.1 m, 90 kg
- **Attack: Icy Wind.** A cone (0.6 s, 100°, 140 px) that slows you 2 s. Lapras resists it ×0.25.
- **Defence:** Electric, Grass ×2; Fire, Water, Ice, Steel ×0.5. Status: Soaked 0.25, paralysis and Leech Seed 1.5, burn and freeze 0.5.
- **Elite, Thick Fat:** Fire and Ice hits ×0.5, burn ×0.5.
- **Articuno's adds** (BOSSES.md).

**Koffing** · Poison · tank band (Speed 35) · HP 40/Atk 65/Def 95/SpA 60/SpD 45, exp 68, 0.6 m, 1 kg
- **Attack: Zoner.** It floats slowly; every 5 s it exhales a **Smog** cloud (70 px, 4 s; ring 0.6 s first). Standing in it poisons you. Max 6 clouds.
- **Defence:** Grass ×0.5, Poison ×0.5. Status: poison 0.25, Leech Seed 0.5.
- **Elite, Neutralizing Gas** (Gen 8): inside its clouds **your ability is switched off** (Blaze, Shell, Static, Leech…). A hard counter to ability-reliant play, so it's flagged for owner approval.

**Magnemite** · Electric/Steel · ranged band (Speed 45) · HP 25/Atk 35/Def 70/SpA 95/SpD 55, exp 65, 0.3 m, 6 kg
- **Attack: Ranged Thunder Shock darts** (line 0.4 s, ×0.8 contact, cooldown 3 s) that **paralyse**.
- **Defence:** Fire ×2; Grass, Electric, Ice, Normal, Dragon ×0.5, Poison ×0.5 (immune); Flying, Steel ×0.25. Status: paralysis and poison 0.25, burn 1.5, freeze 0.5, Leech Seed 0.25, weaken 0.5.
- **Elite, Magnet Pull:** within 220 px it pulls you toward it at 25 px/s, shown as field lines. Lore only traps Steel types; this widens it to everyone, so it's flagged.
- **Zapdos's adds.**

**Exeggcute** · Grass/Psychic · fodder band (Speed 40) · HP 60/Atk 40/Def 80/SpA 60/SpD 45, exp 65, 0.4 m, 2.5 kg
- **Attack: Splitter.** When it dies it bursts into **3 eggs**: 25% HP each, speed 95, contact 5, XP 0.2, and they don't split again.
- **Defence:** Fire, Ice, Flying, Poison, Dark ×2; Water, Grass, Electric ×0.5. Status: burn, freeze and poison 1.5; Leech Seed and powders 0.25; paralysis and Soaked 0.5; sleep and confusion 0.5.
- **Elite, Harvest:** once below 50% it eats a berry and regains 20% HP (visible).

**Sandshrew** · Ground · bruiser band (Speed 40) · HP 50/Atk 75/Def 85/SpA 20/SpD 30, exp 60, 0.6 m, 12 kg
- **Attack: Roller.** **3 Rollouts in a row**, each 200 px at ×4 speed, each re-aimed behind its own 0.4 s line. A rhythm combo.
- **Defence and status:** as Diglett.
- **Elite, Sand Veil:** while rolling, 1 in 4 hits on it misses (shown as "miss"). Its only random element; flagged.

**Machop** · Fighting · bruiser band (Speed 35) · HP 70/Atk 80/Def 50/SpA 35/SpD 35, exp 61, 0.8 m, 19.5 kg
- **Attack: Combo.** **Karate Chop ×3**: three 60 px lunges behind short lines, with 0.3 / 0.25 / 0.2 s gaps, ×1.2 contact each.
- **Defence:** Flying ×2; Dark ×0.5. Status: flinch 0.5.
- **Elite, No Guard:** it deals and takes ×1.3. Glass-cannon lore.

**Dratini** · Dragon · fast band (Speed 50) · HP 41/Atk 64/Def 45/SpA 50/SpD 50, exp 60, 1.8 m, 3.3 kg
- **Rare spawn:** low weight, berry 0.3.
- **Attack: Dragon Rage.** Keeps 250–350 px away and fires a bolt that deals a **fixed 15 damage**, ignoring damage-taken modifiers (lore). Line 0.5 s, cooldown 4 s.
- **Defence:** Ice, Dragon ×2; Fire, Water, Grass, Electric ×0.5. Status: freeze 1.5; burn, paralysis, Leech Seed and Soaked 0.5.
- **Elite, Marvel Scale:** while it has any status it takes ×0.67.

**Mr. Mime** · Psychic/Fairy · ranged band (Speed 90) · HP 40/Atk 45/Def 65/SpA 100/SpD 120, exp 161, 1.3 m, 54.5 kg
- **Attack: Barrier.** Every 8 s it raises a 120 px wall between itself and you for 4 s, after a 0.5 s flicker. The wall **blocks your projectiles**; beams and areas pass. Between walls it fires slow Psybeam darts that confuse you.
- **Defence:** Poison, Steel ×2; Fire ×0.5, Dragon ×0.5 (immune). Status: sleep 0.5, confusion 0.25, poison 1.5.
- **Elite, Filter:** super-effective hits ×0.75.

**Ponyta** · Fire · fast band (Speed 90) · HP 50/Atk 85/Def 55/SpA 65/SpD 65, exp 82, 1.0 m, 30 kg
- **Attack: Flame trail.** While it runs it leaves short burning patches (35 px, 2 s, max 8) that **burn** you. Charmander's line resists ×0.25.
- **Defence:** Water ×2; Fire, Grass, Ice, Steel ×0.5. Status: burn 0.25, Soaked 1.5, freeze and Leech Seed 0.5.
- **Elite, Flash Fire:** Fire hits ×0.25. After absorbing one, its trail burns ×1.5 for 4 s.
- **Moltres's adds.**

## Notes for building batch 3
- **Speed:** Ponyta (131) and Dratini (122) are flankers. At the final ×1.15 scale Ponyta reaches 151, past the
  slowest starter. That's allowed by the approved two-tier rule (README §6.2), but the old D26 test in
  `world.test.ts` (fastest enemy below the slowest stage) must change to the horde-body version first. That file
  currently has the skill team's uncommitted edits.
- **Engine needs:**
  - burrowing (untargetable plus a trail), wall segments that block player projectiles (Mr. Mime), split-on-death
    (an `eggs` EnemyId)
  - lingering enemy zones (Smog, flame trail: reuse the web list), ability suppression (Neutralizing Gas), a pull
    aura (Magnet Pull), fixed-damage hits (Dragon Rage)
- **Hordes:** each species leads its own line (Exeggcute's eggs never lead).
- **Flagged for owner approval:**
  - **Neutralizing Gas:** switches off your ability; strong.
  - **Magnet Pull** widened to every type.
  - **Sand Veil's** 1-in-4 miss: the only random defence.
  - **Dragon Rage's** fixed damage ignores damage-taken modifiers.
