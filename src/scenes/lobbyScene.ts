import {
  COLOR,
  FREE_COINS_PER_RUN,
  LOBBY_HOLD_SEC,
  PLAYER_MAX_SPEED,
  PLAYER_OUTLINE_PX,
  PLAYER_SOLID_RADIUS_FRAC,
  PLAY_MARGIN,
  POD_PERMANENT_COST,
  POD_PULL_COST,
  POD_PULL_USES,
  VIEW_H,
  VIEW_W,
  WEAPON_MACHINE_COST,
  WORLD_W,
} from '../config';
import type { UiRect } from '../core/input';
import { clamp, len } from '../core/math';
import { CHARACTERS, charactersInPod } from '../data/characters';
import { DRONES } from '../data/drones';
import { WEAPONS } from '../data/weapons';
import { Camera } from '../game/Camera';
import { saveMeta } from '../game/MetaState';
import type { MetaState } from '../game/MetaState';
import { createPlayer } from '../game/entities/Player';
import { pushCircleOutOfBox } from '../game/systems/playerSystem';
import { updateProjectiles } from '../game/systems/projectileSystem';
import { updatePlayerGuns } from '../game/systems/weaponSystem';
import { rollWeapon } from '../game/weaponDrops';
import type { WeaponId } from '../game/weapons/types';
import { drawDrones, drawGround, drawPlayerShots, drawShape } from '../render/drawWorld';
import { gear } from '../render/hud';
import { roundRect } from '../render/ui';
import { drawWeaponIcon } from '../render/weaponIcon';
import {
  MACHINE_HALF,
  SPAWN_X,
  SPAWN_Y,
  START_Y,
  buildLobbyFloor,
  drawLobbyFloor,
  drawLobbyLabels,
  usesBadge,
} from './lobbyFloor';
import type { LobbyFloor, Machine } from './lobbyFloor';
import { SavePanel } from './savePanel';
import type { Scene, SceneCtx } from './scene';

const GEAR: UiRect = { id: 'gear', x: 24, y: 880, w: 104, h: 60 };
const SAVE: UiRect = { id: 'save', x: 140, y: 880, w: 104, h: 60 };
/** While the help card is up, any tap closes it. */
const HELP_CLOSE: UiRect = { id: 'helpClose', x: 0, y: 0, w: VIEW_W, h: VIEW_H };

/** How close you must be to a waiting character to become it. */
const SWITCH_REACH = 20;
/** Pressed against a machine: within this of its face. */
const TOUCH_GAP = 6;
/** Beyond touching, how near a POD machine's face shows what is inside. */
const PREVIEW_REACH = 14;

const HEAVY = 'italic 900';
const SANS = 'ui-sans-serif, system-ui, sans-serif';
const MONO = 'ui-monospace, Menlo, Consolas, monospace';

/**
 * What the next POD is still waiting for, in a line: the characters still
 * to find in the machine before it, and the score, whichever are missing.
 */
function nextPodLine(meta: MetaState): string {
  const n = meta.nextPod();
  if (n === null) return 'ALL PODS OPEN';
  const parts: string[] = [];
  if (n.found < n.needed) parts.push(`FIND ${n.needed - n.found} MORE IN POD ${n.from}`);
  if (meta.totalScore < n.score) parts.push(`TOTAL ${n.score}`);
  return parts.length > 0 ? parts.join(' + ') : `POD ${n.pod} OPENS NOW`;
}

/** Which machine this is, stable across rebuilds of the floor. */
function machineKey(m: Machine): string {
  return `${m.kind}:${m.pod}`;
}

function weaponName(id: WeaponId): string {
  const w = (WEAPONS as Record<string, { name: string } | undefined>)[id];
  if (w !== undefined) return w.name;
  return (DRONES as Record<string, { name: string } | undefined>)[id]?.name ?? id;
}

/**
 * The lobby, after the original's: you walk about in it as the character
 * you will play.
 *
 *   - Walk into a waiting character to become it. Free and reversible, so it
 *     happens on touch.
 *   - Lean on a machine to buy from it. That costs coins, so it waits for
 *     LOBBY_HOLD_SEC of contact - a ring fills - and stepping away cancels.
 *     After a purchase you must step off before it will sell again.
 *   - Walk over the START line to begin. The run picks up exactly where you
 *     are standing (see SceneCtx.startAt).
 *
 * Near a POD machine a card shows what is inside: kept characters in full,
 * ones still to find as "?" - the original never said what a machine held.
 *
 * And you shoot. The character fires its real guns - its own, plus anything
 * the weapon machine has given you - through the run's own gun, bullet and
 * drone systems on an empty world, under the run's own rule that time moves
 * only while you do. Picking a character is choosing a weapon; you should
 * see what it does before you commit a run to it.
 */
