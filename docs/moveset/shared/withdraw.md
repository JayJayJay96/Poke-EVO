# Withdraw — shared move

**Base:** `[Water, Melee, Contact]` · 360° shell bash around you: stagger 20 px + stun 0.3 s.
cooldown 2.5 s · 10 dmg · reach 45 px. Data: `src/data/moves.ts` `withdraw`.
**Learned by:** Squirtle line.

## Generic Mutations
| Mutation | What changes | Cost |
|---|---|---|
| **Spiked Shell** `withdraw.spikedShell` | Withdraw becomes a 3 s aura: enemies touching you take its damage every 0.5 s and are staggered. | You move −20% while it's up; cooldown ×1.6. |
| **Hunker Down** `withdraw.hunkerDown` | For 1.5 s after each cast you take −40% damage. | You move −50% for those 1.5 s; −20% damage. |

## Bonds
| Line | Bond |
|---|---|
| Squirtle | **Counter Shell** → [`../squirtle/README.md`](../squirtle/README.md) |
