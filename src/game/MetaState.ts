import {
  POD_PERMANENT_COST,
  POD_PULL_COST,
  POD_PULL_USES,
  POD_UNLOCK_SCORES,
} from '../config';
import { CHARACTERS, DEFAULT_CHARACTER, MAX_POD } from '../data/characters';
import type { Rng } from '../core/rng';
import { charactersInPod } from '../data/characters';

const SAVE_KEY = 'timelocker.save.v1';

interface OwnedCharacter {
  /** Runs remaining. Ignored once `permanent` is set. */
  uses: number;
  permanent: boolean;
}

interface SaveShape {
  coins: number;
  highScore: number;
  totalScore: number;
  selected: string;
  owned: Record<string, OwnedCharacter>;
}

/**
 * Everything that survives a run: the bank, the roster you have unlocked, and
 * how far you have got overall.
 *
 * The one deliberate departure from the original is the permanent unlock. In
 * the original a 100-coin pull gave a character for exactly three runs and
 * then took it away, and that is the single most complained-about thing in
 * the reviews - "you can't permanently unlock characters... even if it costs
 * 5000 coins". The gacha is kept, because the pull is a genuinely good coin
 * sink and it is how the original paces discovery; but a character you like
 * can now be bought outright, which is exactly what players asked for.
 */
export class MetaState {
  coins = 0;
  highScore = 0;
  /** Cumulative across all runs. Drives how many PODs are available. */
  totalScore = 0;
  selected: string = DEFAULT_CHARACTER;
  readonly owned = new Map<string, OwnedCharacter>();

  constructor() {
    this.owned.set(DEFAULT_CHARACTER, { uses: Infinity, permanent: true });
  }

  // ------------------------------------------------------------ ownership
  isOwned(id: string): boolean {
    const o = this.owned.get(id);
    return o !== undefined && (o.permanent || o.uses > 0);
  }

  isPermanent(id: string): boolean {
    return this.owned.get(id)?.permanent === true;
  }

  usesLeft(id: string): number {
    const o = this.owned.get(id);
    if (o === undefined) return 0;
    return o.permanent ? Infinity : o.uses;
  }

  ownedIds(): string[] {
    return [...this.owned.keys()].filter((id) => this.isOwned(id));
  }

  grant(id: string, uses: number): void {
    const o = this.owned.get(id);
    if (o === undefined) {
      this.owned.set(id, { uses, permanent: false });
    } else if (!o.permanent) {
      o.uses += uses;
    }
  }

  /** Spend a run of the selected character. Permanent ones are untouched. */
  consumeUse(id: string): void {
    const o = this.owned.get(id);
    if (o === undefined || o.permanent) return;
    o.uses = Math.max(0, o.uses - 1);
    if (o.uses === 0 && this.selected === id) {
      this.selected = DEFAULT_CHARACTER;
    }
  }

  // ------------------------------------------------------------------ pods
  /** How many vending machines are available, given cumulative score. */
  podsAvailable(): number {
    let n = 1;
    for (const threshold of POD_UNLOCK_SCORES) {
      if (this.totalScore >= threshold) n++;
    }
    return Math.min(MAX_POD, n);
  }

  /** Cumulative score needed for the next POD, or null when all are open. */
  nextPodAt(): number | null {
    const open = this.podsAvailable();
    if (open >= MAX_POD) return null;
    return POD_UNLOCK_SCORES[open - 1] ?? null;
  }

  canPull(pod: number): boolean {
    return (
      this.coins >= POD_PULL_COST &&
      pod <= this.podsAvailable() &&
      charactersInPod(pod).length > 0
    );
  }

  /** Spend coins for a random character from that POD. Returns its id. */
  pull(pod: number, rng: Rng): string | null {
    if (!this.canPull(pod)) return null;
    const pool = charactersInPod(pod);
    // Prefer something not yet permanently owned, so a pull still feels like
    // progress once the POD is nearly complete.
    const fresh = pool.filter((c) => !this.isPermanent(c.id));
    const from = fresh.length > 0 ? fresh : pool;
    const pick = from[rng.int(from.length)];
    if (pick === undefined) return null;

    this.coins -= POD_PULL_COST;
    this.grant(pick.id, POD_PULL_USES);
    return pick.id;
  }

  canBuyPermanent(id: string): boolean {
    return (
      this.coins >= POD_PERMANENT_COST &&
      this.owned.has(id) &&
      !this.isPermanent(id)
    );
  }

  buyPermanent(id: string): boolean {
    if (!this.canBuyPermanent(id)) return false;
    this.coins -= POD_PERMANENT_COST;
    const o = this.owned.get(id);
    if (o !== undefined) o.permanent = true;
    return true;
  }

  // ------------------------------------------------------- end of a run
  bankRun(score: number, coins: number): void {
    this.coins += coins;
    this.totalScore += score;
    if (score > this.highScore) this.highScore = score;
  }

  // ------------------------------------------------------------ persistence
  toJSON(): SaveShape {
    const owned: Record<string, OwnedCharacter> = {};
    for (const [id, o] of this.owned) {
      owned[id] = {
        // Infinity does not survive JSON; permanence is the flag that matters.
        uses: Number.isFinite(o.uses) ? o.uses : 0,
        permanent: o.permanent,
      };
    }
    return {
      coins: this.coins,
      highScore: this.highScore,
      totalScore: this.totalScore,
      selected: this.selected,
      owned,
    };
  }

  load(raw: unknown): void {
    if (typeof raw !== 'object' || raw === null) return;
    const d = raw as Partial<SaveShape>;

    this.coins = numberOr(d.coins, 0);
    this.highScore = numberOr(d.highScore, 0);
    this.totalScore = numberOr(d.totalScore, 0);

    this.owned.clear();
    this.owned.set(DEFAULT_CHARACTER, { uses: Infinity, permanent: true });
    if (typeof d.owned === 'object' && d.owned !== null) {
      for (const [id, o] of Object.entries(d.owned)) {
        // Ignore ids that no longer exist, so an old save cannot select a
        // character that has since been renamed or removed.
        if (CHARACTERS[id] === undefined) continue;
        if (id === DEFAULT_CHARACTER) continue;
        if (typeof o !== 'object' || o === null) continue;
        const rec = o as Partial<OwnedCharacter>;
        this.owned.set(id, {
          uses: Math.max(0, numberOr(rec.uses, 0)),
          permanent: rec.permanent === true,
        });
      }
    }

    const sel = typeof d.selected === 'string' ? d.selected : DEFAULT_CHARACTER;
    this.selected = this.isOwned(sel) ? sel : DEFAULT_CHARACTER;
  }
}

function numberOr(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

/**
 * localStorage, wrapped. It can be absent, disabled, or throw on access in a
 * private window, and the game has to work regardless - so every path here
 * fails silently and the player simply gets a fresh save.
 */
export function saveMeta(meta: MetaState): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(meta.toJSON()));
  } catch {
    /* storage unavailable: play on, just without persistence */
  }
}

export function loadMeta(meta: MetaState): void {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw === null) return;
    meta.load(JSON.parse(raw));
  } catch {
    /* corrupt or unavailable: fall back to defaults */
  }
}

export function clearMeta(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    /* nothing to do */
  }
}
