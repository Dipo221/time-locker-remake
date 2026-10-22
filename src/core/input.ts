import type { Viewport } from '../render/viewport';

/** A screen-space zone where a press is a tap, not the start of a drag. */
export interface UiRect {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface InputFrame {
  /** Is the pointer currently down. */
  holding: boolean;
  /** World-space movement to apply this frame. Y is already flipped to Y-up. */
  dx: number;
  dy: number;
  /**
   * Pointer PATH LENGTH travelled this frame, in world units. This is what
   * drives timeScale: path length rather than net displacement, so a 120Hz
   * touch stream and a 60Hz mouse produce the same number.
   */
  pathLength: number;
  /** Real seconds since the last pointermove. Drives staleness detection. */
  sinceLastMove: number;
}

/**
 * Pointer input for a one-finger game.
 *
 * Relative drag, not absolute: the player moves BY the pointer delta rather
 * than TO the pointer position. On touch this is non-negotiable - it keeps the
 * finger off the character and lets you draw the player above the contact
 * point. It also means re-pressing elsewhere never teleports you.
 *
 * Only the first active pointer is tracked. Two-finger input in a one-finger
 * game is pure chaos.
 */
export class Input {
  readonly frame: InputFrame = {
    holding: false,
    dx: 0,
    dy: 0,
    pathLength: 0,
    sinceLastMove: Infinity,
  };

  /** Set when input became untrustworthy (blur, tab hide, pointercancel).
   *  The game should kill time-scale momentum rather than coast. */
  cancelRequested = false;

  /** Increments on every fresh press. Lets callers require a NEW tap (e.g. to
   *  retry after death) rather than reacting to a pointer already held down. */
  pressCount = 0;

  /**
   * Rects (in design space) where a press is a BUTTON TAP rather than the
   * start of a drag.
   *
   * A drag can begin anywhere on screen, so without this a pause button would
   * also yank the player sideways. Registering the zone here means the press
   * is swallowed before any movement or path length is recorded.
   */
  private uiRects: readonly UiRect[] = [];
  private tapped: string | null = null;

  private readonly vp: Viewport;
  private pointerId: number | null = null;
  private lastX = 0;
  private lastY = 0;
  private accDx = 0;
  private accDy = 0;
  private accPath = 0;
  private sinceLastMove = Infinity;

  constructor(vp: Viewport) {
    this.vp = vp;
  }

  attach(): void {
    const c = this.vp.canvas;
    c.addEventListener('pointerdown', this.onDown, { passive: false });
    c.addEventListener('pointermove', this.onMove, { passive: false });
    c.addEventListener('pointerup', this.onUp, { passive: false });
    c.addEventListener('pointercancel', this.onCancel, { passive: false });
    c.addEventListener('lostpointercapture', this.onCancel, { passive: false });
    // A context menu or a dragged-out selection mid-drag would strand us.
    c.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('blur', this.onCancel);
    document.addEventListener('visibilitychange', this.onVisibility);
  }

  /**
   * Snapshot and reset the accumulators. Call once at the top of each frame,
   * before anything reads `frame`.
   */
  beginFrame(realDt: number): InputFrame {
    this.sinceLastMove += realDt;

    const f = this.frame;
    f.holding = this.pointerId !== null;
    f.dx = this.accDx;
    // Design space is y-down, the world is y-up.
    f.dy = -this.accDy;
    f.pathLength = this.accPath;
    f.sinceLastMove = this.sinceLastMove;

    this.accDx = 0;
    this.accDy = 0;
    this.accPath = 0;
    return f;
  }

  consumeCancel(): boolean {
    const c = this.cancelRequested;
    this.cancelRequested = false;
    return c;
  }

  /** Replace the tap zones. Callers re-register whenever the UI changes. */
  setUiRects(rects: readonly UiRect[]): void {
    this.uiRects = rects;
  }

  /** The id of a zone tapped since the last call, if any. */
  consumeTap(): string | null {
    const t = this.tapped;
    this.tapped = null;
    return t;
  }

  private onDown = (e: PointerEvent): void => {
    if (this.pointerId !== null) return; // first pointer only
    e.preventDefault();

    // A press inside a UI zone is a tap, and starts no drag at all - so the
    // player does not lurch sideways when reaching for the pause button.
    const dx = this.vp.clientToDesignX(e.clientX);
    const dy = this.vp.clientToDesignY(e.clientY);
    for (const r of this.uiRects) {
      if (dx >= r.x && dx <= r.x + r.w && dy >= r.y && dy <= r.y + r.h) {
        this.tapped = r.id;
        return;
      }
    }

    this.pointerId = e.pointerId;
    // Keeps the drag alive if the pointer leaves the canvas.
    try {
      this.vp.canvas.setPointerCapture(e.pointerId);
    } catch {
      /* capture is best-effort */
    }
    this.lastX = this.vp.clientToDesignX(e.clientX);
    this.lastY = this.vp.clientToDesignY(e.clientY);
    this.sinceLastMove = 0;
    this.pressCount++;
  };

  private onMove = (e: PointerEvent): void => {
    if (e.pointerId !== this.pointerId) return;
    e.preventDefault();

    // Coalesced events give us the full sub-frame path on high-rate pointers,
    // which is exactly what the path-length measure needs.
    const samples =
      typeof e.getCoalescedEvents === 'function'
        ? e.getCoalescedEvents()
        : undefined;
    const list = samples && samples.length > 0 ? samples : [e];

    for (let i = 0; i < list.length; i++) {
      const s = list[i];
      const x = this.vp.clientToDesignX(s.clientX);
      const y = this.vp.clientToDesignY(s.clientY);
      const dx = x - this.lastX;
      const dy = y - this.lastY;
      this.accDx += dx;
      this.accDy += dy;
      this.accPath += Math.sqrt(dx * dx + dy * dy);
      this.lastX = x;
      this.lastY = y;
    }
    this.sinceLastMove = 0;
  };

  private onUp = (e: PointerEvent): void => {
    if (e.pointerId !== this.pointerId) return;
    e.preventDefault();
    this.release();
  };

  private onCancel = (): void => {
    if (this.pointerId === null) return;
    this.release();
    // Untrustworthy input: no momentum tail.
    this.cancelRequested = true;
  };

  private onVisibility = (): void => {
    if (document.hidden) this.onCancel();
  };

  private release(): void {
    if (this.pointerId !== null) {
      try {
        this.vp.canvas.releasePointerCapture(this.pointerId);
      } catch {
        /* already released */
      }
    }
    this.pointerId = null;
  }
}
