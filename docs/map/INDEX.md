# Map registry — every ID, label, colour, asset and string

**Status:** APPROVED with [`README.md`](README.md) (owner, 2026-10-24, D47). This is the hand-off sheet for the UI,
art and audio teams. Rows are keyed by **ID**: IDs never change once approved; display names, colours and text may.
When code exists, `src/data/map.ts` must use exactly these IDs (a sync test will check, as `docs/moveset/INDEX.md`
does for Mutations).

---

## 1. ID rules
- Prefixes: `biome.` `floor.` `feature.` `reaction.` `setpiece.` `event.` `fx.map.` `sfx.map.` `ui.map.`
  (meaning: README §4.1).
- States: `feature.<id>:<state>`.
- camelCase after the prefix; no spaces, no numbers except variants (`_01`).
- A new feature needs: a row in §3, its states in §4, colours in §5, assets in §6, strings in §8, sounds in §9.

---

## 2. Biomes
| ID | Display name | Floor token (§5) | Fillers | Set pieces |
|---|---|---|---|---|
| `biome.meadow` | Route Meadow | `map.floor.meadow` | flowers, grass tufts, lone boulder | `meadow.grassRing`, `meadow.ledgeSteps`, `meadow.berryCopse`, `meadow.open` |
| `biome.woods` | Viridian Woods | `map.floor.woods` | single trees, grass tufts | `woods.corridor`, `woods.clearing`, `woods.open` |
| `biome.lakes` | Cerulean Lakes | `map.floor.lakes` | small marsh, reeds, sand | `lakes.pond`, `lakes.streamFord`, `lakes.marshland`, `lakes.open` |
| `biome.canyon` | Rock Canyon | `map.floor.canyon` | boulders, rocky floor | `canyon.boulderField`, `canyon.ledgeTerraces`, `canyon.pass`, `canyon.open` |

---

## 3. Features
**Height:** `low` = flyers ignore it · `tall` = blocks everything · `none` = no collision.
**Layer:** README §4.4.

| ID | Display name | Height | Collision class | Layer | Size (world px) | Blocks shots? | Card |
|---|---|---|---|---|---|---|---|
| `feature.tallGrass` | Tall Grass | none | `grass` cells | terrain (+ `grassSkirt`) | patches 100–300 | no | §7.1 |
| `feature.deepWater` | Deep Water | low | `water` cells | terrain | ponds ≤ 600 across; streams 100 wide, ≤ 800 long | no | §7.2 |
| `feature.iceBridge` | Ice Bridge | none | `open` cells (timed) | reaction | 400 × 100 max | no | §7.3 |
| `feature.marsh` | Marsh | low | `slow` cells | terrain | patches; fords ≥ 100 × 100 | no | §7.4 |
| `feature.ledge` | Ledge | low | segment + facing | terrain | 150–400 long, lip 8–12 tall | no | §7.5 |
| `feature.boulder` | Boulder | tall | circle | tall | radius 30–70 | **yes** (both sides) | §7.6 |
| `feature.tree` | Tree | tall | circle | tall | radius 40–60 | **yes** | §7.7 |
| `feature.berryTree` | Berry Tree | tall | circle + ring 70 | tall | radius 30 | **yes** | §7.8 |
| `feature.itemBall` | Item Ball | none | pickup | pickup | radius 10 | no | §7.9 |

| Floor ID | Display name | Rule |
|---|---|---|
| `floor.grass` | Grass | none |
| `floor.flowers` | Flowers | none |
| `floor.dirt` | Dirt Path | none (hints at lanes) |
| `floor.rocky` | Rocky Ground | Burrowers dig here |
| `floor.sand` | Sand | none (shore band) |
| `floor.ash` | Ash | none (burnt grass) |

---

