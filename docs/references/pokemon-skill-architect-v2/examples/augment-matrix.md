# Augment semantics and conversion matrix

## Promise-first augments

| Augment | Promise | Base Leech Seed | Network | Living Garden | Venusaur Dominion |
|---|---|---|---|---|---|
| Projectiles | Reach more targets per cast | Extra seed projectile | More first-contact infection candidates, with same chain cap | More seed placements but global plant cap retained | Extra vine tendrils during empowered window |
| Cooldown | Improve action frequency | Cast seeds more often | Faster network reseeding or reconnection | Faster growth cycle (not unlimited summons) | Faster flower energy generation, with cap |
| Area | Control wider space | Wider targeting/spread | Longer links, within link cap | Larger plant radius | Wider bloom burst |
| Damage | Stronger direct payoff | More seed/drain damage | Stronger shared pulses | Stronger plant attacks | Stronger Bloom finisher |
| Pierce | Deliver effect past first collision | Seed penetrates targets, applies infection with per-cast cap | Infection delivery chains through first targets | Roots tunnel through multiple targets inside zone | Vines penetrate targets |
| Returning | Recycle or reclaim delivered effect | Seed returns toward caster | Some expired seeds seek previously linked targets | Expiring plant returns a seed, carrying partial resource refund | Reabsorbed spores restore Bloom Energy |
| Duration | Sustain established effects | Longer infection | Links persist longer after movement | Longer plant lifetime under a max active cap | Longer empowered state with lower peak rate if needed |
| Repeat | Add pulses / cadence | Seed pulses twice | Additional scheduled network pulse | Plants pulse periodically | Bloom sends secondary pulses |

**Rule:** Adapter translations must preserve the augment promise, not identical low-level physics. Explicitly preview the conversion to players. Balance branch-specific adapters individually.

## Augment pitfalls

1. **Double dip:** Projectiles must not spawn twice as many full-power plants and retain all base projectile damage if that dominates every other augment. Use shared caps, reduced coefficient, or split total power.
2. **Dead augment:** Returning with instant-hitscan no longer has natural meaning; define a returning resource/re-application effect or offer reselect/refund.
3. **Hidden trade-off:** If Area causes less damage per target, explicitly show it.
4. **Exploit multiplicative stacking:** Projectile count × Pierce × on-hit proc × poison detonation can create explosive event volume. Use per-cast proc caps and source-specific cooldowns.
5. **Three copies of same role:** Encourage meaningful combinations with trade-offs, not forced one-per-category quotas.

## A useful variation: augment expressions

A stat-sounding augment can evolve into a behavioral expression without creating a whole new evolution branch:
- Pierce + Network: infections jump along aligned connections, still capped.
- Returning + Garden: dying plants send seeds toward the caster, rewarding repositioning.
- Area + Dominion: the Bloom ring expands but has a slightly slower charge rhythm.

This yields expression without needing hundreds of bespoke “augmented evolution” definitions.

## UI preview requirement

Evolution choice should show:
- New role and signature mechanic.
- Current augments and their **after-evolution interpretations**.
- One likely synergy if equipped.
- One important weakness.
- An explicit warning and substitution for any incompatible effect (avoid this if possible).

Do not make the player discover that an invested augment silently stopped working.
