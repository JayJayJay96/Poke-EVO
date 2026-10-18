# Water Gun — shared move

**Base:** `[Water, Beam]` · pressure stream toward the nearest enemy that pushes enemies along it.
cooldown 2.4 s · 6 dmg/tick · 240 px long · 0.6 s · push 10 px/tick. Data: `src/data/moves.ts` `waterGun`.
**Learned by:** Squirtle line.

## Generic Mutations (any Pokémon with Water Gun)
| Mutation | What changes | Cost |
|---|---|---|
| **Slick** `waterGun.slick` *(owner idea)* | The beam leaves a puddle line along its length for 3 s (counts toward the 6-puddle cap). Light enemies in it have a 15%/s chance to **slip** (stun 0.6 s; stun fatigue applies). | −30% damage per tick. |
| **Wash Down** `waterGun.washDown` | Hit enemies are Soaked and **take +20% damage from Water moves** for 3 s. A support beam. | −50% damage per tick; no push. |

## Bonds (line-only, see each line's folder)
| Line | Bond |
|---|---|
| Squirtle | **Steady Aim** → [`../squirtle/README.md`](../squirtle/README.md) |
