import {
  COLOR,
  FREE_COINS_PER_RUN,
  POD_PERMANENT_COST,
  POD_PULL_COST,
  PLAYER_OUTLINE_PX,
  POD_PULL_USES,
  SHOP_SLOTS,
  SHOP_WEAPON_COST,
  VIEW_H,
  VIEW_W,
} from '../config';
import type { UiRect } from '../core/input';
import { CHARACTERS, MAX_POD, charactersInPod } from '../data/characters';
import { DRONES, DRONE_IDS } from '../data/drones';
import { PROJECTILE_WEAPON_IDS, WEAPONS } from '../data/weapons';
import type { WeaponId } from '../game/weapons/types';
import { drawButton, label, mono, roundRect } from '../render/ui';
import { drawShape } from '../render/drawWorld';
import { saveMeta } from '../game/MetaState';
import type { Scene, SceneCtx } from './scene';

const R = (id: string, x: number, y: number, w: number, h: number): UiRect => ({
  id,
  x,
  y,
  w,
  h,
});

const PREV_CHAR = R('prevChar', 18, 236, 54, 96);
const NEXT_CHAR = R('nextChar', VIEW_W - 72, 236, 54, 96);
const BUY_PERM = R('buyPerm', 110, 404, VIEW_W - 220, 46);
const PREV_POD = R('prevPod', 24, 492, 50, 46);
const NEXT_POD = R('nextPod', 150, 492, 50, 46);
const PULL = R('pull', 220, 486, VIEW_W - 244, 58);
const SHOP: UiRect[] = Array.from({ length: SHOP_SLOTS }, (_, i) =>
  R(`shop${i}`, 24 + i * ((VIEW_W - 48) / SHOP_SLOTS), 622, (VIEW_W - 48) / SHOP_SLOTS - 10, 74),
);
const START = R('start', 60, VIEW_H - 150, VIEW_W - 120, 76);

const ALL_SHOP_IDS: WeaponId[] = [...PROJECTILE_WEAPON_IDS, ...DRONE_IDS];

function weaponName(id: WeaponId): string {
  const w = (WEAPONS as Record<string, { name: string } | undefined>)[id];
  if (w !== undefined) return w.name;
  const d = (DRONES as Record<string, { name: string } | undefined>)[id];
  return d?.name ?? id;
}

/**
 * The pre-run screen: pick a character, feed the vending machine, buy a
 * weapon or two, and set off.
 *
 * Everything here is canvas-drawn and tapped through the same UiRect zones
 * the pause button uses, so a press on a button never also starts a drag.
 */
export class LobbyScene implements Scene {
  readonly id = 'lobby' as const;

  private pod = 1;
  private offers: WeaponId[] = [];
  private bought: boolean[] = [];
  /** Flash message after a pull, so the player sees what they got. */
  private toast = '';
  private toastFor = 0;

  enter(ctx: SceneCtx): void {
    // The original hands out a small free amount before every run.
    ctx.meta.coins += FREE_COINS_PER_RUN;

    this.pod = Math.min(this.pod, ctx.meta.podsAvailable());
    this.rollOffers(ctx);
    ctx.pending = [];
    this.toast = '';
    this.toastFor = 0;
    this.syncRects(ctx);
  }

  exit(ctx: SceneCtx): void {
    ctx.input.setUiRects([]);
  }

  private rollOffers(ctx: SceneCtx): void {
    this.offers = [];
    this.bought = [];
    const pool = [...ALL_SHOP_IDS];
    for (let i = 0; i < SHOP_SLOTS && pool.length > 0; i++) {
      const k = ctx.rng.int(pool.length);
      const picked = pool.splice(k, 1)[0];
      if (picked !== undefined) {
        this.offers.push(picked);
        this.bought.push(false);
      }
    }
  }

  private syncRects(ctx: SceneCtx): void {
    ctx.input.setUiRects([
      PREV_CHAR,
      NEXT_CHAR,
      BUY_PERM,
      PREV_POD,
      NEXT_POD,
      PULL,
      ...SHOP,
      START,
    ]);
  }

