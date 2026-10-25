# Map design — Level 1 "Kanto Route"

**Status:** APPROVED (owner, 2026-10-24, **D47**; answers in §15). Build M1–M3 now, M4–M5 at P6. Every number is
*(provisional)*. Once a piece is built, `src/data/map.ts` is the truth for numbers.
**Labels for the UI, art and audio teams:** [`INDEX.md`](INDEX.md). It lists every ID, display name, state, colour
token, asset name and notice string. Display names may change; IDs don't.

---

## 0. How to read this doc
| Reader | Read |
|---|---|
| Owner / designers | §1–§3 (goals and rules), §6 (biomes), §7 (features), §10 (the run arc) |
| Sim implementer | §4 (vocabulary), §5 (generation), §11 (how it works), §12 (budget), §13 (build steps) |
| Art team | §4.4 (layers), every feature card's **Art** row, §9 (set-piece sketches), `INDEX.md` §5–§7 |
| UI team | every feature card's **UI** row, `INDEX.md` §4 and §8 |

Every feature in §7 has a **card** with the same rows, in the same order: Question, Shape, Who it blocks, Rules,
States, Type reactions, Enemies, Telegraph, Numbers, Art, UI, Audio, Sim, Tests.

---

## 1. Goal
Today the main map is an empty grid, so the only decision in the moment loop ("where to stand", PROJECT.md §3) is
which way to circle. Arenas show what space can do: Snorlax's rubble, Articuno's pillars and Zapdos's fences all
change where you stand. The main map is ~85% of the run and has none of it.

**Pitch:** *the map is your 5th move.* Every patch of ground asks a question, and your type answers it differently.

It also unlocks things that are approved but waiting on terrain:

| Waiting on terrain | Where it's approved | How the map delivers it |
|---|---|---|
| Charizard ignores ground hazards | PROJECT.md §6, P3a note | The `fly` traversal flag (§4.2) |
| Gastly's Levitate | ROSTER.md | The `levitate` flag |
| Rollers bounce off obstacles | README §9.2 ("the map has no walls") | Tall obstacles and shores reflect them |
| Burrower | README §9.2, ROSTER (Diglett) | Rocky floor (`floor.rocky`) is where they dig |
| Voltorb Ambusher as an item ball | README §9.2 (owner: keep) | Real item balls (`feature.itemBall`) |
| Flying takes ×0.5 from ground effects | README §3.3 | The shared terrain code checks the flag |

### 1.1 Gate question (for the map's playtest)
1. **In the first 3 minutes, does the tester use terrain on purpose at least once** (ledge escape, swim, burning
   grass, hiding behind a rock from darts) **without being told?**
2. **Does each starter use the map differently?** (pillar 1)
3. Still 60 fps in the stress scene with the densest biome.

---

## 2. Pillars → map rules
| Pillar | What it means for the map |
|---|---|
| Kit over stats | Every feature reacts to attack **types** (§8) and to **traversal** (§4.2), never to stats |
| Evolution is the climax | Charizard's flight opens the map: water and ledges stop being walls |
| Readable chaos | Terrain never hides an enemy and never uses danger colours (§3, R2/R3) |
| Build your own mon | Zone, melee and beam builds each have a natural spot (corridors, ledge lines, fords) |

---

## 3. Hard rules (every feature is checked against these)
| # | Rule | Why |
|---|---|---|
| **R1** | **Lanes always stay open.** Every chunk edge has ≥ 2 openings ≥ 150 px wide, and nothing walkable is enclosed. Checked by the generator (§5.4), not by hand | The player must never be boxed in by the map |
| **R2** | **Terrain never hides an enemy.** Tall grass shows enemies through it; nothing walks under a canopy. Only the Ambusher hides, and it keeps its wobble tell | Pillar 3 |
| **R3** | **Danger colours belong to enemies.** Red/orange outlines and flashing are enemy telegraphs only. Terrain is muted; player-owned reactions use soft fills with no red rim. **Enemy telegraphs draw above all terrain** | Pillar 3: a fire you lit must not read as a fire that hurts you |
| **R4** | **No pathfinding** (PROJECT.md §11.1). Movers walk straight and **slide** along obstacles. Obstacles are cells, circles or segments, all convex enough to slide off. Stuck enemies wall-follow, and get recycled if that fails (§11.4, D47 amendment) | Performance budget |
| **R5** | **Terrain triggers nothing further.** A reaction (burning grass, charged marsh) applies statuses through the normal status code and never triggers hooks, Techniques or other reactions | No proc-from-proc |
| **R6** | **The player is never hurt by their own reaction.** Your burning grass, your charged marsh and your melting ice don't damage you | Readable, fair |
| **R7** | **Coverage caps.** Blocking area ≤ 20% of a chunk (meadow ≤ 8%, the start area ≤ 5%) | Survivor-likes need room to kite |
| **R8** | **Grey boxes first** (AGENTS.md). Every feature must be playable as flat shapes before art exists | P1 philosophy: test the fun first |
| **R9** | **Same seed, same map.** Layout comes from `mapSeed` (already used by sites), never from the gameplay RNG | Reproducible bugs and tests |

---

## 4. Vocabulary and labels
Full lists live in [`INDEX.md`](INDEX.md). This section explains the scheme.

### 4.1 ID scheme
| Prefix | Meaning | Example |
|---|---|---|
| `biome.<id>` | A chunk's biome | `biome.lakes` |
| `floor.<id>` | Floor dressing with no collision (looks only, or tells enemies where to spawn) | `floor.rocky` |
| `feature.<id>` | A map feature with rules (§7) | `feature.tallGrass` |
| `feature.<id>:<state>` | One state of a feature | `feature.tallGrass:burning` |
| `reaction.<feature>.<type>` | What an attack type does to a feature (§8) | `reaction.marsh.electric` |
| `setpiece.<biome>.<name>` | A hand-made chunk layout (§9) | `setpiece.canyon.ledgeTerraces` |
| `event.<id>` | A map-level event (§10) | `event.foreshadow.iceCave` |
| `fx.map.<…>` / `sfx.map.<…>` | Visual effect / sound IDs for the art and audio teams | `sfx.map.grass.ignite` |
| `ui.map.<…>` | UI strings and icons | `ui.map.notice.swimming` |

IDs are camelCase after the prefix, like the Mutation IDs (`docs/moveset/INDEX.md`).

### 4.2 Traversal flags (who can go where)
Every mover (the player and every enemy) has exactly one traversal flag. Features are either **low** (water, marsh,
ledges: things you could fly over) or **tall** (boulders, trees: things that stop everything on the ground and in
the air).

