# Hurricane — shared move

**Base:** `[Flying, Orbit, Wind]` · a wide storm of 4 winds circles you for 3 s.
cooldown 5 s · 14 dmg · orbit 110 px · hit every 0.4 s per enemy. Data: `src/data/moves.ts` `hurricane`.
**Learned by:** Charizard only (Charmander line, stage 2).

## Generic Mutations
| Mutation | What changes | Cost |
|---|---|---|
| **Tornado** `hurricane.tornado` | The storm detaches and travels in your movement direction at 120 px/s for its duration, chewing a path through the crowd. Cast while standing still, it travels the way you last moved. | −20% damage; it no longer guards you. |
| **Gale Wall** `hurricane.galeWall` | The winds shove enemies outward (stagger 30 px). A ring that holds the crowd off. | −35% damage. |

## Bonds
| Line | Bond |
|---|---|
| Charmander (Charizard) | **Inferno Storm** `hurricane.infernoStorm` → [`../charmander/README.md`](../charmander/README.md) |
