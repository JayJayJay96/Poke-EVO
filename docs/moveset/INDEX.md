# Moveset registry — every Mutation and ability tier

**Status:** APPROVED (owner, D15–D21, 2026-10-18). Being built in P4f (see `PROJECT_STATUS.md` for what exists). Numbers *(provisional)*; once built, `src/data/mutations.ts` is the truth.
This is the lookup table other systems use (the map sites, D16). Rows are keyed by the stable **ID**
(rules: [`README.md`](README.md) → "Labels"). Display names may change; IDs don't.

Columns:
- **Kind:** `generic` (any line with the move) · `bond` (one line only) · `signature` (a line's signature, evolves with it) · `ability` (ability tier or final trait).
- **Line:** `any` for generic.
- **From:** the earliest stage it can be offered, as the stage index in that line (0 = first form). 3-stage lines: 1 = second, 2 = final. Pikachu: 1 = Raichu (final).
- **Hook:** what a Bond listens to, as a code identifier (`—` for generic). Vocabulary below.
- **Pool:** where it can be offered. `site` = **map site only** (D16).

## For the implementer (read this first)
**Acquisition rule (owner decision D16, 2026-10-18):**
- **Augment levels** (every 3rd level) offer **only** stat, trade-off and behaviour augments (`src/data/augments.ts`,
  `kind: 'stat' | 'tradeoff' | 'behaviour'`, including the existing signature exclusives Blaze Core / Mega Flare).
  **Never a Mutation.**
- **Map sites** (randomly generated; the player has to find them) roll one of: a **generic Mutation**, a **Bond Mutation**
  (signature Mutations count as Bonds), or an **item**. Every row in the Mutations table has `Pool = site`.

**Suggested data shape** (`src/data/mutations.ts`, one entry per row; names are the contract, the shape is a suggestion):
```ts
type MutationKind = 'generic' | 'bond' | 'signature';
interface MutationDef {
  id: MutationId;            // the ID column, e.g. 'waterGun.steadyAim'
  name: string;              // display only
  kind: MutationKind;
  move: MoveId;              // signature: the line's FIRST signature move ('bubble', 'ember', 'vineWhip', 'thunderShock', 'iceShard')
  line?: PokemonLineId;      // bond + signature only ('squirtle', 'charmander', 'bulbasaur', 'pikachu', 'lapras')
  fromStage: 0 | 1 | 2;      // From column
  hook?: HookId;             // Hook column
  requires?: RequirementId[];// e.g. ['scorchSource'] for wingAttack.fanTheFlames
  pool: 'site';
  tide?: { flood: object; ebb: object }; // Lapras Bonds: values before / from tideLevel (Lv 30); hook cell says (tide)
  // + every tuning number, so hook functions hold none (see README "Where the numbers live")
}
```
**Offer filter** for a site roll: the player owns `move` (for signature: has the line) · `line` matches (bond/signature) ·
current stage ≥ `fromStage` · every `requires` is met · that move has no Mutation yet (or the offer is a replacement, D11 flow).

**Hook vocabulary** (sim events or state that Bond hooks read):

| HookId | Type | Meaning |
|---|---|---|
| `shellReady` | state | Shell is up (not recharging) |
| `shellBlock` | event | Shell just blocked a hit |
| `shellRecharge` | timer | write access: a Bond may shorten Shell's recharge |
| `shellBurst` | event | Wartortle+ Shell Burst fired |
| `hitTaken` | event | the player took contact damage |
| `hpBelow` | state | player HP fraction below the Bond's threshold (value in its data) |
| `missingHp` | gradient | 1 − HP fraction |
| `fullHp` | state | HP = max HP |
| `healing` | event | the player was healed (amount) |
| `blazeActive` | state | Blaze's low-HP bonus is on (or faked by Hidden Flame) |
| `flareUp` | event | Charmeleon+ Flare Up erupted |
| `moving` | state | the player has moved continuously for ≥ the Bond's time |
| `standingStill` | state | the player hasn't moved for ≥ the Bond's time |
| `kill` | event | an enemy fainted (any source) |
| `inOwnSmoke` | state | the player stands inside their own Smokescreen |
| `targetBurning` | state | the hit target has Burn |
| `targetAsleep` | state | the hit target is asleep |
| `ownScorch` | state | the player's own Scorch patches (positions) |
| `bulbFill` | gradient | Bulb fill 0..1 (Ivysaur+) |
| `bloom` | event | the Bulb bloomed (Ivysaur+) |
| `leechStrength` | write | a Bond may raise Leech's lifesteal (capped in its data) |
| `chargeLevel` | gradient | Pikachu Charge 0..1 |
| `chargeFull` | event | Charge reached 100 |
| `staticProc` | event | Static paralysed an enemy that touched the player |
| `moveSpeed` | state | the player's current move speed (vs the target's, for Velocity Ball) |
| `chainJump` | event | a signature chain jumped (from, to) |
| `targetParalysed` | state | the hit target is paralysed |
| `discharge` | event | Raichu's Discharge fired |
| `levelUp` | event | the player levelled up |
| `levelBelow` | state | player level below the Bond's threshold (Lapras: `tideLevel` = 30) |
| `xpGem` | state | XP gems on the ground (positions) |
| `armorAbsorb` | event | damage Shell Armor just prevented (amount) |

