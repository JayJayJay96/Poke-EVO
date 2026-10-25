---
name: kit-design
description: Use when designing or reviewing a Pokémon line, its moves, Mutations or Bonds for PokeSurvivor (new starter, new learnset move, Bond rework, kit review). Applies the D55 Bond rules and kit review checklist so new kits avoid the mistakes found in D50–D54.
---

# Kit design (PokeSurvivor)

The rules live in `docs/moveset/README.md`; read it first. This skill is the order to apply them.

## 1. Read before designing
- `docs/moveset/README.md`: Mutation rules 1–10, **D55 rules 11–19**, the **kit review checklist** and its reference rates.
- `docs/moveset/INDEX.md` (hook vocabulary, IDs), `RANKS.md`, and one existing line folder as a model (e.g. `docs/moveset/squirtle/README.md`).
- `PROJECT.md` §4 (kit template) and §13 (decisions D13–D55).

## 2. For every Bond, write these five lines in the proposal
1. **Trigger rate** while swarmed, from the reference rates (rule 11). Under one per ~10 s → make it a while-state Bond. No threshold-crossing re-arms (rule 12).
2. **Cost type**: permanent cost only for a permanent benefit (rule 13); a fading benefit fades its cost (rule 17).
3. **Spawned size** ≥ the move's own size (rule 14).
4. **Condition reach**: true about half the time in a horde for this line's sustain (rule 15). Bands, never "exactly full HP".
5. **Core job untouched**: the cost doesn't cut the status or role the move exists for (rule 16).

Ratio Bonds (rule 18): show the net multiplier vs the horde body and vs flankers. Heal / utility Bonds (rule 19): compare with the line's passive regen or existing utility.

## 3. For the whole line
- Horde clear: ≥ 2 crowd answers in each stage band (Lv 1–9, 10–24, 25+).
- Single target: ≥ 1 boss/Elite answer by the final stage.
- Spread the hooks (rule 9); every hook exists at the stage it's offered (rule 8).

## 4. Before claiming anything about existing behaviour
Read the code in `src/sim/mutationDefs/` and `src/sim/abilities.ts`. Numbers come from `src/data/` (single source of truth).

## 5. Approval
Design changes need the owner (AGENTS.md). Present the proposal with the five Bond lines per Bond, record the answer as a new D-number in `PROJECT.md` §13, then build with tests.
