import Phaser from 'phaser';
import { POKEMON, TUNING, type EnemyId } from '../data/content';
import { MOVES } from '../data/moves';
import { BOOST_MAX_PICKS, BOOSTS, ITEMS, POTION_HEAL } from '../data/upgrades';
import { beamLength } from '../sim/forms/beam';
import { orbitBalls } from '../sim/forms/orbit';
import { chooseCard, xpToNext } from '../sim/progression';
import { createRandomSeed, createSeededRng } from '../sim/rng';
import type { Card, InputState, LevelUpOffer, World } from '../sim/types';
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
const CARD_W = 210;
const CARD_H = 170;
const CARD_GAP = 18;
/** Ignore card keys briefly after the window opens so a held key can't pick blindly. */
const CARD_INPUT_DELAY_MS = 250;

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
  | 'one'
  | 'two'
  | 'three';
type Keys = Record<KeyName, Phaser.Input.Keyboard.Key>;

export class RunScene extends Phaser.Scene {
  private world!: World;
  private keys!: Keys;
  private gfx!: Phaser.GameObjects.Graphics;
  private hudGfx!: Phaser.GameObjects.Graphics;
  private hud!: Phaser.GameObjects.Text;
  private banner!: Phaser.GameObjects.Text;
  private overlay: Phaser.GameObjects.GameObject[] = [];
  private overlayFor: LevelUpOffer | null = null;
  private overlayOpenedAt = 0;
  private accumulator = 0;
  private paused = false;

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
  }

  update(time: number, deltaMs: number): void {
    const { JustDown } = Phaser.Input.Keyboard;
    const { world } = this;

    if (JustDown(this.keys.restart) && world.status !== 'running') {
      this.scene.restart();
      return;
    }

    if (world.offer && world.status === 'running') {
      if (time - this.overlayOpenedAt >= CARD_INPUT_DELAY_MS) {
        if (JustDown(this.keys.one)) this.choose(0);
        else if (JustDown(this.keys.two)) this.choose(1);
        else if (JustDown(this.keys.three)) this.choose(2);
      }
    } else if (JustDown(this.keys.pause) && world.status === 'running') {
      this.paused = !this.paused;
    }

    const cam = this.cameras.main;
    world.spawnRadius = Math.hypot(cam.width, cam.height) / 2 + TUNING.spawn.ringPadding;

    if (!this.paused && !world.offer) {
      this.accumulator += Math.min(deltaMs / 1000, MAX_FRAME_SECONDS);
      const input = this.readInput();
      while (this.accumulator >= TUNING.stepSeconds && !world.offer) {
        step(world, input, TUNING.stepSeconds);
        this.accumulator -= TUNING.stepSeconds;
      }
    }
    // Don't bank time while the card window is open.
    if (world.offer) this.accumulator = 0;

    this.syncOverlay(time);
    this.draw();
  }

  private choose(index: number): void {
    if (!this.world.offer) return;
    chooseCard(this.world, index);
  }

  private readInput(): InputState {
    const k = this.keys;
    const right = k.right.isDown || k.d.isDown ? 1 : 0;
    const left = k.left.isDown || k.a.isDown ? 1 : 0;
    const down = k.down.isDown || k.s.isDown ? 1 : 0;
    const up = k.up.isDown || k.w.isDown ? 1 : 0;
    return { moveX: right - left, moveY: down - up };
  }

  /** Builds or tears down the level-up card window to match the current offer. */
  private syncOverlay(time: number): void {
    const offer = this.world.status === 'running' ? this.world.offer : null;
    if (offer === this.overlayFor) return;
    for (const obj of this.overlay) obj.destroy();
    this.overlay = [];
    this.overlayFor = offer;
    if (!offer) return;

    this.overlayOpenedAt = time;
    const cam = this.cameras.main;
    const dim = this.add
      .rectangle(0, 0, cam.width, cam.height, 0x000000, 0.6)
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(30);
    const cardsTop = Math.max(40, cam.height / 2 - CARD_H / 2 + 10);
    const title = this.add
      .text(cam.width / 2, cardsTop - 12, `Level ${this.world.level}!  Pick one: 1 / 2 / 3`, {
        fontFamily: 'monospace',
        fontSize: '20px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5, 1)
      .setScrollFactor(0)
      .setDepth(31);
    this.overlay.push(dim, title);

    const n = offer.cards.length;
    const startX = cam.width / 2 - (n * CARD_W + (n - 1) * CARD_GAP) / 2;
    offer.cards.forEach((card, i) => {
      const d = describeCard(this.world, card);
      const x = startX + i * (CARD_W + CARD_GAP);
      const bg = this.add
        .rectangle(x, cardsTop, CARD_W, CARD_H, COLORS.cardBg, 0.97)
        .setOrigin(0)
        .setStrokeStyle(2, d.color)
        .setScrollFactor(0)
        .setDepth(31)
        .setInteractive({ useHandCursor: true });
      bg.on('pointerdown', () => this.choose(i));
      const text = this.add
        .text(x + 12, cardsTop + 10, `[${i + 1}] ${d.heading}\n\n${d.title}\n\n${d.body}`, {
          fontFamily: 'monospace',
          fontSize: '14px',
          color: '#ffffff',
          lineSpacing: 2,
          wordWrap: { width: CARD_W - 24 },
        })
        .setScrollFactor(0)
        .setDepth(32);
      this.overlay.push(bg, text);
    });
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
        `Moves: ${moveNames}   Items: ${itemNames}`,
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
    if (status === 'survived') {
      this.banner
        .setText(`Survived ${formatTime(TUNING.runSeconds)}!\n\nLv ${level} · KOs ${kills}\n\nPress R to play again`)
        .setVisible(true);
    } else if (status === 'fainted') {
      this.banner
        .setText(`${name} fainted!\n\nSurvived ${formatTime(time)} · Lv ${level} · KOs ${kills}\n\nPress R to restart`)
        .setVisible(true);
    } else if (this.paused) {
      this.banner.setText('Paused\n\nEsc to resume').setVisible(true);
    } else {
      this.banner.setVisible(false);
    }
  }
}

interface CardText {
  heading: string;
  title: string;
  body: string;
  color: number;
}

function describeCard(world: World, card: Card): CardText {
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
  }
}

function formatTime(seconds: number): string {
  const whole = Math.floor(seconds);
  const m = Math.floor(whole / 60);
  const s = whole % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
