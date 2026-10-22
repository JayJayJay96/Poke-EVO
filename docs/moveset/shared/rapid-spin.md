# Rapid Spin — shared move

**Base:** `[Normal, Orbit, Contact]` · 3 shells orbit you for 2.5 s, stagger 15 px.
cooldown 4 s · 9 dmg · orbit 50 px. Data: `src/data/moves.ts` `rapidSpin`.
**Learned by:** Squirtle line.

## Generic Mutations
| Mutation | What changes | Cost |
|---|---|---|
| **Spiral Spin** `rapidSpin.spiralSpin` | The shells spiral outward from 30 px to 120 px over the duration, sweeping both the inner and the outer ring. | −10% damage. |
| **Deflector** `rapidSpin.deflector` | The shells destroy enemy projectiles they touch (ranged enemies arrive in P5); each one destroyed adds +0.3 s duration. **Not offered until P5** (D29): with no enemy projectiles in the game it would be all cost, so it isn't registered and sites never roll it. When it's built it needs a cap on the added duration. | −30% damage. Worth more once ranged enemies exist. |

## Bonds
| Line | Bond |
|---|---|
| Squirtle | **Shell Spin** → [`../squirtle/README.md`](../squirtle/README.md) |
