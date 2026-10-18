# Smokescreen — shared move (NEW, not in the code yet)

**Base (proposed):** `[Normal, Zone]` · drops a smoke cloud on your position. No damage.
cooldown 8 s · radius 90 px · 4 s. Enemies inside are **Blinded** (approved, D20): they lose track of you and wander toward a random
point, and their contact damage is −30%. Bosses are immune.
**Learned by:** Charmander line (from stage 0). The one defensive tool a glass cannon gets.
Kit rule 2: a *status* move (no damage), so it doesn't count toward the one-Normal-attack rule (owner decision D15).

## Generic Mutations
| Mutation | What changes | Cost |
|---|---|---|
| **Choking Smoke** `smokescreen.chokingSmoke` | The cloud also deals 4 damage per 0.5 s tick to everyone inside. | Radius −30%. |
| **Smoke Trail** `smokescreen.smokeTrail` | Instead of one cloud, you leave 40 px smoke puffs behind you every 0.4 s for 4 s while moving. A kiting tool: chasers walk into blindness. | Each puff lasts only 1.5 s; cooldown ×1.2. |

## Bonds
| Line | Bond |
|---|---|
| Charmander | **Hidden Flame** `smokescreen.hiddenFlame` → [`../charmander/README.md`](../charmander/README.md) |
