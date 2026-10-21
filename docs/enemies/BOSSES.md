# Boss design (D27)

**Status:** owner-approved direction (2026-10-21): "all of these excite me". It covers the boss framework, the five
MVP bosses and future candidates. Every number is provisional. Built in **P5**. Stats and resistances follow
[`README.md`](README.md) (the boss rule, §5).

**Owner goal:** boss fights that feel intense and hard. They shouldn't be bullet hell or plain telegraphed nukes,
and every attack must come from the boss's own Pokémon lore.

---

## 1. Design levers (instead of bullet hell)
Each boss asks **one question the run has let the player ignore**, using these levers:

| Lever | Meaning | Example |
|---|---|---|
| **Contested resource** | The boss wants something on the map, and so does the player | Snorlax eats your berries |
| **Build interaction** | The player's own element helps or hurts them | Fire melts Articuno's ice cover |
| **Space control** | The arena shrinks, splits or turns hostile | Rubble, electric fences, spreading fire |
| **Damage race** | A visible window: burst it or it heals or powers up | Rest, Roost, Recover, Belly Drum |
| **Denial** *(sparingly)* | It disables, slows or reflects something of the player's | Disable, Pressure, Barrier |

## 2. Why speed alone must not solve a boss (owner, 2026-10-21)
Moves auto-fire, so the player's only input is movement. A fast enough player could dodge every telegraph by
running. So each boss mixes attacks that **speed doesn't answer**. All of these are cheap to build:

| Tool | How it works | Answer the player needs | Cost |
|---|---|---|---|
| **Lead aim (预判)** | The strike lands where the player **will be**: `target = position + velocity × windup × lead`. Uses the player's **actual velocity**, not the facing (standing still means no lead). Clamped to the arena | **Change direction** during the telegraph | 🟢 one line |
| **Bracket** | Two strikes at once: one where the player is, one where they're going | Turn **sideways**; neither going straight nor stopping works | 🟢 |
| **Past aim** (Future Sight) | The strike lands where the player was 2 s ago | Don't loop the same path | 🟢 a short position history |
| **Cover** | A full-arena attack (Blizzard); only a pillar or wall makes you safe | **Be in the right place**, not far away | 🟡 |
| **Interrupt bar** | A long channel (Sky Attack, Recover, Rest). Deal X damage during it to **stagger** the boss and cancel it | **Go aggressive**, closer, in its face | 🟢 a damage counter |
| **Tether** (Mean Look / Block lore) | For a few seconds the player can't move more than ~300 px from the boss. The leash is visible | Fight up close and stop kiting | 🟢 a position clamp |
| **Rhythm combos** | 3 strikes with shrinking gaps (e.g. 0.8 / 0.6 / 0.4 s) | Timing, not distance | 🟢 |
| **Safe-zone shift** | Only one area of the arena is safe, and it moves | Navigation | 🟢–🟡 |

**Fairness rules for every aimed attack:**
- The target point **locks when the telegraph starts**; it never re-aims during the wind-up.
- The telegraph is drawn **at the locked point**, so a lead-aimed ring appears ahead of the player.
- Each move has a **fixed lead value** (0, 0.5 or 1) the player can learn. Only Mewtwo mixes them.

## 2b. Projectile layer (owner, 2026-10-21)
Owner: ground telegraphs alone are easy to dodge, so pair them with **projectiles in the air**: mixed speeds, and
curving or chasing shots that give up after a while. The idea: **the ground says where to stand, the projectiles
make getting there hard.**

