# Contribution-based Skill Mastery

## Purpose
Avoid attack-speed bias, no-op casts, overkill credit, full-health heal farming, untouchable target farming and supportive-skill starvation. Mastery belongs to a **skill owner** and is computed from qualified combat events, not every animation/cast.

## Event scoring
A provisional generalized formula: `credit = min(baseEventValue * quality * diminishingFactor, remainingRollingBudget)`. Quality scales with *effective* impact (damage that actually reduces HP, heals missing HP, blocks real incoming damage, control that changes a valid target's state). Never award more from overkill or repeated no-op refreshes. Normalize per move archetype using authored coefficients and per-10s budget; include source ownership, target IDs, origin IDs and anti-loop metadata.

## Example: Leech Seed
- New valid infection on uninfected target: 3 credit.
- First meaningful drain tick per target: 2.
- Subsequent effective drain tick: 1.
- Successful spread: 2 (origin-linked and capped).
- Meaningful defeat contribution: up to 3, credited once per skill lineage.
- Example hard ceiling: 35 mastery / 10 seconds = **210 per minute maximum**, NOT expected 100/min. Design average around 80–110/min for effective play; cap hit frequency should be measured.

## Roles
- Direct: effective damage, hits, defeat contribution; slow attacks get normalized higher credit per meaningful event.
- DoT/status: qualifying applications, effective ticks, capped utility assists; refresh is not a free application.
- Healing: actual HP restored, meaningful shields applied **and subsequently consumed**, low-HP saves under a cooldown; full HP casts not credited.
- Control: meaningful slow/root/stun of susceptible threats; suppress repeated same target/control spam.
- Summons: their attributable damage/control/mitigation, not summon creation, idle uptime or infinite child-spawn credit.

## Mastery gates (cumulative prototype)
1 = 100 opens slot #1; 2 = 300 opens #2; 3 = 600 opens #3; 4 = 900 enables evolution rank 1; 5 = 1400 enables rank 2; 6 = 2000 enables rank 3. Mastery XP continues independent of level XP. Verify late-run rank 3 reachability using simulation.

## Catch-up (test hypotheses, based on acquisition time)
0–5 min: 0 floor, x1.0; 5–10: 100 floor, x1.15; 10–20: 300 floor, x1.30; 20+: 600 floor, x1.50 until reaching reasonable peer rank. A floor may unlock **capacity** but does not mint earlier missed reward tickets. Revisit abrupt boundary jumps at 10/20 min; prefer continuous interpolation or bounded phase tiers if it feels unfair.

## Anti-farming
Per `(origin,target,effect)` application cooldown; target-specific rate caps; rolling source budgets; diminishing repetitive contribution on a durable harmless enemy; credit only non-invulnerable HP loss; bounded defensive heals, no intentional-damage exploits; credit splits for setups and finishers. Remove invalid credit sources with unit tests, not UI-only checks.
