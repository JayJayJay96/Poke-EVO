# Behavioral augments — taxonomy and first pool

## Six families
- **Delivery**: Seeker, Orbital, Ambush — target selection, orbit, trap deployment.
- **Lifecycle**: Echo, Rebound, Inheritance — repeat, return, transfer unused potential.
- **Reaction**: Catalyst, Contagion, Resonance — consume status, propagate, build a repeat-hit payoff.
- **Conversion**: Sacrifice, Transfusion, Metamorphosis — cash out stored effects, exchange damage for sustain, change state after a trigger.
- **Positioning**: Momentum, Anchor, Pursuit — kiting, territory, punish enemies that flee.
- **Risk/Reward**: Overcharge, Last Stand, Volatility — delayed strength, low-HP mode, shorter life with expiration burst.

Six further **Targeting/Activation Policies** worth later prototyping: Executioner (low HP), Guardian (near-player threats), Opportunist (status targets), Retaliation (after taking damage), Predatory (elite/boss), Trailblazer (deploy behind movement). Treat targeting policies as a separate hook category when necessary.

## First 12 to prototype
Seeker, Ambush, Echo, Inheritance, Catalyst, Resonance, Sacrifice, Transfusion, Momentum, Anchor, Overcharge, Volatility. Postpone Orbital, Rebound, Contagion, Metamorphosis, Pursuit and Last Stand until validated. This list is proposed rather than immutable.

## Mandatory augment contract
- Name, family, semantic promise, encouraged player action.
- Supported element/form/effect tags (for theme); required affordances (for actual compatibility).
- Hooks: targeting, delivery, on_apply, on_tick, on_hit, on_kill, on_expire, on_weather_changed.
- Base form behavior, EACH evolution's interpretation, default incompatibilities.
- Scaling and costs, entity/proc/transfer limits, event propagation policy.
- Special pair/triple merges, mutation roles and VFX.
- Positive matchup / counterexample / player-facing tooltip.

## Essential augment adaptation examples: Leech Seed
| Augment | Base projectile infection | Parasitic Network | Living Garden | Symbiotic Bloom |
|---|---|---|---|---|
| Seeker | Prefer weakened/uninfected marked enemies | Prioritize unconnected targets | Place plants in paths of enemies | Target drained enemies to build charge |
| Ambush | Seed lands dormant as trap | Dormant infection node links on activation | Plant hides until approached | Charge traps from later drain |
| Echo | Delayed weaker second seed | Delayed second link pulse (not free spread) | Delayed root strike | Repeat lower-strength discharge |
| Inheritance | Transfer unused seed duration on death | Strengthen EXISTING transfer; never duplicate | Expired plant transfers energy to eligible plant | Transfer unused bloom charge within caps |
| Catalyst | Consume compatible status for burst | Consume poison to overload network | Plants consume poison for toxic pulse | Consume status to generate Bloom charge |
| Resonance | Repeated drain ticks build a burst meter | Repeated link ticks build collapse charge | Repeated root hits grow plants | Repeated charges strengthen next discharge |
| Sacrifice | Consume active seed for immediate burst | Collapse one network to burst | Harvest mature plants for damage | Spend Bloom charge for bigger release |
| Transfusion | Convert portion of damage to shielding/heal | Link drain adds bounded shielding | Plants generate small protective bark | Bloom spillover heals/shields |
| Momentum | Movement creates bonus seed on distance threshold | Moving increases link reach briefly | Spawn a seed along movement trail | Movement contributes capped charge |
| Anchor | Staying in a zone boosts drain | Hold position to intensify network | Territory grants protection/strong roots | Standing still improves controlled Bloom release |
| Overcharge | Delay casts for larger seed | Store pulses then release stronger collapse | Grow fewer but larger plants | Charge longer for stronger release |
| Volatility | Shorten seed duration; explosive expiry | Faster network collapse, shorter links | Short-lived explosive plants | Charge expires early as burst |

## Avoid overlap
If the evolution already spreads on death and Inheritance also does, modify transfer efficiency or remaining duration; never create parallel identical transfer triggers. Prefer one owner for each operation.

## Numerical upgrades
Damage, cooldown, projectile count, pierce, area, duration, basic speed belong to **Enhancements**. They may influence augment tuning but should not occupy behavioral augment slots in the recommended configuration.
