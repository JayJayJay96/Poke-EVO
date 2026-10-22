# Implementation-ready technical architecture

## Content and runtime separation
- Immutable definitions: Pokémon family, base skills, enhancements, augments, evolution ranks, mutations, passives, weather and reactions.
- Runtime per-skill instances: owner, chosen branch/rank, three augments, cooldown, charge, spawned effect IDs.
- Systems: targeting, behaviors, combat events, status, weather/terrain, modifier resolver, progression draft, trait system, visuals, telemetry.
- Provide typed registry of behavior IDs; data files refer to the registry. Complex signature abilities may have dedicated implementations.

```typescript
type SkillBuild = {
  skillId: string;
  ownerEntityId: number;
  masteryRank: number;
  enhancements: Record<string, number>;
  augments: string[]; // 0..3 unique, validated
  evolutionId?: string;
  evolutionRank: 0 | 1 | 2 | 3;
  mutationId?: string;
};

type BehaviorSpec = {
  id: string;
  type: string; // Must resolve in behavior registry
  parameters: Record<string, string | number | boolean>;
};

type RuntimeEvent = {
  id: number;
  tick: number;
  type: string;
  originId: number;
  parentEventId?: number;
  sourceEntityId: number;
  targetEntityId?: number;
  skillInstanceId: number;
  chainDepth: number;
  generated: boolean;
  payload: Record<string, unknown>;
};
```

## Deterministic resolution
1. Base skill snapshot.
2. Branch behaviors up to current rank; remove replaced base behaviors.
3. Current outputs and affordances.
4. Augment validation and conversion.
5. Explicit merges/replacements/conflict checks.
6. Accepted mutation replacement (if still eligible).
7. Static numeric enhancements, traits/passive parameter modifiers; weather snapshot where applicable.
8. Runtime event handling in stable priority/order with rules for events on weather changes.

Prefer stable ordered event queues over recursive calls. Events should be immutable records. Avoid data-defined arbitrary executable scripts. Status ownership must survive propagation. VFX subscribers visualize outcomes but never apply damage.

## Data validation (build-time)
- unique IDs/references, valid behavior registry keys and parameter types.
- proper branch ranks 1–3, no impossible prerequisite cycles.
- all sold/equippable augment-to-evolution pairs mapped or blocked BEFORE choice.
- mutation recipe valid, documented removal manifest, no net duplicated hooks.
- boss handling defined for pull/root/knockback.
- all per-tick/per-source/per-entity caps finite.
- all player-facing tooltips describe actual adapted behavior.

## Representative modular folder tree
```
content/{families,skills,augments,evolutions,mutations,synergies,passives,weather,terrain}/
engine/{events,behaviors,skills,status,resources,progression,weather,terrain,simulation}/
visuals/{vfx,telegraphs,animation-profiles}/
tests/{content-validation,combat,combinations,bosses,performance}/
```

## Release handoff
Provide config schema + working IDs, effect/event ownership, numeric placeholders, migration/versioning plan, VFX/UX requirements, unit/integration test cases and profiling thresholds. Annotate placeholders and unresolved player-system assumptions.
