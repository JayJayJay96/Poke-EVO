# PokeSurvivorEVO — Design Doc (P0 draft)

**Status:** DRAFT · owner answered D1–D8 on 2026-10-17
Everything marked *(provisional)* is a starting value for playtesting, not a decision.

---

## 1. Pitch
A Pokémon survivor-like game for the PC browser. **There are fewer Pokémon, each with a different way to play, evolution is the power spike of the run, and every move is built your own way.**
You start a 15-minute run as a Kanto starter, auto-fire moves at hordes of wild Pokémon, socket augments into your moves, evolve during the run, beat rift legendaries to combine skills, and defeat the final boss at 15:00.

**Audience:** a private learning project, shared with friends for feedback through an unlisted link. It is a non-commercial fan project, not affiliated with Nintendo, Game Freak or The Pokémon Company, and it will never be monetised.

## 2. Design pillars (every feature is tested against these)
1. **Kit over stats.** Each Pokémon line plays differently. Stats are the *smallest* difference between characters.
2. **Evolution is the climax.** Evolving mid-run must be the best moment of the run.
3. **Readable chaos.** Every danger is telegraphed, and every death feels fair.
4. **Build your own mon.** Two players with the same move should be able to end up with different playstyles.

## 3. Core loops
| Loop | Length | What the player decides |
|---|---|---|
| Moment | seconds | Where to stand: dodge, kite, collect XP |
| Run | 15 min | Which moves, which augments in which sockets, which items, which moves to combine |
| Meta | across runs | *(later, P7)* unlocks only, no gacha. Prefer unlocking **new augments** (more options) over permanent stat boosts |

**Controls (PC):** WASD/arrows to move, Esc to pause, 1/2/3 to pick a card, R to reroll. All equipped moves auto-fire (D1); 1–4 switching only if the active-move model is adopted after playtest.

## 4. Pokémon kit template (every line has exactly these 4 slots)
| Slot | Meaning |
|---|---|
| **Ability** | A unique passive that defines the playstyle. It can boost specific move tags (§8.7) |
| **Signature move** | Only this line has it. One tier per evolution stage (3-stage line = 3 tiers); non-evolvers unlock tiers by level *(provisional)*. 3 sockets plus exclusive augments |
| **Learnset** | 6–8 moves drawn from the shared move pool. This is the line's own subset, not "all moves of its type" |
| **Evolution** | Stage levels, plus what changes (stats, sprite size, signature tier → new tags) |

### 4.1 Kit rules (owner decision D14, 2026-10-18)
Every line's kit follows these, checked in review and (where possible) by a unit test:
1. **Mostly own-type moves**: at least half the learnset matches the line's types, so STAB rewards staying on theme.
2. **One basic Normal move** at most.
3. **Off-type only when iconic** for the line (Charizard → Dragon Rage, Blastoise → Flash Cannon).
4. **The final stage unlocks 1–2 moves** tied to what it becomes.
5. **Every learnset move uses a different form** where possible, so augment builds differ.
6. **Every move supports the line's role.**

## 5. Evolution tiers — the early-vs-late gamble (owner decision D3, 2026-10-17)
Choosing a Pokémon is a bet on **when** you want to be strong:

| Tier | Example | Start | Ceiling |
|---|---|---|---|
| **3-stage line** | Charmander → Charmeleon → Charizard | Weakest, smallest | **Highest** final-form stats and most kit unlocks |
| **2-stage line** | Pikachu → Raichu | Medium | Medium |
| **Non-evolving** | Lapras | **Strongest** from minute 1 | Lowest; must snowball power-ups early |

- Each evolution: sprite grows, stats rise, the signature move upgrades and **gains tags** (§8.6).
- Balance target: a non-evolver should be ahead at ~5 min, roughly level by ~9 min, and behind a fully evolved 3-stage at 15 min. *(provisional)*
- Evolution levels Lv 10 (~3–4 min) and Lv 25 (~8–9 min); 2-stage lines evolve once at ~Lv 16; target ~Lv 40 by 15:00. *(provisional)*

