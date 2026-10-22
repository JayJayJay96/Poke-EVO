# Implementation, safety, testing and content contract

## Content schema outline (pseudo-TypeScript)

```ts
type SpeciesDefinition = {
  id: string; baseStats: Record<string, number>;
  traitId: string; affinityIds?: string[];
  signatureEvolutionIds?: string[];
};

type SkillDefinition = {
  id: string; tags: string[]; baseBehaviors: BehaviorSpec[];
  augmentPool: string[]; evolutionIds: string[];
};

type AugmentDefinition = {
  id: string; category: 'geometry' | 'tempo' | 'effect';
  promise: string;
  defaultEffects: EffectSpec[];
  adapters: Record<string, EffectSpec[]>;
};

type EvolutionDefinition = {
  id: string; skillId: string; allowedSpecies?: string[];
  ranks: [EvolutionRank, EvolutionRank, EvolutionRank];
};

type EvolutionRank = {
  rank: 1 | 2 | 3;
  addBehaviors: BehaviorSpec[];
  removeBehaviorIds?: string[];
  modifiers?: ModifierSpec[];
};

type SynergyRule = {
  id: string; requirements: RequirementSpec[];
  trigger: CombatEventType;
  conditions: ConditionSpec[];
  effects: EffectSpec[];
  limits: { cooldownMs?: number; perCastCap?: number; perSecondCap?: number };
};

type SkillInstance = {
  ownerEntityId: number; skillId: string;
  augmentIds: string[]; evolutionId?: string; evolutionRank: 0 | 1 | 2 | 3;
};
```

Schemas above are guides; `BehaviorSpec`, `EffectSpec`, `ModifierSpec` and `RequirementSpec` must be explicitly implemented and validated by the game engine, not treated as magical interpreted behavior.

## Fixed update and resolution

1. Read authoritative time step and deterministic RNG state.
2. Snapshot applicable weather/terrain and static compiled stats.
3. Update movement, skills, projectiles, collision and scheduled effects.
4. Enqueue combat events with ownership and context.
5. Resolve event queue in stable priority, creation index order.
6. Enforce chain-depth, per-source trigger limit, frame budget and entity cap.
7. Apply final damage/healing/status with idempotency where needed.
8. Publish concise visual events separated from mechanics.
9. Record telemetry and replay/debug traces.

Don't update combat logic from asynchronous VFX callbacks. Avoid system dependence on render frame rate. Restrict recursive reactions by provenance and a whitelist rather than blindly permitting everything.

## Precedence and consistency

Base behaviors → evolution rank additions/replacements → augment semantic adapters → species/passive persistent modifiers → weather/terrain modifiers → runtime triggered rules. A weather-change event may prompt recompilation of weather-derived parameters, but existing status instances need an explicit snapshot-vs-dynamic rule. Prefer snapshot-at-application for simple damage coefficients and dynamic weather for growth rates only if well documented.

## Tests before content expansion

- **Validation:** every evolution references an existing skill; rank count exactly three; every compatible augment has adapter; no conflicting IDs; source IDs resolved.
- **Augment persistence:** base skill with any permitted three augments survives conversion to every branch; no silent loss.
- **Trigger control:** death spread can't self-loop; chain depth is capped; status events carry original source; no double rewards on same death.
- **Boss compatibility:** immune/resistant enemies have fallback conversions or alternate value; paths aren't invalidated.
- **Numeric sanity:** no negative cooldown, infinite lifespan, multiplication overflow, or zero-cost infinite charge loop.
- **Performance:** test 100, 300, 1000 enemies with maximum link/spawn/stacks; measure update time and event counts.
- **Determinism:** same seed/config produces same combat log independent of VFX.
- **Gameplay:** density-wave, single boss, fast ranged wave, low-mobility defense, high-mobility pursuit; measure time-to-kill, damage taken, healing, control, and kill distribution.
- **Clarity:** telegraphs, status markers and branch VFX remain intelligible under heavy enemy counts.

## First vertical slice

One Pokémon (Venusaur), three moves (Leech Seed, Razor Leaf, Solar Beam), six to eight augment promises, two shared branches per move, one signature branch (Leech Seed), ranks 1–3, two passives, two weather states, one named skill synergy, one generic terrain reaction. Start with smaller content if capacity is limited. Build a debug overlay showing event chain depth, current trait resource, active plants, link count, and why synergy rules did or did not fire.

## Content-authoring artifact checklist

For each skill save: identity, tags, base behavior, augment pool, complete adapter matrix, evolution paths with rank mechanics, explicit exclusive species, synergy rules, VFX/state communications, limits and testing profile. Do not mark a design as implementation-ready if any of those are absent.