| RequirementId | Met when |
|---|---|
| `scorchSource` | the build owns `ember.kindle`, `ember.flamethrower`, `fireSpin.flameTrail`, or the trait `solarPower` |

## Mutations
| ID | Name | Kind | Move | Line | From | Hook | Pool | Doc |
|---|---|---|---|---|---|---|---|---|
| `withdraw.spikedShell` | Spiked Shell | generic | withdraw | any | 0 | — | site | [shared/withdraw.md](shared/withdraw.md) |
| `withdraw.hunkerDown` | Hunker Down | generic | withdraw | any | 0 | — | site | [shared/withdraw.md](shared/withdraw.md) |
| `withdraw.counterShell` | Counter Shell | bond | withdraw | squirtle | 0 | `shellBlock` | site | [squirtle/](squirtle/README.md) |
| `rapidSpin.spiralSpin` | Spiral Spin | generic | rapidSpin | any | 0 | — | site | [shared/rapid-spin.md](shared/rapid-spin.md) |
| `rapidSpin.deflector` | Deflector | generic | rapidSpin | any | 0 | — | site | [shared/rapid-spin.md](shared/rapid-spin.md) |
| `rapidSpin.shellSpin` | Shell Spin | bond | rapidSpin | squirtle | 0 | `shellRecharge` | site | [squirtle/](squirtle/README.md) |
| `waterGun.slick` | Slick | generic | waterGun | any | 0 | — | site | [shared/water-gun.md](shared/water-gun.md) |
| `waterGun.washDown` | Wash Down | generic | waterGun | any | 0 | — | site | [shared/water-gun.md](shared/water-gun.md) |
| `waterGun.steadyAim` | Steady Aim | bond | waterGun | squirtle | 0 | `shellReady` | site | [squirtle/](squirtle/README.md) |
| `whirlpool.maelstrom` | Maelstrom | generic | whirlpool | any | 0 | — | site | [shared/whirlpool.md](shared/whirlpool.md) |
| `whirlpool.moat` | Moat | generic | whirlpool | any | 0 | — | site | [shared/whirlpool.md](shared/whirlpool.md) |
| `whirlpool.eyeOfTheStorm` | Eye of the Storm | bond | whirlpool | squirtle | 1 | `shellBurst` | site | [squirtle/](squirtle/README.md) |
| `surf.rideTheWave` | Ride the Wave | generic | surf | any | 0 | — | site | [shared/surf.md](shared/surf.md) |
| `surf.backwash` | Backwash | generic | surf | any | 0 | — | site | [shared/surf.md](shared/surf.md) |
| `surf.lastWave` | Last Wave | bond | surf | squirtle | 0 | `hpBelow` | site | [squirtle/](squirtle/README.md) |
| `hydroPump.splitStream` | Split Stream | generic | hydroPump | any | 0 | — | site | [shared/hydro-pump.md](shared/hydro-pump.md) |
| `hydroPump.pressureBuild` | Pressure Build | generic | hydroPump | any | 0 | — | site | [shared/hydro-pump.md](shared/hydro-pump.md) |
| `hydroPump.rainCannon` | Rain Cannon | bond | hydroPump | squirtle | 2 | `healing` | site | [squirtle/](squirtle/README.md) |
| `flashCannon.shrapnel` | Shrapnel | generic | flashCannon | any | 0 | — | site | [shared/flash-cannon.md](shared/flash-cannon.md) |
| `flashCannon.railgun` | Railgun | generic | flashCannon | any | 0 | — | site | [shared/flash-cannon.md](shared/flash-cannon.md) |
| `flashCannon.armorRounds` | Armor Rounds | bond | flashCannon | squirtle | 2 | `hitTaken` | site | [squirtle/](squirtle/README.md) |
| `bubble.trap` | Bubble Trap | signature | bubble → waterPulse → hydroCannon | squirtle | 0 | — | site | [squirtle/](squirtle/README.md) |
| `bubble.froth` | Froth Mines | signature | bubble → waterPulse → hydroCannon | squirtle | 0 | — | site | [squirtle/](squirtle/README.md) |
| `bubble.undertow` | Undertow | signature | bubble → waterPulse → hydroCannon | squirtle | 0 | — | site | [squirtle/](squirtle/README.md) |
| `scratch.furySwipes` | Fury Swipes | generic | scratch | any | 0 | — | site | [shared/scratch.md](shared/scratch.md) |
| `scratch.crescent` | Crescent | generic | scratch | any | 0 | — | site | [shared/scratch.md](shared/scratch.md) |
| `scratch.blazeClaws` | Blaze Claws | bond | scratch | charmander | 0 | `blazeActive` | site | [charmander/](charmander/README.md) |
| `fireSpin.vortex` | Vortex | generic | fireSpin | any | 0 | — | site | [shared/fire-spin.md](shared/fire-spin.md) |
| `fireSpin.flameTrail` | Flame Trail | generic | fireSpin | any | 0 | — | site | [shared/fire-spin.md](shared/fire-spin.md) |
| `fireSpin.tailFlame` | Tail Flame | bond | fireSpin | charmander | 0 | `missingHp` | site | [charmander/](charmander/README.md) |
| `dragonRage.fixedRage` | Fixed Rage | generic | dragonRage | any | 0 | — | site | [shared/dragon-rage.md](shared/dragon-rage.md) |
| `dragonRage.dragonBreath` | Dragon Breath | generic | dragonRage | any | 0 | — | site | [shared/dragon-rage.md](shared/dragon-rage.md) |
| `dragonRage.corneredDragon` | Cornered Dragon | bond | dragonRage | charmander | 1 | `flareUp` | site | [charmander/](charmander/README.md) |
| `airSlash.crosscut` | Crosscut | generic | airSlash | any | 0 | — | site | [shared/air-slash.md](shared/air-slash.md) |
| `airSlash.tailwind` | Tailwind | generic | airSlash | any | 0 | — | site | [shared/air-slash.md](shared/air-slash.md) |
| `airSlash.aerialAce` | Aerial Ace | bond | airSlash | charmander | 2 | `moving` | site | [charmander/](charmander/README.md) |
| `hurricane.tornado` | Tornado | generic | hurricane | any | 0 | — | site | [shared/hurricane.md](shared/hurricane.md) |
| `hurricane.galeWall` | Gale Wall | generic | hurricane | any | 0 | — | site | [shared/hurricane.md](shared/hurricane.md) |
| `hurricane.infernoStorm` | Inferno Storm | bond | hurricane | charmander | 2 | `kill` | site | [charmander/](charmander/README.md) |
| `smokescreen.chokingSmoke` | Choking Smoke | generic | smokescreen | any | 0 | — | site | [shared/smokescreen.md](shared/smokescreen.md) |
| `smokescreen.smokeTrail` | Smoke Trail | generic | smokescreen | any | 0 | — | site | [shared/smokescreen.md](shared/smokescreen.md) |
| `smokescreen.hiddenFlame` | Hidden Flame | bond | smokescreen | charmander | 0 | `inOwnSmoke` | site | [charmander/](charmander/README.md) |
| `slash.afterimage` | Afterimage | generic | slash | any | 0 | — | site | [shared/slash.md](shared/slash.md) |
| `slash.flurry` | Flurry | generic | slash | any | 0 | — | site | [shared/slash.md](shared/slash.md) |
| `slash.searingSlash` | Searing Slash | bond | slash | charmander | 1 | `targetBurning` | site | [charmander/](charmander/README.md) |
| `wingAttack.updraft` | Updraft | generic | wingAttack | any | 0 | — | site | [shared/wing-attack.md](shared/wing-attack.md) |
| `wingAttack.backdraft` | Backdraft | generic | wingAttack | any | 0 | — | site | [shared/wing-attack.md](shared/wing-attack.md) |
| `wingAttack.fanTheFlames` | Fan the Flames | bond | wingAttack | charmander | 2 | `ownScorch` (requires `scorchSource`) | site | [charmander/](charmander/README.md) |
| `ember.kindle` | Kindle | signature | ember → flameBurst → blastBurn | charmander | 0 | `blazeActive` | site | [charmander/](charmander/README.md) |
| `ember.flamethrower` | Flamethrower | signature | ember → flameBurst → blastBurn | charmander | 0 | `blazeActive` | site | [charmander/](charmander/README.md) |
| `ember.wisp` | Will-o-Wisp | signature | ember → flameBurst → blastBurn | charmander | 0 | `blazeActive` | site | [charmander/](charmander/README.md) |
| `tackle.rollout` | Rollout | generic | tackle | any | 0 | — | site | [shared/tackle.md](shared/tackle.md) |
| `tackle.bowling` | Bowling | generic | tackle | any | 0 | — | site | [shared/tackle.md](shared/tackle.md) |
| `tackle.bulbBash` | Bulb Bash | bond | tackle | bulbasaur | 1 | `bulbFill` | site | [bulbasaur/](bulbasaur/README.md) |
| `razorLeaf.spiral` | Leaf Spiral | generic | razorLeaf | any | 0 | — | site | [shared/razor-leaf.md](shared/razor-leaf.md) |
| `razorLeaf.embed` | Embed | generic | razorLeaf | any | 0 | — | site | [shared/razor-leaf.md](shared/razor-leaf.md) |
| `razorLeaf.healthyGrowth` | Healthy Growth | bond | razorLeaf | bulbasaur | 0 | `fullHp` | site | [bulbasaur/](bulbasaur/README.md) |
| `leechSeed.spread` | Spreading Seed | generic | leechSeed | any | 0 | — | site | [shared/leech-seed.md](shared/leech-seed.md) |
| `leechSeed.seedBomb` | Seed Bomb | generic | leechSeed | any | 0 | — | site | [shared/leech-seed.md](shared/leech-seed.md) |
| `leechSeed.seedNetwork` | Seed Network | bond | leechSeed | bulbasaur | 0 | `leechStrength` | site | [bulbasaur/](bulbasaur/README.md) |
| `poisonPowder.drift` | Drift Cloud | generic | poisonPowder | any | 0 | — | site | [shared/poison-powder.md](shared/poison-powder.md) |
| `poisonPowder.toxic` | Toxic | generic | poisonPowder | any | 0 | — | site | [shared/poison-powder.md](shared/poison-powder.md) |
| `poisonPowder.sporeSac` | Spore Sac | bond | poisonPowder | bulbasaur | 0 | `hitTaken` | site | [bulbasaur/](bulbasaur/README.md) |
| `sleepPowder.drowsy` | Drowsy Haze | generic | sleepPowder | any | 0 | — | site | [shared/sleep-powder.md](shared/sleep-powder.md) |
| `sleepPowder.nightmare` | Nightmare | generic | sleepPowder | any | 0 | — | site | [shared/sleep-powder.md](shared/sleep-powder.md) |
| `sleepPowder.sweetDreams` | Sweet Dreams | bond | sleepPowder | bulbasaur | 0 | `targetAsleep` | site | [bulbasaur/](bulbasaur/README.md) |
| `sludge.pool` | Sludge Pool | generic | sludge | any | 0 | — | site | [shared/sludge.md](shared/sludge.md) |
| `sludge.acid` | Acid | generic | sludge | any | 0 | — | site | [shared/sludge.md](shared/sludge.md) |
| `sludge.sludgeBomb` | Sludge Bomb | bond | sludge | bulbasaur | 0 | `hpBelow` | site | [bulbasaur/](bulbasaur/README.md) |
| `petalDance.frenzy` | Frenzy Dance | generic | petalDance | any | 0 | — | site | [shared/petal-dance.md](shared/petal-dance.md) |
| `petalDance.pollen` | Pollen Ring | generic | petalDance | any | 0 | — | site | [shared/petal-dance.md](shared/petal-dance.md) |
| `petalDance.petalBlizzard` | Petal Blizzard | bond | petalDance | bulbasaur | 1 | `bloom` | site | [bulbasaur/](bulbasaur/README.md) |
| `solarBeam.fullCharge` | Full Charge | generic | solarBeam | any | 0 | — | site | [shared/solar-beam.md](shared/solar-beam.md) |
| `solarBeam.prism` | Prism | generic | solarBeam | any | 0 | — | site | [shared/solar-beam.md](shared/solar-beam.md) |
| `solarBeam.ingrain` | Ingrain | bond | solarBeam | bulbasaur | 2 | `standingStill` | site | [bulbasaur/](bulbasaur/README.md) |
| `vineWhip.snare` | Snare | signature | vineWhip → powerWhip → frenzyPlant | bulbasaur | 0 | `bloom` | site | [bulbasaur/](bulbasaur/README.md) |
| `vineWhip.thornGarden` | Thorn Garden | signature | vineWhip → powerWhip → frenzyPlant | bulbasaur | 0 | `bloom` | site | [bulbasaur/](bulbasaur/README.md) |
| `vineWhip.sapLash` | Sap Lash | signature | vineWhip → powerWhip → frenzyPlant | bulbasaur | 0 | `bloom` | site | [bulbasaur/](bulbasaur/README.md) |
| `quickAttack.blink` | Blink Strike | generic | quickAttack | any | 0 | — | site | [shared/quick-attack.md](shared/quick-attack.md) |
| `quickAttack.doubleHit` | Double Hit | generic | quickAttack | any | 0 | — | site | [shared/quick-attack.md](shared/quick-attack.md) |
| `quickAttack.voltTackle` | Volt Tackle | bond | quickAttack | pikachu | 0 | `chargeFull` | site | [pikachu/](pikachu/README.md) |
| `spark.arcPair` | Arc Pair | generic | spark | any | 0 | — | site | [shared/spark.md](shared/spark.md) |
| `spark.shower` | Spark Shower | generic | spark | any | 0 | — | site | [shared/spark.md](shared/spark.md) |
| `spark.staticSpark` | Static Spark | bond | spark | pikachu | 0 | `staticProc` | site | [pikachu/](pikachu/README.md) |
| `electroBall.ricochet` | Ricochet | generic | electroBall | any | 0 | — | site | [shared/electro-ball.md](shared/electro-ball.md) |
| `electroBall.plasma` | Plasma Orb | generic | electroBall | any | 0 | — | site | [shared/electro-ball.md](shared/electro-ball.md) |
| `electroBall.velocityBall` | Velocity Ball | bond | electroBall | pikachu | 0 | `moveSpeed` | site | [pikachu/](pikachu/README.md) |
| `thunderWave.pulse` | Static Pulse | generic | thunderWave | any | 0 | — | site | [shared/thunder-wave.md](shared/thunder-wave.md) |
| `thunderWave.terrain` | Electric Terrain | generic | thunderWave | any | 0 | — | site | [shared/thunder-wave.md](shared/thunder-wave.md) |
| `thunderWave.conductor` | Conductor | bond | thunderWave | pikachu | 0 | `chainJump` | site | [pikachu/](pikachu/README.md) |
| `ironTail.spin` | Iron Spin | generic | ironTail | any | 0 | — | site | [shared/iron-tail.md](shared/iron-tail.md) |
| `ironTail.slam` | Iron Slam | generic | ironTail | any | 0 | — | site | [shared/iron-tail.md](shared/iron-tail.md) |
| `ironTail.shockShatter` | Shock Shatter | bond | ironTail | pikachu | 0 | `targetParalysed` | site | [pikachu/](pikachu/README.md) |
| `thunder.storm` | Storm Call | generic | thunder | any | 0 | — | site | [shared/thunder.md](shared/thunder.md) |
| `thunder.afterglow` | Afterglow | generic | thunder | any | 0 | — | site | [shared/thunder.md](shared/thunder.md) |
| `thunder.thunderstorm` | Thunderstorm | bond | thunder | pikachu | 1 | `discharge` | site | [pikachu/](pikachu/README.md) |
| `thunderShock.liveWire` | Live Wire | signature | thunderShock → thunderbolt | pikachu | 0 | `chargeLevel` | site | [pikachu/](pikachu/README.md) |
| `thunderShock.ballLightning` | Ball Lightning | signature | thunderShock → thunderbolt | pikachu | 0 | `chargeLevel` | site | [pikachu/](pikachu/README.md) |
| `thunderShock.returnArc` | Return Arc | signature | thunderShock → thunderbolt | pikachu | 0 | `chargeLevel` | site | [pikachu/](pikachu/README.md) |
| `bodySlam.bellyFlop` | Belly Flop | generic | bodySlam | any | 0 | — | site | [shared/body-slam.md](shared/body-slam.md) |
| `bodySlam.shockwave` | Shockwave | generic | bodySlam | any | 0 | — | site | [shared/body-slam.md](shared/body-slam.md) |
| `bodySlam.surge` | Surging Slam | bond | bodySlam | lapras | 0 | `levelUp` (tide) | site | [lapras/](lapras/README.md) |
| `iceBeam.iceWall` | Ice Wall | generic | iceBeam | any | 0 | — | site | [shared/ice-beam.md](shared/ice-beam.md) |
| `iceBeam.aurora` | Aurora Beam | generic | iceBeam | any | 0 | — | site | [shared/ice-beam.md](shared/ice-beam.md) |
| `iceBeam.flashFreeze` | Flash Freeze | bond | iceBeam | lapras | 0 | `levelBelow` (tide) | site | [lapras/](lapras/README.md) |
| `surf.ferryWave` | Ferry Wave | bond | surf | lapras | 0 | `xpGem` (tide) | site | [lapras/](lapras/README.md) |
| `hydroPump.pressureShell` | Pressure Shell | bond | hydroPump | lapras | 0 | `armorAbsorb` (tide) | site | [lapras/](lapras/README.md) |
| `iceShard.hail` | Hail | signature | iceShard → sheerCold (Lv 25) | lapras | 0 | — | site | [lapras/](lapras/README.md) |
| `iceShard.frostLance` | Frost Lance | signature | iceShard → sheerCold (Lv 25) | lapras | 0 | — | site | [lapras/](lapras/README.md) |
| `iceShard.song` | Song of the Sea | signature | iceShard → sheerCold (Lv 25) | lapras | 0 | — | site | [lapras/](lapras/README.md) |

