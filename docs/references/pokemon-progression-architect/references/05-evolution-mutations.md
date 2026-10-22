# Evolution and mutation rewards

## Skill evolution
A skill may evolve at mastery rank 4. Dedicated protected evolution tickets (~10,15,21,27,32 minutes) choose an eligible skill, then show **every eligible branch**. Subsequent tickets may increase same branch rank if mastery rank >=5/6, or evolve a different skill. Five tickets can produce rank allocations 3+2, 2+2+1, or 2+1+1+1; no automatic 3+3+3+3.

If no skill eligible when opportunity arrives, preserve pending ticket. Optional fallback: a bounded mastery booster **choice** to accelerate an eligible target, but never bypass rank/owner restrictions invisibly. The player chooses between breadth and specialization. On Pokémon form evolution, preserve chosen branch/augments; family signature behavior activates when proper form requirements are reached. A signature rank must have valid partial behavior before final form.

## Mutations
Skill Architect owns recipe, mutation behavior, replaced hooks, constraints. Progression owns checking recipe validity and offering optional activation. Trigger eligibility only after authored core + enabler conditions; weather generally catalyst/enhancer rather than hard gate. Unseen mutation recipe: hint in journal; discovered recipe: show exact requirements. Once prerequisite valid, queue a milestone opportunity; don't auto-activate. Accept/decline/defer with UX preview.

Initial caps: <=1 active mutation per skill, <=2 active mutations per run. If prerequisites removed, mark accepted mutation `suspended`, restore baseline behavior safely; resume when requirements return if rule permits. A mutation must not double-apply replaced behavior on suspension or reactivation. Save discovery and acceptance separately. Declining should not destroy an eligible skill or lock its base path.

## Evolution fairness
Protected means the reward **will be presented**, not that the player automatically ranks a skill up. If eligible move has waited two compatible opportunities, boost its presentation priority; show still-valid branch choices. Never guarantee a specific hidden mutation recipe or weather roll.