## 6. Starter lines *(all provisional)*
Each signature tier keeps its previous tags and adds new ones (§8.6).

### Charmander → Charmeleon → Charizard — *aggressive glass cannon*
- **Ability, Blaze:** below 30% HP, damage +50%. It rewards risky play.
- **Signature:**
  - Ember `[Fire, Projectile]`: fireball at the nearest enemy
  - → Flame Burst `[+Area]`: fireball explodes on impact
  - → Blast Burn `[+Zone]`: huge explosion that leaves a burning crater
- **Learnset:** Scratch, Fire Spin, Smokescreen, Dragon Rage, Wing Attack, Slash.
- **Evolution twist:** Charizard flies, gaining move speed and ignoring ground hazards.

### Squirtle → Wartortle → Blastoise — *tank / control* (Water; owner-approved kit D13)
- **Ability, Shell:** blocks one hit every 8 s, shown as a visible bubble.
- **Signature:**
  - Bubble `[Water, Projectile]`: slowing bubbles
  - → Water Pulse `[+Pulse]`: bubbles burst into a knockback ring
  - → Hydro Cannon `[+Area]`: heavy shot with a big knockback burst
- **Learnset (redesigned D14):** Withdraw (Water, short 360° shell bash: stagger + brief stun), Rapid Spin (Normal orbit), Water Gun (Water beam that pushes along it), Whirlpool (Water zone at target: strong slow + damage), Surf (Water 360° wave). **Blastoise only:** Hydro Pump (Water heavy beam), Flash Cannon (Steel piercing shot).
- **Knockback is a stagger** (D14): small pushes (10–30 px) that stop enemies advancing rather than shove them away.
- **Final trait pick:** Torrent+ (low-HP Water boost) or Rain Dish (regen).

### Bulbasaur → Ivysaur → Venusaur — *sustain / zones / damage over time* (Grass/Poison; D13)
- **Ability, Leech:** 3% of damage dealt heals you.
- **Signature:**
  - Vine Whip `[Grass, Melee]`: two side lashes
  - → Power Whip `[+Area]`: 360° vine sweep
  - → Frenzy Plant `[+Zone]`: root field dropped on the nearest enemy
- **Learnset:** Tackle, Razor Leaf, Leech Seed (DoT that heals), Poison Powder (poison zone), Sleep Powder (sleep zone), Sludge, Petal Dance. **Venusaur only (kit rule 4):** Solar Beam (heavy Grass beam).
- **Final trait pick:** Overgrow+ or Chlorophyll (speed).

### Pikachu → Raichu (Lv 16) — *speed / chain* (Electric; 2-stage gamble line, D13)
- **Ability, Static:** enemies touching you get paralysed.
- **Signature:** Thunder Shock `[Electric, Projectile]` (chains to 2 enemies) → Thunderbolt `[+Area]` (chains to 3). Chain is innate to this signature only, capped at 3 jumps; no Chain augment until P5.
- **Learnset:** Quick Attack, Spark, Electro Ball, Thunder Wave, Iron Tail. **Raichu only (D14):** Thunder.
- **Final trait pick:** Static+ or Lightning Rod.

### Lapras — *early bulldozer* (Water/Ice; non-evolver gamble line, D13)
- **Ability, Shell Armor:** take −15% damage.
- **Signature, tiers by level (Lv 10 / 25):** Ice Shard `[Ice, Projectile]` → Frost Breath `[+Area]` → Sheer Cold `[+Zone]` (freezing field that slows).
- **Learnset:** Body Slam, Surf, Ice Beam, Hydro Pump.
- **No trait pick** (no evolution); strongest start, lowest ceiling (§5).

**Test:** a tester must be able to describe each playstyle in one sentence without being told.

