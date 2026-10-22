# Ice Beam — shared move

**Base:** `[Ice, Beam]` · a freezing beam that slows 50%.
cooldown 2.8 s · 7 dmg/tick (0.2 s) · 280 px long · 12 px wide · 0.6 s. Data: `src/data/moves.ts` `iceBeam`.
**Learned by:** Lapras.

## Generic Mutations
| Mutation | What changes | Cost |
|---|---|---|
| **Ice Wall** `iceBeam.iceWall` | Where the beam ends, an ice wall (80 px wide) forms for 2 s. Enemies can't walk through it; they slide around it. Bosses smash through it (the wall breaks). At most 3 walls at once. | −30% damage. |
| **Aurora Beam** `iceBeam.aurora` | Enemies hit deal −20% contact damage for 3 s (like the real move lowering Attack). A safety beam. | −20% damage; slow 50% → 30%. |

## Bonds
| Line | Bond |
|---|---|
| Lapras | **Flash Freeze** `iceBeam.flashFreeze` → [`../lapras/README.md`](../lapras/README.md) |
