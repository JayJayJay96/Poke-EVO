# AGENTS.md — PokeSurvivorEVO

**Status:** Agent operating framework. The design lives in [`PROJECT.md`](PROJECT.md); progress lives in [`PROJECT_STATUS.md`](PROJECT_STATUS.md).

## Mission
Build the Pokémon survivor-like described in `PROJECT.md`, phase by phase (P1–P8). Every phase must end with a playable build and must answer its **gate question**. Keep `PROJECT_STATUS.md` a truthful handover between sessions. **Do not change game design without owner approval.**

## Authority and precedence
1. The latest **explicit owner decisions**, recorded in `PROJECT.md` §13, control the design.
2. `PROJECT.md` defines what must work. Anything marked *(provisional)* is a tuning value, not a decision.
3. `AGENTS.md` defines process.
4. `PROJECT_STATUS.md` records what exists and what is verified. It never overrides the design.

If documents conflict, stop and ask about that conflict. Never pick whichever reading is easiest to code.

## Before every coding session
1. Read `PROJECT.md`, `AGENTS.md` and `PROJECT_STATUS.md`.
2. Confirm the current phase and its gate question.
3. Plan only the current phase. Technical prerequisites may be added if needed and documented.
4. Never claim work exists unless files or tests prove it.

## Architecture principles
- TypeScript + Vite + Phaser, static browser build. No backend in MVP.
- **Simulation is pure TypeScript** (`src/sim/`): world state, movement, combat, spawning, augments. It does not import Phaser. It is unit-testable and runs on a fixed timestep.
- **Phaser is the presentation layer** (`src/scenes/`, `src/render/`): input, camera, drawing, audio. It reads sim state and sends input to it.
- **Content is data** (`src/data/`): Pokémon, moves, augments, enemies, waves and items are typed data, never hardcoded inside systems.
- Randomness goes through an injectable RNG so tests can seed it.
- Respect the performance budgets in `PROJECT.md` §11.1 from the moment the relevant system exists. Use pools rather than allocating per frame in hot paths.
- Prefer small modules over large files. Avoid heavy dependencies.
- No sprites, sounds or fonts are committed without a known licence. Grey boxes until P6. Credit SpriteCollab (CC BY-NC 4.0) if its assets are used.

## Design invariants
- PC browser, keyboard controls. A 15-minute run with a final boss at 15:00.
- All equipped moves auto-fire (D1).
- Evolution only **adds** tags to the signature move; it never removes them.
- 3 sockets per move. The same augment can't sit in two sockets; picking it again ranks it up to III.
- Every augment that adds projectiles pays for it with cooldown or damage (projectiles-per-second budget).
- No proc-from-proc.
- New Pokémon lines, moves and Mutations follow the Bond rules 11–19 and the kit review checklist in `docs/moveset/README.md` (D55). Use the `kit-design` project skill.
- Non-commercial fan project. No monetisation, ever.

## Scope discipline
- Build only the current phase. Don't start future-phase work because it's interesting.
- **Allowed without approval:** internal names, types, refactors that keep behaviour, test tooling, library choices inside the agreed stack, tuning values marked provisional.
- **Approval required:** pillars, run length, level/augment rhythm, socket counts, combine rules, evolution rules, adding or removing Pokémon lines, new systems, anything in §10 "OUT of MVP".
- Ask a focused question: the conflict, your recommendation and its trade-off. Record the answer in `PROJECT.md` §13 and in `PROJECT_STATUS.md`.

## Tests and verification (when relevant to the phase)
- Typecheck and production build.
- Vitest unit tests for the sim: movement, collisions, damage, XP/levels, augment pools and ranks, spawn director. Use seeded RNG.
- A browser check of the running build for anything visible.
- From P2 on: the stress-test scene, with FPS recorded.
- Never say tests passed unless they ran and passed. If something can't run, say exactly why and what is unverified.

## End-of-session protocol
Before ending every session, update `PROJECT_STATUS.md`:
1. Date, phase, objective, status.
2. Files added or changed, and what actually works.
3. Commands run and the **observed** results; checks not run.
4. Decisions obtained and pending.
5. Bugs, risks, technical debt.
6. The exact next task.
7. Whether the build still runs.

## Definition of done
A phase is done when its build is playable, its gate question has been answered in a playtest by the owner, its tests pass, and its status is recorded.
