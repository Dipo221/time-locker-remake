import { COLOR, PUBLIC_URL, SHOT_COLORS, VIEW_H, VIEW_W } from '../config';
import type { UiRect } from '../core/input';
import { saveMeta } from '../game/MetaState';
import { weaponFamily } from '../game/weapons/compile';
import type { WeaponId } from '../game/weapons/types';
import { drawWorld } from '../render/drawWorld';
import { roundRect } from '../render/ui';
import { drawWeaponIcon } from '../render/weaponIcon';
import type { Scene, SceneCtx } from './scene';

const SHARE: UiRect = { id: 'share', x: 24, y: 836, w: 246, h: 88 };
const LOBBY: UiRect = { id: 'lobby', x: 282, y: 836, w: 104, h: 88 };
const AGAIN: UiRect = { id: 'again', x: 398, y: 836, w: 118, h: 88 };

/** The close-up: how far in, how long the push-in takes, and where it lands. */
const ZOOM = 2.3;
const ZOOM_SEC = 0.7;
const FOCUS_X = VIEW_W * 0.4;
const FOCUS_Y = VIEW_H * 0.6;

/** Weapon tiles, two columns down the right-hand side. */
const TILE_W = 112;
const TILE_H = 44;
const TILE_GAP = 8;
const TILES_X = VIEW_W - 24 - TILE_W * 2 - TILE_GAP;
const TILES_Y = 420;

const INK = COLOR.ink;
const WHITE = '#ffffff';
/** The original's heavy italic numerals. */
const HEAVY = 'italic 900';

/**
 * End of a run, laid out after the original: the score huge over a close-up
 * of where it ended, the loadout as a grid of tiles, and SHARE beside PLAY.
 *
 * The original's close-up is a 3D camera. This is the same idea in 2D: the
 * frozen world, magnified around the spot you died and pushed into over the
 * first moments. Whatever got you is in frame.
 *
 * Banking happens exactly once, on entry, so coins cannot be collected twice
 * by lingering here.
 */
export class ResultScene implements Scene {
  readonly id = 'result' as const;

  private score = 0;
  private prevBest = 0;
  private picked = 0;
  private bonus = 0;
  private total = 0;
  private best = false;
  private bosses = 0;
  private focusX = 0;
  private focusY = 0;
  private stacks: [WeaponId, number][] = [];
  private t = 0;

  /** The shareable picture, made once the close-up has settled. */
  private shareFile: File | null = null;
  private capturing = false;
  private captureQueued = false;
  private toast = '';
  private toastFor = 0;
  private detach: (() => void) | null = null;

  enter(ctx: SceneCtx): void {
    const { world, meta } = ctx;
    this.score = world.score;
    this.prevBest = meta.highScore;
    this.picked = world.coins;
    this.bonus = meta.scoreBonus(world.score);
    this.best = world.score > meta.highScore;
    this.bosses = world.bossesDefeated;
    this.focusX = world.player.x;
    this.focusY = world.player.y + 40;
    this.stacks = [...world.stacks];
    this.t = 0;
    this.shareFile = null;
    this.captureQueued = false;
    this.toastFor = 0;

    this.total = meta.bankRun(world.score, world.coins);
    saveMeta(meta);

    ctx.input.setUiRects([SHARE, LOBBY, AGAIN]);

    // SHARE answers on the finger LIFTING, not on the press the rest of the
    // UI uses: a phone only opens the share sheet from inside the event that
    // ends a tap, and the press has long gone by the time a frame runs.
    //
    // Only a press that STARTED on the button counts. A run usually ends
    // mid-drag, and the finger that was steering lifts here - wherever it
    // happens to be. Without this, dying with your thumb low on the screen
    // opened the share sheet.
    const canvas = ctx.vp.canvas;
    const onShare = (e: PointerEvent): boolean => {
      const x = ctx.vp.clientToDesignX(e.clientX);
      const y = ctx.vp.clientToDesignY(e.clientY);
      return x >= SHARE.x && x <= SHARE.x + SHARE.w && y >= SHARE.y && y <= SHARE.y + SHARE.h;
    };
    let armed = false;
    const onDown = (e: PointerEvent): void => {
      armed = onShare(e);
    };
    const onUp = (e: PointerEvent): void => {
      if (armed && onShare(e)) this.share();
      armed = false;
    };
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointerup', onUp);
    this.detach = () => {
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointerup', onUp);
    };
  }