  update(ctx: SceneCtx, realDt: number): void {
    if (this.toastFor > 0) this.toastFor -= realDt;

    const tap = ctx.input.consumeTap();
    if (tap === null) return;
    const meta = ctx.meta;
    let dirty = true;

    if (tap === 'prevChar' || tap === 'nextChar') {
      const ids = meta.ownedIds();
      const i = Math.max(0, ids.indexOf(meta.selected));
      const step = tap === 'nextChar' ? 1 : -1;
      meta.selected = ids[(i + step + ids.length) % ids.length] ?? meta.selected;
    } else if (tap === 'prevPod') {
      this.pod = Math.max(1, this.pod - 1);
    } else if (tap === 'nextPod') {
      this.pod = Math.min(meta.podsAvailable(), this.pod + 1);
    } else if (tap === 'pull') {
      const got = meta.pull(this.pod, ctx.rng);
      if (got !== null) {
        const c = CHARACTERS[got];
        this.toast = `${c?.name ?? got}  +${POD_PULL_USES} RUNS`;
        this.toastFor = 2.5;
        meta.selected = got;
      }
    } else if (tap === 'buyPerm') {
      if (meta.buyPermanent(meta.selected)) {
        this.toast = 'UNLOCKED PERMANENTLY';
        this.toastFor = 2.5;
      }
    } else if (tap.startsWith('shop')) {
      const i = Number(tap.slice(4));
      const id = this.offers[i];
      if (
        id !== undefined &&
        this.bought[i] === false &&
        meta.coins >= SHOP_WEAPON_COST
      ) {
        meta.coins -= SHOP_WEAPON_COST;
        this.bought[i] = true;
        ctx.pending.push(id);
      }
    } else if (tap === 'start') {
      ctx.go('game');
    } else {
      dirty = false;
    }

    if (dirty) saveMeta(meta);
  }

  render(ctx: SceneCtx): void {
    const { vp, meta } = ctx;
    const c = vp.ctx;

    vp.applyDevice();
    c.fillStyle = COLOR.pageBg;
    c.fillRect(0, 0, vp.canvas.width, vp.canvas.height);

    vp.applyUi();
    c.save();
    c.beginPath();
    c.rect(0, 0, VIEW_W, VIEW_H);
    c.clip();
    c.fillStyle = COLOR.bg;
    c.fillRect(0, 0, VIEW_W, VIEW_H);

    label(c, 'TIME LOCKER', VIEW_W / 2, 48, 34, COLOR.hud, 'center');
    mono(c, `BEST ${meta.highScore}`, 24, 96, 18, COLOR.hudDim);
    mono(c, `COINS ${meta.coins}`, VIEW_W - 24, 96, 20, COLOR.playerShot, 'right');

    this.renderCharacter(ctx);
    this.renderPod(ctx);
    this.renderShop(ctx);
    this.renderStats(ctx);

    drawButton(c, START, { label: 'START', primary: true, fontSize: 28 });

    if (this.toastFor > 0) {
      c.globalAlpha = Math.min(1, this.toastFor);
      c.fillStyle = COLOR.playerShot;
      roundRect(c, 60, 150, VIEW_W - 120, 40, 8);
      c.fill();
      label(c, this.toast, VIEW_W / 2, 170, 18, '#ffffff', 'center');
      c.globalAlpha = 1;
    }

    c.restore();
  }

  private renderCharacter(ctx: SceneCtx): void {
    const { vp, meta } = ctx;
    const c = vp.ctx;
    const def = CHARACTERS[meta.selected];
    if (def === undefined) return;

    // The silhouette is drawn through the same shape pipeline the game uses,
    // so the lobby can never show something the run does not.
    c.save();
    c.translate(VIEW_W / 2, 284);
    c.scale(1, -1); // shapes are authored +Y forward; the UI pass is Y-down
    // In your own colour, outlined as in play, so the lobby teaches what to
    // look for on the field. The outline scales with the silhouette.
    drawShape(
      c,
      def.shape,
      0,
      0,
      120,
      0,
      COLOR.player,
      COLOR.bg,
      COLOR.ink,
      (PLAYER_OUTLINE_PX * 120) / def.drawSize,
    );
    c.restore();

    label(c, def.name, VIEW_W / 2, 352, 25, COLOR.hud, 'center');
    if (def.blurb !== undefined) {
      label(c, def.blurb, VIEW_W / 2, 378, 14, COLOR.hudDim, 'center');
    }

    drawButton(c, PREV_CHAR, { label: '<', fontSize: 26 });
    drawButton(c, NEXT_CHAR, { label: '>', fontSize: 26 });

    const permanent = meta.isPermanent(meta.selected);
    if (permanent) {
      drawButton(c, BUY_PERM, {
        label: 'PERMANENT',
        enabled: false,
        fontSize: 17,
      });
    } else {
      const left = meta.usesLeft(meta.selected);
      drawButton(c, BUY_PERM, {
        label: `KEEP FOREVER  ${POD_PERMANENT_COST}`,
        sub: `${left} run${left === 1 ? '' : 's'} left`,
        enabled: meta.canBuyPermanent(meta.selected),
        fontSize: 17,
      });
    }
  }