| Pattern | How it works | Answer | Cost |
|---|---|---|---|
| **Mixed-speed volley** | One fan of shots at 2–3 speeds; the gaps between fast and slow shots open and close like lanes | Read the lanes | 🟢 |
| **Homing, with a timeout** | Turns toward you at a limited turn rate for 2–3 s, then flies straight (or fizzles). Slower than the player and turns wider than you can, so a sharp turn shakes it. Visible tail | Lead it, then cut sharply | 🟢 reuses the player's Homing code (range, turn rate) |
| **Curving** | Sine-wave (zigzag), spiral arms rotating from the boss, or a boomerang that flies out and comes back | Learn the shape | 🟢 one angle-per-second value |
| **Stall, then launch** | Shots appear in a ring around you, hang for 0.6 s, then fire at your lead-aimed position | Leave the ring before they launch | 🟢 |
| **Ring with a gap** | An expanding ring with one gap; the gap's angle rotates between rings | Run through the gap | 🟢 |
| **Split** | A shot bursts into 3 small ones when it hits a wall, a pillar or its range | Keep away from cover edges | 🟡 |
| **Shoot-down** | Some slow orbs have HP; your attacks can destroy them | Positioning that lets your auto-fire clear them | 🟡 (enemy-projectile vs player-hit check) |

**Readability rules (not bullet hell):**
- **At most two layers at once:** a ground telegraph plus one projectile pattern. Never two projectile patterns over a
  ground attack.
- **At most ~30 boss projectiles alive** (inside the enemy projectile pool of ~150, README §9.3).
- **Each pattern has its own look:** homing shots have tails, splitters crack, shoot-down orbs show an HP ring.
- Projectiles move at most at ~1.3× the player's speed for straight shots; homing shots are always slower than the
  player.

## 3. How a boss is built (cost)
A boss is **scripted with conditions**, the standard action-game approach (Souls bosses work the same way). It's not a
learning AI.

1. **Phases** by HP threshold (e.g. 100–66%, 66–33%, below 33%). Each phase has its own move list.
2. **Move picker** whenever the boss is free:
   - keep the phase's moves that are usable now (off cooldown, in range, state OK)
   - pick one by weight, never the same move twice in a row
   - run it as **telegraph → act → recover**
   The **recover** window (~0.5–1 s, boss open) gives the fight its rhythm: dodge, then punish.
3. **Moves are data** built from existing pieces (rings, lines, cones, dashes, projectiles, zones, statuses):
   ```
   bodySlam: { phases: [1,2,3], range: [0, 250], cooldown: 6, weight: 3, aim: 'lead', lead: 0.5,
               telegraph: { shape: 'ring', radius: 90, seconds: 0.8 }, effect: 'leapSlam',
               damageFactor: 2, spawns: 'rubble', recover: 0.7 }
   ```
4. **Arena mechanics** (berries, pylons, pillars, rubble) are small objects that reuse the existing **Mutation entity**
   system (mines, sprouts and live wires already live in the sim on their own).