## 4. States
| State ID | Duration | Next | Art frames | Notes |
|---|---|---|---|---|
| `feature.tallGrass:idle` | — | rustle / burning | 2 (sway loop) | |
| `feature.tallGrass:rustle` | 3 s | idle | 4 (hard sway loop) | Horde tell; white shimmer on the cells |
| `feature.tallGrass:burning` | 4 s per cell | ash | 4 (flame loop) | Soft orange **fill**, no outline (R3) |
| `feature.tallGrass:ash` | 60 s | regrow | 1 | Draws as `floor.ash` |
| `feature.tallGrass:regrow` | 1 s | idle | 3 (sprout) | |
| `feature.deepWater:idle` | — | charged | 2 (shimmer) | Foam edge always on |
| `feature.deepWater:charged` | 2 s | idle | 3 (sparks loop) | |
| `feature.iceBridge:frozen` | 6 s | cracking | 1 | |
| `feature.iceBridge:cracking` | 1 s | (water) | 3 (crack spread) | Telegraph: flicker the whole second |
| `feature.marsh:idle` | — | charged / frozen | 2 (reed sway) | |
| `feature.marsh:charged` | 1 s | idle | 3 (sparks) | |
| `feature.marsh:frozen` | 6 s | idle | 1 (glaze) | |
| `feature.berryTree:ripe` | — | shaking | 1 | 3 blue berries visible |
| `feature.berryTree:shaking` | 0.4 s | bare | 3 | |
| `feature.berryTree:bare` | 90 s | ripe | 1 | |
| `feature.itemBall:idle` | — | taken / wobble | 1 | The Ambusher uses this same frame |
| `feature.itemBall:wobble` | 0.6 s | (Voltorb enemy) | 4 | The Ambusher's only tell |

---

## 5. Colour tokens (grey-box values; art replaces them, roles stay)
**Readability rule (R3):** red/orange **outlines** and flashing are reserved for enemy telegraphs. Terrain uses the
muted values below; player reactions are soft fills (alpha ≤ 0.5) without outlines.

| Token | Grey-box hex | Role | Minimap colour |
|---|---|---|---|
| `map.floor.meadow` | `#2b3a24` | Meadow floor | same |
| `map.floor.woods` | `#22301e` | Woods floor | same |
| `map.floor.lakes` | `#2a3a33` | Lakes floor | same |
| `map.floor.canyon` | `#3a3328` | Canyon floor | same |
| `map.floor.rocky` | `#4d463d` | Rocky ground | `#4d463d` |
| `map.floor.sand` | `#8a7d5a` | Shore band | `#8a7d5a` |
| `map.floor.ash` | `#4a4440` | Burnt grass | `#4a4440` |
| `map.terrain.tallGrass` | `#4f7a35` | Tall grass | `#4f7a35` |
| `map.terrain.water` | `#2f6f9f` | Deep water | `#3f8fd0` |
| `map.terrain.waterFoam` | `#d8eef7` | Shore foam edge (3 px) | — |
| `map.terrain.marsh` | `#4a5a3a` | Marsh | `#5a7050` |
| `map.terrain.ledgeLip` | `#c9c2a8` | Ledge top edge + chevrons | `#ffffff` |
| `map.tall.boulder` | `#6e6a63` | Boulders | `#9a958c` |
| `map.tall.tree` | `#1f4a24` | Tree canopy | `#1a3a1d` |
| `map.tall.berryTree` | `#2f5a2a` | Berry tree canopy | `#8fd16a` |
| `map.pickup.oranBerry` | `#3a6fd8` | Berries on the tree | — |
| `map.reaction.burning` | `#e8833a` @ 0.5 | Burning grass (soft fill) | — |
| `map.reaction.charged` | `#e8d86a` @ 0.4 | Charged water/marsh (soft fill) | — |
| `map.reaction.ice` | `#bfe3f2` | Ice bridge, frozen marsh | `#bfe3f2` |
| `ui.map.color.interact` | `#8fd16a` | Berry tree capture arc (sites keep cyan/purple/gold) | — |
| `ui.map.color.dome` | `#c58cff` @ 0.35 | Mewtwo's dome wall | — |

---

## 6. Asset names (art)
**Pattern:** `map/<group>/<id>/<state>_<variant>.png`, packed per feature into a Phaser atlas
`map/<group>/<id>.json` (frame names = file names without `.png`).
Groups: `floor` · `terrain` · `tall` · `pickup` · `fx`.

