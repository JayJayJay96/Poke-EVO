# Evolution path design

## Branch specification
Each path records role, verb shift, target policy, range, preferred movement, best/worst encounter, strength, weakness, rank 1 transform, rank 2 engine, rank 3 payoff, retained base-move fantasy, compatible augment adapters, visual telegraph, event cap, and potential mutation hooks.

## Family rules — Hybrid B
- Two shared branches per learnable move is a **target**, not a requirement when a move cannot support them distinctly.
- Give selected moves (not every move) one species/family-exclusive route. The same move learned by another Grass Pokémon retains shared branches but doesn't inherit Bulbasaur's family signature.
- Species trait affects more than one eligible move via events/tags/affordances, never hardcoded move-name checks where avoidable.
- Form evolution Bulbasaur→Ivysaur→Venusaur is separate from move evolution. Preserve chosen augments, skill branch and rank on form transformation.
- Species signature routes can be picked early, grow in all three ranks, and have a useful general payoff; final-form form-specific bonuses unlock when the player actually evolves.
- One path per skill per run unless a deliberate rare respec system is added. Mutations can offer temporary or permanent branch adaptations only with explicit player consent.

## Leech Seed anchor example
**LS1 Parasitic Network:** Rank 1 seeded targets link and share bounded drain; Rank 2 seeds transfer on death; Rank 3 the network builds to a consuming collapse. Reward grouping and infections; weaker on isolated bosses.
**LS2 Living Garden:** Rank 1 place stationary drain plants; Rank 2 plants create slowing roots; Rank 3 clustered mature plants merge into an Ancient Bloom. Reward territory; weaker during constant relocation.
**LS3 Symbiotic Bloom (Bulbasaur family):** Rank 1 drain fills charge; Rank 2 discharge empowers eligible plant skills; Rank 3 Bloom payoff with Venusaur-specific Overgrowth Dominion upgrade. Reward aggressive sustain and resource cycling; close-range exposure and consumption windows.

## Branch contrast template
| Axis | Network | Garden | Symbiotic |
|---|---|---|---|
| Main verb | herd and connect | position and cultivate | drain and charge |
| Movement | kite to cluster | hold/reposition around plots | move into risky proximity |
| Horde | strong | strong | moderate |
| Boss | weaker unless adapted | moderate | strong with setup |
| Failure mode | sparse targets | displaced garden | interrupted charge/risky close play |

No branch should be a strictly superior replacement in every encounter.