| Flag | Low features | Tall features | Who has it |
|---|---|---|---|
| `ground` | Water blocks; marsh slows; ledges: hop down, climb up at 30% | Blocked | Most enemies; Charmander, Charmeleon, Bulbasaur line, Pikachu, Raichu |
| `swim` | **Water is walkable** (at a speed factor); marsh doesn't slow; ledges as `ground` | Blocked | **Lapras** (×1.0 in water), **Squirtle line** (×0.85) (D47) |
| `fly` | Ignores all low features, both ways | Blocked | **Charizard**; Flying-type enemies |
| `levitate` | As `fly` for low features, but **can't cross deep water** (it floats, it doesn't fly) | Blocked | **Elite Gastly** (Levitate ability) |
| `burrow` | While dug in: ignores low features, **can't dig through deep water** | Passes under | Burrowers while underground (Diglett) |

*Why tall blocks flyers too:* one rule ("tall stops everything") is easier to read than "trees stop some things", and
it keeps tall obstacles meaningful as cover against flying darters.

### 4.3 Collision classes (what the sim stores)
| Class | Stored as | Used by |
|---|---|---|
| `open` | cell value 0 | meadow, ash, rocky floor |
| `slow` | cell value | marsh, frozen marsh |
| `water` | cell value | deep water (blocks `ground` movers) |
| `grass` | cell value | tall grass (walkable; reactions only) |
| `tall` | circle | boulders, trees, berry trees |
| `ledge` | segment + facing | ledges |

Area features (water, marsh, grass) are stored as **50 px cells**, so "what's under me" is a single array lookup.
Tall things are **circles** (smooth sliding). Ledges are **segments** on cell edges.

### 4.4 Draw layers (art and render order, bottom to top)
| Depth | Layer | Contents |
|---|---|---|
| 0 | `floor` | Biome floor, `floor.rocky`, ash |
| 1 | `terrain` | Water, marsh, tall grass base, ledge lips |
| 2 | `reaction` | Burning grass, charged marsh, ice |
| 3 | `playerZone` | Existing puddles, Scorch, zones (unchanged) |
| 4 | `pickup` | Gems, berries, magnets, item balls |
| 5 | `unit` | Player and enemies |
| 6 | `grassSkirt` | The tall-grass tuft overlay over the lower ~30% of units standing in grass (§7.1 Art) |
| 7 | `tall` | Boulders, trees, berry trees. **Their art footprint matches their collider (+≤ 10 px)**, so nothing is ever drawn under them |
| 8 | `telegraph` | Every enemy and boss telegraph (R3) |
| 9 | `hud` | HUD, notices, edge arrows |

---

## 5. World structure and generation
### 5.1 Chunks and cells
- The map keeps the existing **1000 px chunks** (`SITE_TUNING.chunkSize`), generated lazily **2 chunks around the
  player** (as sites are today).
- Each chunk is a **20 × 20 grid of 50 px cells** (one byte each: the collision class + a feature id).
- **Set pieces are authored on a 10 × 10 grid of 100 px tiles** (each tile = 2 × 2 cells). That's coarse enough to
  sketch in ASCII (§9) and fine enough for corridors.

### 5.2 Biome choice
- A seeded, low-frequency **value noise** over chunk coordinates (one feature ≈ 3–4 chunks wide) picks the biome, so
  biomes come in regions instead of a checkerboard.
- Target share *(provisional)*: meadow 40%, woods 22%, lakes 20%, canyon 18%.
- **The start chunk and its 8 neighbours are always meadow**, with a 5% coverage cap (the first 30 s are for
  learning to move). The guaranteed near-start site (D23) stays.

### 5.3 Pipeline per chunk (deterministic from `mapSeed` + chunk coords) — as built in M2
```
1. biome   = biomeAt(chunkX, chunkY)                       // §5.2; the 9 start chunks are always meadow
2. piece   = pick a set piece from the biome's list (weighted; start chunks only use start-safe pieces)
3. stamp     the piece in one of its 8 looks (4 turns × mirror), tried in a seeded order
4. check   = coverage cap (R7) and lane check (§5.4); the first look that passes wins; if none does, `open` is used
5. filler  = up to N lone boulders/trees in clear inner tiles, kept only if the cap and the lane check still hold
6. slots   = record the piece's S / B / I / E slots (site, berry tree, item ball, entrance)
7. sites     the existing site roll (20% per chunk) uses the S slot if there is one, else a random spot nudged clear
```
Rotation and mirroring give each piece 8 looks, so 12 pieces read as ~96 layouts. Ledges keep their rule of never
facing north (§7.5): a look that would make one face north is skipped. *(Dropped from the first draft: "no repeat of
a neighbour's piece". It would make each chunk depend on its neighbours; the 8 looks already keep repeats rare.)*

### 5.4 Lane check (R1) — as built in M2
- **Doors.** Every chunk keeps the same two 200 px gaps on every edge: tiles 2–3 and 6–7. Neighbouring chunks' doors
  line up, so if every chunk connects all its doors, **the whole map is connected**, and a chunk never has to read its
  neighbours to know it (no generation order problems).
- Rasterise the chunk into 50 px cells. A cell is **blocked** if it's deep water or its centre is within 10 px of a
  tall circle (trees, boulders, and berry trunks already, though berry trees come in M4).
- Pass if every door cell on every edge is open **and** a flood fill from a door reaches every open cell (no sealed
  pocket). Otherwise the look is rejected (§5.3).
- Ledges count as passable both ways (everyone can climb them, slowly; D47).
- Cost: 400 cells per look, at generation time only. Unit-tested on 8 × 8-chunk regions (every open cell reachable
  from every other) and over ~3,700 generated chunks for the caps.

### 5.5 What lives where
| Thing | Placement rule |
|---|---|
| Enemy spawns (ring at 600 px) | The point must be passable for the enemy's flag; else try 4 more angles; else the nearest passable cell |
| Mutation Sites | S slot, else an open spot ≥ 150 px from tall things, never in water or marsh. **Far sites** (centre ≥ 3000 px from the start, D47): their roll weights bound (Bond/signature) and rank-up cards **×1.5** *(provisional)* |
| Arena entrances | Nearest free E slot within 800 px whose biome matches the entrance (§10.1), else today's rule (near the player) (D47) |
| Berry trees | B slot only, at most 1 per chunk |
| Item balls | I slot, ~1 per 2 chunks |
| Gems, berries, magnets dropped on water | Slide to the nearest shore cell (so a non-swimmer can always collect them) |

---

## 6. Biomes
Each biome is a palette, a feature mix and a set-piece list. Enemies don't change by biome (the spawn director owns
difficulty); biomes only change **where** some enemies come from (§7, Enemies rows).

| ID | Name | Feel | Features (most → least) | Coverage | Set pieces (§9) |
|---|---|---|---|---|---|
| `biome.meadow` | Route Meadow | Open, readable, Route 1 | tall grass, ledges, berry trees, lone boulders | ≤ 8% blocking | `grassRing`, `ledgeSteps`, `berryCopse`, `open` |
| `biome.woods` | Viridian Woods | Corridors and clearings | trees, tall grass, berry trees | ≤ 20% | `corridor`, `clearing`, `open` |
| `biome.lakes` | Cerulean Lakes | Water lanes, fords, marsh | deep water, marsh, tall grass | ≤ 20% (water counts as blocking) | `pond`, `streamFord`, `marshland`, `open` |
| `biome.canyon` | Rock Canyon | Cover and terraces | boulders, ledges, rocky floor | ≤ 18% | `boulderField`, `ledgeTerraces`, `pass`, `open` |