Smokescreen, Slash and Wing Attack are proposed new moves (not in `src/data/moves.ts` yet).
**Prerequisites:** a Hook cell marked **needs …** means the Bond is only offered when the build already has that source.
**Retired IDs:** `vineWhip.longLash` (Long Lash) was removed by D30 (2026-10-22) and replaced by `vineWhip.snare`. Delete it from `src/data/mutations.ts`, and migrate or version-bump saved build snapshots that hold it. Never reuse a retired ID.

"From 0" on a final-stage-only move (Hydro Pump, Flash Cannon, Air Slash, Hurricane, Solar Beam, Thunder) still means the move
itself must be owned first, and it only unlocks at stage 2.

## Ability tiers
| ID | Name | Kind | Line | Stage | How you get it |
|---|---|---|---|---|---|
| `shell` | Shell | ability | squirtle | 0 | start |
| `shell.tidalGuard` | Shell — Tidal Guard | ability | squirtle | 1 | evolution (automatic) |
| `torrentPlus` | Torrent+ | ability | squirtle | 2 | final trait pick |
| `rainDish` | Rain Dish | ability | squirtle | 2 | final trait pick |
| `blaze` | Blaze | ability | charmander | 0 | start |
| `blaze.flareUp` | Blaze — Flare Up | ability | charmander | 1 | evolution (automatic) |
| `blazePlus` | Blaze+ | ability | charmander | 2 | final trait pick |
| `solarPower` | Solar Power | ability | charmander | 2 | final trait pick |
| `leech` | Leech | ability | bulbasaur | 0 | start |
| `leech.bloom` | Leech — Bulb Bloom | ability | bulbasaur | 1 | evolution (automatic) |
| `overgrowPlus` | Overgrow+ | ability | bulbasaur | 2 | final trait pick |
| `chlorophyll` | Chlorophyll | ability | bulbasaur | 2 | final trait pick |
| `static` | Static | ability | pikachu | 0 | start |
| `static.discharge` | Static — Discharge | ability | pikachu | 1 | evolution (automatic, Lv 16) |
| `staticPlus` | Static+ | ability | pikachu | 1 | final trait pick |
| `lightningRod` | Lightning Rod | ability | pikachu | 1 | final trait pick |
| `shellArmor` | Shell Armor | ability | lapras | 0 | start (no upgrade, no trait) |

## Counts
| Line | Generic (its moves) | Bond | Signature | Ability tiers |
|---|---|---|---|---|
| squirtle | 14 | 7 | 3 | 4 |
| charmander | 16 | 8 | 3 | 4 |
| bulbasaur | 16 | 8 | 3 | 4 |
| pikachu | 12 | 6 | 3 | 4 |
| lapras | 4 (+4 shared from Surf / Hydro Pump) | 4 | 3 | 1 |