export class LobbyScene implements Scene {
  readonly id = 'lobby' as const;

  private floor: LobbyFloor = { machines: [], yard: [], bottom: -1000 };
  private readonly player = createPlayer();
  private readonly camera = new Camera();
  private readonly savePanel = new SavePanel();
  private helpOpen = false;

  /**
   * The machine being leaned on, and how far its purchase has got (0..1).
   * Machines are tracked by KEY, not by object: a purchase rebuilds the
   * floor, and a fresh object for the same machine must still count as the
   * one just bought from - otherwise standing still against a POD pulled
   * from it again every LOBBY_HOLD_SEC until the coins ran out.
   */
  private holdOn: string | null = null;
  private hold = 0;
  /** Bought from last; must be stepped off before it sells again. */
  private spent: string | null = null;
  /** The waiting character being touched; a switch fires on arrival only. */
  private touching: string | null = null;
  /** What the machine being leaned on would say: a price, a lock, a shortfall. */
  private status = '';

  private toast = '';
  private toastSub = '';
  private toastFor = 0;

  enter(ctx: SceneCtx): void {
    // The original hands out a small free amount before every run.
    ctx.meta.coins += FREE_COINS_PER_RUN;
    saveMeta(ctx.meta);

    ctx.pending = [];
    this.floor = buildLobbyFloor(ctx.meta);
    this.become(ctx.meta.selected);
    this.player.x = SPAWN_X;
    this.player.y = SPAWN_Y;
    this.camera.reset(this.player.x, this.player.y);
    this.arm(ctx);
    ctx.tsc.kill();

    this.holdOn = null;
    this.hold = 0;
    this.spent = null;
    this.touching = null;
    this.status = '';
    this.toastFor = 0;
    this.helpOpen = false;
    this.syncRects(ctx);
  }

  exit(ctx: SceneCtx): void {
    this.savePanel.close();
    ctx.input.setUiRects([]);
  }

  private syncRects(ctx: SceneCtx): void {
    ctx.input.setUiRects(this.helpOpen ? [HELP_CLOSE] : [GEAR, SAVE]);
  }

  /** Take on a character's body: its shape, size and handling. */
  private become(id: string): void {
    const def = CHARACTERS[id];
    if (def === undefined) return;
    const p = this.player;
    p.shape = def.shape;
    p.drawSize = def.drawSize;
    p.hitboxRadius = def.hitboxRadius;
    p.dragGain = def.dragGain;
  }

  /**
   * Load the shared world with what this character would start a run with -
   * its own guns, its free start weapons, and what has been bought - so the
   * lobby can fire them. The world is otherwise empty: no enemies, nothing
   * spawning, so homing shots fly straight and nothing explodes.
   */
  private arm(ctx: SceneCtx): void {
    const { world, meta } = ctx;
    world.setCharacter(meta.selected);
    for (const id of CHARACTERS[meta.selected]?.startWeapons ?? []) world.addWeapon(id);
    for (const id of ctx.pending) world.addWeapon(id);
    world.player.x = this.player.x;
    world.player.y = this.player.y;
  }

  private switchTo(ctx: SceneCtx, id: string): void {
    const def = CHARACTERS[id];
    if (def === undefined) return;
    ctx.meta.selected = id;
    this.become(id);
    this.arm(ctx);
    saveMeta(ctx.meta);
    this.say(def.name, `${def.blurb ?? ''}${def.blurb ? '  ·  ' : ''}HITBOX ${def.hitboxRadius}`);
  }

  private say(title: string, sub = ''): void {
    this.toast = title;
    this.toastSub = sub;
    this.toastFor = 2.6;
  }

