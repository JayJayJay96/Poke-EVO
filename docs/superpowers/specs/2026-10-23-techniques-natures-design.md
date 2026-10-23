# Techniques + Natures — normal level-up rewards (D40)

**Status:** approved direction (owner, 2026-10-23). Not built. Every number here is *(provisional)*.

## Problem
A run reaches about level 40. Every 3rd level is an augment level (about 13). Of the other ~27 normal levels:
- about 4 give learnset moves;
- about 23 give flat stat cards (Vitality, Power, Haste, Agility, Magnet, Focus; 5 picks each).

So more than half of all level-ups are "+X%". That goes against pillar 1 ("Kit over stats"), and it is rarely a real choice: Power or Haste is almost always the right pick.

## Decision
Normal levels offer three kinds of card:
1. **Learnset moves.** No change.
2. **Techniques.** New: ranked passives that react to what the player does.
3. **Natures.** These replace the 6 flat boosts. Each one raises a stat and lowers another.

The augment rhythm (every 3rd level), augments, Mutations, held items and Sites are unchanged.

## Techniques
- **Ranks I–III.** Picking an owned Technique again ranks it up.
- **5 Technique slots per run.** 5 × III = 15 picks, which matches the ~15 levels left over for them, so the choice is *which* 5.
- **Full slots:** once all 5 slots are filled, only rank-ups are offered. There is no replace window.
- **Tag-linked Techniques** enter the pool only while the player owns a move with that tag. That includes the signature move and combined moves.
- **The D29 rules apply.** Whatever a Technique creates triggers nothing:
  - a spread burn or a poison puff does not fire on-hit effects, Techniques or Mutations;
  - stuns and slows use the existing helpers, so the boss immunity and stun fatigue rules still apply.
- **Offer rule:** each normal-level offer holds at least 1 Technique card while a free slot or a rank-up is left.

### Starter list (13)
Values are for ranks I / II / III.

**Playstyle (any Pokémon)**
| Id | Name | Effect |
|---|---|---|
| rollout | Rollout | After 2 s of moving without stopping, your next cast deals +40 / 60 / 80% damage. Standing still or casting resets the timer. |
| moxie | Moxie | Each kill gives +1% damage, up to +10 / 15 / 20%. The stack resets when you take a hit. |
| endure | Endure | A hit that would kill you leaves you at 1 HP, plus 1 s of invulnerability. Once every 90 / 75 / 60 s. |
| rage | Rage | Taking a hit cuts cooldowns by 20 / 25 / 30% for 3 s. |
| pickup | Pickup | Each XP gem collected has a 2 / 3 / 4% chance to heal 5 HP. |
| focusEnergy | Focus Energy | Every 8 / 7 / 6 s, each move's next hit is a ×2 crit. |

**Tag-linked**
| Id | Name | Needs tag | Effect |
|---|---|---|---|
| kindling | Kindling | Fire | When a burning enemy dies, its burn spreads to 1 / 2 / 3 enemies within 120 px. |
| riptide | Riptide | Water | Water hits slow the enemy by 15 / 20 / 25% for 2 s. |
| sporeCloud | Spore Cloud | Grass or Poison | A poisoned enemy that dies leaves a poison puff, radius 50 / 70 / 90 px, lasting 2 s. |
| staticField | Static Field | Electric | Paralysed enemies take +15 / 25 / 35% damage. |
| frostbite | Frostbite | Ice | An enemy killed while frozen shatters for 20 / 35 / 50% of the killing hit, in a 60 px area. |
| sharpshooter | Sharpshooter | Projectile | Projectile hits on enemies more than 300 px from the player deal +20 / 30 / 40% damage. |
| brawler | Brawler | Melee or Contact | Each melee hit heals 1 HP, up to 3 / 4 / 5 HP/s. |

## Natures
Natures replace `BOOSTS`. Each one can be picked **3 times**, and different Natures can be stacked.

| Id | Name | Each pick |
|---|---|---|
| brave | Brave | +25% damage, −10% move speed |
| timid | Timid | +15% move speed and +25% pickup radius, −10% damage |
| bold | Bold | +40 max HP, −10% damage |
| hasty | Hasty | −15% cooldown, −20 max HP |

**Filler:** Vitality (+20 max HP) and Magnet (+25% pickup radius) stay, uncapped. They appear only when the pool has fewer than 3 cards. The Potion and Power Surge fallbacks are unchanged.

## Architecture
- **`src/data/techniques.ts`:**
  - `TechniqueId`, `TECHNIQUES` (name, description per rank, `requiresAny` tags, per-rank values)
  - `MAX_TECHNIQUE_SLOTS = 5`, `MAX_TECHNIQUE_RANK = 3`
- **`src/data/upgrades.ts`:**
  - `BOOSTS` becomes `NATURES` plus `FILLER_BOOSTS`
  - `ModifierDelta` may hold negative values
  - stat aggregation clamps each final stat to a sane minimum: move speed and damage stay at least 50% of base, max HP at least 20
- **`src/sim/types.ts`:**
  - `Card` gains `{ kind: 'technique', techniqueId, rank }` and `{ kind: 'nature', natureId }`
  - `World` gains `techniques: { id, rank }[]` plus small per-technique state (Rollout timer, Moxie stacks, Endure cooldown, Rage timer, Focus Energy timers)
  - `boosts` is keyed by nature and filler ids
- **`src/sim/techniques.ts`:**
  - reacts to the existing `emit` events (`kill`, `hitTaken`, `levelUp`…)
  - adds one per-step update for the timers
  - adds damage and crit multipliers read by `damageEnemy`
  - adds the event it needs that does not exist yet: XP pickup
  - no Phaser imports
- **`src/sim/progression.ts`:**
  - `buildCardPool` adds Technique cards (new and rank-up, tag-filtered, slot cap) and Nature cards
  - the offer guarantees ≥ 1 Technique
  - `applyCard` handles the new kinds
- **`src/sim/buildSnapshot.ts`:**
  - saves Techniques and Natures
  - bump `BUILD_SNAPSHOT_VERSION`
- **`src/sim/balance.ts`:** the bot's pick logic covers the new card kinds.
- **`src/scenes/RunScene.ts`:** card art for Technique and Nature cards (rank shown as I–III), and a small HUD row of owned Techniques with their ranks.

## Testing (Vitest, seeded RNG)
- **Pool:**
  - tag-linked Techniques appear only with a matching move
  - slot cap: when slots are full, only rank-ups are offered
  - ≥ 1 Technique per offer while one is available
  - Nature cap of 3
  - filler only when the pool is short
- **Each Technique:** one focused test of its trigger and its rank values.
- **No proc-from-proc:** a spread burn, a poison puff or a Frostbite shatter triggers no Technique, Mutation or on-hit effect.
- **Endure:**
  - it saves a lethal hit exactly once per cooldown
  - it does not trigger on non-lethal hits
- **Natures:** the negative side applies, and the clamp holds after many picks.
- **Snapshot:** round-trip with Techniques and Natures.
- **Balance bot:** a 15-min run finishes, and pacing is recorded in `PROJECT_STATUS.md`.

## Out of scope (for now)
Techniques that upgrade on evolution, rarity tiers, changes to held items, Technique replacement, and more Natures.
