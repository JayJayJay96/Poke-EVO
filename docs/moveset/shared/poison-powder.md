# Poison Powder — shared move

**Base:** `[Poison, Zone]` · a cloud on the nearest enemy that poisons everything inside.
cooldown 4.5 s · 3 dmg/tick (0.5 s) · radius 60 px · 3 s · poison 100% of the hit per second. Data: `src/data/moves.ts` `poisonPowder`.
**Learned by:** Bulbasaur line.

## Generic Mutations
| Mutation | What changes | Cost |
|---|---|---|
| **Drift Cloud** `poisonPowder.drift` | The cloud slowly follows the nearest enemy (30 px/s) instead of sitting still. | Radius −20%. |
| **Toxic** `poisonPowder.toxic` | Like the real Toxic: every tick inside adds a stack (max 5), each +20% poison damage. Enemies that stay in get wrecked. | Cloud duration −30%. |

## Bonds
| Line | Bond |
|---|---|
| Bulbasaur | **Spore Sac** `poisonPowder.sporeSac` → [`../bulbasaur/README.md`](../bulbasaur/README.md) |
