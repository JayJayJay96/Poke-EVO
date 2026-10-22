# Acceptance checklist

## Design quality
- [ ] Every reward has a source, unlock time, eligibility filter, cap, compensation rule and UX representation.
- [ ] Three augment slots per skill are *behavioral*; numeric enhancements never consume them.
- [ ] Regular versus dedicated drafts clearly distinguished; Pokémon evolution separate from skill evolution.
- [ ] All locked evolution paths visible after proper eligibility, not hidden by random selection.
- [ ] Mutation only offered when recipe valid and user accepts, with trade-off preview.
- [ ] Player control exists but exact recipe is not guaranteed by focus.

## Correctness
- [ ] All offers valid at generation and commit; duplicates and overflow blocked.
- [ ] Mastery credit recognizes effective contribution, attribution and anti-farming.
- [ ] Mastery expected rate is independently measured below its cap.
- [ ] Late skills receive catch-up but no unearned past reward tickets.
- [ ] Pending tickets remain resolveable with explicit limit/compensation.
- [ ] Mutation suspension and reinstatement do not duplicate effects.
- [ ] Rerolls, banishes, rank caps and save/reload deterministic.
- [ ] Reward queue batches simultaneous choices and refreshes eligibility after each commit.

## Evaluation
- [ ] 10,000+ run simulations per player strategy and mastery archetype.
- [ ] Reports include median/p10/p90 of progression and build-completion probabilities.
- [ ] Compare actual augmented skills and high-rank evolution counts to 35-min targets.
- [ ] Track pause burden and inability to obtain target mutation recipe.
- [ ] Prototype variables remain marked as not playtest-validated.
