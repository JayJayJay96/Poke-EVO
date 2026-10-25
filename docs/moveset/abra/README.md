# Abra → Kadabra → Alakazam — blink mage

**Status:** APPROVED design (owner, D56, 2026-10-25). **Built 2026-10-25** (`src/data/`, `src/sim/teleport.ts`,
`src/sim/forms/zoneCast.ts`, `src/sim/mutationDefs/{confusion,psybeam,kinesis,psychoCut,reflect,swift,futureSight}.ts`);
IDs are in [`../INDEX.md`](../INDEX.md). All numbers *(provisional)*; `src/data/` is the truth. See **Build notes** at the end.

Checked against the Mutation rules 1–19 and the kit review checklist in [`../README.md`](../README.md).

**Role:** the most fragile stage stats in the game, an automatic escape, and attacks that hit again a moment later.
3-stage Psychic line. **Abra also stays an enemy** (its Elite has Synchronize, D37): owner OK, both coexist.

| Stage | Lv | Types | HP | Speed | Dmg | Radius | Signature |
|---|---|---|---|---|---|---|---|
| Abra | 1 | Psychic | 85 | 165 | ×1.05 | 11 | Confusion |
| Kadabra | 10 | Psychic | 120 | 173 | ×1.2 | 14 | Psychic |
| Alakazam | 25 | Psychic | 160 | 180 | ×1.4 | 17 | Expanding Force |

Type notes: Psychic hits Poison (Zubat, Weedle, Oddish, Gastly) and Fighting (Machamp) ×2; Steel and Psychic (enemy
Abra) resist it. Abra takes ×2 from Bug and Ghost (Caterpie, Weedle, Gastly).

## 1. Hooks used by this line
| Hook | Source | Bond |
|---|---|---|
| `teleport` (**new**) | Teleport fires | Psybeam — Blink Beam |
| `targetConfused` (**new**) | the enemy is Confused | Kinesis — Spoon Bender |
| `moving` (existing) | player movement | Psycho Cut — Flowing Cut |
| `hitTaken` (existing) | contact damage | Reflect — Barrier Echo |
| `kill` (existing) | any kill | Swift — Shooting Stars |
| `echo` (**new**, Kadabra+) | a Psychic Echo blast | Future Sight — Echo Sight |

## 2. Ability tree — Teleport
| Stage | Ability | Effect |
|---|---|---|
| Abra | **Teleport** `teleport` | When **4+ enemies are within 60 px**, Abra blinks **150 px** toward the most open space (fewest enemies, no obstacle). **Automatic** (all moves auto-fire, D1) with a **0.3 s telegraph**: a glow on Abra and a marker where it will land. Recharges in **8 s**. |
| Kadabra | **Teleport — Psychic Echo** `teleport.echo` | As Teleport, and each blink leaves a **90 px psychic blast** where you were (signature hit ×2, a proc: it triggers nothing but `echo`). |
| Alakazam | Trait pick | **Magic Guard** `magicGuard`: no damage from enemy ranged attacks, zones or statuses (contact still hurts); Teleport recharges in 6 s. · **Synchronize** `synchronize`: Psychic moves +30% damage; the Echo blast is 40% wider. |

**Rates:** swarmed, the surround check passes almost at once, so Teleport fires about **every 8 s** (6 s with Magic
Guard), and so do Echo blasts.

