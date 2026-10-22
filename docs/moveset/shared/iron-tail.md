# Iron Tail — shared move

**Base:** `[Steel, Melee, Contact]` · a heavy steel tail swing, stagger 15 px.
cooldown 2.2 s · 24 dmg · reach 80 px · arc 180°. Data: `src/data/moves.ts` `ironTail`.
**Learned by:** Pikachu line.

## Generic Mutations
| Mutation | What changes | Cost |
|---|---|---|
| **Iron Spin** `ironTail.spin` | A full 360° tail spin. | Reach −20%; −20% damage. |
| **Iron Slam** `ironTail.slam` | The tail slams the ground **at the target** (60 px circle) after a 0.3 s telegraph; everything hit is stunned 0.5 s (stun fatigue applies, bosses are immune). | Cooldown ×1.6. |

## Bonds
| Line | Bond |
|---|---|
| Pikachu | **Shock Shatter** `ironTail.shockShatter` → [`../pikachu/README.md`](../pikachu/README.md) |
