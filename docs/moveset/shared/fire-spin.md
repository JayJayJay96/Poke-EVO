# Fire Spin — shared move

**Base:** `[Fire, Orbit]` · 2 flames circle you for 3.5 s.
cooldown 6 s · 8 dmg · orbit 70 px · hit every 0.5 s per enemy. Data: `src/data/moves.ts` `fireSpin`.
**Learned by:** Charmander line.

## Generic Mutations
| Mutation | What changes | Cost |
|---|---|---|
| **Vortex** `fireSpin.vortex` | At the end of the spin the flames collapse onto you, then blast outward: a 110 px burst for 1.6× damage, once. | Cooldown ×1.2. |
| **Flame Trail** `fireSpin.flameTrail` | Each flame drops a Scorch patch every 0.6 s along its path (shared Fire terrain, cap 6). | −30% damage. |

## Bonds
| Line | Bond |
|---|---|
| Charmander | **Tail Flame** `fireSpin.tailFlame` → [`../charmander/README.md`](../charmander/README.md) |
