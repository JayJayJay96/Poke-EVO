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
- **A cone or melee swing starts only when you're well inside it** (owner 2026-10-23): its trigger range leaves a
  standing player's **whole body** inside the drawn cone (trigger ≈ 75% of reach). Standing still gets you hit;
  moving away during the telegraph escapes. Applies to enemies (Zubat), bosses (Crunch, Yawn, Machamp's chops) and,
  the same way, the player's own melee swings (they wait until a target is really in reach).

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

**Variety and immunity (owner 2026-10-22, D31; built).** Owner: "a boss should have at least 10 kinds of attack";
special animations must not be burst through. All numbers are in `SNORLAX_KIT` (provisional).

| Move | Phase | What it does |
|---|---|---|
| Body Slam | 1+ (pairs from 2) | Lead-aimed ring leap, rubble |
| **Crunch** | 1+ | A bite cone when you hug it (0.6 s cone telegraph) |
| **Rock Slide** | 1+ | 5 rocks on rings: one on you, one where you're heading, three scattered; one stays as rubble |
| Gluttony (+ rare berry leap) | 1+ | The 3 s berry shake, then a hangry rush (or a slam onto the berry) |
| **Belch** | any, only right after eating a berry | A cone of 7 gas puffs at mixed speeds (lore: Belch needs a berry eaten) |
| Rest + Snore | at 66% / 33% | Unchanged: the interrupt window (it stays hittable) |
| Yawn | 2+ | Unchanged |
| **Fling** | 2+, needs rubble | Picks up the nearest rock (your Snore cover goes), throws it at your lead-aimed spot; it bursts into 3 shards that fly back in from the wall |
| **Heavy Slam** | 2+ | Crouch, leap out of reach while its **shadow chases you** slower than any player can run, lock (red ring), land: big ring, 3 rubble. Answers far kiting |
| **Block** | 2+, when you're 300+ px away | A chain holds you within 260 px for 5 s while it keeps attacking (tether, §2) |
| Belly Drum | start of 3 | Now a 1.5 s drumming animation |
| Hyper Beam | 3 | Unchanged |
| **Earthquake** | 3 | Stomp: the inner and outer bands hit, then the middle band (rhythm, safe-zone shift) |

- **Picker:** a weighted draw among the moves that are ready, in range and unlocked for the phase, never the same move
  twice in a row, with a 0.5 s pause between moves. Belch always comes first after Snorlax eats a berry.
- **Immune** (white shield ring, grey hit flash) during the **berry shake**, **Belly Drum** and **Heavy Slam in the
  air** (also untouchable then: no contact damage either way). **Rest is not immune**: it's the approved interrupt
  window.
- **Phase gate:** damage can't take Snorlax below its next Rest threshold until that Rest has started, so a burst
  can't skip a phase. Phase 3 has no gate.
- **Rubble is a wall for your shots too (owner 2026-10-23, D41):** a projectile that reaches a rock ends its flight
  there (its end-of-flight effects fire at the rock). Beams, melee and zones are unaffected. Snorlax hiding behind
  rubble is now real cover; Fling taking a rock opens the line again.

### Tier 1 candidates (2026-10-23): Machamp approved (D42), Kangaskhan DRAFT
Owner: "plan for tier 1 bosses 1st, let me see the moveset and how they execute them". Two strong regulars to join
Snorlax in the event-1 pool (D38). Both follow D31 (immune phase-change animations, phase gate, 10+ moves), §2
(speed alone doesn't solve them) and §2b (one projectile layer). Neither resists any starter's type, so both pass the
event-1 fairness filter for every starter. 6-min limit (D33); target fight ~60–90 s like Snorlax. Every number
provisional.

#### Machamp: "The dojo master" (Saffron Dojo). **Design approved (owner 2026-10-23, D42); tier 1; built**
**Built 2026-10-23** (`src/sim/machamp.ts`, numbers in `MACHAMP_KIT`, entrance: a dojo door). Where the build differs
from the text below: Low Sweep and Rock Tomb use the shared **slow** status (30%, 2 s, D36) rather than 40%; Seismic
Toss's 6% still goes through your damage-taken modifiers (and Shell can block it); Focus Blast homes with a turn
rate (a sharp turn shakes it); the rock shield has 3% of its max HP; Rock Throw cracks into 3 rocks.
Owner additions: a rock skill (grab a nearby rock or rip one from the ground, then throw it, shield-charge with it,
or rarely shield-pose with it: "a big element of surprise"); faster than Snorlax "since he so fit"; the openings
come from **flexing poses** between attack strings.

| | |
|---|---|
| **Types** | Fighting |
| **Damage taken** | **Flying ×2** (Charizard's Flying moves); every other starter type ×1 |
| **Ability: Guts** | While it carries a status **you** put on it (burn, poison, paralysis…), it hits ×1.3. The status still ticks. Build interaction: status builds speed the race up but make it scarier |
| **Speed** | **×1.4 Snorlax's**, but always **slower than the slowest starter**: kiting works, at a cost. Tuned with the balance bot |
| **Question it asks** | Can you read a combo string, then punish the pose, instead of kiting forever? |
| **Rough cost** | 🟡: cones, rings, dashes, rubble and interrupt bars exist; new: the X telegraph (two lines), the held-rock shield (rubble that moves with it), the throw (a push), the lob |

**Rhythm: attack, attack, pose.** After every **2–3 attacks** he stops and **flexes for 1.2 s** (0.8 s in phase 3).
This is **Bulk Up** and the fight's main opening:
- He never attacks straight out of a pose; every move after it still has its full telegraph.
- **Interruptible, not immune:** deal **4% of his max HP** during the pose and he's thrown off (no stack). Leave him
  alone and he gains a **Bulk Up stack: +15% damage, up to 3**, for the rest of the fight. The opening and the
  damage race are the same moment.

**The rock in hand (signature).** He takes a rock from within ~150 px (rubble, a Rock Tomb rock, a leftover
boulder) in 0.5 s, or **rips one from the ground** in 0.8 s (a small crater). The held rock is a **shield in front
of him**: it blocks your shots like any rubble (D41), and it has **HP**. **Break it at any point and he staggers
for 1.5 s** (a big opening for strong builds). Then, after a **0.4 s tell**, one of three follow-ups (never the same
one twice in a row):

| Follow-up | Weight | Tell | What happens | Answer |
|---|---|---|---|---|
| **Rock Throw** (ammo) | 45 | Rock raised **overhead** | Lobs it at a **lead-1** ring (0.9 s). It lands and **cracks into 2–3 rocks** around the landing spot, which can box you in | Change direction during the lob; don't get walled in |
| **Strength** (shield + charge) | 40 | Rock at the **chest**, crouched, feet scraping | Walks at you with **momentum**: ×0.6 → ×1.6 speed over 2 s, turning slowly (a sharp sidestep shakes him; running straight doesn't). Within 220 px or after 2.5 s he plants: a **locked line** (0.5 s), then the rock breaks into **3 boulders rolling along it** (5 in phase 3). They stop at the wall and **stay as rocks** (his next ammo, and cover for both of you). Recover 0.8 s | Flank him or break the shield; sidestep the line |
| **Iron Pose** (shield + Bulk Up) | 15 (25 in phase 3) | Rock **planted in front**, arms glowing | The pose behind his rock: shots from the front are blocked. Completed, it gives **2 stacks** | Run round his side and interrupt him there, or break the rock |

The rocks he leaves feed the next grab, so the rock moves come more often as the fight goes on.

| Move | Phase | How it executes | Answer |
|---|---|---|---|
| **Karate Chop** | 1+ | **3 chops** in a 70° cone in front, each re-aimed (lead 0) and stepping 30 px forward, gaps **0.7 / 0.55 / 0.4 s** (rhythm); 4 chops from phase 2. Recover 0.6 s | Timing; sidestep the last chop and punish |
| **Cross Chop** | 1+ | Crouch 0.3 s, leap to a **lead-0.5** spot; an **X telegraph** (two crossing 180 px lines) for 0.9 s, then lands. High damage; **recover 0.9 s** | Stand in a gap between the X's arms, then punish the long recover |
| **Low Sweep** | 1+, you within 120 px | A ring around itself, 0.6 s; slows you 40% for 2 s | Don't hug it when its legs glow |
| **Rock Tomb** | 1+ | Throws **3 boulders** at lead 1, a ring each (0.9 s); they stay **8 s as rocks** (block you and your shots; ammo for the rock in hand). Hit = slow 2 s | Rocks can trap you; keep a lane open |
| **Seismic Toss** | 1+, you within 90 px | A grab ring around it, 0.7 s. If you're inside when it closes: it **throws you 220 px** toward the arena wall (a push, never a stun) for **6% of your max HP** whatever your defences (lore: fixed damage) | Back off when the grab ring shows |
| **The rock in hand** | 1+ | Above: Rock Throw / Strength / Iron Pose | Read the tell |
| **Bulk Up pose** | after every 2–3 attacks | Above: the interruptible opening | Punish it |
| *Phase change 66%* | | **Immune 1.5 s:** it tears its belt (Focus Energy) | |
| **Bullet Punch** | 2+, you 120–260 px | A priority dash: tiny 0.35 s line telegraph, 260 px at ×4 speed, lead 0 | Answers "stand just outside melee": move sideways when it flashes |
| **Dynamic Punch** | 2+ | A charged fist: big ring (110 px) at **lead 0.5**, slow 1.2 s telegraph. Hit = heavy damage + **confusion 2 s** (lore: always confuses) | The ring is big but slow: leave early |
| **Focus Blast** | 2+ | A slow orb that **homes for 2.5 s** then flies straight; it has HP, so **your auto-fire can shoot it down** (§2b). Explodes in a ring | Kill it or shake it with a sharp turn |
| *Phase change 33%* | | **Immune 1.5 s:** No Guard stance (four arms spread). Poses shorten to 0.8 s | |
| **Focus Punch** | 3 | **2 s focus channel** with an **interrupt bar** (deal 5% max HP to break it; lore: fails if it's hit). If it completes: a **lead-0 line punch across the whole arena** | Go aggressive during the focus |
| **Close Combat** | 3 | A 5-hit flurry in a 90° cone (gaps 0.35 s), lead 0. Afterwards it takes **×1.5 for 3 s** (lore: drops its defences) | Survive it, then burst |

- **Picker:** weighted, never the same move twice, 0.5 s between moves (as Snorlax), and a Bulk Up pose after every
  2–3 attacks. Melee moves weigh more when you're close; Bullet Punch, Focus Blast and the rock in hand more when
  you're far, so kiting is answered.
- **Immune** only during the two phase-change animations (D31). The poses, the rock moves and Focus Punch are all
  hittable windows. **Phase gate** at 66% and 33%.
- **Player statuses used:** slow, confusion (both built, D36). The throw is a push (owner rule: no stun on the player).
- **Adds:** none (a dojo duel). Machop later if batch 3 adds it.
- **Detect** (draft) was dropped: the rock shield does the same job (a front guard you circle).
- **Provisional, tune after the first playtest:** Seismic Toss's 6% and 220 px; Guts ×1.3; the follow-up weights;
  the pose length and interrupt amount; the shield's HP.

#### Kangaskhan: "The Safari Zone mother"
| | |
|---|---|
| **Types** | Normal |
| **Damage taken** | Every starter type ×1 |
| **Ability: Parental Bond** (lore: Mega Kangaskhan) | While the **baby is in the pouch**, every punch or stomp **echoes**: the same telegraph lands again **0.3 s later at 50% damage**. The echo's outline is drawn with the first, so it's readable |
| **Question it asks** | Who does your auto-fire hit first? Kill the baby (the mother enrages) or leave it (the echoes return)? Your **position** picks the target |
| **Rough cost** | 🟡: the echo is a delayed copy of a telegraph (cheap); the baby is an add with its own small AI and HP bar |

**The baby.** About 12% of the mother's max HP, its own HP bar. Phase 1: safe in the pouch (untargetable), so every
punch echoes. At 66% it **hops out** and runs around on its own. If it's still alive at 33%, it **jumps back in**
(healed) and the echoes return, now at 70% damage. **If you kill it:** the mother does an **immune 1.5 s roar** and
becomes **Enraged** for the rest of the fight: ×1.25 speed, ×1.25 damage, half-length recover windows, Outrage
unlocked, and **no more echoes**. That choice is the fight.

| Move | Phase | How it executes | Answer |
|---|---|---|---|
| **Comet Punch** | 1+ | 4 jabs in a 60° cone, gaps 0.5 / 0.45 / 0.4 / 0.35 s, lead 0; each jab echoes | Step out, and **don't step back in** for the echo |
| **Dizzy Punch** | 1+ | A ring on you at **lead 0.5**, 0.8 s. Hit = **confusion 2 s**. Echoes | Change direction during the telegraph |
| **Stomp** | 1+ | A ring on you at lead 0, 0.7 s; hit = slow 1 s (lore: flinch). The echo lands on the **same spot** 0.3 s later | Leave the ring and stay out |
| **Double-Edge** | 1+ | Line charge: 0.8 s telegraph, 280 px dash at ×3 speed. **Recoil:** she loses 3% of her max HP. Recover 0.7 s | Sidestep; the recoil is free damage |
| **Fake Out** | first move of each phase, and right after the baby hops out | A fast 0.4 s clap ring around her; only hits if you're hugging her; slow 1 s | Don't stand on her at a phase change |
| *Phase change 66%* | | **Immune 1.5 s:** the baby hops out (Fake Out follows) | |
| **Baby: Bite / Tackle** | 2 (baby out) | The baby runs at you and lunges (0.5 s line, short) | Moving away drags it from the mother |
| **Baby: Mud-Slap** | 2 (baby out) | The baby kicks a **mixed-speed fan** of 5 mud pellets (lanes, §2b); hit = slow 1 s | Read the lanes |
| **Guard the baby** | 2, baby below 50% | The mother **dashes to stand over the baby** and raises a guard arc facing you (locked) for 3 s: shots from the front blocked | Circle round, or switch to hitting her |
| *Phase change 33%* | | **Immune 1.5 s:** the baby returns to the pouch (if alive) or the Rage roar (if not) | |
| **Hammer Arm** | 3 | A huge ring (130 px) at lead 0.5, 1.1 s; afterwards **she is slowed ×0.6 for 3 s** (lore: lowers her speed) | Leave early, then punish the slow window |
| **Drain Punch** | 3 | A lead-0 cone punch, 0.6 s; heals her **by the damage it deals you** | Don't get hit: it's a damage race |
| **Hyper Voice** | 3 | A cone of **sound bars** rolling out at 3 speeds (lanes). Echoes if the baby is in | Read the lanes |
| **Outrage** | Enraged only | **3 dashes** at you, re-aimed each time (rhythm 0.6 / 0.5 / 0.4 s), then **confused 3 s**: she wobbles and takes ×1.5 | Survive three, then burst |

- **Phase gate** at 66% and 33% (D31). Immune only during the phase-change animations and the Rage roar.
- **Player statuses used:** confusion, slow (built, D36).
- **Flagged for owner approval:** Parental Bond as the identity (it's Mega Kangaskhan's ability); the echo at 50% → 70%; Enraged numbers; whether the baby gives XP.

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

**Full kit for building (DRAFT for owner approval, 2026-10-23).** The owner asked overnight to design "the next
boss". Articuno is the next arena boss to build. This expands it to the D31 standard: immune phase-change
animations, a phase gate, 10+ kinds of moves, the projectile layer (§2b), Pressure, a 6-min limit (D33), and Seel adds
from batch 3.

| Move | Phase | What it does | Answer |
|---|---|---|---|
| **Ice pillars** | all | 5 pillars (HP) stand around the arena and regrow 25 s after breaking. **Fire hits melt them** | Your cover; Fire players must aim around it |
| **Ice Shard** | 1+ | Fans of 5 at mixed speeds (lead 1); a shard that hits a pillar **splits into 3** | Read the lanes |
| **Blizzard** | 1+ | A sweep across the whole arena from one side, 1.5 s warning (the side is shown) | Stand behind a pillar |
| **Icy Wind** | 1+ | 2 boomerang crescents that fly out and come back; they slow you 1 s | Step across their return path |
| **Ice Beam** | 1+ | A line beam (lead 0, 0.9 s); it leaves a **frozen strip** for 4 s that slows you while you stand on it | Don't fight on the strip |
| **Roost** | once per phase, after losing 12% in it | Lands and heals 15% over 3 s, **loses Flying** (Electric ×2 → ×1, Rock and Steel now matter) | The damage window, **not immune** |
| **Mist** | at 66%: **immune 1.5 s animation** | Then, every 20 s, 6 s of mist: no status lands on it (visible) | Save control moves for after the mist |
| **Mean Look** | 2+ | During a Blizzard: a tether holds you within 260 px of it | Find cover inside the leash |
| **Freeze-Dry** | 2+ | 3 rings on you in rhythm (gaps 0.8 / 0.6 / 0.4 s). Lore: super effective on Water, so Squirtle and Lapras take ×1.5 | Timing |
| **Reflect** | 2+ | A shimmering wall in front of it for 4 s; your projectiles through it deal ×0.5 | Go around; beams and areas are unaffected |
| **Sheer Cold armour** | at 33%: **immune 1.5 s animation** (Freeze-over) | Then it takes ×0.25 until it has taken 8% of max HP in super-effective hits (Fire, Steel; Rock and Fighting later); it reforms once after 30 s | A build check |
| **Whirlwind** | 3 | A gust pushes you ~120 px (a push, never a stun) | Mind the arena wall |
| **Hurricane** | 3 | A slow tornado drifts across the arena for 5 s and pulls you gently toward it (a small velocity nudge) | Keep moving across its path |
| **Adds: Seel ×3** | 3 | Batch-3 Seel (Icy Wind slows); one is an Elite with Thick Fat | Pick targets |

- **Types and defence:** as above. Starters: Charmander is strong here (pillars and armour) but loses its cover. Squirtle and Lapras take Freeze-Dry ×1.5. Lapras resists the slows ×0.25.
- **Player statuses used:** slow only, from Icy Wind, Ice Beam's strip and Seel. **No freeze on the player** (README §10).
- **Rough fight length:** about 3–4 min at the 6-min limit, assuming the pillars and armour are played right.
- **Flagged for owner approval:**
  - Freeze-Dry's ×1.5 on Water starters (a player-side type twist)
  - Hurricane's pull (a push or pull, never a stun)
  - Mist's 20 s cadence

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
| **1** | **Generators:** 3 pylons power a **shield** (Zapdos takes ×0.25 while any pylon is up). Break them; they are rebuilt after 35 s (owner 2026-10-23; was 20 s). **Thunder:** strikes with **bracket** aim (one on you, one ahead). **Drill Peck** dash (lead 1) |
| **2 (below 66%)** | **Electric fences:** dashes across the arena, leaving lightning lines that **split it into zones** for 4 s. Thunder becomes a **rhythm combo** (3 strikes, shrinking gaps) |
| **3 (below 33%)** | **Rain Dance** (arena only): Thunder hits **instantly in puddles** and puddles spawn. Standing in water means paralysis, so Squirtle and Lapras must mind their own puddles. **Charge → Discharge:** a 2 s channel with an **interrupt bar**, then a full-arena shock with a single safe ring |
| **Lightning Rod** | A player with the Lightning Rod trait **pulls Thunder onto themselves**: they take the hit, but it fills their Charge meter. A brave-Pikachu payoff |
| **Roost** | As Articuno: loses Flying while roosting (pure Electric: Ice drops to ×1, Grass to ×1; Electric becomes ×0.5) |
| **Projectiles** | **Shock Wave:** homing bolts (lore: never misses) with a strong turn rate but only a **2.5 s timeout**. **Thunderbolt:** **zigzag** sine-wave bolts in a 3-way fan. Shock Wave plus electric fences is the phase 2 squeeze |
| **Adds** | Voltorb and Magnemite from the Power Plant (lore-correct) |

**Built as an arena boss (D32, 2026-10-22); a tier 2 boss (D38).** Arena event N draws a tier-N boss: tier 1 is the
strong regulars (Snorlax) at ~6:30, tier 2 the legendary birds at ~12:30, one tier below Mewtwo. It follows D31's rules: special animations are immune, there's a phase
gate, and it has 10+ kinds of moves. All numbers are in `ZAPDOS_KIT` (provisional).

| Move | Phase | What it does |
|---|---|---|
| Generators | all | 3 pylons (real enemies your auto-fire targets, no XP) shield Zapdos ×0.25; a broken one is rebuilt after 35 s (owner 2026-10-23; was 20 s) |
| Overload | all | **D38 (owner 2026-10-23).** All generators down **at the same time**: Zapdos crashes for **5 s** (no moves, grounded, takes **×1.5**; its live hazards fizzle), then is **Weakened 5 s** (×0.6 speed; telegraphs, casts and cooldowns run ×1.5 slower). The phase change waits out the crash. After an Overload all 3 generators rebuild **together** 35 s after the crash, so breaking one rebuilt pylon never re-triggers it |
| Thunder | 1+ | Bracket: one ring on you, one where you're heading (0.9 s) |
| Drill Peck | 1+ | Lead-aimed line, then a dash along it |
| Shock Wave | 1+ | 3 homing bolts that give up after 2.5 s and fly straight |
| Thunderbolt | 1+ | A 3-way fan of zigzag bolts |
| Roost | once per phase, after losing 12% in it | Lands, heals 15% over 3 s, **loses Flying** (Ice ×2 → ×1): the damage window, not immune |
| Charge-up | at 66% | Immune 1.5 s animation into phase 2 |
| Thunderstorm | 2+ | 3 strikes on you, gaps 0.8 / 0.6 / 0.4 s |
| Zap Cannon | 2+ | Slow, lazily homing ball that paralyses |
| Electric Fence | 2+ | A line across the arena beside you; Zapdos zips along it and it stays live 4 s |
| Agility | 2+ | Zips to the far side of the arena, then flies ×1.5 for 4 s |
| Rain Dance | at 33% | Immune 1.5 s animation; then puddles keep appearing and **any Thunder hits you if you stand in a puddle** (and paralyses) |
| Discharge | 3 | 2 s channel (deal 5% of max HP to interrupt), then the whole arena shocks except one safe ring |

- **Movement:** it hovers about 260 px from you, drifting sideways; it never chases to contact.
- **Pressure:** your move cooldowns run 15% slower during the fight.
- **Lightning Rod:** every Thunder lands on you; the hit fills Charge.
- **Paralysis on the player** (first player status, README §10): −35% speed with a 0.2 s heavier stutter at the
  start, never a stun. The duration follows the starter's types: Electric ×0.25, Water or Flying ×1.5.
- **Adds (Voltorb, Magnemite) are not built yet:** those enemies don't exist in the game.

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
