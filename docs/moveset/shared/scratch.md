# Scratch — shared move

**Base:** `[Normal, Melee, Contact]` · claw swipe toward the nearest enemy.
cooldown 0.9 s · 14 dmg · reach 60 px · arc 110°. Data: `src/data/moves.ts` `scratch`.
**Learned by:** Charmander line.

## Generic Mutations
| Mutation | What changes | Cost |
|---|---|---|
| **Fury Swipes** `scratch.furySwipes` | Each hit on the same enemy within 2 s stacks +8% damage on it (max 5 stacks). A single-target shredder. | Arc −40% (focused swipe). |
| **Crescent** `scratch.crescent` | Arc 110° → 200°, and each swing also throws a 70 px slash wave forward (40% damage) that reaches past the claw. | −55% damage; reach −20%; cooldown ×1.2. |

## Bonds
| Line | Bond |
|---|---|
| Charmander | **Blaze Claws** `scratch.blazeClaws` → [`../charmander/README.md`](../charmander/README.md) |
