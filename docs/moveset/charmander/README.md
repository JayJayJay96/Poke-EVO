# Charmander → Charmeleon → Charizard — moveset tree

**Status:** APPROVED (owner, D15–D21, 2026-10-18). Being built in P4f (see `PROJECT_STATUS.md` for what exists). Numbers *(provisional)*; once built, `src/data/mutations.ts` is the truth.
Rules: [`../README.md`](../README.md). IDs: [`../INDEX.md`](../INDEX.md). Generic Mutations for each move: [`../shared/`](../shared/).

**Role:** aggressive glass cannon. Charmander *flirts with danger*: low HP is where it's strongest, and its kit
should reward getting close to death and getting out again. (Squirtle stands in the crowd; Lapras ignores it.)

## 1. Hook map — what Charmander's Bonds can listen to
Each Bond uses a different hook (rule 9).

| Hook | Comes from | Used by |
|---|---|---|
| **Blaze is active** (HP below 30%/40%) | ability state | Scratch — Blaze Claws |
| **Missing HP** (gradient) | player HP | Fire Spin — Tail Flame |
| **Flare Up** (Charmeleon+) | ability event | Dragon Rage — Cornered Dragon |
| **Moving** (Charizard flies) | player movement, stage 2 | Air Slash — Aerial Ace |
| **Kills** | enemy faints | Hurricane — Inferno Storm |
| **Standing in your own smoke** | player position | Smokescreen — Hidden Flame |
| **Enemy is Burning** | Fire status on the target | Slash — Searing Slash |
| **Your Scorch patches** | shared Fire terrain you made | Wing Attack — Fan the Flames |

Blaze state and missing HP are related but play differently: one is a switch at the threshold, the other grows the
whole way down.

## 2. Ability tree — Blaze

| Stage | Ability | Effect |
|---|---|---|
| Charmander | **Blaze** `blaze` | Below 30% HP: +50% damage. *(unchanged, owner-playtested)* |
| Charmeleon | **Blaze — Flare Up** `blaze.flareUp` | As Blaze, and **a hit that leaves you below 30% HP erupts a Flare Up**: a 140 px fire nova for 3× your signature's hit damage, Burns everything hit, and gives you **1 s invulnerability**. At most once per 25 s. |
| Charizard | Trait pick (D11 options, each with a Flare Up twist) | **Blaze+** `blazePlus`: below 40% HP +70% damage, and Flare Up recharges in **15 s**. · **Solar Power** `solarPower`: Fire moves +30%, lose 1 HP/s (never below 1), and Flare Up's nova is +50% wider and leaves a ring of Scorch. |

Why Flare Up: today Blaze is pure risk. Dropping to 30% just means "one more hit and you're dead". Flare Up is a
**panic button that turns the dangerous moment into a highlight**. It clears space and buys 1 s to get out, and
from then on you're in the Blaze zone, where the Bonds below pay out.

**Balance vs Shell:**

| | Shell (Squirtle) | Blaze (Charmander) |
|---|---|---|
| Base | blocks ~17% of hits when swarmed | +50% damage below 30% HP |
| Evolved tier | Shell Burst every ~9 s swarmed, ≈ 17 dmg, stagger | Flare Up at most every 25 s, ≈ 45 dmg (3 × ~15 Flame Burst hit) + 1 s invulnerability |
| What it rewards | staying in the crowd | dropping low on purpose and surviving it |

Flare Up hits harder than Shell Burst but fires far less often, and only when you're already in danger.

## 3. Signature tree — Ember → Flame Burst → Blast Burn
The signature is line-only, so all three are Bonds by nature. Pick one; **it evolves with you** (rule 10).
Every signature Mutation also has a **Blaze link**: a bonus while Blaze is active.
The existing exclusives (Blaze Core `blazeCore`, Mega Flare `megaFlare`) stay as stat exclusives and combine with any of these.

| Mutation | Ember (Lv 1) | + Flame Burst (Lv 10) | + Blast Burn (Lv 25) | Blaze link | Cost |
|---|---|---|---|---|---|
| **A. Kindle** `ember.kindle` — rhythm burst | Every 3rd shot is **Kindled**: ×2.2 damage, bigger fireball | The Kindled explosion leaves a Scorch ring | The Kindled shot becomes a **meteor**: a 0.6 s telegraphed circle, then it lands with a ×1.5-size crater | Every **2nd** shot is Kindled | The other shots −40% damage |
| **B. Flamethrower** `ember.flamethrower` — close range | Ember becomes a short stream: 4 small flames in a cone, ~130 px reach, 30% damage each | The flames Burn (20%/s for 3 s) | The end of the cone leaves a line of Scorch | Cone +30% longer | Range −60%: you have to be close |
| **C. Will-o-Wisp** `ember.wisp` — defensive ammo | Ember stops firing on its own. Each cast adds a wisp orbiting you (max 3). A wisp launches at any enemy that comes within 110 px, +30% damage | Launched wisps burst like Flame Burst (splash) | Launched wisps leave a small crater | Max 5 wisps | Nothing beyond 110 px gets shot |

