# Mutation ranks II/III + favoured augments (D24) — PROPOSED, needs owner approval (P4h-2)

Every Mutation ranks I → III at Mutation Sites (D24). Rank I is the Mutation as built in P4f
(numbers in `src/data/mutations.ts`). This file lists what ranks II and III change, and the
**favoured augments** for each Mutation.

## Rules
- **Power target (provisional):** rank II ≈ **+15% DPS**, rank III ≈ **+30% DPS** over rank I, judged like rule 4
  (dummy ring, Bonds with their condition true about half the time). `npm run mutations` gets a column per rank.
- **Ranks only scale what the Mutation already does or ease its cost.** They never add a new cost, never add
  projectiles without paying (rule: projectile budget), never proc from a proc, and respect the caps
  (chain 3, Puddle and Scorch 6, slow cap, stun fatigue, bosses).
- Values are **absolute** (the rank I value is in brackets on first mention): "dmg ×0.92 (0.8)" means the
  Mutation's damage factor becomes 0.92 at that rank.
- **★ = rank III twist**, a small behaviour change, only where one is natural (D24). Rank III without ★ is numbers only.
- Where a Mutation has no damage lever (pure utility), the rank scales its utility **and** gives "move dmg ×1.15 / ×1.3".
- **Signature Mutations:** ranks stack with the evolution tiers (tier values unchanged).
  **Lapras Bonds:** ranks scale both the Flood and the Ebb value.
- **Favoured augments:** 2–3 existing augments per Mutation that suit its direction. They show **gold** and are offered
  **×3 as often** in that move's augment windows; no other bonus (D24). They must be legal for the move (its tags, or a
  later signature tier's tags) and never in the Mutation's `excludesAugments`. A test keeps this file in sync.

