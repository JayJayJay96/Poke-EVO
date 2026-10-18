# Petal Dance — shared move

**Base:** `[Grass, Orbit]` · 4 petals swirl around you for 3.5 s.
cooldown 5 s · 10 dmg · orbit 80 px · hit every 0.4 s per enemy. Data: `src/data/moves.ts` `petalDance`.
**Learned by:** Bulbasaur line.

## Generic Mutations
| Mutation | What changes | Cost |
|---|---|---|
| **Frenzy Dance** `petalDance.frenzy` | The petals spin 30% faster every second, and in the last second they fly outward as projectiles. | Like the real move's confusion, you move −15% while dancing. |
| **Pollen Ring** `petalDance.pollen` | Each petal hit heals you 1 HP (max 5 HP/s). A sustain orbit. | −25% damage. |

## Bonds
| Line | Bond |
|---|---|
| Bulbasaur (Ivysaur+) | **Petal Blizzard** `petalDance.petalBlizzard` → [`../bulbasaur/README.md`](../bulbasaur/README.md) |
