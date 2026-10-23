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
- Balance target: a non-evolver should be ahead at ~5 min, roughly level by ~9 min, and behind a fully evolved 3-stage at 15 min. At 15 min the 2-stage and the non-evolver are roughly equal, both below every 3-stage final form (D19). *(provisional)*
- Evolution levels Lv 10 (~3–4 min) and Lv 25 (~8–9 min); 2-stage lines evolve once at ~Lv 16; target ~Lv 40 by 15:00. *(provisional)*

## 6. Starter lines *(all provisional)*
Each signature tier keeps its previous tags and adds new ones (§8.6).

### Charmander → Charmeleon → Charizard — *aggressive glass cannon*
- **Ability, Blaze:** below 30% HP, damage +50%. It rewards risky play.
- **Signature:**
  - Ember `[Fire, Projectile]`: fireball at the nearest enemy
  - → Flame Burst `[+Area]`: fireball explodes on impact
  - → Blast Burn `[+Zone]`: huge explosion that leaves a burning crater
- **Learnset:** Scratch, Fire Spin, Smokescreen, Dragon Rage, Wing Attack, Slash (from Charmeleon, D15). Mutation trees: `docs/moveset/charmander/`.
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
  - Vine Whip `[Grass, Melee]`: a narrow lash toward the nearest enemy; the tip hits hardest (D30)
  - → Power Whip `[+Area]`: the lash's tip cracks into a burst (D30)
  - → Frenzy Plant `[+Zone]`: roots erupt along the lash (D30)
- **Learnset:** Tackle, Razor Leaf, Leech Seed (DoT that heals), Poison Powder (poison zone), Sleep Powder (sleep zone), Sludge, Petal Dance. **Venusaur only (kit rule 4):** Solar Beam (heavy Grass beam).
- **Final trait pick:** Overgrow+ or Chlorophyll (speed).

### Pikachu → Raichu (Lv 16) — *speed / chain* (Electric; 2-stage gamble line, D13)
- **Ability, Static:** enemies touching you get paralysed.
- **Signature:** Thunder Shock `[Electric, Projectile]` (chains to 2 enemies) → Thunderbolt `[+Area]` (chains to 3). Chain is innate to this signature only, capped at 3 jumps; no Chain augment until P5.
- **Learnset:** Quick Attack, Spark, Electro Ball, Thunder Wave, Iron Tail. **Raichu only (D14):** Thunder.
- **Final trait pick:** Static+ or Lightning Rod.

### Lapras — *early bulldozer* (Water/Ice; non-evolver gamble line, D13)
- **Ability, Shell Armor:** take −15% damage.
- **Signature, one tier by level (Lv 25, D17/D18):** Ice Shard `[Ice, Projectile]` → Sheer Cold `[+Area, +Zone]` (freezing field that slows) (D18). Built in P4f-1 (Frost Breath removed from the code). Mutation trees: `docs/moveset/lapras/`.
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
- **Normal level** (one window, 3 cards): a new learnset move or a generic boost (HP, global cooldown, damage, walk speed, pickup radius, crit). Held items and Mutations come only from Mutation Sites (D16, D23).
  - **Approved, not built (D40):** the generic boosts become **Techniques** (ranked I–III passives that react to what the player does, 5 slots, some tied to move tags) and **Natures** (trade-off stats, 3 picks each). Spec: [`docs/superpowers/specs/2026-10-23-techniques-natures-design.md`](docs/superpowers/specs/2026-10-23-techniques-natures-design.md).
- **Augment level** (every 3rd level; gold frame and special sound): the 2-window flow (§8.4).
- **Math (15 min, ~Lv 40):** 13 augment levels vs 15 sockets (4 moves + signature × 3), and up to 45 ranks. Nothing close to everything can be filled, so every augment is a choice. *(provisional)*
- **Banked (D39):** level-ups wait in a bank until the player opens them (Space / badge), or open on their own at 3 banked or after 30 s, never during an arena fight.
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
| **Trade-off** (owner approved) | Concentrated: −40% area, +50% damage · Scatter: +3 projectiles, −30% damage each, cooldown ×2 · Slow Burn: −50% hit damage, burn ×3 duration · Glass: +80% damage, take +20% damage · **Volatility** (D29): each cast rolls ×0.5–1.7 damage |
| **Behaviour** | Fork, Chain, Pierce, Homing, Return, Seed (killed enemies sprout a vine trap), Echo, **Predatory** (aims at the weakest enemy, D29) |

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
- **Combined skill (arena reward, D28):** the 4 moves' behaviours fire together on **one shared cooldown, the average of their cooldowns** (D28; was "the longest"). It inherits all 12 augments and gets no new sockets. Each absorbed learnset move frees its learnset slot.
  - Optional cross-type bonus from the tag union, e.g. Fire + Grass → "Wildfire". *(proposal)*