## Squirtle line
| Mutation | Rank II | Rank III | Favoured |
|---|---|---|---|
| `withdraw.spikedShell` Spiked Shell | aura ticks 0.32 (0.28) | ticks 0.3; ★ aura lasts 4 s (3) | `enlarge`, `quickCast`, `lifesteal` |
| `withdraw.hunkerDown` Hunker Down | dmg ×0.92 (0.8); buff 1.75 s (1.5) | dmg ×1.04; buff 2 s; ★ hits taken while hunkered stagger the attacker 15 px | `quickCast`, `knockback`, `powerUp` |
| `withdraw.counterShell` Counter Shell | dmg ×0.92 (0.8) | dmg ×1.04; ★ the reset Withdraw hits +50% | `knockback`, `powerUp`, `enlarge` |
| `rapidSpin.spiralSpin` Spiral Spin | dmg ×1.03 (0.9) | dmg ×1.17; ★ spirals out to 140 px (120) | `extend`, `enlarge`, `powerUp` |
| `rapidSpin.deflector` Deflector | dmg ×0.8 (0.7) | dmg ×0.91; deflect window 0.2 s (0.3) | `extend`, `enlarge`, `quickCast` |
| `rapidSpin.shellSpin` Shell Spin | cut 0.3 s per hit (0.25); dmg ×0.92 (0.8) | cut 0.35 s; max 2 s per cast (1.5); dmg ×1.04 | `extend`, `powerUp`, `quickCast` |
| `waterGun.slick` Slick | dmg ×0.8 (0.7); slip 0.2/s (0.15) | dmg ×0.91; slip 0.25/s; ★ puddles last 4.5 s (3) | `extend`, `enlarge`, `quickCast` |
| `waterGun.washDown` Wash Down | Water taken +25% (20%); dmg ×0.55 (0.5) | +30%; dmg ×0.55; ★ also +10% from every other type | `extend`, `quickCast`, `enlarge` |
| `waterGun.steadyAim` Steady Aim | length ×1.5 (1.4); Shell down ×0.85 (0.75); Shell up +10% damage | length ×1.6; Shell down ×0.95; ★ Shell up: +20% damage | `extend`, `enlarge`, `powerUp` |
| `whirlpool.maelstrom` Maelstrom | collapse ×1.85 (1.6); cooldown ×1.25 (1.4) | collapse ×2.1; cooldown ×1.15; ★ pull 45 px/s (30) | `linger`, `enlarge`, `concentrated` |
| `whirlpool.moat` Moat | dmg ×0.58 (0.5) | dmg ×0.65; ★ enemies crossing the ring are Soaked | `enlarge`, `linger`, `powerUp` |
| `whirlpool.eyeOfTheStorm` Eye of the Storm | 2.5 s (2) | 3 s; ★ every one pulls | `linger`, `enlarge`, `quickCast` |
| `surf.rideTheWave` Ride the Wave | wave dmg ×1.15; travel 250 px (220) | wave dmg ×1.3; ★ speed boost 2 s (1) | `enlarge`, `quickCast`, `knockback` |
| `surf.backwash` Backwash | return 50% (30%) | return 70%; ★ the return wave Soaks | `enlarge`, `knockback`, `quickCast` |
| `surf.lastWave` Last Wave | above-threshold dmg ×0.9 (0.8); threshold 50% HP (40%) | ×1.0; threshold 60% | `enlarge`, `quickCast`, `glass` |
| `hydroPump.splitStream` Split Stream | 38% per beam (33%) | 43% per beam | `extend`, `enlarge`, `powerUp` |
| `hydroPump.pressureBuild` Pressure Build | ramp +15% per tick (12%); cooldown ×1.35 (1.5) | ramp +20%; ★ cooldown ×1.3 | `extend`, `concentrated`, `keenEdge` |
| `hydroPump.rainCannon` Rain Cannon | dmg ×0.115 (0.1); heal cap 12/s (10) | dmg ×0.13; ★ heal cap 15/s | `enlarge`, `extend`, `lifesteal` |
| `flashCannon.shrapnel` Shrapnel | shards 40% (35%); cooldown ×1.15 (1.3) | 45%; cooldown ×1.0; ★ shards pierce 1 | `pierce`, `velocity`, `multishot` |
| `flashCannon.railgun` Railgun | dmg ×1.5 (1.3) | dmg ×1.7 | `velocity`, `concentrated`, `keenEdge` |
| `flashCannon.armorRounds` Armor Rounds | second round 70% (60%); dmg ×0.92 (0.8) | 80%; dmg ×1.04 | `velocity`, `powerUp`, `homing` |
| `bubble.trap` Bubble Trap (signature) | pop 100% (80%) | pop 120%; ★ the pop Soaks | `enlarge`, `wideBlast`, `multishot` |
| `bubble.froth` Froth Mines (signature) | mines 33% (25%) | 40%; ★ up to 12 mines (9) | `multishot`, `extend`, `enlarge` |
| `bubble.undertow` Undertow (signature) | dmg ×0.75 (0.65) | dmg ×0.88; ★ range ×0.9 (0.8) | `pierce`, `velocity`, `enlarge` |

