# Dragon Rage — shared move

**Base:** `[Dragon, Beam]` · beam toward the nearest enemy.
cooldown 3 s · 6 dmg/tick (0.2 s, 0.6 s → 3 ticks) · 260 px long · 14 px wide. Data: `src/data/moves.ts` `dragonRage`.
**Learned by:** Charmander line (off-type, iconic: kit rule 3).

## Generic Mutations
| Mutation | What changes | Cost |
|---|---|---|
| **Fixed Rage** `dragonRage.fixedRage` | Like the real move: every tick deals **fixed damage** (10, +1 per 4 player levels) that ignores the type chart and enemy resistances. Great vs bulky and resisting enemies. | **Ignores all damage augments** on this move (Power Up, Glass, Concentrated…) and the global damage boost. |
| **Dragon Breath** `dragonRage.dragonBreath` | The beam becomes a 60° cone, 140 px long. Each tick has a 10% chance to paralyse (stun 0.5 s; stun fatigue applies). | Range −45%. |

## Bonds
| Line | Bond |
|---|---|
| Charmander (Charmeleon+) | **Cornered Dragon** `dragonRage.corneredDragon` → [`../charmander/README.md`](../charmander/README.md) |