## 3. New enemy status — Confused (approved with D56)
The status resistance table already lists `confusion`. Confused enemies **walk in a random direction** for the
duration (re-rolled every 0.3 s) and don't attack. Bosses take half duration (D27); stun fatigue does **not**
apply (it isn't a stun). Default 0.5 s. Psychic-type enemies resist it (×0.5, lore).

## 4. Signature tree — Confusion → Psychic → Expanding Force
| Tier | Tags | Base *(provisional)* |
|---|---|---|
| **Confusion** `confusion` (Lv 1) | Psychic, Zone | Instant mind-burst on the nearest enemy: cd 0.9 s, dmg 11, **35 px**, Confuses 0.5 s, range 300 |
| **Psychic** `psychic` (Lv 10) | + Area | Burst **60 px**, cd 1.0 s, dmg 15 |
| **Expanding Force** `expandingForce` (Lv 25) | + Pulse | Burst **70 px** (dmg 20, cd 1.1 s), then a ring expands to **140 px** for 50% |

| Signature Mutation | Lv 1 (Confusion) | + Lv 10 (Psychic) | + Lv 25 (Expanding Force) | Cost |
|---|---|---|---|---|
| **A. Mind Lock** `confusion.mindLock` | Hits leave a **Psy Mark** for 3 s: +15% damage from your other moves | Marks spread to everything in the burst | The ring marks too | Damage ×0.8 |
| **B. Gravity Well** `confusion.gravityWell` | The burst pulls enemies 15 px in before it hits (light enemies) | Pull 25 px from 90 px | Pulls, then the ring pushes out 20 px | Cooldown ×1.2 |
| **C. Psy Split** `confusion.psySplit` | Bursts on the **2** nearest enemies at ×0.6 each | 3 targets | Each burst rings | Each burst ×0.6 |

## 5. Learnset trees — 2 generic + 1 Bond per move
The new moves' generic Mutations live here until a second line learns the move; then they move to `../shared/`.

| Move | Type / form | Base *(provisional)* |
|---|---|---|
| **Psybeam** `psybeam` | Psychic, Beam | cd 2.6 s, dmg 7 / 0.2 s for 0.6 s, length 280, width 14; 20% chance per hit to Confuse 0.5 s |
| **Kinesis** `kinesis` | Psychic, Orbit | cd 5 s: 3 bent spoons orbit at 70 px for 3.5 s, dmg 9 / 0.4 s |
| **Psycho Cut** `psychoCut` | Psychic, Melee, Slicing | cd 1.1 s, dmg 14, reach 70, arc 110°, crit 15% |
| **Reflect** `reflect` | Psychic, Zone (self) | cd 9 s: 4 s barrier, 70 px: −40% contact damage taken, reflects enemy projectiles; **no damage** (like Smokescreen) |
| **Swift** `swift` | Normal, Projectile | cd 1.3 s: 3 homing stars, dmg 7 each (the line's one Normal move) |
| **Future Sight** `futureSight` (Alakazam) | Psychic, Zone (delayed) | cd 4 s: marks a 70 px area on the densest cluster; **explodes 2 s later** for dmg 45 (kit rule 4) |

Kit rules: 5 Psychic + 1 Normal (rules 1–2); forms beam / orbit / melee / zone / projectile (rule 5); Alakazam
unlocks Future Sight (rule 4).

```
Psybeam ───────┬─ Signal Sweep      (generic) the beam sweeps 90°
               ├─ Disorient         (generic) every hit Confuses
               └─ ★ Blink Beam      (Bond: Teleport)
Kinesis ───────┬─ Spoon Guard       (generic) spoons eat projectiles
               ├─ Fling Spoons      (generic) spoons fly at enemies at the end
               └─ ★ Spoon Bender    (Bond: target Confused)
Psycho Cut ────┬─ Keen Psycho       (generic) more crit, narrower
               ├─ Psycho Wave       (generic) the slash sends a wave
               └─ ★ Flowing Cut     (Bond: moving)
Reflect ───────┬─ Light Screen      (generic) also cuts ranged damage
               ├─ Mirror Coat       (generic) reflections and contact hit back
               └─ ★ Barrier Echo    (Bond: hit taken)
Swift ─────────┬─ Star Storm        (generic) 5 stars
               ├─ Comet Star        (generic) 1 big piercing star
               └─ ★ Shooting Stars  (Bond: kill)
Future Sight ──┬─ Foresight Field   (generic) 3 smaller marks
 (Alakazam)    ├─ Prophecy          (generic) longer delay, bigger hit
               └─ ★ Echo Sight      (Bond: Echo blast · Kadabra+)
```

### Generic details
| Mutation | What changes | Cost |
|---|---|---|
| **Signal Sweep** `psybeam.signalSweep` | The beam sweeps a 90° arc while it fires. | Damage ×0.7 |
| **Disorient** `psybeam.disorient` | Every hit Confuses 0.5 s (not 20%). | Damage ×0.8 |
| **Spoon Guard** `kinesis.spoonGuard` | Spoons eat enemy projectiles they touch. | Damage ×0.75 |
| **Fling Spoons** `kinesis.fling` | When the orbit ends, the spoons fly at the 3 nearest enemies (100% each). | Cooldown ×1.1 |
| **Keen Psycho** `psychoCut.keen` | +25% crit chance. | Arc −30% |
| **Psycho Wave** `psychoCut.wave` | The slash also sends a 120 px wave forward (50%). | Damage ×0.75 |
| **Light Screen** `reflect.lightScreen` | Also −40% damage from enemy ranged attacks. | Lasts 3 s (4) |
| **Mirror Coat** `reflect.mirrorCoat` | Reflected projectiles deal ×2; contact attackers take back 50% of the damage. | Contact cut −40% → −25% |
| **Star Storm** `swift.starStorm` | 5 stars. | Each ×0.6 |
| **Comet Star** `swift.comet` | 1 big star that pierces every enemy. | Cooldown ×1.3 |
| **Foresight Field** `futureSight.field` | 3 marks on 3 clusters. | Each ×0.5 |
| **Prophecy** `futureSight.prophecy` | Explodes after 3 s for ×1.6. | Slower to land |

### Bond details (with the D55 five checks)
| Bond | Move | From | What changes | Cost | Trigger rate (11) | Size (14) | Condition reach (15) | Core job (16) |
|---|---|---|---|---|---|---|---|---|
| **Blink Beam** `psybeam.blinkBeam` | Psybeam | Abra | Each Teleport fires a full Psybeam from where you were to where you land, through what you left. | None beyond the trigger | ~8 s swarmed | a full beam | n/a (event) | normal casts untouched |
| **Spoon Bender** `kinesis.spoonBender` | Kinesis | Abra | Spoons always crit Confused enemies and add +0.3 s of Confusion. | None | — | n/a | Confusion lands every ~1 s from the signature, so about half of nearby enemies | orbit kept |
| **Flowing Cut** `psychoCut.flowingCut` | Psycho Cut | Abra | After moving 1 s, the slash also leaves a 1 s cutting line behind you (40% / 0.25 s). | Standing still: damage ×0.85 | — | ≥ base | moving most of a run | slash kept |
| **Barrier Echo** `reflect.barrierEcho` | Reflect | Abra | Each hit taken inside Reflect adds a charge; at 5 charges it pulses **120 px** (signature hit ×1, knockback 20). The pulse is a proc. | None | ~1.7 hits/s inside → a pulse ~every 3 s while Reflect is up | 120 px > 70 px barrier | n/a (event) | barrier kept |
| **Shooting Stars** `swift.shootingStars` | Swift | Abra | Any kill spawns a star that seeks a new target (at most every 0.3 s). A star's kill spawns nothing (rule 5). | Swift damage ×0.8 | kills: several per second | a full star | always while killing | normal casts untouched |
| **Echo Sight** `futureSight.echoSight` | Future Sight | Alakazam | Each Echo blast also plants a Future Sight where it went off. | None beyond the trigger | ~8 s swarmed (6 s with Magic Guard) | a full mark | n/a (event) | normal casts untouched |

Hooks are spread (rule 9): Teleport, Confused target, moving, hit taken, kill, Echo. `echo` exists only from Kadabra
(rule 8), and Future Sight only at Alakazam.

## 6. Kit review checklist
| Band | Crowd answers |
|---|---|
| Lv 1–9 | Kinesis (orbit), Psycho Cut (110°), Psybeam (line); Confusion itself is single-target-sized (35 px) |
| Lv 10–24 | + Psychic (60 px), Echo blasts (90 px every ~8 s) |
| Lv 25+ | + Expanding Force (70 → 140 px ring), Future Sight (70 px) |

Single target: Future Sight, Prophecy, Psybeam, Comet Star.

## 7. Build ideas
| Build | Picks | Plan |
|---|---|---|
| **Blink storm** | Gravity Well · Blink Beam · Echo Sight · Light Screen · *Magic Guard* | Let them surround you; every blink fires a beam, a blast and a delayed nuke. |
| **Mind games** | Mind Lock · Disorient · Spoon Bender · Keen Psycho · *Synchronize* | Confuse everything, then crit the confused. |
| **Star mage** | Psy Split · Shooting Stars · Star Storm · Mirror Coat | Kills feed stars; the barrier throws shots back. |

## 8. To build (new systems in this line, approved with D56)
- **Teleport** ability (surround check, open-space search, 0.3 s telegraph, obstacle-safe landing) and the Echo blast.
- The enemy **Confused** status (section 3).
- Hooks `teleport`, `echo`, `targetConfused` (INDEX.md hook vocabulary and `HOOK_IDS`).
- Moves above in `src/data/moves.ts`; the line in `src/data/content.ts`; Psychic player moves (the type exists as a defender).

## Build notes (2026-10-25)
Where the build differs from the text above, and why:
- **Kadabra speed is 173**, not 175: the D20 rule (120 + ½ × official base Speed 105) rounds to 173.
- **Confused** enemies wander to random points exactly like Blinded ones (the existing wander code) and deal no contact damage or attacks; the direction isn't re-rolled every 0.3 s. Confused enemies have no visual marker yet.
- **Reflect** is a barrier that follows you (a ring on the player), not a zone. Enemy shots that reach it are **blocked** (destroyed), not sent back, so **Mirror Coat** has no "reflected shots ×2" part: it is thorns (50% of contact damage back) with a smaller contact cut.
- **Light Screen** cuts telegraphed enemy attacks (cones, pulses, dives) by 40%, since Reflect already blocks shots.
- **Magic Guard** covers enemy shots and player statuses; arena boss attacks still hurt.
- **Comet Star** deals ×2.5 per star (one star instead of three, so it needs the boost to be worth a slot).
- **Mind Lock** at Expanding Force adds +5% to the mark.
- **Type chart:** Psychic hits Poison and Fighting ×2. The chart has no Bug attack row yet, so the select screen doesn't list Bug as a weakness.