**Biome borders:** where two biomes meet, the generator blends fillers from both for one tile row, so the change is
gradual. The art team supplies a **transition strip** per biome pair (INDEX.md §7).

---

## 7. Feature cards

### 7.1 Tall grass — `feature.tallGrass`
| Row | |
|---|---|
| **Question** | "Burn it, rest in it, or watch it?" Hordes come out of it, Fire turns it into a trap, Grass types rest in it |
| **Shape** | Cell patches, 2 × 2 to 6 × 6 cells (100–300 px). A patch is a 4-connected group of grass cells |
| **Who it blocks** | Nobody. Walkable for every flag |
| **Rules** | • **Grass-type players rest faster:** while standing in grass, Rest regen (D44) starts after **2 s** instead of 5 s. • **Hordes emerge:** a horde event (D34) whose pack side has grass within the spawn ring spawns from that grass (§10.2). • **Ambushers** may sit in it (§7.9) |
| **States** | `idle` → `rustle` (horde tell, 3 s) → `idle`; `idle` → `burning` (4 s per cell) → `ash` (60 s) → `regrow` (1 s) → `idle` |
| **Type reactions** | **Fire** ignites it (§8: `reaction.tallGrass.fire`). Other types: nothing |
| **Enemies** | Show through it (R2). Bug species (Caterpie, Weedle) prefer to spawn from grass edges when grass is within the spawn ring |
| **Telegraph** | Rustle: tufts sway hard + a soft white shimmer on the cells the horde will come from, for the whole 3 s warning |
| **Numbers** | Grass rest delay 2 s; burn 4 s per cell; spread 3 cells/s inside the patch; a burning cell Burns enemies at **30% of the igniting hit's damage per second** (same model as Scorch); ash 60 s; at most **2 patches burning at once**; a patch can't re-ignite while it's ash |
| **Art** | Tufts ~40 px tall. **Hard rule: the grass base is drawn under units; a separate tuft overlay (`grassSkirt`) covers only the lower ~30% of a unit**, so an enemy's head and body always show. Autotile set of 16 (marching squares) for patch edges. States: idle (2-frame sway loop), rustle (4-frame hard sway), burning (4-frame flame loop, soft orange **fill**, no outline), ash (static, grey-brown), regrow (3-frame sprout) |
| **UI** | First time the player stands in it as a Grass type: notice `ui.map.notice.grassRest`. First ignite: `ui.map.notice.grassBurning` (INDEX.md §8) |
| **Audio** | `sfx.map.grass.rustle` (loop during tell), `sfx.map.grass.ignite`, `sfx.map.grass.burnLoop` (throttled, one per patch) |
| **Sim** | Cell class `grass`; burning state per cell in a small per-patch array; burn ticks on the 0.25 s status cadence through `applyBurn` (R5) |
| **Tests** | Grass rest delay only for Grass types; ignite spreads to every cell of the patch and stops at its edge; ash can't ignite; cap of 2 burning patches; player takes no damage in own fire (R6); Flying enemies take ×0.5 from the burn (README §3.3) |