- **Projectiles-per-second budget:** every augment that adds projectiles is paid for with cooldown and/or damage per projectile, so projectiles/sec stays roughly flat.
- **No proc-from-proc:** an effect triggered by another effect can't trigger further effects.

### 8.7 Ability ↔ tag links *(proposal; folded into P4f Mutations, D21: Bonds and evolved ability tiers are the ability ↔ move link, tag boosts not built for now)*
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
- **Mutation Sites (D23):** rings scattered per ~1000 px map chunk (seeded per run, decided as the player comes near; one always near the start). Stand inside 5 s to open one, 8 s if its roll holds a Bond or signature Mutation; the roll is fixed on first entry and the ring turns gold (bound) or purple. Opening shows 5 cards: Mutations for owned moves, "learn + Mutation" for learnset moves not owned yet, and held items. Off-screen sites within 1500 px get an edge arrow. Tuning in `src/data/sites.ts` *(provisional)*.
- **Levels and build save (D23):** the 15-min map is Level 1. `src/sim/buildSnapshot.ts` saves and restores the build (line, stage, trait, level, moves with sockets and Mutations, boosts, items) as JSON so later levels can continue it.
- **Held items** (passives, may boost tags; **site rewards only**, D23): Leftovers (regen), Choice Band (+damage), Quick Claw (−cooldown), Wide Lens (+Area), Scope Lens (+crit for Slicing), Exp. Share magnet (+pickup radius), Shell Bell (lifesteal). 3 item slots.
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
| **P4 ★** | Squirtle + Bulbasaur lines, Pikachu (2-stage) and Lapras (non-evolver), **Mutations** (P4f: generic / Bond / signature, line mechanics, evolved ability tiers; replaces the §8.7 tag links, D21) | Do the starters feel truly different? Is picking a tier a real gamble? |
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
| D43 | Machamp: tier 1 arena boss (design) | **Approved 2026-10-23 (owner: "machamp 1st", "you can design him already").** Full kit in BOSSES.md §4. Owner additions: **the rock in hand**: he takes a nearby rock or rips one from the ground (a shield with HP; breaking it staggers him), then after a readable tell either **throws** it (45), **shield-charges** with momentum and shoves it as rolling boulders (**Strength**, 40), or rarely **shield-poses** for a double Bulk Up (**Iron Pose**, 15; "a big element of surprise"). **Faster than Snorlax** (×1.4, still slower than every starter). **Openings are flex poses** (Bulk Up) after every 2–3 attacks: interruptible, not immune; uninterrupted = +15% damage stack (max 3). Detect dropped. Kangaskhan stays a draft. Numbers provisional; build pending |
| D41 | Arena rubble blocks your projectiles | **Decided 2026-10-23 (owner):** "adjust snorlax so that users projectiles cannot shoot through the rocks". A player projectile that reaches an arena rubble rock ends its flight there (end-of-flight effects fire at the rock). Beams, melee and zones are unaffected. Applies to every arena rock (Snorlax's rubble; any future boss rocks reuse it) |
| D40 | Normal level rewards: Techniques + Natures | **Approved 2026-10-23 (owner), not built yet:** flat stat cards made up more than half of all level-ups and were rarely a real choice (pillar 1, "Kit over stats"). Normal levels now offer learnset moves (unchanged), **Techniques** and **Natures**. **Techniques** are ranked I–III passives that react to what the player does: Rollout, Moxie, Endure, Rage, Pickup and Focus Energy, plus tag-linked Kindling, Riptide, Spore Cloud, Static Field, Frostbite, Sharpshooter and Brawler. There are **5 Technique slots**; once they are full only rank-ups are offered; tag-linked ones need an owned move with that tag; each offer holds ≥ 1 Technique while one is available; anything a Technique creates triggers nothing (D29). **Natures** replace the 6 boosts: Brave, Timid, Bold and Hasty, each raising one stat and lowering another, 3 picks each, stacking allowed. Vitality and Magnet stay as filler. The augment rhythm is unchanged. All values are provisional. Spec: `docs/superpowers/specs/2026-10-23-techniques-natures-design.md` |
| D39 | Banked level-ups | **Approved 2026-10-23 (owner):** level-ups no longer pop up the moment they happen. They wait in a **bank** shown as a gold HUD badge ("LEVEL UP ×2 · Space (auto in 21 s)") and open when the player presses **Space** or clicks the badge, or **on their own once 3 are banked or the bank has waited 30 s** (`TUNING.levelUpBank`, provisional). **During an arena fight nothing opens on its own** (evolution waits too); the player may still open the bank. Opening resolves the whole bank back to back, so several levels cost one interruption |
| D38 | Boss tiers; Zapdos Overload window | **Decided 2026-10-23 (owner):**<br>• **Boss tiers:** arena event N draws a **tier-N** boss ("technically they are legendaries 1 tier lower than mew tier"). Tier 1 = Snorlax (event 1, ~6:30); tier 2 = the legendary birds, Zapdos now (event 2, ~12:30). Mewtwo sits above.<br>• **Overload:** when **all generators are down at the same time**, Zapdos crashes for **5 s** (no moves, ×1.5 damage taken), then is **Weakened 5 s** (owner: "slower speed and slower animation of skill"): ×0.6 speed, telegraphs, casts and cooldowns ×1.5 slower. The phase change waits out the crash.<br>• **No cheap re-trigger** (enemy designer, answering the owner's question): after an Overload all generators rebuild **together** 35 s after the crash; one rebuilt pylon broken again does nothing. Numbers provisional (`ZAPDOS_KIT.overload`) |
| D37 | Batch-2 enemies built | **Built 2026-10-23 overnight on owner instruction ("implement whatever that we discuss and approved beforehand in the documents")**: the 10 ROSTER batch-2 species, Bug/Rock/Ground/Ghost/Psychic defender types, a wave mix by tier, their attack styles (web, cone, pulse, ranged + Soak, Rollout, phaser, blink, explode, heal) and Elite abilities (Shield Dust, Infiltrator, Swift Swim, Sturdy, Synchronize, Aftermath, Healer, Run Away), plus horde lines (healers excluded). Gastly's Levitate is not built (needs the shared terrain code). Numbers provisional, not balanced (no `npm run balance` run) |
| D36 | Player statuses + status resistance by type | **Built 2026-10-23 overnight (owner instruction as D37)** from README §2–§3 and §10:<br>• **Player statuses:** poison, burn, slow, paralysis (Zapdos's moved onto this), confusion (aim drift), Soaked, with fatigue, resisted by the starter's types.<br>• **Enemy status resistance:** the same table, in the central status functions, with the boss rule (stuns ×0.5).<br>Statuses written directly by Mutation code aren't covered |
| D35 | Telegraphed ranged, charge and dive attacks | **Owner 2026-10-23:** "horde timing is good, how about the ranged and charger telegraph attacks?"<br>• **Spearow:** ranged darts; speed → the ranged band, 71.<br>• **Tauros:** Take Down charge.<br>• **Fearow:** Drill Peck dive (ROSTER rows).<br>All aims lock at the telegraph |
| D34 | Spawn pacing, horde events, Elites | **Decided 2026-10-23 (owner):** the spawn felt like "a big endless horde of head-tackling enemies without a space to breathe". Built:<br>• **Pacing:** a 45 s pressure cycle (build-up, a 5 s surge, then a **10 s lull**; owner: "test the 10 s lull first"); outside surges enemies come in **packs from one side**.<br>• **Horde events:** every 90 s, a warned **Elite leading its own species line** (README §8).<br>• **Leader falls:** the pack **flees until far enough, then fights again** (owner), and a lull follows.<br>• **Elites:** the 6 current species' **Elite abilities** (ROSTER).<br>Spawn variety (README §11) waits for batch-2 enemies. All numbers provisional (`src/data/hordes.ts`) |
| D33 | Arena time off the run clock; 6-min fights | **Decided 2026-10-23 (owner, after the first Zapdos playtest):** the **run clock pauses inside an arena** ("the boss arena doesn't count the timer towards the game"; the 15-min run is a test length, the last boss will be around 30 min). This **replaces D28's "the run clock keeps ticking in the arena"**. Each arena fight now has **6 min** to win (was 2:00 Snorlax, 2:30 Zapdos). The **first event stays at ~3:00** (owner). Zapdos's generators rebuild after **35 s** (was 20 s: "regenerate a bit too fast"). Inside a fight `world.time` still runs for every timer; the run's end, the wave ramp, the arena schedule, the HUD time and the balance bot use `runClock()` |
| D32 | Zapdos arena boss | **Requested 2026-10-22 (owner: "Build Zapdos as the second arena boss")**, chosen over building batch 2 first because with one arena boss every run fought Snorlax 4 times. Built per BOSSES.md §4 and D31's rules (immune phase-change animations, phase gate, 10+ moves): generators that shield it (pylons are enemies your auto-fire targets), Thunder brackets, Drill Peck, Shock Wave, Thunderbolt, Roost (loses Flying), Thunderstorm, Zap Cannon, Electric Fence, Agility, Discharge with an interrupt bar, and arena-only Rain Dance where puddles conduct Thunder; Pressure (+15% cooldowns); the Lightning Rod pull. It brings the **first status on the player: paralysis** as a slow plus a short stutter (README §10), resisted by the starter's types. Adds (Voltorb, Magnemite) wait for those enemies. All numbers provisional |
| D31 | Boss variety and immunity | **Requested 2026-10-22 (owner):** a boss's **special animations make it invulnerable** ("if not user might just burst him down, ie the berry phase"), and a boss should have **at least 10 kinds of moves or attacks**, phases left to the enemy designer. Built for Snorlax: immune during the berry shake, a new 1.5 s Belly Drum animation and Heavy Slam's leap (Rest stays hittable as the approved interrupt window); a **phase gate** so damage can't skip a Rest; 7 new moves (Crunch, Rock Slide, Belch, Fling, Heavy Slam, Block, Earthquake) on a weighted picker (no repeats, 0.5 s between moves). Details in BOSSES.md §4. All numbers provisional |
| D30 | Bulbasaur signature redesign | **Approved 2026-10-22 (owner):** the Bulbasaur signature stops being a 360° sweep. Vine Whip → Power Whip → Frenzy Plant become a **narrow directional lash** (30°, reach 120 → 130 → 140 px) whose **tip** (outer 30%) hits +30%; Power Whip's tip cracks into a 45 px burst (`[+Area]`); Frenzy Plant leaves 3 root patches along the lash (`[+Zone]`). Tags unchanged. **`vineWhip.longLash` is retired** and replaced by **`vineWhip.snare`** (the tip binds an enemy; bound enemies take +25% from Grass moves; ranks to 1.2 s / +35% / binds 2). Thorn Garden, Sap Lash, the Bulb, Leech tiers and learnset Bonds unchanged. Reason: playtest ("invincible" Ivysaur/Venusaur) and the balance report (Bulbasaur led every checkpoint). Numbers provisional; the build session tunes them toward D19. Spec: `docs/moveset/bulbasaur/README.md` §4 |
| D29 | Reference-pack review | **Approved 2026-10-22 (owner: "go with your picks"):** after reviewing `docs/references/` (skill-architect and progression-architect packs) and auditing every per-line Mutation doc: (1) **Mutations may change a move's delivery and type**; evolution still only adds tags (§8.6; moveset README rule 5a). (2) **Return Arc's Charge gain is a recorded exception** to "spawned things trigger nothing". (3) **Rule 5 reworded:** ability events may trigger moves (Bonds, each capped); anything a Mutation spawns triggers nothing. (4) **Bosses smash through Ice Wall.** (5) **Ricochet (2.09×) and Drowsy Haze (1.74×)** above the rule-4 band: judged in playtest before tuning. (6) **Two new augments** from the packs, the only ones no Mutation already covers: **Predatory** (aimed moves target the lowest-HP % enemy; II/III +10/+20% damage below half HP) and **Volatility** (each cast rolls ×0.5–1.7/1.9/2.1, averages 1.1/1.2/1.3). Momentum, Anchor, Last Stand, Guardian and Opportunist were dropped because 4–12 Mutations already do each. Not adopted: timed augment tickets, per-move mastery, recipe Mutations, chained procs, rarity tiers, weather, the packs' 35-min timings. Mutation docs synced to code values |
| D28 | Arena boss events | **Approved 2026-10-21 (owner):** **Mewtwo is the only main-map boss** (final, 15:00). Every other boss (Snorlax, Articuno, Zapdos, Moltres, later more) is an **arena boss drawn at random** per event (no repeats in a run once the pool allows). ~~4 events per 15-min run~~ **2 events per 15-min run, ~6:30 and ~12:30 (owner 2026-10-23, until the run is extended)**; times in data (`ARENA_TUNING.eventTimes`). With 2 wins per run a combo reaches 2 moves (base + 1 absorbed) until more events exist. An event opens a themed entrance near the player (mountain hole, pool, whirlwind…; entry animations by the enemy design team) with a banner and an edge arrow; it stays open a limited time (60 s *(provisional)*). Entering moves the player into a closed arena with the boss in the middle; the boss must be beaten within a time limit (Snorlax 120 s *(provisional)*); failing sends you back with no reward. **Being knocked out in the arena also sends you back (with 25% HP *(provisional)*) instead of ending the run** (owner, 2026-10-21). **The run clock keeps ticking in the arena.** **Counter rule:** the first event never draws a boss that resists the player's starter type; later events are fully random. Boss HP, contact damage and speed = hand-set base × the wave curve at entry time. **Reward:** one skill-combine step (§9 per-rift proposal: absorbing a fully socketed move frees its slot) **plus** a mixed pick (level, augment and site card pools). Built in steps **B1** (event, arena, timer, scaling, rewards, Snorlax phase 1) then **B2** (the rest of Snorlax). Replaces BOSSES.md's main-map Snorlax. **Combine details (owner, 2026-10-21):** a move can be combined only with **all 3 augment sockets filled** (Mutations don't count, they have their own track, D24); the first win picks the combo base, each later win absorbs one more qualifying move (up to 4 moves, D2); an absorbed move **frees its learnset slot**, and the combo fires every member together on the **average** of their cooldowns (not the longest, §8.6) |
| D27 | Enemy design: status resistance, abilities, base stats | **Approved 2026-10-21 (owner, as enemy-design direction):** the goal is hordes that are hard to kill with a one-element build that the enemies counter, not one-hit fodder. (1) **Status resistance** is a new system: burn/poison ticks stay typeless for the type chart but are scaled by the enemy's resistance. (2) **No full immunity**: lore immunities become ×0.25. (3) **Fixed multipliers**, no resist chance; numbers left to the enemy designer. (4) Resistance comes **from types**; **elites and bosses** also get one real **ability**. (5) It applies to **every enemy**. (6) Plan for future statuses, **lore-accurate only**. (7) **Design first**, build after approval. (8) Enemy stats come from the **official base stats**. **Follow-up 2026-10-21 (owner):** the resistance tiers (×1.5 / ×0.5 / ×0.25), the lore table, the rule that Flying enemies take ×0.5 from ground effects, and the boss rule (×0.5 stun duration) are approved. **Speed is the only stat overridden: it comes from the enemy's role**. **Every species has an ability, active only on its Elite or Boss variant.** Planned event: **an Elite leads a horde of its own species line** (owner: Elite Raticate leads Raticate + Rattata) (the event is game logic; enemy docs give horde-ready data). Also approved: the horde is the leader's own species line, the Elite multipliers (HP ×6, contact ×1.3, XP ×6, radius ×1.35, half stagger), Raticate = tank. **Two speed tiers (owner, 2026-10-21):** the horde body stays below the slowest starter; flankers (fast role, 115–145 px/s) can catch slow starters late, so Agility matters; telegraphed bursts may exceed every player. This **replaces D26's "fastest enemy below the slowest stage" invariant**. Enemy **attack styles** (README §9, all telegraphed) and **statuses on the player** (README §10: never more than ~0.3 s of control loss; resisted by the starter's types) are documented on owner request for P5. **Batch 2 (owner, 2026-10-21):** 10 more species approved with their elite abilities; the Voltorb Ambusher is kept; healers never join horde events; rough threat scores accepted (fine-tuned in balance). **Spawn variety approved as the gist** for the game logic designer: a fixed threat curve, random in-season species per tier each run, rotation, and a counter guarantee (README §11). **Bosses (owner, 2026-10-21):** direction approved ("all of these excite me"): lore-tied mechanics instead of bullet hell (contested resource, build interaction, space control, damage race, light denial); bosses are scripted (phases plus a weighted move picker with a telegraph → act → recover cycle); attacks speed can't solve (**lead aim 预判, the owner's idea**, bracket, past aim, cover, interrupt bar, tether); adds allowed where lore fits; Pressure (+15% cooldowns) OK. Docs: `docs/enemies/README.md` (rules), `docs/enemies/ROSTER.md` (sheets), `docs/enemies/BOSSES.md` (bosses). **Boss answers (owner, 2026-10-21):** Rain Dance and Sunny Day allowed **only as boss-arena phase effects** (not the §10 weather system); Snorlax = Gluttony; Mewtwo = Pressure; bird adds OK; **pair ground telegraphs with a projectile layer** (mixed speeds, curving, homing with a timeout; at most 2 layers at once, ~30 boss projectiles) |
| D26 | XP gem expiry, Magnet drop, difficulty over time | **Requested 2026-10-20 (owner):** (1) uncollected XP gems vanish after **1 min** (owner: 3 min → 1 min after testing) (the 400-gem budget used to fold new XP into the oldest, often off-screen gem, so drops looked like they stopped); (2) a **Magnet** drop (1% per kill after the owner saw none at 0.3%; shares the berry budget): walking over it pulls every gem within screen range once (the cheaper of the two owner options); (3) **difficulty over time**: wave keyframes scale contact damage (×1 → ×2 at 13:00) and speed (×1 → ×1.15), and 3 stat-only mobs pay more XP: **Spearow** (fast, from 3:00), **Fearow** (fast elite) and **Tauros** (heavy bruiser) from 10:00; fodder phases out (Rattata gone at 10:00, Pidgey at 13:00; timing left to the build session); (4) **straggler recycling** (owner OK 2026-10-21): enemies more than 1.5× the spawn distance behind reappear on the spawn ring ahead of the player, keeping HP. Fastest enemy × final speed scale stays below the slowest stage (unit-tested). All numbers provisional |
| D25 | Site fallback, D19 bot, site density | **Approved 2026-10-19 (owner, P4h-9):** a site-farming balance bot opened ~60 sites per run and stacked ~40 uncapped Power Surges (DPS ×5–9 at 15:00). So: (1) a site with nothing eligible gives **a heal and a Power Surge that lasts only a limited time** (owner: "maybe gives a heal and a surge but just for a limited of time"); level-up Power Surge is unchanged. Build defaults, provisional: heal 30 HP, +15% damage for 30 s, a new one refreshes the timer (no stacking). (2) **D19 is judged on the site-taking bot** (walks to sites, random cards), replacing D21's bot without Mutations, since items now only come from sites. (3) **Site density 35% → 20%** of chunks (provisional). |
| D24 | Mutation track + ranks | **Approved 2026-10-19 (owner):** after testing sites, Mutations felt useless once 4 moves held augments and items were full. So: every move has **3 augment sockets plus a separate Mutation slot** (a Mutation no longer takes a socket). Mutations **rank I → III**: rank I is picking 1 of the move's existing 3 Mutations (the branch), and sites then offer rank-up cards for it. **Rank II ≈ +15%, rank III ≈ +30% DPS** over rank I (provisional); rank I stays a sidegrade (rule 4: ±15% of Power Up I). **Rank III adds a small behaviour twist where one is natural**, numbers only otherwise. Each Mutation lists 2–3 existing **favoured augments**: shown gold and offered **×3 as often** in that move's augment windows (no extra bonus). Taking a different Mutation on a move **resets it to rank I**. Built as **P4h** (P4g is the Mutation Sites step). Owner chose the cheaper option over a full binary skill tree (X → 1/2 → 3/4/5/6) with branch-specific augments. **`docs/moveset/RANKS.md` approved as written 2026-10-19** (owner: "RANKS.md approved as written"); its numbers stay provisional and are tuned against the rank report. |
| D23 | Mutation Sites + Level 1 build save | **Approved 2026-10-18 (owner):** Mutations and **held items come only from Mutation Sites**; normal levels give learnset moves and stat boosts only. Sites are **scattered per ~1000 px map chunk** (seeded per run; exploring further finds more). A site opens after **standing inside it 5 s**; the roll is decided the moment the player first steps in, and **if it holds a Pokémon-bound Mutation (Bond or signature) capture takes 3 s more (8 s)**. The current 15-min map is **Level 1** (boss at 15:00 for now, 30 min once content fills it); the build must be savable for future levels: **snapshot code only** for now (no save UI). Provisional defaults set by the build session, not owner decisions: 5 cards with ≥ 1 Mutation and ≥ 1 item when available; "learn + Mutation" cards for learnset moves not owned yet (needs a free slot); capture progress drains 1 s/s outside; Esc skips (site used up); Power Surge when nothing is eligible; one site guaranteed in the 8 chunks around the start; 35% chance per chunk; edge arrows within 1500 px |
| D22 | Augment pool for zero-damage moves | **Decided 2026-10-18:** the augment pool stays as it is: damage-only augments (Power Up, Keen Edge…) are still offered for Smokescreen, which deals no damage unless Choking Smoke is on it. Owner: "Leave the augment pool as is." |
| D21 | Mutation build (P4f) | **Approved 2026-10-18:** the Mutation system in `docs/moveset/` is built as a new step **P4f**, before the P4 gate playtest; it **replaces P4e** (Bonds and evolved ability tiers are the ability ↔ move link; §8.7 tag boosts are not built for now). Speeds follow **D20** for every stage (Lapras 150). **Stun fatigue** applies only to new effects (Mutations, Shell Burst, Discharge, Flare Up…); existing base moves and Static keep today's behaviour. Every per-line open point in `docs/moveset/` is approved as written: Bond Mutations, Shell rework + Shell Burst, Puddles/Soaked, signature Mutations evolving with the line, Flare Up + trait twists, Scorch, Fixed Rage ignoring damage augments, Will-o-Wisp as flavour, Bulb/Bloom + twists, Charge/Discharge + twists. The **Lapras XP ×0.85 from Lv 30** knob may be used only if damage/stat tuning alone can't meet D19. D19 is judged on the balance bot **without** Mutations (map sites don't exist yet) |
| D20 | Speeds, Shell Armor, Blinded | **Approved 2026-10-18:** **every stage's move speed follows the official base Speed exactly**, so players can judge picks from common Pokémon knowledge: speed px/s = round(120 + 0.5 × base Speed) *(the formula is provisional; the ordering is the rule)*. Values: Squirtle 142, Wartortle 149, Blastoise 159, Charmander 153, Charmeleon 160, Charizard 170, Bulbasaur 143, Ivysaur 150, Venusaur 160, Pikachu 165, Raichu 175, **Lapras 150** (slower than Charmander, as in the official stats). This **replaces D19's Lapras 155**. Lapras's **Shell Armor stays un-upgraded** (part of its low ceiling). **Blinded** (Smokescreen status: enemies wander, −30% contact damage, bosses immune) is approved |
| D19 | Late-game balance target + speeds | **Approved 2026-10-18:** **at 15:00 every 3-stage final form (Charizard, Venusaur, Blastoise) has the highest DPS; the 2-stage line (Raichu) and the non-evolver (Lapras) are roughly equal (within ~10%) and below all three.** Fixing the numbers to meet this is a balance-math task for the build session (`npm run balance`). **Speeds use the official base Speed stats as the reference** (current data already ≈ 120 + 0.5 × base Speed px/s, within ±5), with one owner rule on top: **Lapras is tankier, hits harder and runs faster than Charmander and Squirtle**, so Lapras 135 → **155** (provisional; official Lapras 60 would give 150, a tie with Charmander). *Speed part superseded by D20.* |
| D18 | Lapras tier + Tide | **Approved 2026-10-18:** Lapras keeps **Sheer Cold** as its single Lv 25 signature tier (Ice Shard → Sheer Cold); **Frost Breath is dropped** from Lapras. The **Tide** is approved: Lapras Bonds use Flood values before Lv 30 and Ebb values from Lv 30. Still open: Lapras speed (135, slowest), Shell Armor staying un-upgraded, the optional XP ×0.85 from Lv 30 knob |
| D17 | Pikachu kit + Lapras direction | **Approved 2026-10-18:** Pikachu moveset as proposed in `docs/moveset/pikachu/` (Charge from running, Charged shot, Discharge at Raichu, trait twists); **Volt Tackle keeps its HP recoil** (5% max HP) for now, to be judged in playtest. **Lapras: the signature evolves only once, at Lv 25** (replaces the Lv 10 / 25 tiers of D13); its kit is early-to-mid-game focused, the player's aim is to level fast and safe, and its final firepower must be **below the 3-stage lines' final forms**. Which tier stays at Lv 25 (Sheer Cold recommended), the Tide (Bonds ebb from Lv 30) and Lapras's speed are open in `docs/moveset/lapras/` |
| D16 | Mutation acquisition + Bulbasaur kit | **Approved 2026-10-18:** augment levels offer **only** stat / trade-off / behaviour augments. Skill-changing **Mutations** (generic and Bond, signature Mutations included) come **only from map sites**: randomly generated sites the player must find, each rolling a generic Mutation, a Bond Mutation **or an item**. The map-site mechanic itself is a new system still to be specified (owner). Every Mutation is labelled by a stable ID, kind, line, stage, hook and `Pool = site` in `docs/moveset/INDEX.md`. Owner OK'd the Bulbasaur moveset proposal ("this is actually fine": Bulb, Bulb Bloom at Ivysaur, trait twists; the Bulb stays inactive before Ivysaur) |
| D15 | Charmander learnset + kit rule 2 | **Approved 2026-10-18:** **Slash** is allowed as an exception to kit rule 2 (a second Normal attack), **gated to Charmeleon** (stage 1); **Smokescreen** doesn't count toward rule 2 because it does no damage. Inferno Storm (`hurricane.infernoStorm`) needs **30 kills** in one cast. Owner: the Mutation skill-tree design in `docs/moveset/` "is the one ill be adopting into the game" (its open points are still listed per line) |
| D13 | P4 scope | **Approved 2026-10-17:** simple starter select screen in P4 (polish stays P7); every evolving line's final stage offers a trait pick (Lapras none); Pikachu's signature chains innately, capped at 3 jumps (Chain augment stays P5); kits per §6 as the starting point (numbers provisional) |
| D12 | P3 re-playtest revisions | **Approved 2026-10-17:** healing = **rare Oran Berry drops** (no flat regen; Raticate often, others rarely; walk over to heal); "damage taken" trade-offs (Glass) stay **+10/15/20%** but are **shown clearly** (HUD + red damage numbers on the player); **Back** from the augment cards to move selection (cards kept per move, so Back is not a free reroll); Return gets a trade-off (−30% damage, provisional) |
| D11 | P3 playtest revisions | **Approved 2026-10-17:** evolution cinematic **5 s, skippable after 2 s**; Blast Burn crater spawns **once per projectile** (Pierce can't chain craters); **augment replacement**: with full sockets the window still shows 3 cards and a new augment replaces a chosen socket at rank I (Back to cancel); each augment window **guarantees ≥ 1 behaviour/exclusive card** when available; **Pokémon types per stage** (Charizard = Fire/Flying) unlocking stage-gated Flying moves + **STAB +20%** for moves matching the Pokémon's types; **Charizard chooses 1 of 2 traits** at evolution (Blaze+ or Solar Power). Numbers provisional |
| D10 | P3 scope | **Approved 2026-10-17:** evolution triggers automatically at Lv 10/25; ~2 s cinematic (pause, flash, grow) + "what changed" card; P3 behaviour augments = Pierce, Homing, Return, Knockback, Burn, Lifesteal; Charmander-line exclusives = Blaze Core (any tier) + Mega Flare (Blast Burn only). Stage stats provisional |
| D9 | P2 scope | **Approved 2026-10-17:** Pidgey/Raticate as stat-only variants until P5; P2 learnset = Scratch, Fire Spin, Dragon Rage (+Ember); 15:00 shows "Survived!" until the final boss exists; generic boosts max 5 picks each *(provisional)* |
