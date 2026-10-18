# Air Slash — shared move

**Base:** `[Flying, Projectile, Slicing]` · twin fast blades of air.
cooldown 1.1 s · 16 dmg · 2 blades · speed 540. Data: `src/data/moves.ts` `airSlash`.
**Learned by:** Charizard only (Charmander line, stage 2).

## Generic Mutations
| Mutation | What changes | Cost |
|---|---|---|
| **Crosscut** `airSlash.crosscut` | The two blades fly in crossing arcs that meet at the target. An enemy at the crossing point is hit by both, and the second hit always crits. | −15% damage (off-centre enemies get grazed by one blade only). |
| **Tailwind** `airSlash.tailwind` | Each blade hit gives you +3% move speed for 2 s (max +15%). | −20% damage. |

## Bonds
| Line | Bond |
|---|---|
| Charmander (Charizard) | **Aerial Ace** `airSlash.aerialAce` → [`../charmander/README.md`](../charmander/README.md) |
