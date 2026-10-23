import { COLOR } from '../config';
import type { UiRect } from '../core/input';

/**
 * Canvas UI primitives for the lobby and result screens.
 *
 * Buttons are drawn from the same UiRect objects that the input layer uses as
 * tap zones, so what is drawn and what is tappable cannot drift apart.
 */
export interface ButtonStyle {
  label: string;
  enabled?: boolean;
  primary?: boolean;
  sub?: string;
  fontSize?: number;
}

export function drawButton(
  ctx: CanvasRenderingContext2D,
  r: UiRect,
  s: ButtonStyle,
): void {
  const enabled = s.enabled !== false;
  const primary = s.primary === true;

  ctx.fillStyle = !enabled
    ? 'rgba(30, 32, 36, 0.06)'
    : primary
      ? COLOR.playerShot
      : 'rgba(43, 108, 246, 0.10)';
  roundRect(ctx, r.x, r.y, r.w, r.h, 10);
  ctx.fill();

  if (!primary) {
    ctx.strokeStyle = enabled
      ? 'rgba(43, 108, 246, 0.35)'
      : 'rgba(30, 32, 36, 0.12)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = !enabled
    ? COLOR.hudDim
    : primary
      ? '#ffffff'
      : COLOR.playerShot;

  const size = s.fontSize ?? 21;
  const cx = r.x + r.w / 2;
  if (s.sub !== undefined && s.sub !== '') {
    ctx.font = `700 ${size}px ui-sans-serif, system-ui, sans-serif`;
    ctx.fillText(s.label, cx, r.y + r.h / 2 - 10);
    ctx.font = `600 ${Math.round(size * 0.68)}px ui-monospace, Menlo, monospace`;
    ctx.globalAlpha = 0.85;
    ctx.fillText(s.sub, cx, r.y + r.h / 2 + 13);
    ctx.globalAlpha = 1;
  } else {
    ctx.font = `700 ${size}px ui-sans-serif, system-ui, sans-serif`;
    ctx.fillText(s.label, cx, r.y + r.h / 2 + 1);
  }
}

export function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

export function label(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  size: number,
  color: string,
  align: CanvasTextAlign = 'left',
): void {
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.font = `600 ${size}px ui-sans-serif, system-ui, sans-serif`;
  ctx.fillText(text, x, y);
}

export function mono(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  size: number,
  color: string,
  align: CanvasTextAlign = 'left',
): void {
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.font = `600 ${size}px ui-monospace, Menlo, Consolas, monospace`;
  ctx.fillText(text, x, y);
}
