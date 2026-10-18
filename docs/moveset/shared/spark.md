# Spark — shared move

**Base:** `[Electric, Orbit, Contact]` · 2 charged sparks circle you for 3 s and paralyse briefly (0.2 s).
cooldown 4.5 s · 8 dmg · orbit 55 px · hit every 0.4 s per enemy. Data: `src/data/moves.ts` `spark`.
**Learned by:** Pikachu line.

## Generic Mutations
| Mutation | What changes | Cost |
|---|---|---|
| **Arc Pair** `spark.arcPair` | The two sparks are joined by a crackling line through you; enemies the rotating line sweeps over are hit too. | −25% damage. |
| **Spark Shower** `spark.shower` | When the spin ends, the sparks burst into 6 small bolts flying outward (35% damage each). | Cooldown ×1.2 (projectile budget). |

## Bonds
| Line | Bond |
|---|---|
| Pikachu | **Static Spark** `spark.staticSpark` → [`../pikachu/README.md`](../pikachu/README.md) |
