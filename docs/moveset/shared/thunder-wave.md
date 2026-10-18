# Thunder Wave — shared move

**Base:** `[Electric, Zone]` · a field on the nearest enemy that paralyses everything inside (0.6 s per tick).
cooldown 6 s · 1 dmg/tick (0.5 s) · radius 60 px · 2 s. Data: `src/data/moves.ts` `thunderWave`.
**Learned by:** Pikachu line.

## Generic Mutations
| Mutation | What changes | Cost |
|---|---|---|
| **Static Pulse** `thunderWave.pulse` | Instead of a field at the target, a ring expands from you (0 → 150 px) and paralyses everything it passes, once. | Paralysis 0.6 s → 0.4 s. |
| **Electric Terrain** `thunderWave.terrain` | The field lasts 5 s and your Electric moves deal +25% to enemies inside it. A damage zone instead of a lock. | No paralysis. |

## Bonds
| Line | Bond |
|---|---|
| Pikachu | **Conductor** `thunderWave.conductor` → [`../pikachu/README.md`](../pikachu/README.md) |