### 7.2 Deep water — `feature.deepWater`
| Row | |
|---|---|
| **Question** | "Is the water a wall or a highway?" It depends on who you are |
| **Shape** | Cell blobs: ponds (≤ 600 px across) and streams (2 cells wide, ≤ 800 px long). **Streams and ponds stay inside one chunk** (no chunk-crossing rivers) and streams always have a ford (marsh) or an open end every ≤ 500 px |
| **Who it blocks** | `ground`, `levitate` and `burrow`. `swim` moves in it at its speed factor. `fly` ignores it |
| **Rules** | • **Swimming counters** (so a lake isn't a permanent safe room): no Rest regen while in water; after **3 s** of swimming, the spawn director doubles the weight of in-season Flying species until you leave. • Player projectiles fly over water. • Dropped pickups slide to shore (§5.5) |
| **States** | `idle`; `charged` (Electric, 2 s); cells may become `feature.iceBridge` (§7.3) |
| **Type reactions** | **Ice** freezes a bridge (`reaction.deepWater.ice`). **Electric** charges it (`reaction.deepWater.electric`): only matters for swimming enemies once any exist; it never hurts the player (R6) |
| **Enemies** | Walkers slide along the shore (R4). Flyers cross. Rollers bounce off the shore |
| **Telegraph** | None needed (static). The shoreline has a bright 3 px foam edge so the boundary is unmistakable |
| **Numbers** | Swim speed: Lapras ×1.0, Squirtle line ×0.85 (D47); flyer tilt after 3 s, ×2 weight |
| **Art** | Autotile set of 16, with a 2-frame shimmer. Foam edge on every shore. Lapras/Squirtle in water: show a waterline (lower 40% of the sprite hidden behind a ripple overlay). States: idle, charged (yellow sparks crawling on the surface, soft) |
| **UI** | First swim: `ui.map.notice.swimming`. HUD status chip `ui.map.chip.swimming` while in water |
| **Audio** | `sfx.map.water.enter`, `sfx.map.water.exit`, `sfx.map.water.charged` |
| **Sim** | Cell class `water`; movers resolve against water cells with the cell push-out (§11.1) unless their flag allows it |
| **Tests** | `ground` can't enter; `swim` can, at its factor; `fly` ignores; rest regen off in water; flyer tilt starts at 3 s and ends on exit; pickups dropped on water end up on a passable cell |

### 7.3 Ice bridge — `feature.iceBridge` (a state of water, made by the player)
| Row | |
|---|---|
| **Question** | "Make a path, then decide who uses it." Enemies walk on your bridge too, which funnels them |
| **Shape** | A strip of cells along the Ice hit's path across water: up to 8 cells (400 px) long, 2 cells wide |
| **Who it blocks** | Nobody: walkable for every flag while it stands |
| **Rules** | Lasts **6 s**, then cracks for **1 s** (telegraph), then melts. Anyone `ground` on a melting cell is pushed to the nearest shore cell; enemies are also **stunned 0.5 s** (through `applyNewStun`, so stun fatigue and the boss rule apply). The player is only pushed, never stunned (R6) |
| **States** | `frozen` (6 s) → `cracking` (1 s) → water |
| **Type reactions** | Fire on a bridge melts it at once (goes straight to `cracking`); Ice refreshes it to 6 s |
| **Enemies** | Walk on it like ground |
| **Telegraph** | `cracking`: white crack lines spread + flicker for the full 1 s |
| **Numbers** | Length 8 cells, width 2, life 6 s, crack 1 s, push stun 0.5 s; at most **3 bridges** alive (the oldest melts first) |
| **Art** | Pale blue autotile over the water, 3-frame crack sequence |
| **UI** | First bridge: `ui.map.notice.iceBridge` |
| **Audio** | `sfx.map.ice.freeze`, `sfx.map.ice.crack` |
| **Sim** | Cell class changes `water` → `open` (with a timer) → `water`; cells are picked from the hit's trigger points (§8.1) |
| **Tests** | Bridge length cap; melt pushes walkers to shore; player never stunned; cap of 3 |

### 7.4 Marsh — `feature.marsh`
| Row | |
|---|---|
| **Question** | "Fight in the slow ground, or go around?" Electric players make it a kill box |
| **Shape** | Cell patches around ponds and as stream fords (fords are 2 × 2 cells minimum) |
| **Who it blocks** | Nobody. `ground` movers are **slowed 30%**; `swim`, `fly`, `levitate` aren't |
| **Rules** | The slow applies to the player and enemies alike (fair: both are slow). Flying enemies ignore it |
| **States** | `idle`, `charged` (Electric, 1 s), `frozen` (Ice, 6 s) |
| **Type reactions** | **Electric** charges the whole marsh patch: every grounded enemy in it is **paralysed 0.4 s** (stun fatigue applies) and takes a small hit (`reaction.marsh.electric`); per-patch cooldown 4 s. **Ice** freezes it: no slow for 6 s, and grounded enemies in it may slip (reuses the Slick slip rule) (`reaction.marsh.ice`). Water hits: nothing (it's already wet) |
| **Enemies** | Slow down in it. A Roller's roll ends when it enters marsh |
| **Telegraph** | Charged: yellow sparks over the patch for 1 s (soft fill). Frozen: pale glaze |
| **Numbers** | Slow 30%; charge paralysis 0.4 s, damage = 20% of the hit, cooldown 4 s per patch; frozen 6 s; slip 20%/s, 0.3 s |
| **Art** | Darker green-brown water with reeds; autotile 16. Units in marsh get a shallow ripple at their feet (no hiding) |
| **UI** | HUD chip `ui.map.chip.marsh` while slowed |
| **Audio** | `sfx.map.marsh.step` (throttled), `sfx.map.marsh.charged`, `sfx.map.marsh.freeze` |
| **Sim** | Cell class `slow`; speed factor read once per step from the cell under the mover |
| **Tests** | Slow for `ground` only; Electric paralyses every grounded enemy in the patch once per cooldown; fatigue respected; frozen removes the slow |

### 7.5 Ledge — `feature.ledge`
| Row | |
|---|---|
| **Question** | "Drop down to escape?" Going down is instant; coming back up is slow for everyone, so whoever is below has to pay to follow |
| **Shape** | A straight segment on cell edges, 150–400 px long, with a **facing** (the "down" side): south, east or west. Never north-facing (a lip seen from behind is hard to read top-down) |
| **Who it blocks** | Nobody fully. **Everyone** on `ground`/`swim` (player and enemies, D47): crossing toward the facing is a hop; crossing against it is a **climb at 30% speed** while inside a 20 px band. `fly`/`levitate`: ignore it |
| **Rules** | **Hop (player):** crossing toward the facing plays a 0.35 s hop that carries the player 60 px past the lip; input is locked during the hop; **no invulnerability** (it's movement, not a dodge). Enemies step down without a hop. **Climb:** the same 30% for the player and for enemies, so a chaser below you loses as much time as you would. Projectiles, beams and zones pass over ledges |
| **States** | none (static) |
| **Type reactions** | none |
| **Enemies** | Climbing enemies bunch along the lip: the intended kill line for melee arcs, Frenzy Plant roots and Whirlpool |
| **Telegraph** | The lip has chevrons pointing "down"; readable from one screen away |
| **Numbers** | Length 150–400 px; ≥ 100 px gap between ledges in a row; climb 30%; hop 0.35 s / 60 px |
| **Art** | A raised lip (8–12 px tall face) with a lighter top edge and **down-pointing chevrons**; end caps on both ends so its length is obvious. Hop: the player sprite arcs 12 px up, its shadow stays on the ground |
| **UI** | First time the player climbs one: `ui.map.notice.ledgeClimb` |
| **Audio** | `sfx.map.ledge.hop`, `sfx.map.ledge.land` |
| **Sim** | Segment list per chunk; crossing test = sign change of the mover's side of the segment between steps (§11.3) |
| **Tests** | Player and enemies climb at 30% against the facing; flyers ignore; the player's hop moves 60 px and can't be cancelled; no i-frames during the hop |

### 7.6 Boulder — `feature.boulder`
| Row | |
|---|---|
| **Question** | "Use it as cover?" It stops darts, and your shots too |
| **Shape** | Circle, radius 30–70 px |
| **Who it blocks** | Every mover (tall). **Blocks player projectiles** (extends D41 from arena rubble to map boulders: the shot ends at the rock and its end-of-flight effect fires there) **and enemy projectiles** (Spearow darts and the like), so cover works both ways. Beams, melee and zones pass |
| **Rules** | Unbreakable on the main map (breakable boulders would be a new system) |
| **States** | none |
| **Type reactions** | none |
| **Enemies** | Rollers (Geodude, Sandshrew) **bounce** off them (up to their 3 bounces). Burrowers prefer rocky floor near boulders |
| **Telegraph** | none (static) |
| **Numbers** | Radius 30–70; canyon fillers ≤ 6 per chunk |
| **Art** | Grey-brown rock, readable top-down silhouette, shadow on the south side. **Art footprint = collider + ≤ 10 px.** 3–4 variants per size class (S 30–40, M 41–55, L 56–70) |
| **UI** | none |
| **Audio** | `sfx.map.boulder.block` (a soft thud when a shot stops on it, heavily throttled) |
| **Sim** | Circle in the static obstacle hash; same shape as the arena `ArenaRock` (`x, y, radius`) |
| **Tests** | Player and enemy projectiles stop at it; beams pass; Roller bounces; movers slide around it |

### 7.7 Tree — `feature.tree`
| Row | |
|---|---|
| **Question** | "Hold the corridor?" Woods make chokepoints for zone and melee builds |
| **Shape** | Groups of circles (radius 40–60) placed on the set-piece `T` tiles; adjacent `T` tiles merge into one wall |
| **Who it blocks** | Every mover and every projectile (tall) |
| **Rules** | Corridors between tree walls are ≥ 150 px (R1 enforces it) |
| **States** | none |
| **Type reactions** | none (burning trees would be too big a system for MVP) |
| **Enemies** | Bug species prefer to spawn from forest edges; Caterpie webs read well in corridors |
| **Telegraph** | none |
| **Numbers** | Radius 40–60; corridor ≥ 150 px |
| **Art** | Top-down canopy. **The canopy is the collider** (+≤ 10 px), so nothing walks under leaves (R2). A darker canopy edge so walls read as walls. 4 variants |
| **UI** | none |
| **Audio** | none |
| **Sim** | Circles in the static hash |
| **Tests** | Corridors pass the R1 check; projectiles stop at trees |

### 7.8 Berry tree — `feature.berryTree`
| Row | |
|---|---|
| **Question** | "Detour to heal?" A healing landmark worth a route |
| **Shape** | Tall circle (radius 30) + an interaction ring (radius 70) |
| **Who it blocks** | Every mover (the trunk) |
| **Rules** | Stand inside the ring for **2 s** (progress drains 1 s/s outside, like sites) → the tree shakes and drops **1–2 Oran Berries** 40 px out. Then it regrows its fruit in **90 s**. Berries use the existing berry cap and pickup code |
| **States** | `ripe` → `shaking` (0.4 s) → `bare` (90 s) → `ripe` |
| **Type reactions** | none |
| **Enemies** | none |
| **Telegraph** | Ripe fruit visible on the canopy; a capture arc on the ring like sites (a different colour) |
| **Numbers** | Ring 70 px, 2 s, 1–2 berries, regrow 90 s, ≤ 1 per chunk |
| **Art** | A small tree with 3 visible berries when ripe, none when bare; a 3-frame shake |
| **UI** | Capture arc in `ui.map.color.interact` (INDEX.md §4) |
| **Audio** | `sfx.map.berryTree.shake` |
| **Sim** | Like a small site: timer, drain, state |
| **Tests** | 2 s capture, drain outside, regrow 90 s, berries respect the cap |

### 7.9 Item ball — `feature.itemBall` (and the Ambusher)
| Row | |
|---|---|
| **Question** | "Grab it?" Usually yes. After 3:00, sometimes it's a Voltorb |
| **Shape** | Pickup, radius 10 |
| **Who it blocks** | Nobody |
| **Rules** | Walk over it → one of: XP cluster (worth 8 gems at the current wave), Oran Berry, Magnet *(weights 60/25/15)*. From **3:00**, **25%** of item balls are a **Voltorb Ambusher** (README §9.2, approved style): when the player comes within 160 px it **wobbles for 0.6 s**, wakes, and fuses (the existing Voltorb exploder ring) |
| **States** | `idle` → `taken`; Ambusher: `idle` → `wobble` → enemy |
| **Type reactions** | none |
| **Enemies** | The Ambusher is a Voltorb; until Voltorb is in season, item balls are always real |
| **Telegraph** | The wobble (R2: the Ambusher's only hidden state always has a tell) |
| **Numbers** | ~1 per 2 chunks; Ambusher 25% after 3:00; wake range 160 px; wobble 0.6 s |
| **Art** | A Poké Ball on the ground (red/white is fine: it's a pickup, not a telegraph). The Ambusher uses the **same sprite**; only the wobble differs |
| **UI** | XP cluster: a "+XP" floater. Ambusher: none (the wobble is the tell) |
| **Audio** | `sfx.map.itemBall.pickup`, `sfx.map.itemBall.wobble` |
| **Sim** | Pickup list per chunk; the Ambusher becomes a normal enemy when it wakes |
| **Tests** | Loot weights; no Ambusher before 3:00; the wobble always comes before the fuse |

### 7.10 Floor dressing — `floor.*` (no rules)
| ID | Biome | Purpose |
|---|---|---|
| `floor.grass` | meadow, woods | Base floor |
| `floor.flowers` | meadow | Filler decoration (no collision) |
| `floor.dirt` | all | Paths between set-piece openings (decoration that hints at lanes) |
| `floor.rocky` | canyon | **Burrowers dig here:** Diglett prefer to spawn and dig on rocky cells (their dirt trail shows on it) |
| `floor.sand` | lakes | Shore band, 1 cell wide around water |
| `floor.ash` | any | Burnt grass (the `ash` state of tall grass) |

---

## 8. Type reactions (attack type × feature)
A reaction happens when a **player** move hit (attack type = the move's first Pokémon-type tag, PROJECT.md §9)
lands on a feature. Enemy attacks don't cause reactions (keeps the system small and in the player's hands).

| Feature ↓ / Attack type → | Fire | Water | Electric | Ice | Grass | Others |
|---|---|---|---|---|---|---|
| **Tall grass** | **Ignite** (burns enemies, 4 s, then ash) | — | — | — | — | — |
| **Deep water** | — | — | Charge (2 s; swimming enemies only) | **Ice bridge** (6 s) | — | — |
| **Marsh** | — | — | **Charge** (paralysis 0.4 s to grounded enemies) | **Freeze** (no slow 6 s, enemies slip) | — | — |
| **Ice bridge** | **Melt** (instant crack) | — | — | Refresh to 6 s | — | — |

Only six reactions, on purpose: each one is a sentence a tester can say, and every starter owns at least one map
trick:

| Starter | Its map identity |
|---|---|
| **Charmander line** | Burns grass into traps. **Charizard flies**: water, marsh and ledges stop mattering (the evolution moment opens the map) |
| **Squirtle line** | Swims (×0.85); marsh doesn't slow it; its puddles stack with fords |
| **Bulbasaur line** | Rests in tall grass (regen after 2 s); roots and zones own corridors and ledge lines |
| **Pikachu / Raichu** | Charges marshes into kill boxes; fast enough to use ledges as escapes |
| **Lapras** | Water is a highway from minute 1 (×1.0); Ice moves build bridges; strong early, as its gamble says |

### 8.1 Where a hit "lands" (trigger points)
| Form | Trigger point(s) |
|---|---|
| Projectile | Where it hits an enemy, ends, or stops on a boulder; **plus**, while flying over water/marsh/grass, once per 50 px cell it enters, max 4 per projectile |
| Area / blast | Its centre, plus the cells its radius covers (max 8 cells) |
| Zone | Its cast centre, once when cast |
| Beam | Sample points every 50 px along it, max 8 |
| Melee | The tip point (or the arc's middle for 360° moves) |
| Orbit | Each ball, once per cell entered, max 2 per ball per second |

Every feature patch has a **reaction cooldown of 1 s per reaction kind** (marsh charge: 4 s), so a fast multi-hit
build can't spam reactions. All counts above are caps for the budget (§12).

---

## 9. Set pieces (authoring sketches)
Each sketch is the 10 × 10 tile grid of one chunk (one character = 100 px). The generator rotates and mirrors them.
**These are the sketches as built (M2)**, copied from `src/data/map.ts` (the data is the truth). Against the first
draft: `woods.corridor`, `woods.clearing` and `canyon.pass` were redrawn to keep the edge doors (tiles 2–3 and 6–7)
open and woods under its 20% cap, and more pieces gained an `E` slot so boss entrances can find a matching biome.

**Legend:** `.` open · `g` tall grass · `w` deep water · `m` marsh · `T` tree · `o` boulder · `v` ledge on the
tile's south edge (drop south) · `r` rocky floor · `B` berry tree slot · `I` item ball slot · `S` site slot ·
`E` arena entrance slot

**Meadow**
```
setpiece.meadow.grassRing   setpiece.meadow.ledgeSteps   setpiece.meadow.berryCopse
..........                  ..........                   ..........
.gg....gg.                  .vvvv.....                   ...g......
.ggg..ggg.                  ..........                   ..gTBT....
..g....g..                  ....vvvv..                   ..gT.Tg...
....S.....                  .g........                   ...g.g....
......E...                  .gg..vvvv.                   .......I..
..g....g..                  ..........                   ......E...
.ggg..ggg.                  ..vvvv..I.                   ....o.....
.gg..I.gg.                  ..E.......                   .........S
..........                  ....B.....                   ..........
```
**Woods**
```
setpiece.woods.corridor     setpiece.woods.clearing
T...TT...T                  TT..TT..TT
T...TT...T                  T........T
..........                  ..gg..gg..
..........                  .g......g.
TTTT..TTTT                  T..B..S..T
..........                  T........T
..S.......                  .g......g.
.......I..                  ..gg.Igg..
T...TT...T                  T........T
T...TT...T                  TT..TT..TT
```
**Lakes**
```
setpiece.lakes.pond         setpiece.lakes.streamFord    setpiece.lakes.marshland
..........                  ..........                   ..........
..mmmm....                  ....ww....                   .mmm..mmm.
.mwwwwm...                  ....ww....                   .mmmm.mmm.
.mwwwwwm..                  ....mm....                   ..mm...m..
.mwwwwwm..                  ....ww....                   ....S.....
..mwwwm.E.                  .I..ww....                   ..m...mm..
...mmm..I.                  ....mm..g.                   .mmm.mmmm.
..........                  ....ww..gg                   .mmw..mmm.
.g.....S..                  ....ww.E..                   ..m...I...
.gg.......                  ..........                   .......E..
```
**Canyon**
```
setpiece.canyon.boulderField  setpiece.canyon.ledgeTerraces  setpiece.canyon.pass
r.r..rr..r                    rrrrrrrrrr                     oo..oo..oo
.o...r..o.                    vvvv..vvvv                     oo......oo
r..rr..r..                    ......E...                     ..........
..o....o..                    ...o...o..                     ..........
.r..S.r...                    vv..vvvv..                     r..I..E..r
...o.....o                    .....I....                     r........r
.o..rr.o..                    ..vvvv..vv                     ..........
r....o..r.                    .o.....o..                     ..........
..o..I..o.                    ...S......                     oo......oo
r..r...r..                    rrrrrrrrrr                     oo..oo.Soo
```
`setpiece.<biome>.open` = no piece, fillers only (every biome has one; it's also the R1 fallback).

**How the art team should read these:** a sketch fixes **what goes where and how big**; the art makes it look
natural (curved shores, irregular tree edges) **without moving colliders by more than 10 px** (§4.4).

---

## 10. The map across a run
### 10.1 Arena event foreshadowing — `event.foreshadow.<entrance>`
15 s before an arena event's entrance opens (D28), the ground around the spot it will open on starts to change, so
the player sees it coming and can choose to move toward it or finish a fight first. **Presentation only**: no rules
change on the ground.

| Entrance (`ArenaEntranceKind`) | Boss | Prefers biome | Foreshadow |
|---|---|---|---|
| `mountainHole` | Snorlax | canyon | Cracks spread outward, small rocks hop |
| `dojo` | Machamp | meadow | Banners rise, a drumbeat |
| `whirlwind` | Zapdos | meadow | Sparks and dust devils, puddles appear |
| `iceCave` | Articuno | lakes | Frost creeps out ~300 px, nearby water glazes over (looks only) |
| `pool` | (unused now) | lakes | Ripples spread |

### 10.2 Horde events from the terrain — `event.hordeEmerge`
A horde event (D34) still picks its side the same way. If that side's spawn arc has tall grass or a forest edge
within the spawn ring, the horde spawns **from that grass or edge**, and those cells **rustle for the 3 s warning**
(§7.1). Otherwise it spawns as today. The map becomes the telegraph.

### 10.3 Finale: Mewtwo's dome — `event.mewtwoDome` *(approved in principle, deferred; D47)*
**30 s before Mewtwo arrives** a psychic dome starts closing around the player's current spot (radius 1200 → 700 px
over 20 s, a visible shimmering wall that pushes you inward; no damage). Mewtwo appears inside it. The owner plans to
extend the run to ~30 min as content grows, so Mewtwo (and the dome) will move to that timing; the dome is tied to
Mewtwo's arrival, never to a fixed clock time, and waits until Mewtwo is built. **The final fight
happens on the terrain you chose**: a Lapras player can fight beside a pond, a Bulbasaur player in a corridor, a
Pikachu player next to a marsh. Mewtwo's approved kit is unchanged; this only decides the battlefield.
*"It studied you"*, and you picked the ground.

### 10.4 Time arc (15-min run, today's events)
| Time | What the map is doing |
|---|---|
| 0:00–0:30 | Start meadow, guaranteed site nearby, no blocking around you |
| 0:30–3:00 | You drift into neighbouring biomes; first ledges and grass; the first horde emerges from grass at 1:30 |
| 3:00 | Ambusher item balls start (if Voltorb is in season) |
| ~6:15 | Foreshadow 1, entrance at ~6:30 |
| 6:30–12:15 | Denser fights; terrain reactions matter as builds come online; evolution 2 (Charizard's flight) ~8:30 |
| ~12:15 | Foreshadow 2, entrance at ~12:30 |
| Mewtwo − 30 s | Mewtwo's dome (deferred until Mewtwo exists; ~30 min once the run is extended) |

---

## 11. How it works (implementation design)
### 11.1 Movement against terrain (each sim step, after velocity)
```
cell = cellAt(x, y)                                  // O(1): chunk lookup + 20×20 array
speed *= speedFactor(cell, flag)                     // marsh 0.7 for ground, the swim factor in water, else 1
move
// tall circles: push out along the normal; the tangential part of the motion survives → sliding for free
for each circle in staticHash.near(x, y):            // usually 0–2 circles
  d = dist(mover, circle); if d < r + R: mover += normal * (r + R - d)
// blocking cells (water for ground movers): test the ≤ 4 cells the mover's circle overlaps
for each blocked cell overlapped: push out along the axis of least penetration
// ledges: see 11.3
```
- Enemy separation (`separationStrength`) runs first and terrain push-out last, so terrain always wins (no one ends
  up inside a rock).
- Arena fights don't use any of this: arenas keep their own rubble and walls.

### 11.2 Swimming, flying, levitating
`speedFactor` and "is this cell blocked for me" are both a small table lookup by `(cellClass, flag)`. The flag comes
from the player's stage data (`traversal: 'fly'` on Charizard) and from enemy data (Flying types → `fly`; Elite Gastly
→ `levitate`). Evolution changes the flag the moment the stage changes. **If a stage that can't swim ever ends up in
water** (it can't with today's lines; kept for safety), the player is pushed to the nearest shore cell.

### 11.3 Ledges
Each ledge is a segment with a facing normal **n** (pointing to the down side). Between two steps, compute the
mover's signed side `s = dot(pos − a, n)` before and after:
- `s` goes − → + (crossing toward the facing) for the player: start the hop (0.35 s, 60 px along **n**, input locked).
  Enemies just keep walking.
- Anyone moving against the facing while `s` is within the 20 px band: speed ×0.3 (climbing; D47, same for the
  player and enemies).
- `fly`/`levitate`: skip the test.

### 11.4 Stuck enemies
Straight chasers can get stuck behind a pond or a tree wall. **As built (M1):** each enemy counts `blockedFor`, the
seconds it has been pushed out of an obstacle (it counts down while free). Once it reaches **3 s** and the enemy is
farther than **450 px** from the player, it's moved onto the spawn ring (the existing D26 `recycleStragglers` path,
which keeps its HP). Stuck enemies within 450 px stay: they're usually on a shore you can shoot across, which is the
point. (Contact time replaced the first draft's "distance hasn't dropped" rule: it never flags ranged enemies that
keep their distance on purpose.)

**Amended 2026-10-25 (D47 amendment), after a playtest showed mobs wedged in the seams of tree walls.** Trees 100 px
apart with radius 45–50 leave 0–10 px seams: two touching circles make a pocket a straight chaser slides into and
can't leave, and since trees block shots (D41), a mob stuck there near you could be neither reached nor hit.
- **Stuck** now means an obstacle pushed the enemy *and* it moved less than 25% of its speed that step
  (`MAP_TUNING.stuck.progress`). Ranged enemies holding their distance aren't pushed, so they still never count.
- **Wall-follow** (`MAP_TUNING.follow`, still no pathfinding): stuck 0.3 s, the enemy picks the side closer to where it
  wants to go and walks along the wall (normal = sum of the touched obstacles' normals, so a seam reads as one wall),
  leaning in by 0.3 on a single trunk so it stays on it. It leaves when the way it wants points off the wall *and* is
  clear for 150 px, keeps its side until it has been off the wall 0.6 s, and turns round every 1 s it stays stuck
  while following (two followers meeting head-on).
- **Recycling** also fires within 450 px when an obstacle stands on the line between the enemy and you
  (`lineBlocked`): you can't fight it across trees or boulders. Ponds (M3) don't block that line.

### 11.4a What M1–M2 built differently, on purpose
- **No static hash.** Each chunk keeps one lookup list: its own obstacles plus its neighbours' within 75 px of its
  edges (`reach`). A mover narrower than 75 px can't touch anything else, so collision reads one short list.
  Unit-tested: every player and enemy radius stays under 75.
- **Doors instead of a border-aware lane check** (§5.4): connectivity across chunks without any chunk reading another.
- **Spawns, recycled enemies, sites and entrances:** enemies are pushed clear by the same end-of-step pass that keeps
  them out of obstacles; sites use their S slot or are nudged clear (`clearSpot`); entrances use a matching-biome E slot
  or are nudged clear.
- **Tiles with no rules yet** (ledges, rocky floor, berry trees, item balls) are laid out and counted by the lane
  check and caps, but have no effect and aren't drawn until M4.
- **M3 is built in two steps.** **M3a** (built 2026-10-25): cells, traversal flags, water and marsh. **M3b** (built
  2026-10-25): tall grass rules and the six reactions (§8), with the ice bridge. Both are described below.
- **M3a as built:**
  - Each chunk stores its 20 × 20 cells (`MapChunk.cells`, one `CELL` byte each) from its tiles, plus a `water` flag;
    `cellAt` is one chunk lookup and an array read.
  - Traversal: the player's flag comes from the stage (`EvolutionStage.traversal`: Charizard `fly`, the Squirtle line
    and Lapras `swim`); enemies are `fly` if Flying-typed, `levitate` if an Elite Gastly, else `ground`.
  - Water push-out: a mover's circle is pushed out of every overlapping water cell (closest point on the cell, so
    movers slide along shores); a centre that lands in water (a spawn, a recycle) is lifted to the nearest dry cell.
    Shores feed the wall-follow normal as one wall, and a walker's follow look-ahead counts water; stuck recycling
    still ignores ponds (you can shoot across).
  - A mover wholly inside a chunk with no water skips the water test (it cost ~0.8 ms/step at 500 enemies without).
  - Pickups dropped in water, and sites and entrances, are moved to the nearest dry cell (sites and entrances also off
    marsh) with `nearestCell`, searching up to 12 cells out.
  - Not built yet: the swimming HUD chip and first-swim notice (M5 notices), and the spec's "try 4 more spawn angles"
    (spawns in water are lifted out instead).
- **M3b as built** (`src/sim/mapReactions.ts`):
  - **Patches** are 4-connected same-class cells inside one chunk (labels built on first use). Shortcut: a patch stops
    at a chunk edge; set pieces rarely put grass, marsh or water on a door.
  - **State** lives per patch in `world.map.patches` (fire start and spread distances, charge and freeze times,
    per-kind cooldowns) and in `world.map.bridges`. A grass cell's phase (grass, burning, ash, regrow) is computed from
    its spread distance and the time, so nothing ticks per cell.
  - **Triggers** (§8.1): a projectile in each feature cell it enters (at most 4 counted); a zone at its centre plus up
    to 8 covered cells, once when cast; a beam every 50 px (at most 8), once when cast; a melee swipe at its tip (wing
    beats at each tip); an orbit at each ball every 0.5 s (per slot, not per ball). Blasts and explosions add none:
    their projectile already reacted on the way.
  - **Effects** run on the 0.25 s cadence, and only while something burns or is frozen: burning cells Burn enemies
    through `applyBurn`; frozen marsh makes grounded enemies slip; the marsh charge uses `applyNewStun` and a proc
    hit. Nothing reaches hooks, Techniques or other reactions (R5), and nothing touches the player (R6).
  - **Ice bridge**: the strip runs along the hit's heading (away from the player for hits without one), plus one cell
    to its right; water under it reads as open floor in `cellAt`, so movement, collision and drawing need nothing else.
    When it melts, grounded enemies on it are stunned and the water push-out lifts everyone ashore.
  - **Charged water** only shows (2 s); it will matter once swimming enemies exist.
  - Not built yet: the first-ignite and first-bridge notices (M5), and the rustle / horde-from-grass tell (M5).
- **Entrance slots are rare within 800 px**: in a unit-test sample, 3 of 24 tries found a matching-biome slot; the rest
  fell back to today's placement. **Owner 2026-10-25: keep 800 px**; most entrances use today's placement for now.
- **Off by default in the sim** (`obstacleDensity: 0`), so existing tests and the balance bot are unchanged; the game
  passes 1, and `?stress=1` makes every chunk woods (the densest biome).

### 11.5 Data shapes (`src/data/map.ts`; names are the contract, shapes a suggestion)
```ts
type BiomeId = 'meadow' | 'woods' | 'lakes' | 'canyon';
type FeatureId = 'tallGrass' | 'deepWater' | 'iceBridge' | 'marsh' | 'ledge' | 'boulder' | 'tree' | 'berryTree' | 'itemBall';
type Traversal = 'ground' | 'swim' | 'fly' | 'levitate' | 'burrow';
type CellClass = 'open' | 'grass' | 'slow' | 'water';

interface BiomeDef {
  readonly id: BiomeId;
  readonly share: number;                    // §5.2
  readonly maxBlocking: number;              // R7
  readonly setPieces: readonly { readonly id: string; readonly weight: number }[];
  readonly fillers: readonly { readonly feature: FeatureId; readonly perChunk: number }[];
}

interface SetPieceDef {
  readonly id: string;                       // 'canyon.ledgeTerraces'
  readonly biome: BiomeId;
  readonly rows: readonly string[];          // 10 strings of 10 chars, legend §9
}

interface ReactionDef {
  readonly id: string;                       // 'marsh.electric'
  readonly feature: FeatureId;
  readonly type: PokemonType;
  readonly cooldown: number;                 // per patch, §8.1
}

const MAP_TUNING = {
  cellSize: 50,
  swim: { lapras: 1.0, squirtleLine: 0.85, flyerTiltAfter: 3, flyerTiltWeight: 2 },
  marsh: { slow: 0.3, charge: { paralyse: 0.4, damageFraction: 0.2, cooldown: 4 }, freeze: { seconds: 6, slipPerSec: 0.2, slipStun: 0.3 } },
  grass: { restDelayGrassType: 2, burnSeconds: 4, spreadCellsPerSec: 3, burnFraction: 0.3, ashSeconds: 60, maxBurning: 2 },
  iceBridge: { cells: 8, width: 2, seconds: 6, crack: 1, pushStun: 0.5, max: 3 },
  ledge: { hopSeconds: 0.35, hopDistance: 60, climbFactor: 0.3, band: 20 },
  berryTree: { ring: 70, capture: 2, regrow: 90, berries: [1, 2] },
  itemBall: { perChunk: 0.5, ambusherFrom: 180, ambusherChance: 0.25, wakeRange: 160, wobble: 0.6 },
  stuck: { window: 3, progress: 0.1, recycleBeyond: 450 },
  farSites: { fromStart: 3000, boundWeight: 1.5, rankUpWeight: 1.5 },
} as const;
```

### 11.6 Code layout
| File | Contents |
|---|---|
| `src/data/map.ts` | Biomes, set pieces, reactions, `MAP_TUNING` (all data, checked by tests) |
| `src/sim/map/generate.ts` | Noise, the §5.3 pipeline, the §5.4 lane check (pure, seeded) |
| `src/sim/map/collide.ts` | §11.1–§11.3 |
| `src/sim/map/reactions.ts` | §8, on the 0.25 s status cadence, through the existing status functions (R5) |
| `src/sim/map/features.ts` | Berry trees, item balls, ice bridges, burning grass state |
| `src/render/mapLayer.ts` | Chunk drawing (each chunk's static ground drawn once into a texture, reused every frame) |

The sim stays Phaser-free (AGENTS.md); `World` gains a `map` field. Arena fights already store the main map while
you're inside; the map state goes with it.

---

## 12. Performance budget (PROJECT.md §11.1)
| Item | Budget |
|---|---|
| Live chunks | 25 (5 × 5 around the player); farther chunks unload; burnt/ice state is dropped on unload (it regrows anyway) |
| Tall circles | ≤ 40 per chunk → ≤ 1000 live, in a static hash; a mover checks its own cell (≈ 0–2 circles) |
| Cell lookups | 1 per mover per step for the cell class, ≤ 4 for blocking cells |
| Reactions | Trigger caps in §8.1; per-patch cooldowns; ≤ 2 burning patches; ≤ 3 ice bridges |
| Generation | Once per chunk, at most 1 chunk per frame |
| Rendering | Static ground baked once per chunk; only animated states (grass sway, water shimmer, fire) draw every frame |
| **Stress test** | `?stress=1` gains `&biome=woods` (densest); must hold 60 fps with 500 enemies + a max build |

---

## 13. Build steps (each ends playable; typecheck, tests, build, browser check; FPS recorded from M1)
| Step | Build | Checks |
|---|---|---|
| **M1** | Obstacle core: chunk cells, static circle hash, push-out + slide for the player and enemies, projectile blocking (the D41 rule on map boulders and trees), spawn/site placement avoidance, stuck recycling. **Boulders and trees only**, grey | Unit tests for slide, blocking, spawn validity, stuck recycling; stress FPS |
| **M2** | Biome noise, set pieces (§9), rotation/mirroring, lane check, the start-area rule | Same seed = same map; R1 holds on 1000 generated chunks; coverage caps |
| **M3** | Water, marsh, tall grass, traversal flags (swim/fly/levitate), the six reactions | The §7 card tests; reactions respect caps, R5 and R6 |
| **M4** | Ledges, berry trees, item balls + Ambusher, floor dressing, burrower/roller hooks | Card tests; Roller bounce; Ambusher wobble |
| **M5** | Foreshadowing, horde emergence from grass, first-time notices. Mewtwo's dome when Mewtwo exists (D47: deferred) | Browser check; owner playtest of the gate (§1.1) |

**Timing (D47):** M1–M3 are pulled forward from P6 and start after the current boss work (Machamp and Articuno
playtest); M4–M5 stay at P6 with art.

The balance bot (`npm run balance`) must learn to walk round obstacles in M1 (slide is enough) and to swim in M3,
or its numbers stop meaning anything.

---

## 14. Notes for the art and UI teams
- Sizes are in world px (1 world px = 1 art px at 1×); deliver @2× if preferred, file names unchanged.
- A minimap is **not** in this proposal. INDEX.md still gives every feature a minimap colour so one can be added.
- Autotile sets: 16-tile marching-squares sets for tall grass, deep water, marsh, ice, ash, rocky floor and sand.
- Sprite source is still open (D4: SpriteCollab leads for Pokémon; terrain tiles need their own licensed source).

## 15. Owner decisions (2026-10-24, recorded as D47 in PROJECT.md §13)
| # | Question | Owner's answer |
|---|---|---|
| **15-1** | Macro layout | **Biome noise + set pieces, with far sites:** sites ≥ 3000 px from the start weight bound and rank-up cards ×1.5 (§5.5). Distance rings rejected |
| **15-2** | Traversal | **Full set:** Lapras swims ×1.0, Squirtle line ×0.85, Charizard flies over low features, Ice makes 6 s bridges; swimming counters as §7.2 |
| **15-3** | Timing | **M1–M3 now** (after the current boss work), M4–M5 at P6 with art |
| **15-4** | Arena entrances | **Matching biome within 800 px**, else near the player (D28 fallback) |
| **15-5** | Mewtwo's dome | **Approved in principle, deferred.** The run will grow to ~30 min, so the dome starts 30 s before Mewtwo arrives, whenever that is (§10.3) |
| **15-6** | Ledges | **Both climb slowly:** everyone hops down; the player and enemies climb up at 30% (§7.5) |
