# Mutations: authored optional build transformations

## Definition
A mutation is not an evolution, generic status reaction or basic synergy bonus. It is a rare, named, explicitly selected **replacement or reinterpretation of existing mechanics**, unlocked by a recipe. Most combinations should remain ordinary composition, a smaller set gets pair merges, and only a handful become named mutations.

## Requirements
- **Core:** a named eligible evolution, e.g. Living Garden.
- **Enabler:** compatible augment(s) / skill / passive / status.
- **Catalyst (optional):** weather/form/terrain that improves the mutant behavior; generally not mandatory if weather is external RNG.
- **Availability:** detect conditions, display preview and opportunity cost, offer at a deliberate milestone; accept or decline; player retains baseline if declined.
- **Replace manifest:** which behaviors, triggers and visuals are REMOVED, MODIFIED, or ADDED.
- **Budget:** entity/proc limits, upfront costs, cooldowns; intended strengths and newly introduced weaknesses.
- **Lifecycle:** clarify what happens when weather ends, skills are unequipped, Pokémon evolves or a temporary catalyst disappears. Persist permanent mutation if its core ownership still exists; only its weather bonus fluctuates.

## Worked recipes
1. **Wandering Blight**: Living Garden + Momentum + Volatility. Plants cease serving as stable defensive roots; become limited mobile seed carriers that drift along a trail and explode on contact/expiry. Gains kiting, loses steady zone healing/control. Replaces default garden plant expiry and root-control hooks. Keep max carriers and explosions/sec.
2. **Solar Seed Reactor**: Living Garden + Sacrifice + Solar Beam; Sun enhances but is optional. Mature plants are harvested into a capped set of solar cores consumed by Solar Beam for angled offshoot beams. Sacrifice removes original plants, so they cannot both grant defensive aura and contribute full burst.
3. **Parasitic Supernova**: Parasitic Network + Catalyst + Poison Powder. Poison consumes stored infection energy to build critical charge; at threshold the network collapses in a wave, removing some infection links. Better horde payoff, risk of downtime against isolated enemies.
4. **Thorn Sanctuary**: Thorn Cyclone + Anchor + Synthesis. Holding ground generates a protective thorn ring; exiting the area drops accumulated sanctuary charges. Strong defense, limited mobility.

## Mutation design review
- Can an unaffected observer tell this is a different strategy?
- Do 1–3 existing triggers get REPLACED instead of all effects merely stacking?
- Is player consent and preview explicit?
- Are trade-offs meaningful, including bosses and mobile encounters?
- Is there a readable state indicator (charge, plant appearance, status ring)?
- Are the recipe's requirements realistically achievable in a standard run?
