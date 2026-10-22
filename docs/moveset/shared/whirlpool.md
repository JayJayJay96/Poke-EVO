# Whirlpool — shared move

**Base:** `[Water, Zone]` · a vortex dropped on the nearest enemy: slow 60% + damage.
cooldown 5 s · 5 dmg/tick (0.5 s) · radius 55 px · 3 s. Data: `src/data/moves.ts` `whirlpool`.
**Learned by:** Squirtle line.

## Generic Mutations
| Mutation | What changes | Cost |
|---|---|---|
| **Maelstrom** `whirlpool.maelstrom` | The zone pulls light enemies toward its centre (30 px/s, §11.1). When it ends it **collapses**: a burst of 1.6× tick damage, +15% per enemy inside (max 10). | Cooldown ×1.4. |
| **Moat** `whirlpool.moat` | Whirlpool becomes a ring around you (inner 40 px safe, ring 40–90 px) that follows you; crossing it slows 70%. | −50% damage; it can't be placed on far targets any more. |

## Bonds
| Line | Bond |
|---|---|
| Squirtle | **Eye of the Storm** (Wartortle+) → [`../squirtle/README.md`](../squirtle/README.md) |
