# Hydro Pump — shared move

**Base:** `[Water, Beam]` · a heavy water beam, push 15 px/tick.
cooldown 4 s · 18 dmg/tick · 340 px long · 22 px wide · 0.8 s. Data: `src/data/moves.ts` `hydroPump`.
**Learned by:** Blastoise only (Squirtle line, stage 2), Lapras.

## Generic Mutations
| Mutation | What changes | Cost |
|---|---|---|
| **Split Stream** `hydroPump.splitStream` | Splits into two beams at ±30°, each 33% damage. | Less focus on one target: each beam deals only 33%. |
| **Pressure Build** `hydroPump.pressureBuild` | Damage per tick grows +12% each tick; duration +50%. A boss and elite killer. | Cooldown ×1.5; weak vs crowds. |

## Bonds
| Line | Bond |
|---|---|
| Squirtle (Blastoise) | **Rain Cannon** → [`../squirtle/README.md`](../squirtle/README.md) |
| Lapras | **Pressure Shell** `hydroPump.pressureShell` → [`../lapras/README.md`](../lapras/README.md) |
