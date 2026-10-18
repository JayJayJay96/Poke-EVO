# Flash Cannon — shared move

**Base:** `[Steel, Projectile]` · a fast steel shot that pierces 2 enemies.
cooldown 1.6 s · 26 dmg · speed 520. Data: `src/data/moves.ts` `flashCannon`.
**Learned by:** Blastoise only (Squirtle line, stage 2).

## Generic Mutations
| Mutation | What changes | Cost |
|---|---|---|
| **Shrapnel** `flashCannon.shrapnel` | At max range or its last pierce, the shot shatters into 6 steel shards in a ring (35% damage each). | Cooldown ×1.3 (projectile budget, §8.6). |
| **Railgun** `flashCannon.railgun` | Fires in your **movement direction** instead of auto-aiming; infinite pierce, +80% speed, +30% damage. | You have to aim with your feet. |

## Bonds
| Line | Bond |
|---|---|
| Squirtle (Blastoise) | **Armor Rounds** → [`../squirtle/README.md`](../squirtle/README.md) |
