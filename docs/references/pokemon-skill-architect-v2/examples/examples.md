# Worked designs: Leech Seed, Razor Leaf, Solar Beam

These are original game concepts inspired by familiar Pokémon moves; the precise names and mechanics are design proposals, not assertions about canonical move behavior.

## A. Leech Seed

**Fantasy:** Implant life-draining seeds. **Base:** seed projectile applies drain status and returns small healing over time. **Tags:** Grass, Seed, Infection, Drain, Growth.

**Shared branch 1 — Parasitic Network (herd and chain)**
- R1: infected enemies within a radius become linked; shared drain on valid link ticks.
- R2: killed infected enemies send one infection seed toward a nearby uninfected target (cap per second).
- R3: linked network reaches critical mass; a visible wind-up leads to Network Collapse, consuming some infections and damaging enemies in that connected component.
- Strong: densely packed waves. Weak: isolated bosses, dispersed mobile packs.
- Positioning: herd enemies into contiguous groups, then rebuild after collapse.

**Shared branch 2 — Living Garden (defend and cultivate)**
- R1: seeds can lodge in terrain as draining plants with max active count.
- R2: plants send root tendrils, creating slow/soft control corridors.
- R3: nearby plants merge into an Ancient Bloom with strong radius but reduced coverage elsewhere (merge consumes plant slots).
- Strong: holding a lane, elite chokepoints. Weak: chase maps, frequent relocation.
- Positioning: route through the cultivated area and decide when to reposition.

**Venusaur signature — Overgrowth Dominion (close-range drain engine)**
- Species trait: Bloom Energy from plant-related status applications with a global gain budget. Trait affects other Grass moves too.
- R1: drain generates Bloom Energy; threshold releases a circular spore burst.
- R2: spore bursts root seeded enemies briefly, generate bounded defense.
- R3: Bloom activation powers a short-duration draining-vine form; after it ends, resource must be rebuilt.
- Strong: sustained pressure near dense enemies. Weak: ranged boss arenas and burst damage.

**Curated reactions**
- Poison Powder on a seeded enemy adds Mutation; at threshold burst toxic spores (capped, non-self-recursive).
- Big Root converts part of overheal to capped barrier, with expiry.
- Rain accelerates plants/germination; Sun accelerates Bloom payoff instead of simply granting damage percent.

## B. Razor Leaf

**Fantasy:** Fast slicing leaves that reward angles and motion. **Base:** fires a fan of cutting leaves. **Tags:** Grass, Blade, Projectile, Cutting.

**Shared branch 1 — Cyclone Blades (orbit and kite)**
- R1: leaves orbit the player briefly before flying outward. Player movement adjusts release angles.
- R2: leaves that graze multiple enemies collect Edge stacks, increasing the next outward release width.
- R3: at maximum Edge, the player emits a visible temporary blade cyclone; it consumes Edge stacks.
- Strong: fast-moving hordes. Weak: enemies that outrange orbit radius.

**Shared branch 2 — Thorn Ricochet (bank and trap)**
- R1: leaves ricochet between enemies and wall/terrain surfaces up to a capped bounce count.
- R2: ricochets mark targets; returning to a marked target creates a slicing cross-hit.
- R3: marked enemies form a bounded ricochet lattice for a short burst, then marks clear.
- Strong: clustered enemies in obstacle-rich arenas. Weak: wide-open boss fights.

**Example signature concept — Sceptile: Leaf Duelist**
- Species trait: Momentum builds when moving without taking damage and is usable by several cutting/dashing moves.
- R1: Razor Leaf can become short-range precision slashes around Sceptile.
- R2: timed movement between slash windows creates a bonus countercut.
- R3: spend Momentum to enter a rapid duelist phase; rewards aggressive positioning but exposes the player.

**Adapter examples:** Projectiles → extra orbiting blades / ricochet initiators; Pierce → slices through additional targets / ricochet pierces first target; Returning → blades curve back / bounce path returns; Cooldown → faster orbit release / shorter ricochet cycle.

## C. Solar Beam

**Fantasy:** Gather energy and unleash a decisive beam. **Base:** delay/charge followed by line beam. **Tags:** Grass, Light, Charge, Beam, Burst.

**Shared branch 1 — Solar Lance (aim and commit)**
- R1: narrow high-penetration beam with visible charge telegraph and large single-target payoff.
- R2: striking an already marked enemy creates a weak secondary lance at another target.
- R3: after sustained charge, a precision lance pierces boss defenses but forces a temporary recharge vulnerability.
- Strong: bosses and elites. Weak: rapidly shifting swarms.

**Shared branch 2 — Photosynthesis Field (store and detonate)**
- R1: beam becomes a sunlit ground zone that charges while enemies remain within it.
- R2: when player or allied plant effects interact with the zone, it generates stored light charges (capped).
- R3: consume stored light to trigger a broad flash-bloom detonation; replant afterward.
- Strong: defensive area control and combo setups. Weak: fast-moving encounters.

**Example signature concept — Venusaur: Solar Canopy**
- Venusaur's Bloom Energy can absorb charge time at an opportunity cost; the flower periodically projects a canopy that protects the player during charging.
- Keep this separate from Leech Seed's signature to avoid requiring all moves to get bespoke paths at launch.

**Curated interactions:** Sun speeds charging, but doesn't eliminate it; Rain may weaken raw beam payoff while accelerating Photosynthesis Field growth; Leech Seed's Garden inside the Field can convert plant ticks into capped stored light charges.

## Cross-move design review

These three moves cover contrasting gameplay archetypes: sustain/infection, moving geometry, and burst/charge. If the engine can support all three via reusable behavior modules, it is ready for expansion. Never simultaneously build dozens of shallow moves before playtesting these differences.