  exit(ctx: SceneCtx): void {
    this.detach?.();
    this.detach = null;
    ctx.input.setUiRects([]);
  }

  update(ctx: SceneCtx, realDt: number): void {
    this.t += realDt;
    if (this.toastFor > 0) this.toastFor -= realDt;

    // Drain input so nothing banks up for the next scene.
    ctx.input.beginFrame(realDt);
    ctx.input.consumeCancel();

    if (this.t >= ZOOM_SEC && !this.captureQueued) {
      this.captureQueued = true;
      this.capture(ctx);
    }

    const tap = ctx.input.consumeTap();
    if (tap === 'again') {
      ctx.world.reset();
      ctx.go('game');
    } else if (tap === 'lobby') {
      ctx.go('lobby');
    }
    // 'share' is handled on pointerup; see enter().
  }

  render(ctx: SceneCtx): void {
    const { vp, world, clock, meta } = ctx;
    const c = vp.ctx;

    const k = Math.min(1, this.t / ZOOM_SEC);
    const ease = 1 - (1 - k) * (1 - k) * (1 - k);
    drawWorld(vp, world, clock, {
      fx: this.focusX,
      fy: this.focusY,
      zoom: 1 + (ZOOM - 1) * ease,
      sx: VIEW_W / 2 + (FOCUS_X - VIEW_W / 2) * ease,
      sy: VIEW_H / 2 + (FOCUS_Y - VIEW_H / 2) * ease,
    });

    vp.applyUi();
    c.save();
    c.beginPath();
    c.rect(0, 0, VIEW_W, VIEW_H);
    c.clip();

    // A dusk sky behind the numbers, as in the original, so white text holds
    // up over whatever the close-up shows.
    const sky = c.createLinearGradient(0, 0, 0, 440);
    sky.addColorStop(0, 'rgba(24, 28, 40, 0.94)');
    sky.addColorStop(0.72, 'rgba(24, 28, 40, 0.78)');
    sky.addColorStop(1, 'rgba(24, 28, 40, 0)');
    c.fillStyle = sky;
    c.fillRect(0, 0, VIEW_W, 440);

    this.renderHeader(c, meta.coins);
    this.renderScore(c);
    this.renderTiles(c);

    if (this.capturing) {
      this.renderShareFooter(c);
    } else {
      this.renderButtons(c);
      if (this.toastFor > 0) {
        c.globalAlpha = Math.min(1, this.toastFor);
        c.fillStyle = INK;
        roundRect(c, 60, 778, VIEW_W - 120, 40, 20);
        c.fill();
        text(c, this.toast, VIEW_W / 2, 798, `600 16px ui-sans-serif, system-ui, sans-serif`, WHITE, 'center');
        c.globalAlpha = 1;
      }
    }

    c.restore();
  }

  // ------------------------------------------------------------ layout
  private renderHeader(c: CanvasRenderingContext2D, coins: number): void {
    text(c, `TOP ${this.prevBest}`, 24, 38, `${HEAVY} 22px ui-sans-serif, system-ui, sans-serif`, WHITE);
    text(c, String(this.score), 24, 76, `${HEAVY} 38px ui-sans-serif, system-ui, sans-serif`, WHITE);

    // Coins: the bank, a green C badge, and what this run paid in.
    const bx = VIEW_W - 24 - 40;
    c.fillStyle = COLOR.enemyGreen;
    roundRect(c, bx, 38, 40, 40, 6);
    c.fill();
    text(c, 'C', bx + 20, 59, `900 26px ui-sans-serif, system-ui, sans-serif`, WHITE, 'center');
    text(c, String(coins), bx - 10, 60, `${HEAVY} 38px ui-sans-serif, system-ui, sans-serif`, WHITE, 'right');
    text(c, `+${this.total}`, VIEW_W - 24, 100, `${HEAVY} 20px ui-sans-serif, system-ui, sans-serif`, '#7fe3a8', 'right');
  }