## 7. Run structure (15 min) *(provisional)*
| Time | Event |
|---|---|
| 0:00–3:00 | Fodder: Rattata, Pidgey, Caterpie, Weedle |
| ~2:30 | Rift 1 |
| ~3:30 | Evolution 1 (Lv 10) |
| 4:00 | Elite (Raticate) drops a chest |
| ~5:30 | Rift 2 |
| 7:30 | Mid-boss (e.g. Snorlax, a tank that blocks paths) |
| ~8:30 | Evolution 2 (Lv 25) + Rift 3 |
| 10:00–14:59 | Heavy waves; Rift 4 at ~11:30 |
| **15:00** | **Final boss: Mewtwo.** Win → victory screen. Death → results screen |

## 8. Skill building (owner decision D7, 2026-10-17)
Inspired by PoE support gems: every move is built your own way through augments.

### 8.1 Tags
Every move has 3 kinds of tags:

| Kind | Values |
|---|---|
| **Type** | Grass, Fire, Water, Electric, … |
| **Form** (how it hits) | Projectile, Area, Beam, Melee, Aura, Zone, Orbit |
| **Flag** (Pokémon move flags) | Slicing, Punch, Bite, Pulse, Sound, Wind, Ball, Contact |

Example: Razor Leaf = `[Grass, Projectile, Slicing]`.

### 8.2 Sockets
- Every move has **3 augment sockets**.
- The signature move also has 3 sockets, and its pool includes **augments exclusive to that line** (e.g. Blast Burn "Mega Flare").

### 8.2a Augment ranks (owner decision D8, 2026-10-17)
- The same augment **can't sit in two sockets** of one move.
- Instead, an owned augment can show up again in the pool as its **next rank**. Picking it upgrades it **in the same socket**.
  - Example: Razor Leaf Multishot I (+1 projectile) → II (+1) → III (+2).
- Max rank **III** *(provisional)*.
- Every augment level becomes a choice between **breadth** (a new augment in an empty socket) and **depth** (ranking up one you already own).
- Rank-ups still pay the projectiles-per-second budget (§8.6): each Multishot rank also costs cooldown.
- Some behaviour augments are **single-rank** because of the engine caps: Fork, Return, Homing. Chain ranks I–III equal chain 1/2/3, which matches the Chain ×3 cap.
- Proposals:
  - Rank III gives a small bonus effect (a "keystone"), e.g. Multishot III fans projectiles in a full circle.
  - Next-rank cards appear at **normal weight**, so a rank III is rare and feels earned.

### 8.3 Level-up rhythm
```
Lv 1  2  [3]  4  5  [6]  7  8  [9] ...
     normal normal AUGMENT ...
```
- **Normal level** (one window, 3 cards): a new learnset move, a generic boost (HP, global cooldown, damage, walk speed, pickup radius, crit), or a held item.
- **Augment level** (every 3rd level; gold frame and special sound): the 2-window flow (§8.4).
- **Math (15 min, ~Lv 40):** 13 augment levels vs 15 sockets (4 moves + signature × 3), and up to 45 ranks. Nothing close to everything can be filled, so every augment is a choice. *(provisional)*
- **Fallback:** if every socket is full and every augment is at max rank, an augment level gives a bigger generic boost. There is never a dead level.

### 8.4 Augment flow
1. **Window 1:** pick which skill to augment (shows its free sockets).
2. **Window 2:** 3 augments drawn from that skill's tag pools + a **Reroll** button.
   - Cards for augments you already own show as the next rank, e.g. "Multishot II ⬆", with rank pips.
   - If the skill has no empty socket, only rank-up cards are offered.
   - Rerolls are limited: 2 per run *(provisional)*, more from items/unlocks later.

### 8.5 Augment kinds and example pools
| Kind | Example |
|---|---|
| **Stat** | +damage, −cooldown, +area, +duration, +crit |
| **Trade-off** (owner approved) | Concentrated: −40% area, +50% damage · Scatter: +3 projectiles, −30% damage each, cooldown ×2 · Slow Burn: −50% hit damage, burn ×3 duration · Glass: +80% damage, take +20% damage |
| **Behaviour** | Fork, Chain, Pierce, Homing, Return, Seed (killed enemies sprout a vine trap), Echo |

