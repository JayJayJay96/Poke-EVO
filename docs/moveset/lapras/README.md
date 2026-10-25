# Lapras — moveset tree (non-evolver)

**Status:** APPROVED (owner, D15–D21, 2026-10-18). Being built in P4f (see `PROJECT_STATUS.md` for what exists). Numbers *(provisional)*; once built, `src/data/mutations.ts` is the truth.
Rules: [`../README.md`](../README.md). IDs and hook names: [`../INDEX.md`](../INDEX.md). Generic Mutations: [`../shared/`](../shared/).
**Acquisition (D16):** every Mutation below comes only from map sites (`Pool = site`).

**Role:** early bulldozer. Lapras is the strongest Pokémon at minute 1: best HP (170) and damage (×1.4 since the 2026-10-23 balance pass; was ×1.2) of the starting forms. Speed follows the official stats (D20): 150, faster than Squirtle (142), a little slower than Charmander (153).
**The player's goal with Lapras (owner, 2026-10-18): level fast and safe.** Its kit is built to be strongest early and
mid game, and its ceiling at 15:00 must be **below the 3-stage lines' final forms**.

| Line | Wants to be… | Power curve |
|---|---|---|
| Squirtle / Charmander / Bulbasaur | patient | weak start → highest ceiling (2 evolutions) |
| Pikachu | balanced | medium start → medium ceiling (1 evolution) |
| **Lapras** | **fast and safe early** | **strongest start → lowest ceiling** (1 signature step at Lv 25, Bonds that ebb) |

## 1. What changes for a non-evolver (owner direction, 2026-10-18)
- **Signature evolves once, at Lv 25** (it currently tiers at Lv 10 and 25). Proposed path:
  **Ice Shard → Sheer Cold** (owner decision D18; Frost Breath is dropped). Sheer Cold is control (a freezing field), not raw damage, which
  matches "safe" and keeps the final firepower down.
- **No ability upgrade and no trait pick** (D13 already: no trait for Lapras). Shell Armor stays as it is.
- **No stat growth** (unchanged: one stage).
- Lv 25 is Lapras's one big moment. For Lapras it lands around **~7–8 min** (Lv 17 at 5 min, Lv 29 at 9 min in the P4d report),
  so the spike comes at mid game, exactly where Lapras wants to be strong.

## 2. Line mechanic: the Tide (approved, D18)
Every Lapras **Bond** has two values:
- **Flood**: before **Lv 30** (`tideLevel`, ≈ 9–10 min for Lapras). The full effect.
- **Ebb**: from Lv 30 on. A smaller effect.

Grey-box: a small wave icon on the HUD that turns from high tide to low tide at Lv 30.
This is the direct lever for "early–mid focused": Lapras's skill-changers are the best in the game early,
then deliberately fall behind the evolving lines' late Bonds. Lv 30 (not 25) so the signature spike and the ebb
don't land on the same moment.

## 3. Ability — Shell Armor (no tiers)
| Stage | Ability | Effect |
|---|---|---|
| Lapras (all run) | **Shell Armor** `shellArmor` | Take 15% less damage. *(unchanged)* |

The other lines' abilities grow (Shell Burst, Flare Up, Bloom, Discharge). Lapras's doesn't. That's part of the low ceiling.
Its safety is front-loaded instead: −15% from the first second, when the other starters are at their most fragile.

## 4. Hook map — what Lapras's Bonds can listen to
| Hook | Comes from | Used by |
|---|---|---|
| `levelUp` | the player levelled up | Body Slam — Surging Slam |
| `levelBelow` | player level below the Tide (Lv 30) | Ice Beam — Flash Freeze |
| `xpGem` | XP gems on the ground | Surf — Ferry Wave |
| `armorAbsorb` | damage Shell Armor prevented | Hydro Pump — Pressure Shell |

`levelUp` and `xpGem` are **naturally front-loaded**: levels come every few seconds early and slowly late, and gem
magnet upgrades make gem-pulling redundant late. The Tide stacks on top of that.

## 5. Signature tree — Ice Shard → (Lv 25) Sheer Cold
Pick one; it upgrades **once**, at Lv 25. Strong first tier, modest second step (the opposite of the 3-stage lines).

| Mutation | Ice Shard (Lv 1) | + Sheer Cold (Lv 25) | Cost |
|---|---|---|---|
| **A. Hail** `iceShard.hail` — can't miss | No travel: shards fall on the **2 nearest enemies within 200 px** after a 0.25 s shadow, 60% damage each | Each impact leaves a small freezing field (40% of the Sheer Cold field) | Range 320 → 200 px |
| **B. Frost Lance** `iceShard.frostLance` — lines | A heavy lance that **pierces every enemy** in a line and slows 30% | The line freezes into a 2 s freezing strip along the lance's path (4 small Sheer Cold patches: slow 50% and light damage, no stun) | Cooldown ×1.4 |
| **C. Song of the Sea** `iceShard.song` — safety | Every 4th cast is a **song wave** instead of a shard: a 160 px ring that puts light enemies to sleep for 1 s (stun fatigue applies; bosses and enemies ≥ 40 kg are immune). No damage | The song also leaves a calm-sea field (160 px, 3 s) that slows 30% | That 4th cast deals no damage (−25% signature damage) |

- **A** = reliable early damage while you learn the run; nothing escapes.
- **B** = clears corridors through the early crowds so you can collect XP safely.
- **C** = Lapras's iconic Sing: the safest way to level, at the cost of damage.

## 6. Learnset trees — 2 generic + 1 Bond per move
Lapras has 4 learnset moves. **Surf and Hydro Pump are shared with the Squirtle line**: Lapras gets the same generic
Mutations and **its own Bonds**. That's the shared-move system working as intended.