  private renderScore(c: CanvasRenderingContext2D): void {
    if (this.best) {
      text(c, 'NEW TOP !', VIEW_W / 2, 158, `${HEAVY} 36px ui-sans-serif, system-ui, sans-serif`, WHITE, 'center');
    }
    // As large as fits: a long run's score is seven digits.
    const s = String(this.score);
    let size = 118;
    c.font = `${HEAVY} ${size}px ui-sans-serif, system-ui, sans-serif`;
    const w = c.measureText(s).width;
    if (w > VIEW_W - 40) size = Math.floor((size * (VIEW_W - 40)) / w);
    text(c, s, VIEW_W / 2, 240, `${HEAVY} ${size}px ui-sans-serif, system-ui, sans-serif`, WHITE, 'center');

    text(c, `BOSSES ${this.bosses}`, VIEW_W / 2, 318, `${HEAVY} 32px ui-sans-serif, system-ui, sans-serif`, WHITE, 'center');
    // Broken out, so it is obvious that scoring higher is what pays.
    text(
      c,
      `+${this.total} coins  (${this.picked} picked up + ${this.bonus} for score)`,
      VIEW_W / 2,
      354,
      `600 14px ui-monospace, Menlo, Consolas, monospace`,
      'rgba(255, 255, 255, 0.78)',
      'center',
    );
  }

  private renderTiles(c: CanvasRenderingContext2D): void {
    for (let i = 0; i < this.stacks.length; i++) {
      const [id, n] = this.stacks[i];
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = TILES_X + col * (TILE_W + TILE_GAP);
      const y = TILES_Y + row * (TILE_H + TILE_GAP);
      const fam = SHOT_COLORS[weaponFamily(id)];

      c.fillStyle = INK;
      roundRect(c, x, y, TILE_W, TILE_H, 8);
      c.fill();
      // The shot colour, as on the in-run chips, so the two read as one.
      c.fillStyle = fam.body;
      roundRect(c, x, y, 6, TILE_H, 3);
      c.fill();

      drawWeaponIcon(c, id, x + 36, y + TILE_H / 2, 34, WHITE, INK);
      text(c, String(n), x + TILE_W - 12, y + TILE_H / 2 + 1, `${HEAVY} 28px ui-sans-serif, system-ui, sans-serif`, WHITE, 'right');
    }
  }

  private renderButtons(c: CanvasRenderingContext2D): void {
    // SHARE: the original's magenta block, in this game's own magenta.
    c.fillStyle = COLOR.player;
    roundRect(c, SHARE.x, SHARE.y, SHARE.w, SHARE.h, 10);
    c.fill();
    text(c, 'SHARE', SHARE.x + 20, SHARE.y + 36, `${HEAVY} 32px ui-sans-serif, system-ui, sans-serif`, WHITE);
    text(c, 'image + score', SHARE.x + 21, SHARE.y + 64, `600 14px ui-sans-serif, system-ui, sans-serif`, 'rgba(255, 255, 255, 0.85)');
    shareGlyph(c, SHARE.x + SHARE.w - 50, SHARE.y + SHARE.h / 2);

    c.fillStyle = INK;
    roundRect(c, LOBBY.x, LOBBY.y, LOBBY.w, LOBBY.h, 10);
    c.fill();
    text(c, 'LOBBY', LOBBY.x + LOBBY.w / 2, LOBBY.y + LOBBY.h / 2 + 1, `${HEAVY} 22px ui-sans-serif, system-ui, sans-serif`, WHITE, 'center');

    c.fillStyle = COLOR.playerShot;
    roundRect(c, AGAIN.x, AGAIN.y, AGAIN.w, AGAIN.h, 10);
    c.fill();
    const px = AGAIN.x + AGAIN.w / 2 + 4;
    const py = AGAIN.y + AGAIN.h / 2;
    c.fillStyle = WHITE;
    c.beginPath();
    c.moveTo(px - 14, py - 20);
    c.lineTo(px + 18, py);
    c.lineTo(px - 14, py + 20);
    c.closePath();
    c.fill();
  }

