# Tackle — shared move

**Base:** `[Normal, Melee, Contact]` · a short body slam in front of you.
cooldown 0.8 s · 12 dmg · reach 55 px · arc 90°. Data: `src/data/moves.ts` `tackle`.
**Learned by:** Bulbasaur line.

## Generic Mutations
| Mutation | What changes | Cost |
|---|---|---|
| **Rollout** `tackle.rollout` | Each Tackle that hits adds a Rollout stack: +20% damage and +10% reach per stack (max 5). A Tackle that hits nothing resets the stacks. | Starts at −20% damage. |
| **Bowling** `tackle.bowling` | Tackle staggers 30 px, and an enemy knocked into another enemy deals 30% of the hit to it. | Cooldown ×1.2. |

## Bonds
| Line | Bond |
|---|---|
| Bulbasaur | **Bulb Bash** `tackle.bulbBash` → [`../bulbasaur/README.md`](../bulbasaur/README.md) |
