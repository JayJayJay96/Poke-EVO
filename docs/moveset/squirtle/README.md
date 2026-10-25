# Squirtle → Wartortle → Blastoise — moveset tree

**Status:** APPROVED (owner, D15–D21, 2026-10-18). Being built in P4f (see `PROJECT_STATUS.md` for what exists). Numbers *(provisional)*; once built, `src/data/mutations.ts` is the truth.
Rules: [`../README.md`](../README.md). IDs: [`../INDEX.md`](../INDEX.md). Generic Mutations for each move: [`../shared/`](../shared/).

**Role:** tank / control. Squirtle wants to stand *in* the crowd (Charmander flirts with danger, Lapras ignores it).

## 1. Hook map — what Squirtle's Bonds can listen to
Each Bond uses a different hook (rule 9), so the line has several builds, not one.

| Hook | Comes from | Used by |
|---|---|---|
| Shell **is ready** | ability state | Water Gun — Steady Aim |
| Shell **blocks** | ability event | Withdraw — Counter Shell |
| Shell **recharge** | ability timer | Rapid Spin — Shell Spin |
| **Hit taken** | contact damage | Flash Cannon — Armor Rounds |
| **Shell blocks** + **Shell Burst** (Wartortle+) | ability events | Whirlpool — Eye of the Storm (D51: blocks drop it, a Burst makes it pull) |
| **HP level** | player HP (pairs with Torrent+) | Surf — Last Wave |
| **Healing / Blastoise's cannons** | stage 2 (pairs with Rain Dish) | Hydro Pump — Rain Cannon |

## 2. Ability tree — Shell

| Stage | Ability | Effect |
|---|---|---|
| Squirtle | **Shell** `shell` | Blocks one hit, recharges in 8 s. **Every hit you take while Shell is down cuts the recharge by 1 s** *(owner idea)*. A block makes the shell *pop*: a 50 px ring that staggers enemies 20 px (no damage). |
| Wartortle | **Shell — Tidal Guard** `shell.tidalGuard` | As Shell, and **every 3rd block releases a Shell Burst**: a 120 px wave dealing 10% of your max HP as Water damage, stagger 25 px, Soaks everything hit. |
| Blastoise | Trait pick (D13 options, each with a Shell twist) | **Torrent+** `torrentPlus`: below 40% HP +70% damage, and Shell Burst fires every **2nd** block. · **Rain Dish** `rainDish`: regen 1.5 HP/s, and every block heals 3% of max HP. |

Shell Burst scales with **max HP**, so HP boosts and Leftovers turn into damage for this line only.

**Balance vs other abilities** (contact 8–16 dmg, 0.6 s invulnerability → swarmed ≈ 1.67 hits/s):

| Situation | Shell today | Shell proposed | Shell Armor (Lapras) | Blaze (Charmander) |
|---|---|---|---|---|
| Not touched | nothing | nothing | nothing | nothing |
| Swarmed | blocks ~1 in 13 hits (~7%) | recharge ≈ 3 s → ~1 in 6 hits (**~17%**) + a stagger ring each block | −15% always | +50% damage below 30% HP |
| Wartortle, swarmed | — | + a Shell Burst every ~9 s (≈ 17 dmg at 170 HP) | — | — |
| Blastoise + Torrent+ | — | Burst every ~6 s (≈ 25 dmg at 250 HP) | — | +70% below 40% HP |

Shell Burst is deliberately weaker than one Surf (22 dmg every 3.5 s). It buys space; it doesn't kill.

## 3. Signature tree — Bubble → Water Pulse → Hydro Cannon
The signature is line-only, so all three are Bonds by nature. Pick one; **it evolves with you** (rule 10).