## Charmander line
| Mutation | Rank II | Rank III | Favoured |
|---|---|---|---|
| `scratch.furySwipes` Fury Swipes | +13.5% per stack (8%) | +16%; ★ up to 6 stacks (5) | `quickCast`, `keenEdge`, `lifesteal` |
| `scratch.crescent` Crescent | dmg ×0.52 (0.45); wave 45% (40%) | ×0.58; wave 50%; ★ wave travels 100 px (70) | `enlarge`, `powerUp`, `knockback` |
| `scratch.blazeClaws` Blaze Claws | burn 40% (30%); off ×0.95 (0.85) | burn 50%; off ×1.05; ★ reach ×1.4 (1.3) | `enlarge`, `keenEdge`, `glass` |
| `fireSpin.vortex` Vortex | burst ×2.0 (1.6) | ×2.1; ★ burst radius 130 px (110) | `enlarge`, `extend`, `burn` |
| `fireSpin.flameTrail` Flame Trail | dmg ×0.8 (0.7); Scorch every 0.5 s (0.6) | ×0.9; every 0.4 s | `extend`, `burn`, `enlarge` |
| `fireSpin.tailFlame` Tail Flame | dmg ×0.86 (0.75) | ×0.97; ★ flames at 80% / 50% HP (70% / 40%) | `burn`, `extend`, `glass` |
| `dragonRage.fixedRage` Fixed Rage | fixed 8 (7) | fixed 9; ★ +1 per 3 levels (4) | `quickCast`, `extend`, `enlarge` |
| `dragonRage.dragonBreath` Dragon Breath | dmg ×0.69 (0.6) | ×0.78; ★ paralysis chance 15% (10%) | `enlarge`, `quickCast`, `extend` |
| `dragonRage.corneredDragon` Cornered Dragon | side arms ×0.6 (0.5) | side arms ×0.75; ★ 8 directions (4) | `extend`, `enlarge`, `powerUp` |
| `airSlash.crosscut` Crosscut | dmg ×0.98 (0.85) | ×1.1 | `keenEdge`, `velocity`, `pierce` |
| `airSlash.tailwind` Tailwind | dmg ×0.92 (0.8); speed cap +20% (15%) | ×1.04; cap +25% | `multishot`, `pierce`, `velocity` |
| `airSlash.aerialAce` Aerial Ace | crit +25% (20%); still ×0.85 (0.75) | +30%; still ×0.95; ★ homing after 0.7 s moving (1) | `keenEdge`, `velocity`, `pierce` |
| `hurricane.tornado` Tornado | dmg ×0.92 (0.8) | ×1.04; ★ travels 150 px/s (120) | `extend`, `enlarge`, `powerUp` |
| `hurricane.galeWall` Gale Wall | dmg ×0.75 (0.65) | ×0.85; ★ stagger 40 (30) | `extend`, `enlarge`, `quickCast` |
| `hurricane.infernoStorm` Inferno Storm | dmg ×0.98 (0.85); ignites at 25 kills (30) | ×1.1; 20 kills | `extend`, `enlarge`, `powerUp` |
| `smokescreen.chokingSmoke` Choking Smoke | 4.6 per tick (4) | 5 per tick; ★ radius ×0.72 (0.7) | `linger`, `enlarge`, `quickCast` |
| `smokescreen.smokeTrail` Smoke Trail | puffs last 2 s (1.5) | 2.5 s; ★ trail lasts 5 s (4) | `linger`, `enlarge`, `quickCast` |
| `smokescreen.hiddenFlame` Hidden Flame | radius ×0.7 (0.6); cooldown ×1.25 (1.4) | ×0.8; cooldown ×1.1 | `linger`, `enlarge`, `quickCast` |
| `slash.afterimage` Afterimage | re-cut 60% (50%); innate crit 20% (15%); move dmg ×1.1 | 70%; crit 25%; move dmg ×1.2; ★ mark lasts 0.9 s (0.6) | `keenEdge`, `enlarge`, `wideBlast` |
| `slash.flurry` Flurry | cuts 115% (100%) | cuts 130% | `keenEdge`, `quickCast`, `lifesteal` |
| `slash.searingSlash` Searing Slash | not Burning ×0.9 (0.8) | ×1.0; ★ the cash-in deals ×1.25 the remaining Burn; the X Burns | `keenEdge`, `concentrated`, `glass` |
| `wingAttack.updraft` Updraft | dmg ×0.86 (0.75) | ×0.97; ★ lift 0.8 s (0.6) | `enlarge`, `knockback`, `quickCast` |
| `wingAttack.backdraft` Backdraft | move dmg ×1.15 | move dmg ×1.05; ★ rear arc 200° (160) | `knockback`, `enlarge`, `quickCast` |
| `wingAttack.fanTheFlames` Fan the Flames | dmg ×0.92 (0.8) | ×1.04; ★ patches grow to ×1.75 (1.5) | `enlarge`, `quickCast`, `powerUp` |
| `ember.kindle` Kindle (signature) | Kindled ×2.75 (2.2) | ×2.75; ★ Kindled shots Burn (5% per s) | `blazeCore`, `burn`, `wideBlast` |
| `ember.flamethrower` Flamethrower (signature) | flames 35% (30%) | 40%; ★ reach 150 px (130) | `burn`, `blazeCore`, `enlarge` |
| `ember.wisp` Will-o-Wisp (signature) | dmg ×1.5 (1.3) | ×1.7; ★ +1 wisp (3 / 5 with Blaze) | `blazeCore`, `homing`, `velocity` |

