# Implementation contract

Systems: `PokemonXPSystem`, `SkillMasterySystem`, `RewardScheduler`, `DraftService`, `EvolutionOpportunityService`, `MutationOpportunityService`, `ProgressionSaveService`, `SeededRNG`, `EconomyTelemetry`.

Important domain shapes:

```ts
type TicketType = 'normal' | 'augment' | 'evolution' | 'mutation';
type RewardTicket = { id:string; type:TicketType; sourceId:string; awardedAtSec:number; order:number; status:'pending'|'presented'|'consumed'|'compensated' };
type Offer = { id:string; ticketId:string; definitionId:string; targetSkillId?:string; offerType:string; version:number; weight:number; preview:{before:string;after:string;costs:string[];synergies:string[]} };
type DraftSnapshot = { ticketId:string; type:TicketType; offers:Offer[]; rngState:string; createdAtSec:number; rerollNumber:number };
type SkillMastery = { ownerSkillInstanceId:string; xp:number; rank:0|1|2|3|4|5|6; rollingBudgetUsed:number; lastBudgetWindow:number };
type RunProgression = { seed:string; level:number; xp:number; tickets:RewardTicket[]; unresolvedDraft?:DraftSnapshot; focusSkillInstanceId?:string; rerolls:number; banishes:number; replacements:number; mutationStates:Record<string,'unknown'|'eligible'|'pending'|'accepted'|'suspended'|'declined'> };
```

Transactional commit:
1. Snapshot and validate run version and ticket identity.
2. Validate chosen offer against current state and content version.
3. Apply change exactly once; update mastery/evolution/mutation dependencies.
4. Mark ticket consumed, append economy telemetry log, advance reward queue.
5. Persist full snapshot and RNG state atomically.

Candidate generation must never rely on visual UI card filtering. Reason codes `SKILL_FULL`, `MASTERY_LOCKED`, `AUGMENT_CONFLICT`, `FORM_LOCKED`, `MAX_RANK`, `BANNED`, `MUTATION_PREREQ_MISSING` should be available in logs and optional UI previews.

Never allow two clients/UI clicks to consume same reward ticket. Content validation at boot must check every skill/mutation reference ID against Skill Architect content and flag missing active-form conversion rules.