Budget check (rule 4, dummy): Kindle (0.6 + 0.6 + 2.2) / 3 ≈ 1.13×. Flamethrower: about 2–3 of the 4 flames hit one
target, 0.6–0.9×. Will-o-Wisp: same shots per second, +30% each, but only at short range.

- **A** = big satisfying hits on a beat; with Blaze it becomes every other shot.
- **B** = commit to close range, the real glass-cannon fantasy.
- **C** = a ring of ammo that punishes anything that gets close. Charmander's one safety tool, with less range.

## 4. Learnset trees — 2 generic + 1 Bond per move
One Mutation per move: generic *or* Bond. The generic ones are in `../shared/<move>.md`.

```
Scratch ──────┬─ Fury Swipes      `scratch.furySwipes`        stacks damage on one target
              ├─ Crescent         `scratch.crescent`          200° arc + a slash wave
              └─ ★ Blaze Claws    `scratch.blazeClaws`        (Bond: Blaze active)
Fire Spin ────┬─ Vortex           `fireSpin.vortex`           collapses, then bursts out
              ├─ Flame Trail      `fireSpin.flameTrail`       flames leave Scorch
              └─ ★ Tail Flame     `fireSpin.tailFlame`        (Bond: missing HP)
Dragon Rage ──┬─ Fixed Rage       `dragonRage.fixedRage`      fixed damage, ignores types
              ├─ Dragon Breath    `dragonRage.dragonBreath`   short cone, paralysis chance
              └─ ★ Cornered Dragon `dragonRage.corneredDragon` (Bond: Flare Up · Charmeleon+)
Air Slash ────┬─ Crosscut         `airSlash.crosscut`         blades cross, the 2nd hit crits
 (Charizard)  ├─ Tailwind         `airSlash.tailwind`         hits give move speed
              └─ ★ Aerial Ace     `airSlash.aerialAce`        (Bond: moving · Charizard)
Hurricane ────┬─ Tornado          `hurricane.tornado`         the storm travels forward
 (Charizard)  ├─ Gale Wall        `hurricane.galeWall`        shoves the crowd outward
              └─ ★ Inferno Storm  `hurricane.infernoStorm`    (Bond: kills · Charizard)
Smokescreen ──┬─ Choking Smoke    `smokescreen.chokingSmoke`  the cloud also damages
 (NEW)        ├─ Smoke Trail      `smokescreen.smokeTrail`    smoke puffs behind you while kiting
              └─ ★ Hidden Flame   `smokescreen.hiddenFlame`   (Bond: standing in your smoke)
Slash ────────┬─ Afterimage       `slash.afterimage`          the X lingers and cuts again
 (NEW, Lv 10) ├─ Flurry           `slash.flurry`              3 cuts on 3 enemies
              └─ ★ Searing Slash  `slash.searingSlash`        (Bond: enemy Burning · Charmeleon+)
Wing Attack ──┬─ Updraft          `wingAttack.updraft`        lifts light enemies off the ground
 (NEW)        ├─ Backdraft        `wingAttack.backdraft`      rear gust guards your escape
              └─ ★ Fan the Flames `wingAttack.fanTheFlames`   (Bond: your Scorch · Charizard)
```
Smokescreen, Slash and Wing Attack are **new moves** (listed in `PROJECT.md` §6 but not built). Proposed base
stats are in their shared files. With them the learnset is 8 moves (template: 6–8).

