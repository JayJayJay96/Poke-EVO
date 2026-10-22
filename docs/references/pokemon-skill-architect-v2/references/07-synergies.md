# Curated synergy design

## Types
1. **Basic reaction:** element/status effects can interact across multiple skills, explicitly authored.
2. **Named skill synergy:** e.g. Leech Seed + Poison Powder accumulates Mutation stacks and releases bounded spores.
3. **Signature synergy:** requires a Pokémon trait, e.g. Venusaur's Bloom Energy amplifies eligible drain interactions.

A synergy is defined as `requirements + trigger + conditions + effects + limits + feedback`.

## Example reactions
- Leech Seed + Poison Powder → **Parasitic Outbreak**: poisoned seeded enemies build Mutation; threshold consumes stacks to create a cloud and limited spread.
- Living Garden + Razor Leaf → **Harvesting Storm**: leaves consume plant stored energy; plants weaken in exchange for empowered blades.
- Synthesis + Solar Beam → **Photosynthetic Reactor**: bounded overheal produces charge that Solar Beam consumes.
- Predator Vines + Venom Minefield → **Rooted Execution**: tethers drag regular enemies through zones; boss pull immunity.
- Living Garden + Regenerative Bark → **Verdant Bastion**: defensive sustain inside garden zones.
- Living Garden + Solar Detonation → **Solar Harvest**: energy core consumes mature flowers for a larger detonation, with plant removal.

## Three worlds
- **Weather:** one global weather at a time, e.g. Sun accelerates charging; Rain grows plants faster; conditions modify rules rather than granting universal damage.
- **Terrain:** multiple local areas (Grassy, Electric, Burning, Rooted) within max density and overlap caps.
- **Entity status:** per-target infections, poison, burn, freeze, root. Specify apply/refresh/stack/expiry policy.

Weather created by an equipped skill is controllable; random stage weather should generally enhance rather than gate a build. No reaction should fire solely because two tags coexist; add an explicit rule with ownership, stage, cooldown and costs.

## No-loop rules
Never allow arbitrary recursive emission. Reaction events have origin cast ID, chain depth, generated flag, per-source proc quota. Reactions that consume statuses must remove/mark them atomically so two listeners cannot spend the same stack. Set policy for secondary/generated hits and whether those hits can trigger further synergies.
