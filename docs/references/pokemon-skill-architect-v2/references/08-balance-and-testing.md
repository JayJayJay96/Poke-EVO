# Balance, readability, validation

## Design quality rubric (0–5 each, 30 total)
1. Player agency: does movement, positioning, drafting, setup or timing change?
2. Mechanical distinctness: does it add a new verb, not only scale stats?
3. Readability: will a player recognize the trigger, build-up, payoff and cost?
4. Compatibility/reuse: can it work on meaningful multiple forms without bespoke hacks?
5. Balance/counterplay: does it preserve a meaningful weakness and alternate build opportunity?
6. Engineering feasibility: bounded entities/events, testable deterministic behavior?

Recommended gate: at least 24/30, with agency/distinctness/readability each >=4 for evolution or mutation proposals. These thresholds are design-team choices, not verified standards.

## Test scenarios
Dense horde, sparse ranged wave, hypermobile threats, elite/armored target, single boss, boss + adds, weather transition mid-cast, terrain overlap, player dash during cast, premature removal of plant, form evolution mid-run, all three augment slots filled, mutation selected/declined/reverted.

## Measurement
DPS + damage distribution, healing/survival, elite and boss TTK, area denial uptime, burst cycle time, average active projectile/summon/status count, trigger rate, event queue peak, frame time. Compare builds with equal XP, upgrades and scenario seeds. Run no-VFX deterministic simulator before full VFX profiling.

## Hard safety budgets
Max roots/plants/links/targets per skill; fixed lifespan; status transfer limit; event queue max per frame or simulation tick; source-specific proc budgets; max chain depth; spawn limits; minimum cooldowns; no duplicate trigger subscription; deduplicate death and expiry outcomes. If overflow occurs, log and apply declared prioritization rather than silently diverging.

## Example build identities (illustrative, not measured)
- Network: horde high, single boss low, moving high, station hold medium.
- Garden: horde high, boss medium, moving low, station hold high.
- Symbiotic Dominion: horde medium, boss high with setup, moving medium, risk high.

A mutation should redistribute rather than strictly add power: Wandering Blight trades stationary defense for mobile burst; Solar Seed Reactor trades mature-plant utility for Solar Beam damage.
