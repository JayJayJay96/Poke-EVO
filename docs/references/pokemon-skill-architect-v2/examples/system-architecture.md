# System architecture and progression

## Layer boundaries

| Layer | Responsibility | Persistent? | Example |
|---|---|---|---|
| Base skill | Core fantasy and default delivery | Content definition | Leech Seed applies draining infection |
| Augments | Player-selected promises, three slots | Current run | Returning, Area, Pierce |
| Skill evolution | Chosen behavior-changing path, three ranks | Current run | Parasitic Network ranks 1–3 |
| Species trait | One broad unique rule affecting multiple skills | Pokémon identity | Venusaur gains Bloom on PlantStatusApplied |
| Species signature path | Authored only for chosen signature moves | Content + run | Venusaur Overgrowth Dominion |
| Passive | Build-wide modifier or engine | Current run | Big Root converts overheal to limited shield |
| Synergy | Curated conditional reaction | Derived from build | Poison + Leech Seed → Mutation |
| Weather | One global condition, including player-created | Runtime world | Rain grows plants faster |
| Terrain | Local zones with spatial overlap policies | Runtime world | Root patches and fire zones |

## Recommended progression

1. Acquire skill: base behavior immediately useful.
2. Earn mastery/upgrade offers: three augment slots unlocked across mastery thresholds. Ownership of augment and ranks are distinct concepts.
3. At an announced milestone, offer an evolution choice from eligible branches. No augment-fill prerequisite by default.
4. Evolve through rank 1, then later rank 2 and rank 3. One chosen path per skill per run.
5. Let synergy rules activate automatically when conditions arise; surface a short notification and explanation.

For MVP, use three choices in a level-up draft, four active skills and four passives as provisional caps. Put evolution choice at a milestone or skill mastery threshold; do not require hidden pairings for core branch access. Optional rare mutations may have conditions, but not core moves.

## Decisions that must be explicit in product design

- Can players replace an augment mid-run? Recommendation: rare reroll/respec, not frequent free swaps.
- Do augment slots refer to equipped types or levels? Recommendation: unique equipped augment types, initially one rank each.
- Can a player have duplicate augment types? MVP: no; later consider stacking only if transparent.
- How is evolution offered if the Pokémon itself evolves? Recommendation: preserve current move branch and expose new signature eligibility at next valid choice.
- Can the player choose a branch without an augment? Yes.
- Are evolved behaviors active at every rank? Rank additions should be cumulative except explicit replacement/removal.
- Can the map weather be controlled by player moves? Yes, with clear replacement/duration rules.
- Can reactive rules trigger other reactions? Only as authorized, depth-limited and budgeted.

## Useful branch axes

Use at least two orthogonal axes so every branch actually changes decisions:

- Targeting: single target / chain / zone / orbit / delayed trap / manual positioning.
- Spatial strategy: chase / kite / stand ground / herd enemies / edge control.
- Temporal strategy: sustained / setup-burst / periodic pulses / charge / detonate.
- Economy: life-drain / stack-building / overheat / consume and rebuild / sacrifice summons.
- Preferred enemies: dense horde / isolated boss / ranged units / fast enemies.

A branch identity statement should be in the format: “I **[verb]** to achieve **[payoff]**, but struggle when **[counter-condition]**.”

## Weather and terrain

Separate Weather (global), Terrain (area), and Status (entity). Define one active global weather at a time. Permit local terrain with overlap rules, entity caps, and priority. Do not apply blanket tag-pair reactions without authored rules. A controlled Rain move should enable a rain-centric build, whereas random stage rain should be an optional boost rather than a required dependency.

## Balance philosophy

Balance across multiple scenarios, not solely average DPS. Track burst, area clear, single-target, mobility, survival, crowd control, setup time, density scaling, readability, and CPU/event cost. Signature paths must be distinct rather than dominant. Ensure boss immunity rules don't invalidate entire status builds: allow partial application, alternate payoff, or explicit conversion.