| Tag | Example pool |
|---|---|
| Projectile | Multiple, Fork, Chain, Pierce, Homing, Return, Split, Faster |
| Area | Bigger radius, Echo, Pull, Concentrated, Linger |
| Beam | Wider, Longer, Sweep, Overcharge |
| Melee | Wider arc, Knockback, Cleave, Combo |
| Grass | Leech, Seed, Spore (sleep chance), Bloom |
| Fire | Burn, Ignite spread, Heat |
| Water | Soak (slow), Wave knockback, Splash |
| Slicing | +Crit, Bleed, Execute |
| Any move | +damage, −cooldown, +duration, +crit |

### 8.6 Rules (owner approved 2026-10-17)
- **Evolution only adds tags, never removes them.** Socketed augments on the signature move stay valid forever. New tags open new augment pools.
- **Learnset moves never change.** A move you keep stays that move, with its augments.
- **Combined skill (rift reward):** the 4 moves' behaviours fire together on **one shared cooldown** (the longest of the 4). It inherits all 12 augments and gets no new sockets.
  - Optional cross-type bonus from the tag union, e.g. Fire + Grass → "Wildfire". *(proposal)*
- **Projectiles-per-second budget:** every augment that adds projectiles is paid for with cooldown and/or damage per projectile, so projectiles/sec stays roughly flat.
- **No proc-from-proc:** an effect triggered by another effect can't trigger further effects.

### 8.7 Ability ↔ tag links *(proposal, tuned in P4)*
Abilities boost specific tags, so the Pokémon you pick decides which builds are strongest on it. Examples:
- Sharpness: Slicing +50%.
- Iron Fist: Punch moves get a 4th socket.
- Mega Launcher: Pulse moves get a bigger area.

Starter abilities get retuned to fit this.

### 8.8 Data shape
```
Augment
 ├ requires tags:   ["Projectile"]
 ├ stat mods:       { projectiles: +3, cooldown: ×2, dmgPerProj: ×0.7 }
 └ hook (optional): onCast | onHit | onKill | onExpire → small named function
```
Most augments are data only. Behaviour augments are small, individually tested functions. Pools filter by tag automatically.

## 9. Other systems
- **Held items** (passives, may boost tags): Leftovers (regen), Choice Band (+damage), Quick Claw (−cooldown), Wide Lens (+Area), Scope Lens (+crit for Slicing), Exp. Share magnet (+pickup radius), Shell Bell (lifesteal). 3 item slots.
- **Type chart (pulled into P4, D14):** the real chart, ×2 / ×0.5 per type, multiplied for dual-type enemies; **immunities become ×0.5**, so a move is never useless. A move's attack type is its first Pokémon-type tag; burn/poison ticks are typeless. Hits flash **yellow** when super effective, **grey** when not very effective.
- **Weight → knockback resistance (D14):** every enemy has its real weight; resistance = weight ÷ (weight + 25 kg) (Pidgey 7%, Rattata 12%, Raticate 43%, Snorlax 95%).
- **Enemy archetypes:** fodder (Rattata), fast (Pidgey), tank (Geodude), ranged (Spearow), exploder (Voltorb), healer (Chansey), teleporter (Abra). Danger zones are always telegraphed.
- **Rift (owner requirement):** a portal leads to a legendary arena (Articuno / Zapdos / Moltres). **Winning grants a combine step.** Losing sends you back to the map.
- **Skill combine** *(owner, D2)*: a 15-min run has **4 rifts**; clearing all 4 builds **1 combined skill from 4 moves** (§8.6). 30-min mode (later): 8 rifts → 2 combos.
  - Per-rift step *(proposal)*: Rift 1 → pick a move with all 3 sockets filled as the combo base (it gains a bonus). Rifts 2–4 → each absorbs one more fully socketed move into it, freeing that move's slot for a new card.
  - A missed or lost rift is gone, so a full combo is a reward, not a given.
  - The signature move can't be combined.

