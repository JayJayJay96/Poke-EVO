# Surf — shared move

**Base:** `[Water, Melee, Area]` · a 360° wave around you, stagger 25 px.
cooldown 3.5 s · 22 dmg · reach 110 px. Data: `src/data/moves.ts` `surf`.
**Learned by:** Squirtle line, Lapras.

## Generic Mutations
| Mutation | What changes | Cost |
|---|---|---|
| **Ride the Wave** `surf.rideTheWave` | Surf becomes a 250 px wall rolling 220 px in your **movement direction**, carrying light enemies with it; you get +30% move speed for 1 s. Standing still, it rolls the way you last moved (right at the start of a run). | It only hits in one direction. |
| **Backwash** `surf.backwash` | After the wave reaches its edge it rolls back in, hitting again for 30% and pulling light enemies 20 px toward you. | Cooldown ×1.3. |

## Bonds
| Line | Bond |
|---|---|
| Squirtle | **Last Wave** → [`../squirtle/README.md`](../squirtle/README.md) |
| Lapras | **Ferry Wave** `surf.ferryWave` → [`../lapras/README.md`](../lapras/README.md) |
