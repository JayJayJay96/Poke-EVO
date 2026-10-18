# Bulbasaur → Ivysaur → Venusaur — moveset tree

**Status:** PROPOSAL for owner review (2026-10-18). Not approved, not built. Numbers *(provisional)*.
Rules: [`../README.md`](../README.md). IDs: [`../INDEX.md`](../INDEX.md). Generic Mutations for each move: [`../shared/`](../shared/).

**Role:** sustain / zones / damage over time. Bulbasaur wants to **stay healthy and turn healing into power**.
That completes a triangle with the other starters:

| Line | Wants to be… | Its ability rewards |
|---|---|---|
| Squirtle | in the crowd | getting hit (Shell recharges faster, Shell Burst) |
| Charmander | at low HP | danger (Blaze, Flare Up) |
| **Bulbasaur** | **at full HP** | **healing it doesn't need** (the Bulb) |

## 1. Line mechanic: the Bulb (needs approval)
Today Leech heals 3% of all damage dealt. At full HP that healing is wasted, and late game Bulbasaur sits at full HP a lot.
The Bulb gives that wasted healing a job:
- **Any healing beyond max HP fills the Bulb** (Leech, Leech Seed, Oran Berries, Mutation heals). Capacity = **40% of max HP**
  (Ivysaur 60, Venusaur 88). Grey-box: a ring on the player's back that fills up, green → pink.
- The Bulb only starts filling at **Ivysaur** (stage 1). Bulbasaur's bulb is still a seed.
- Damage from a Bloom never heals you or fills the Bulb (no proc-from-proc, no loop).

## 2. Hook map — what Bulbasaur's Bonds can listen to
Each Bond uses a different hook (rule 9).

| Hook | Comes from | Used by |
|---|---|---|
| **Bulb fill** (gradient, Ivysaur+) | ability meter | Tackle — Bulb Bash |
| **At full HP** | player HP | Razor Leaf — Healthy Growth |
| **Leech strength** (move feeds the ability) | Seeded enemies alive | Leech Seed — Seed Network |
| **Hit taken** | contact damage | Poison Powder — Spore Sac |
| **Enemy asleep** + Leech | Sleep status | Sleep Powder — Sweet Dreams |
| **HP level** (below 50%) | player HP | Sludge — Sludge Bomb |
| **Bloom** (Ivysaur+) | ability event | Petal Dance — Petal Blizzard |
| **Standing still** (Venusaur) | player movement, stage 2 | Solar Beam — Ingrain |

"At full HP" and "HP below 50%" pull in opposite directions on purpose, so the line has a healthy build and a desperate build.

## 3. Ability tree — Leech

| Stage | Ability | Effect |
|---|---|---|
| Bulbasaur | **Leech** `leech` | Heal 3% of all damage dealt. *(unchanged)* |
| Ivysaur | **Leech — Bulb Bloom** `leech.bloom` | As Leech, and overheal fills the **Bulb** (§1). When it's full, it **Blooms**: a 140 px pollen burst dealing 1.5× the stored amount, slowing 30% for 2 s, then the Bulb empties. At most one Bloom per 3 s. |
| Venusaur | Trait pick (D13 options, each with a Bulb twist) | **Overgrow+** `overgrowPlus`: below 40% HP +70% damage, and dropping below 40% with the Bulb at least half full **empties it into you as healing** instead (an emergency heal; once per 20 s). · **Chlorophyll** `chlorophyll`: +15% move speed, −10% cooldown, and Bulb capacity −30% (more Blooms, each smaller). |

Why the Bulb: Leech scales with damage, so late game it overheals a lot. The Bulb turns that into a visible,
rhythmic burst, and it only pays when you're playing well (not getting hit).

