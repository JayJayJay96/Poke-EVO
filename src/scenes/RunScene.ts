import Phaser from 'phaser';
import { AUGMENTS, MAX_SOCKETS, RANK_NUMERALS } from '../data/augments';
import { ABILITIES, ENEMIES, POKEMON, TUNING, type EnemyId, type PokemonId, type PokemonType } from '../data/content';
import { ENEMY_ATTACKS } from '../data/enemyAttacks';
import { ELITE_ABILITY, ELITE_ABILITY_NAMES } from '../data/hordes';
import { MOVES, type MoveId } from '../data/moves';
import { MUTATION_TUNING, MUTATIONS, type MutationDef, type MutationId } from '../data/mutations';
import { SITE_TUNING } from '../data/sites';
import { ARENA_BOSSES, ARENA_TUNING, MACHAMP_KIT, SNORLAX_KIT, ZAPDOS_KIT, type ArenaBossId, type ArenaEntranceKind } from '../data/arena';
import { crossArms } from '../sim/machamp';
import { chooseArenaReward, chooseCombine, skipCombine } from '../sim/arena';
import { angleGap, snoreOpenings } from '../sim/bosses';
import { bulbCapacity, hooksOf, tideFlood } from '../sim/hooks';
import { wispCount } from '../sim/mutationDefs/ember';
import { TECHNIQUES } from '../data/techniques';
import { BIG_BOOST, BOOSTS, ITEMS, POTION_HEAL } from '../data/upgrades';
import { bossImmune, isAbilityActive } from '../sim/combat';
import { chooseEvolutionTrait, dismissEvolution, finishEvolutionCinematic } from '../sim/evolution';
import { beamLength } from '../sim/forms/beam';
import { ARC_SECONDS, BLAST_SECONDS } from '../sim/forms/projectile';
import type { RunSceneData } from './SelectScene';
import { orbitBalls } from '../sim/forms/orbit';
import {
  canReroll,
  backFromReplace,
  backToSkills,
  chooseAugment,
  chooseReplace,
  chooseCard,
  chooseSkill,
  isFavoured,
  rerollAugments,
  resolvingLevel,
  xpToNext,
} from '../sim/progression';
import {
  grantMutation,
  isMutationId,
  socketsUsed,
} from '../sim/mutations';
import { createRandomSeed, createSeededRng } from '../sim/rng';
import { chooseSiteCard, isBoundCard, skipSite } from '../sim/sites';
import { currentStage } from '../sim/stats';
import { setupMutationStress, setupStress, topUpStress } from '../sim/stress';
import type { ArenaFight, AugmentCard, Card, Enemy, EvolutionState, InputState, LevelUpOffer, MachampState, MoveSlot, RewardCard, SiteCard, World, ZapdosState } from '../sim/types';
import { createWorld, runClock, step } from '../sim/world';
import { PauseOverlay } from '../ui/pauseOverlay';
import { TYPE_COLORS, augmentLabel, mutationLabel } from '../ui/labels';

// Grey-box colours until real sprites arrive in P6.
const COLORS = {
  grid: 0x26331f,
  player: 0xff7a2f,
  flash: 0xffffff,
  projectile: 0xffb347,
  orbit: 0xff5a1f,
  beam: 0x7b5cff,
  swing: 0xffffff,
  hpBack: 0x3a1e1e,
  hpFill: 0x4cd964,
  gem: 0x5ad1ff,
  bigGem: 0x5dff8a,
  xpBack: 0x10202a,
  xpFill: 0x5ad1ff,
  cardBg: 0x1c2233,
  augment: 0xffd34d,
  blaze: 0xff3b30,
  crater: 0xff6a00,
  blast: 0xffd27f,
  poison: 0xb05cff,
  slow: 0x8fd8ff,
  stun: 0xffe84d,
  superEffective: 0xfff200,
  notVery: 0x7a7a7a,
  seed: 0x4cd964,
  berry: 0x2f7ff5,
  magnet: 0xff4d4d,
  /** Arena events (D28). */
  entrance: 0x2a1d14,
  entranceRim: 0xb08a5a,
  arenaWall: 0xd9b27a,
  bossBar: 0xff5a5a,
  /** Boss attack telegraphs (B1-3). */
  telegraph: 0xff3b3b,
  rubble: 0x7d7468,
  snore: 0xb9c7ff,
  yawn: 0xf0a0ff,
  hyperBeam: 0xfff3c4,
  gas: 0x9be36b,
  chain: 0xb8b8c8,
  shield: 0xffffff,
  zap: 0xffe14d,
  elite: 0xffb300,
  dart: 0xd9a066,
  web: 0xe8e8e8,
  psychic: 0xf85888,
  water: 0x3d8bff,
  shock: 0xc8f0ff,
  rain: 0x4a7fd4,
  safe: 0x6ee07a,
  exclusive: 0xff8c42,
  /** Mutation frames: purple for generic, gold for Bond / signature (docs/moveset/README.md). */
  mutation: 0xb46cff,
  puddle: 0x9fd8ff,
  smoke: 0x9a9a9a,
  bulbFull: 0xff7ad9,
  cheek: 0xff3030,
  bond: 0xffc83d,
  /** Favoured augment cards (D24). */
  favoured: 0xffb000,
  /** A Mutation Site before its roll is known. */
  site: 0x8fe3ff,
} as const;
const ENEMY_COLORS: Readonly<Record<EnemyId, number>> = {
  machamp: 0x7a8fa6,
  focusOrb: 0x7fd4ff,
  rattata: 0x9b6bc8,
  pidgey: 0xc8a165,
  raticate: 0x8a5a2b,
  spearow: 0xb5764a,
  fearow: 0xd9a066,
  tauros: 0x6e4a2e,
  snorlax: 0x2f5d6e,
  zapdos: 0xf2d13a,
  pylon: 0x8c8f99,
  caterpie: 0x7cc142,
  weedle: 0xc9a23a,
  zubat: 0x4a6fb5,
  oddish: 0x3f6fb0,
  psyduck: 0xf2d35a,
  geodude: 0x8a7f6a,
  gastly: 0x3a2f55,
  abra: 0xd6a83a,
  voltorb: 0xd8433a,
  chansey: 0xf2a6c0,
};
/** Gems worth at least this much draw bigger and green. */
const BIG_GEM_VALUE = 5;
const GRID_SIZE = 64;
/** Cap on simulated time per frame so a hitch never fast-forwards the run. */
const MAX_FRAME_SECONDS = 0.25;
/** How long the signature tier-up notice stays (ms). */
const TIER_NOTICE_MS = 3000;
const CARD_MAX_W = 210;
const CARD_H = 170;
const CARD_GAP = 16;
/** Ignore card keys briefly after a window opens so a held key can't pick blindly. */
const CARD_INPUT_DELAY_MS = 250;
/** How often the perf readout refreshes. */
const PERF_REFRESH_MS = 250;
/** Smoothing for the per-frame timing averages. */
const PERF_EMA = 0.1;
/** Evolution cinematic length (D10: ~2 s). */
const EVOLUTION_CINEMATIC_MS = 5000;
/** The cinematic can be skipped (Enter / Space / 1 / click) after this long (D11). */
const EVOLUTION_SKIP_AFTER_MS = 2000;
/** How long a damage number floats above the player. */
const FLOATER_SECONDS = 0.8;
/** Share of the cinematic spent on "is evolving!" before the reveal line. */
const EVOLUTION_REVEAL_AT = 0.8;

const NUMBER_KEYS = ['one', 'two', 'three', 'four', 'five'] as const;
type KeyName =
  | 'up'
  | 'down'
  | 'left'
  | 'right'
  | 'w'
  | 'a'
  | 's'
  | 'd'
  | 'restart'
  | 'change'
  | 'pause'
  | 'confirm'
  | 'space'
  | (typeof NUMBER_KEYS)[number];
type Keys = Record<KeyName, Phaser.Input.Keyboard.Key>;

interface CardView {
  heading: string;
  title: string;
  body: string;
  color: number;
}

export class RunScene extends Phaser.Scene {
  private world!: World;
  private keys!: Keys;
  private gfx!: Phaser.GameObjects.Graphics;
  private hudGfx!: Phaser.GameObjects.Graphics;
  private hud!: Phaser.GameObjects.Text;
  private banner!: Phaser.GameObjects.Text;
  /** Non-evolver signature tier-up notice (Lapras) and when it hides. */
  private tierText!: Phaser.GameObjects.Text;
  private tierTextUntil = 0;
  /** A one-off notice for the next frame (debug Mutation grants). */
  private pendingNotice: string | null = null;
  /** Sites whose Pokémon-bound roll has been announced. */
  private announcedSites = new Set<number>();
  private panel!: Phaser.GameObjects.Text;
  /** Draws above the overlay dim: the evolving player during the cinematic. */
  private fxGfx!: Phaser.GameObjects.Graphics;
  private overlay: Phaser.GameObjects.GameObject[] = [];
  /** What the open window shows; it is rebuilt whenever this key changes. */
  private overlayKey: LevelUpOffer | string | null = null;
  private overlayOpenedAt = 0;
  private evoText: Phaser.GameObjects.Text | null = null;
  private evoStartedAt = 0;
  /** A click on the cinematic asks to skip (honoured after EVOLUTION_SKIP_AFTER_MS). */
  private skipRequested = false;
  /** Red HUD line while a "damage taken" trade-off is active (D12). */
  private warnText!: Phaser.GameObjects.Text;
  /** Banked level-ups badge (owner 2026-10-23): click or Space opens them. */
  private levelBadge!: Phaser.GameObjects.Text;
  /** Floating red damage numbers on the player (D12). */
  private floaters: { text: Phaser.GameObjects.Text; lifeLeft: number; y: number }[] = [];
  private lastHp = 0;
  private accumulator = 0;
  private paused = false;
  /** The Esc pause screen, an HTML overlay (owner 2026-10-24). */
  private pauseOverlay!: PauseOverlay;
  /** `?stress=1`: maxed build vs 500 enemies (P2d budget check); `?stress=<line>`: that line's maxed Mutations (P4f-8). */
  private stress = false;
  private perfText: Phaser.GameObjects.Text | null = null;
  private simMs = 0;
  private drawMs = 0;
  private perfShownAt = 0;

  /** The line chosen on the select screen; kept for R (restart). */
  private pokemonId: PokemonId = 'charmander';

  constructor() {
    super('run');
  }

  init(data: Partial<RunSceneData>): void {
    this.pokemonId = data.pokemonId ?? 'charmander';
  }

