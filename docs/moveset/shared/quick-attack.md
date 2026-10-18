# Quick Attack — shared move

**Base:** `[Normal, Melee, Contact]` · a very fast strike in front of you.
cooldown 0.6 s · 8 dmg · reach 60 px · arc 100°. Data: `src/data/moves.ts` `quickAttack`.
**Learned by:** Pikachu line.

## Generic Mutations
| Mutation | What changes | Cost |
|---|---|---|
| **Blink Strike** `quickAttack.blink` | Strikes the nearest enemy within 140 px instantly, leaving an afterimage line; you don't move. | −25% damage. |
| **Double Hit** `quickAttack.doubleHit` | Strikes twice: a second hit 0.15 s later at 60%. | Cooldown ×1.3. |

## Bonds
| Line | Bond |
|---|---|
| Pikachu | **Volt Tackle** `quickAttack.voltTackle` → [`../pikachu/README.md`](../pikachu/README.md) |
