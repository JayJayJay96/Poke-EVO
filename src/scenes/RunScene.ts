import Phaser from 'phaser';
import { AUGMENTS, MAX_SOCKETS, RANK_NUMERALS, maxRankOf, type AugmentId } from '../data/augments';
import { ABILITIES, POKEMON, TUNING, type EnemyId, type PokemonId, type PokemonType } from '../data/content';
import { MOVES, type MoveId } from '../data/moves';
import { MUTATION_TUNING, MUTATIONS, type MutationId } from '../data/mutations';
import { bulbCapacity, hooksOf, tideFlood } from '../sim/hooks';
import { wispCount } from '../sim/mutationDefs/ember';
import { BIG_BOOST, BOOST_IDS, BOOST_MAX_PICKS, BOOSTS, ITEMS, POTION_HEAL } from '../data/upgrades';
import { isAbilityActive } from '../sim/combat';
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
  rerollAugments,
  resolvingLevel,
  xpToNext,
} from '../sim/progression';
import {
  cancelMutationReplace,
  chooseMutationReplace,
  grantMutation,
  isMutationId,
  socketsUsed,
} from '../sim/mutations';
import { createRandomSeed, createSeededRng } from '../sim/rng';
import { currentStage } from '../sim/stats';
import { setupStress, topUpStress } from '../sim/stress';
import type { AugmentCard, Card, EvolutionState, InputState, LevelUpOffer, MoveSlot, World } from '../sim/types';
import { createWorld, step } from '../sim/world';

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
  exclusive: 0xff8c42,
  /** Mutation frames: purple for generic, gold for Bond / signature (docs/moveset/README.md). */
  mutation: 0xb46cff,
  puddle: 0x9fd8ff,
  smoke: 0x9a9a9a,
  bulbFull: 0xff7ad9,
  cheek: 0xff3030,
  bond: 0xffc83d,
} as const;
/** Player and move colours by Pokémon type, so each line reads differently in grey-box. */
const TYPE_COLORS: Readonly<Record<PokemonType, number>> = {
  Normal: 0xd8d8c0,
  Fire: 0xff7a2f,
  Water: 0x3d8bff,
  Grass: 0x4cd964,
  Flying: 0xb9c7ff,
  Dragon: 0x7b5cff,
  Poison: 0xb05cff,
  Electric: 0xffe84d,
  Ice: 0x9ff3ff,
  Dark: 0x6b5a4e,
  Steel: 0xb8b8d0,
};
const ENEMY_COLORS: Readonly<Record<EnemyId, number>> = {
  rattata: 0x9b6bc8,
  pidgey: 0xc8a165,
  raticate: 0x8a5a2b,
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
  /** Floating red damage numbers on the player (D12). */
  private floaters: { text: Phaser.GameObjects.Text; lifeLeft: number; y: number }[] = [];
  private lastHp = 0;
  private accumulator = 0;
  private paused = false;
  /** `?stress=1`: maxed build vs 500 enemies (P2d budget check). */
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
    this.world = createWorld({ rng: createSeededRng(createRandomSeed()), pokemonId: this.pokemonId });
    if (import.meta.env.DEV) {
      // Dev-only handle for browser checks; stripped from production builds.
      (window as unknown as { __world?: World }).__world = this.world;
    }
    this.accumulator = 0;
    this.paused = false;
    this.overlay = [];
    this.overlayKey = null;
    this.evoText = null;

    const params = new URLSearchParams(window.location.search);
    this.stress = params.has('stress');
    if (this.stress) {
      const cam = this.cameras.main;
      this.world.spawnRadius = Math.hypot(cam.width, cam.height) / 2 + TUNING.spawn.ringPadding;
      setupStress(this.world);
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
          else if (offer.kind === 'mutationReplace') cancelMutationReplace(world);
        }
      }
    } else if (JustDown(this.keys.restart) && world.status !== 'running') {
      this.scene.restart({ pokemonId: this.pokemonId } satisfies RunSceneData);
      return;
    } else if (JustDown(this.keys.change) && world.status !== 'running') {
      this.scene.start('select');
      return;
    } else if (JustDown(this.keys.pause) && world.status === 'running') {
      this.paused = !this.paused;
    }

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
    this.showSignatureTierUp(time);
    this.syncOverlay(time);
    this.draw();

    this.updatePerf(time, drawStart - simStart, performance.now() - drawStart);
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
    } else if (index < this.world.moves[offer.slot]!.sockets.length) chooseMutationReplace(this.world, index);
    else cancelMutationReplace(this.world);
  }

  /** Debug grant (`?mutate=` or dev `__grantMutation`): grants a Mutation by ID and says what happened. */
  private debugGrant(id: string): string {
    const result = isMutationId(id) ? grantMutation(this.world, id) : 'unknownId';
    const label = isMutationId(id) ? mutationLabel(id) : id;
    const message = result === 'granted' ? `Mutation: ${label}` : result === 'replace' ? `${label}: pick a socket` : `Can't grant ${label}: ${result}`;
    if (result !== 'granted' && result !== 'replace') console.warn(`[mutate] ${message}`);
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
        views = offer.cards.map((card) => describeAugment(card));
        views.push({ heading: 'BACK', title: 'Other move', body: 'Back to choosing a move (Esc).\nSame cards if you return.', color: 0x888888 });
        footer = canReroll(world)
          ? `[R] Reroll (${world.rerollsLeft} left)`
          : `Reroll unavailable (${world.rerollsLeft} left)`;
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
        if (slot.mutation) {
          views.push({
            heading: 'REPLACE MUTATION',
            title: mutationLabel(slot.mutation),
            body: `${MUTATIONS[slot.mutation].text}

→ becomes ${augmentLabel(offer.card.augmentId, 1)}`,
            color: 0xff6b6b,
          });
        }
        views.push({ heading: 'BACK', title: 'Keep all', body: 'Back to the augment cards (Esc)', color: 0x888888 });
        break;
      }
      case 'mutationReplace': {
        const slot = world.moves[offer.slot]!;
        const def = MUTATIONS[offer.mutationId];
        title = `${MOVES[slot.moveId].name}: ${def.name} replaces which augment?`;
        frame = def.kind === 'generic' ? COLORS.mutation : COLORS.bond;
        views = slot.sockets.map((socket) => ({
          heading: 'REPLACE',
          title: augmentLabel(socket.augmentId, socket.rank),
          body: `${AUGMENTS[socket.augmentId].ranks[socket.rank - 1]!.text}

→ becomes ${def.name}`,
          color: 0xff6b6b,
        }));
        views.push({ heading: 'CANCEL', title: 'Keep all', body: `Don't take ${def.name} (Esc)`, color: 0x888888 });
        break;
      }
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
          color: canReroll(world) ? '#ffd34d' : '#888888',
        })
        .setOrigin(0.5, 0)
        .setScrollFactor(0)
        .setDepth(31);
      if (canReroll(world)) {
        foot.setInteractive({ useHandCursor: true }).on('pointerdown', () => rerollAugments(this.world));
      }
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

    // Oran Berries: blue with a white rim, so they read as "heal" (D12).
    for (const berry of berries) {
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

    for (const e of enemies) {
      // Hit flash colour shows type effectiveness (D14): yellow super, grey not very, white neutral.
      const flash =
        e.lastEffectiveness > 1 ? COLORS.superEffective : e.lastEffectiveness < 1 ? COLORS.notVery : COLORS.flash;
      g.fillStyle(e.hitFlashLeft > 0 ? flash : ENEMY_COLORS[e.kind], 1);
      g.fillCircle(e.x, e.y, e.radius);
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
    const { player, time, kills, status, enemies, level, xp, moves, items } = this.world;
    const name = currentStage(this.world).name;
    const moveNames = moves.map((s) => MOVES[s.moveId].name).join(', ');
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
    this.hud.setText(
      `${name} Lv ${level}  HP ${Math.ceil(player.hp)}/${Math.round(player.maxHp)}${abilityTag}   ` +
        `${formatTime(time)} / ${formatTime(TUNING.runSeconds)}   KOs ${kills}   on field ${enemies.length}${tide}\n` +
        `Moves: ${moveNames}   Items: ${itemNames}   (Esc: build)`,
    );

    const cam = this.cameras.main;

    // Visible cost of "damage taken" trade-offs (D12).
    const taken = this.world.mods.damageTakenMult;
    this.warnText.setText(taken > 1.001 ? `⚠ Glass: you take +${Math.round((taken - 1) * 100)}% damage` : '');

    // XP bar across the top edge.
    const h = this.hudGfx;
    h.clear();
    h.fillStyle(COLORS.xpBack, 1);
    h.fillRect(0, 0, cam.width, 6);
    h.fillStyle(COLORS.xpFill, 1);
    h.fillRect(0, 0, (cam.width * xp) / xpToNext(level), 6);

    this.banner.setPosition(cam.width / 2, cam.height / 2);
    this.panel.setPosition(cam.width / 2, cam.height / 2);
    this.panel.setVisible(false);
    if (status === 'survived') {
      this.banner
        .setText(
          `Survived ${formatTime(TUNING.runSeconds)}!\n\nLv ${level} · KOs ${kills}\n\nR: play again · C: change Pokémon`,
        )
        .setVisible(true);
    } else if (status === 'fainted') {
      this.banner
        .setText(
          `${name} fainted!\n\nSurvived ${formatTime(time)} · Lv ${level} · KOs ${kills}\n\nR: restart · C: change Pokémon`,
        )
        .setVisible(true);
    } else if (this.paused) {
      this.banner.setVisible(false);
      this.panel.setText(buildPanelText(this.world)).setVisible(true);
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
      return { heading: 'BOOST', title: `${boost.name} ${next}/${BOOST_MAX_PICKS}`, body: boost.description, color: 0x5ad1ff };
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

function describeSkill(slot: MoveSlot): CardView {
  const move = MOVES[slot.moveId];
  return {
    heading: 'MOVE',
    title: move.name,
    body: `${move.tags.join(' · ')}\n\n${socketLines(slot).join('\n')}`,
    color: COLORS.augment,
  };
}

function describeAugment(card: AugmentCard): CardView {
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
    heading,
    title: augmentLabel(card.augmentId, card.rank),
    body: def.ranks[card.rank - 1]!.text,
    color,
  };
}

function socketLines(slot: MoveSlot): string[] {
  const lines: string[] = slot.sockets.map((socket) => `◆ ${augmentLabel(socket.augmentId, socket.rank)}`);
  if (slot.mutation) lines.push(`✦ ${mutationLabel(slot.mutation)}`);
  while (lines.length < MAX_SOCKETS) lines.push('◇ empty');
  return lines;
}

/** "Slick (Mutation)" or "Steady Aim (Bond · Squirtle)". */
function mutationLabel(id: MutationId): string {
  const def = MUTATIONS[id];
  if (def.kind === 'generic') return `${def.name} (Mutation)`;
  const line = POKEMON[def.line].stages[0]!.name;
  return `${def.name} (${def.kind === 'bond' ? 'Bond' : 'Signature'} · ${line})`;
}

/** "Pierce II"; single-rank augments show just the name. */
function augmentLabel(id: AugmentId, rank: number): string {
  const name = AUGMENTS[id].name;
  return maxRankOf(id) > 1 ? `${name} ${RANK_NUMERALS[rank - 1]}` : name;
}

/** Pause screen: the whole build at a glance. */
function buildPanelText(world: World): string {
  const lines = ['PAUSED — Esc to resume', ''];
  for (const slot of world.moves) {
    const move = MOVES[slot.moveId];
    lines.push(`${move.name} [${move.tags.join('·')}]`);
    lines.push(`   ${socketLines(slot).join('   ')}`);
  }
  const boosts = BOOST_IDS.filter((id) => world.boosts[id] > 0).map((id) => `${BOOSTS[id].name} ${world.boosts[id]}`);
  if (world.bigBoosts > 0) boosts.push(`${BIG_BOOST.name} ×${world.bigBoosts}`);
  lines.push('');
  lines.push(`Boosts: ${boosts.length ? boosts.join(', ') : '—'}`);
  lines.push(`Items: ${world.items.length ? world.items.map((id) => ITEMS[id].name).join(', ') : '—'}`);
  lines.push(`Rerolls left: ${world.rerollsLeft}`);
  return lines.join('\n');
}

function formatTime(seconds: number): string {
  const whole = Math.floor(seconds);
  const m = Math.floor(whole / 60);
  const s = whole % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