  create(): void {
    this.world = createWorld({
      rng: createSeededRng(createRandomSeed()),
      pokemonId: this.pokemonId,
      mapSeed: createRandomSeed(),
    });
    this.announcedSites = new Set();
    if (import.meta.env.DEV) {
      // Dev-only handle for browser checks; stripped from production builds.
      (window as unknown as { __world?: World }).__world = this.world;
    }
    this.accumulator = 0;
    this.paused = false;
    this.pauseOverlay = new PauseOverlay({
      resume: () => {
        this.paused = false;
      },
      restart: () => this.scene.restart({ pokemonId: this.pokemonId } satisfies RunSceneData),
      giveUp: () => this.scene.start('select'),
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.pauseOverlay.hide());
    this.overlay = [];
    this.overlayKey = null;
    this.evoText = null;

    const params = new URLSearchParams(window.location.search);
    this.stress = params.has('stress');
    if (this.stress) {
      const cam = this.cameras.main;
      this.world.spawnRadius = Math.hypot(cam.width, cam.height) / 2 + TUNING.spawn.ringPadding;
      if (params.get('stress') === this.world.player.pokemonId) setupMutationStress(this.world);
      else setupStress(this.world);
    }
    this.perfText =
      this.stress || params.has('perf')
        ? this.add
            .text(0, 14, '', {
              fontFamily: 'monospace',
              fontSize: '14px',
              color: '#7CFC00',
              backgroundColor: '#000000aa',
              padding: { x: 6, y: 4 },
              align: 'right',
            })
            .setOrigin(1, 0)
            .setScrollFactor(0)
            .setDepth(40)
        : null;

    this.keys = this.input.keyboard!.addKeys({
      up: 'UP',
      down: 'DOWN',
      left: 'LEFT',
      right: 'RIGHT',
      w: 'W',
      a: 'A',
      s: 'S',
      d: 'D',
      restart: 'R',
      change: 'C',
      pause: 'ESC',
      confirm: 'ENTER',
      space: 'SPACE',
      one: 'ONE',
      two: 'TWO',
      three: 'THREE',
      four: 'FOUR',
      five: 'FIVE',
    }) as Keys;

    this.gfx = this.add.graphics();
    this.fxGfx = this.add.graphics().setDepth(31);
    this.hudGfx = this.add.graphics().setScrollFactor(0).setDepth(9);
    this.hud = this.add
      .text(16, 14, '', { fontFamily: 'monospace', fontSize: '16px', color: '#ffffff', lineSpacing: 4 })
      .setScrollFactor(0)
      .setDepth(10);
    this.warnText = this.add
      .text(16, 58, '', { fontFamily: 'monospace', fontSize: '14px', color: '#ff6b6b' })
      .setScrollFactor(0)
      .setDepth(10);
    this.levelBadge = this.add
      .text(this.cameras.main.width / 2, 40, '', {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: '#1a1206',
        fontStyle: 'bold',
        backgroundColor: '#ffd34d',
        padding: { x: 10, y: 4 },
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(15)
      .setVisible(false)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        this.world.openLevelUps = true;
      });
    this.tierText = this.add
      .text(this.cameras.main.width / 2, 96, '', {
        fontFamily: 'monospace',
        fontSize: '18px',
        color: '#9ff3ff',
        fontStyle: 'bold',
        backgroundColor: '#000000aa',
        padding: { x: 14, y: 8 },
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(15)
      .setVisible(false);
    this.floaters = [];
    this.lastHp = this.world.player.hp;
    // Debug Mutation grant until map sites exist (D16): ?mutate=waterGun.slick,withdraw.counterShell
    for (const id of params.get('mutate')?.split(',') ?? []) this.debugGrant(id.trim());
    if (import.meta.env.DEV) {
      (window as unknown as { __grantMutation?: (id: string) => string }).__grantMutation = (id) => this.debugGrant(id);
    }
    this.banner = this.add
      .text(0, 0, '', {
        fontFamily: 'monospace',
        fontSize: '26px',
        color: '#ffffff',
        align: 'center',
        backgroundColor: '#000000aa',
        padding: { x: 24, y: 16 },
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(20)
      .setVisible(false);
    this.panel = this.add
      .text(0, 0, '', {
        fontFamily: 'monospace',
        fontSize: '15px',
        color: '#ffffff',
        backgroundColor: '#000000cc',
        padding: { x: 20, y: 14 },
        lineSpacing: 4,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(20)
      .setVisible(false);
  }

  update(time: number, deltaMs: number): void {
    const { JustDown } = Phaser.Input.Keyboard;
    const { world } = this;
    const offer = world.status === 'running' ? world.offer : null;
    const evolution = world.status === 'running' ? world.evolution : null;

    if (evolution?.phase === 'cinematic') {
      // The timer starts when the cinematic window opens (syncOverlay sets evoStartedAt).
      if (this.overlayKey === evolutionKey(evolution)) {
        const elapsed = time - this.evoStartedAt;
        const k = this.keys;
        const skip = JustDown(k.confirm) || JustDown(k.space) || JustDown(k.one) || this.skipRequested;
        this.skipRequested = false;
        // D11: 5 s cinematic, skippable after 2 s.
        if (elapsed >= EVOLUTION_CINEMATIC_MS || (skip && elapsed >= EVOLUTION_SKIP_AFTER_MS)) {
          finishEvolutionCinematic(world);
        }
      }
    } else if (evolution?.phase === 'summary') {
      if (time - this.overlayOpenedAt >= CARD_INPUT_DELAY_MS) {
        const k = this.keys;
        if (evolution.traitChoices) {
          if (JustDown(k.one)) chooseEvolutionTrait(world, 0);
          else if (JustDown(k.two)) chooseEvolutionTrait(world, 1);
        } else if (JustDown(k.confirm) || JustDown(k.space) || JustDown(k.one)) {
          dismissEvolution(world);
        }
      }
    } else if (offer) {
      if (time - this.overlayOpenedAt >= CARD_INPUT_DELAY_MS) {
        const pressed = NUMBER_KEYS.findIndex((name) => JustDown(this.keys[name]));
        if (pressed >= 0) this.pick(pressed);
        else if (JustDown(this.keys.restart) && offer.kind === 'augment') rerollAugments(world);
        else if (JustDown(this.keys.pause)) {
          if (offer.kind === 'replace') backFromReplace(world);
          else if (offer.kind === 'augment') backToSkills(world);
          else if (offer.kind === 'site') skipSite(world);
          else if (offer.kind === 'combine') skipCombine(world);
        }
      }
    } else if (JustDown(this.keys.restart) && world.status !== 'running') {
      this.scene.restart({ pokemonId: this.pokemonId } satisfies RunSceneData);
      return;
    } else if (JustDown(this.keys.change) && world.status !== 'running') {
      this.scene.start('select');
      return;
    } else if (JustDown(this.keys.space) && world.status === 'running' && world.pendingLevelUps > 0) {
      world.openLevelUps = true; // opens the bank on the next step
    } else if (JustDown(this.keys.pause) && world.status === 'running') {
      this.paused = !this.paused;
    }
    // The Esc pause screen is an HTML overlay; it is built once on open (the sim is frozen while it shows).
    const showPause = this.paused && world.status === 'running' && !world.offer && !world.evolution;
    if (showPause && !this.pauseOverlay.open) this.pauseOverlay.show(world);
    else if (!showPause && this.pauseOverlay.open) this.pauseOverlay.hide();

    const cam = this.cameras.main;
    world.spawnRadius = Math.hypot(cam.width, cam.height) / 2 + TUNING.spawn.ringPadding;

    if (this.stress) topUpStress(world);

    const simStart = performance.now();
    if (!this.paused && !world.offer && !world.evolution) {
      this.accumulator += Math.min(deltaMs / 1000, MAX_FRAME_SECONDS);
      const input = this.readInput();
      while (this.accumulator >= TUNING.stepSeconds && !world.offer && !world.evolution) {
        step(world, input, TUNING.stepSeconds);
        this.accumulator -= TUNING.stepSeconds;
      }
    }
    // Don't bank time while a window is open.
    if (world.offer || world.evolution) this.accumulator = 0;
    const drawStart = performance.now();

    this.trackPlayerDamage(deltaMs);
    this.announceBoundSites();
    this.announceArena();
    this.showSignatureTierUp(time);
    this.syncOverlay(time);
    this.draw();

    this.updatePerf(time, drawStart - simStart, performance.now() - drawStart);
  }

  /** A triangle at the screen edge pointing at an off-screen target (dx, dy from the player). */
  private edgeArrow(dx: number, dy: number, radius: number, color: number): void {
    const cam = this.cameras.main;
    const halfW = cam.width / 2;
    const halfH = cam.height / 2;
    const dist = Math.hypot(dx, dy);
    if (dist === 0) return;
    if (Math.abs(dx) < halfW + radius && Math.abs(dy) < halfH + radius) return; // on screen
    const pad = 26;
    const s = Math.min((halfW - pad) / Math.max(Math.abs(dx), 1e-6), (halfH - pad) / Math.max(Math.abs(dy), 1e-6));
    const ax = halfW + dx * s;
    const ay = halfH + dy * s;
    const ux = dx / dist;
    const uy = dy / dist;
    this.hudGfx.fillStyle(color, 0.95);
    this.hudGfx.fillTriangle(ax + ux * 14, ay + uy * 14, ax - ux * 7 - uy * 9, ay - uy * 7 + ux * 9, ax - ux * 7 + uy * 9, ay - uy * 7 - ux * 9);
  }

  /** The banked level-ups badge: how many, and when they open on their own (owner 2026-10-23). */
  private updateLevelBadge(): void {
    const { pendingLevelUps: n, offer, evolution, status, arena, levelUpWait } = this.world;
    const show = n > 0 && !offer && !evolution && status === 'running';
    this.levelBadge.setVisible(show);
    if (!show) return;
    const { autoOpenSeconds } = TUNING.levelUpBank;
    const when = arena ? 'after the fight' : `auto in ${Math.max(0, Math.ceil(autoOpenSeconds - levelUpWait))} s`;
    this.levelBadge.setText(`LEVEL UP ×${n} · Space (${when})`).setX(this.cameras.main.width / 2);
  }

  /** The arena line under the HUD: the entrance countdown, or the fight's state and timer (D28). */
  private arenaHudLine(): string {
    const { arena, entrance, time } = this.world;
    if (arena) {
      const boss = bossName(arena.bossId);
      if (!arena.engaged) return `Walk to the middle: ${boss} is waiting`;
      const enemy = this.world.enemies.find((e) => e.id === arena.bossEnemyId);
      const wake = arena.rest && enemy ? Math.min(100, Math.round((arena.rest.wake / (enemy.maxHp * SNORLAX_KIT.rest.wakeAtPct)) * 100)) : null;
      const zap = arena.zap;
      const up = zap ? zap.pylons.filter((p) => p.enemyId !== null).length : 0;
      const stop = zap?.discharge?.phase === 'channel' && enemy ? Math.min(100, Math.round((zap.discharge.taken / (enemy.maxHp * ZAPDOS_KIT.discharge.interruptPct)) * 100)) : null;
      const extra =
        (wake === null ? '' : ` · asleep, wake ${wake}%`) +
        (up > 0 ? ` · shielded by ${up} generator${up > 1 ? 's' : ''}` : '') +
        (stop === null ? '' : ` · Discharge! interrupt ${stop}%`) +
        (zap && zap.overloadLeft > 0 ? ` · Overloaded ${Math.ceil(zap.overloadLeft)} s` : '') +
        (zap && zap.overloadLeft <= 0 && zap.weakLeft > 0 ? ` · Weakened ${Math.ceil(zap.weakLeft)} s` : '') +
        (arena.champ && enemy ? machampHud(arena.champ, enemy) : '');
      return `${boss}: ${formatTime(arena.timeLeft)} left${extra}`;
    }
    if (entrance) {
      return `${ENTRANCE_NAMES[ARENA_BOSSES[entrance.bossId].entrance]} is open: ${formatTime(entrance.closesAt - time)}`;
    }
    // A horde on its way (D34): who leads it and with which ability.
    const warning = this.world.hordeWarning;
    if (warning) {
      const ability = ELITE_ABILITY[warning.leader];
      const named = ability ? ` (${ELITE_ABILITY_NAMES[ability]})` : '';
      return `A horde led by Elite ${ENEMIES[warning.leader].name}${named} is coming!`;
    }
    return '';
  }

  /** D28: arena news (an entrance opened or closed, the fight won or lost) as a short notice. */
  private announceArena(): void {
    const notice = this.world.arenaNotice;
    if (!notice) return;
    this.world.arenaNotice = null;
    const boss = bossName(notice.bossId);
    const entrance = ENTRANCE_NAMES[ARENA_BOSSES[notice.bossId].entrance];
    const message = {
      opened: `${entrance} opened nearby! ${boss} waits inside. ${ARENA_TUNING.openSeconds} s to enter`,
      missed: `The ${entrance.toLowerCase().replace(/^an? /, '')} closed. ${boss} is gone`,
      won: `${boss} defeated!`,
      lost: `Time's up! ${boss} drove you out`,
      knockedOut: `${boss} knocked you out of the arena!`,
      rest: `${boss} fell asleep and is healing! Hit it hard to wake it`,
      woke: `${boss} woke up!`,
      bellyDrum: `${boss} used Belly Drum! Half its HP, double its power`,
      chargeUp: `${boss} charges the sky! Thunderstorms and fences incoming`,
      rainDance: `${boss} used Rain Dance! Puddles conduct its Thunder`,
      overloaded: `${boss} is Overloaded! It takes extra damage. Hit it now`,
      focusEnergy: `${boss} used Focus Energy! Bullet Punch, Dynamic Punch and Focus Blast incoming`,
      noGuard: `${boss} takes the No Guard stance! Focus Punch and Close Combat incoming`,
    }[notice.kind];
    this.pendingNotice = this.pendingNotice ? `${this.pendingNotice}\n${message}` : message;
  }

  /** D23: stepping into a site whose roll holds a Bond or signature Mutation says so (and why it takes longer). */
  private announceBoundSites(): void {
    for (const site of this.world.sites) {
      if (!site.bound || this.announcedSites.has(site.id)) continue;
      this.announcedSites.add(site.id);
      const name = currentStage(this.world).name;
      const message = `Something bound to ${name} is inside! Hold ${site.required} s`;
      this.pendingNotice = this.pendingNotice ? `${this.pendingNotice}\n${message}` : message;
    }
  }

  /** Lapras's signature tiers up by level instead of evolving: a short notice says so. Also debug grants. */
  private showSignatureTierUp(time: number): void {
    const up = this.world.signatureTierUp;
    const message = up ? `${MOVES[up.from].name} → ${MOVES[up.to].name}!` : this.pendingNotice;
    if (message) {
      this.world.signatureTierUp = null;
      this.pendingNotice = null;
      this.tierText.setText(message).setVisible(true);
      this.tierTextUntil = time + TIER_NOTICE_MS;
    } else if (this.tierText.visible && time > this.tierTextUntil) {
      this.tierText.setVisible(false);
    }
  }

  /** FPS, sim and draw cost per frame, and entity counts (with `?stress=1` or `?perf=1`). */
  private updatePerf(time: number, simMs: number, drawMs: number): void {
    if (!this.perfText) return;
    this.simMs += (simMs - this.simMs) * PERF_EMA;
    this.drawMs += (drawMs - this.drawMs) * PERF_EMA;
    if (time - this.perfShownAt < PERF_REFRESH_MS) return;
    this.perfShownAt = time;
    const { world } = this;
    const fps = this.game.loop.actualFps;
    const stats = {
      fps: Math.round(fps),
      simMs: +this.simMs.toFixed(2),
      drawMs: +this.drawMs.toFixed(2),
      enemies: world.enemies.length,
      projectiles: world.projectiles.length,
      gems: world.gems.length,
      pool: world.projectilePool.length,
    };
    if (import.meta.env.DEV) (window as unknown as { __perf?: typeof stats }).__perf = stats;
    this.perfText
      .setText(
        `${this.stress ? 'STRESS  ' : ''}FPS ${stats.fps}\n` +
          // draw-cmd = building Graphics commands only; GPU rendering shows up in FPS.
          `sim ${stats.simMs.toFixed(2)} ms · draw-cmd ${stats.drawMs.toFixed(2)} ms\n` +
          `enemies ${stats.enemies} · proj ${stats.projectiles} · gems ${stats.gems}`,
      )
      .setX(this.cameras.main.width - 12);
  }

  /**
   * Floating red numbers when the player takes a hit (D12), tagged with Glass when a
   * damage-taken trade-off made it bigger. Ignores Solar Power's slow drain.
   */
  private trackPlayerDamage(deltaMs: number): void {
    const { player, mods } = this.world;
    const lost = this.lastHp - player.hp;
    this.lastHp = player.hp;
    if (lost >= 0.5) {
      const glass = mods.damageTakenMult > 1.001;
      const label = `-${Math.round(lost)}${glass ? ` (Glass +${Math.round((mods.damageTakenMult - 1) * 100)}%)` : ''}`;
      const y = player.y - player.radius - 16;
      const text = this.add
        .text(player.x, y, label, { fontFamily: 'monospace', fontSize: '14px', color: '#ff4d4d', fontStyle: 'bold' })
        .setOrigin(0.5, 1)
        .setDepth(12);
      this.floaters.push({ text, lifeLeft: FLOATER_SECONDS, y });
    }
    const dt = deltaMs / 1000;
    for (const f of this.floaters) {
      f.lifeLeft -= dt;
      const t = 1 - f.lifeLeft / FLOATER_SECONDS;
      f.text.setY(f.y - 22 * t).setAlpha(Math.max(0, f.lifeLeft / FLOATER_SECONDS));
      if (f.lifeLeft <= 0) f.text.destroy();
    }
    this.floaters = this.floaters.filter((f) => f.lifeLeft > 0);
  }

  /** Routes a card pick to the right action for the open window. */
  private pick(index: number): void {
    const offer = this.world.offer;
    if (!offer) return;
    if (offer.kind === 'cards') chooseCard(this.world, index);
    else if (offer.kind === 'pickSkill') chooseSkill(this.world, index);
    // Augment window: the card after the augments is Back to move selection (D12).
    else if (offer.kind === 'augment') {
      if (index === offer.cards.length) backToSkills(this.world);
      else chooseAugment(this.world, index);
    }
    // Replace windows: cards 1–3 are the sockets, card 4 is Back / Cancel.
    else if (offer.kind === 'replace') {
      if (index < MAX_SOCKETS) chooseReplace(this.world, index);
      else backFromReplace(this.world);
    } else if (offer.kind === 'site') {
      if (index < offer.cards.length) this.siteNotice(chooseSiteCard(this.world, index), offer.cards[index]!);
      else skipSite(this.world);
    } else if (offer.kind === 'combine') chooseCombine(this.world, index);
    else if (offer.kind === 'arenaReward') chooseArenaReward(this.world, index);
  }

  /** Says what a site card did when it isn't obvious (a Mutation that couldn't be placed). */
  private siteNotice(result: ReturnType<typeof chooseSiteCard>, card: SiteCard): void {
    if ((card.kind !== 'mutation' && card.kind !== 'mutationRank') || result === 'granted' || result === 'rankUp') return;
    this.pendingNotice = `Couldn't place ${MUTATIONS[card.mutationId].name}: ${result}`;
  }

  /** Debug grant (`?mutate=` or dev `__grantMutation`): grants a Mutation by ID and says what happened. */
  private debugGrant(id: string): string {
    const result = isMutationId(id) ? grantMutation(this.world, id) : 'unknownId';
    const label = isMutationId(id) ? mutationLabel(id) : id;
    const message =
      result === 'granted' ? `Mutation: ${label}` : result === 'rankUp' ? `${label}: rank up` : `Can't grant ${label}: ${result}`;
    if (result !== 'granted' && result !== 'rankUp') console.warn(`[mutate] ${message}`);
    this.pendingNotice = this.pendingNotice ? `${this.pendingNotice}\n${message}` : message;
    return result;
  }

  private readInput(): InputState {
    const k = this.keys;
    const right = k.right.isDown || k.d.isDown ? 1 : 0;
    const left = k.left.isDown || k.a.isDown ? 1 : 0;
    const down = k.down.isDown || k.s.isDown ? 1 : 0;
    const up = k.up.isDown || k.w.isDown ? 1 : 0;
    return { moveX: right - left, moveY: down - up };
  }

  /** Builds or tears down the open window (evolution or level-up) to match the sim. */
  private syncOverlay(time: number): void {
    const running = this.world.status === 'running';
    const evolution = running ? this.world.evolution : null;
    const offer = running ? this.world.offer : null;
    const key = evolution ? evolutionKey(evolution) : offer;
    if (key === this.overlayKey) return;
    for (const obj of this.overlay) obj.destroy();
    this.overlay = [];
    this.evoText = null;
    this.overlayKey = key;
    this.overlayOpenedAt = time;
    if (evolution) {
      if (evolution.phase === 'cinematic') {
        this.evoStartedAt = time;
        this.buildEvolutionCinematic(evolution);
      } else {
        this.buildEvolutionSummary(evolution);
      }
      return;
    }
    if (!offer) return;

    const { world } = this;
    // Several level-ups can queue; label the one being resolved, not the current level.
    const level = resolvingLevel(world);
    let title: string;
    let frame: number | undefined;
    let views: CardView[];
    let footer = '';
    let footerAction: (() => void) | null = null;
    switch (offer.kind) {
      case 'cards':
        title = `Level ${level}!  Pick one`;
        views = offer.cards.map((card) => describeCard(world, card));
        break;
      case 'pickSkill':
        title = `AUGMENT LEVEL ${level}!  Choose a move`;
        frame = COLORS.augment;
        views = offer.slots.map((i) => describeSkill(world.moves[i]!));
        break;
      case 'augment': {
        const slot = world.moves[offer.slot]!;
        title = `Augment ${MOVES[slot.moveId].name}`;
        frame = COLORS.augment;
        views = offer.cards.map((card) => describeAugment(card, isFavoured(world, offer.slot, card.augmentId) ? slot.mutation : null));
        views.push({ heading: 'BACK', title: 'Other move', body: 'Back to choosing a move (Esc).\nSame cards if you return.', color: 0x888888 });
        footer = canReroll(world)
          ? `[R] Reroll (${world.rerollsLeft} left)`
          : `Reroll unavailable (${world.rerollsLeft} left)`;
        if (canReroll(world)) footerAction = () => rerollAugments(this.world);
        if (socketsUsed(world.moves[offer.slot]!) >= MAX_SOCKETS) footer += '   ·   Sockets full: a new augment replaces one';
        break;
      }
      case 'replace': {
        const slot = world.moves[offer.slot]!;
        title = `${MOVES[slot.moveId].name}: replace which augment with ${augmentLabel(offer.card.augmentId, 1)}?`;
        frame = COLORS.augment;
        views = slot.sockets.map((socket) => ({
          heading: 'REPLACE',
          title: augmentLabel(socket.augmentId, socket.rank),
          body: `${AUGMENTS[socket.augmentId].ranks[socket.rank - 1]!.text}\n\n→ becomes ${augmentLabel(offer.card.augmentId, 1)}`,
          color: 0xff6b6b,
        }));
        views.push({ heading: 'BACK', title: 'Keep all', body: 'Back to the augment cards (Esc)', color: 0x888888 });
        break;
      }
      case 'site': {
        const bound = offer.cards.some(isBoundCard);
        title = 'Mutation Site!  Pick one';
        frame = bound ? COLORS.bond : COLORS.mutation;
        views = offer.cards.map((card) => describeSiteCard(world, card));
        footer = '[Esc] Skip: leave it (the site is used up)';
        footerAction = () => skipSite(this.world);
        break;
      }
      case 'combine':
        title = world.combo.length === 0 ? 'Combine: pick the base move' : 'Combine: absorb a move into the combo';
        frame = COLORS.bond;
        views = offer.slots.map((i) => ({
          ...describeSkill(world.moves[i]!),
          heading: world.combo.length === 0 ? 'COMBO BASE' : 'ABSORB',
        }));
        footer = world.combo.length === 0
          ? 'Members fire together on the average of their cooldowns  ·  [Esc] Skip'
          : 'Absorbed moves free their slot  ·  [Esc] Skip';
        footerAction = () => skipCombine(this.world);
        break;
      case 'arenaReward':
        title = offer.combineMissed ? 'Boss defeated! (no move with 3 augments to combine)  Pick one' : 'Boss defeated!  Pick one';
        frame = COLORS.bond;
        views = offer.cards.map((reward) => describeReward(world, reward));
        break;
    }

    const cam = this.cameras.main;
    const dim = this.add
      .rectangle(0, 0, cam.width, cam.height, 0x000000, 0.6)
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(30);
    this.overlay.push(dim);
    if (frame !== undefined) {
      const border = this.add
        .rectangle(4, 4, cam.width - 8, cam.height - 8)
        .setOrigin(0)
        .setStrokeStyle(4, frame)
        .setScrollFactor(0)
        .setDepth(30);
      this.overlay.push(border);
    }

    const n = views.length;
    const cardW = Math.min(CARD_MAX_W, (cam.width - 40 - (n - 1) * CARD_GAP) / n);
    const cardsTop = Math.max(44, cam.height / 2 - CARD_H / 2 + 10);
    const startX = cam.width / 2 - (n * cardW + (n - 1) * CARD_GAP) / 2;
    const heading = this.add
      .text(cam.width / 2, cardsTop - 12, `${title}   (keys 1–${n} or click)`, {
        fontFamily: 'monospace',
        fontSize: '19px',
        color: frame !== undefined ? '#ffd34d' : '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5, 1)
      .setScrollFactor(0)
      .setDepth(31);
    this.overlay.push(heading);

    views.forEach((view, i) => {
      const x = startX + i * (cardW + CARD_GAP);
      const bg = this.add
        .rectangle(x, cardsTop, cardW, CARD_H, COLORS.cardBg, 0.97)
        .setOrigin(0)
        .setStrokeStyle(2, view.color)
        .setScrollFactor(0)
        .setDepth(31)
        .setInteractive({ useHandCursor: true });
      bg.on('pointerdown', () => this.pick(i));
      const text = this.add
        .text(x + 10, cardsTop + 10, `[${i + 1}] ${view.heading}\n\n${view.title}\n\n${view.body}`, {
          fontFamily: 'monospace',
          fontSize: '13px',
          color: '#ffffff',
          lineSpacing: 2,
          wordWrap: { width: cardW - 20 },
        })
        .setScrollFactor(0)
        .setDepth(32);
      this.overlay.push(bg, text);
    });

    if (footer) {
      const foot = this.add
        .text(cam.width / 2, cardsTop + CARD_H + 14, footer, {
          fontFamily: 'monospace',
          fontSize: '15px',
          color: footerAction ? '#ffd34d' : '#888888',
        })
        .setOrigin(0.5, 0)
        .setScrollFactor(0)
        .setDepth(31);
      if (footerAction) foot.setInteractive({ useHandCursor: true }).on('pointerdown', footerAction);
      this.overlay.push(foot);
    }
  }

  private buildEvolutionCinematic(evolution: EvolutionState): void {
    const cam = this.cameras.main;
    const from = stageName(this.world, evolution.fromStage);
    const dim = this.add
      .rectangle(0, 0, cam.width, cam.height, 0x000000, 0.7)
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(30)
      .setInteractive();
    dim.on('pointerdown', () => {
      this.skipRequested = true;
    });
    this.evoText = this.add
      .text(cam.width / 2, Math.max(56, cam.height * 0.22), `What? ${from} is evolving!`, {
        fontFamily: 'monospace',
        fontSize: '24px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(32);
    const hint = this.add
      .text(cam.width / 2, cam.height - 18, `Skip after ${EVOLUTION_SKIP_AFTER_MS / 1000} s: Enter / Space / click`, {
        fontFamily: 'monospace',
        fontSize: '13px',
        color: '#888888',
      })
      .setOrigin(0.5, 1)
      .setScrollFactor(0)
      .setDepth(32);
    this.overlay.push(dim, this.evoText, hint);
  }

  private buildEvolutionSummary(evolution: EvolutionState): void {
    const cam = this.cameras.main;
    const { pokemonId } = this.world.player;
    const stages = POKEMON[pokemonId].stages;
    const from = stages[evolution.fromStage]!;
    const to = stages[evolution.toStage]!;
    const fromMove = MOVES[from.signatureMove];
    const toMove = MOVES[to.signatureMove];
    const newTags = toMove.tags.filter((tag) => !fromMove.tags.includes(tag));
    const dim = this.add
      .rectangle(0, 0, cam.width, cam.height, 0x000000, 0.6)
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(30);
    const lines = [
      `${from.name} evolved into ${to.name}!`,
      '',
      `Max HP     ${from.maxHp} → ${to.maxHp}`,
      `Speed      ${from.speed} → ${to.speed}`,
      `Damage     ×${from.damageMult.toFixed(2)} → ×${to.damageMult.toFixed(2)}`,
      `Size       ${from.radius} → ${to.radius}`,
      `Signature  ${fromMove.name} → ${toMove.name}`,
      `           ${toMove.description}`,
    ];
    if (newTags.length > 0) lines.push(`New tags   ${newTags.join(', ')}  (new augments unlocked)`);
    const newTypes = to.types.filter((type) => !from.types.includes(type));
    if (newTypes.length > 0) {
      lines.push(`Type       ${from.types.join('/')} → ${to.types.join('/')}  (new ${newTypes.join('/')} moves, STAB)`);
    }
    lines.push('', 'Augments carried over.');
    const choices = evolution.traitChoices;
    lines.push('', choices ? 'Choose a trait →  [1] or [2]' : '[Enter / Space / 1 / click] Continue');

    const cardX = choices ? cam.width * 0.36 : cam.width / 2;
    const card = this.add
      .text(cardX, cam.height / 2, lines.join('\n'), {
        fontFamily: 'monospace',
        fontSize: choices ? '14px' : '16px',
        color: '#ffffff',
        backgroundColor: '#1c2233',
        padding: { x: 20, y: 14 },
        lineSpacing: 3,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(32);
    if (!choices) {
      card.setInteractive({ useHandCursor: true }).on('pointerdown', () => dismissEvolution(this.world));
    }
    const border = this.add
      .rectangle(cardX, cam.height / 2, card.width + 6, card.height + 6)
      .setStrokeStyle(3, COLORS.augment)
      .setScrollFactor(0)
      .setDepth(31);
    this.overlay.push(dim, border, card);

    // Trait choice (D11): two clickable cards to the right of the summary.
    if (choices) {
      const traitW = Math.min(300, cam.width * 0.3);
      const traitH = 74;
      const x = cam.width * 0.72 - traitW / 2;
      choices.forEach((abilityId, i) => {
        const ability = ABILITIES[abilityId];
        const y = cam.height / 2 - traitH - 6 + i * (traitH + 12);
        const bg = this.add
          .rectangle(x, y, traitW, traitH, COLORS.cardBg, 0.97)
          .setOrigin(0)
          .setStrokeStyle(2, COLORS.exclusive)
          .setScrollFactor(0)
          .setDepth(31)
          .setInteractive({ useHandCursor: true });
        bg.on('pointerdown', () => chooseEvolutionTrait(this.world, i));
        const text = this.add
          .text(x + 10, y + 8, `[${i + 1}] TRAIT: ${ability.name}\n${ability.description}`, {
            fontFamily: 'monospace',
            fontSize: '13px',
            color: '#ffffff',
            lineSpacing: 3,
            wordWrap: { width: traitW - 20 },
          })
          .setScrollFactor(0)
          .setDepth(32);
        this.overlay.push(bg, text);
      });
    }
  }

  /** The evolving player, drawn above the dim: flashes faster and grows toward the new size. */
  private drawEvolutionFx(): void {
    const g = this.fxGfx;
    g.clear();
    const evolution = this.world.status === 'running' ? this.world.evolution : null;
    if (evolution?.phase !== 'cinematic') return;
    const t = Math.min(1, (this.time.now - this.evoStartedAt) / EVOLUTION_CINEMATIC_MS);
    const stages = POKEMON[this.world.player.pokemonId].stages;
    const fromR = stages[evolution.fromStage]!.radius;
    const toR = stages[evolution.toStage]!.radius;
    const eased = t * t * (3 - 2 * t);
    const r = fromR + (toR - fromR) * eased;
    // Blink rate ramps up from ~4 Hz to ~20 Hz.
    const blinkHz = 4 + 16 * t;
    const white = Math.floor((this.time.now / 1000) * blinkHz * 2) % 2 === 0;
    const { x, y } = this.world.player;
    g.fillStyle(white ? COLORS.flash : COLORS.player, 1);
    g.fillRect(x - r, y - r, r * 2, r * 2);
    g.lineStyle(2, COLORS.flash, 0.6 * t);
    g.strokeCircle(x, y, r + 10 + 30 * t);

    if (this.evoText && t >= EVOLUTION_REVEAL_AT) {
      const from = stageName(this.world, evolution.fromStage);
      const to = stageName(this.world, evolution.toStage);
      this.evoText.setText(`${from} evolved into ${to}!`);
    }
  }

  private draw(): void {
    const { player, enemies, projectiles, gems, swings, moves, zones, blasts, berries } = this.world;
    const cam = this.cameras.main;
    cam.centerOn(player.x, player.y);
    // Snorlax shaking the ground before a berry pops up (owner 2026-10-21); a running shake isn't restarted.
    if (this.world.arena && this.world.arena.shakeLeft > 0) cam.shake(150, 0.006);

    const g = this.gfx;
    g.clear();

    // Ground grid, so movement reads on an empty field.
    const left = player.x - cam.width / 2;
    const top = player.y - cam.height / 2;
    g.lineStyle(1, COLORS.grid, 1);
    for (let x = Math.floor(left / GRID_SIZE) * GRID_SIZE; x <= left + cam.width; x += GRID_SIZE) {
      g.lineBetween(x, top, x, top + cam.height);
    }
    for (let y = Math.floor(top / GRID_SIZE) * GRID_SIZE; y <= top + cam.height; y += GRID_SIZE) {
      g.lineBetween(left, y, left + cam.width, y);
    }

    // Zones on the ground, fading out at the end: craters orange; status zones by their effect.
    for (const zone of zones) {
      const fade = Math.min(1, zone.lifeLeft / 0.5);
      const color =
        zone.blind > 0
          ? COLORS.smoke
          : zone.poisonDps > 0
            ? COLORS.poison
            : zone.stun > 0
              ? COLORS.stun
              : zone.slow > 0
                ? COLORS.slow
                : COLORS.crater;
      g.fillStyle(color, 0.22 * fade);
      g.fillCircle(zone.x, zone.y, zone.radius);
      g.lineStyle(2, color, 0.6 * fade);
      g.strokeCircle(zone.x, zone.y, zone.radius);
    }

    // Shared terrain under everything else: pale-blue puddles, orange Scorch.
    for (const patch of this.world.puddles) {
      g.fillStyle(COLORS.puddle, 0.35 * Math.min(1, patch.lifeLeft / 0.5));
      g.fillCircle(patch.x, patch.y, patch.radius);
    }
    for (const patch of this.world.scorches) {
      g.fillStyle(COLORS.crater, 0.3 * Math.min(1, patch.lifeLeft / 0.5));
      g.fillCircle(patch.x, patch.y, patch.radius);
    }

    // Arena events (D28): the entrance on the map, and the arena wall during a fight.
    const { entrance, arena } = this.world;
    if (entrance) {
      g.fillStyle(COLORS.entrance, 0.9);
      g.fillCircle(entrance.x, entrance.y, entrance.radius);
      g.lineStyle(5, COLORS.entranceRim, 1);
      g.strokeCircle(entrance.x, entrance.y, entrance.radius);
    }
    if (arena) {
      g.lineStyle(10, COLORS.arenaWall, 1);
      g.strokeCircle(arena.x, arena.y, arena.radius);
      // Body Slam telegraph (B1-3): the ring is fixed where it will land and fills until it does.
      const slam = arena.slam;
      if (slam?.phase === 'windup') {
        const t = 1 - slam.left / slam.windup;
        g.fillStyle(COLORS.telegraph, 0.25);
        g.fillCircle(slam.x, slam.y, slam.radius * t);
        g.lineStyle(3, COLORS.telegraph, 0.9);
        g.strokeCircle(slam.x, slam.y, slam.radius);
      }
      // B2: rubble, Snore rings (run through the gap), the Yawn cone, Hyper Beam.
      const { snore, yawn, hyperBeam } = SNORLAX_KIT;
      g.fillStyle(COLORS.rubble, 1);
      for (const rock of arena.rubble) g.fillCircle(rock.x, rock.y, rock.radius);
      g.lineStyle(snore.thickness, COLORS.snore, 0.6);
      // Drawn in short arcs, skipping its openings (the gap and rock shadows), so safe spots are visible.
      const STEP = Math.PI / 60;
      for (const ring of arena.snores) {
        const openings = snoreOpenings(arena, ring);
        let start: number | null = null;
        for (let i = 0; i <= 120; i++) {
          const a = i * STEP;
          const closed = i < 120 && !openings.some((o) => angleGap(a + STEP / 2, o.angle) <= o.half);
          if (closed && start === null) start = a;
          if (!closed && start !== null) {
            g.beginPath();
            g.arc(ring.x, ring.y, ring.r, start, a, false);
            g.strokePath();
            start = null;
          }
        }
      }
      const cloud = arena.yawn;
      if (cloud) {
        const half = (yawn.arcDeg * Math.PI) / 360;
        g.beginPath();
        g.slice(cloud.x, cloud.y, yawn.range, cloud.angle - half, cloud.angle + half, false);
        if (cloud.phase === 'windup') {
          g.lineStyle(3, COLORS.telegraph, 0.9);
          g.strokePath();
        } else {
          g.fillStyle(COLORS.yawn, 0.3);
          g.fillPath();
        }
      }
      const beam = arena.beam;
      if (beam) {
        const ex = beam.x + Math.cos(beam.angle) * hyperBeam.length;
        const ey = beam.y + Math.sin(beam.angle) * hyperBeam.length;
        if (beam.phase === 'windup') {
          const t = 1 - beam.left / hyperBeam.telegraph;
          g.lineStyle(Math.max(2, hyperBeam.width * t), COLORS.telegraph, 0.45);
          g.lineBetween(beam.x, beam.y, ex, ey);
        } else if (beam.left > hyperBeam.recharge - 0.25) {
          g.lineStyle(hyperBeam.width, COLORS.hyperBeam, 0.9);
          g.lineBetween(beam.x, beam.y, ex, ey);
        }
      }
      drawSnorlaxExtras(g, this.world, arena);
      if (arena.zap) drawZapdos(g, this.world, arena, arena.zap);
      if (arena.champ) drawMachamp(g, this.world, arena, arena.champ);
    }

    // Mutation Sites (D23): the ring's colour reveals the roll once you step in (gold = Pokémon-bound);
    // the outer arc fills while you capture it. Hidden during an arena fight: they wait on the main map (D28).
    for (const site of arena ? [] : this.world.sites) {
      const color = siteColor(site);
      g.fillStyle(color, 0.12);
      g.fillCircle(site.x, site.y, site.radius);
      g.lineStyle(3, color, 0.9);
      g.strokeCircle(site.x, site.y, site.radius);
      if (site.progress > 0) {
        const start = -Math.PI / 2;
        g.lineStyle(6, color, 1);
        g.beginPath();
        g.arc(site.x, site.y, site.radius + 8, start, start + (site.progress / site.required) * Math.PI * 2, false);
        g.strokePath();
      }
    }

    // Oran Berries: blue with a white rim, so they read as "heal" (D12).
    // Magnets: a red U so they don't read as berries.
    for (const berry of berries) {
      if (berry.kind === 'magnet') {
        g.lineStyle(4, COLORS.magnet, 1);
        g.beginPath();
        g.arc(berry.x, berry.y, 7, 0, Math.PI, false);
        g.strokePath();
        g.lineBetween(berry.x - 7, berry.y, berry.x - 7, berry.y - 6);
        g.lineBetween(berry.x + 7, berry.y, berry.x + 7, berry.y - 6);
        continue;
      }
      g.fillStyle(COLORS.berry, 1);
      g.fillCircle(berry.x, berry.y, 7);
      g.lineStyle(2, COLORS.flash, 0.9);
      g.strokeCircle(berry.x, berry.y, 7);
    }

    // XP gems as small diamonds.
    for (const gem of gems) {
      const big = gem.value >= BIG_GEM_VALUE;
      const h = big ? 7 : 5;
      const w = big ? 5 : 4;
      g.fillStyle(big ? COLORS.bigGem : COLORS.gem, 1);
      g.fillTriangle(gem.x, gem.y - h, gem.x + w, gem.y, gem.x - w, gem.y);
      g.fillTriangle(gem.x - w, gem.y, gem.x + w, gem.y, gem.x, gem.y + h);
    }

    // Beams under everything else that moves.
    for (const slot of moves) {
      const def = MOVES[slot.moveId];
      if (def.form !== 'beam' || slot.activeLeft <= 0) continue;
      const len = beamLength(slot, def);
      g.lineStyle(def.width * slot.stats.area, moveColor(slot.moveId, COLORS.beam), 0.85);
      // Mutations can split the beam or replace it (beamDirs).
      const dirs = hooksOf(slot)?.beamDirs?.(this.world, slot) ?? [[slot.dirX, slot.dirY] as const];
      for (const [dx, dy] of dirs) g.lineBetween(player.x, player.y, player.x + dx * len, player.y + dy * len);
    }

    for (const swing of swings) {
      const angle = Math.atan2(swing.dirY, swing.dirX);
      g.fillStyle(COLORS.swing, 0.45 * Math.min(1, swing.lifeLeft / 0.15));
      g.slice(swing.x, swing.y, swing.reach, angle - swing.halfArc, angle + swing.halfArc, false);
      g.fillPath();
    }

    // Slash: a quick X on the ground.
    for (const cut of this.world.cuts) {
      const r = cut.radius;
      g.lineStyle(3, COLORS.flash, Math.min(1, cut.lifeLeft / 0.1));
      g.lineBetween(cut.x - r, cut.y - r, cut.x + r, cut.y + r);
      g.lineBetween(cut.x - r, cut.y + r, cut.x + r, cut.y - r);
    }

    for (const p of projectiles) {
      g.fillStyle(moveColor(p.moveId, COLORS.projectile), 1);
      g.fillCircle(p.x, p.y, p.radius);
    }

    // Explosion flashes: bright, quick, slightly expanding.
    // Ability bursts (Shell Burst, Flare Up, Bloom, Discharge) last longer and use their type's colour.
    for (const blast of blasts) {
      const t = 1 - blast.lifeLeft / (blast.type ? BLAST_SECONDS * 2 : BLAST_SECONDS);
      g.fillStyle(blast.type ? TYPE_COLORS[blast.type] : COLORS.blast, 0.55 * (1 - t));
      g.fillCircle(blast.x, blast.y, blast.radius * (0.7 + 0.3 * t));
    }

    drawEnemyAttacks(g, this.world);
    const fight = this.world.arena;
    for (const e of enemies) {
      const isBoss = fight?.bossEnemyId === e.id;
      // Snorlax in the air (Heavy Slam) is off the ground: only its shadow is drawn.
      if (isBoss && (fight.heavySlam?.phase === 'air' || fight.heavySlam?.phase === 'lock')) continue;
      // Hit flash colour shows type effectiveness (D14): yellow super, grey not very, white neutral.
      const flash =
        e.lastEffectiveness > 1 ? COLORS.superEffective : e.lastEffectiveness < 1 ? COLORS.notVery : COLORS.flash;
      g.fillStyle(e.hitFlashLeft > 0 ? flash : ENEMY_COLORS[e.kind], 1);
      g.fillCircle(e.x, e.y, e.radius);
      // Elites (D34): a gold ring so you can tell their ability is on.
      if (e.elite) {
        g.lineStyle(3, COLORS.elite, 0.95);
        g.strokeCircle(e.x, e.y, e.radius + 3);
      }
      // Immune during a special animation (owner 2026-10-22): a white shield ring.
      if (isBoss && bossImmune(this.world, e)) {
        g.lineStyle(4, COLORS.shield, 0.9);
        g.strokeCircle(e.x, e.y, e.radius + 6);
      }
    }
    // Status rings: burn orange, poison purple, slow light blue, stun yellow.
    for (const e of enemies) {
      let r = e.radius + 2;
      const ring = (active: boolean, color: number): void => {
        if (!active) return;
        g.lineStyle(2, color, 0.9);
        g.strokeCircle(e.x, e.y, r);
        r += 3;
      };
      ring(e.burnLeft > 0, COLORS.crater);
      ring(e.poisonLeft > 0, COLORS.poison);
      ring(e.slowLeft > 0, COLORS.slow);
      ring(e.stunLeft > 0, COLORS.stun);
      ring(e.seedLeft > 0, COLORS.seed);
      // Blinded: a grey bar over the eyes.
      if (e.blindLeft > 0) {
        g.fillStyle(COLORS.smoke, 0.9);
        g.fillRect(e.x - e.radius, e.y - e.radius * 0.4, e.radius * 2, 4);
      }
      // Aurora Beam: weakened enemies wear a pale ring.
      if (e.weakenLeft > 0) {
        g.lineStyle(1, TYPE_COLORS.Ice, 0.8);
        g.strokeCircle(e.x, e.y, e.radius + 3);
      }
      // Bubble Trap: a floating bubble around the trapped enemy.
      if (e.trapLeft > 0) {
        g.lineStyle(3, COLORS.puddle, 0.9);
        g.strokeCircle(e.x, e.y, e.radius + 6);
      }
    }

    // Things Mutations spawned, drawn by owner.
    for (const m of this.world.entities) {
      if (m.lifeLeft <= 0) continue;
      switch (m.owner) {
        case 'bubble.froth':
          g.fillStyle(COLORS.puddle, 0.5);
          g.fillCircle(m.x, m.y, m.radius);
          g.lineStyle(1, COLORS.flash, 0.8);
          g.strokeCircle(m.x, m.y, m.radius);
          break;
        case 'vineWhip.thornGarden':
          g.lineStyle(1, COLORS.seed, 0.35);
          g.strokeCircle(m.x, m.y, m.radius);
          g.fillStyle(COLORS.seed, 1);
          g.fillCircle(m.x, m.y, 6);
          break;
        case 'thunderShock.ballLightning':
          g.lineStyle(1, COLORS.stun, 0.3);
          g.strokeCircle(m.x, m.y, m.radius);
          g.fillStyle(COLORS.stun, 1);
          g.fillCircle(m.x, m.y, 8);
          break;
        case 'thunderShock.liveWire':
          g.lineStyle(2, COLORS.stun, 0.8);
          g.lineBetween(m.x, m.y, m.x2, m.y2);
          break;
        case 'whirlpool.moat':
          g.lineStyle(m.radius - m.x2, COLORS.slow, 0.25);
          g.strokeCircle(m.x, m.y, (m.radius + m.x2) / 2);
          break;
        case 'surf.rideTheWave': {
          const len = Math.hypot(m.vx, m.vy) || 1;
          const px = (-m.vy / len) * m.radius;
          const py = (m.vx / len) * m.radius;
          g.lineStyle(8, TYPE_COLORS.Water, 0.7);
          g.lineBetween(m.x - px, m.y - py, m.x + px, m.y + py);
          break;
        }
        case 'hydroPump.rainCannon':
          g.fillStyle(TYPE_COLORS.Water, 0.15);
          g.fillCircle(m.x, m.y, m.radius);
          break;
        case 'flashCannon.shrapnel':
          g.fillStyle(TYPE_COLORS.Steel, 1);
          g.fillCircle(m.x, m.y, m.radius);
          break;
        case 'thunderWave.pulse':
          g.lineStyle(3, COLORS.stun, 0.8);
          g.strokeCircle(m.x, m.y, m.radius);
          break;
        case 'spark.shower':
          g.fillStyle(COLORS.stun, 1);
          g.fillCircle(m.x, m.y, m.radius);
          break;
        case 'ironTail.slam':
          g.lineStyle(2, TYPE_COLORS.Steel, 0.8);
          g.strokeCircle(m.x, m.y, m.radius);
          break;
        case 'bodySlam.bellyFlop':
          g.lineStyle(2, TYPE_COLORS.Normal, 0.8);
          g.strokeCircle(m.x, m.y, m.radius);
          break;
        case 'bodySlam.shockwave':
          g.fillStyle(TYPE_COLORS.Normal, 0.5);
          g.fillCircle(m.x, m.y, m.radius);
          break;
        case 'iceBeam.iceWall':
          g.lineStyle(m.radius * 2, TYPE_COLORS.Ice, 0.9);
          g.lineBetween(m.x, m.y, m.x2, m.y2);
          break;
        case 'slash.afterimage': {
          const r = m.radius;
          g.lineStyle(2, COLORS.flash, 0.4);
          g.lineBetween(m.x - r, m.y - r, m.x + r, m.y + r);
          g.lineBetween(m.x - r, m.y + r, m.x + r, m.y - r);
          break;
        }
        case 'wingAttack.updraft':
          g.lineStyle(2, TYPE_COLORS.Flying, 0.8);
          g.strokeCircle(m.x, m.y, 14);
          break;
        case 'thunder.afterglow':
          if (m.timer <= 0 || m.lifeLeft > 0) {
            g.fillStyle(COLORS.stun, 0.15);
            g.fillCircle(m.x, m.y, m.radius);
          }
          break;
        case 'razorLeaf.embed':
          g.fillStyle(TYPE_COLORS.Grass, 1);
          g.fillCircle(m.x, m.y - 6, 3);
          break;
        case 'petalDance.frenzy':
          g.fillStyle(COLORS.bulbFull, 1);
          g.fillCircle(m.x, m.y, m.radius);
          break;
        case 'solarBeam.fullCharge':
          g.lineStyle(2, TYPE_COLORS.Grass, 0.5);
          g.lineBetween(m.x, m.y, m.x2, m.y2);
          break;
        case 'dragonRage.dragonBreath': {
          const a = Math.atan2(m.vy, m.vx);
          const half = (MUTATIONS['dragonRage.dragonBreath'].values.coneDeg * Math.PI) / 360;
          g.fillStyle(TYPE_COLORS.Dragon, 0.35);
          g.slice(m.x, m.y, m.radius, a - half, a + half, false);
          g.fillPath();
          break;
        }
      }
    }

    // Will-o-Wisp: stored wisps orbit the player.
    const wisps = moves[0] ? wispCount(moves[0]) : 0;
    for (let i = 0; i < wisps; i++) {
      const a = this.time.now / 300 + (i / wisps) * Math.PI * 2;
      g.fillStyle(COLORS.crater, 1);
      g.fillCircle(player.x + Math.cos(a) * (player.radius + 16), player.y + Math.sin(a) * (player.radius + 16), 5);
    }

    // Chain lightning arcs.
    for (const arc of this.world.arcs) {
      g.lineStyle(3, COLORS.stun, Math.min(1, arc.lifeLeft / ARC_SECONDS));
      g.lineBetween(arc.x1, arc.y1, arc.x2, arc.y2);
    }

    for (const slot of moves) {
      const def = MOVES[slot.moveId];
      if (def.form !== 'orbit' || slot.activeLeft <= 0) continue;
      g.fillStyle(moveColor(slot.moveId, COLORS.orbit), 1);
      for (const ball of orbitBalls(slot, def, player)) g.fillCircle(ball.x, ball.y, ball.r);
    }

    // Blaze (low-HP ability): pulsing red aura.
    if (isAbilityActive(this.world)) {
      const pulse = 0.5 + 0.5 * Math.sin(this.time.now / 90);
      g.lineStyle(3, COLORS.blaze, 0.5 + 0.4 * pulse);
      g.strokeCircle(player.x, player.y, player.radius + 6 + 3 * pulse);
    }

    // Shell: a water bubble around the player while the next block is ready.
    if (ABILITIES[player.ability].blockEvery && player.blockReadyLeft <= 0) {
      g.lineStyle(2, COLORS.slow, 0.8);
      g.strokeCircle(player.x, player.y, player.radius + 8);
    }

    // The Bulb (Ivysaur+): a ring that fills, green turning pink, with stored overheal.
    const bulbCap = bulbCapacity(this.world);
    if (bulbCap > 0) {
      const fill = player.bulb / bulbCap;
      g.lineStyle(3, fill >= 0.75 ? COLORS.bulbFull : COLORS.seed, 0.9);
      g.beginPath();
      g.arc(player.x, player.y, player.radius + 12, -Math.PI / 2, -Math.PI / 2 + fill * Math.PI * 2);
      g.strokePath();
    }


    // Blink while invulnerable.
    const blinkOff = player.invulnLeft > 0 && Math.floor(this.world.time * 20) % 2 === 0;
    if (!blinkOff) {
      const bodyColor = TYPE_COLORS[currentStage(this.world).types[0] ?? 'Normal'];
      g.fillStyle(player.hurtFlashLeft > 0 ? COLORS.flash : bodyColor, 1);
      g.fillRect(player.x - player.radius, player.y - player.radius, player.radius * 2, player.radius * 2);
    }

    // Charge (Pikachu line): two red cheek dots glowing brighter as it fills.
    const charge = ABILITIES[player.ability].charge;
    if (charge) {
      const fill = player.charge / charge.max;
      g.fillStyle(COLORS.cheek, 0.2 + 0.8 * fill);
      const r = fill >= 1 ? 5 : 3;
      g.fillCircle(player.x - player.radius * 0.6, player.y + player.radius * 0.3, r);
      g.fillCircle(player.x + player.radius * 0.6, player.y + player.radius * 0.3, r);
    }

    // HP bar above the player.
    const barW = 36;
    const barY = player.y - player.radius - 10;
    g.fillStyle(COLORS.hpBack, 1);
    g.fillRect(player.x - barW / 2, barY, barW, 5);
    g.fillStyle(COLORS.hpFill, 1);
    g.fillRect(player.x - barW / 2, barY, (barW * player.hp) / player.maxHp, 5);

    this.drawEvolutionFx();
    this.drawHud();
  }

  private drawHud(): void {
    const { player, kills, status, enemies, level, xp, moves, items } = this.world;
    // The run clock: paused inside an arena (owner 2026-10-23).
    const time = runClock(this.world);
    const name = currentStage(this.world).name;
    // ⛓ marks the skill combo (D28): those moves fire together.
    const moveNames = moves.map((s, i) => `${MOVES[s.moveId].name}${this.world.combo.includes(i) ? '⛓' : ''}`).join(', ');
    const itemNames = items.length ? items.map((id) => ITEMS[id].name).join(', ') : '—';
    const ability = ABILITIES[player.ability];
    const abilityTag = isAbilityActive(this.world) ? `   ${ability.name.toUpperCase()}!` : '';
    // Lapras's Tide (D18): its Bonds are at full strength (Flood) until Lv 30, then Ebb.
    const tide =
      player.pokemonId === 'lapras'
        ? tideFlood(this.world)
          ? `   ≋ Tide: Flood (ebbs at Lv ${MUTATION_TUNING.tideLevel})`
          : '   ~ Tide: Ebb'
        : '';
    // Statuses on you (D36): named with their seconds left, so you know what hit you.
    const ps = this.world.playerStatus;
    const statuses = (
      [
        ['Poisoned', ps.poisonLeft],
        ['Burned', ps.burnLeft],
        ['Paralysed', ps.paraLeft],
        ['Confused', ps.confuseLeft],
        ['Slowed', ps.slowLeft],
        ['Soaked', ps.soakLeft],
      ] as const
    )
      .filter(([, left]) => left > 0)
      .map(([label, left]) => `${label} ${left.toFixed(1)}s`)
      .join(' · ');
    // Rest regen (D44) is healing right now.
    const resting = player.calmFor >= TUNING.restRegen.afterSeconds && player.hp < player.maxHp ? ' (resting +)' : '';
    this.hud.setText(
      `${name} Lv ${level}  HP ${Math.ceil(player.hp)}/${Math.round(player.maxHp)}${resting}${abilityTag}   ` +
        `${formatTime(time)} / ${formatTime(TUNING.runSeconds)}   KOs ${kills}   on field ${enemies.length}${tide}\n` +
        `Moves: ${moveNames}   Items: ${itemNames}   (Esc: build)` +
        (this.world.techniques.length > 0 ? `\nTechniques: ${techniqueLine(this.world)}` : ''),
    );

    const cam = this.cameras.main;

    // Visible cost of "damage taken" trade-offs (D12).
    const taken = this.world.mods.damageTakenMult;
    const glass = taken > 1.001 ? `⚠ Glass: you take +${Math.round((taken - 1) * 100)}% damage` : '';
    this.warnText.setText([glass, statuses, this.arenaHudLine()].filter(Boolean).join('\n'));
    this.updateLevelBadge();

    // XP bar across the top edge.
    const h = this.hudGfx;
    h.clear();
    h.fillStyle(COLORS.xpBack, 1);
    h.fillRect(0, 0, cam.width, 6);
    h.fillStyle(COLORS.xpFill, 1);
    h.fillRect(0, 0, (cam.width * xp) / xpToNext(level), 6);

    // Arrows at the screen edge toward off-screen Mutation Sites in range (D23) and an open arena entrance (D28).
    if (!this.world.arena) {
      for (const site of this.world.sites) {
        if (Math.hypot(site.x - player.x, site.y - player.y) <= SITE_TUNING.arrowRange) {
          this.edgeArrow(site.x - player.x, site.y - player.y, site.radius, siteColor(site));
        }
      }
    }
    const entrance = this.world.entrance;
    if (entrance) this.edgeArrow(entrance.x - player.x, entrance.y - player.y, entrance.radius, COLORS.entranceRim);
    const warning = this.world.hordeWarning;
    if (warning) this.edgeArrow(Math.cos(warning.angle) * 2000, Math.sin(warning.angle) * 2000, 0, COLORS.elite);

    // Boss HP bar under the XP bar during an arena fight (D28).
    const fight = this.world.arena;
    const boss = fight && this.world.enemies.find((e) => e.id === fight.bossEnemyId);
    if (boss) {
      const w = Math.min(420, cam.width - 40);
      const x = (cam.width - w) / 2;
      h.fillStyle(COLORS.xpBack, 1);
      h.fillRect(x, 70, w, 10);
      h.fillStyle(COLORS.bossBar, 1);
      h.fillRect(x, 70, (w * Math.max(0, boss.hp)) / boss.maxHp, 10);
    }

    this.banner.setPosition(cam.width / 2, cam.height / 2);
    this.panel.setPosition(cam.width / 2, cam.height / 2);
    this.panel.setVisible(false);
    if (status === 'survived') {
      this.banner
        .setText(
          `Level 1 cleared: survived ${formatTime(TUNING.runSeconds)}!\n\nLv ${level} · KOs ${kills}\n\nR: play again · C: change Pokémon`,
        )
        .setVisible(true);
    } else if (status === 'fainted') {
      this.banner
        .setText(
          `${name} fainted!\n\nSurvived ${formatTime(time)} · Lv ${level} · KOs ${kills}\n\nR: restart · C: change Pokémon`,
        )
        .setVisible(true);
    } else {
      this.banner.setVisible(false);
    }
  }
}

/** Identifies an evolution window, so the overlay rebuilds when the phase changes. */
function evolutionKey(evolution: EvolutionState): string {
  const pick = evolution.traitChoices ? ':pick' : '';
  return `evo:${evolution.fromStage}>${evolution.toStage}:${evolution.phase}${pick}`;
}

const POKEMON_TYPES = new Set<string>(Object.keys(TYPE_COLORS));

/** Colour of a move's (first) Pokémon type, so Water bubbles look different from Fire balls. */
function moveColor(moveId: MoveId, fallback: number): number {
  const type = MOVES[moveId].tags.find((tag) => POKEMON_TYPES.has(tag)) as PokemonType | undefined;
  return type ? TYPE_COLORS[type] : fallback;
}

function stageName(world: World, stage: number): string {
  return POKEMON[world.player.pokemonId].stages[stage]!.name;
}

function describeCard(world: World, card: Card): CardView {
  switch (card.kind) {
    case 'move': {
      const move = MOVES[card.moveId];
      return { heading: 'NEW MOVE', title: move.name, body: `${move.tags.join(' · ')}\n${move.description}`, color: 0xff9a4d };
    }
    case 'boost': {
      const boost = BOOSTS[card.boostId];
      const next = world.boosts[card.boostId] + 1;
      if (boost.filler) return { heading: 'BOOST', title: boost.name, body: boost.description, color: 0x5ad1ff };
      return { heading: 'NATURE', title: `${boost.name} ${next}/${boost.maxPicks}`, body: boost.description, color: 0x5ad1ff };
    }
    case 'technique': {
      const tech = TECHNIQUES[card.techniqueId];
      const heading = tech.requiresAny.length > 0 ? `TECHNIQUE · ${tech.requiresAny.join('/')}` : 'TECHNIQUE';
      const title = `${tech.name} ${RANK_NUMERALS[card.rank - 1]}${card.rank > 1 ? ' (rank up)' : ''}`;
      return { heading, title, body: tech.descriptions[card.rank - 1]!, color: 0x7ee081 };
    }
    case 'item': {
      const item = ITEMS[card.itemId];
      return { heading: 'HELD ITEM', title: item.name, body: item.description, color: 0xc77dff };
    }
    case 'potion':
      return { heading: 'POTION', title: 'Potion', body: `Heal ${POTION_HEAL} HP`, color: 0x4cd964 };
    case 'bigBoost':
      return { heading: 'FULLY AUGMENTED', title: BIG_BOOST.name, body: BIG_BOOST.description, color: COLORS.augment };
  }
}

/** A site's fallback card (D25): a heal and a timed Power Surge. */
function describeSurge(): CardView {
  const { heal, damagePct, seconds } = SITE_TUNING.surge;
  return {
    heading: 'NOTHING LEFT HERE',
    title: `Heal + ${BIG_BOOST.name}`,
    body: `Heal ${heal} HP\n+${Math.round(damagePct * 100)}% damage for ${seconds} s`,
    color: COLORS.augment,
  };
}

const ENTRANCE_NAMES: Readonly<Record<ArenaEntranceKind, string>> = {
  mountainHole: 'A mountain hole',
  pool: 'A deep pool',
  whirlwind: 'A whirlwind',
  dojo: 'A dojo door',
};

/** Machamp's state for the arena line: Bulk Up stacks, the pose and Focus Punch interrupt meters, its rock shield. */
function machampHud(champ: MachampState, boss: Enemy): string {
  const { pose, focusPunch } = MACHAMP_KIT;
  const pct = (taken: number, of: number) => Math.min(100, Math.round((taken / (boss.maxHp * of)) * 100));
  const stone = champ.rock?.stone;
  return (
    (champ.bulk > 0 ? ` · Bulk Up ×${champ.bulk}` : '') +
    (champ.pose ? ` · ${champ.pose.iron ? 'Iron Pose' : 'Posing'}! interrupt ${pct(champ.pose.taken, pose.interruptPct)}%` : '') +
    (champ.focus?.phase === 'channel' ? ` · Focus Punch! interrupt ${pct(champ.focus.taken, focusPunch.interruptPct)}%` : '') +
    (stone?.hp !== undefined ? ` · rock shield ${Math.max(0, Math.round((stone.hp / (boss.maxHp * MACHAMP_KIT.rock.shieldHpPct)) * 100))}%` : '') +
    (champ.staggerLeft > 0 ? ' · Staggered!' : '') +
    (champ.openLeft > 0 ? ' · defences down' : '')
  );
}

/**
 * Machamp (D42): chop cones, the Cross Chop X, sweep and grab rings, Rock Tomb rings, the rock in hand (tells, the
 * lob, Strength's line and boulders), Bullet Punch's line, Dynamic Punch's ring, Focus Blast orbs, Focus Punch, the
 * pose aura and Bulk Up pips. Rocks themselves draw with the rubble.
 */
function drawMachamp(g: Phaser.GameObjects.Graphics, world: World, arena: ArenaFight, champ: MachampState): void {
  const kit = MACHAMP_KIT;
  const boss = world.enemies.find((e) => e.id === arena.bossEnemyId);
  if (!boss) return;
  const ring = (x: number, y: number, radius: number, t: number, color: number = COLORS.telegraph): void => {
    g.fillStyle(color, 0.25);
    g.fillCircle(x, y, radius * Math.max(0, Math.min(1, t)));
    g.lineStyle(3, color, 0.9);
    g.strokeCircle(x, y, radius);
  };
  const line = (x1: number, y1: number, x2: number, y2: number, width: number): void => {
    g.lineStyle(width, COLORS.telegraph, 0.45);
    g.lineBetween(x1, y1, x2, y2);
  };
  const c = champ.chops;
  if (c?.phase === 'windup') {
    const spec = c.close ? kit.closeCombat : kit.karateChop;
    const half = (spec.arcDeg * Math.PI) / 360;
    g.beginPath();
    g.slice(boss.x, boss.y, spec.reach, c.angle - half, c.angle + half, false);
    g.lineStyle(3, COLORS.telegraph, 0.9);
    g.strokePath();
  }
  const cc = champ.crossChop;
  if (cc && cc.phase !== 'recover') {
    const t = cc.phase === 'crouch' ? 0 : 1 - cc.left / kit.crossChop.telegraph;
    for (const [x1, y1, x2, y2] of crossArms(cc.x, cc.y, cc.angle)) line(x1, y1, x2, y2, Math.max(2, kit.crossChop.width * t));
  }
  if (champ.sweep?.phase === 'windup') ring(boss.x, boss.y, kit.lowSweep.radius, 1 - champ.sweep.left / kit.lowSweep.telegraph);
  if (champ.toss?.phase === 'windup') ring(boss.x, boss.y, kit.seismicToss.radius, 1 - champ.toss.left / kit.seismicToss.telegraph, COLORS.chain);
  for (const t of champ.tombs) ring(t.x, t.y, kit.rockTomb.radius, 1 - t.left / kit.rockTomb.telegraph);
  // The rock in hand: its HP ring, the follow-up's tell, Strength's locked line.
  const rock = champ.rock;
  if (rock?.stone?.hp !== undefined) {
    const share = Math.max(0, rock.stone.hp / (boss.maxHp * kit.rock.shieldHpPct));
    g.lineStyle(3, COLORS.shield, 0.9);
    g.beginPath();
    g.arc(rock.stone.x, rock.stone.y, rock.stone.radius + 5, -Math.PI / 2, -Math.PI / 2 + share * Math.PI * 2, false);
    g.strokePath();
  }
  if (rock?.phase === 'tell') {
    // Throw: the rock goes overhead (an arc above it); Strength: crouched, feet scraping; Iron Pose: arms glowing.
    if (rock.follow === 'throw') {
      g.lineStyle(4, COLORS.telegraph, 0.9);
      g.beginPath();
      g.arc(boss.x, boss.y, boss.radius + 14, -Math.PI * 0.8, -Math.PI * 0.2, false);
      g.strokePath();
    } else if (rock.follow === 'strength') {
      g.lineStyle(3, COLORS.rubble, 0.9);
      const back = Math.atan2(boss.y - world.player.y, boss.x - world.player.x);
      for (const off of [-0.5, 0.5]) {
        const a = back + off;
        g.lineBetween(boss.x + Math.cos(a) * boss.radius, boss.y + Math.sin(a) * boss.radius, boss.x + Math.cos(a) * (boss.radius + 18), boss.y + Math.sin(a) * (boss.radius + 18));
      }
    } else {
      g.lineStyle(4, COLORS.elite, 0.9);
      g.strokeCircle(boss.x, boss.y, boss.radius + 10);
    }
  }
  if (rock?.phase === 'plant') {
    const t = 1 - rock.left / kit.strength.telegraph;
    line(boss.x, boss.y, boss.x + Math.cos(rock.angle) * arena.radius * 2, boss.y + Math.sin(rock.angle) * arena.radius * 2, Math.max(2, kit.strength.radius * 2 * t));
  }
  const lob = champ.lob;
  if (lob) {
    const t = 1 - lob.left / kit.rockThrow.telegraph;
    ring(lob.tx, lob.ty, kit.rockThrow.radius, t);
    g.fillStyle(COLORS.rubble, 1);
    g.fillCircle(lob.fx + (lob.tx - lob.fx) * t, lob.fy + (lob.ty - lob.fy) * t - Math.sin(t * Math.PI) * 60, kit.rock.radius);
  }
  g.fillStyle(COLORS.rubble, 1);
  for (const b of champ.boulders) if (b.wait <= 0) g.fillCircle(b.x, b.y, kit.strength.radius);
  if (champ.bullet?.phase === 'windup') {
    const t = 1 - champ.bullet.left / kit.bulletPunch.telegraph;
    const a = champ.bullet.angle;
    line(boss.x, boss.y, boss.x + Math.cos(a) * kit.bulletPunch.length, boss.y + Math.sin(a) * kit.bulletPunch.length, Math.max(2, kit.bulletPunch.width * t));
  }
  if (champ.dynamic?.phase === 'windup') ring(champ.dynamic.x, champ.dynamic.y, kit.dynamicPunch.radius, 1 - champ.dynamic.left / kit.dynamicPunch.telegraph);
  for (const orb of champ.orbs) {
    const e = world.enemies.find((en) => en.id === orb.enemyId);
    if (!e) continue;
    g.lineStyle(2, COLORS.shock, 0.8);
    g.strokeCircle(e.x, e.y, e.radius + 4);
  }
  const focus = champ.focus;
  if (focus?.phase === 'channel') {
    g.lineStyle(3, COLORS.elite, 0.4 + 0.5 * (1 - focus.left / kit.focusPunch.channel));
    g.strokeCircle(boss.x, boss.y, boss.radius + 12);
  } else if (focus?.phase === 'line') {
    const t = 1 - focus.left / kit.focusPunch.telegraph;
    line(boss.x, boss.y, boss.x + Math.cos(focus.angle) * kit.focusPunch.length, boss.y + Math.sin(focus.angle) * kit.focusPunch.length, Math.max(2, kit.focusPunch.width * t));
  }
  // The pose: a pulsing gold aura (Iron Pose: white); staggered: a grey ring; Bulk Up stacks as pips above it.
  if (champ.pose) {
    g.lineStyle(4, champ.pose.iron ? COLORS.shield : COLORS.elite, 0.6 + 0.3 * Math.sin(world.time * 12));
    g.strokeCircle(boss.x, boss.y, boss.radius + 8);
  }
  if (champ.staggerLeft > 0) {
    g.lineStyle(2, COLORS.chain, 0.9);
    g.strokeCircle(boss.x, boss.y - boss.radius - 10, 8);
  }
  g.fillStyle(COLORS.telegraph, 1);
  for (let i = 0; i < champ.bulk; i++) g.fillCircle(boss.x - 12 + i * 12, boss.y - boss.radius - 22, 4);
}

/**
 * Snorlax's variety moves (owner 2026-10-22): Crunch and Belch cones, Rock Slide rings, the Fling line, boss shots,
 * Heavy Slam's shadow and landing ring, Block's chain and leash, Earthquake's bands.
 */
function drawSnorlaxExtras(g: Phaser.GameObjects.Graphics, world: World, arena: ArenaFight): void {
  const { crunch, rockSlide, fling, heavySlam, block, belch, earthquake } = SNORLAX_KIT;
  const boss = world.enemies.find((e) => e.id === arena.bossEnemyId);
  const cone = (x: number, y: number, angle: number, reach: number, arcDeg: number): void => {
    const half = (arcDeg * Math.PI) / 360;
    g.beginPath();
    g.slice(x, y, reach, angle - half, angle + half, false);
  };
  if (boss && arena.crunch) {
    cone(boss.x, boss.y, arena.crunch.angle, crunch.reach, crunch.arcDeg);
    if (arena.crunch.phase === 'windup') {
      g.lineStyle(3, COLORS.telegraph, 0.9);
      g.strokePath();
    } else {
      g.fillStyle(COLORS.telegraph, 0.35);
      g.fillPath();
    }
  }
  if (boss && arena.belch?.phase === 'windup') {
    cone(boss.x, boss.y, arena.belch.angle, 260, belch.arcDeg);
    g.lineStyle(3, COLORS.gas, 0.9);
    g.strokePath();
  }
  // Rock Slide: a ring per rock that fills until it lands.
  const fall = rockSlide.cast + rockSlide.telegraph;
  for (const rock of arena.rocks) {
    g.fillStyle(COLORS.telegraph, 0.25);
    g.fillCircle(rock.x, rock.y, rockSlide.radius * (1 - rock.left / fall));
    g.lineStyle(2, COLORS.telegraph, 0.9);
    g.strokeCircle(rock.x, rock.y, rockSlide.radius);
  }
  if (arena.fling) {
    const t = 1 - arena.fling.left / fling.telegraph;
    g.lineStyle(Math.max(2, fling.radius * 2 * t), COLORS.telegraph, 0.45);
    g.lineBetween(arena.fling.x, arena.fling.y, arena.fling.tx, arena.fling.ty);
    g.fillStyle(COLORS.rubble, 1);
    g.fillCircle(arena.fling.x, arena.fling.y, fling.radius);
  }
  for (const shot of arena.shots) {
    g.fillStyle(shot.kind === 'gas' ? COLORS.gas : COLORS.rubble, shot.kind === 'gas' ? 0.75 : 1);
    g.fillCircle(shot.x, shot.y, shot.radius);
  }
  const hs = arena.heavySlam;
  if (hs && boss && (hs.phase === 'air' || hs.phase === 'lock')) {
    // The shadow grows as it falls; locked, the landing ring turns red and fills.
    const t = hs.phase === 'air' ? 1 - hs.left / heavySlam.air : 1;
    g.fillStyle(0x000000, 0.25 + 0.2 * t);
    g.fillCircle(hs.x, hs.y, boss.radius * (0.5 + 0.5 * t));
    if (hs.phase === 'lock') {
      g.fillStyle(COLORS.telegraph, 0.25);
      g.fillCircle(hs.x, hs.y, heavySlam.radius * (1 - hs.left / heavySlam.lock));
      g.lineStyle(3, COLORS.telegraph, 0.9);
      g.strokeCircle(hs.x, hs.y, heavySlam.radius);
    }
  }
  if (boss && arena.block) {
    const hold = arena.block.phase === 'hold';
    g.lineStyle(hold ? 4 : 2, COLORS.chain, hold ? 0.9 : 0.5);
    g.lineBetween(boss.x, boss.y, world.player.x, world.player.y);
    g.strokeCircle(boss.x, boss.y, block.leash);
  }
  if (arena.quake?.phase === 'windup') {
    const [inner, outer] = earthquake.bands;
    const { x, y, step } = arena.quake;
    g.fillStyle(COLORS.telegraph, 0.15 + 0.25 * (1 - arena.quake.left / earthquake.telegraph));
    if (step === 1) {
      g.fillCircle(x, y, inner);
      // The outer band reaches the far side of the arena wall.
      fillBand(g, x, y, outer, Math.hypot(x - arena.x, y - arena.y) + arena.radius);
    } else {
      fillBand(g, x, y, inner, outer);
    }
  }
}

/**
 * Zapdos (D32): rain tint, generator tethers and the shield, Thunder rings, Drill Peck / Agility lines, fences,
 * the Discharge safe ring, and its shots (Shock Wave pale, Thunderbolt yellow, Zap Cannon big with a ring).
 */
function drawZapdos(g: Phaser.GameObjects.Graphics, world: World, arena: ArenaFight, zap: ZapdosState): void {
  const { thunder, drillPeck, fence, agility, discharge } = ZAPDOS_KIT;
  const boss = world.enemies.find((e) => e.id === arena.bossEnemyId);
  if (zap.raining) {
    g.fillStyle(COLORS.rain, 0.12);
    g.fillCircle(arena.x, arena.y, arena.radius);
  }
  // Generators: a line to Zapdos while they stand; the shield ring shows while any does.
  let shielded = false;
  for (const pylon of zap.pylons) {
    if (pylon.enemyId === null) {
      g.lineStyle(2, COLORS.chain, 0.4);
      g.strokeCircle(pylon.x, pylon.y, 22);
      continue;
    }
    shielded = true;
    if (boss) {
      g.lineStyle(2, COLORS.zap, 0.5);
      g.lineBetween(pylon.x, pylon.y, boss.x, boss.y);
    }
  }
  if (boss && shielded) {
    g.lineStyle(3, COLORS.zap, 0.8);
    g.strokeCircle(boss.x, boss.y, boss.radius + 10);
  }
  if (boss && zap.roost) {
    g.lineStyle(3, COLORS.rubble, 0.9);
    g.strokeCircle(boss.x, boss.y, boss.radius + 4);
  }
  // Overloaded: sparks flicker around it; Weakened: a dim, broken ring.
  if (boss && zap.overloadLeft > 0) {
    g.lineStyle(2, COLORS.zap, 0.9);
    const spin = world.time * 7;
    for (let i = 0; i < 6; i++) {
      const a = spin + (i * Math.PI) / 3;
      const r1 = boss.radius + 6;
      const r2 = boss.radius + 16 + 6 * Math.sin(world.time * 23 + i);
      g.lineBetween(boss.x + Math.cos(a) * r1, boss.y + Math.sin(a) * r1, boss.x + Math.cos(a + 0.3) * r2, boss.y + Math.sin(a + 0.3) * r2);
    }
  } else if (boss && zap.weakLeft > 0) {
    g.lineStyle(2, COLORS.chain, 0.6);
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      g.beginPath();
      g.arc(boss.x, boss.y, boss.radius + 8, a, a + Math.PI / 8);
      g.strokePath();
    }
  }
  for (const s of zap.strikes) {
    g.fillStyle(COLORS.telegraph, 0.25);
    g.fillCircle(s.x, s.y, thunder.radius * (1 - s.left / s.total));
    g.lineStyle(2, COLORS.zap, 0.9);
    g.strokeCircle(s.x, s.y, thunder.radius);
  }
  if (zap.peck?.phase === 'windup') {
    const { x, y, angle } = zap.peck;
    g.lineStyle(Math.max(2, drillPeck.width * (1 - zap.peck.left / drillPeck.telegraph)), COLORS.telegraph, 0.45);
    g.lineBetween(x, y, x + Math.cos(angle) * drillPeck.length, y + Math.sin(angle) * drillPeck.length);
  }
  if (boss && zap.agility) {
    g.lineStyle(2, COLORS.zap, 0.6);
    g.lineBetween(boss.x, boss.y, zap.agility.x, zap.agility.y);
    g.strokeCircle(zap.agility.x, zap.agility.y, boss.radius * (1 - zap.agility.left / agility.telegraph));
  }
  for (const f of zap.fences) {
    const live = f.phase === 'live';
    g.lineStyle(live ? fence.width : 2, live ? COLORS.zap : COLORS.telegraph, live ? 0.85 : 0.7);
    g.lineBetween(f.x1, f.y1, f.x2, f.y2);
  }
  if (zap.discharge?.phase === 'channel') {
    // Everything but the safe ring is about to be shocked.
    g.fillStyle(COLORS.zap, 0.08 + 0.15 * (1 - zap.discharge.left / discharge.channel));
    g.fillCircle(arena.x, arena.y, arena.radius);
    g.fillStyle(COLORS.safe, 0.35);
    g.fillCircle(zap.discharge.safeX, zap.discharge.safeY, discharge.safeRadius);
    g.lineStyle(3, COLORS.safe, 0.9);
    g.strokeCircle(zap.discharge.safeX, zap.discharge.safeY, discharge.safeRadius);
  }
  for (const shot of zap.shots) {
    g.fillStyle(shot.kind === 'shock' ? COLORS.shock : COLORS.zap, 1);
    g.fillCircle(shot.x, shot.y, shot.radius);
    if (shot.kind === 'cannon') {
      g.lineStyle(2, COLORS.shield, 0.8);
      g.strokeCircle(shot.x, shot.y, shot.radius + 4);
    }
  }
}

/**
 * Telegraphed enemy attacks (D35): a thin line before a dart, a thick line before a charge (both thicken as they
 * come), a filling ring before a dive; then the darts in flight.
 */
function drawEnemyAttacks(g: Phaser.GameObjects.Graphics, world: World): void {
  // String Shot webs on the ground (D37).
  g.fillStyle(COLORS.web, 0.35);
  for (const web of world.webs) g.fillCircle(web.x, web.y, web.radius);
  const ring = (x: number, y: number, radius: number, t: number, color: number): void => {
    g.fillStyle(color, 0.25);
    g.fillCircle(x, y, radius * t);
    g.lineStyle(2, color, 0.9);
    g.strokeCircle(x, y, radius);
  };
  for (const e of world.enemies) {
    if (e.atkPhase !== 'windup') continue;
    const atk = ENEMY_ATTACKS[e.kind];
    if (!atk) continue;
    const t = 1 - e.atkTimer / atk.telegraph;
    switch (atk.kind) {
      case 'dive':
      case 'web':
      case 'blink':
        ring(e.markX, e.markY, atk.kind === 'web' ? 40 : atk.radius, t, atk.kind === 'blink' ? COLORS.psychic : COLORS.telegraph);
        if (atk.kind === 'web') {
          g.lineStyle(2, COLORS.web, 0.7);
          g.lineBetween(e.x, e.y, e.markX, e.markY);
        }
        break;
      case 'pulse':
      case 'explode':
        ring(e.x, e.y, atk.radius, t, COLORS.telegraph);
        break;
      case 'heal':
        ring(e.x, e.y, atk.radius, t, COLORS.safe);
        break;
      case 'cone': {
        const aim = Math.atan2(e.aimY, e.aimX);
        const half = (atk.arcDeg * Math.PI) / 360;
        g.beginPath();
        g.slice(e.x, e.y, atk.reach, aim - half, aim + half, false);
        g.lineStyle(2 + 2 * t, COLORS.telegraph, 0.9);
        g.strokePath();
        break;
      }
      default: {
        const length = atk.kind === 'ranged' ? atk.range : atk.dashDistance;
        const width = atk.kind === 'ranged' ? 2 + 4 * t : 4 + (e.radius * 2 - 4) * t;
        g.lineStyle(width, COLORS.telegraph, atk.kind === 'ranged' ? 0.6 : 0.4);
        g.lineBetween(e.x, e.y, e.x + e.aimX * length, e.y + e.aimY * length);
      }
    }
  }
  for (const shot of world.enemyShots) {
    g.fillStyle(shot.status === 'soaked' ? COLORS.water : COLORS.dart, 1);
    g.fillCircle(shot.x, shot.y, shot.radius);
  }
  // Aftermath (Elite Voltorb): its ring fills, then it explodes.
  for (const b of world.delayedBlasts) ring(b.x, b.y, b.radius, 1 - b.left / b.total, COLORS.telegraph);
}

/** A filled ring between two radii, in triangles (thick strokes leave seams). */
function fillBand(g: Phaser.GameObjects.Graphics, x: number, y: number, r0: number, r1: number): void {
  const n = 72;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const b = ((i + 1) / n) * Math.PI * 2;
    const [ca, sa, cb, sb] = [Math.cos(a), Math.sin(a), Math.cos(b), Math.sin(b)];
    g.fillTriangle(x + ca * r0, y + sa * r0, x + ca * r1, y + sa * r1, x + cb * r1, y + sb * r1);
    g.fillTriangle(x + ca * r0, y + sa * r0, x + cb * r1, y + sb * r1, x + cb * r0, y + sb * r0);
  }
}

function bossName(id: ArenaBossId): string {
  return ENEMIES[ARENA_BOSSES[id].enemy].name;
}

/** An arena reward card, labelled by the pool it came from (D28). */
function describeReward(world: World, reward: RewardCard): CardView {
  if (reward.pool === 'level') return describeCard(world, reward.card);
  if (reward.pool === 'site') return describeSiteCard(world, reward.card);
  const view = describeAugment(reward.card);
  return { ...view, heading: `${MOVES[world.moves[reward.slot]!.moveId].name} · ${view.heading}` };
}

/** Ring and arrow colour: unknown until rolled, then purple (generic) or gold (Pokémon-bound). */
function siteColor(site: World['sites'][number]): number {
  if (!site.cards) return COLORS.site;
  return site.bound ? COLORS.bond : COLORS.mutation;
}

function describeSiteCard(world: World, card: SiteCard): CardView {
  if (card.kind === 'surge') return describeSurge();
  if (card.kind !== 'mutation' && card.kind !== 'mutationRank') return describeCard(world, card);
  const def = MUTATIONS[card.mutationId];
  // Signature Mutations keep the line's first signature ID; show the current tier's name.
  const moveId = def.kind === 'signature' ? world.moves[0]!.moveId : def.move;
  const move = MOVES[moveId].name;
  const kind = def.kind === 'generic' ? 'MUTATION' : def.kind === 'bond' ? 'BOND' : 'SIGNATURE';
  if (card.kind === 'mutationRank') {
    // D24: the Mutation's own rank text (RANKS.md).
    const change = (def as MutationDef).rankText?.[card.rank - 2] ?? '';
    return {
      heading: `${kind} RANK UP ⬆`,
      title: `${move}: ${def.name} ${RANK_NUMERALS[card.rank - 1]}`,
      body: `${def.text}\n\nRank ${RANK_NUMERALS[card.rank - 1]}: ${change}`,
      color: def.kind === 'generic' ? COLORS.mutation : COLORS.bond,
    };
  }
  return {
    heading: card.learn ? `LEARN + ${kind}` : kind,
    title: `${move}: ${def.name}`,
    body: `${card.learn ? `Learns ${move} with it.\n` : ''}${def.text}`,
    color: def.kind === 'generic' ? COLORS.mutation : COLORS.bond,
  };
}

function describeSkill(slot: MoveSlot): CardView {
  const move = MOVES[slot.moveId];
  return {
    heading: 'MOVE',
    title: move.name,
    body: `${move.tags.join(' · ')}\n\n${socketLines(slot).join('\n')}`,
    color: COLORS.augment,
  };
}

/** `favouredBy`: the move's Mutation when this augment is one of its favoured ones (D24: gold). */
function describeAugment(card: AugmentCard, favouredBy: MutationId | null = null): CardView {
  const def = AUGMENTS[card.augmentId];
  const rankUp = card.rank > 1;
  const exclusive = def.exclusiveTo !== undefined;
  const heading = rankUp
    ? 'RANK UP ⬆'
    : exclusive
      ? 'NEW · EXCLUSIVE'
      : def.kind === 'tradeoff'
        ? 'NEW · TRADE-OFF'
        : def.kind === 'behaviour'
          ? 'NEW · BEHAVIOUR'
          : 'NEW AUGMENT';
  const color = rankUp
    ? COLORS.augment
    : exclusive
      ? COLORS.exclusive
      : def.kind === 'tradeoff'
        ? 0xff6b6b
        : def.kind === 'behaviour'
          ? 0x5dff8a
          : 0x5ad1ff;
  return {
    heading: favouredBy ? `★ FAVOURED · ${heading}` : heading,
    title: augmentLabel(card.augmentId, card.rank),
    body: def.ranks[card.rank - 1]!.text + (favouredBy ? `

Suits ${MUTATIONS[favouredBy].name}.` : ''),
    color: favouredBy ? COLORS.favoured : color,
  };
}

/** The 3 augment sockets, then the Mutation slot (D24: separate from the sockets). */
function socketLines(slot: MoveSlot): string[] {
  const lines: string[] = slot.sockets.map((socket) => `◆ ${augmentLabel(socket.augmentId, socket.rank)}`);
  while (lines.length < MAX_SOCKETS) lines.push('◇ empty');
  lines.push(slot.mutation ? `✦ ${mutationLabel(slot.mutation, slot.mutationRank)}` : '✧ no Mutation');
  return lines;
}

/** Owned Techniques with their rank, plus live state worth watching (D40). */
function techniqueLine(world: World): string {
  const { moxie, endureLeft } = world.tech;
  return world.techniques
    .map(({ id, rank }) => {
      const label = `${TECHNIQUES[id].name} ${RANK_NUMERALS[rank - 1]}`;
      if (id === 'moxie') return `${label} +${Math.round(moxie * 100)}%`;
      if (id === 'endure') return `${label} ${endureLeft > 0 ? `${Math.ceil(endureLeft)} s` : 'ready'}`;
      return label;
    })
    .join(' · ');
}

function formatTime(seconds: number): string {
  const whole = Math.floor(seconds);
  const m = Math.floor(whole / 60);
  const s = whole % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
