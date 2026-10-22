# Body Slam — shared move

**Base:** `[Normal, Melee, Contact]` · Lapras crushes what's in front: paralysis 0.25 s, stagger 15 px.
cooldown 1.4 s · 20 dmg · reach 70 px · arc 140°. Data: `src/data/moves.ts` `bodySlam`.
**Learned by:** Lapras.

## Generic Mutations
| Mutation | What changes | Cost |
|---|---|---|
| **Belly Flop** `bodySlam.bellyFlop` | A short hop, then a 360° slam on your own position (90 px) after 0.3 s. | Cooldown ×2. |
| **Shockwave** `bodySlam.shockwave` | The slam also sends a ground shockwave 150 px forward (40% damage, no paralysis). | −25% damage on the slam itself. |

## Bonds
| Line | Bond |
|---|---|
| Lapras | **Surging Slam** `bodySlam.surge` → [`../lapras/README.md`](../lapras/README.md) |