### Bond details
| Bond | Move | Offered from | What changes | Cost |
|---|---|---|---|---|
| **Blaze Claws** `scratch.blazeClaws` | Scratch | Charmander | While Blaze is active, Scratch turns **Fire-type** (gets STAB, Burns 30%/s for 3 s) and reach +30%. | −15% damage while Blaze is off. |
| **Tail Flame** `fireSpin.tailFlame` | Fire Spin | Charmander | Like Charmander's tail: the flames grow as HP drops. +1 flame below 70% HP, +2 below 40%, and below 40% the flames Burn. | −25% damage. Weak at full HP. |
| **Cornered Dragon** `dragonRage.corneredDragon` | Dragon Rage | Charmeleon | Every Flare Up also fires Dragon Rage instantly in 4 directions (a cross) at full damage, and resets its cooldown. Uses Dragon Rage's stat augments, never another Mutation. | Dragon Rage's own cooldown ×1.3. |
| **Aerial Ace** `airSlash.aerialAce` | Air Slash | Charizard | Charizard flies: after 1 s of continuous movement the blades **home** and get +20% crit chance. | Standing still: −25% damage. |
| **Inferno Storm** `hurricane.infernoStorm` | Hurricane | Charizard | Each kill during the storm adds +0.25 s (max +1.5 s). After **30 kills** in one cast (kills by *any* of your moves while the storm is up) the storm turns **Fire-type** and Burns for the rest of that cast *(owner, 2026-10-18: kills come easily)*. | −15% damage. |
| **Hidden Flame** `smokescreen.hiddenFlame` | Smokescreen | Charmander | While you stand inside your own smoke, **Blaze counts as active** (whichever Blaze you have), so every Blaze-linked bonus turns on without the HP risk. | Cloud radius −40%, cooldown ×1.4: a small cloud you have to stand still in. |
| **Searing Slash** `slash.searingSlash` | Slash | Charmeleon | Slash always crits **Burning** enemies and consumes the Burn, dealing all its remaining burn damage at once. Pays off every other Fire source (Fire Spin, Flamethrower, Scorch). | −20% damage vs enemies that aren't Burning. |
| **Fan the Flames** `wingAttack.fanTheFlames` | Wing Attack | Charizard | Each of your Scorch patches the gusts touch **flares**: it refreshes to 3 s, grows +50% (capped at ×1.5 the normal Scorch size, so repeat flares don't stack), and drifts 40 px in the gust's direction. **Only offered if the build already makes Scorch** (Kindle, Flamethrower, Flame Trail or Solar Power). | −20% damage. |

Balance notes:
- Rule 4 (±15% vs Power Up I, condition true about half the time). E.g. Tail Flame: 2 flames ×0.75 = 1.5 at full HP,
  4 flames ×0.75 = 3.0 below 40% → ~2.25 on average vs 2.3 with Power Up I.
- Blaze Claws turning Scratch Fire-type makes Blaze+ / Solar Power apply to it. That's the intended pay-off,
  and it's still capped by Scratch's tiny reach.
- **Hidden Flame** is +50% damage only while you stand in a small cloud: ~4 s out of every ~11 s, if you stay put.
  It deliberately fights Aerial Ace (which wants you moving), so the two lead to different builds.
- **Fan the Flames** is the first Bond with a **prerequisite** (Hades-style): it only appears when the build can use it.
  A map site or card offering it must check this too (`INDEX.md` notes it).
- Charmander has no Bond on "hit taken". Getting hit is already Blaze's price, so paying for it twice would
  make the line too swingy.

## 5. Example builds (pillar 4: same Pokémon, different play)
| Build | Picks | Plays like |
|---|---|---|
| **Berserker** (live in the red) | Flamethrower · Blaze Claws · Tail Flame · Cornered Dragon · *Solar Power* | Drain to low HP, stay close, everything turns Fire and grows; Flare Up is the escape. |
| **Ace Pilot** (never stop moving) | Kindle · Tailwind · Aerial Ace · Tornado · *Blaze+* | Constant movement, homing blades, a storm cutting paths ahead; meteors on a beat. |
| **Dragon Tamer** (bulky targets) | Kindle · Fixed Rage · Fury Swipes · Crosscut | Elite and boss shredder: fixed damage ignores resistances, Fury Swipes stacks. |
| **Ember Guard** (safety first) | Will-o-Wisp · Vortex · Gale Wall · Smoke Trail | The rare "safe" Charmander: wisps, pushing winds and blinding smoke keep enemies off. Lower damage ceiling. |
| **Smoke & Mirrors** (fake the risk) | Kindle · Hidden Flame · Blaze Claws · Afterimage | Blaze power at full HP from inside the smoke; blinded enemies wander into lingering cuts. Has to stand still. |
| **Wildfire** (burn everything) | Flamethrower · Flame Trail · Searing Slash · Fan the Flames · *Solar Power* | Paint the floor with Scorch, fan it across the crowd, and Slash cashes in the burns. |

## 6. Open points for the owner
**All resolved (D21, 2026-10-18):** approved as written.
1. Approve **Flare Up** at Charmeleon and the trait twists (Blaze+ 15 s recharge; Solar Power wider nova + Scorch)?
2. Approve **Scorch** as shared Fire terrain?
3. **Fixed Rage** ignores all damage augments. OK as a deliberate trade, or too confusing?
4. **Will-o-Wisp** is a Fire move Charizard can learn in the games, used here as flavour for a Mutation, not a new move. OK?
5. ~~Kit-rule conflicts for the new moves~~ **Resolved (D15, 2026-10-18):** Slash allowed from Charmeleon; Smokescreen doesn't count. Original notes:
   - **Rule 2 (one basic Normal move):** Scratch + Smokescreen + Slash are all Normal. Recommendation: Smokescreen is a
     *status* move with no damage, so it doesn't count. **Slash** is a real second Normal attack. Options:
     (a) allow it as an exception, gated to Charmeleon so it reads as "real claws" *(recommended: Charmeleon learns Slash in the games)*,
     (b) drop Slash.
   - **Rule 4 (final stage unlocks 1–2 moves):** Wing Attack is learnable **from stage 0** so Charizard still unlocks only
     Air Slash and Hurricane. It gets STAB once Charizard is Flying.
   - **New status, Blinded** (Smokescreen): enemies wander and deal −30% contact damage; bosses immune. **Approved (D20).**
