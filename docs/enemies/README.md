# Enemy design framework (D27)

**Status:** owner-approved direction (D27, 2026-10-21). §2 tiers, §3 tables, §3.3 and the boss rule were approved by
the owner on 2026-10-21. Points marked *(proposal)* are still open (§9). Every number is provisional and gets tuned
with `npm run balance`.

**Goal (owner):** no horde of one-hit fodder. A horde should be hard to kill when your build leans on a single
element and the enemies counter it. A mixed build, or one picked to match the enemies, should cut through.

Per-species sheets live in [`ROSTER.md`](ROSTER.md). This file holds the rules every sheet follows.

---

## 1. Three layers of defence
| Layer | What it changes | Source |
|---|---|---|
| **Type chart** | Damage from a move's hit | Already built (D14). The real chart, dual types multiply, immunities become ×0.5 |
| **Status resistance** | How hard a status lands: tick damage or duration | From the species' types (§3). Every variant has it |
| **Ability** | Extra resistances or reactions | **Every species has one, but it is only active on its Elite or Boss variant (owner)** (§5) |

Weight-based knockback resistance (D14) stays as it is.

## 2. Status resistance tiers (owner-approved)
| Tier | Multiplier | When |
|---|---|---|
| **Weak** | ×1.5 | The status's element is super effective on the enemy |
| **Normal** | ×1 | Default |
| **Resist** | ×0.5 | The element is not very effective, or the type has a lore reason (§3.2) |
| **Strong** | ×0.25 | Lore immunity (e.g. Fire can't be burned) or a double resist. **The floor**: a status always does something |

**What the multiplier scales:**
- **Damage over time** (burn, poison/Toxic, Leech Seed, future Bound): **tick damage.** Leech Seed healing follows
  the damage.
- **Everything else** (sleep, paralysis, slow, Soaked, Blinded, trap, weaken, future statuses): **duration.**
- **Every status still lands.** No chance roll (pillar 3, readable chaos).
- **Combining:** multiply every multiplier that applies (types, ground effect, ability, boss rule), then clamp to
  **[×0.25, ×1.5]**. A lore immunity on either type is ×0.25 outright: Weedle (Bug/Poison) is ×0.25 to poison.
- Burn and poison ticks still **ignore the type chart** (§9 of PROJECT.md). Only this resistance scales them.
- Stun fatigue, the 70% slow cap, the 40 kg trap limit and the boss guard rails stay unchanged.

## 3. Resistance from types (owner-approved)
### 3.1 Elemental statuses follow the type chart
| Status | Element | Lore immunity (×0.25) |
|---|---|---|
| Burn (incl. Scorch) | Fire | **Fire** (can't be burned) |
| Freeze *(future)* | Ice | **Ice** (can't be frozen) |
| Paralysis | Electric | **Electric** (Gen 6+), **Ground** (Electric moves can't touch it) |
| Poison, Toxic | Poison | **Poison, Steel** (can't be poisoned) |
| Leech Seed | Grass | **Grass** (Leech Seed fails) |
| Powder statuses (Sleep Powder, Poison Powder, future Stun Spore) | Grass, on top of the status's own row | **Grass** (Gen 6+ powder immunity) |
| Soaked | Water | **Water** (they swim) |

The type chart against the enemy's types (multiplied for dual types) maps to a tier like this:

| Chart result | Tier |
|---|---|
| ×4 or ×2 | Weak ×1.5 |
| ×1 | Normal ×1 |
| ×0.5 | Resist ×0.5 |
| ×0.25 or less, or a real immunity | Strong ×0.25 |

### 3.2 Other statuses: lore table (resistance only)
Weakness comes **only** from the type chart.

| Status | Resisting type | × | Lore / logic |
|---|---|---|---|
| Sleep | Psychic | 0.5 | A disciplined mind wakes sooner |
| Sleep | Ghost | 0.5 | Restless spirits |
| Confusion *(future)* | Psychic | 0.5 | Mental resistance |
| Confusion *(future)* | Fairy | 0.5 | Misty Terrain protects from confusion |
| Flinch / brief stun | Fighting | 0.5 | Inner Focus: a trained stance |
| Slow | Flying | 0.5 | Airborne: hard to drag down |
| Trap / Bound / slip / drag | Ghost | 0.25 | Gen 6+: Ghosts can't be trapped |
| Trap / Bound / slip / drag | Flying | 0.5 | Airborne |
| Blinded | Dark | 0.5 | At home in darkness |
| Weaken (Attack drop) | Steel | 0.5 | Clear Body / Full Metal Body lore |

### 3.3 Grounded effects
**Flying enemies take ×0.5 from ground effects** (Puddle Soaked, Scorch burn, root fields, Frenzy Plant), on top of
the status row.

## 4. Statuses: existing and future (owner: future ones must be lore-accurate)
| Status | Exists | Lore basis | Note |
|---|---|---|---|
| Burn | ✔ | Burn | DoT |
| Poison / Toxic | ✔ | Poison / Badly poisoned | DoT; Toxic stacks |
| Paralysis | ✔ | Paralysis | Stun. Covers "shocked" |
| Sleep | ✔ | Sleep | Stun |
| Leech Seed | ✔ | Leech Seed | DoT that heals |
| Slow | ✔ | Speed drop (String Shot, Bubble, Icy Wind) | Duration |
| Blinded | ✔ | Accuracy drop (Smokescreen) | Duration |
| Weaken | ✔ | Attack drop (Aurora Beam, Growl) | Duration |
| Trap / slip / drag | ✔ | Partial trapping, Bubble | Duration; bosses immune (guard rails) |
| Soaked | ✔ | Soak / rain flavour | Duration |
| **Freeze** | future | Freeze | A hard stop. A Fire hit thaws it (lore). Short duration, capped like sleep. Alternative: Frostbite (Legends: Arceus) |
| **Confusion** | future | Confusion | Wanders and may bump other enemies for small damage |
| **Flinch** | partly (stun with no kind) | Flinch | Give it a named kind so Inner Focus and the Fighting rule can read it |
| **Bound** | future | Wrap, Bind, Fire Spin, Whirlpool, Sand Tomb, Clamp | Rooted in place with a small DoT. Same 40 kg and boss rules as trap |

Left out on purpose because they need enemy moves or genders this game doesn't have: Infatuation, Taunt, Encore,
Disable, Perish Song, Curse, Nightmare.

## 5. Abilities (owner: every species has one; only Elite and Boss variants use it)
- Every species sheet names **one real ability** that species can have in the games.
- **Normal variants never use it.** An **Elite** variant has it always on. A **Boss** species has its ability always
  on, plus the boss rule.
- An ability does one of three things:
  1. **Status resistance:** ×0.25 on one status, following the lore immunity. Examples: Insomnia/Vital Spirit
     (sleep), Limber (paralysis), Immunity (poison), Water Veil (burn), Magma Armor (freeze), Own Tempo (confusion),
     Inner Focus (flinch), Keen Eye (Blinded), Overcoat (powders).
  2. **Damage resistance:** e.g. Thick Fat: Fire and Ice hits ×0.5, and burn and freeze ×0.5. Absorb abilities
     (Volt Absorb, Water Absorb, Flash Fire) become **×0.25 damage**, never healing.
  3. **Reaction:** a self-buff with a clear trigger, e.g. Guts or Anger Point. This punishes one build style, which
     is the "countered" feel the owner wants.
- **Abilities only affect their owner.** An elite's ability does not buff its horde. Any horde aura is game logic
  (§8), not an ability.
- **Boss rule (owner-approved):** besides the existing guard rails (immune to trap/slip/drag/Blinded, half stagger),
  bosses take **×0.5 duration from every stun-type status** (sleep, paralysis, freeze, confusion, flinch). Damage
  over time stays full.

## 6. Stats
### 6.1 From official base stats (owner)
| Stat | Formula | Notes |
|---|---|---|
| Max HP | `0.3 × (HP + (Def + SpD) / 2)` | The game has no defence stat, so Def/SpD fold into HP. The 0.3 factor is tuned globally |
| Contact damage | `0.18 × max(Atk, SpA)` | |
| XP | `base exp yield ÷ 50` | Then one global factor keeps the ~Lv 40 at 15:00 target |
| Radius px | `8 + 6.5 × height in m` | Bosses are set by hand |
| Weight | real kg | Unchanged (D14) |

### 6.2 Speed from role (owner override)
**Speed is the only stat that ignores the base-stat formula. It comes from the enemy's role.** Inside a role, the
official base Speed still decides who is faster, so lore order holds among enemies with the same job.

`speed px/s = band min + (band max − band min) × clamp((base Speed − 20) / 130, 0, 1)`

| Role | Band px/s | Job (§9 archetypes) |
|---|---|---|
| **tank** | 50–65 | Soaks damage, blocks paths (Geodude, Snorlax) |
| **teleporter** | 55–70 | Moves mostly by blinking (Abra) |
| **healer** | 60–75 | Stays behind the horde (Chansey) |
| **ranged** | 65–80 | Keeps distance and shoots (Spearow-type shooters) |
| **fodder** | 75–90 | The basic chaser (Rattata, Caterpie, Weedle) |
| **bruiser** | 80–95 | Hits hard, steady advance (Tauros) |
| **exploder** | 95–110 | Rushes in and blows up (Voltorb) |
| **fast** | **115–145** | Flankers (Pidgey, Spearow, Fearow; later Ponyta, Dodrio) |

#### Two speed tiers (owner-approved 2026-10-21)
Owner: if every enemy is slower than the slowest starter, Agility (+8% move speed) never matters and the player can
always kite. So speed has two tiers, plus bursts:

| Tier | Roles | Rule | Effect |
|---|---|---|---|
| **Horde body** | tank, teleporter, healer, ranged, fodder, bruiser, exploder | Band max (110) × final wave speed scale (1.15) = 127 **stays below the slowest starter stage (Squirtle 142)** | The mass can always be kited, so deaths stay fair |
| **Flankers** | fast | Band 115–145. Early on (scale ×1) they're slower than every starter. By the late game they catch the slow ones | Fearow 133 → **153** at ×1.15: catches Squirtle 142, Bulbasaur 143, Lapras/Ivysaur 150, ties Charmander 153; can't catch Charizard 170 or Raichu 175 |
| **Bursts** | any (charges, dives, blinks, Run Away) | Briefly faster than every player, **always telegraphed** (§9) | Dodged by positioning, not out-running |

Slow starters must invest in Agility or get pecked by flankers, which adds to the D3 starter gamble.
**D26's unit test changes** from "the fastest enemy stays under the slowest stage" to "the fastest **horde-body**
band stays under it". A new test checks that the flanker band at final scale stays **below the fastest final stage**
(Raichu 175).

Roles set the speed band and the base archetype. Attacks are in §9 (P5 build).

## 7. Variants: Normal, Elite, Boss
Every species can spawn as **Normal** or **Elite**. Boss species are bosses only.

| Variant | HP | Contact | XP | Radius | Stagger taken | Ability | Speed |
|---|---|---|---|---|---|---|---|
| **Normal** | ×1 | ×1 | ×1 | ×1 | full (by weight) | off | role |
| **Elite** (owner-approved) | ×6 | ×1.3 | ×6 | ×1.35 | half | **on** | role (same as its species) |
| **Boss** | by hand | by hand | by hand | by hand | half | **on**, plus the boss rule | by hand |

- Elites get a visible marker (a crown or outline colour, P6 art) so the player can read "this one has its ability".
- Status resistance (§3) is the same for every variant of a species, because it comes from types.
- Wave scaling (hpScale, damageScale, speedScale) applies on top of every variant.

## 8. Horde-ready data (for the game logic designer)
The owner plans an event where **an Elite leads a horde of its own kind and hunts the player**. The event itself is
game logic and not designed here. Each species sheet in `ROSTER.md` gives a **Horde** block so the event can read it:

| Field | Meaning | Default |
|---|---|---|
| `leader` | The Elite variant of this species | `Elite <Species>` |
| `followers` | Who may follow it | **Its own species line (owner, 2026-10-21):** the species itself, and an evolved leader also brings its pre-evolutions (Elite Raticate → Raticate + Rattata). Never other lines, even of the same Pokémon type |
| `hordeSpeed` | Speed the horde can share so it stays together | The slowest member's role speed |
| `leaderAbility` | The ability that is on for the leader | From the sheet |

**Healer-role species (Chansey) never take part in horde events**, as leader or follower (owner, 2026-10-21). A
self-healing horde is too much.

Left to the game logic designer: horde size X, spawn timing, what happens when the leader dies (scatter, buff,
loot), chest drops, warnings and telegraphs.

## 9. Attack styles (owner asked to document, 2026-10-21; P5 build, details provisional)
### 9.1 Telegraph rule
Every enemy attack except plain contact is **telegraphed** before it hits (pillar 3, readable chaos). There are three
telegraph shapes, and each species uses one:

| Telegraph | Look | Default warning |
|---|---|---|
| **Ring** | A circle on the ground fills in, then hits | 0.8 s |
| **Line** | A thin line thickens, then the shot or dash goes along it | 0.5 s |
| **Cone** | A wedge flashes from the enemy | 0.5 s |

An attack's damage = the species' contact damage × the attack's factor (in the species sheet). Enemy attacks never
proc anything (no proc-from-proc).

### 9.2 Styles
| Style | Speed band | Behaviour | Telegraph | Kanto examples |
|---|---|---|---|---|
| **Chaser** | fodder | Walks at you; contact damage only | none | Rattata, Caterpie, Weedle |
| **Ranged** | ranged | Holds **220–320 px** from you. Closer than 180 px, it backs off at ×0.7 speed. Stops for 0.4 s, then fires a projectile | Line | Psyduck (Water Gun), Koffing (Sludge), Magnemite (Thunder Shock) |
| **Teleporter** | teleporter | Blinks to a spot **ahead of where you're walking** (inside the screen), then fires a short Confusion pulse | Ring at the landing spot, 0.6 s before it appears | Abra, Kadabra |
| **Bruiser** | bruiser | Walks in; every few seconds stops, paws the ground, and **charges** in a straight line (a burst) | Line, 0.7 s | Tauros (Take Down), Rhyhorn |
| **Exploder** | exploder | Rushes in; within ~60 px it stops and **fuses** for 1 s, then Self-Destructs (~70 px). **Killing it during the fuse defuses it.** It can't be stunned during the fuse | Ring, 1 s | Voltorb. Elite Electrode instead uses **Aftermath** (explodes when it dies) |
| **Healer** | healer | Stays behind its horde and pulses Soft-Boiled every few seconds, healing nearby enemies. A priority target | Ring (green, on its allies) | Chansey |
| **Burrower** | fodder | Digs in (can't be hit, leaves a dirt trail), then pops up under you | Ring, 0.6 s | Diglett, Dugtrio, Sandshrew |
| **Roller** | bruiser | Rolls in a straight line (a burst), bounces off obstacles, a little faster on each bounce, up to 3 bounces | Line | Geodude, Graveler (Rollout) |
| **Barrier** | ranged | Raises a short wall for a few seconds that **blocks player projectiles** (beams and areas pass) | Wall outline flickers 0.5 s before it's solid | Mr. Mime (Barrier / Light Screen) |
| **Splitter** | fodder | When it dies it splits into 3–6 small, weak copies | none (visible: clustered eggs) | Exeggcute |
| **Phaser** | fodder | Drifts **through** other enemies; flickers; its Lick paralyses you (§10) | none, but its contact hit applies a status | Gastly, Haunter |
| **Diver** | fast | Marks a circle on you, flies off-screen, dives onto the circle (a burst) | Ring, 0.8 s | Fearow (Drill Peck), Dodrio |
| **Web layer** | fodder | Leaves sticky String Shot patches that **slow you** (§10) | the patch is visible | Caterpie, Weedle, Venonat |
| **Ambusher** (owner: keep) | 0 until triggered | A Voltorb **disguised as an item ball**, like the Power Plant. Walk near and it wakes and fuses | It wobbles slightly as a tell; then the exploder ring | Voltorb, Electrode |

### 9.3 Budget and data
- Enemy projectiles get their **own pool, about 150**, separate from the player's 500. When it's full, new shots are
  skipped.
- Proposed shape on `EnemyDef`: `attack: { style, telegraph, windup, cooldown, range, damageFactor, status? }`. The
  style's behaviour code is P5 game logic; the sheet gives the numbers.
- Bosses keep their own hand-made patterns (P5), built from the same telegraph shapes.

## 10. Statuses on the player (owner asked to document, 2026-10-21; new system, P5 build)
### 10.1 Rules
- **The player never loses control for more than about 0.3 s.** That rules out sleep and freeze on the player, and no
  reversed controls. Losing control is what makes survivor-like deaths feel unfair.
- **Only specific enemies apply statuses**, through their contact hit or attack (listed on their sheet), so the
  player learns who to avoid.
- **Fatigue:** after a status ends, the same status can't land on the player again for **2 s**.
- A hit Shell blocks also blocks its status.

### 10.2 Player statuses
| Status | Effect on the player | Example sources |
|---|---|---|
| **Burn** | DoT: 20% of the hit per second for 3 s | Ponyta, Vulpix, Magmar |
| **Poison** | DoT: 20% of the hit per second for 3 s | Weedle, Ekans, Koffing, Grimer |
| **Slow** | −30% move speed for 2 s (player slow cap 50%) | String Shot webs, Psyduck/Shellder bubbles |
| **Paralysis** | −35% move speed for 2 s, plus a **0.2 s stutter** when it lands. Not a stun | Gastly Lick, Magnemite, Elite Electabuzz (Static) |
| **Confusion** | For 2 s, auto-aim picks a random direction offset (±30°) instead of the nearest enemy. Movement is never touched | Abra/Kadabra pulse, Zubat Supersonic |
| **Soaked** | −15% move speed for 2 s | Water enemies' shots |

### 10.3 Your starter's types resist them (same rules as enemies, §2–§3)
The current stage's types decide. Slows from **Ice** attacks use the Ice row.

| Stage types | Burn | Poison | Paralysis | Soaked | Ice slow | Other |
|---|---|---|---|---|---|---|
| Fire (Charmander, Charmeleon) | **0.25** | 1 | 1 | 1 | 0.5 | |
| Fire/Flying (Charizard) | **0.25** | 1 | **1.5** | 1 | 0.5 | slow 0.5, ground effects 0.5 (§3.3) |
| Water (Squirtle line) | 0.5 | 1 | **1.5** | **0.25** | 0.5 | |
| Grass/Poison (Bulbasaur line) | **1.5** | **0.25** | 0.5 | 0.5 | **1.5** | |
| Electric (Pikachu, Raichu) | 1 | 1 | **0.25** | 1 | 1 | |
| Water/Ice (Lapras) | 1 | 1 | **1.5** | **0.25** | **0.25** | |

This makes the starter pick matter against certain enemies (pillar 1, "kit over stats").

## 11. Spawn variety (owner idea 2026-10-21; a proposal for the game logic designer)
Owner: no fixed Rattata → Pidgey → Raticate queue every run. The enemies should vary from run to run while the
difficulty ramps the same way. The gist: **fix the difficulty curve, randomise who fills it.**

1. **Threat budget:** the wave keyframes give **threat points per second** instead of a fixed spawn interval. This
   curve is the same in every run, so difficulty is the same.
2. **Tiers, not species:** keyframes open **tiers** (ROSTER "Spawn data"), e.g. tier 1 at 0:00, tiers 1–2 from 3:00,
   tiers 2–3 from 10:00.
3. **Run roster:** at the start of a run (seeded RNG), each tier picks a few species to be **in season**, e.g. 3 of
   the 5 tier-1 species. One run is Caterpie/Zubat/Rattata, the next Weedle/Pidgey/Zubat.
4. **Rotation:** every ~2–3 min, one in-season species leaves and another from the same tier comes in, so a run
   changes as it goes.
5. **Fair swaps:** spawn count = budget ÷ the species' threat. Weak species come in bigger crowds, strong ones in
   fewer, and the total threat stays the same.
6. **Counter guarantee:** the in-season set always includes at least one species that resists the player's current
   starter type (ROSTER counter table), and counters are never the majority. This is the owner's "one-sided builds
   get countered" goal, guaranteed rather than left to luck.
7. **Elites and horde events** pick their species from the in-season set.

The enemy-side data it needs (tier and threat per species) is in ROSTER. Everything else (budget numbers, rotation
timing, the counter rule's code) belongs to the game logic designer.

## 12. Open questions for the owner
1. ~~"Same type enemy" in the horde event~~ **Answered (owner, 2026-10-21): the same species line** (§8).
2. ~~Elite multipliers~~ **Approved (owner, 2026-10-21)** as in §7.
3. ~~Raticate's role~~ **Approved (owner, 2026-10-21): tank.**
4. ~~Speed cap~~ **Approved (owner, 2026-10-21): two speed tiers** (§6.2).
5. ~~The Ambusher~~ **Kept (owner, 2026-10-21).**
6. ~~Next roster~~ **Batch 2 written (2026-10-21):** 10 species in ROSTER. Bosses are still to do.
7. ~~Spawn variety~~ **Approved as the gist (owner, 2026-10-21)** (§11).
8. ~~Batch 2 elite abilities~~ **Approved (owner, 2026-10-21).** The threat scores are approved as a starting point;
   the balance pass fine-tunes them.
9. ~~Healers in horde events~~ **Owner, 2026-10-21: healers never join horde events** (§8).
