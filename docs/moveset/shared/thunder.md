# Thunder — shared move

**Base:** `[Electric, Zone]` · Raichu calls down a lightning strike 0.5 s after the cast; paralyses 0.5 s.
cooldown 3.5 s · 30 dmg · radius 45 px. Data: `src/data/moves.ts` `thunder`.
**Learned by:** Raichu only (Pikachu line, stage 1, kit rule 4).

## Generic Mutations
| Mutation | What changes | Cost |
|---|---|---|
| **Storm Call** `thunder.storm` | Calls 3 smaller strikes (30 px) on 3 random enemies in range, 80% damage each. | Paralysis 0.5 s → 0.3 s. |
| **Afterglow** `thunder.afterglow` | The strike point stays electrified for 2 s: enemies walking in are paralysed 0.2 s per tick (stun fatigue applies, bosses are immune). | −20% strike damage. |

## Bonds
| Line | Bond |
|---|---|
| Pikachu (Raichu) | **Thunderstorm** `thunder.thunderstorm` → [`../pikachu/README.md`](../pikachu/README.md) |
