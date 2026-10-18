# Sludge — shared move

**Base:** `[Poison, Projectile, Ball]` · a toxic glob that poisons (50% of the hit per second).
cooldown 1.3 s · 12 dmg · speed 330. Data: `src/data/moves.ts` `sludge`.
**Learned by:** Bulbasaur line.

## Generic Mutations
| Mutation | What changes | Cost |
|---|---|---|
| **Sludge Pool** `sludge.pool` | The glob leaves a 40 px toxic pool for 2.5 s that poisons anyone walking through (counts toward the zone budget). | Hit damage −30%. |
| **Acid** `sludge.acid` | Hit enemies take +15% damage from **every** source for 3 s (armour melts). | −25% damage. |

## Bonds
| Line | Bond |
|---|---|
| Bulbasaur | **Sludge Bomb** `sludge.sludgeBomb` → [`../bulbasaur/README.md`](../bulbasaur/README.md) |
