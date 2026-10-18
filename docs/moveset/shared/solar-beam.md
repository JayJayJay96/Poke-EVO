# Solar Beam — shared move

**Base:** `[Grass, Beam]` · Venusaur gathers light into a massive beam.
cooldown 4.5 s · 22 dmg/tick (0.2 s) · 380 px long · 26 px wide · 0.8 s. Data: `src/data/moves.ts` `solarBeam`.
**Learned by:** Venusaur only (Bulbasaur line, stage 2, kit rule 4).

## Generic Mutations
| Mutation | What changes | Cost |
|---|---|---|
| **Full Charge** `solarBeam.fullCharge` | Like the real move: 1 s charge (a telegraphed line), then the beam fires with width ×2 and +60% damage. | Cooldown ×1.25. |
| **Prism** `solarBeam.prism` | The beam splits at the first enemy into 3 thinner beams fanning 30° behind it, 40% damage each. | −15% damage on the main beam. |

## Bonds
| Line | Bond |
|---|---|
| Bulbasaur (Venusaur) | **Ingrain** `solarBeam.ingrain` → [`../bulbasaur/README.md`](../bulbasaur/README.md) |
