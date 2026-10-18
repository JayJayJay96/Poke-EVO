# Pikachu → Raichu — moveset tree

**Status:** PROPOSAL for owner review (2026-10-18). Not approved, not built. Numbers *(provisional)*.
Rules: [`../README.md`](../README.md). IDs and hook names: [`../INDEX.md`](../INDEX.md). Generic Mutations: [`../shared/`](../shared/).
**Acquisition (D16):** every Mutation below comes only from map sites (`Pool = site`); augment levels never offer them.

**Role:** speed / chain. Pikachu wants to **never stop running**. Its lightning jumps between enemies, and anything
that touches it gets paralysed.
2-stage gamble line: evolves once, at Lv 16 (Raichu), so it has **2 signature tiers** and **1 ability upgrade**.

| Line | Wants to be… | Its ability rewards |
|---|---|---|
| Squirtle | in the crowd | getting hit |
| Charmander | at low HP | danger |
| Bulbasaur | at full HP | spare healing |
| **Pikachu** | **always moving** | **distance run** (Charge) |

## 1. Line mechanic: Charge (needs approval)
Pikachu stores electricity in its cheeks.
- **Running fills Charge**: 1 Charge per 20 px moved (≈ 12 s of non-stop running at Pikachu speed fills 100).
  Each Static paralysis adds +15. Grey-box: two cheek dots that glow brighter as Charge fills.
- What full Charge does depends on the stage (§3). Standing still never drains it, but it doesn't fill either.
- **Chain cap stays 3 jumps** (D13, §11.1). No Mutation below pushes a chain past 3.

## 2. Hook map — what Pikachu's Bonds can listen to
Each Bond uses a different hook (rule 9). Hook IDs as in `INDEX.md`.

| Hook | Comes from | Used by |
|---|---|---|
| `chargeFull` | Charge reaches 100 | Quick Attack — Volt Tackle |
| `staticProc` | Static paralyses a toucher | Spark — Static Spark |
| `moveSpeed` | your current move speed | Electro Ball — Velocity Ball |
| `chainJump` | a signature chain jumps | Thunder Wave — Conductor |
| `targetParalysed` | the hit target is paralysed | Iron Tail — Shock Shatter |
| `discharge` | Raichu's Discharge fired | Thunder — Thunderstorm |

## 3. Ability tree — Static

| Stage | Ability | Effect |
|---|---|---|
| Pikachu | **Static** `static` | Enemies touching you are paralysed for 1 s *(unchanged)*. Running fills **Charge** (§1). At full Charge your next signature shot is **Charged**: ×2 damage, then Charge resets. |
| Raichu | **Static — Discharge** `static.discharge` | As Static, but full Charge releases a **Discharge** instead: a 150 px burst around you for 3× your signature hit, paralysing 0.4 s (stun fatigue applies). Charge resets. |
| Raichu trait | Trait pick (D13 options, each with a Charge twist) | **Static+** `staticPlus`: paralysis 2 s, and each Static paralysis gives +30 Charge (instead of +15). · **Lightning Rod** `lightningRod`: Electric moves +30%, and Discharge is +40% wider. |

Raichu gets its ability upgrade and its trait at the same moment (Lv 16), because the line has only one evolution.

**Balance vs the other evolved abilities:**

| | When | Burst | ≈ DPS from the ability |
|---|---|---|---|
| Shell Burst (Wartortle) | every ~9 s, only while swarmed | ≈ 17 | ~2 |
| Flare Up (Charmeleon) | at most every 25 s, only when dropping low | ≈ 45 + 1 s invulnerable | ~2 |
| Bloom (Ivysaur, mid game) | every ~13 s, only at full HP | ≈ 90 | ~7 |
| **Discharge (Raichu)** | every ~12 s, only while running | 3 × ~20 = **≈ 60** + paralysis | **~5** |

Discharge sits mid-pack. Its condition (keep moving) is easy in a survivor-like, so its numbers stay below Bloom's.
Pikachu's "Charged shot" before Lv 16 is deliberately tiny (~+0.75 DPS): the line's middle-gamble start is already medium.

## 4. Signature tree — Thunder Shock → Thunderbolt
The signature is line-only, so all three are Bonds by nature. Pick one; **it evolves at Raichu** (rule 10).
Each also has a **Charge link**.

| Mutation | Thunder Shock (Lv 1) | + Thunderbolt (Lv 16) | Charge link | Cost |
|---|---|---|---|---|
| **A. Live Wire** `thunderShock.liveWire` — lines of control | Every chain jump leaves a **live wire** between the two enemies for 1 s; enemies crossing a wire take 20% damage | Wires last 1.5 s and paralyse 0.2 s (stun fatigue applies) | Above 50% Charge, wires last twice as long | Chain jump damage −30% |
| **B. Ball Lightning** `thunderShock.ballLightning` — slow zapping orb | The bolt becomes a slow orb (200 px/s, 1.6 s) that zaps the nearest enemy within 90 px every 0.3 s for 25%. **No chain** | At the end of its path the orb pops into the full Thunderbolt chain | Orb speed and zap rate scale up with Charge (up to +50%) | No chain on Thunder Shock |
| **C. Return Arc** `thunderShock.returnArc` — Charge engine | The chain's last jump arcs **back to you**: +4 Charge per jump | The return arc damages everything along its line (50%) | Built in: the faster Charge fills, the more Discharges you get | −20% damage |

Budget check (rule 4, dummy ring): Live Wire 0.7× on jumps plus wire hits, ≈1.0×. Ball Lightning ≈5 zaps × 0.25 ≈ 1.25×
on one target with no chain, so less in crowds. Return Arc 0.8× plus ~+30% more Charge.