  update(ctx: SceneCtx, realDt: number): void {
    const { input, meta, clock } = ctx;
    if (this.toastFor > 0) this.toastFor -= realDt;

    const frame = input.beginFrame(realDt);
    // Time moves as you move, exactly as in a run: the guns and bullets run
    // on it, the body and the camera on the real clock.
    const timeScale = ctx.tsc.update(frame.pathLength, frame.holding, frame.sinceLastMove, realDt);
    clock.advance(realDt, timeScale);
    input.consumeCancel();
    const tap = input.consumeTap();

    if (this.helpOpen) {
      if (tap === 'helpClose') {
        this.helpOpen = false;
        this.syncRects(ctx);
      }
      return;
    }
    if (this.savePanel.isOpen) return;
    if (tap === 'gear') {
      this.helpOpen = true;
      this.syncRects(ctx);
      return;
    }
    if (tap === 'save') {
      this.savePanel.open(meta, () => {
        this.floor = buildLobbyFloor(meta);
        this.become(meta.selected);
        this.arm(ctx);
      });
      return;
    }

    // ---- walk ---------------------------------------------------------------
    const p = this.player;
    if (frame.holding) {
      let dx = frame.dx * p.dragGain;
      let dy = frame.dy * p.dragGain;
      const step = len(dx, dy);
      const max = PLAYER_MAX_SPEED * realDt;
      if (step > max && step > 0) {
        dx *= max / step;
        dy *= max / step;
      }
      p.x += dx;
      p.y += dy;
    }
    const r = p.drawSize * PLAYER_SOLID_RADIUS_FRAC;
    for (const m of this.floor.machines) pushCircleOutOfBox(p, m.x, m.y, MACHINE_HALF, r);
    p.x = clamp(p.x, PLAY_MARGIN, WORLD_W - PLAY_MARGIN);
    p.y = Math.max(p.y, this.floor.bottom);

    this.camera.follow(p.y, -Infinity, clock.real);
    this.camera.followX(p.x, clock.real);

    // ---- fire --------------------------------------------------------------
    const w = ctx.world;
    w.player.x = p.x;
    w.player.y = p.y;
    updatePlayerGuns(w, clock.scaled);
    updateProjectiles(w.playerShots, this.camera.y, clock.scaled, w);
    w.droneCtl.update(w, clock.scaled);
    w.playerShots.compact();
    w.drones.compact();

    // ---- over the line: the run begins right here ----------------------------
    if (p.y >= START_Y) {
      saveMeta(meta);
      ctx.startAt = { x: p.x, y: p.y, camX: this.camera.x, camY: this.camera.y };
      ctx.go('game');
      return;
    }

    // ---- walk into a character to become it ---------------------------------
    let touched: string | null = null;
    for (const s of this.floor.yard) {
      if (s.id === meta.selected) continue;
      if (len(s.x - p.x, s.y - p.y) <= r + SWITCH_REACH) {
        touched = s.id;
        break;
      }
    }
    if (touched !== null && touched !== this.touching) this.switchTo(ctx, touched);
    this.touching = touched;

    // ---- lean on a machine to buy ------------------------------------------
    let on: Machine | null = null;
    for (const m of this.floor.machines) {
      const gx = Math.max(Math.abs(p.x - m.x) - MACHINE_HALF, 0);
      const gy = Math.max(Math.abs(p.y - m.y) - MACHINE_HALF, 0);
      if (len(gx, gy) <= r + TOUCH_GAP) {
        on = m;
        break;
      }
    }
    const key = on === null ? null : machineKey(on);
    if (key !== this.holdOn) this.hold = 0;
    this.holdOn = key;
    if (this.spent !== null && this.spent !== key) this.spent = null;

    this.status = '';
    if (on !== null) {
      const [ok, msg] = this.offer(meta, on);
      this.status = this.spent === key ? 'STEP OFF AND BACK TO BUY AGAIN' : msg;
      if (ok && this.spent !== key) {
        this.hold += realDt / LOBBY_HOLD_SEC;
        if (this.hold >= 1) {
          this.hold = 0;
          this.spent = key;
          this.buy(ctx, on);
        }
      } else {
        this.hold = 0;
      }
    }
  }

  /** Whether a machine will sell right now, and what it says either way. */
  private offer(meta: MetaState, m: Machine): [boolean, string] {
    const short = (cost: number): string => `NEED ${cost - meta.coins} MORE COINS`;
    if (m.kind === 'pod') {
      if (m.locked) return [false, `POD ${m.pod}: ${nextPodLine(meta)}`];
      if (meta.coins < POD_PULL_COST) return [false, short(POD_PULL_COST)];
      return [true, `HOLD TO PULL FROM POD ${m.pod}`];
    }
    if (m.kind === 'weapon') {
      if (meta.coins < WEAPON_MACHINE_COST) return [false, short(WEAPON_MACHINE_COST)];
      return [true, 'HOLD FOR A RANDOM WEAPON FOR THE NEXT RUN'];
    }
    const name = CHARACTERS[meta.selected]?.name ?? '';
    if (meta.isPermanent(meta.selected)) return [false, `${name} IS ALREADY YOURS FOR GOOD`];
    if (meta.coins < POD_PERMANENT_COST) return [false, short(POD_PERMANENT_COST)];
    return [true, `HOLD TO KEEP ${name} FOREVER`];
  }

