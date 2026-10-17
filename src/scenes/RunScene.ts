import Phaser from 'phaser';
import { AUGMENTS, MAX_SOCKETS, RANK_NUMERALS } from '../data/augments';
import { POKEMON, TUNING, type EnemyId } from '../data/content';
import { MOVES } from '../data/moves';
import { BIG_BOOST, BOOST_IDS, BOOST_MAX_PICKS, BOOSTS, ITEMS, POTION_HEAL } from '../data/upgrades';
import { beamLength } from '../sim/forms/beam';
import { orbitBalls } from '../sim/forms/orbit';
import {
  canReroll,
  chooseAugment,
  chooseCard,
  chooseSkill,
  rerollAugments,
  resolvingLevel,
  xpToNext,
} from '../sim/progression';
import { createRandomSeed, createSeededRng } from '../sim/rng';
import { setupStress, topUpStress } from '../sim/stress';
import type { AugmentCard, Card, InputState, LevelUpOffer, MoveSlot, World } from '../sim/types';
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
} as const;
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
const CARD_MAX_W = 210;
const CARD_H = 170;
const CARD_GAP = 16;
/** Ignore card keys briefly after a window opens so a held key can't pick blindly. */
const CARD_INPUT_DELAY_MS = 250;
/** How often the perf readout refreshes. */
const PERF_REFRESH_MS = 250;
/** Smoothing for the per-frame timing averages. */
const PERF_EMA = 0.1;

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
  | 'pause'
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
  private panel!: Phaser.GameObjects.Text;
  private overlay: Phaser.GameObjects.GameObject[] = [];
  private overlayFor: LevelUpOffer | null = null;
  private overlayOpenedAt = 0;
  private accumulator = 0;
  private paused = false;
  /** `?stress=1`: maxed build vs 500 enemies (P2d budget check). */
  private stress = false;
  private perfText: Phaser.GameObjects.Text | null = null;
  private simMs = 0;
  private drawMs = 0;
  private perfShownAt = 0;

  constructor() {
    super('run');
  }

  create(): void {
    this.world = createWorld({ rng: createSeededRng(createRandomSeed()) });
    if (import.meta.env.DEV) {
      // Dev-only handle for browser checks; stripped from production builds.
      (window as unknown as { __world?: World }).__world = this.world;
    }
    this.accumulator = 0;
    this.paused = false;
    this.overlay = [];
    this.overlayFor = null;

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
      pause: 'ESC',
      one: 'ONE',
      two: 'TWO',
      three: 'THREE',
      four: 'FOUR',
      five: 'FIVE',
    }) as Keys;

    this.gfx = this.add.graphics();
    this.hudGfx = this.add.graphics().setScrollFactor(0).setDepth(9);
    this.hud = this.add
      .text(16, 14, '', { fontFamily: 'monospace', fontSize: '16px', color: '#ffffff', lineSpacing: 4 })
      .setScrollFactor(0)
      .setDepth(10);
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

    if (offer) {
      if (time - this.overlayOpenedAt >= CARD_INPUT_DELAY_MS) {
        const pressed = NUMBER_KEYS.findIndex((name) => JustDown(this.keys[name]));
        if (pressed >= 0) this.pick(pressed);
        else if (JustDown(this.keys.restart) && offer.kind === 'augment') rerollAugments(world);
      }
    } else if (JustDown(this.keys.restart) && world.status !== 'running') {
      this.scene.restart();
      return;
    } else if (JustDown(this.keys.pause) && world.status === 'running') {
      this.paused = !this.paused;
    }

    const cam = this.cameras.main;
    world.spawnRadius = Math.hypot(cam.width, cam.height) / 2 + TUNING.spawn.ringPadding;

    if (this.stress) topUpStress(world);

    const simStart = performance.now();
    if (!this.paused && !world.offer) {
      this.accumulator += Math.min(deltaMs / 1000, MAX_FRAME_SECONDS);
      const input = this.readInput();
      while (this.accumulator >= TUNING.stepSeconds && !world.offer) {
        step(world, input, TUNING.stepSeconds);
        this.accumulator -= TUNING.stepSeconds;
      }
    }
    // Don't bank time while a window is open.
    if (world.offer) this.accumulator = 0;
    const drawStart = performance.now();

    this.syncOverlay(time);
    this.draw();

    this.updatePerf(time, drawStart - simStart, performance.now() - drawStart);
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

  /** Routes a card pick to the right action for the open window. */
  private pick(index: number): void {
    const offer = this.world.offer;
    if (!offer) return;
    if (offer.kind === 'cards') chooseCard(this.world, index);
    else if (offer.kind === 'pickSkill') chooseSkill(this.world, index);
    else chooseAugment(this.world, index);
  }

  private readInput(): InputState {
    const k = this.keys;
    const right = k.right.isDown || k.d.isDown ? 1 : 0;
    const left = k.left.isDown || k.a.isDown ? 1 : 0;
    const down = k.down.isDown || k.s.isDown ? 1 : 0;
    const up = k.up.isDown || k.w.isDown ? 1 : 0;
    return { moveX: right - left, moveY: down - up };
  }

  /** Builds or tears down the level-up window to match the current offer. */
  private syncOverlay(time: number): void {
    const offer = this.world.status === 'running' ? this.world.offer : null;
    if (offer === this.overlayFor) return;
    for (const obj of this.overlay) obj.destroy();
    this.overlay = [];
    this.overlayFor = offer;
    if (!offer) return;
    this.overlayOpenedAt = time;

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
        footer = canReroll(world)
          ? `[R] Reroll (${world.rerollsLeft} left)`
          : `Reroll unavailable (${world.rerollsLeft} left)`;
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

  private draw(): void {
    const { player, enemies, projectiles, gems, swings, moves } = this.world;
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
      g.lineStyle(def.width * slot.stats.area, COLORS.beam, 0.85);
      g.lineBetween(player.x, player.y, player.x + slot.dirX * len, player.y + slot.dirY * len);
    }

    for (const swing of swings) {
      const angle = Math.atan2(swing.dirY, swing.dirX);
      g.fillStyle(COLORS.swing, 0.45 * Math.min(1, swing.lifeLeft / 0.15));
      g.slice(swing.x, swing.y, swing.reach, angle - swing.halfArc, angle + swing.halfArc, false);
      g.fillPath();
    }

    g.fillStyle(COLORS.projectile, 1);
    for (const p of projectiles) g.fillCircle(p.x, p.y, p.radius);

    for (const e of enemies) {
      g.fillStyle(e.hitFlashLeft > 0 ? COLORS.flash : ENEMY_COLORS[e.kind], 1);
      g.fillCircle(e.x, e.y, e.radius);
    }

    for (const slot of moves) {
      const def = MOVES[slot.moveId];
      if (def.form !== 'orbit' || slot.activeLeft <= 0) continue;
      g.fillStyle(COLORS.orbit, 1);
      for (const ball of orbitBalls(slot, def, player)) g.fillCircle(ball.x, ball.y, ball.r);
    }

    // Blink while invulnerable.
    const blinkOff = player.invulnLeft > 0 && Math.floor(this.world.time * 20) % 2 === 0;
    if (!blinkOff) {
      g.fillStyle(player.hurtFlashLeft > 0 ? COLORS.flash : COLORS.player, 1);
      g.fillRect(player.x - player.radius, player.y - player.radius, player.radius * 2, player.radius * 2);
    }

    // HP bar above the player.
    const barW = 36;
    const barY = player.y - player.radius - 10;
    g.fillStyle(COLORS.hpBack, 1);
    g.fillRect(player.x - barW / 2, barY, barW, 5);
    g.fillStyle(COLORS.hpFill, 1);
    g.fillRect(player.x - barW / 2, barY, (barW * player.hp) / player.maxHp, 5);

    this.drawHud();
  }

  private drawHud(): void {
    const { player, time, kills, status, enemies, level, xp, moves, items } = this.world;
    const name = POKEMON[player.pokemonId].name;
    const moveNames = moves.map((s) => MOVES[s.moveId].name).join(', ');
    const itemNames = items.length ? items.map((id) => ITEMS[id].name).join(', ') : '—';
    this.hud.setText(
      `${name} Lv ${level}  HP ${Math.ceil(player.hp)}/${player.maxHp}   ` +
        `${formatTime(time)} / ${formatTime(TUNING.runSeconds)}   KOs ${kills}   on field ${enemies.length}\n` +
        `Moves: ${moveNames}   Items: ${itemNames}   (Esc: build)`,
    );

    const cam = this.cameras.main;

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
        .setText(`Survived ${formatTime(TUNING.runSeconds)}!\n\nLv ${level} · KOs ${kills}\n\nPress R to play again`)
        .setVisible(true);
    } else if (status === 'fainted') {
      this.banner
        .setText(`${name} fainted!\n\nSurvived ${formatTime(time)} · Lv ${level} · KOs ${kills}\n\nPress R to restart`)
        .setVisible(true);
    } else if (this.paused) {
      this.banner.setVisible(false);
      this.panel.setText(buildPanelText(this.world)).setVisible(true);
    } else {
      this.banner.setVisible(false);
    }
  }
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
  return {
    heading: rankUp ? 'RANK UP ⬆' : def.kind === 'tradeoff' ? 'NEW · TRADE-OFF' : 'NEW AUGMENT',
    title: `${def.name} ${RANK_NUMERALS[card.rank - 1]}`,
    body: def.ranks[card.rank - 1].text,
    color: rankUp ? COLORS.augment : def.kind === 'tradeoff' ? 0xff6b6b : 0x5ad1ff,
  };
}

function socketLines(slot: MoveSlot): string[] {
  const lines: string[] = [];
  for (let i = 0; i < MAX_SOCKETS; i++) {
    const socket = slot.sockets[i];
    lines.push(socket ? `◆ ${AUGMENTS[socket.augmentId].name} ${RANK_NUMERALS[socket.rank - 1]}` : '◇ empty');
  }
  return lines;
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
