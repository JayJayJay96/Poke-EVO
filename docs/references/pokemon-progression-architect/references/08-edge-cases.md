# Failure-state and UX contract

| Situation | Required behavior |
|---|---|
| 4 skills full | Remove new-skill offers, reweight categories; optional replacement via separate explicitly authorized system. |
| 3 augments on target | No fourth equip; offer another target or authorized replacement. |
| No unlocked augment slots | Queue pending ticket (up to cap), then explicit compensation; never lose silently. |
| Mastery rank acquired in multi-reward screen | Resolve in order, recalculate candidate eligibility before subsequent tickets. |
| Protected evolution ticket but no eligible skill | Retain it; no invalid selection. |
| Evolution chosen after augments | Validate authored augment conversions for the new branch, preview any conflict and disallow unless conversion/respec policy exists. |
| Species evolves mid-run | Preserve active skills, mastery, augments and chosen branches; update traits and eligible form-specific signatures. |
| Mutation enabling augment replaced | Preview suspension; accepted recipe suspends and normal behavior returns. |
| Weather condition disappears | Catalyst changes output without undoing mutation unless authored hard requirement. |
| Duplicate or max-rank cards | Remove from eligible offer pool. |
| Reroll protected draft | Preserve draft type and guarantee; reroll valid candidates only. |
| Banish essential last eligible offer | Reject banish or restrict pool; show reason. |
| Defeat/exit during draft | Persist unresolved reward state or clearly finalize run; no second random roll on reload. |
| No valid cards | Surface deterministic fallback compensation, never blank UI. |
| Skill obtained late | Catch-up mastery floor and bounded bonus; no retroactive augment rewards. |
| 4 rewards simultaneously | Single queued interface with sequential commit and live eligibility updates. |
| Exploit: repeated no-op hits/heals | Qualified effective contributions only, per-target and rolling limits. |

Prioritize screenshots/visual displays with legible gain/loss before player confirmation. Log why offers were filtered and which rule caused compensation; invaluable for tuning.