| Asset key | Contents | Variants | Size (1×) |
|---|---|---|---|
| `map/floor/<biome>/base_01..04` | Tileable floor per biome | 4 | 100 × 100 |
| `map/floor/flowers/idle_01..06` | Flower decals | 6 | 20–40 |
| `map/floor/dirt/…` | Path autotile (16) | 1 set | 50 × 50 tiles |
| `map/floor/rocky/…` | Rocky autotile (16) | 1 set | 50 × 50 |
| `map/floor/sand/…` | Shore autotile (16) | 1 set | 50 × 50 |
| `map/floor/ash/…` | Ash autotile (16) | 1 set | 50 × 50 |
| `map/terrain/tallGrass/{idle,rustle,burning,regrow}_f1..fN` + autotile (16) | Grass patch edges + animated tufts | 1 set | 50 × 50 tiles, tufts ~40 tall |
| `map/terrain/tallGrass/skirt_f1..f2` | Overlay over a unit's lower 30% (scaled to unit width) | 1 | 48 × 16 |
| `map/terrain/deepWater/…` autotile (16) × 2 shimmer frames, foam edge | Water | 1 set | 50 × 50 |
| `map/terrain/marsh/…` autotile (16) × 2 frames + `reeds_01..04` | Marsh | 1 set | 50 × 50 |
| `map/terrain/ice/…` autotile (16) + `crack_f1..f3` | Ice bridge / frozen marsh | 1 set | 50 × 50 |
| `map/terrain/ledge/{lip_mid,lip_endL,lip_endR,chevron}` per facing (S, E, W) | Ledge, tiled along its length | 3 facings | 50 long × 12 tall |
| `map/tall/boulder/{s,m,l}_01..04` | Boulders by size class | 12 | Ø 60–140 |
| `map/tall/tree/idle_01..04` | Canopies | 4 | Ø 80–120 |
| `map/tall/berryTree/{ripe,shaking_f1..f3,bare}` | Berry tree | 1 | Ø 60 |
| `map/pickup/itemBall/{idle,wobble_f1..f4}` | Item ball / Ambusher | 1 | 20 × 20 |
| `map/fx/transition/<biomeA>_<biomeB>` | Biome border strip | 6 pairs | 100 wide |
| `map/fx/foreshadow/<entrance>_f1..fN` | Foreshadow effects (README §10) | 1 per entrance | ~600 across |
| `map/fx/dome/wall_f1..f4` | Mewtwo dome edge | 1 | tiling strip |
| `map/fx/charged/sparks_f1..f3` | Charged overlay | 1 | 50 × 50 |
| `map/fx/hop/shadow` | Ledge hop shadow | 1 | 40 × 12 |

**Art rules every asset must follow** (README §3, §4.4):
1. Tall things: art footprint = collider + ≤ 10 px. Nothing may be drawn over a unit except `grassSkirt`.
2. No red/orange outlines or flashing on terrain (R3).
3. Low features must read as low (flat, shading inward); tall features cast a south shadow.
4. Grey boxes first: every asset key above has a flat-colour stand-in from §5 until art lands.

---

## 7. Autotile sets and transition strips
| Set | Used by | Tiles |
|---|---|---|
| `autotile.tallGrass` | tall grass | 16 (marching squares) |
| `autotile.water` | deep water | 16 × 2 frames |
| `autotile.marsh` | marsh | 16 × 2 frames |
| `autotile.ice` | ice bridge, frozen marsh | 16 |
| `autotile.ash` | burnt grass | 16 |
| `autotile.rocky` | rocky floor | 16 |
| `autotile.sand` | shore band | 16 |
| `autotile.dirt` | paths | 16 |

| Transition strip | Between |
|---|---|
| `transition.meadow_woods` | meadow ↔ woods |
| `transition.meadow_lakes` | meadow ↔ lakes |
| `transition.meadow_canyon` | meadow ↔ canyon |
| `transition.woods_lakes` | woods ↔ lakes |
| `transition.woods_canyon` | woods ↔ canyon |
| `transition.lakes_canyon` | lakes ↔ canyon |

---

## 8. UI strings and icons
Notices use the existing event-notice style (26 px gold, outlined, 4.5 s). **First-time** notices show once per run.

| ID | Text (English) | When | Kind |
|---|---|---|---|
| `ui.map.notice.grassRest` | "Resting in tall grass: regen starts sooner" | A Grass-type player first stands in tall grass | first-time |
| `ui.map.notice.grassBurning` | "The grass is burning!" | First grass ignite | first-time |
| `ui.map.notice.swimming` | "Swimming! No rest regen, and flyers notice you" | First swim | first-time |
| `ui.map.notice.iceBridge` | "Ice bridge! It melts in 6 s" | First ice bridge | first-time |
| `ui.map.notice.ledgeClimb` | "Climbing a ledge is slow (enemies too)" | First time the player climbs a ledge | first-time |
| `ui.map.notice.hordeEmerge` | "Something is rustling in the grass…" | Horde warning when it emerges from grass | every time |
| `ui.map.notice.foreshadow.mountainHole` | "The ground is shaking…" | 15 s before the entrance | every time |
| `ui.map.notice.foreshadow.dojo` | "Drums echo from somewhere…" | 15 s before | every time |
| `ui.map.notice.foreshadow.whirlwind` | "The air crackles…" | 15 s before | every time |
| `ui.map.notice.foreshadow.iceCave` | "Frost creeps across the ground…" | 15 s before | every time |
| `ui.map.notice.foreshadow.pool` | "The water starts to ripple…" | 15 s before | every time |
| `ui.map.notice.mewtwoDome` | "A psychic barrier closes in…" | 30 s before Mewtwo arrives (deferred, D47) | every time |
| `ui.map.chip.swimming` | "Swimming" | HUD status chip while in water | chip |
| `ui.map.chip.marsh` | "Marsh −30% speed" | HUD status chip while slowed by marsh | chip |
| `ui.map.floater.xp` | "+XP" | XP cluster from an item ball | floater |

