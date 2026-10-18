# Leech Seed — shared move

**Base:** `[Grass, Projectile]` · plants a seed that drains the enemy for 4 s and heals you half the drain.
cooldown 2.5 s · 4 dmg hit · seed 150% of the hit per second. Data: `src/data/moves.ts` `leechSeed`.
**Learned by:** Bulbasaur line.

## Generic Mutations
| Mutation | What changes | Cost |
|---|---|---|
| **Spreading Seed** `leechSeed.spread` | When a Seeded enemy faints, its seed jumps to the nearest enemy with the time left. A seed that already jumped can't jump again (no proc-from-proc). | Seed duration −25%. |
| **Seed Bomb** `leechSeed.seedBomb` | The seed bursts on impact and Seeds everyone within 50 px, each seed at 40% strength. | Cooldown ×1.3. |

## Bonds
| Line | Bond |
|---|---|
| Bulbasaur | **Seed Network** `leechSeed.seedNetwork` → [`../bulbasaur/README.md`](../bulbasaur/README.md) |
