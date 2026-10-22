# Composing 2–3 augments

## Composition contract
For EVERY effect modifier define: input, phase/hook, output, owner, whether generated events can re-trigger, trigger budget, conflict behavior. Composition is deterministic: never assume commutativity.

1. **Additive**: independent changes, e.g. Anchor boosts garden territory, Catalyst consumes poison.
2. **Merged**: an explicitly authored pair result (Echo + Volatility → secondary delayed explosion), replacing specified overlapping emissions.
3. **Replacement**: a mutation replaces normal expiration behavior with mobile explosive carrier effects.
4. **Conflict**: incompatible behavior/affordances or impossible readable effects; prevent draft/equipment, show reason.

## Priority
1. Snapshot base skill and chosen evolution rank.
2. Establish output forms and affordances.
3. Validate selected augments against the resulting forms.
4. Translate selected augment semantic promises into authored behaviors.
5. Apply specific pair/triple merge overrides; remove overridden hooks.
6. Apply mutation replacement manifest when selected and active.
7. Resolve numerical Enhancements, trait/passive parameters and temporary weather/terrain context.
8. On runtime events, resolve stage-based queue with deterministic priority and ownership.

## Example event sequence
Echo + Inheritance + Catalyst on a poisoned Leech Seed target death:
- Death event emitted once; source references original skill and origin cast.
- Inheritance checks remaining seed lifetime, transfers to one nearest eligible noninfected target, consumes old lifetime.
- Catalyst may consume a preexisting compatible poison stack on the CURRENT target and emit one bounded reaction.
- Echo schedules a lower-strength secondary pulse on the new target ONLY if its authored adapter permits generated targets; by default triggered children cannot repeat Inheritance/Catalyst.
- Each listener has a per-source internal cooldown and generated-event limit. No triggered effect calls itself recursively.

## Conflict guidelines
Conflict only if semantic meaning fails or the result becomes unreadable/unbounded. A previously owned augment cannot disappear silently after evolution; previews warn and offer free branch-specific swap/respec, or evolution is disabled until resolved. Distinguish *slot conflict* from *temporarily inactive due to unmet trigger*.

## Audit examples
- Multicast + plants: enforce total plant-cap budget, not extra unrestricted summons.
- Inheritance + spread-on-death evolution: enhance existing transfer, don't spawn two spread systems.
- Echo + Resonance: repeated echo hit can contribute at reduced value only if authored; avoid exponential stacks.
- Sacrifice + Volatility: decide which consumes plants first; consumed plant should not also expire explosively unless explicitly budgeted.
- Overcharge + Acceleration enhancement: cap reduction so cost of preparing a charge remains meaningful.
