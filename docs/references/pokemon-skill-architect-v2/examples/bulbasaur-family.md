# Bulbasaur → Ivysaur → Venusaur family: proposed design baseline

## Core identity
Grass/Poison family; growth, infection, sustained healing, stationary vs mobile terrain play, stored-energy conversion. Species trait **Life Cycle** generates bounded Growth from eligible plant/status interactions: Seedling = next eligible Grass move empowered at threshold; Germination = adds an authored secondary effect; Full Bloom = creates bounded Bloom Residue for specific move interactions. Trait should listen to generic events, not a single named move.

## Six-move slate (prototype only)
| Skill | Base | Shared A (Ranks 1/2/3) | Shared B (Ranks 1/2/3) | Family signature |
|---|---|---|---|---|
| Vine Whip | melee vines | Thorn Cyclone: sweep / pull smaller enemies / thorn payoff | Predator Vines: tether / damage while repositioning / boss-safe snapback | — |
| Leech Seed | infection and drain | Parasitic Network: link / on-death transfer / consuming collapse | Living Garden: plant / rooting terrain / Ancient Bloom merge | Symbiotic Bloom: charge / empower plants / Full Bloom Dominion |
| Razor Leaf | launched leaves | Endless Bladestorm: ricochet / cut stacking / storm release | Emerald Aegis: orbit / intercept / counter-launch | — |
| Poison Powder | status cloud | Toxic Epidemic: spread / death spore / outbreak | Venom Minefield: patches / pressure / detonation | — |
| Synthesis | timed heal | Regenerative Bark: bark / strengthen / emergency regeneration | Photosynthetic Engine: overheal→Growth / partial return / rapid regen | — |
| Solar Beam | charge beam | Solar Lance: focused pierce / intensify / discharge | Solar Detonation: core / absorb plant energy / explosion | Solar Sovereignty: Growth-charge / cycles / Venusaur beam |

The 14 total routes = 12 shared + 2 family signature, each with three ranks. This is a **content target** rather than 42 completed balance specs.

## Signature availability
Family-only branches can be selected before reaching Venusaur. Each rank works for Bulbasaur/Ivysaur, with one extra Venusaur form-dependent upgrade; preserve investment on form evolution.

## Base numeric testing seeds (not balanced)
Vine Whip 18 damage/1.4s, Leech Seed 6 damage per second for 5s/3s cooldown, Razor Leaf 2×13 damage/2s, Poison Powder 5 damage per second for 6s/5s cooldown, Synthesis 8% max HP heal/12s, Solar Beam 90 burst after 2s charge/8s cooldown. Final values require combat simulation.

## Named synergies
Parasitic Outbreak (Leech Seed + Poison Powder), Harvesting Storm (Living Garden + Razor Leaf), Photosynthetic Reactor (Synthesis + Solar Beam), Rooted Execution (Predator Vines + Venom Minefield), Verdant Bastion (Living Garden + Regenerative Bark), Solar Harvest (Living Garden + Solar Detonation).

## Branch distinctness
Network = herd, spread, collapse; Garden = prepare turf and maintain plants; Symbiotic = risky sustain, charge and cash out. Never allow one route to dominate every matchup.
