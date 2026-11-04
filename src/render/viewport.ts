import { MAX_DPR, VIEW_H, VIEW_W } from '../config';

/**
 * Owns the canvas, the DPR backing store, and the portrait letterbox.
 *
 * Three transforms, and it matters which one you are in:
 *   applyDevice() - raw device pixels. Only for clearing.
 *   applyUi()     - design space (0..VIEW_W, 0..VIEW_H), y DOWN. HUD and text.
 *   applyWorld()  - world space, y UP, camera-relative. Gameplay.
 *
 * !! applyWorld flips Y, so TEXT AND IMAGES DRAWN UNDER IT ARE MIRRORED. !!
 * All text goes in the UI pass. This is the classic Y-flip bug and it costs an
 * hour every single time.
 */
export class Viewport {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;

  dpr = 1;
  cssW = 0;
  cssH = 0;
  /** Design-to-CSS-pixel scale of the letterboxed play rect. */
  scale = 1;
  /** CSS-pixel offset of the play rect inside the canvas. */
  offsetX = 0;
  offsetY = 0;

  private rectLeft = 0;
  private rectTop = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('2d canvas context unavailable');
    this.ctx = ctx;
    this.resize();
  }

  resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    this.rectLeft = rect.left;
    this.rectTop = rect.top;
    this.cssW = rect.width || window.innerWidth;
    this.cssH = rect.height || window.innerHeight;

    this.dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    const w = Math.max(1, Math.round(this.cssW * this.dpr));
    const h = Math.max(1, Math.round(this.cssH * this.dpr));
    if (this.canvas.width !== w) this.canvas.width = w;
    if (this.canvas.height !== h) this.canvas.height = h;

    this.scale = Math.min(this.cssW / VIEW_W, this.cssH / VIEW_H);
    this.offsetX = (this.cssW - VIEW_W * this.scale) / 2;
    this.offsetY = (this.cssH - VIEW_H * this.scale) / 2;
  }

  /**
   * Client (event) coordinates to design space, y DOWN. Deltas in design space
   * are converted to world space (y UP) by the input layer.
   */
  clientToDesignX(clientX: number): number {
    return (clientX - this.rectLeft - this.offsetX) / this.scale;
  }

  clientToDesignY(clientY: number): number {
    return (clientY - this.rectTop - this.offsetY) / this.scale;
  }

  applyDevice(): void {
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  applyUi(): void {
    const s = this.dpr * this.scale;
    this.ctx.setTransform(
      s,
      0,
      0,
      s,
      this.dpr * this.offsetX,
      this.dpr * this.offsetY,
    );
  }

  /**
   * World space: x maps 0..VIEW_W directly, +y is UP, and `cameraY` is the
   * world Y shown at the vertical centre of the play rect.
   *
   * A world point (wx, wy) lands at design
   * (wx - cameraX, VIEW_H/2 - (wy - cameraY)).
   */
  applyWorld(cameraX: number, cameraY: number): void {
    const s = this.dpr * this.scale;
    this.ctx.setTransform(
      s,
      0,
      0,
      -s,
      this.dpr * (this.offsetX - cameraX * this.scale),
      this.dpr * (this.offsetY + (VIEW_H / 2 + cameraY) * this.scale),
    );
  }

  /**
   * World space magnified by `zoom` about a focus: world point (fx, fy) lands
   * at design point (sx, sy). Same Y flip as applyWorld. For close-ups, such
   * as the result screen's look at where the run ended.
   */
  applyWorldZoom(
    fx: number,
    fy: number,
    zoom: number,
    sx: number,
    sy: number,
  ): void {
    const s = this.dpr * this.scale * zoom;
    this.ctx.setTransform(
      s,
      0,
      0,
      -s,
      this.dpr * (this.offsetX + (sx - fx * zoom) * this.scale),
      this.dpr * (this.offsetY + (sy + fy * zoom) * this.scale),
    );
  }

  /** World Y at the top and bottom edges of the view, for culling. */
  worldTop(cameraY: number): number {
    return cameraY + VIEW_H / 2;
  }

  worldBottom(cameraY: number): number {
    return cameraY - VIEW_H / 2;
  }
}
