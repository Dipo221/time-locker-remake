import { describe, expect, it } from 'vitest';
import { COLOR, SHOT_COLORS } from '../config';
import { Pool } from '../core/pool';
import { CHARACTERS } from '../data/characters';
import { DRONE_IDS } from '../data/drones';
import { PROJECTILE_WEAPON_IDS, WEAPONS } from '../data/weapons';
import { createProjectile, resetProjectile } from '../game/entities/Projectile';
import { compileEmitter, shotFamily, weaponFamily } from '../game/weapons/compile';
import { emit } from '../game/weapons/fire';
import type { ShotFamily, WeaponId } from '../game/weapons/types';

// ---- colour science: OKLab distance and WCAG contrast, from sRGB hex -------

function channels(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
}

function oklab(hex: string): [number, number, number] {
  const [r, g, b] = channels(hex);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

/** Perceptual distance. ~0.02 is a just-noticeable difference. */
function dE(a: string, b: string): number {
  const p = oklab(a);
  const q = oklab(b);
  return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
}

function contrast(a: string, b: string): number {
  const lum = (h: string): number => {
    const [r, g, bl] = channels(h);
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const FAMILIES = Object.keys(SHOT_COLORS) as ShotFamily[];
const ENEMY_BODIES = [
  COLOR.enemyBlack,
  COLOR.enemyOrange,
  COLOR.enemyPurple,
  COLOR.enemyGreen,
  COLOR.boss,
  COLOR.freeze,
];

/**
 * The legibility rules, as numbers. The palette was chosen by measuring these
 * distances; this keeps a later "just tweak that colour" from quietly
 * breaking one. Thresholds sit a little under the shipped values.
 */
describe('palette', () => {
  it('nothing of the player comes near the reserved enemy-fire hue', () => {
    // The one rule that is not negotiable: the original was criticised by
    // name for enemy fire that looked like the player's own.
    const own = [COLOR.player, ...FAMILIES.map((f) => SHOT_COLORS[f].body)];
    for (const c of own) expect(dE(c, COLOR.enemyShot), c).toBeGreaterThan(0.2);
  });

  it('every shot family is clearly distinct from every other', () => {
    for (let i = 0; i < FAMILIES.length; i++) {
      for (let j = i + 1; j < FAMILIES.length; j++) {
        const a = SHOT_COLORS[FAMILIES[i]].body;
        const b = SHOT_COLORS[FAMILIES[j]].body;
        expect(dE(a, b), `${FAMILIES[i]} vs ${FAMILIES[j]}`).toBeGreaterThan(0.13);
      }
    }
  });

  it('the player is unlike every enemy, and readable on the field', () => {
    for (const e of ENEMY_BODIES) {
      expect(dE(COLOR.player, e), e).toBeGreaterThan(0.15);
    }
    expect(contrast(COLOR.player, COLOR.bg)).toBeGreaterThan(3);
  });

  it('every rim is dark enough to be HUD text on the field', () => {
    for (const f of FAMILIES) {
      expect(contrast(SHOT_COLORS[f].edge, COLOR.bg), f).toBeGreaterThan(4.5);
    }
  });
});

describe('shot families', () => {
  it('each weapon wears the colour of what it does', () => {
    const expected: Record<WeaponId, ShotFamily> = {
      TWIN_SHOT: 'basic',
      WIDE_SHOT: 'basic',
      SIDE_SHOT: 'basic',
      LINE: 'basic',
      HOMING_SHOT: 'homing',
      ROCKET: 'explosive',
      // Homes too, but the bang is what you need to know about.
      MISSILE: 'explosive',
      BEAM: 'pierce',
      ICE_CANON: 'ice',
      MINE_BOT: 'explosive',
      GUARD_BIT: 'pierce',
      SUPPORTER: 'basic',
    };
    for (const id of [...PROJECTILE_WEAPON_IDS, ...DRONE_IDS]) {
      expect(weaponFamily(id), id).toBe(expected[id]);
    }
  });

  it('every colour is actually worn by something', () => {
    // A family nothing fires is a palette entry nobody can learn.
    const seen = new Set<ShotFamily>();
    for (const id of PROJECTILE_WEAPON_IDS) seen.add(weaponFamily(id));
    for (const c of Object.values(CHARACTERS)) {
      for (const e of c.innate) seen.add(shotFamily(e.projectile));
    }
    expect([...seen].sort()).toEqual([...FAMILIES].sort());
  });

  it('a fired shot carries its family from the emitter', () => {
    const pool = new Pool(8, createProjectile, resetProjectile);
    emit(pool, compileEmitter(WEAPONS.ICE_CANON.emitters[0]), 0, 0, Math.PI / 2, 0, null);
    expect(pool.count).toBe(1);
    expect(pool.active[0].family).toBe('ice');
  });
});
