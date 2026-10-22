# Leech Seed vertical slice: implementation planning example

## Base
Fantasy: parasitic seeds infect targets and drain life. Proposed base: auto-target suitable nearby enemy, shoot seed, deal drain each second for 5 seconds, recover bounded health; cooldown 3s. Infection refreshes duration instead of unrestricted stacking. Seed cap per owner 8. Tags: element Grass; form Projectile; effects Infection/Drain/OnTick/OnExpire. Seed instance affordances: targetable, transferable, persistent, consumable, detonatable.

## Evolution routes
**Parasitic Network:** R1 links up to three infected nearby targets with 35% transferred drain per link; R2 transfers infection once on death to an eligible nearby enemy (remaining lifetime, capped); R3 at critical network size builds collapse charge, then consumes links for AoE burst. Movement objective: cluster enemies; weak on boss alone.

**Living Garden:** R1 seed can land as plant within controlled placement radius, maximum 3 active plants for ~6s; R2 mature plants extend slowing roots, with root-control immunity/reduction on bosses; R3 three nearby mature plants merge into Ancient Bloom, occupying corresponding capacity. Objective: lure into territory; weak when constantly displaced.

**Symbiotic Bloom (family-only):** R1 drain generates Bloom charge, with per-source gain limits; R2 spends charge to empower another eligible plant effect; R3 triggers bounded charge payoff and offers Venusaur-specific Overgrowth Dominion after form evolution. Objective: aggressive sustained attacks and resource management; risk = exposure and charge spending.

## Key augment conversions
Use `references/02-behavioral-augments.md` for full 12×4 matrix. In particular, Inheritance + Parasitic Network modifies its existing transfer instead of adding duplicate transfer; Volatility + Garden shortens plants and gives one bounded explosion at expiry; Momentum + Garden adds a plant to movement trail, respecting 3-plant cap.

## Representative 3-slot combinations
- Momentum + Sacrifice + Volatility with Garden → moving hit-and-run. May unlock Wandering Blight with explicit acceptance, trading fixed defenses for mobile carriers.
- Anchor + Echo + Catalyst with Garden → stationary poisonous bastion.
- Seeker + Inheritance + Catalyst with Network → target damaged/poisoned units; push infection forward. Avoid duplicate spread triggers.
- Resonance + Transfusion + Overcharge with Symbiotic → committed charge/sustain loop, risk of delayed release.

## Weather/passive examples
Rain speeds germination, Sun adds Bloom charge or solar pulse, Big Root improves drain recovery but has overheal caps. Random weather not a hard requirement. Poison Powder reacts with planted/draining targets only through authored synergy rules.

## Required test cases
1. Apply, refresh, expire, death transfer, no lingering status on dead enemy.
2. Boss solo: links cannot target nonexistent extra targets; drain useful but limited.
3. Garden max plants when Multicast/Momentum/Echo trigger simultaneously.
4. Sacrificed plant does not ALSO expire and explode unless authored.
5. Weather changes during plant lifespan: snapshot-vs-dynamic behavior explicitly determined.
6. Bulbasaur→Ivysaur→Venusaur: preserve ownership, ranks, augments and active charges.
7. Mutation offered and declined: exact original garden behavior persists.
8. 200+ enemy stress test: fixed event budgets, no recursive status explosions.