  private buy(ctx: SceneCtx, m: Machine): void {
    const { meta } = ctx;
    if (m.kind === 'pod') {
      const before = meta.podsAvailable();
      const got = meta.pull(m.pod, ctx.rng);
      if (got === null) return;
      this.floor = buildLobbyFloor(meta);
      // You come out of the machine as what you pulled, as in the original.
      this.switchTo(ctx, got);
      const opened = meta.podsAvailable() > before;
      this.say(
        `${CHARACTERS[got]?.name ?? got}`,
        opened
          ? `+${POD_PULL_USES} RUNS  ·  POD ${meta.podsAvailable()} IS NOW OPEN!`
          : `+${POD_PULL_USES} RUNS  ·  from POD ${m.pod}`,
      );
    } else if (m.kind === 'weapon') {
      meta.coins -= WEAPON_MACHINE_COST;
      const id = rollWeapon(ctx.rng);
      ctx.pending.push(id);
      ctx.world.addWeapon(id);
      this.say(`+ ${weaponName(id)}`, 'ready for the next run');
    } else if (meta.buyPermanent(meta.selected)) {
      this.say(`${CHARACTERS[meta.selected]?.name ?? ''} IS YOURS`, 'kept forever');
    }
    saveMeta(meta);
  }

  // ------------------------------------------------------------------ render
  render(ctx: SceneCtx): void {
    const { vp, meta } = ctx;
    const c = vp.ctx;
    const p = this.player;

    vp.applyDevice();
    c.fillStyle = COLOR.pageBg;
    c.fillRect(0, 0, vp.canvas.width, vp.canvas.height);

    c.save();
    vp.applyUi();
    c.beginPath();
    c.rect(0, 0, VIEW_W, VIEW_H);
    c.clip();
    c.fillStyle = COLOR.bg;
    c.fillRect(0, 0, VIEW_W, VIEW_H);

    vp.applyWorld(this.camera.x, this.camera.y);
    drawGround(c, this.camera.y);
    drawLobbyFloor(c, this.floor, meta.selected);

    // The floor's lettering next, so that you, your drones and your shots are
    // always drawn over it - never a price tag over your character.
    vp.applyUi();
    drawLobbyLabels(c, this.floor, meta, meta.selected, this.camera.x, this.camera.y, -Infinity);
    vp.applyWorld(this.camera.x, this.camera.y);

    // The purchase ring fills round you while you lean on a machine.
    if (this.hold > 0) {
      c.strokeStyle = COLOR.playerShot;
      c.lineWidth = 5;
      c.beginPath();
      c.arc(p.x, p.y, p.drawSize * 0.75, Math.PI / 2, Math.PI / 2 - this.hold * Math.PI * 2, true);
      c.stroke();
    }
    drawShape(c, p.shape, p.x, p.y, p.drawSize, 0, COLOR.player, COLOR.bg, COLOR.ink, PLAYER_OUTLINE_PX);
    drawDrones(c, ctx.world.drones);
    drawPlayerShots(c, ctx.world.playerShots);

    vp.applyUi();
    if (!meta.isPermanent(meta.selected)) {
      usesBadge(c, p.x - this.camera.x + 20, VIEW_H / 2 - (p.y - this.camera.y) - 22, meta.usesLeft(meta.selected));
    }

    this.renderHud(c, meta, ctx.pending);
    this.renderPreview(c, meta);
    this.renderMessages(c);
    this.renderBar(c);
    if (this.helpOpen) this.renderHelp(c);

    c.restore();
  }