| Cost | Items |
|---|---|
| 🟢 Cheap | Phases, the move picker, every move built from existing pieces, Rest/Recover/Roost heals, Belly Drum, Pressure, Disable, the adaptive shield, Future Sight, lead aim, bracket, tether, interrupt bar |
| 🟡 Medium | Gluttony berries, rubble, melting ice pillars, pylon shield, electric fences, conductive puddles, spreading fire plus steam, the Lightning Rod pull |
| 🟠 Expensive | **Mewtwo's clone** (the player's moves must be able to target the player), **Barrier reflection** (flipping a projectile's owner). Build these last |

**Fight length targets** (the balance bot sets boss HP to match): Snorlax ~60–90 s, each bird ~90–120 s,
Mewtwo ~180 s.

**Every boss:** the boss rule (README §5): immune to trap/slip/drag/Blinded, half stagger, stun-type statuses ×0.5
duration. One ability is always on. **Adds are allowed where the lore fits (owner).**

**Arena-only weather:** Rain Dance and Sunny Day exist **only inside the boss's arena as a phase effect**. They are
not the global weather system that PROJECT.md §10 keeps out of MVP (owner-approved 2026-10-21).

---

## 4. The MVP bosses

> **D28 (owner, 2026-10-21):** **Mewtwo is the only main-map boss.** Snorlax and the birds are **arena bosses**, one
> drawn at random per arena event (4 per run). The event opens a themed entrance near the player; the fight happens
> in a closed arena with a time limit. Snorlax's kit below still applies inside the arena: Gluttony berries drop in
> the arena, and "the main-map horde keeps spawning" becomes arena adds. Times like "7:30" and "rift" below are
> superseded by D28.

### Snorlax: mid-boss, 7:30, main map. "The mountain that won't move"
| | |
|---|---|
| **Types** | Normal |
| **Damage taken** | Every player type ×1 |
| **Status** | ×1 everywhere, then the boss rule |
| **Ability: Gluttony** (owner) | Lore: eats its berry early. Drives the berry mechanic below |
| **Question it asks** | Can you win a resource fight and burst it on cue? |

| Phase | Moves |
|---|---|
| **1 (100–66%)** | **Body Slam:** leap with a ring telegraph, lead 0.5; leaves **rubble** that blocks movement for 20 s (max 6). **Gluttony:** Oran Berries drop around the arena every ~15 s; Snorlax walks to the nearest one and **eats it to heal 8%**. The player can grab them first |
| **Rest (at 66% and 33%)** | Falls asleep and heals 25% over 5 s. **Interrupt bar:** asleep it takes ×1.5 damage, and every hit fills a **wake meter**. Fill it and the heal is cancelled, but it wakes into an instant Body Slam. **Snore** pulses a sound ring every 1.5 s while asleep |
| **2 (66–33%)** | Adds **Yawn**: a drowsy cloud (cone); standing in it slows you 40% (no sleep, player rule §10). Body Slam comes **twice in a row** (rhythm) |
| **3 (below 33%)** | **Belly Drum:** cuts its own current HP in half and maxes its attack: contact and slams ×2, but it dies fast. A damage race |
| **Projectiles** | **Snore** (while asleep): expanding **rings with a gap** that rotates. **Hyper Beam** (phase 3, with Belly Drum): a line beam (lead 0), then **2 s of recharge**, as in the games. The biggest punish window of the fight |
| **Adds** | The main-map horde keeps spawning; rubble funnels it |

### Articuno: rift. "Cover that your own fire melts"
| | |
|---|---|
| **Types** | Ice/Flying |
| **Damage taken** | **Fire ×2, Electric ×2, Steel ×2**; Grass ×0.5; others ×1 |
| **Status** | Burn 1.5 · paralysis 1.5 · freeze 0.25 · Leech Seed/powders 0.5 · slow 0.5, then the boss rule |
| **Ability: Pressure** | All of the player's cooldowns +15% during the fight (lore: drains PP) |
| **Question it asks** | Can you use the arena when running away doesn't work? |

| Phase | Moves |
|---|---|
| **1** | **Ice Shard** volleys (lead 1). **Blizzard:** a sweep from one side covering the whole arena, 1.5 s warning. Safe only behind **ice pillars** (4–6). **Fire hits melt pillars** (each pillar has HP), so Fire players destroy their own cover; pillars regrow slowly |
| **2 (below 66%)** | **Mist:** a visible mist; statuses don't land for 6 s. **Mean Look tether** during a Blizzard: you can't run from the sweep; you have to find cover inside the leash |
| **3 (below 33%)** | **Sheer Cold armour:** encased in ice, taking ×0.25 damage until it has taken X super-effective damage (Fire, Steel; Rock and Fighting later). A build check. **Whirlwind:** a gust pushes you ~120 px (a push, not a stun) |
| **Roost** (once per phase) | Lands and heals 15% over 3 s. **Loses its Flying type** while roosting (becomes pure Ice: Electric drops to ×1; ground effects work). A damage window |
| **Projectiles** | **Ice Shard:** **mixed-speed** fans (lead 1); shards hitting a pillar **split** into 3. **Icy Wind:** **boomerang** crescents that fly out and return; they slow you 1 s. Paired with Blizzard, they make the run to cover hard |
| **Adds** | A few Seel/Dewgong in phase 3 (owner-approved) |

### Zapdos: rift. "The power plant"
| | |
|---|---|
| **Types** | Electric/Flying |
| **Damage taken** | **Ice ×2**; Grass ×0.5, Steel ×0.5, Flying ×0.5; Electric ×1; others ×1 |
| **Status** | Paralysis 0.25 · freeze 1.5 · Leech Seed/powders 0.5 · slow 0.5, then the boss rule |
| **Ability: Pressure** | As Articuno (Static as an alternative: touching it paralyses you) |
| **Question it asks** | Can you pick targets while being hunted? |

| Phase | Moves |
|---|---|
| **1** | **Generators:** 3 pylons power a **shield** (Zapdos takes ×0.25 while any pylon is up). Break them; they recharge after 20 s. **Thunder:** strikes with **bracket** aim (one on you, one ahead). **Drill Peck** dash (lead 1) |
| **2 (below 66%)** | **Electric fences:** dashes across the arena, leaving lightning lines that **split it into zones** for 4 s. Thunder becomes a **rhythm combo** (3 strikes, shrinking gaps) |
| **3 (below 33%)** | **Rain Dance** (arena only): Thunder hits **instantly in puddles** and puddles spawn. Standing in water means paralysis, so Squirtle and Lapras must mind their own puddles. **Charge → Discharge:** a 2 s channel with an **interrupt bar**, then a full-arena shock with a single safe ring |
| **Lightning Rod** | A player with the Lightning Rod trait **pulls Thunder onto themselves**: they take the hit, but it fills their Charge meter. A brave-Pikachu payoff |
| **Roost** | As Articuno: loses Flying while roosting (pure Electric: Ice drops to ×1, Grass to ×1; Electric becomes ×0.5) |
| **Projectiles** | **Shock Wave:** homing bolts (lore: never misses) with a strong turn rate but only a **2.5 s timeout**. **Thunderbolt:** **zigzag** sine-wave bolts in a 3-way fan. Shock Wave plus electric fences is the phase 2 squeeze |
| **Adds** | Voltorb and Magnemite from the Power Plant (lore-correct) |

### Moltres: rift. "The floor is burning"
| | |
|---|---|
| **Types** | Fire/Flying |
| **Damage taken** | **Water ×2, Electric ×2**; Fire ×0.5, Steel ×0.5; **Grass ×0.25**; Ice ×1; others ×1 |
| **Status** | Burn 0.25 · paralysis 1.5 · Soaked 1.5 · Leech Seed/powders 0.25 · slow 0.5, then the boss rule |
| **Ability: Pressure** | As Articuno (Flame Body as an alternative: touching it burns you) |
| **Question it asks** | Can you keep moving as the safe space shrinks? |

| Phase | Moves |
|---|---|
| **1** | **Ember** volleys (lead 0.5). **Heat Wave:** a wide cone. **Fire spreads:** every attack leaves Scorch that slowly **spreads across the floor** |
| **2 (below 66%)** | **Sunny Day** (arena only): fire attacks ×1.3 and spread doubles. **Water and Ice hits put fire out** and leave **steam patches** that are safe ground. Water players build their own safety; Charmander keeps moving |
| **3 (below 33%)** | **Sky Attack:** a 1.5 s glowing charge (**interrupt bar**), then a dash across the arena along a line with lead aim. **Safe-zone shift:** only one quadrant isn't burning, and it moves |
| **Roost** | On a lava pool: heals; loses Flying (Electric drops to ×1, Ice becomes ×0.5) |
| **Projectiles** | **Fire Spin:** **spiral arms** rotating out from Moltres. **Will-O-Wisp:** slow **homing** wisps (3 s timeout) that **burn** you on hit. **Ember:** mixed-speed fans. Wisps chasing you across a burning floor is the phase 2 pressure |
| **Adds** | Ponyta and Magmar (owner-approved) |

### Mewtwo: final boss, 15:00. "It studied you"
| | |
|---|---|
| **Types** | Psychic |
| **Damage taken** | **Dark ×2**; others ×1 |
| **Status** | Sleep 0.5 · confusion 0.5, then the boss rule |
| **Ability: Pressure** (owner) | As the birds: all of the player's cooldowns +15% during the fight |
| **Question it asks** | Is your build more than one trick? |

| Phase | Moves |
|---|---|
| **1 (100–66%), Clone** | Creates a **shadow copy of the player's own Pokémon**: your signature move and its augments at ~40% power, aimed at you (Mewtwo Strikes Back). Mewtwo fires **Psychic** waves with **mixed lead** (0 / 0.5 / 1, unpredictable) |
| **2 (66–33%), Adapt** | Reads the type the player dealt the most damage with and raises a **shield in that type's colour** (×0.25 from it); other types break it. **Disable:** every 20 s it greys out your strongest move for 5 s (shown on the HUD) |
| **3 (below 33%), Future Sight** | Strikes land **where you were 2 s ago**, together with lead-aimed Psystrike, so present, future and past are all dangerous. **Barrier:** for 3 s it reflects your projectiles (a visible shimmer). **Recover** at 20% with an **interrupt bar** |
| **Projectiles** | **Shadow Ball:** slow homing orbs with an HP ring; **your attacks can shoot them down**. **Psychic:** orbs **stall** in a ring around you, then launch at your lead-aimed spot. **Aura Sphere** (phase 3; lore: never misses): fast homing with a short 1.5 s timeout. Phase 3 stacks Future Sight (ground) with one of these, never two |
| **Adds** | None; the clone is its add |

---

## 5. Future boss candidates (not MVP)
| Boss | Lore hook | Signature mechanic |
|---|---|---|
| **Beedrill queen** | Viridian Forest swarm | Leads a Weedle/Kakuna swarm; Twineedle bracket strikes; Kakuna harden into walls |
| **Gengar** | Lavender Tower | **Lights out** (only a circle around you is lit, you see Gengar's grin), Hypnosis spiral, **Perish Song** 3-count cleared by breaking line of sight behind a gravestone |
| **Onix** | Rock Tunnel | A **segmented serpent** that burrows and surfaces; only the head takes full damage |
| **Gyarados** | Lake of Rage | **Dragon Rage** fixed damage ignoring defences; below 30% **Thrash**: berserk, then confused and open |
| **Kangaskhan** | Safari Zone | **Parental Bond:** the baby hits a second time. Kill the baby and the mother enrages |
| **Porygon** | Celadon Game Corner | **Conversion:** changes its own type each phase to resist your main type |
| **Ditto** | Pokémon Mansion | **Transform:** becomes the last enemy or boss you killed, with its moves |

## 6. Data shape (for the implementer)
- `BossDef`: `types`, `ability`, `base` stats, `ttkTarget` (seconds), `phases[]` (HP threshold, move IDs, arena
  effect), `adds?`.
- `BossMoveDef`: `aim` (`'now' | 'lead' | 'bracket' | 'past'`), `lead`, `telegraph` (shape, size, seconds),
  `range`, `cooldown`, `weight`, `damageFactor`, `recover`, `interrupt?` (damage to stagger), `effect` (a small named
  function, like an augment hook), `status?`.
- Boss attacks never proc anything (no proc-from-proc). Telegraph shapes are shared with normal enemies (README §9).

## 7. Open questions for the owner
1. ~~Arena-only weather~~ **Approved (owner, 2026-10-21):** Rain Dance and Sunny Day only as boss-arena phase effects.
2. ~~Snorlax's ability~~ **Gluttony (owner).**
3. ~~Mewtwo's ability~~ **Pressure (owner):** Unnerve would do nothing, since the player has no berries in that fight.
4. ~~Bird adds~~ **Approved (owner).**
5. ~~Projectiles~~ **Owner, 2026-10-21:** pair ground telegraphs with projectiles (mixed speeds, curving, homing with
   a timeout). Added as §2b and a Projectiles row per boss.