  /** Where the buttons go on screen, the shared picture says what it is. */
  private renderShareFooter(c: CanvasRenderingContext2D): void {
    c.fillStyle = 'rgba(24, 28, 40, 0.92)';
    c.fillRect(0, 836, VIEW_W, VIEW_H - 836);
    text(c, 'TIME LOCKER REMAKE', VIEW_W / 2, 878, `${HEAVY} 28px ui-sans-serif, system-ui, sans-serif`, WHITE, 'center');
    text(c, PUBLIC_URL.replace(/^https:\/\//, '').replace(/\/$/, ''), VIEW_W / 2, 914, `600 15px ui-monospace, Menlo, Consolas, monospace`, 'rgba(255, 255, 255, 0.8)', 'center');
  }

  // ------------------------------------------------------------ sharing
  /**
   * Renders the screen once without its buttons, copies the play rect out,
   * and keeps it as a PNG. All within one frame, before the browser paints,
   * so the button-less version is never seen. Prepared ahead of time because
   * the share itself must happen synchronously inside the tap.
   */
  private capture(ctx: SceneCtx): void {
    const vp = ctx.vp;
    this.capturing = true;
    this.render(ctx);
    this.capturing = false;

    const s = vp.dpr * vp.scale;
    const sw = Math.round(VIEW_W * s);
    const sh = Math.round(VIEW_H * s);
    const out = document.createElement('canvas');
    // Design resolution doubled at most: crisp, and a sensible file size.
    const k = Math.min(2, sw / VIEW_W);
    out.width = Math.round(VIEW_W * k);
    out.height = Math.round(VIEW_H * k);
    const oc = out.getContext('2d');
    if (oc === null) return;
    oc.drawImage(vp.canvas, Math.round(vp.offsetX * vp.dpr), Math.round(vp.offsetY * vp.dpr), sw, sh, 0, 0, out.width, out.height);

    const score = this.score;
    out.toBlob((blob) => {
      if (blob === null) return;
      try {
        this.shareFile = new File([blob], `time-locker-remake-${score}.png`, { type: 'image/png' });
      } catch {
        /* no File constructor: share text instead */
      }
    }, 'image/png');
  }

  private share(): void {
    const title = 'Time Locker Remake';
    const words = `${this.best ? 'NEW TOP! ' : ''}I scored ${this.score} in Time Locker Remake!`;
    const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };

    const copy = (): void => {
      const done = (): void => this.say('Copied - paste it to your friends');
      const fail = (): void => this.say('Sharing is not available here');
      try {
        navigator.clipboard.writeText(`${words} ${PUBLIC_URL}`).then(done, fail);
      } catch {
        fail();
      }
    };
    const failed = (err: unknown): void => {
      // Closing the share sheet is a choice, not an error.
      if (err instanceof DOMException && err.name === 'AbortError') return;
      copy();
    };

    try {
      const file = this.shareFile;
      if (file !== null && nav.canShare?.({ files: [file] }) === true) {
        nav.share({ files: [file], title, text: `${words} ${PUBLIC_URL}` }).catch(failed);
      } else if (typeof nav.share === 'function') {
        nav.share({ title, text: words, url: PUBLIC_URL }).catch(failed);
      } else {
        copy();
      }
    } catch (err) {
      failed(err);
    }
  }

  private say(msg: string): void {
    this.toast = msg;
    this.toastFor = 2.5;
  }
}

function text(
  c: CanvasRenderingContext2D,
  s: string,
  x: number,
  y: number,
  font: string,
  color: string,
  align: CanvasTextAlign = 'left',
): void {
  c.font = font;
  c.fillStyle = color;
  c.textAlign = align;
  c.textBaseline = 'middle';
  c.fillText(s, x, y);
}

/** The usual share mark: a tray with an arrow leaving it. */
function shareGlyph(c: CanvasRenderingContext2D, x: number, y: number): void {
  c.fillStyle = 'rgba(0, 0, 0, 0.16)';
  roundRect(c, x - 34, y - 32, 68, 64, 10);
  c.fill();
  c.strokeStyle = WHITE;
  c.lineWidth = 3.5;
  c.lineCap = 'round';
  c.lineJoin = 'round';
  c.beginPath();
  c.moveTo(x - 8, y - 4);
  c.lineTo(x - 16, y - 4);
  c.lineTo(x - 16, y + 16);
  c.lineTo(x + 16, y + 16);
  c.lineTo(x + 16, y - 4);
  c.lineTo(x + 8, y - 4);
  c.moveTo(x, y + 6);
  c.lineTo(x, y - 18);
  c.moveTo(x - 8, y - 10);
  c.lineTo(x, y - 18);
  c.lineTo(x + 8, y - 10);
  c.stroke();
}