- **A** = draw a web of lightning across the crowd.
- **B** = a slow, deadly orb you aim with your path.
- **C** = feed the cheeks; Discharge every few seconds.

## 5. Learnset trees — 2 generic + 1 Bond per move
One Mutation per move: generic *or* Bond. The generic ones are in `../shared/<move>.md`.

```
Quick Attack ─┬─ Blink Strike     `quickAttack.blink`         instant strike up to 140 px away
              ├─ Double Hit       `quickAttack.doubleHit`     hits twice
              └─ ★ Volt Tackle    `quickAttack.voltTackle`    (Bond: chargeFull)
Spark ────────┬─ Arc Pair         `spark.arcPair`             a rotating line between the sparks
              ├─ Spark Shower     `spark.shower`              sparks burst into 6 bolts at the end
              └─ ★ Static Spark   `spark.staticSpark`         (Bond: staticProc)
Electro Ball ─┬─ Ricochet         `electroBall.ricochet`      bounces enemy to enemy (max 2)
              ├─ Plasma Orb       `electroBall.plasma`        grows as it rolls
              └─ ★ Velocity Ball  `electroBall.velocityBall`  (Bond: moveSpeed)
Thunder Wave ─┬─ Static Pulse     `thunderWave.pulse`         ring expanding from you
              ├─ Electric Terrain `thunderWave.terrain`       +25% Electric damage field
              └─ ★ Conductor      `thunderWave.conductor`     (Bond: chainJump)
Iron Tail ────┬─ Iron Spin        `ironTail.spin`             360° tail spin
              ├─ Iron Slam        `ironTail.slam`             telegraphed slam at the target, stun
              └─ ★ Shock Shatter  `ironTail.shockShatter`     (Bond: targetParalysed)
Thunder ──────┬─ Storm Call       `thunder.storm`             3 smaller strikes
 (Raichu)     ├─ Afterglow        `thunder.afterglow`         electrified ground after the strike
              └─ ★ Thunderstorm   `thunder.thunderstorm`      (Bond: discharge · Raichu)
```

### Bond details
| Bond | Move | Offered from | What changes | Cost |
|---|---|---|---|---|
| **Volt Tackle** `quickAttack.voltTackle` | Quick Attack | Pikachu | At full Charge, the next Quick Attack becomes **Volt Tackle**: a 120 px electric dash-strike for ×3 damage that spends the Charge. It replaces the Charged shot; on Raichu the Discharge fires at the end of the dash. | Recoil, like the real move: you lose 5% max HP. |
| **Static Spark** `spark.staticSpark` | Spark | Pikachu | Each Static paralysis adds an extra spark to your orbit for 2 s (max +3). Touching Pikachu gets more dangerous. | Spark's own cooldown ×1.2. |
| **Velocity Ball** `electroBall.velocityBall` | Electro Ball | Pikachu | Like the real move: damage scales with how much faster you are than the target, +1% per 1% faster (max +80%). Speed boosts become damage. | −40% base damage. |
| **Conductor** `thunderWave.conductor` | Thunder Wave | Pikachu | Your signature chain prefers enemies inside a Thunder Wave field, and jump range is +60% between them. The cap stays 3 jumps. | Thunder Wave's paralysis 0.6 s → 0.4 s. |
| **Shock Shatter** `ironTail.shockShatter` | Iron Tail | Pikachu | Hitting a **paralysed** enemy shatters the paralysis: ×1.8 damage, and the shock leaps to 1 enemy within 100 px. | −20% damage vs enemies that aren't paralysed. |
| **Thunderstorm** `thunder.thunderstorm` | Thunder | Raichu | Every Discharge also calls a Thunder strike on the toughest enemy in range. Uses Thunder's stat augments, never another Mutation. | Thunder's own cooldown ×1.3. |

Balance notes:
- **Velocity Ball:** Pikachu (165) vs Rattata (75) is ~2.2× faster → capped +80% → 0.6 × 1.8 ≈ 1.08×. Vs fast Pidgey it drops to ~0.8×.
- **Volt Tackle** is the line's only self-damage. Like Blaze, it pays HP for a big hit, but on a timer you control by running.
- **Conductor** respects the chain cap. It changes *where* the chain goes, not how far it goes.

## 6. Example builds (pillar 4: same Pokémon, different play)
| Build | Picks | Plays like |
|---|---|---|
| **Speedster** (run, run, run) | Return Arc · Volt Tackle · Velocity Ball · Blink Strike | Every full Charge is a Volt Tackle; walk-speed picks turn into Electro Ball damage. |
| **Lockdown** (paralyse everything) | Live Wire · Conductor · Shock Shatter · Static Pulse · *Static+* | Webs of wire, paralysis everywhere; Iron Tail shatters the locked ones. |
| **Storm Caller** (Raichu artillery) | Ball Lightning · Thunderstorm · Electric Terrain · Storm Call · *Lightning Rod* | Orbs and strikes rain on fields that boost Electric damage. |
| **Live Battery** (don't touch me) | Return Arc · Static Spark · Arc Pair · Iron Spin · *Static+* | Enemies that touch you fill the cheeks and grow the sparks. |

## 7. Open points for the owner
1. Approve **Charge** (running fills it) as Pikachu's line mechanic, the **Charged shot** at Pikachu stage and **Discharge** at Raichu?
2. Approve the trait twists (Static+ more Charge per paralysis; Lightning Rod wider Discharge)?
3. **Volt Tackle** recoil (5% max HP): OK, or no recoil?
