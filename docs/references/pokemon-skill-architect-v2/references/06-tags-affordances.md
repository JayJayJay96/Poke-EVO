# Tags and mechanical affordances

**Element tags:** Grass, Poison, Fire, Water, Electric, Ice, etc. Express typing, resistance, weather interaction.
**Form/delivery tags:** Projectile, Beam, Zone, Summon, Melee, Orbit, Trap, Tether.
**Effect/event tags:** Drain, Heal, Infection, Poison, Growth, OnHit, OnDeath, OnExpire.
**Affordances:** targetable, redirectable, deployable, transferable, consumable, persistent, repeatable, chargeable, detonatable, linkable, orbitable.

Tags are semantic, affordances are mechanical. `Grass` doesn't imply `transferable`; a Leech Seed infection instance may be transferable while a ground plant is deployable and consumable. Evaluate against the CURRENT evolved form and generated subeffects.

```typescript
type TagSet = {
  elements: string[];
  forms: string[];
  effects: string[];
};
type Affordance = "targetable" | "redirectable" | "deployable" |
  "transferable" | "consumable" | "persistent" |
  "repeatable" | "chargeable" | "detonatable" |
  "linkable" | "orbitable";
type EffectBlueprint = {
  id: string;
  tags: TagSet;
  affordances: Affordance[];
};
```

Use explicit output references: an evolution can remove projectile delivery and add deployable plant effects. Augments bind to specific effect handles, never assume every component of a composite skill shares the same capabilities.

Compatibility outcomes: **adapt** (same promise, new output), **enhance** (combine with existing evolution behavior), **transform** (authored merge), **incompatible** (reject and explain). Tooltips must preview adapted effect before evolution selection.