  /**
   * What actually differentiates these characters, stated plainly.
   *
   * Hitbox size is the primary balance lever in the whole roster and is
   * invisible - the silhouette is several times larger than the thing that
   * kills you - so a player choosing between characters has no way to weigh
   * it without being told.
   */
  private renderStats(ctx: SceneCtx): void {
    const { vp, meta } = ctx;
    const c = vp.ctx;
    const def = CHARACTERS[meta.selected];
    if (def === undefined) return;

    const y = 736;
    label(c, 'HITBOX', 24, y, 13, COLOR.hudDim);

    // Scaled against the widest hitbox in the roster, so the bar is a
    // comparison rather than an absolute nobody can interpret.
    const widest = Math.max(
      ...Object.values(CHARACTERS).map((d) => d.hitboxRadius),
    );
    const barW = 150;
    const frac = def.hitboxRadius / widest;
    c.fillStyle = 'rgba(30, 32, 36, 0.10)';
    c.fillRect(96, y - 6, barW, 12);
    c.fillStyle = frac <= 0.45 ? COLOR.enemyGreen : COLOR.playerShot;
    c.fillRect(96, y - 6, barW * frac, 12);
    mono(c, `${def.hitboxRadius}`, 96 + barW + 12, y, 13, COLOR.hudDim);

    const kit: string[] = [];
    if (def.innate.length === 0) kit.push('no gun');
    for (const id of def.startWeapons ?? []) kit.push(weaponName(id));
    label(
      c,
      kit.length > 0 ? `STARTS WITH  ${kit.join(', ')}` : 'STARTS WITH  its own gun',
      24,
      y + 28,
      13,
      COLOR.hudDim,
    );
  }

  private renderPod(ctx: SceneCtx): void {
    const { vp, meta } = ctx;
    const c = vp.ctx;
    const open = meta.podsAvailable();

    mono(c, `POD ${this.pod}/${MAX_POD}`, 24, 476, 14, COLOR.hudDim);
    drawButton(c, PREV_POD, { label: '<', enabled: this.pod > 1, fontSize: 20 });
    drawButton(c, NEXT_POD, {
      label: '>',
      enabled: this.pod < open,
      fontSize: 20,
    });

    const pool = charactersInPod(this.pod);
    const havePerm = pool.filter((p) => meta.isPermanent(p.id)).length;
    drawButton(c, PULL, {
      label: `PULL  ${POD_PULL_COST}`,
      sub: `${havePerm}/${pool.length} kept`,
      enabled: meta.canPull(this.pod),
      fontSize: 20,
    });

    const next = meta.nextPodAt();
    const hint =
      next === null
        ? 'all machines open'
        : `next machine at ${next} total score (${meta.totalScore})`;
    label(c, hint, VIEW_W / 2, 566, 13, COLOR.hudDim, 'center');
  }

  private renderShop(ctx: SceneCtx): void {
    const { vp, meta } = ctx;
    const c = vp.ctx;

    label(c, 'LOAD OUT BEFORE YOU GO', 24, 600, 14, COLOR.hudDim);

    for (let i = 0; i < SHOP.length; i++) {
      const id = this.offers[i];
      const rect = SHOP[i];
      if (id === undefined || rect === undefined) continue;
      const taken = this.bought[i] === true;
      drawButton(c, rect, {
        label: weaponName(id),
        sub: taken ? 'READY' : `${SHOP_WEAPON_COST}`,
        enabled: !taken && meta.coins >= SHOP_WEAPON_COST,
        fontSize: 13,
      });
    }
  }
}
