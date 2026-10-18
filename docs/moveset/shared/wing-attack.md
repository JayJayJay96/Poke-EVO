# Wing Attack — shared move (NEW, not in the code yet)

**Base (proposed):** `[Flying, Melee, Contact]` · both wings beat at once: two 100° gusts to your left and right
(relative to your movement), reach 75 px, stagger 20 px.
cooldown 1.4 s · 13 dmg.
**Learned by:** Charmander line, **from stage 0** (off-type but iconic for the line, kit rule 3). It only gets
STAB once Charizard becomes Flying, so it grows into the evolution. Learnable from stage 0 keeps Charizard's
stage-2 unlocks at 2 (Air Slash, Hurricane), within kit rule 4.

## Generic Mutations
| Mutation | What changes | Cost |
|---|---|---|
| **Updraft** `wingAttack.updraft` | The gusts lift light enemies (< 40 kg) into the air for 0.6 s: they can't move or attack, then land with a 10 px stagger. Stun fatigue applies. | −25% damage. |
| **Backdraft** `wingAttack.backdraft` | The wings beat **behind** you instead: one 160° rear arc with stagger 35. It guards your escape route while you kite. | Nothing in front of you gets hit. |

## Bonds
| Line | Bond |
|---|---|
| Charmander (Charizard) | **Fan the Flames** `wingAttack.fanTheFlames` → [`../charmander/README.md`](../charmander/README.md) |
