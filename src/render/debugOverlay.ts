import type { Clock } from '../core/clock';
import {
  DARKNESS_BASE_SPEED,
  TS_MAX,
  TS_SPEED_DEADZONE,
  TS_SPEED_FULL,
  VIEW_W,
} from '../config';
import type { TimeScaleController } from '../core/timeScale';
import type { World } from '../game/World';
import type { Viewport } from './viewport';

const SPARK_N = 150;
const FPS_N = 60;

/**
 * Dev readouts. Toggle with the backquote key.
 *
 * The timeScale row is the single most important readout in the project, and
 * the `v inst / smooth` row next to it is what separates "my input is noisy"
 * from "my curve is wrong".
 *
 * The `gap` / `t-death` row quantifies the chase, and the `escape ts` row shows
 * the central balance relationship: the time scale you get when moving at
 * exactly the darkness's speed. Target band 0.10-0.25.
 */
export class DebugOverlay {
  visible = true;

  private readonly fps = new Float32Array(FPS_N);
  private fi = 0;
  private readonly spark = new Float32Array(SPARK_N);
  private spi = 0;

  sample(clock: Clock): void {
    this.fps[this.fi] = clock.real > 0 ? 1 / clock.real : 0;
    this.fi = (this.fi + 1) % FPS_N;
    this.spark[this.spi] = clock.timeScale;
    this.spi = (this.spi + 1) % SPARK_N;
  }

  private avgFps(): number {
    let s = 0;
    let n = 0;
    for (let i = 0; i < FPS_N; i++) {
      if (this.fps[i] > 0) {
        s += this.fps[i];
        n++;
      }
    }
    return n > 0 ? s / n : 0;
  }

  /** 1% low, which catches GC hitches that an average hides. */
  private lowFps(): number {
    let lo = Infinity;
    for (let i = 0; i < FPS_N; i++) {
      if (this.fps[i] > 0 && this.fps[i] < lo) lo = this.fps[i];
    }
    return lo === Infinity ? 0 : lo;
  }

  /** The time scale produced by moving at exactly the darkness's speed. */
  private escapeTimeScale(speed: number): number {
    const n = Math.max(
      0,
      Math.min(
        1,
        (speed - TS_SPEED_DEADZONE) / (TS_SPEED_FULL - TS_SPEED_DEADZONE),
      ),
    );
    return TS_MAX * Math.pow(n, 0.75);
  }

  draw(
    vp: Viewport,
    w: World,
    tsc: TimeScaleController,
    clock: Clock,
  ): void {
    if (!this.visible) return;
    const ctx = vp.ctx;
    vp.applyUi();

    const x = 18;
    // Clear of the boss health bar, which sits just under the coin count.
    let y = 174;
    const lh = 19;

    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.font = '13px ui-monospace, Menlo, Consolas, monospace';

    const panelH = 232;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.82)';
    ctx.fillRect(x - 10, y - 10, 290, panelH);
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.12)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x - 10, y - 10, 290, panelH);

    const line = (s: string, dim = false): void => {
      ctx.fillStyle = dim ? '#8a857c' : '#1e2024';
      ctx.fillText(s, x, y);
      y += lh;
    };

    const gap = w.darkness.gapTo(w.player.y);
    const tDeath = w.darkness.timeToReach(w.player.y);
    const escTs = this.escapeTimeScale(DARKNESS_BASE_SPEED);

    line(
      `fps ${this.avgFps().toFixed(0)}  low ${this.lowFps().toFixed(0)}  dt ${(
        clock.real * 1000
      ).toFixed(1)}ms`,
    );
    line(`timeScale ${clock.timeScale.toFixed(3)}`);
    y += 2;
    this.drawBarAndSpark(ctx, x, y, clock.timeScale);
    y += 46;
    line(
      `v inst ${tsc.vInst.toFixed(0)}  smooth ${tsc.vSmooth.toFixed(0)} u/s`,
      true,
    );
    line(`player ${w.player.speed.toFixed(0)} u/s   y ${w.player.y.toFixed(0)}`, true);
    y += 2;
    line(`gap ${gap.toFixed(0)}   t-death ${tDeath.toFixed(1)}s`);
    line(`dark spd ${w.darkness.speed.toFixed(0)}  escape ts ${escTs.toFixed(3)}`, true);
    y += 2;
    line(
      `pshot ${w.playerShots.count}/${w.playerShots.capacity} hi ${w.playerShots.highWater} miss ${w.playerShots.misses}`,
      true,
    );
    line(
      `eshot ${w.enemyShots.count}/${w.enemyShots.capacity} hi ${w.enemyShots.highWater} miss ${w.enemyShots.misses}`,
      true,
    );
    line(`phase ${w.phase}`, true);
  }

  private drawBarAndSpark(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    ts: number,
  ): void {
    const w = 268;
    const h = 10;

    // Bar.
    ctx.fillStyle = 'rgba(0,0,0,0.08)';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#2b6cf6';
    ctx.fillRect(x, y, (w * Math.min(ts, TS_MAX)) / TS_MAX, h);
    // Mark timeScale = 1.
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(x + w / TS_MAX - 1, y - 2, 2, h + 4);

    // Sparkline. A steady drag should read as a near-flat line; a sawtooth
    // means the release tau is too low or events are not being coalesced.
    const sy = y + h + 4;
    const sh = 26;
    ctx.fillStyle = 'rgba(0,0,0,0.05)';
    ctx.fillRect(x, sy, w, sh);
    ctx.strokeStyle = '#2b6cf6';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < SPARK_N; i++) {
      const v = this.spark[(this.spi + i) % SPARK_N];
      const px = x + (i / (SPARK_N - 1)) * w;
      const py = sy + sh - (Math.min(v, TS_MAX) / TS_MAX) * sh;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }
}

/** Hint drawn on the first run so the control scheme is discoverable. */
export function drawHint(vp: Viewport, show: boolean): void {
  if (!show) return;
  const ctx = vp.ctx;
  vp.applyUi();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#8a857c';
  ctx.font = '500 26px ui-sans-serif, system-ui, sans-serif';
  ctx.fillText('drag to move - stop and time stops', VIEW_W / 2, 520);
  ctx.font = '500 20px ui-sans-serif, system-ui, sans-serif';
  ctx.fillText('the darkness never stops', VIEW_W / 2, 556);
}