## 10. Explicitly OUT of MVP
Online play, accounts, co-op, gacha, mobile/touch, all 151 Pokémon, shinies, weather, global leaderboards, monetisation.

## 11. Tech (owner decision D6: browser-playable like PokéSurvivor)
- TypeScript + Vite + **Phaser** (scenes, cameras, input, audio, arcade physics). Exact version checked against current docs at P1 setup.
- Data-driven from day one: Pokémon, moves, augments, enemies, waves and items live as typed data, not hardcoded.
  - This also lets every creature be reskinned later if the project ever goes public.
- Deploy as a static site with an unlisted Vercel link for friends.

### 11.1 Performance budgets *(provisional numbers, enforced from P2)*
| Budget | Rule |
|---|---|
| Enemies | About 300–400 alive; the spawn director respects the cap |
| Projectiles | About 500 active, pooled; when full, extra spawns merge into bigger hits |
| Chain reactions | No proc-from-proc; Fork ×1 and Chain ×3 caps |
| Damage over time | Ticks every 0.25 s, not every frame |
| Damage numbers | One aggregated number per enemy per 0.2 s |
| Sound | Same hit sound throttled to N per 100 ms |
| Collisions | Spatial hash grid for every hit and area query |
| Target | 60 fps on a mid-range laptop in the **stress-test scene** (500 enemies + max build) |

**Avoid entirely:** real pathfinding (enemies walk straight toward you plus a push-apart force), per-hit particle bursts (use flash/tint), physics pull on crowds (use a small velocity nudge), per-entity shaders.

### 11.2 Augment build order (cost tiers)
| Tier | Kind | Phase |
|---|---|---|
| 🟢 Cheap | Stat and trade-off numbers | P2 |
| 🟡 Medium | Single-projectile behaviour: pierce, homing, knockback, slow, burn/poison, lifesteal, return | P3 |
| 🟠 Expensive | Spawns new things: fork, chain, split, multiple, echo, lingering zones | P5, with caps |
| 🔴 Dangerous | Chain reactions on kill (seeds, ignite spread) | Later, only with no proc-from-proc |

## 12. Delivery phases
| Phase | Build | Gate (must be "yes" to continue) |
|---|---|---|
| **P0** | This doc + AGENTS.md + PROJECT_STATUS.md | Pitch fits in one sentence; decisions answered |
| **P1** | Toy: Charmander moves, Ember auto-fires, Rattata chases, HP/death/restart. Grey boxes | Is moving and dodging fun for 3 min? |
| **P2** | Run loop: XP, normal/augment level rhythm, 2-window augment flow + reroll, tags + 3 sockets, ~10 🟢 augments, learnset moves, held items, 15-min timer, basic spawn director, **stress-test scene + budgets** | Do testers press "play again" unasked? Do two testers build the same move differently? |
| **P3 ★** | In-run evolution for the Charmander line: signature tiers gain tags, exclusive augments, 🟡 augments | Is evolving the best moment of the run? |
| **P4 ★** | Squirtle + Bulbasaur lines, Pikachu (2-stage) and Lapras (non-evolver), ability ↔ tag links | Do the starters feel truly different? Is picking a tier a real gamble? |
| — | **If P3/P4 fail, rethink before building more** | — |
| **P5** | Enemy archetypes, telegraphs, mid-boss, Mewtwo, type chart, rifts + skill combine, 🟠 augments | Are deaths fair? Is the rift worth the risk? Still 60 fps? |
| **P6** | Endless chunked map, game feel (hits, numbers, shake), sprites, audio | Does a friend smile within 1 min? |
| **P7** | Local save, unlocks (new augments), starter select, more Kanto lines via the template | Is there a reason to come back? |
| **P8** | Polish, balance pass, deploy unlisted link for friends | Friends' feedback collected |

