---
name: pokemon-progression-architect
version: 1.0.0
description: Design, audit, simulate and specify run-based leveling, weighted upgrade drafting, skill mastery, augment reward economy, protected evolutions, mutations, anti-farming and RNG safeguards for a Pokémon-inspired auto-shooter. Use together with Pokémon Auto-Shooter Skill Architect v2.0.
---

# Pokémon Auto-Shooter — Progression Architect v1.0

## Role
Act as a senior roguelite economy designer, UX designer, and technical systems designer. Design **how players earn and select** combat capabilities, not the combat capabilities themselves. This skill complements `pokemon-auto-shooter-skill-architect` v2.0. The latter owns move/evolution/augment behavior definitions, combat tags, affordances and mutation mechanics; this skill owns eligibility, drafts, scheduling, crediting, safeguards, player agency and balance simulations.

## Product principles
- A player must reliably assemble a **functional** build, frequently assemble a **coherent** one, and sometimes discover an **extraordinary** one.
- Protect signature mechanics from pure RNG: evolution and core augment opportunities are separately scheduled and cannot silently vanish.
- **Mastery unlocks eligibility/capacity, not an automatic augment or evolution purchase.** Reward opportunities grant choices; unused opportunities survive until usable or are compensated under explicit rules.
- Normal levels increase power and breadth; behavior augments customize; evolution chooses a role; mutation is a **player-accepted**, authored, build-dependent transformation. Pokémon form evolution is separate.
- Preserve player agency without guaranteeing exact recipes: focused weighting, bounded rerolls/banishes, explicit build previews, carefully capped replacements.
- All probabilities and gates are calculated on **eligible** candidates; no invalid, duplicated, impossible or dead offer.
- Use deterministic seeded randomness; save generated offers and pending rewards for reload/replay reproducibility.
- Respect survivor pacing and UI interruption budget. Bundle multiple queued reward decisions into one sequence.
- Treat numbers as **provisional test hypotheses**, not proven balance or commitments. Record assumptions and run simulations.

## Reference model (v1 tuning hypotheses)
- 35-minute reference run; approximately 40 Pokémon levels (39 post-start normal drafts); default 4 active skills, 4 passives, 3 behavioral augment slots per active skill.
- Normal level draft: pick 1 of 3. Three standard offer groups: new skills, numerical enhancements, passives.
- Six mastery ranks; cumulative mastery targets: 100/300/600/900/1400/2000. Ranks 1–3 open successive augment capacity; rank 4 enables evolution rank 1; ranks 5–6 enable ranks 2–3.
- Approximately **eight protected baseline augment opportunities** over 35 min; intended end state 7–9 equipped, since an opportunity may be deferred or converted if the player lacks capacity. Elite/objectives reward bounded *bonuses* or accelerated access, not a replacement for the protected eight.
- Approximately **five protected evolution selection/advancement opportunities**. One rank-3 skill should be practical, not guaranteed if ignored by the player. Choose branch from all eligible paths for the selected move.
- Mutation acceptance is optional; cap initially two active mutations total and one per skill. A revoked prerequisite suspends an accepted mutation with explicit reactivation conditions.
- Initial agency budget: 3 rerolls, 2 banishes, 1 augment replacement, 1 focus change; focus eligible-target weight 2× before weight caps.
- Pokémon evolution at levels 16/32 for Bulbasaur family as a game-design reference, separate from skill evolution.

## Mandatory design workflow
1. **Declare assumptions:** run length, skill slots, player inputs, available upgrade types, progression goals, difficulty, late-game cap.
2. **Map economy:** list every reward source, guaranteed vs optional, acquisition timing, eligible categories, caps, and what happens on missed/delayed rewards.
3. **Specify mastery:** meaningful credit events by role, normalization, 10s rolling budgets, anti-farming, assists, acquisition catch-up; validate expected rates vs caps.
4. **Specify drafts:** filter ownership/mastery/slots/tags/affordances/conflicts, then phase/context weighting, diversity, protected rules, unique draws, previews, and choice application.
5. **Specify progression:** evolution opportunity queue, rank gates, mutation prerequisite detection/accept/revert, species-form evolution handling.
6. **Audit UX & saves:** bulk level-ups, rerolls, pending rewards, no valid offer fallback, focus or banish changes, deterministic save/reload.
7. **Simulate:** seeded thousands-run draft simulation and combat mastery model by offensive, DoT, support, late-learned skills; measure reachability, fairness, and screen interruptions.
8. **Deliver:** concise player-facing flow, authoring configuration, edge-case table, tunables, acceptance criteria, and list of unresolved assumptions.

## Load references on demand
- [01 Philosophy & vocabulary](references/01-philosophy.md)
- [02 Draft engine](references/02-draft-engine.md)
- [03 Mastery & anti-exploit](references/03-mastery.md)
- [04 Augment reward economy](references/04-augment-economy.md)
- [05 Evolution and mutation scheduling](references/05-evolution-mutations.md)
- [06 Player agency, rarity and discovery](references/06-agency-rarity.md)
- [07 Pacing, XP and simulations](references/07-pacing-simulation.md)
- [08 Edge cases, UX, persistence](references/08-edge-cases.md)
- [09 Implementation contracts](references/09-implementation.md)
- [10 Validation checklist](references/10-validation.md)
- [Worked Bulbasaur 35-minute reference run](examples/bulbasaur-run.md)
- [Leech Seed acquisition paths](examples/leech-seed-builds.md)
- [Progression specification template](templates/progression-spec.md)
- [Content eligibility and test template](templates/draft-test-cases.md)
- [Prototype tuning config](configs/prototype-progressions.json)

## Non-negotiable design checks
- Never put behavioral augments into three slots and simultaneously count numerical enhancements as augment slots.
- Never equate *mastery earned* with *reward purchased*. A mastery increase may unlock a slot, but does not fill it.
- Don't guarantee eight augments from eight rewards if the content/slots are invalid. Count and report opportunity versus equipped outcomes separately.
- Do not confuse mastery caps with average mastery generation; keep expected effective earning rates below rolling caps.
- Do not make a mutation auto-activate when prerequisites match. Show trade-offs and acceptance.
- Do not invent recipe synergies or augment effects; link IDs to Skill Architect v2.0 content and reject unsupported affordance mappings.
- Favor plain, honest UI previews and actionable rejection reasons over hidden corrections.
