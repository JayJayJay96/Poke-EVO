# Sleep Powder — shared move

**Base:** `[Grass, Zone]` · a cloud on the nearest enemy that puts enemies to sleep (stun 0.8 s per tick).
cooldown 6 s · 1 dmg/tick (0.5 s) · radius 55 px · 2 s. Data: `src/data/moves.ts` `sleepPowder`.
**Learned by:** Bulbasaur line.

## Generic Mutations
| Mutation | What changes | Cost |
|---|---|---|
| **Drowsy Haze** `sleepPowder.drowsy` | A much bigger cloud (radius ×1.8) that slows 50%; enemies only fall asleep (0.8 s) after 1.5 s inside. Area control over instant lockdown. The sleep is a new effect (D21 guard rails, fixed D29): bosses are immune, and after waking an enemy can't be put back to sleep for 1.5 s (stun fatigue). | Sleep is delayed; duration unchanged. |
| **Nightmare** `sleepPowder.nightmare` | Sleeping enemies take +25% damage from everything. Set up, then punish. | Sleep 0.8 s → 0.6 s. |

## Bonds
| Line | Bond |
|---|---|
| Bulbasaur | **Sweet Dreams** `sleepPowder.sweetDreams` → [`../bulbasaur/README.md`](../bulbasaur/README.md) |
