# Pacing, XP curve and simulations

## 35-minute reference targets, not guarantees
Approx character levels 1 at 0m, 8 at 5m, 14 at 10m, 19 at 15m, 25 at 20m, 30 at 25m, 35 at 30m, 40 at 35m. Pokémon form evolution Bulbasaur→Ivysaur L16 (~11m), Ivysaur→Venusaur L32 (~27m).

Illustrative next-level XP cost: `20 + 5L + 0.65L^2`. The encounter XP supply must be separately tuned to hit level targets. XP pick-up access and enemy counts matter more than curve alone. Do not claim this formula produces the target pace without enemy-income simulation.

Protected augment tickets near 3,6,9,13,17,21,26,31m; protected evolution tickets near 10,15,21,27,32m. Concurrent reward triggers share a single resolution queue UI. First visible behavioral change should arrive <=5m in most completed runs; recognizable archetype <=12–15m; one rank-3 evolution practical before boss.

## Sanity checks
For a skill earning average ~100 mastery/min, mastery 4 at 900 XP ≈9 minutes of effective combat; mastery 6 at 2000 XP ≈20 minutes. But 35/10s is **cap**, not expected 35 every window; mastery distributions by skill must be simulated. A skill learned at minute 17 gets an initial floor and catch-up; also test it can reach mastery 4 before final boss without over-rewarding.

## Required Monte Carlo tests (>=10,000 seeded simulated runs per archetype)
- Percentile times to first augment, mastery 4, first evolution and accepted mutation.
- Equipped augments at end: median, p10/p90; pending and compensated counts.
- Reachability of focused 2-augment named recipes given rerolls/banishes/focus, and natural discovery rate.
- Chance of rank 3 before 35m for focused vs unfocused play; number of high-rank evolved skills.
- Rates of invalid offer, no valid candidate, repeated offered card, unresolvable reward, category starvation (targets all zero).
- Number and spacing of pauses; time-in-menu per minute and clustered multi-reward flow.
- Gap between starter, slow single-target, heal/support, and late-acquired skill mastery.
- Rarity conditional distribution after filtering, not only input rarity weights.
- Seed/reload reproducibility, choice commit atomicity and queue ordering.

## Acceptance targets (initial)
Zero invalid/dead-end rewards; <=5m to first augment for most competent runs; target 7–9 equipped augments, typically 2–3 skills evolved; a focused 2-augment mutation build achievable often enough to invite intentional pursuit, but never automatically guaranteed. Set numeric probability targets only after initial simulations.
