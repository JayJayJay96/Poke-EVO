# Razor Leaf — shared move

**Base:** `[Grass, Projectile, Slicing]` · two sharp leaves at the nearest enemy.
cooldown 1.0 s · 9 dmg · 2 leaves · speed 420. Data: `src/data/moves.ts` `razorLeaf`.
**Learned by:** Bulbasaur line.

## Generic Mutations
| Mutation | What changes | Cost |
|---|---|---|
| **Leaf Spiral** `razorLeaf.spiral` | The leaves fly out in a widening spiral around you instead of at one target: 360° coverage. | −20% damage. |
| **Embed** `razorLeaf.embed` | Leaves stick in the enemy for 1.5 s, then rip out for a second hit at 60%. | First hit −15%. |

## Bonds
| Line | Bond |
|---|---|
| Bulbasaur | **Healthy Growth** `razorLeaf.healthyGrowth` → [`../bulbasaur/README.md`](../bulbasaur/README.md) |