```
Body Slam ────┬─ Belly Flop       `bodySlam.bellyFlop`        hop, then a 360° slam
              ├─ Shockwave        `bodySlam.shockwave`        ground wave 150 px forward
              └─ ★ Surging Slam   `bodySlam.surge`            (Bond: levelUp)
Ice Beam ─────┬─ Ice Wall         `iceBeam.iceWall`           a wall enemies must walk around
              ├─ Aurora Beam      `iceBeam.aurora`            hit enemies deal −20% contact damage
              └─ ★ Flash Freeze   `iceBeam.flashFreeze`       (Bond: levelBelow)
Surf ─────────┬─ Ride the Wave    `surf.rideTheWave`          (shared with Squirtle)
              ├─ Backwash         `surf.backwash`             (shared with Squirtle)
              └─ ★ Ferry Wave     `surf.ferryWave`            (Bond: xpGem)
Hydro Pump ───┬─ Split Stream     `hydroPump.splitStream`     (shared with Squirtle)
              ├─ Pressure Build   `hydroPump.pressureBuild`   (shared with Squirtle)
              └─ ★ Pressure Shell `hydroPump.pressureShell`   (Bond: armorAbsorb)
```

### Bond details (Flood = before Lv 30 · Ebb = Lv 30+)
| Bond | Move | What changes — **Flood** | **Ebb** | Cost |
|---|---|---|---|---|
| **Surging Slam** `bodySlam.surge` | Body Slam | Each level-up empowers the next **3** Body Slams: 360°, paralysis 0.5 s (a new effect, fixed D29: bosses are immune and stun fatigue applies). | Next **1** Body Slam only. | −15% damage, Flood only (D54: no cost from Lv 30, when the benefit ebbs). |
| **Flash Freeze** `iceBeam.flashFreeze` | Ice Beam | Ice Beam **freezes** (stun 0.6 s, once per beam, stun fatigue applies) instead of slowing. Bosses are immune to the freeze, and the beam doesn't slow them either. | Back to slowing (60% instead of 50%), beam +20% wider. | −20% damage. |
| **Ferry Wave** `surf.ferryWave` | Surf | Lapras carries you: Surf pulls every XP gem in its radius ×1.5 to you and gives +30% move speed for 1.5 s. Level fast. | Pulls gems in its normal radius; no speed. | −20% damage, Flood only (D54: no cost from Lv 30, when the benefit ebbs). |
| **Pressure Shell** `hydroPump.pressureShell` | Hydro Pump | Damage Shell Armor prevents is stored (cap **60**); the next Hydro Pump adds it as bonus damage spread over its ticks. | Cap **30**. | Hydro Pump cooldown ×1.2. |

Balance notes:
- Every Lapras Bond is **strongest in the first ~10 minutes** by three effects: the Tide, natural decay (levels slow
  down, magnet upgrades), and caps that don't scale (Pressure Shell's 60).
- **Flash Freeze** is the strongest control effect in the game while it's in Flood (a stun beam). That's on purpose:
  "safe" early leveling. It ebbs at Lv 30, before the heavy waves.

## 7. Balance targets and risks
**Target (D19):** at 15 min Lapras ≈ Raichu (within ~10%), both below Charizard, Venusaur and Blastoise.
Today (P4d report, 4 seeds): Lapras **197 DPS / Lv 17** at 5 min (leads ✓), **462 / Lv 29** at 9 min (still leads ✗;
target "about level"), **732 / Lv 46** at 15 min (above Blastoise 523 and Pikachu 478 ✗).

The owner's target is that Lapras's final firepower is **below every 3-stage final form**. This design pushes that way:
1. Dropping the Lv 10 tier lowers 5–9 min damage a little, and the single Lv 25 step is control (Sheer Cold), not burst.
2. Bonds ebb at Lv 30.
3. No ability growth or trait.

**Risk: the level snowball.** Lapras levels fastest (Lv 46 at 15:00), and every 3rd level is an augment level, so
extra levels are extra late power that the Tide doesn't touch. If the next balance run still shows Lapras above
Blastoise at 15 min, a tuning knob to try (not a design change): **Lapras XP gain ×0.85 from Lv 30**, so "level fast"
stays true early but stops snowballing late. Re-run `npm run balance` after the Lv 10 tier is removed.

## 8. Example builds (pillar 4)
| Build | Picks | Plays like |
|---|---|---|
| **Ferry** (level fastest) | Frost Lance · Ferry Wave · Surging Slam · Belly Flop | Carve lines, vacuum gems, every level-up powers the next slams. |
| **Iceberg** (never get touched) | Song of the Sea · Flash Freeze · Ice Wall · Aurora Beam | Sleep, freeze and wall off the crowd; the safest early game in the roster. |
| **Bulldozer** (early damage) | Hail · Pressure Shell · Shockwave · Pressure Build | Walk through the crowd; the armour charges the cannon. |

## 9. Open points for the owner
**All resolved.** Point 4 (D21): the XP ×0.85 knob may be used only if damage/stat tuning alone can't meet D19.
1. ~~Which tier stays at Lv 25~~ **Resolved (D18):** Sheer Cold; Frost Breath dropped.
2. ~~Approve the Tide~~ **Resolved (D18):** approved.
3. ~~Shell Armor upgrade~~ **Resolved (D20):** stays un-upgraded.
4. Allow the optional **XP ×0.85 from Lv 30** tuning knob if Lapras still out-damages Blastoise at 15 min?
5. ~~Speed~~ **Resolved (D20):** every stage follows the official base Speed exactly; Lapras 135 → 150.
