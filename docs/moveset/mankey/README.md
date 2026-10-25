# Mankey → Primeape → Annihilape — rage brawler

**Status:** APPROVED design (owner, D56, 2026-10-25). **Not built.** All numbers *(provisional)*; once built,
`src/data/` is the truth. IDs below go into [`../INDEX.md`](../INDEX.md) when the line is built (a unit test keeps
INDEX.md and the code in sync, so rows can't be added before the code).

Checked against the Mutation rules 1–19 and the kit review checklist in [`../README.md`](../README.md).

**Role:** a melee fighter whose power comes from **staying in the fight** (the Rage meter), not from low HP
(Charmander owns low-HP risk; rule 15). 3-stage line: Fighting → Fighting/Ghost at Annihilape (Gen 9 evolution, owner OK).

| Stage | Lv | Types | HP | Speed | Dmg | Radius | Signature |
|---|---|---|---|---|---|---|---|
| Mankey | 1 | Fighting | 105 | 155 | ×1.0 | 12 | Karate Chop |
| Primeape | 10 | Fighting | 150 | 168 | ×1.15 | 15 | Cross Chop |
| Annihilape | 25 | Fighting, Ghost | 210 | 165 | ×1.35 | 19 | Rage Fist |

Type notes: Fighting hits the early Normal hordes (Rattata, Raticate, Tauros, Snorlax) and Rock/Ice ×2, but Flying
(Pidgey, Spearow, Zubat), Poison, Bug and Psychic resist it and Ghost (Gastly) shrugs it off. Ghost moves at
Annihilape cover Gastly and Abra.

## 1. Hooks used by this line
| Hook | Source | Bond |
|---|---|---|
| `kill` (existing) | any kill | Low Kick — Brawler's Rhythm |
| `hitTaken` (existing) | contact damage | Vacuum Wave — Shockfist |
| `moving` (existing) | player movement | Seismic Toss — Running Throw |
| `rampage` (**new**, Primeape+) | Rampage starts | Thrash — Berserk Flurry |
| `rageLevel` (**new**) | Rage meter 0–100 | Close Combat — Fury Combat |
| `rampageEnd` (**new**, Primeape+) | Rampage ends | Shadow Punch — Phantom Grudge |

## 2. Ability tree — Anger Point
| Stage | Ability | Effect |
|---|---|---|
| Mankey | **Anger Point** `angerPoint` | A **Rage** meter, 0–100. **+6 per hit taken**; **+1 per hit dealt by a Contact move** (max 5 per cast). Drains 5/s after 3 s with no hit dealt or taken. Rage cuts **all cooldowns by up to 20%**, scaling with the meter. |
| Primeape | **Anger Point — Thrash** `angerPoint.thrash` | As Anger Point, and **full Rage starts a Rampage**: 5 s of +30% damage and +15% move speed; then Rage empties and you are **Confused 1 s** (−20% move speed; the existing player `confusion` status). |
| Annihilape | Trait pick | **Defiant** `defiant`: Rampage +50% damage (30%) and hits taken fill Rage +50% faster. · **Vital Spirit** `vitalSpirit`: immune to the statuses enemies inflict on you (README §10), and each Rampage heals 10% of max HP. |

**Rates** (reference table in `../README.md`): swarmed, ~1.7 hits/s × 6 + Contact hits ≈ full Rage in **~7 s**, so a
Rampage every **~10–12 s**, about 40% uptime. Out of fights, Rage drains: the bonus belongs to fighting.

## 3. Signature tree — Karate Chop → Cross Chop → Rage Fist
| Tier | Tags | Base *(provisional)* |
|---|---|---|
| **Karate Chop** `karateChop` (Lv 1) | Fighting, Melee, Slicing | Chop in front: cd 0.8 s, dmg 13, reach 60, arc 120°, crit 20% |
| **Cross Chop** `crossChop` (Lv 10) | + Area | X-chop at the nearest enemy: cd 1.0 s, dmg 17, reach 70, arc 120°, crit 20%, then a **50 px shockwave** for 60% |
| **Rage Fist** `rageFist` (Lv 25) | + Ghost, Projectile | A phantom fist flies 300 px and explodes **60 px** for 70%: cd 1.1 s, dmg 22; **+0.4% damage per Rage** (up to +40%) |

Rage Fist's attack type stays Fighting; the Ghost tag only matters for Ghost-tag boosts (evolution only adds tags, §8.6).

| Signature Mutation | Lv 1 (Karate Chop) | + Lv 10 (Cross Chop) | + Lv 25 (Rage Fist) | Cost |
|---|---|---|---|---|
| **A. Combo Chain** `karateChop.combo` | Hits within 1.5 s of the last stack +6% damage (max 5) | At 5 stacks the next chop also releases a **90 px** shockwave | At 5 stacks Rage Fist fires 2 fists | Damage ×0.85 |
| **B. Vacuum Chop** `karateChop.vacuum` | The chop also sends a 150 px slicing wave forward (50%) | The wave is X-shaped | The fist leaves a 1.5 s ghost trail (20%/0.5 s) | Damage ×0.8 |
| **C. Rage Release** `karateChop.rageRelease` (hook `rageLevel`) | +0.4% damage per Rage (up to +40%) | At full Rage, chops always crit | Rage Fist's blast radius grows with Rage (60 → 90 px) | Rage drains twice as fast out of combat |

## 4. Learnset trees — 2 generic + 1 Bond per move
The new moves' generic Mutations live here until a second line learns the move; then they move to `../shared/`.

| Move | Type / form | Base *(provisional)* |
|---|---|---|
| **Low Kick** `lowKick` | Fighting, Melee, Contact | 360° sweep: cd 1.6 s, dmg 12, reach 55, stagger 15; **damage ×(0.8 → 1.5) with enemy weight** (as in the games) |
| **Vacuum Wave** `vacuumWave` | Fighting, Projectile | cd 1.2 s, dmg 9, range 220, speed 600, pierce 3 |
| **Seismic Toss** `seismicToss` | Fighting, Zone (at target) | cd 4 s: lifts the nearest light enemy (< 40 kg; heavier ones just take the hit) and slams it down: dmg 20 in **60 px** |
| **Thrash** `thrash` | Normal, Orbit, Contact | cd 5 s: 3 fists orbit at 60 px for 3 s, dmg 9 / 0.4 s, stagger 10 (the line's one Normal move) |
| **Close Combat** `closeCombat` (Primeape+) | Fighting, Melee, Contact, Punch | cd 2.5 s, dmg 30, reach 75, arc 150°; then **you take +15% damage for 2 s** |
| **Shadow Punch** `shadowPunch` (Annihilape) | Ghost, Projectile, Punch | cd 1.4 s, dmg 18, homing, never misses (kit rule 4) |

Kit rules: 4 Fighting + 1 Ghost + 1 Normal (rules 1–2); forms melee / projectile / zone / orbit (rule 5; no Fighting
beam fits); Annihilape unlocks Shadow Punch (rule 4).

```
Low Kick ──────┬─ Trip              (generic) light enemies fall down 0.4 s
               ├─ Heavy Hitter      (generic) ×0.5 light … ×2 heavy
               └─ ★ Brawler's Rhythm (Bond: kill)
Vacuum Wave ───┬─ Aura Wave         (generic) homing, pierce 1
               ├─ Spread Wave       (generic) 3-wave fan
               └─ ★ Shockfist       (Bond: hit taken)
Seismic Toss ──┬─ Submission        (generic) lands on the densest cluster
               ├─ Level Toss        (generic) fixed damage by level
               └─ ★ Running Throw   (Bond: moving)
Thrash ────────┬─ Outrage           (generic) lasts ×2, then Confused
               ├─ Parting Jabs      (generic) fists fly out at the end
               └─ ★ Berserk Flurry  (Bond: Rampage starts · Primeape+)
Close Combat ──┬─ Brick Break       (generic) breaks shields and armour
 (Primeape+)   ├─ Arm Thrust        (generic) 3 quick hits
               └─ ★ Fury Combat     (Bond: Rage ≥ 50)
Shadow Punch ──┬─ Shadow Barrage    (generic) 3 fists
 (Annihilape)  ├─ Phantom Grip      (generic) holds the target
               └─ ★ Phantom Grudge  (Bond: Rampage ends · Annihilape)
```

### Generic details
| Mutation | What changes | Cost |
|---|---|---|
| **Trip** `lowKick.trip` | Light enemies hit fall down 0.4 s (stun; fatigue applies, bosses immune). | Damage ×0.8 |
| **Heavy Hitter** `lowKick.heavyHitter` | Weight scaling widens to ×0.5 (light) … ×2 (heavy): an Elite and boss killer. | Weak on the horde body |
| **Aura Wave** `vacuumWave.auraWave` | Waves home on the nearest enemy. | Pierce 3 → 1 |
| **Spread Wave** `vacuumWave.spread` | 3 waves in a 40° fan. | Each ×0.45 |
| **Submission** `seismicToss.submission` | The thrown enemy lands on the densest cluster within 200 px. | Damage ×0.85 |
| **Level Toss** `seismicToss.levelToss` | Fixed damage = 10 + 1 per level; ignores types and damage augments (as in the games). | Falls behind a built-up toss late |
| **Outrage** `thrash.outrage` | Lasts ×2 (6 s). | You are Confused 1 s when it ends |
| **Parting Jabs** `thrash.partingJabs` | At the end the fists fly outward 150 px (50%). | Cooldown ×1.1 |
| **Brick Break** `closeCombat.brickBreak` | Breaks shields and armour (Articuno, Machamp rock…) and deals ×1.3 to Elites and bosses. | Arc 150° → 100° |
| **Arm Thrust** `closeCombat.armThrust` | 3 quick hits at 40% each (better crits and on-hits). | Reach −20% |
| **Shadow Barrage** `shadowPunch.barrage` | 3 fists at different targets. | Each ×0.45 |
| **Phantom Grip** `shadowPunch.grip` | The target is held in place 0.4 s (trap rules: < 40 kg, else slowed). | Damage ×0.85 |

### Bond details (with the D55 five checks)
| Bond | Move | From | What changes | Cost | Trigger rate (11) | Size (14) | Condition reach (15) | Core job (16) |
|---|---|---|---|---|---|---|---|---|
| **Brawler's Rhythm** `lowKick.brawlersRhythm` | Low Kick | Mankey | Each kill since the last kick gives the next kick +10% radius (max +40%). | Damage ×0.9 | kills: several per second in a horde | grows, never shrinks | always while killing | sweep kept |
| **Shockfist** `vacuumWave.shockfist` | Vacuum Wave | Mankey | Each hit you take fires a free Vacuum Wave at the attacker (60%), at most every 0.8 s. A copy: triggers nothing (rule 5). | None beyond the trigger | ~1.25/s swarmed (capped) | a full wave | n/a (event) | normal casts untouched |
| **Running Throw** `seismicToss.runningThrow` | Seismic Toss | Mankey | After moving 1 s, the impact is ×1.3 wider. | Standing still: damage ×0.85 | — | ≥ base (×1.3) | moving most of a run | lift and slam kept |
| **Berserk Flurry** `thrash.berserkFlurry` | Thrash | Primeape | Every Rampage start casts Thrash at once with double fists for its 3 s, and resets its cooldown. | None beyond the trigger | ~10–12 s swarmed | double fists | n/a (event) | normal casts untouched |
| **Fury Combat** `closeCombat.furyCombat` | Close Combat | Primeape | At Rage ≥ 50: no defence drop after the hit, and +25% damage. | None (the defence drop stays below 50 Rage) | — | n/a | ≥ 50 Rage ≈ half of a fight | hit kept |
| **Phantom Grudge** `shadowPunch.phantomGrudge` | Shadow Punch | Annihilape | When a Rampage ends, 5 homing Shadow Punches fire at once (full damage each, copies). | None beyond the trigger | ~10–12 s swarmed | full fists | n/a (event) | normal casts untouched |

Hooks are spread (rule 9): kill, hit taken, moving, Rage level, Rampage start, Rampage end. Rampage hooks only offer
from Primeape (rule 8); Shadow Punch's Bond only exists at Annihilape.

## 5. Kit review checklist
| Band | Crowd answers |
|---|---|
| Lv 1–9 | Karate Chop (120°), Low Kick (360°), Thrash (orbit), Vacuum Wave (pierce 3) |
| Lv 10–24 | + Cross Chop (shockwave), Close Combat (150°), Berserk Flurry |
| Lv 25+ | + Rage Fist (60 px blast), Shadow Barrage, Phantom Grudge |

Single target: Heavy Hitter, Brick Break, Close Combat, Rage Fist.

## 6. Build ideas
| Build | Picks | Plan |
|---|---|---|
| **Berserker** (live in Rampage) | Rage Release · Berserk Flurry · Phantom Grudge · Fury Combat · *Defiant* | Fill Rage fast, chain Rampages; every start and end is a burst. |
| **Counter-puncher** | Combo Chain · Shockfist · Brawler's Rhythm · Arm Thrust · *Vital Spirit* | Stand in the crowd; every hit taken shoots back, every kill widens the sweep. |
| **Wrestler** | Vacuum Chop · Submission · Running Throw · Brick Break | Keep moving, throw enemies into piles, break Elites. |

## 7. To build (new systems in this line, approved with D56)
- The **Rage** meter and **Rampage** state (like Charge on Pikachu), shown on the HUD.
- Hooks `rageLevel`, `rampage`, `rampageEnd` (INDEX.md hook vocabulary and `HOOK_IDS`).
- Moves above in `src/data/moves.ts`; the line in `src/data/content.ts`; Fighting/Ghost player moves (types already exist as defenders).
