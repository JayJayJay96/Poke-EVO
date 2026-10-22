# Draft and reward test-case template

For each test supply seeded RNG, content roster, Pokémon form, game minute, character level, skill mastery, equipped augments, banned offers, focus skill, active mutations, pending tickets. Assert offers, fallback, accounting, and reproducibility.

Mandatory cases:
1. No free unlocked augment slot; ticket pending and later resolves.
2. All skills maxed and all passive slots full; normal draft has valid fallback.
3. Reroll protected evolution never turns into unrelated draft.
4. Banish of last valid essential offer denied.
5. Replacing mutation-enabling augment previews and suspends mutation exactly once.
6. Multi-level-up queues distinct tickets; after first choice re-evaluate second.
7. Reload during unresolved draft preserves offer IDs, weights and RNG state.
8. Solar Beam slow attacks reach mastery at comparable effective-play rate to Vine Whip.
9. Repeated status refresh on invulnerable boss grants no mastery.
10. Focused recipe is achievable but not automatically guaranteed.
11. Two simultaneous reward triggers settle in consistent order across machines.
12. Unsupported evolved-form augment conversion fails content validation.
