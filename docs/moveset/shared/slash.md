# Slash — shared move

**Base (proposed):** `[Normal, Area, Slicing]` · an instant X-shaped cut **on** the nearest enemy within 220 px
(no travel time), 60 px across. Innate +25% crit chance.
cooldown 1.6 s · 18 dmg. Uses the zone-cast targeting with a single instant hit.
**Learned by:** Charmander line, **from Charmeleon** (stage 1), when it grows real claws.
Kit rules: form differs from Scratch (cut at the target vs swipe around you, rule 5). **Rule 2:** allowed as an exception,
gated to Charmeleon (owner decision D15, 2026-10-18).

## Generic Mutations
| Mutation | What changes | Cost |
|---|---|---|
| **Afterimage** `slash.afterimage` | The X stays on the ground for 0.6 s as a cutting mark; enemies walking into it are cut again for 50%. | Innate crit +25% → +15%. |
| **Flurry** `slash.flurry` | Instead of one X, three smaller single cuts on the 3 nearest enemies in range, 100% damage each. Crowd over single target. | Each cut hits only its own enemy: the X's area is gone. |

## Bonds
| Line | Bond |
|---|---|
| Charmander (Charmeleon+) | **Searing Slash** `slash.searingSlash` → [`../charmander/README.md`](../charmander/README.md) |
