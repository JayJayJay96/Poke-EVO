# Surf — shared move

**Base:** `[Water, Melee, Area]` · a 360° wave around you, stagger 25 px.
cooldown 3.5 s · 22 dmg · reach 110 px. Data: `src/data/moves.ts` `surf`.
**Learned by:** Squirtle line, Lapras.

## Generic Mutations
| Mutation | What changes | Cost |
|---|---|---|
| **Ride the Wave** `surf.rideTheWave` | Surf becomes a 250 px wall rolling in your **movement direction**, carrying light enemies with it; you get +30% move speed for 1 s. | It only hits in one direction. |
| **Backwash** `surf.backwash` | After the wave reaches its edge it rolls back in, hitting again for 50% and pulling enemies 20 px toward you. | Cooldown ×1.3. |

## Bonds
| Line | Bond |
|---|---|
| Squirtle | **Last Wave** → [`../squirtle/README.md`](../squirtle/README.md) |
| Lapras | **Ferry Wave** `surf.ferryWave` → [`../lapras/README.md`](../lapras/README.md) |
