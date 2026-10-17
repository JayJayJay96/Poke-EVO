import Phaser from 'phaser';
import { POKEMON, TUNING, type EnemyId } from '../data/content';
import { createRandomSeed, createSeededRng } from '../sim/rng';
import type { InputState, World } from '../sim/types';
import { createWorld, step, xpToNext } from '../sim/world';

// Grey-box colours until real sprites arrive in P6.
const COLORS = {
  grid: 0x26331f,
  player: 0xff7a2f,
  flash: 0xffffff,
  projectile: 0xffb347,
  hpBack: 0x3a1e1e,
  hpFill: 0x4cd964,
  gem: 0x5ad1ff,
  bigGem: 0x5dff8a,
  xpBack: 0x10202a,
  xpFill: 0x5ad1ff,
} as const;
const ENEMY_COLORS: Readonly<Record<EnemyId, number>> = {
  rattata: 0x9b6bc8,
  pidgey: 0xc8a165,
  raticate: 0x8a5a2b,
};
/** Gems worth at least this much draw bigger and green. */
const BIG_GEM_VALUE = 5;
const TOAST_SECONDS = 1.2;
const GRID_SIZE = 64;
/** Cap on simulated time per frame so a hitch never fast-forwards the run. */
const MAX_FRAME_SECONDS = 0.25;

type KeyName = 'up' | 'down' | 'left' | 'right' | 'w' | 'a' | 's' | 'd' | 'restart' | 'pause';
type Keys = Record<KeyName, Phaser.Input.Keyboard.Key>;

export class RunScene extends Phaser.Scene {
  private world!: World;
  private keys!: Keys;
  private gfx!: Phaser.GameObjects.Graphics;
  private hudGfx!: Phaser.GameObjects.Graphics;
  private hud!: Phaser.GameObjects.Text;
  private banner!: Phaser.GameObjects.Text;
  private toast!: Phaser.GameObjects.Text;
  private toastLeft = 0;
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
    }) as Keys;

    this.toastLeft = 0;
    this.gfx = this.add.graphics();
    this.hudGfx = this.add.graphics().setScrollFactor(0).setDepth(9);
    this.hud = this.add
      .text(16, 14, '', { fontFamily: 'monospace', fontSize: '18px', color: '#ffffff' })
      .setScrollFactor(0)
      .setDepth(10);
    this.toast = this.add
      .text(0, 64, '', { fontFamily: 'monospace', fontSize: '24px', color: '#5ad1ff', fontStyle: 'bold' })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(15)
      .setAlpha(0);
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

  update(_time: number, deltaMs: number): void {
    const { JustDown } = Phaser.Input.Keyboard;
    if (JustDown(this.keys.pause) && this.world.status === 'running') this.paused = !this.paused;
    if (JustDown(this.keys.restart) && this.world.status !== 'running') {
      this.scene.restart();
      return;
    }

    const cam = this.cameras.main;
    this.world.spawnRadius = Math.hypot(cam.width, cam.height) / 2 + TUNING.spawn.ringPadding;

    if (!this.paused) {
      this.accumulator += Math.min(deltaMs / 1000, MAX_FRAME_SECONDS);
      const input = this.readInput();
      while (this.accumulator >= TUNING.stepSeconds) {
        step(this.world, input, TUNING.stepSeconds);
        this.accumulator -= TUNING.stepSeconds;
      }
    }

    // Until the card window exists (P2b), a level-up is just announced.
    if (this.world.pendingLevelUps > 0) {
      this.world.pendingLevelUps = 0;
      this.toast.setText(`LEVEL UP!  Lv ${this.world.level}`);
      this.toastLeft = TOAST_SECONDS;
    }
    this.toastLeft = Math.max(0, this.toastLeft - deltaMs / 1000);

    this.draw();
  }

  private readInput(): InputState {
    const k = this.keys;
    const right = k.right.isDown || k.d.isDown ? 1 : 0;
    const left = k.left.isDown || k.a.isDown ? 1 : 0;
    const down = k.down.isDown || k.s.isDown ? 1 : 0;
    const up = k.up.isDown || k.w.isDown ? 1 : 0;
    return { moveX: right - left, moveY: down - up };
  }

  private draw(): void {
    const { player, enemies, projectiles, gems } = this.world;
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

    g.fillStyle(COLORS.projectile, 1);
    for (const p of projectiles) g.fillCircle(p.x, p.y, p.radius);

    for (const e of enemies) {
      g.fillStyle(e.hitFlashLeft > 0 ? COLORS.flash : ENEMY_COLORS[e.kind], 1);
      g.fillCircle(e.x, e.y, e.radius);
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
    const { player, time, kills, status, enemies, level, xp } = this.world;
    const name = POKEMON[player.pokemonId].name;
    this.hud.setText(
      `${name} Lv ${level}  HP ${Math.ceil(player.hp)}/${player.maxHp}   ` +
        `${formatTime(time)} / ${formatTime(TUNING.runSeconds)}   KOs ${kills}   on field ${enemies.length}`,
    );

    const cam = this.cameras.main;

    // XP bar across the top edge.
    const h = this.hudGfx;
    h.clear();
    h.fillStyle(COLORS.xpBack, 1);
    h.fillRect(0, 0, cam.width, 6);
    h.fillStyle(COLORS.xpFill, 1);
    h.fillRect(0, 0, (cam.width * xp) / xpToNext(level), 6);

    this.toast.setPosition(cam.width / 2, 64).setAlpha(Math.min(1, this.toastLeft / 0.4));

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

function formatTime(seconds: number): string {
  const whole = Math.floor(seconds);
  const m = Math.floor(whole / 60);
  const s = whole % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