**Balance vs the other abilities** (rough, from the P4d balance report's DPS range):

| | Mid game (~9 min, ~150 DPS) | Late game (~15 min, ~1000 DPS) |
|---|---|---|
| Leech healing | ~4.5 HP/s | ~30 HP/s |
| Bloom (only while at full HP) | Bulb 60 fills in ~13 s → 90 dmg AoE ≈ **7 DPS** | Bulb 88 fills in ~3 s → 132 dmg AoE ≈ **44 DPS** (the 3 s cap binds) |
| Compare | Shell Burst ≈ 2 DPS when swarmed; Flare Up ≈ 2 DPS (25 s cooldown) | Bloom ≈ 4% of total DPS |

Bloom is the strongest of the three evolved-ability bursts late, but it **only exists while you're at full HP**.
The moment Bulbasaur takes real damage, the healing goes back to HP and the Bloom stops.
⚠️ Risk to watch: Venusaur was the DPS outlier in P4d (nerfed since). Re-run `npm run balance` once this is built.

## 4. Signature tree — Vine Whip → Power Whip → Frenzy Plant
The signature is line-only, so all three are Bonds by nature. Pick one; **it evolves with you** (rule 10).
Each also has a **Bulb link** from Ivysaur on.

| Mutation | Vine Whip (Lv 1) | + Power Whip (Lv 10) | + Frenzy Plant (Lv 25) | Bulb link (Ivysaur+) | Cost |
|---|---|---|---|---|---|
| **A. Long Lash** `vineWhip.longLash` — spacing | Reach ×1.8 and arc 140° → 50°. The **tip** (outer 30% of the reach) always crits (×1.5) | The 360° sweep has a crit **ring** at the tip | Tip crits sprout a small root field (60% size) | Each Bloom cracks a free 360° tip sweep | Enemies close to you take −40% |
| **B. Thorn Garden** `vineWhip.thornGarden` — turrets | Each swing plants a **thorn sprout** at the target (max 4 alive, 5 s). Sprouts lash enemies within 50 px every 1 s for 30% | Sprouts lash 360° and slow 20% | Expiring sprouts become root fields | A Bloom makes every sprout lash at once for ×2 | Whip −30% damage |
| **C. Sap Lash** `vineWhip.sapLash` — sustain | Each enemy hit heals 1 HP (max 4 per swing), on top of Leech | Hit enemies are Seeded for 2 s (50% strength) | Standing in your own root field heals 2 HP/s | Sap heals fill the Bulb even when you're **not** at full HP (half rate) | −25% damage |

Budget check (rule 4, dummy ring): Long Lash ≈ 1.5× on tip hits, 0.6× up close, ~1.05× for a player who keeps
spacing. Thorn Garden: 0.7× whip + up to 4 sprouts at 0.3×/s, ~1.1× once the garden is up. Sap Lash: 0.75× damage,
paid back in healing.

- **A** = keep enemies exactly at whip length. Skill expression through spacing.
- **B** = plant a garden and fight inside it. The zone fantasy.
- **C** = the unkillable gardener: the only way to fill the Bulb while hurt.

## 5. Learnset trees — 2 generic + 1 Bond per move
One Mutation per move: generic *or* Bond. The generic ones are in `../shared/<move>.md`.

```
Tackle ───────┬─ Rollout          `tackle.rollout`            stacks while it keeps hitting
              ├─ Bowling          `tackle.bowling`            knocked enemies hit others
              └─ ★ Bulb Bash      `tackle.bulbBash`           (Bond: Bulb fill · Ivysaur+)
Razor Leaf ───┬─ Leaf Spiral      `razorLeaf.spiral`          360° spiral of leaves
              ├─ Embed            `razorLeaf.embed`           leaves stick, then rip out
              └─ ★ Healthy Growth `razorLeaf.healthyGrowth`   (Bond: at full HP)
Leech Seed ───┬─ Spreading Seed   `leechSeed.spread`          seed jumps on death (once)
              ├─ Seed Bomb        `leechSeed.seedBomb`        seeds a 50 px area
              └─ ★ Seed Network   `leechSeed.seedNetwork`     (Bond: feeds Leech)
Poison Powder ┬─ Drift Cloud      `poisonPowder.drift`        cloud follows enemies
              ├─ Toxic            `poisonPowder.toxic`        poison stacks ×5
              └─ ★ Spore Sac      `poisonPowder.sporeSac`     (Bond: hit taken)
Sleep Powder ─┬─ Drowsy Haze      `sleepPowder.drowsy`        big slowing cloud, delayed sleep
              ├─ Nightmare        `sleepPowder.nightmare`     sleepers take +25% damage
              └─ ★ Sweet Dreams   `sleepPowder.sweetDreams`   (Bond: enemy asleep + Leech)
Sludge ───────┬─ Sludge Pool      `sludge.pool`               leaves a toxic pool
              ├─ Acid             `sludge.acid`               +15% damage taken from all sources
              └─ ★ Sludge Bomb    `sludge.sludgeBomb`         (Bond: HP below 50%)
Petal Dance ──┬─ Frenzy Dance     `petalDance.frenzy`         spins faster, petals fly out
              ├─ Pollen Ring      `petalDance.pollen`         petal hits heal you
              └─ ★ Petal Blizzard `petalDance.petalBlizzard`  (Bond: Bloom · Ivysaur+)
Solar Beam ───┬─ Full Charge      `solarBeam.fullCharge`      1 s charge, huge beam
 (Venusaur)   ├─ Prism            `solarBeam.prism`           splits into 3 behind the target
              └─ ★ Ingrain        `solarBeam.ingrain`         (Bond: standing still · Venusaur)
```

### Bond details
| Bond | Move | Offered from | What changes | Cost |
|---|---|---|---|---|
| **Bulb Bash** `tackle.bulbBash` | Tackle | Ivysaur | Tackle hits with the bulb: up to +80% damage, scaling with how full the Bulb is. | −20% damage at an empty Bulb. |
| **Healthy Growth** `razorLeaf.healthyGrowth` | Razor Leaf | Bulbasaur | While you're at **full HP**: +1 leaf and the leaves pierce 1 enemy. | −20% damage when you're not at full HP. |
| **Seed Network** `leechSeed.seedNetwork` | Leech Seed | Bulbasaur | The move feeds the ability: every Seeded enemy alive adds +0.5% to Leech (max +3%, doubling it). | Seed damage −30%. |
| **Spore Sac** `poisonPowder.sporeSac` | Poison Powder | Bulbasaur | Each hit you take puffs a small Poison Powder cloud at your feet (half size, 1.5 s; at most once per 2 s). Touching Bulbasaur hurts. | Poison Powder's own cooldown ×1.3. |
| **Sweet Dreams** `sleepPowder.sweetDreams` | Sleep Powder | Bulbasaur | Damage you deal to **sleeping** enemies heals through Leech at ×3 (9%). Like Dream Eater. | Sleep duration −25%. |
| **Sludge Bomb** `sludge.sludgeBomb` | Sludge | Bulbasaur | Below 50% HP the glob becomes a Sludge Bomb: it bursts in a 50 px splash and poisons ×2. Pairs with Overgrow+. | −15% damage above 50% HP. |
| **Petal Blizzard** `petalDance.petalBlizzard` | Petal Dance | Ivysaur | Every Bloom also launches Petal Dance instantly with double petals for 2 s. Uses Petal Dance's stat augments, never another Mutation. | Petal Dance's own cooldown ×1.3. |
| **Ingrain** `solarBeam.ingrain` | Solar Beam | Venusaur | After 1 s standing still, Venusaur takes root: Solar Beam's cooldown runs 2× faster and you take −15% damage. | Moving: −20% damage. |

Balance notes:
- **Seed Network** is the only Bond that buffs the ability itself. It's capped at +3% so Leech never passes 6%
  (Lifesteal III on top would reach 12%; watch that in the balance run).
- **Healthy Growth** and **Sludge Bomb** want opposite HP states, so taking both is a trap. That's intentional.
- **Spore Sac** is Bulbasaur's only "hit taken" Bond. It punishes contact instead of rewarding it, which suits a
  line that would rather not be hit.

## 6. Example builds (pillar 4: same Pokémon, different play)
| Build | Picks | Plays like |
|---|---|---|
| **Garden Keeper** (zones) | Thorn Garden · Toxic · Drowsy Haze · Ingrain · *Chlorophyll* | Plant a garden, plant your feet, let the clouds and sprouts work. |
| **Full Bloom** (stay healthy) | Sap Lash · Healthy Growth · Seed Network · Petal Blizzard · Bulb Bash | Overheal constantly; Blooms every few seconds and each one launches petals. |
| **Whip Master** (spacing) | Long Lash · Rollout · Acid · Full Charge | Keep the crowd at whip-tip length; Acid makes the crits hurt more. |
| **Last Rose** (desperate) | Long Lash · Sludge Bomb · Spore Sac · Nightmare · *Overgrow+* | When hurt: bombs, spore clouds and an emergency Bulb heal. |

## 7. Open points for the owner
1. Approve the **Bulb** as the line mechanic and **Bulb Bloom** at Ivysaur?
2. Approve the trait twists (Overgrow+ emergency heal; Chlorophyll smaller Bulb)?
3. Bulbasaur **doesn't fill the Bulb before Ivysaur**. OK, or should the seed-stage bulb do something small?