## 13. Decisions
| # | Topic | Status |
|---|---|---|
| D1 | Move firing | **Approved:** (a) all equipped moves auto-fire first; playtest (b) active-move switching later |
| D2 | Skill combine | **Approved 2026-10-17:** MVP run = 15 min with **4 rifts → 1 full 4-skill combo**. Later mode: 30 min, 8 rifts → 2 combos. Per-rift step = proposal in §9 |
| D3 | Evolution | **Approved concept:** early-vs-late gamble (§5). Exact levels/stats provisional |
| D4 | Sprites | **Approved:** grey boxes first; owner researches sprite source. Needed format: top-down multi-direction sprite sheets (PNG + frame data). Lead: PMD SpriteCollab (what PokéSurvivor credits, CC BY-NC 4.0: non-commercial + credit). Gen 5 animated GIFs are front/back battle views, wrong angle for top-down |
| D5 | Title | **Approved:** PokeSurvivorEVO |
| D6 | Engine | **Approved:** browser-playable; Phaser recommended |
| D7 | Skill building | **Approved 2026-10-17:** tags + 3 sockets per move; augment level every 3rd level; 2 windows + limited reroll; signature = 3 sockets + exclusives; trade-offs yes; evolution only adds tags; combined skill = 4 behaviours on one shared cooldown with 12 inherited augments |
| D8 | Augment stacking | **Approved 2026-10-17:** no duplicate sockets; an owned augment ranks up I → III in its socket when picked again (§8.2a). Rank values, rank III bonus and card weighting provisional |
| D14 | Kit rules + Squirtle rework | **Approved 2026-10-18:** kit rules §4.1; Squirtle redesigned (Withdraw, Rapid Spin, Water Gun, Whirlpool, Surf; Blastoise-only Hydro Pump + Flash Cannon; Ice Beam/Bite/Tackle removed); knockback becomes a small stagger (innate 10–30 px, Knockback augment 20/35/55); Raichu unlocks Thunder; **type chart + weight-based knockback resistance pulled into P4** |
| D13 | P4 scope | **Approved 2026-10-17:** simple starter select screen in P4 (polish stays P7); every evolving line's final stage offers a trait pick (Lapras none); Pikachu's signature chains innately, capped at 3 jumps (Chain augment stays P5); kits per §6 as the starting point (numbers provisional) |
| D12 | P3 re-playtest revisions | **Approved 2026-10-17:** healing = **rare Oran Berry drops** (no flat regen; Raticate often, others rarely; walk over to heal); "damage taken" trade-offs (Glass) stay **+10/15/20%** but are **shown clearly** (HUD + red damage numbers on the player); **Back** from the augment cards to move selection (cards kept per move, so Back is not a free reroll); Return gets a trade-off (−30% damage, provisional) |
| D11 | P3 playtest revisions | **Approved 2026-10-17:** evolution cinematic **5 s, skippable after 2 s**; Blast Burn crater spawns **once per projectile** (Pierce can't chain craters); **augment replacement**: with full sockets the window still shows 3 cards and a new augment replaces a chosen socket at rank I (Back to cancel); each augment window **guarantees ≥ 1 behaviour/exclusive card** when available; **Pokémon types per stage** (Charizard = Fire/Flying) unlocking stage-gated Flying moves + **STAB +20%** for moves matching the Pokémon's types; **Charizard chooses 1 of 2 traits** at evolution (Blaze+ or Solar Power). Numbers provisional |
| D10 | P3 scope | **Approved 2026-10-17:** evolution triggers automatically at Lv 10/25; ~2 s cinematic (pause, flash, grow) + "what changed" card; P3 behaviour augments = Pierce, Homing, Return, Knockback, Burn, Lifesteal; Charmander-line exclusives = Blaze Core (any tier) + Mega Flare (Blast Burn only). Stage stats provisional |
| D9 | P2 scope | **Approved 2026-10-17:** Pidgey/Raticate as stat-only variants until P5; P2 learnset = Scratch, Fire Spin, Dragon Rage (+Ember); 15:00 shows "Survived!" until the final boss exists; generic boosts max 5 picks each *(provisional)* |