| Icon ID | Shows | Used in |
|---|---|---|
| `ui.map.icon.swimming` | Wave | HUD chip |
| `ui.map.icon.marsh` | Reeds | HUD chip |
| `ui.map.icon.berryTree` | Blue berry | Edge arrow (if berry trees get arrows later) |

---

## 9. Sounds
All throttled per PROJECT.md §11.1 (the same sound at most N per 100 ms).

| ID | When |
|---|---|
| `sfx.map.grass.rustle` | Loop during the horde tell |
| `sfx.map.grass.ignite` | A patch ignites |
| `sfx.map.grass.burnLoop` | One loop per burning patch |
| `sfx.map.water.enter` / `sfx.map.water.exit` | Player enters / leaves water |
| `sfx.map.water.charged` | Water charged |
| `sfx.map.marsh.step` | Player moving in marsh (throttled) |
| `sfx.map.marsh.charged` | Marsh charged |
| `sfx.map.marsh.freeze` | Marsh frozen |
| `sfx.map.ice.freeze` / `sfx.map.ice.crack` | Ice bridge made / cracking |
| `sfx.map.ledge.hop` / `sfx.map.ledge.land` | Ledge hop |
| `sfx.map.boulder.block` | A shot stops on a boulder (heavily throttled) |
| `sfx.map.berryTree.shake` | Berry tree drops berries |
| `sfx.map.itemBall.pickup` / `sfx.map.itemBall.wobble` | Item ball taken / Ambusher waking |
| `sfx.map.foreshadow.<entrance>` | Foreshadow loop per entrance |
| `sfx.map.dome.close` | Mewtwo's dome closing |

---

## 10. Reactions, set pieces and events
| Reaction ID | Feature | Attack type | Effect | Cooldown per patch |
|---|---|---|---|---|
| `reaction.tallGrass.fire` | tall grass | Fire | Ignite | — (ash blocks re-ignite) |
| `reaction.deepWater.ice` | deep water | Ice | Ice bridge | 1 s |
| `reaction.deepWater.electric` | deep water | Electric | Charge 2 s | 1 s |
| `reaction.marsh.electric` | marsh | Electric | Paralyse 0.4 s | 4 s |
| `reaction.marsh.ice` | marsh | Ice | Freeze 6 s | 1 s |
| `reaction.iceBridge.fire` | ice bridge | Fire | Melt | — |

| Set piece ID | Biome | Slots |
|---|---|---|
| `setpiece.meadow.grassRing` | meadow | S, I |
| `setpiece.meadow.ledgeSteps` | meadow | I, B |
| `setpiece.meadow.berryCopse` | meadow | B, I, E, S |
| `setpiece.woods.corridor` | woods | I, S |
| `setpiece.woods.clearing` | woods | B, S, I |
| `setpiece.lakes.pond` | lakes | E, I, S |
| `setpiece.lakes.streamFord` | lakes | I |
| `setpiece.lakes.marshland` | lakes | S, I |
| `setpiece.canyon.boulderField` | canyon | S, I |
| `setpiece.canyon.ledgeTerraces` | canyon | I, S |
| `setpiece.canyon.pass` | canyon | I, E, S |
| `setpiece.<biome>.open` | each | — |

| Event ID | When | Kind |
|---|---|---|
| `event.foreshadow.<entrance>` | 15 s before an arena entrance opens | presentation |
| `event.hordeEmerge` | A horde event whose side has grass or a forest edge | spawn origin + tell |
| `event.mewtwoDome` | 30 s before Mewtwo arrives *(deferred until Mewtwo exists, D47)* | arena-on-map |