## Bulbasaur line
| Mutation | Rank II | Rank III | Favoured |
|---|---|---|---|
| `tackle.rollout` Rollout | +8% per stack (7%); dmg ×0.88 (0.8) | +9%; ×0.96; ★ up to 6 stacks (5) | `quickCast`, `knockback`, `enlarge` |
| `tackle.bowling` Bowling | collisions 45% (30%) | 60%; ★ stagger 40 (30) | `knockback`, `powerUp`, `enlarge` |
| `tackle.bulbBash` Bulb Bash | full Bulb +95% (80%); empty ×0.9 (0.8) | +110%; empty ×1.0 | `powerUp`, `glass`, `keenEdge` |
| `razorLeaf.spiral` Leaf Spiral | dmg ×0.92 (0.8) | ×1.04 | `multishot`, `pierce`, `enlarge` |
| `razorLeaf.embed` Embed | rip 66% (45%) | 85%; ★ rips after 1.2 s (1.5) | `keenEdge`, `multishot`, `velocity` |
| `razorLeaf.healthyGrowth` Healthy Growth | hurt ×0.7 (0.6); above 80% HP +10% damage | hurt ×0.8; above 80% HP +15%; ★ pierce 2 (1) | `multishot`, `pierce`, `lifesteal` |
| `leechSeed.spread` Spreading Seed | duration ×0.9 (0.75) | ×1.0; ★ jumps twice (1) | `homing`, `extend`, `lifesteal` |
| `leechSeed.seedBomb` Seed Bomb | strength 15.5% (10%) | 16%; ★ radius 65 px (50) | `enlarge`, `extend`, `quickCast` |
| `leechSeed.seedNetwork` Seed Network | seed dmg ×0.83 (0.7); Leech cap +4% (3%) | ×0.95; cap +5% | `lifesteal`, `homing`, `multishot` |
| `poisonPowder.drift` Drift Cloud | move dmg ×1.15 | ×1.3; ★ drifts 45 px/s (30) | `linger`, `enlarge`, `quickCast` |
| `poisonPowder.toxic` Toxic | +31% per stack (20%) | +28% with ★ duration ×0.85 (0.7) | `linger`, `enlarge`, `powerUp` |
| `poisonPowder.sporeSac` Spore Sac | every 1.5 s at most (2) | every 1 s; ★ clouds last 2 s (1.5) | `linger`, `enlarge`, `quickCast` |
| `sleepPowder.drowsy` Drowsy Haze | move dmg ×1.15; sleep after 1.2 s (1.5) | ×1.3; 1 s; ★ slow 60% (50%) | `linger`, `enlarge`, `quickCast` |
| `sleepPowder.nightmare` Nightmare | sleepers take +30% (25%) | +35%; ★ sleep 0.8 s (0.6) | `linger`, `enlarge`, `quickCast` |
| `sleepPowder.sweetDreams` Sweet Dreams | sleep ×0.85 (0.75) | ×0.95; ★ Leech ×4 (3) | `linger`, `lifesteal`, `enlarge` |
| `sludge.pool` Sludge Pool | dmg ×0.8 (0.7) | ×0.9; ★ pool lasts 3.5 s (2.5) | `multishot`, `powerUp`, `enlarge` |
| `sludge.acid` Acid | +18% taken (15%); dmg ×0.82 (0.75) | +20%; ×0.9; ★ lasts 4 s (3) | `multishot`, `homing`, `quickCast` |
| `sludge.sludgeBomb` Sludge Bomb | above ×0.95 (0.85); threshold 60% HP (50%) | ×1.05; 70% | `multishot`, `glass`, `enlarge` |
| `petalDance.frenzy` Frenzy Dance | spin ramp 0.35/s (0.3); move ×0.9 (0.85); move dmg ×1.1 | 0.4/s; ×0.95; move dmg ×1.2; ★ petals fly 200 px (150) | `extend`, `enlarge`, `quickCast` |
| `petalDance.pollen` Pollen Ring | dmg ×0.86 (0.75); heal cap 6/s (5) | ×0.97; cap 7/s | `extend`, `lifesteal`, `enlarge` |
| `petalDance.petalBlizzard` Petal Blizzard | lasts 2.5 s (2) | ★ lasts 3 s | `extend`, `enlarge`, `powerUp` |
| `solarBeam.fullCharge` Full Charge | dmg ×1.38 (1.2) | ×1.56; ★ charges in 0.75 s (1) | `concentrated`, `extend`, `keenEdge` |
| `solarBeam.prism` Prism | 46% per beam (40%); main beam ×0.95 (0.85) | 52%; main beam ×1.05 | `extend`, `enlarge`, `powerUp` |
| `solarBeam.ingrain` Ingrain | moving ×0.9 (0.8); recharge ×2.3 (2) | ×1.0; ×2.6; ★ roots after 0.7 s (1) | `extend`, `quickCast`, `concentrated` |
| `vineWhip.snare` Snare (signature, D30) | bind 1 s (0.8); Grass +30% (25%) | bind 1.2 s; +35%; ★ the tip binds 2 enemies (1) | `enlarge`, `quickCast`, `powerUp` |
| `vineWhip.thornGarden` Thorn Garden (signature) | lashes 45% (30%) | 50%; ★ 5 sprouts (4) | `enlarge`, `quickCast`, `powerUp` |
| `vineWhip.sapLash` Sap Lash (signature) | dmg ×0.86 (0.75); heal cap 5 per swing (4) | ×0.97; cap 6 | `lifesteal`, `enlarge`, `quickCast` |

