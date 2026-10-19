# Moveset design — Mutations

**Status:** APPROVED (owner, D15–D21, 2026-10-18). Being built in P4f (see `PROJECT_STATUS.md` for what exists). Numbers *(provisional)*; once built, `src/data/mutations.ts` is the truth.

## Folder layout
```
docs/moveset/
├─ README.md          ← this file: the rules every move and line follows
├─ INDEX.md           ← registry: every Mutation / ability tier with its stable ID
├─ shared/            ← one file per shared move: its base + GENERIC Mutations
│   ├─ water-gun.md      (any Pokémon that learns Water Gun gets these)
│   └─ …
└─ <pokemon>/         ← one folder per line: ability tree, signature tree, BOND Mutations
    └─ README.md
```
Adding a new Water line later (say Psyduck) means:
1. It reuses `shared/water-gun.md` as-is, so it gets the generic Mutations for free.
2. A new `psyduck/` folder adds **its own Bond** for Water Gun, tied to *its* ability.
3. Squirtle's Bonds never show up for Psyduck, and the reverse.

## Labels (stable IDs)
Every Mutation and ability tier has an ID, listed in [`INDEX.md`](INDEX.md) (the registry). Other systems use the
ID, never the display name, so names can change freely.
- **Mutation:** `<moveId>.<mutation>`, with `moveId` exactly as in `src/data/moves.ts`. E.g. `waterGun.slick`, `waterGun.steadyAim`.
- **Signature Mutation:** keyed on the line's **first** signature move, because it evolves with the line and keeps its ID.
  E.g. `bubble.trap` is still `bubble.trap` when the move is Hydro Cannon.
- **Ability tier:** `<abilityId>` for the base, `<abilityId>.<tier>` for an evolved tier, e.g. `shell`, `shell.tidalGuard`.
  Final traits keep their code IDs (`torrentPlus`, `rainDish`, `blazePlus`, `solarPower`).
- Each registry row also says **kind** (generic / bond / signature), **move**, **line**, **from stage** (0 = first stage)
  and **hook**. That's enough to filter "what can this player be offered right now".

## Where the numbers live (single source of truth)
The numbers in these docs are **first-pass design values**. Once a Mutation is built, its live numbers belong in **one**
data file, so a tuning change is one edit:
- `src/data/mutations.ts` (new), one entry per ID from `INDEX.md`, holding every number (cooldown multipliers, radii,
  chances, kill counts…). Sim hook functions read the entry; they never contain their own numbers.
- Existing tuning already works this way: moves in `src/data/moves.ts`, augments in `src/data/augments.ts`,
  Pokémon, abilities, enemies and global tuning (`TUNING`) in `src/data/content.ts`, waves in `src/data/waves.ts`.
- A unit test should check that every ID in `INDEX.md` exists in `mutations.ts` and vice versa, so the docs and the
  code can't drift apart on *which* Mutations exist.
- After a value is built, the code is the truth: when tuning changes, update the data file; the doc numbers are history.

## How Mutations are acquired — decided (D16, 2026-10-18)
- **Augment levels** give only stat / trade-off / behaviour augments (`src/data/augments.ts`). Never a Mutation.
- **Map sites**: randomly generated sites the player has to find by exploring. Each one rolls a **generic Mutation**,
  a **Bond Mutation** (signature Mutations count as Bonds), or an **item**.
- **Site mechanic (D23, built):** chunk-scattered rings; stand inside 5 s (8 s when the roll holds a Bond or signature
  Mutation); 5 cards. See `PROJECT.md` §9 and `src/sim/sites.ts`.
- The offer is drawn from `INDEX.md` (every Mutation row has `Pool = site`), filtered by:
  move owned · line (Bonds) · current stage ≥ from stage · requirements met · no Mutation already on that move
  (or offered as a replacement). The full implementer contract is in [`INDEX.md`](INDEX.md) → "For the implementer".

## Why
Stat augments (+damage, +area, −cooldown, +projectiles, +pierce) make a move *stronger*; they never make it
*different*. Pillar 4 needs two players with the same move to end up playing differently.
References: Deep Rock Galactic: Survivor's overclocks (weapon-specific mods that add mechanics,
in *clean* / *balanced* / *unstable* tiers), Halls of Torment's ability upgrades (two variants per ability that
change how it behaves), Hades' duo/legendary boons (capstones that reward committing to a combination).

## Two kinds of Mutation

| | **Generic Mutation** | **Bond Mutation** |
|---|---|---|
| Lives in | `shared/<move>.md` | `<pokemon>/README.md` |
| Offered to | any Pokémon that has the move | only that line (and only from the stage it names) |
| Talks to | the move itself + the shared Water terrain (puddles, Soaked) | the line's **ability and evolution stage** (Shell, Shell Burst, HP, Blastoise's cannons…) |
| Purpose | changes the move's verb | makes the move part of *this* Pokémon's playstyle |
| Card look | purple frame, "Mutation" | gold-and-type-colour frame, "Bond · Squirtle" |