| Mutation | Bubble (Lv 1) | + Water Pulse (Lv 10) | + Hydro Cannon (Lv 25) | Cost |
|---|---|---|---|---|
| **A. Bubble Trap** `bubble.trap` — single-target control | Engulfs the first light enemy and floats it 1.2 s (can't move or attack; stun fatigue applies; bosses and enemies ≥ 40 kg are only slowed 30%), then pops: 40 px splash for 80% damage, stagger 20 | The pop first **pulls** enemies within 60 px in by 15 px, then bursts outward | **Giant bubble** traps up to 3 enemies, pops as the full Hydro Cannon blast and leaves a puddle | Cooldown ×1.3; the trapped enemy takes no hit damage until the pop |
| **B. Froth Mines** `bubble.froth` — area denial | Each shot leaves 3 bubbles hovering on its path for 3 s; touching one pops it for 25% damage + slow | Mines pop with a small stagger ring | Mines drift toward the nearest enemy (40 px/s) | Main shot −30% damage; max 9 mines alive |
| **C. Undertow** `bubble.undertow` — gather for melee | Bubbles fly out, stop, then get sucked back to you, hitting on both legs | Hit enemies are **dragged back 25 px** with the bubble | The return trip Soaks and leaves a puddle trail | −35% damage, range −20%; can't take Return |

## 4. Learnset trees — 2 generic + 1 Bond per move
One Mutation per move: generic *or* Bond. The generic ones are in `../shared/<move>.md`.

```
Withdraw ──────┬─ Spiked Shell       (generic) 3 s contact-damage aura
               ├─ Hunker Down        (generic) −40% damage taken for 1.5 s after a cast
               └─ ★ Counter Shell    (Bond: Shell blocks)
Rapid Spin ────┬─ Spiral Spin        (generic) shells spiral out 30 → 120 px
               ├─ Deflector          (generic) shells eat enemy projectiles
               └─ ★ Shell Spin       (Bond: Shell recharge)
Water Gun ─────┬─ Slick              (generic) puddle line, light enemies slip
               ├─ Wash Down          (generic) +20% Water damage taken
               └─ ★ Steady Aim       (Bond: Shell is ready)
Whirlpool ─────┬─ Maelstrom          (generic) pulls in, collapses into a burst
               ├─ Moat               (generic) ring around you that follows you
               └─ ★ Eye of the Storm (Bond: Shell blocks · Wartortle+)
Surf ──────────┬─ Ride the Wave      (generic) a wall rolling the way you move
               ├─ Backwash           (generic) the wave rolls back in and pulls
               └─ ★ Last Wave        (Bond: HP level)
Hydro Pump ────┬─ Split Stream       (generic) two beams ±30°
 (Blastoise)   ├─ Pressure Build     (generic) damage ramps each tick
               └─ ★ Rain Cannon      (Bond: healing · Blastoise)
Flash Cannon ──┬─ Shrapnel           (generic) shatters into 6 shards
 (Blastoise)   ├─ Railgun            (generic) aims where you move, infinite pierce
               └─ ★ Armor Rounds     (Bond: hit taken · Blastoise)
```

### Bond details
| Bond | Move | Offered from | What changes | Cost |
|---|---|---|---|---|
| **Counter Shell** `withdraw.counterShell` | Withdraw | Squirtle | Withdraw's cooldown resets every time Shell blocks, and that bash staggers ×2. | −20% damage. Only good if you're getting hit. |
| **Shell Spin** `rapidSpin.shellSpin` | Rapid Spin | Squirtle | Each enemy the shells hit cuts Shell's recharge by 0.25 s (max 1.5 s per cast). | −20% damage. |
| **Steady Aim** `waterGun.steadyAim` | Water Gun | Squirtle | While Shell is **ready**: beam length +40%, push ×2. Rewards *not* getting hit. | While Shell is down: −25% damage. |
| **Eye of the Storm** `whirlpool.eyeOfTheStorm` | Whirlpool | Wartortle | **D51:** every Shell block drops a full-size Whirlpool at your feet for 2 s; a block that also releases a Shell Burst makes it pull (30 px/s, like Maelstrom). It uses Whirlpool's stat augments, never another Mutation. | Only fires when you get hit. (Was: a half-size pool on Shell Burst only, every 3rd block, with Whirlpool cooldown ×1.3.) |
| **Last Wave** `surf.lastWave` | Surf | Squirtle | Below 40% HP: Surf cooldown −50%, radius +30%. A tank's last stand (pairs with Torrent+). | Above 40% HP: −20% damage. |
| **Rain Cannon** `hydroPump.rainCannon` | Hydro Pump | Blastoise | Blastoise fires the pump straight up; it rains on a 130 px circle around you for the beam's duration. Each tick heals you 1 HP per enemy hit (max 10 HP/s, D51) and Soaks what it hits (D51: from rank I). Pairs with Rain Dish. | −90% damage (it hits the whole circle every tick), no push, only around you. |
| **Armor Rounds** `flashCannon.armorRounds` | Flash Cannon | Blastoise | If you took a hit since the last Flash Cannon, it also fires a second steel round at 60% damage. | Main shot −20% damage. |

Balance notes:
- Each Bond follows rule 4 (±15% DPS vs Power Up I, condition true about half the time).
  E.g. Armor Rounds: 0.8× when untouched, 0.8 + 0.6 = 1.4× when swarmed, ≈ 1.1× on average.
- Bonds and generics compete for the same slot, so a Bond is never a free extra on top of a generic.

## 5. Example builds (pillar 4: same Pokémon, different play)
| Build | Picks | Plays like |
|---|---|---|
| **Fortress** (get hit on purpose) | Undertow · Counter Shell · Shell Spin · Armor Rounds · Eye of the Storm · *Rain Dish* | Pull the crowd in; every block resets Withdraw and charges Shell Burst. A turtle in a blender. |
| **Sniper Turtle** (never get hit) | Froth Mines · Steady Aim · Moat · Railgun | Keep Shell up and stay untouched; long pushing beams from behind a moat. |
| **Last Stand** (low HP) | Bubble Trap · Last Wave · Pressure Build · *Torrent+* | Drop low on purpose; Surf spams, Shell Burst every 2nd block. |
| **Hydro-engineer** (generic only) | Froth Mines · Slick · Maelstrom · Backwash | The floor is the weapon. Proves the generic tree stands alone for future Water lines. |

## 6. Open points for the owner
**All resolved (D21, 2026-10-18):** approved as written.
1. Approve **Bond Mutations** (rules 7–10 in `../README.md`) on top of generic Mutations?
2. Approve the **Shell rework** and **Shell Burst** at Wartortle?
3. Approve **Puddles + Soaked** as shared Water terrain (not Squirtle-only)?
4. Do signature Mutations **evolve with the Pokémon**?
5. Build phase: it's a new system, so outside P4e as written. Proposal: a new step after P4e,
   starting with the proof slice (Water Gun + Withdraw: 1 generic + 1 Bond each).