  private renderHud(c: CanvasRenderingContext2D, meta: MetaState, pending: readonly WeaponId[]): void {
    // A light backing, so the floor's big lettering scrolling underneath
    // never runs through the numbers.
    c.fillStyle = 'rgba(250, 249, 247, 0.9)';
    c.fillRect(0, 0, VIEW_W, pending.length > 0 ? 112 : 80);
    c.textBaseline = 'middle';
    c.textAlign = 'left';
    c.fillStyle = COLOR.ink;
    c.font = `${HEAVY} 26px ${SANS}`;
    c.fillText(`TOP ${meta.highScore}`, 22, 34);
    c.fillStyle = COLOR.hudDim;
    c.font = `600 13px ${MONO}`;
    c.fillText(`TOTAL ${meta.totalScore}  ·  ${nextPodLine(meta)}`, 22, 64, VIEW_W - 180);

    // Coins and their C badge, as in the original.
    const bx = VIEW_W - 22 - 44;
    c.fillStyle = COLOR.enemyGreen;
    roundRect(c, bx, 14, 44, 44, 6);
    c.fill();
    c.fillStyle = '#ffffff';
    c.textAlign = 'center';
    c.font = `900 28px ${SANS}`;
    c.fillText('C', bx + 22, 37);
    c.fillStyle = COLOR.ink;
    c.textAlign = 'right';
    c.font = `${HEAVY} 42px ${SANS}`;
    c.fillText(String(meta.coins), bx - 8, 38);

    // What the weapon machine has given you for the coming run.
    if (pending.length > 0) {
      const counts = new Map<WeaponId, number>();
      for (const id of pending) counts.set(id, (counts.get(id) ?? 0) + 1);
      let x = VIEW_W - 22;
      for (const [id, n] of [...counts].reverse()) {
        const w = 58;
        x -= w;
        c.fillStyle = COLOR.ink;
        roundRect(c, x, 72, w - 6, 32, 6);
        c.fill();
        drawWeaponIcon(c, id, x + 17, 88, 22, '#ffffff', COLOR.ink);
        c.fillStyle = '#ffffff';
        c.textAlign = 'right';
        c.font = `${HEAVY} 18px ${SANS}`;
        c.fillText(String(n), x + w - 12, 89);
      }
      c.fillStyle = COLOR.hudDim;
      c.textAlign = 'right';
      c.font = `600 11px ${MONO}`;
      c.fillText('NEXT RUN', x - 8, 88);
    }
  }

  /** What is inside the POD machine you are next to. */
  private renderPreview(c: CanvasRenderingContext2D, meta: MetaState): void {
    const p = this.player;
    let near: Machine | null = null;
    let best = p.drawSize * PLAYER_SOLID_RADIUS_FRAC + PREVIEW_REACH;
    for (const m of this.floor.machines) {
      if (m.kind !== 'pod') continue;
      // Measured to the machine's face, not its centre: only when you are
      // up against it, or nearly, so the card never covers the way ahead.
      const gx = Math.max(Math.abs(p.x - m.x) - MACHINE_HALF, 0);
      const gy = Math.max(Math.abs(p.y - m.y) - MACHINE_HALF, 0);
      const d = len(gx, gy);
      if (d < best) {
        best = d;
        near = m;
      }
    }
    if (near === null) return;

    const pool = charactersInPod(near.pod);
    const kept = pool.filter((d) => meta.isPermanent(d.id)).length;
    const x = 22;
    const y = 120;
    const w = VIEW_W - 44;
    const h = 112;
    c.fillStyle = 'rgba(250, 249, 247, 0.94)';
    roundRect(c, x, y, w, h, 12);
    c.fill();
    c.strokeStyle = near.locked ? COLOR.frame : COLOR.podMachine;
    c.lineWidth = 2;
    c.stroke();

    c.textBaseline = 'middle';
    c.textAlign = 'left';
    c.fillStyle = COLOR.ink;
    c.font = `${HEAVY} 20px ${SANS}`;
    c.fillText(`POD ${near.pod}`, x + 14, y + 20);
    c.fillStyle = COLOR.hudDim;
    c.font = `600 12px ${MONO}`;
    c.textAlign = 'right';
    c.fillText(near.locked ? 'LOCKED' : `${kept}/${pool.length} KEPT FOREVER`, x + w - 14, y + 20);

    const slot = Math.min(66, (w - 20) / Math.max(1, pool.length));
    const x0 = x + w / 2 - (slot * pool.length) / 2 + slot / 2;
    for (let i = 0; i < pool.length; i++) {
      const d = pool[i];
      const cx = x0 + i * slot;
      const cy = y + 70;
      const owned = !near.locked && meta.isOwned(d.id);
      c.save();
      c.translate(cx, cy);
      c.scale(1, -1);
      drawShape(c, d.shape, 0, 0, Math.min(46, d.drawSize), 0, owned ? COLOR.lobbyIdle : COLOR.frame, COLOR.bg);
      c.restore();
      if (!owned) {
        c.fillStyle = COLOR.hudDim;
        c.textAlign = 'center';
        c.font = `${HEAVY} 22px ${SANS}`;
        c.fillText('?', cx, cy + 2);
      } else if (!meta.isPermanent(d.id)) {
        usesBadge(c, cx + 16, cy - 16, meta.usesLeft(d.id));
      }
    }
  }