### Rules (both kinds)
1. **One Mutation per move**, generic *or* Bond, never both. It sits in the move's own **Mutation slot**, not in an
   augment socket (D24): every move keeps 3 augment sockets. Picking another Mutation on the same move replaces the old
   one and **resets the rank to I** (D24). This is the hard cap on rule-changers.
2. **Ranks I → III (D24).** Rank I is the branch choice. Sites then offer rank-up cards for the Mutation you hold:
   rank II ≈ +15% DPS, rank III ≈ +30% over rank I (provisional), and rank III adds a small twist where one is natural.
   Each Mutation lists 2–3 **favoured augments** (shown gold, offered ×3 as often in that move's augment windows).
   The per-Mutation rank values and favoured augments are in [`RANKS.md`](RANKS.md).
3. **Every Mutation pays a cost**: cooldown, damage, range, a positional demand, or a condition.
4. **Rank I is power-neutral on the dummy.** With the balance bot, a mutated move at rank I must land within ±15% DPS
   of the same move with Power Up I instead (ranks II and III add power on top, rule 2). Bonds are measured with their condition true about half the time.
   A Mutation earns its socket through what it *does*, not raw damage.
5. **No proc-from-proc.** Anything a Mutation spawns (puddles, pops, waves, copies) does plain damage and its own listed
   status only. It never triggers augments, Lifesteal, Mutations or ability counters.
6. **Mutations never appear on augment-level cards** (D16): they come only from map sites. The D11 guaranteed card stays for behaviour augments and signature exclusives.

### Rules (Bond only)
7. **A Bond keys on the base ability and the stage, never on a final trait.** It may *pair* well with Torrent+ or
   Rain Dish, but it must still work with either trait, so the trait pick can't brick a card.
8. **A Bond is only offered once its hook exists.** E.g. a Bond that uses Shell Burst (Wartortle) never shows at Squirtle stage.
9. **Spread the hooks.** A line's Bonds must use different hooks (ability ready, ability triggers, getting hit, HP level,
   healing, stage), so no single build is "the" build.
10. **Signature Mutations are Bonds by nature** (the signature is line-only) and **evolve with the Pokémon**:
    a Mutation picked on Bubble gains a new behaviour at Water Pulse and again at Hydro Cannon. It keeps everything
    it had, the same way evolution only adds tags (§8.6).

## Shared Water terrain (generic, needs approval)
Any Water Mutation may create or use these, so every Water line shares them.
- **Puddle:** a 35 px water patch, lasts 4 s, pale blue circle. **Max 6 alive** across all sources; the oldest dries first.
- **Soaked:** standing in a puddle, or hit by a Mutation that says so, Soaks an enemy for 2 s:
  −25% move speed and **+50% stagger taken** (after weight resistance, D14).

## Shared Fire terrain (generic, needs approval)
Any Fire Mutation may create or use these, so every Fire line shares them.
- **Scorch:** a 35 px patch of burning ground, lasts 3 s, orange circle. **Max 6 alive** (separate cap from puddles).
- Enemies standing in Scorch are **Burned** (the existing burn status: 3 s, damage per second = 20% of the hit that
  made the patch). Burn ticks are typeless (§9) and never proc anything.
- *Idea for later, not proposed now:* a puddle meeting a Scorch patch turns into steam (Fire + Water combine flavour, §8.6).

## Crowd-control guard rails (all lines)
- **Stun fatigue:** after a stun, trap or slip ends, that enemy can't be stunned again for 1.5 s. Applies to **new effects only**
  (Mutations, Shell Burst, Flare Up, Discharge…); existing base moves and Static keep their behaviour (D21).
- **Slow cap:** slows don't stack; the strongest wins, max 70%.
- **Weight:** traps, slips and drags only work on enemies under 40 kg; heavier ones get a slow instead.
- **Bosses** (Snorlax, legendaries, Mewtwo) are immune to trap, slip and drag, and take half stagger.

## Is it buildable? (engine notes)
Yes, and it fits the current data shape:
- Mutations are their own `MutationDef` in `src/data/mutations.ts` (shape in `INDEX.md` → "For the implementer"), not an
  `AugmentDef` kind. A socket holds either a ranked augment or one Mutation.
- A one-Mutation-per-move check, like the existing "no duplicate augment" check.
- A small **ability event list** in the sim, using the `HookId` names in `INDEX.md` (`shellReady`, `shellBlock`, `hitTaken`,
  `shellBurst`, `hpBelow`…), that Bond hooks read. Abilities already live in the sim (`blockReadyLeft`), so this adds read access, not a rewrite.
- Each Mutation is one small, individually tested hook function (§8.8). It's real work: Squirtle alone is
  14 generic + 7 Bond + 3 signature behaviours. Suggested proof slice: 1 generic + 1 Bond on 2 moves first.

## Combined skills (§8.6) — open
A combined skill would inherit up to 4 Mutations. Proposal: the combo keeps only the base move's Mutation.
Needs a decision before P5.
