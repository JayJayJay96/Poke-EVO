# Draft engine specification

## Normal draft
Three offers, select one. Category phase weights (conditional on eligible items) are tuning hypotheses:

| Character level | New skill | Enhancement | Passive |
|---|---:|---:|---:|
| 2–10 | 45% | 35% | 20% |
| 11–22 | 20% | 50% | 30% |
| 23+ | 5% | 65% | 30% |

At full skills, remove new-skill category and renormalize. Enforce offer diversity where possible, unique definition/target pairs, max ranks, slot ownership, compatible tags and affordances, and run banishes.

## Specialized drafts
- Augment: choose a valid equipped-skill target with an open unlocked slot (or authorized replacement). Draw 3 compatible augment candidates. Preview current and eventual evolution-specific interpretation where authored.
- Evolution: select eligible move first, then show **all unlocked valid paths**; rank up chosen path with later protected rewards, not random branch rolls. Rank progression depends on mastery eligibility.
- Mutation: when authored recipe becomes valid, queue discovery opportunity, show gains, losses, replacement manifest and required components; accept, defer, decline. One per skill/two total initially.

## Candidate pipeline
1. `getDraftContext()` — normal/augment/evolution/mutation; roster; skill builds; mastery; weather if hard prerequisite; active and pending rewards.
2. `filterHardEligibility()` — owned? slot? mastery? rank? family? tags/affordances for current evolved form? explicit conflicts? cap? banish?
3. `getCategoryMix()` — gated category weights; reserve protected guarantee in the matching draft type.
4. `computeWeights()` — base rarity or card weight × capped focus × capped synergy relevance × progression protection; avoid overpowering multiplicative bonuses.
5. `sampleWithoutReplacement()` — unique offer identity `(type,skillId,definitionId,rank)`; validate constraints; graceful fewer-than-three or fallback if small pool.
6. `persistDraftSnapshot()` — save the exact offers and RNG state **before display**.
7. `commitSelection()` — atomic update, re-check eligibility, queue dependent reward reactions, preserve event ordering.

## Prototype weighting
Focus x2.0 on matching candidates, authored synergy relevance x1.25. Cap total contextual multiplier (e.g. 3×) until observed. One unselected duplicate cannot appear in same offer list; rerolls preserve draft type/protection and charge a reroll. A new card is never fabricated if no content is valid.

## Fairness
Ensure at least one offensive/developmental offer if player has unmet baseline offense within a defined early-run window; this should be a visible rule and must never exceed eligibility. Protected evolution choices are not lost when player selects another evolution. Never banish the sole valid candidate of a protected draft.