  private renderMessages(c: CanvasRenderingContext2D): void {
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    if (this.toastFor > 0) {
      c.globalAlpha = Math.min(1, this.toastFor);
      c.fillStyle = COLOR.ink;
      roundRect(c, 40, 250, VIEW_W - 80, this.toastSub ? 62 : 42, 12);
      c.fill();
      c.fillStyle = '#ffffff';
      c.font = `${HEAVY} 20px ${SANS}`;
      c.fillText(this.toast, VIEW_W / 2, 271);
      if (this.toastSub) {
        c.font = `500 12px ${SANS}`;
        c.fillStyle = 'rgba(255, 255, 255, 0.8)';
        c.fillText(this.toastSub, VIEW_W / 2, 296, VIEW_W - 100);
      }
      c.globalAlpha = 1;
    }
    if (this.status !== '') {
      c.font = `700 14px ${SANS}`;
      const w = Math.min(VIEW_W - 40, c.measureText(this.status).width + 32);
      c.fillStyle = 'rgba(30, 32, 36, 0.86)';
      roundRect(c, VIEW_W / 2 - w / 2, 820, w, 40, 20);
      c.fill();
      c.fillStyle = '#ffffff';
      c.fillText(this.status, VIEW_W / 2, 841, VIEW_W - 60);
    }
  }

  private renderBar(c: CanvasRenderingContext2D): void {
    for (const b of [GEAR, SAVE]) {
      c.fillStyle = COLOR.uiTeal;
      roundRect(c, b.x, b.y, b.w, b.h, 12);
      c.fill();
    }
    gear(c, GEAR.x + GEAR.w / 2, GEAR.y + GEAR.h / 2, 18);
    c.fillStyle = '#ffffff';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.font = `${HEAVY} 22px ${SANS}`;
    c.fillText('SAVE', SAVE.x + SAVE.w / 2, SAVE.y + SAVE.h / 2 + 1);
  }

  /** The gear's card. Settings proper come later; for now, how to play. */
  private renderHelp(c: CanvasRenderingContext2D): void {
    c.fillStyle = 'rgba(20, 22, 26, 0.6)';
    c.fillRect(0, 0, VIEW_W, VIEW_H);
    const x = 36;
    const y = 170;
    const w = VIEW_W - 72;
    const h = 600;
    c.fillStyle = COLOR.bg;
    roundRect(c, x, y, w, h, 14);
    c.fill();

    c.textAlign = 'left';
    c.textBaseline = 'middle';
    c.fillStyle = COLOR.ink;
    c.font = `${HEAVY} 28px ${SANS}`;
    c.fillText('HOW TO PLAY', x + 24, y + 42);

    const lines: [string, string][] = [
      ['Drag anywhere to move.', 'Your guns fire on their own.'],
      ['Time moves only when you move.', 'Stop, and the whole world stops.'],
      ['The darkness behind you never stops.', 'Keep going forward.'],
      ['Touching an enemy or its fire ends the run.', 'Grey blocks only get in your way.'],
      ['Blue enemies drop weapons.', 'Green ones, and green blocks, drop coins.'],
      ['In here: walk into a character to be it.', 'Lean on a machine to buy from it.'],
      ['Walk over the START line to begin.', ''],
    ];
    let ly = y + 96;
    for (const [a, b] of lines) {
      c.fillStyle = COLOR.ink;
      c.font = `600 16px ${SANS}`;
      c.fillText(a, x + 24, ly, w - 48);
      if (b) {
        c.fillStyle = '#55524c';
        c.font = `400 14px ${SANS}`;
        c.fillText(b, x + 24, ly + 22, w - 48);
      }
      ly += 62;
    }

    c.fillStyle = COLOR.hudDim;
    c.font = `500 11px ${SANS}`;
    c.textAlign = 'center';
    c.fillText('Fan remake of TIME LOCKER (Sotaro Otsuka, 2016). Not affiliated.', VIEW_W / 2, y + h - 52);
    c.font = `700 14px ${SANS}`;
    c.fillText('TAP TO CLOSE', VIEW_W / 2, y + h - 24);
  }
}