## Pikachu line
| Mutation | Rank II | Rank III | Favoured |
|---|---|---|---|
| `quickAttack.blink` Blink Strike | dmg ×0.86 (0.75); range 160 px (140) | ×0.97; 180 px | `keenEdge`, `quickCast`, `lifesteal` |
| `quickAttack.doubleHit` Double Hit | second hit 80% (60%) | 90%; ★ cooldown ×1.2 (1.3) | `keenEdge`, `knockback`, `powerUp` |
| `quickAttack.voltTackle` Volt Tackle | ×3.45 (3); recoil 4% (5%) | ×3.9; recoil 3%; ★ dash 150 px (120) | `glass`, `keenEdge`, `concentrated` |
| `spark.arcPair` Arc Pair | dmg ×0.69 (0.6) | ×0.75; ★ line 14 px wide (10) | `extend`, `enlarge`, `quickCast` |
| `spark.shower` Spark Shower | bolts 75% (65%); cooldown ×1.05 (1.2) | 85%; cooldown ×0.95 | `extend`, `enlarge`, `quickCast` |
| `spark.staticSpark` Static Spark | sparks last 2.5 s (2); cooldown ×1.1 (1.2) | 3 s; ×1.0; ★ up to 4 extra sparks (3) | `extend`, `enlarge`, `powerUp` |
| `electroBall.ricochet` Ricochet | dmg ×0.92 (0.8) | ★ 3 bounces (2, inside the chain cap) at dmg ×0.8 | `velocity`, `homing`, `keenEdge` |
| `electroBall.plasma` Plasma Orb | grows to +55% (+40%); move dmg ×1.15 | +70%; move dmg ×1.27; ★ speed ×0.8 (0.7) | `extend`, `enlarge`, `pierce` |
| `electroBall.velocityBall` Velocity Ball | dmg ×0.66 (0.6); cap +90% (80%) | ×0.72; cap +100% | `velocity`, `quickCast`, `pierce` |
| `thunderWave.pulse` Static Pulse | move dmg ×1.15; paralysis 0.45 s (0.4) | move dmg ×1.08; 0.5 s; ★ ring 165 px (150) | `enlarge`, `quickCast`, `powerUp` |
| `thunderWave.terrain` Electric Terrain | Electric +30% (25%) | +35%; ★ field 6 s (5) | `linger`, `enlarge`, `quickCast` |
| `thunderWave.conductor` Conductor | jump range ×1.8 (1.6); jumps between fields +15% dmg | ×2.0; +30% | `linger`, `enlarge`, `quickCast` |
| `ironTail.spin` Iron Spin | dmg ×0.92 (0.8) | ×0.9; ★ reach ×0.85 (0.8) | `enlarge`, `knockback`, `powerUp` |
| `ironTail.slam` Iron Slam | cooldown ×1.4 (1.6) | ×1.25; ★ radius 75 px (60) | `enlarge`, `concentrated`, `keenEdge` |
| `ironTail.shockShatter` Shock Shatter | shatter ×2.0 (1.8); not paralysed ×0.9 (0.8) | ×2.2; ×1.0; ★ leap 75% (50%) | `keenEdge`, `glass`, `concentrated` |
| `thunder.storm` Storm Call | strikes 92% (80%) | 105%; ★ strike radius 34 px (30) | `enlarge`, `quickCast`, `powerUp` |
| `thunder.afterglow` Afterglow | dmg ×0.92 (0.8); field 2.5 s (2) | ×1.04; 3 s | `linger`, `enlarge`, `quickCast` |
| `thunder.thunderstorm` Thunderstorm | cooldown ×1.15 (1.3) | ×1.0; ★ the Discharge strike is ×1.5 wider | `enlarge`, `powerUp`, `quickCast` |
| `thunderShock.liveWire` Live Wire (signature) | wires 27% (20%); jumps ×0.82 (0.7) | 32%; ×0.93 | `keenEdge`, `velocity`, `homing` |
| `thunderShock.ballLightning` Ball Lightning (signature) | zaps 75% (65%) | 85%; ★ orb lasts 2 s (1.6) | `extend`, `enlarge`, `velocity` |
| `thunderShock.returnArc` Return Arc (signature) | dmg ×0.85 (0.8); +5 Charge per jump (4) | ×0.95; +6 | `velocity`, `keenEdge`, `homing` |

