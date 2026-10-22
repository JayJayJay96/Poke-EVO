# Electro Ball — shared move

**Base:** `[Electric, Projectile, Ball]` · a slow electric ball that rolls through 2 enemies.
cooldown 1.8 s · 16 dmg · speed 260 · pierce 2. Data: `src/data/moves.ts` `electroBall`.
**Learned by:** Pikachu line.

## Generic Mutations
| Mutation | What changes | Cost |
|---|---|---|
| **Ricochet** `electroBall.ricochet` | Instead of passing through, the ball bounces off each enemy it hits toward the next nearest one (max 2 bounces, inside the chain cap). | Pierce is gone; −20% damage. |
| **Plasma Orb** `electroBall.plasma` | The ball grows as it rolls (radius up to ×2.5) and deals up to +40% damage by the end of its path. | Speed −30%. |

## Bonds
| Line | Bond |
|---|---|
| Pikachu | **Velocity Ball** `electroBall.velocityBall` → [`../pikachu/README.md`](../pikachu/README.md) |