## Lapras
| Mutation | Rank II | Rank III | Favoured |
|---|---|---|---|
| `bodySlam.bellyFlop` Belly Flop | cooldown ×1.75 (2) | ×1.55; ★ radius 105 px (90) | `enlarge`, `concentrated`, `knockback` |
| `bodySlam.shockwave` Shockwave | slam ×0.82 (0.75); wave 45% (40%) | ×0.9; 50%; ★ wave runs 200 px (150) | `enlarge`, `knockback`, `powerUp` |
| `bodySlam.surge` Surging Slam (Tide) | dmg ×0.97 (0.85); Flood 4 slams (3), Ebb 2 (1) | ×1.08; Flood 5, Ebb 2 | `enlarge`, `quickCast`, `knockback` |
| `iceBeam.iceWall` Ice Wall | dmg ×0.8 (0.7); wall 2.5 s (2) | ×0.9; 3 s; ★ wall 110 px wide (80) | `extend`, `enlarge`, `quickCast` |
| `iceBeam.aurora` Aurora Beam | contact ×0.75 (0.8); dmg ×0.92 (0.8) | ×0.7; ×1.04 | `extend`, `enlarge`, `lifesteal` |
| `iceBeam.flashFreeze` Flash Freeze (Tide) | dmg ×0.92 (0.8); Flood freeze 0.7 s (0.6); Ebb width ×1.3 (1.2) | ×1.04; Flood 0.8 s; Ebb ×1.4 | `extend`, `enlarge`, `quickCast` |
| `surf.ferryWave` Ferry Wave (Tide) | dmg ×0.92 (0.8); Flood gems ×1.75 (1.5), Ebb ×1.2 (1) | ×1.04; Flood ×2, Ebb ×1.4 | `enlarge`, `quickCast`, `knockback` |
| `hydroPump.pressureShell` Pressure Shell (Tide) | cooldown ×1.1 (1.2); cap Flood 80 (60), Ebb 40 (30) | ×1.0; Flood 100, Ebb 50 | `extend`, `concentrated`, `powerUp` |
| `iceShard.hail` Hail (signature) | shards 70% (60%) | 80% | `wideBlast`, `keenEdge`, `quickCast` |
| `iceShard.frostLance` Frost Lance (signature) | cooldown ×1.2 (1.4) | ×1.02; ★ slow 40% (30%) | `velocity`, `concentrated`, `keenEdge` |
| `iceShard.song` Song of the Sea (signature) | move dmg ×1.15; sleep 1.2 s (1) | ×1.3; 1.4 s | `enlarge`, `quickCast`, `multishot` |

## Open points for the owner
1. **Twist count:** 75 of 110 rank III entries carry a ★. Is that the right amount of "where natural"?
2. **Utility Mutations** (Drift Cloud, Drowsy Haze, Static Pulse, Backdraft, Song of the Sea, Afterimage, Frenzy Dance, Plasma Orb) get flat move damage at ranks II/III
   on top of their utility lever, so a rank-up is always worth a site. Smoke Trail and Hidden Flame sit on a move with no
   damage, so their ranks are utility only (they can't meet a DPS target).
3. **Ricochet III** goes to 3 bounces (inside the chain cap) and pays with damage ×0.8 instead of ×1.04.
