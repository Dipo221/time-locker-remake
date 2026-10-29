import {
  BASE_BULLET_DAMAGE as DMG,
  BASE_BULLET_LIFETIME,
  BASE_BULLET_SIZE as SZ,
  BASE_BULLET_SPEED as SPD,
  BASE_FIRE_CADENCE as CAD,
} from '../config';
import type { BehaviourSpec } from '../game/behaviours';
import type {
  CharacterDef,
  EmitterSpec,
  ProjectileSpec,
} from '../game/weapons/types';

// ---------------------------------------------------------------- builders
// The roster is eighty-one characters, so these exist to keep each one to the
// few lines that actually say something about it. A character should read as
// its idea - "ten shots, straight backwards" - not as boilerplate.

const BASIC: ProjectileSpec = {
  shape: 'bulletLong',
  size: SZ,
  speed: SPD,
  damage: DMG,
  lifetime: BASE_BULLET_LIFETIME,
  maxHits: 1,
};

function shot(o: Partial<ProjectileSpec> = {}): ProjectileSpec {
  return { ...BASIC, ...o };
}

function gun(
  id: string,
  anglesDeg: readonly number[],
  o: Partial<EmitterSpec> = {},
): EmitterSpec {
  return {
    id,
    anglesDeg,
    burst: 1,
    spreadDeg: 0,
    cadence: CAD,
    phase: 0,
    muzzleY: 16,
    projectile: BASIC,
    ...o,
  };
}

const homing = (turnRateDeg = 260, acquireRadius = 420): BehaviourSpec => ({
  kind: 'homing',
  turnRateDeg,
  acquireRadius,
  retargetSec: 0.5,
});
const freeze = (durationSec = 2.2): BehaviourSpec => ({
  kind: 'freezing',
  durationSec,
});
const boom = (radius: number, damage: number): BehaviourSpec => ({
  kind: 'explodeOnHit',
  radius,
  damage,
});
const accel = (a: number, max: number): BehaviourSpec => ({
  kind: 'accelerate',
  accel: a,
  maxSpeed: max,
});

const ROCKET_SHOT = shot({
  shape: 'bulletRound',
  size: SZ * 1.4,
  speed: SPD * 0.45,
  damage: DMG * 3,
  lifetime: 2.6,
  behaviours: [accel(900, 950), boom(70, DMG * 2.5)],
});
const MISSILE_SHOT = shot({
  shape: 'bulletRound',
  size: SZ * 1.25,
  speed: SPD * 0.32,
  damage: DMG * 3,
  lifetime: 3.6,
  behaviours: [homing(240, 560), accel(520, 700), boom(62, DMG * 2)],
});
const BEAM_SHOT = shot({
  shape: 'beam',
  size: SZ * 2.4,
  speed: SPD * 1.5,
  damage: DMG * 0.9,
  lifetime: 1.5,
  maxHits: Number.POSITIVE_INFINITY,
});
const ICE_SHOT = shot({
  shape: 'bulletRound',
  size: SZ * 1.1,
  speed: SPD * 0.8,
  damage: 0,
  lifetime: 2,
  maxHits: 3,
  behaviours: [freeze()],
});
const HOMING_SHOT = shot({
  shape: 'bulletRound',
  size: SZ * 0.75,
  speed: SPD * 0.5,
  damage: DMG * 0.7,
  lifetime: 3,
  behaviours: [homing()],
});

/** THE LOCKER's gun, reused by anything that keeps the basic shot alongside its own. */
const BASE_SHOT = gun('base', [0]);

/**
 * The full roster, on the PODs the original actually dispenses them from:
 * THE LOCKER free from the start, 73 across machines 1-24 (four in the first,
 * three in each after), and the seven that were paid characters in the
 * original, gathered into a final machine 25 since this remake has no real
 * money in it.
 *
 * A few characters are APPROXIMATED, where the original has a mechanic this
 * engine does not yet model, and each says so in its comment. Everything else
 * is the source's description expressed as data.
 *
 * Hitbox size is set per character on purpose and never derived from the
 * silhouette: it is the primary balance lever across the whole roster. The
 * source's notes on "large hitbox" and "smallest hitbox" are followed.
 */
export const CHARACTERS: Record<string, CharacterDef> = {
  // ================================================================== free
  theLocker: {
    id: 'theLocker',
    name: 'THE LOCKER',
    blurb: 'Weak gun. Smallest hitbox but one.',
    shape: 'locker', drawSize: 40, hitboxRadius: 9, dragGain: 1,
    innate: [BASE_SHOT], modifiers: [],
  },

  // ================================================================= POD 1
  rifleLocker: {
    id: 'rifleLocker', name: 'RIFLE LOCKER', pod: 1,
    blurb: 'Rapid fire, offset to the left.',
    shape: 'locker', drawSize: 40, hitboxRadius: 10, dragGain: 1,
    // The source notes its right side is open: the stream sits off-centre.
    innate: [gun('rifle', [-3], { cadence: CAD * 0.45, muzzleY: 18 })],
    modifiers: [],
  },
  wideRhino: {
    id: 'wideRhino', name: 'WIDE RHINO', pod: 1,
    blurb: 'Born with WIDE SHOT, and makes every one it finds bigger.',
    shape: 'bear', drawSize: 48, hitboxRadius: 14, dragGain: 1,
    innate: [
      BASE_SHOT,
      gun('rhinoWide', [-45, 45], {
        cadence: CAD * 1.3, phase: 0.5, muzzleY: 10,
        projectile: shot({ size: SZ * 1.6, damage: DMG * 1.3 }),
      }),
    ],
    modifiers: [{ when: { weaponId: 'WIDE_SHOT' }, apply: { mulSize: 1.8, mulDamage: 1.3 } }],
  },
  warDrone: {
    id: 'warDrone', name: 'WAR DRONE', pod: 1,
    blurb: 'Starts with four TWIN SHOTs already stacked.',
    shape: 'heli', drawSize: 40, hitboxRadius: 12, dragGain: 1,
    innate: [gun('droneBase', [0], { cadence: CAD * 1.6 })],
    modifiers: [],
    startWeapons: ['TWIN_SHOT', 'TWIN_SHOT', 'TWIN_SHOT', 'TWIN_SHOT'],
  },
  rodeoStampede1: {
    id: 'rodeoStampede1', name: 'RODEO STAMPEDE', pod: 1,
    blurb: 'A five-shot spiral that sweeps the whole width.',
    shape: 'bear', drawSize: 46, hitboxRadius: 15, dragGain: 1,
    innate: [
      gun('spiral', [-50, -25, 0, 25, 50], {
        cadence: CAD * 1.4, track: 'sweep', sweepDeg: 22, sweepHz: 0.9,
        projectile: shot({ size: SZ * 0.9 }),
      }),
    ],
    modifiers: [],
  },

  // ================================================================= POD 2
  rocketLocker: {
    id: 'rocketLocker', name: 'ROCKET LOCKER', pod: 2,
    blurb: 'Twin rockets - and every ROCKET it picks up becomes twin too.',
    shape: 'locker', drawSize: 42, hitboxRadius: 12, dragGain: 1,
    innate: [gun('twinRocket', [-3, 3], { cadence: CAD * 4, phase: 0.2, muzzleY: 18, projectile: ROCKET_SHOT })],
    modifiers: [{ when: { tag: 'rocket' }, apply: { addBarrels: 1, addSpreadDeg: 10 } }],
  },
  homingHopper: {
    id: 'homingHopper', name: 'HOMING HOPPER', pod: 2,
    blurb: 'Four trackers, weak each. Covers the angles a forward gun cannot.',
    shape: 'frog', drawSize: 38, hitboxRadius: 12, dragGain: 1,
    innate: [gun('hopper', [-40, -15, 15, 40], { cadence: CAD * 2.4, phase: 0.3, muzzleY: 8, projectile: HOMING_SHOT })],
    modifiers: [{ when: { tag: 'homing' }, apply: { mulSize: 1.4, mulDamage: 1.5 } }],
  },
  bigLineLocker: {
    id: 'bigLineLocker', name: 'BIG LINE LOCKER', pod: 2,
    blurb: 'Fat, hard-hitting basic shot. Finds LINE and it is terrifying.',
    shape: 'locker', drawSize: 42, hitboxRadius: 11, dragGain: 1,
    innate: [gun('bigLine', [0], { cadence: CAD * 1.15, projectile: shot({ size: SZ * 1.8, damage: DMG * 2.2 }) })],
    modifiers: [{ when: { weaponId: 'LINE' }, apply: { mulSize: 1.7, mulDamage: 1.6 } }],
  },

  // ================================================================= POD 3
  dRifleLocker: {
    id: 'dRifleLocker', name: 'D RIFLE LOCKER', pod: 3,
    blurb: 'A second rifle of its own, on top of everything else.',
    shape: 'locker', drawSize: 40, hitboxRadius: 10, dragGain: 1,
    innate: [
      BASE_SHOT,
      gun('dRifle', [-5, 5], { cadence: CAD * 0.5, phase: 0.5, muzzleY: 18, projectile: shot({ size: SZ * 0.85 }) }),
    ],
    modifiers: [],
  },
  missileMaster: {
    id: 'missileMaster', name: 'MISSILE MASTER', pod: 3,
    blurb: 'Twin homing missiles. The blasts can hide what is behind them.',
    shape: 'locker', drawSize: 42, hitboxRadius: 12, dragGain: 1,
    innate: [
      BASE_SHOT,
      gun('mmMissile', [-14, 14], { cadence: CAD * 4.4, phase: 0.4, projectile: shot({ ...MISSILE_SHOT, behaviours: [homing(320, 600), accel(520, 700), boom(62, DMG * 2)] }) }),
    ],
    modifiers: [{ when: { weaponId: 'MISSILE' }, apply: { addBarrels: 1, addSpreadDeg: 12 } }],
  },
  homingIceBot: {
    id: 'homingIceBot', name: 'HOMING ICE BOT', pod: 3,
    blurb: 'Freezing shots that seek. No damage of their own.',
    shape: 'locker', drawSize: 40, hitboxRadius: 11, dragGain: 1,
    innate: [
      BASE_SHOT,
      gun('iceSeek', [-20, 20], { cadence: CAD * 2.6, phase: 0.6, projectile: shot({ ...ICE_SHOT, speed: SPD * 0.55, lifetime: 3, behaviours: [homing(240, 480), freeze()] }) }),
    ],
    modifiers: [],
  },

  // ================================================================= POD 4
  flapSniper: {
    id: 'flapSniper', name: 'FLAP SNIPER', pod: 4,
    blurb: 'Enormous single shot. Hits like a truck, covers nothing.',
    shape: 'bird', drawSize: 40, hitboxRadius: 11, dragGain: 1,
    innate: [gun('snipe', [0], { cadence: CAD * 3.4, muzzleY: 20, projectile: shot({ size: SZ * 2.2, speed: SPD * 1.35, damage: DMG * 7, maxHits: 2 }) })],
    modifiers: [],
  },
  minigunLocker: {
    id: 'minigunLocker', name: 'MINIGUN LOCKER', pod: 4,
    blurb: 'A heavy minigun on the left, the basic gun on the right.',
    shape: 'locker', drawSize: 44, hitboxRadius: 13, dragGain: 1,
    innate: [
      gun('minigun', [-4], { cadence: CAD * 0.55, muzzleY: 18, projectile: shot({ size: SZ * 1.5, damage: DMG * 1.4 }) }),
      gun('minigunBase', [5], { phase: 0.5 }),
    ],
    modifiers: [],
  },
  beamWalker: {
    id: 'beamWalker', name: 'BEAM WALKER', pod: 4,
    blurb: 'Twin beams. A second BEAM makes it four.',
    shape: 'locker', drawSize: 46, hitboxRadius: 14, dragGain: 1,
    innate: [gun('twinBeam', [-5, 5], { cadence: CAD * 2.4, phase: 0.15, muzzleY: 20, projectile: BEAM_SHOT })],
    modifiers: [{ when: { weaponId: 'BEAM', minStacks: 2 }, apply: { addBarrels: 2, addSpreadDeg: 8 } }],
  },

  // ================================================================= POD 5
  warManmoth: {
    id: 'warManmoth', name: 'WAR MANMOTH', pod: 5,
    blurb: 'Fat WIDE and SIDE fire: a solid wall across the front. Nothing behind.',
    shape: 'mammoth', drawSize: 52, hitboxRadius: 17, dragGain: 1,
    innate: [
      BASE_SHOT,
      gun('mammothWide', [-60, -30, 30, 60], { cadence: CAD * 1.5, phase: 0.4, projectile: shot({ size: SZ * 1.4 }) }),
      gun('mammothSide', [-90, 90], { cadence: CAD * 1.8, phase: 0.7, projectile: shot({ size: SZ * 1.4 }) }),
    ],
    modifiers: [
      { when: { weaponId: 'WIDE_SHOT' }, apply: { mulSize: 1.5 } },
      { when: { weaponId: 'SIDE_SHOT' }, apply: { mulSize: 1.5 } },
    ],
  },
  theDog: {
    id: 'theDog', name: 'THE DOG', pod: 5,
    blurb: 'Starts with a BEAM and a MISSILE. Otherwise an ordinary dog.',
    shape: 'dog', drawSize: 38, hitboxRadius: 12, dragGain: 1,
    innate: [BASE_SHOT], modifiers: [],
    startWeapons: ['BEAM', 'MISSILE'],
  },
  iceBeamRocker: {
    id: 'iceBeamRocker', name: 'ICE BEAM ROCKER', pod: 5,
    blurb: 'A freezing beam that pierces the whole line. Deals no damage.',
    shape: 'locker', drawSize: 42, hitboxRadius: 12, dragGain: 1,
    innate: [
      BASE_SHOT,
      gun('iceBeam', [0], { cadence: CAD * 3, phase: 0.5, muzzleY: 20, projectile: shot({ ...BEAM_SHOT, damage: 0, behaviours: [freeze(1.8)] }) }),
    ],
    modifiers: [],
  },

  // ================================================================= POD 6
  diffuser: {
    id: 'diffuser', name: 'DIFFUSER', pod: 6,
    blurb: 'A shotgun of a character. Close range, everything in front dies.',
    shape: 'bear', drawSize: 46, hitboxRadius: 14, dragGain: 1,
    innate: [gun('diffuse', [-55, -30, 0, 30, 55], { cadence: CAD * 1.5, phase: 0.4, muzzleY: 12, projectile: shot({ size: SZ * 0.95, speed: SPD * 0.9 }) })],
    modifiers: [{ when: { tag: 'spread' }, apply: { addDirectionsDeg: [-70, 70] } }],
  },
  sideLocker: {
    id: 'sideLocker', name: 'SIDE LOCKER', pod: 6,
    blurb: 'Its SIDE SHOT fires three abreast. Strafing is safe.',
    shape: 'locker', drawSize: 40, hitboxRadius: 11, dragGain: 1,
    innate: [BASE_SHOT, gun('triSide', [-90, 90], { burst: 3, spreadDeg: 16, cadence: CAD * 1.6, phase: 0.3 })],
    modifiers: [{ when: { weaponId: 'SIDE_SHOT' }, apply: { addBarrels: 2, addSpreadDeg: 14 } }],
  },
  backShooter: {
    id: 'backShooter', name: 'BACK SHOOTER', pod: 6,
    blurb: 'Ten shots straight backwards. Nothing forward at all.',
    shape: 'dog', drawSize: 48, hitboxRadius: 16, dragGain: 1,
    // A blind spot is an ABSENCE in the data, not a special case in code.
    innate: [gun('backSpray', [180], { burst: 5, spreadDeg: 34, cadence: CAD * 0.8, projectile: shot({ size: SZ * 0.9 }) })],
    modifiers: [],
  },

  // ================================================================= POD 7
  gameCast: {
    id: 'gameCast', name: 'GAME CAST', pod: 7,
    blurb: 'Shots that ricochet from enemy to enemy like a pinball.',
    shape: 'locker', drawSize: 40, hitboxRadius: 11, dragGain: 1,
    // Fanned from the centre, not set at +/-8 degrees: two angled barrels
    // straddle anything dead ahead at medium range and hit neither side of it
    // - a play test of the bounce caught this before anyone played it.
    innate: [gun('pinball', [0], { burst: 2, spreadDeg: 6, cadence: CAD * 1.5, projectile: shot({ shape: 'bulletRound', speed: SPD * 0.75, lifetime: 3, maxHits: 5, behaviours: [{ kind: 'bounce', bounces: 4, seekRadius: 320 }] }) })],
    modifiers: [],
  },
  applivWalker: {
    id: 'applivWalker', name: 'APPLIV WALKER', pod: 7,
    // APPROXIMATED: the original's bit also freezes what it touches; this
    // engine's GUARD BIT does not yet take a modifier.
    blurb: 'A guard bit circles it from the start.',
    shape: 'locker', drawSize: 40, hitboxRadius: 11, dragGain: 1,
    innate: [BASE_SHOT], modifiers: [],
    startWeapons: ['GUARD_BIT', 'GUARD_BIT'],
  },
  shikiishiLocker: {
    id: 'shikiishiLocker', name: 'SHIKIISHI LOCKER', pod: 7,
    blurb: 'Big shots in all four directions. Balanced and easy to use.',
    shape: 'locker', drawSize: 42, hitboxRadius: 11, dragGain: 1,
    innate: [gun('cross', [0, 90, 180, 270], { cadence: CAD * 1.2, projectile: shot({ size: SZ * 1.6, damage: DMG * 1.4 }) })],
    modifiers: [],
  },

  // ================================================================= POD 8
  hunterKiller: {
    id: 'hunterKiller', name: 'HUNTER KILLER', pod: 8,
    blurb: 'A dedicated four-shot gun. Big hitbox.',
    shape: 'insect', drawSize: 46, hitboxRadius: 16, dragGain: 1,
    innate: [gun('hk', [-9, -3, 3, 9], { cadence: CAD * 1.1, projectile: shot({ damage: DMG * 1.2 }) })],
    modifiers: [],
  },
  wideBreaker: {
    id: 'wideBreaker', name: 'WIDE BREAKER', pod: 8,
    blurb: 'Rockets out to both sides. Weak straight ahead.',
    shape: 'locker', drawSize: 42, hitboxRadius: 12, dragGain: 1,
    innate: [
      gun('weak', [0], { cadence: CAD * 1.6, projectile: shot({ size: SZ * 0.8, damage: DMG * 0.7 }) }),
      gun('sideRocket', [-80, 80], { cadence: CAD * 3.6, phase: 0.5, projectile: ROCKET_SHOT }),
    ],
    modifiers: [],
  },
  stegoSaur: {
    id: 'stegoSaur', name: 'STEGO SAUR', pod: 8,
    blurb: 'A beam that sweeps left to right. Low damage, lots of misses.',
    shape: 'dino', drawSize: 46, hitboxRadius: 14, dragGain: 1,
    innate: [gun('stegoBeam', [0], { cadence: CAD * 1.2, track: 'sweep', sweepDeg: 55, sweepHz: 0.45, projectile: shot({ ...BEAM_SHOT, damage: DMG * 0.6, lifetime: 1.1 }) })],
    modifiers: [],
  },

  // ================================================================= POD 9
  mineLocker: {
    id: 'mineLocker', name: 'MINE LOCKER', pod: 9,
    blurb: 'Starts every run with two mines already orbiting.',
    shape: 'locker', drawSize: 42, hitboxRadius: 12, dragGain: 1,
    innate: [BASE_SHOT], modifiers: [],
    startWeapons: ['MINE_BOT', 'MINE_BOT'],
  },
  farter: {
    id: 'farter', name: 'FARTER', pod: 9,
    blurb: 'Twin rockets out the back. Run away and watch things explode.',
    shape: 'dog', drawSize: 40, hitboxRadius: 12, dragGain: 1,
    innate: [gun('backRocket', [172, 188], { cadence: CAD * 3.6, phase: 0.25, projectile: ROCKET_SHOT }), BASE_SHOT],
    modifiers: [],
  },
  antBear: {
    id: 'antBear', name: 'ANT BEAR', pod: 9,
    blurb: 'No weapon at all. The smallest hitbox in the game.',
    shape: 'dog', drawSize: 30, hitboxRadius: 4, dragGain: 1,
    innate: [], modifiers: [],
  },

  // ================================================================ POD 10
  pteranodon: {
    id: 'pteranodon', name: 'PTERANODON', pod: 10,
    blurb: 'Fires in all eight directions. Low power.',
    shape: 'bird', drawSize: 42, hitboxRadius: 12, dragGain: 1,
    innate: [gun('eightWay', [0, 45, 90, 135, 180, 225, 270, 315], { cadence: CAD * 1.5, projectile: shot({ damage: DMG * 0.7 }) })],
    modifiers: [],
  },
  warFrog: {
    id: 'warFrog', name: 'WAR FROG', pod: 10,
    blurb: 'A stronger HOMING HOPPER, and every HOMING SHOT it finds adds up.',
    shape: 'frog', drawSize: 40, hitboxRadius: 12, dragGain: 1,
    innate: [gun('warHop', [-40, -15, 15, 40], { cadence: CAD * 2.1, projectile: shot({ ...HOMING_SHOT, size: SZ * 1.05, damage: DMG * 1.3 }) })],
    modifiers: [{ when: { weaponId: 'HOMING_SHOT' }, apply: { addBarrels: 1, mulDamage: 1.3 } }],
  },
  beamDragon: {
    id: 'beamDragon', name: 'BEAM DRAGON', pod: 10,
    blurb: 'Beams out to both sides. A blind spot dead ahead.',
    shape: 'dino', drawSize: 46, hitboxRadius: 14, dragGain: 1,
    innate: [gun('dragonBeam', [-90, 90], { cadence: CAD * 2.2, projectile: BEAM_SHOT })],
    modifiers: [],
  },

  // ================================================================ POD 11
  alligator: {
    id: 'alligator', name: 'ALLIGATOR', pod: 11,
    blurb: 'Starts the run already holding LINE.',
    shape: 'dino', drawSize: 44, hitboxRadius: 13, dragGain: 1,
    innate: [BASE_SHOT], modifiers: [],
    startWeapons: ['LINE'],
  },
  autoAimBot: {
    id: 'autoAimBot', name: 'AUTO AIM BOT', pod: 11,
    blurb: 'A turret that aims itself at the nearest enemy. Low power.',
    shape: 'locker', drawSize: 40, hitboxRadius: 11, dragGain: 1,
    innate: [gun('turret', [0], { track: 'nearest', trackRange: 480, cadence: CAD * 0.9, projectile: shot({ damage: DMG * 0.8 }) })],
    modifiers: [],
  },
  speedMslDog: {
    id: 'speedMslDog', name: 'SPEED-MSL DOG', pod: 11,
    blurb: 'Missiles at bullet speed. They overshoot and circle back.',
    shape: 'dog', drawSize: 38, hitboxRadius: 12, dragGain: 1,
    innate: [BASE_SHOT, gun('fastMissile', [-10, 10], { cadence: CAD * 3, phase: 0.4, projectile: shot({ ...MISSILE_SHOT, speed: SPD * 0.95, behaviours: [homing(150, 560), boom(60, DMG * 2)] }) })],
    modifiers: [],
  },

  // ================================================================ POD 12
  freezer: {
    id: 'freezer', name: 'FREEZER', pod: 12,
    blurb: 'A homing freeze shot. The answer to fast bosses.',
    shape: 'locker', drawSize: 40, hitboxRadius: 11, dragGain: 1,
    innate: [BASE_SHOT, gun('freezeSeek', [0], { cadence: CAD * 2, phase: 0.5, projectile: shot({ ...ICE_SHOT, speed: SPD * 0.6, lifetime: 3, behaviours: [homing(280, 520), freeze(2.6)] }) })],
    modifiers: [],
  },
  hummerHead: {
    id: 'hummerHead', name: 'HUMMER HEAD', pod: 12,
    blurb: 'Beams sideways, nothing ahead. Big hitbox.',
    shape: 'dog', drawSize: 48, hitboxRadius: 16, dragGain: 1,
    innate: [gun('hammerBeam', [-90, 90], { cadence: CAD * 2, projectile: BEAM_SHOT })],
    modifiers: [],
  },
  launcher: {
    id: 'launcher', name: 'LAUNCHER', pod: 12,
    blurb: 'Every ROCKET it fires hits far harder.',
    shape: 'locker', drawSize: 42, hitboxRadius: 12, dragGain: 1,
    innate: [BASE_SHOT, gun('heavyRocket', [0], { cadence: CAD * 4, phase: 0.3, projectile: shot({ ...ROCKET_SHOT, damage: DMG * 6, behaviours: [accel(900, 950), boom(80, DMG * 4)] }) })],
    modifiers: [{ when: { tag: 'rocket' }, apply: { mulDamage: 2 } }],
  },

  // ================================================================ POD 13
  peeRascal: {
    id: 'peeRascal', name: 'PEE RASCAL', pod: 13,
    blurb: 'A weak beam sweeping across the rear. The gun sits off to the right.',
    shape: 'dog', drawSize: 38, hitboxRadius: 12, dragGain: 1,
    innate: [
      gun('rascalBase', [3]),
      gun('rascalBeam', [180], { cadence: CAD * 1.3, track: 'sweep', sweepDeg: 50, sweepHz: 0.5, projectile: shot({ ...BEAM_SHOT, damage: DMG * 0.5, lifetime: 1 }) }),
    ],
    modifiers: [],
  },
  doubleSniper: {
    id: 'doubleSniper', name: 'DOUBLE SNIPER', pod: 13,
    blurb: 'Two colossal shots at once. One of the biggest hitboxes there is.',
    shape: 'bird', drawSize: 52, hitboxRadius: 18, dragGain: 1,
    innate: [gun('doubleSnipe', [-4, 4], { cadence: CAD * 3.4, projectile: shot({ size: SZ * 2.2, speed: SPD * 1.35, damage: DMG * 7, maxHits: 2 }) })],
    modifiers: [],
  },
  rodeoStampede2: {
    id: 'rodeoStampede2', name: 'RODEO STAMPEDE II', pod: 13,
    blurb: 'An enormously thick beam. Tall hitbox.',
    shape: 'bear', drawSize: 48, hitboxRadius: 15, dragGain: 1,
    innate: [gun('thickBeam', [0], { cadence: CAD * 2.2, projectile: shot({ ...BEAM_SHOT, size: SZ * 4.2 }) })],
    modifiers: [{ when: { weaponId: 'BEAM' }, apply: { mulSize: 1.6 } }],
  },

  // ================================================================ POD 14
  plesioSaur: {
    id: 'plesioSaur', name: 'PLESIO SAUR', pod: 14,
    // APPROXIMATED: the original's mines are individually larger and harder
    // hitting; here it simply starts with more of them.
    blurb: 'Starts with three mines - a serious threat to bosses.',
    shape: 'dino', drawSize: 46, hitboxRadius: 14, dragGain: 1,
    innate: [BASE_SHOT], modifiers: [],
    startWeapons: ['MINE_BOT', 'MINE_BOT', 'MINE_BOT'],
  },
  mucus: {
    id: 'mucus', name: 'MUCUS', pod: 14,
    blurb: 'An auto-aiming turret, stronger than AUTO AIM BOT\'s.',
    shape: 'frog', drawSize: 40, hitboxRadius: 12, dragGain: 1,
    // Fanned from the aim line, not offset from it: barrels at +/-8 degrees
    // straddled the very enemy the turret had locked onto.
    innate: [gun('mucusTurret', [0], { burst: 2, spreadDeg: 4, track: 'nearest', trackRange: 520, cadence: CAD * 0.8, projectile: shot({ damage: DMG * 1.2 }) })],
    modifiers: [],
  },
  warToy: {
    id: 'warToy', name: 'WAR TOY', pod: 14,
    blurb: 'Huge, hard-hitting TWIN SHOT. One of the biggest hitboxes there is.',
    shape: 'heli', drawSize: 54, hitboxRadius: 18, dragGain: 1,
    innate: [gun('toyTwin', [0], { burst: 2, spreadDeg: 12, cadence: CAD * 1.1, projectile: shot({ size: SZ * 1.7, damage: DMG * 1.8 }) })],
    modifiers: [{ when: { weaponId: 'TWIN_SHOT' }, apply: { mulSize: 1.6, mulDamage: 1.6 } }],
  },

  // ================================================================ POD 15
  twinkieDrone: {
    id: 'twinkieDrone', name: 'TWINKIE DRONE', pod: 15,
    blurb: 'A beam straight out the back.',
    shape: 'heli', drawSize: 40, hitboxRadius: 12, dragGain: 1,
    innate: [BASE_SHOT, gun('backBeam', [180], { cadence: CAD * 2.2, phase: 0.5, projectile: BEAM_SHOT })],
    modifiers: [],
  },
  trike: {
    id: 'trike', name: 'TRIKE', pod: 15,
    blurb: 'An auto-aiming super cannon with erratic aim.',
    shape: 'dino', drawSize: 46, hitboxRadius: 14, dragGain: 1,
    innate: [gun('trikeCannon', [0], { track: 'nearest', trackRange: 520, cadence: CAD * 3, spreadDeg: 0, projectile: shot({ shape: 'bulletRound', size: SZ * 2, damage: DMG * 6, speed: SPD * 0.9 }) })],
    modifiers: [],
  },
  icePteranodon: {
    id: 'icePteranodon', name: 'ICE PTERANODON', pod: 15,
    blurb: 'Freezing shots in all eight directions. Narrow across the wings.',
    shape: 'bird', drawSize: 44, hitboxRadius: 9, dragGain: 1,
    innate: [gun('iceEight', [0, 45, 90, 135, 180, 225, 270, 315], { cadence: CAD * 2.2, projectile: shot({ ...ICE_SHOT, size: SZ, speed: SPD * 0.75 }) }), BASE_SHOT],
    modifiers: [],
  },

  // ================================================================ POD 16
  whale: {
    id: 'whale', name: 'WHALE', pod: 16,
    blurb: 'A four-barrel beam of its own.',
    shape: 'bear', drawSize: 50, hitboxRadius: 16, dragGain: 1,
    innate: [gun('whaleBeam', [0], { burst: 4, spreadDeg: 18, cadence: CAD * 2.4, projectile: BEAM_SHOT })],
    modifiers: [],
  },
  wideIceLocker: {
    id: 'wideIceLocker', name: 'WIDE ICE LOCKER', pod: 16,
    blurb: 'Freezing shots out to both sides.',
    shape: 'locker', drawSize: 40, hitboxRadius: 11, dragGain: 1,
    innate: [BASE_SHOT, gun('sideIce', [-70, 70], { cadence: CAD * 2.2, phase: 0.5, projectile: ICE_SHOT })],
    modifiers: [],
  },
  tRex: {
    id: 'tRex', name: 'T-REX', pod: 16,
    blurb: 'Starts with BEAM, MINE BOT and two ROCKETs. The biggest hitbox.',
    shape: 'dino', drawSize: 58, hitboxRadius: 19, dragGain: 1,
    innate: [BASE_SHOT], modifiers: [],
    startWeapons: ['BEAM', 'MINE_BOT', 'ROCKET', 'ROCKET'],
  },

  // ================================================================ POD 17
  acuteWideLocker: {
    id: 'acuteWideLocker', name: 'ACUTE WIDE LOCKER', pod: 17,
    blurb: 'WIDE SHOT pulled forward: less spread, more on target.',
    shape: 'locker', drawSize: 40, hitboxRadius: 11, dragGain: 1,
    innate: [BASE_SHOT, gun('acute', [-20, 20], { cadence: CAD * 1.2, phase: 0.5 })],
    modifiers: [{ when: { weaponId: 'WIDE_SHOT' }, apply: { mulDamage: 1.5, addSpreadDeg: -8 } }],
  },
  psychicLocker: {
    id: 'psychicLocker', name: 'PSYCHIC LOCKER', pod: 17,
    blurb: 'Fast-firing bits that cover the flanks well.',
    shape: 'locker', drawSize: 40, hitboxRadius: 11, dragGain: 1,
    innate: [gun('bits', [-35, -12, 0, 12, 35], { cadence: CAD * 0.7, projectile: shot({ size: SZ * 0.75, damage: DMG * 0.8 }) })],
    modifiers: [],
  },
  mineDriver: {
    id: 'mineDriver', name: 'MINE DRIVER', pod: 17,
    // APPROXIMATED: in the original one of the two mines freezes; here both
    // are ordinary MINE BOTs.
    blurb: 'Two mines from the start.',
    shape: 'locker', drawSize: 42, hitboxRadius: 12, dragGain: 1,
    innate: [BASE_SHOT], modifiers: [],
    startWeapons: ['MINE_BOT', 'MINE_BOT'],
  },

  // ================================================================ POD 18
  quadLocker: {
    id: 'quadLocker', name: 'QUAD LOCKER', pod: 18,
    blurb: 'Its TWIN SHOT fires four abreast.',
    shape: 'locker', drawSize: 40, hitboxRadius: 11, dragGain: 1,
    innate: [gun('quad', [0], { burst: 4, spreadDeg: 16, cadence: CAD * 1.1 })],
    modifiers: [{ when: { weaponId: 'TWIN_SHOT' }, apply: { addBarrels: 2 } }],
  },
  speedRctDiatryma: {
    id: 'speedRctDiatryma', name: 'SPEED-RCT DIATRYMA', pod: 18,
    blurb: 'Faster rockets, fired more often.',
    shape: 'bird', drawSize: 44, hitboxRadius: 13, dragGain: 1,
    innate: [BASE_SHOT, gun('fastRocket', [0], { cadence: CAD * 2.4, phase: 0.4, projectile: shot({ ...ROCKET_SHOT, speed: SPD * 0.8 }) })],
    modifiers: [{ when: { tag: 'rocket' }, apply: { mulCadence: 0.6, mulSpeed: 1.6 } }],
  },
  predetor: {
    id: 'predetor', name: 'PREDETOR', pod: 18,
    blurb: 'Every WIDE SHOT it finds fires more bullets.',
    shape: 'lion', drawSize: 44, hitboxRadius: 13, dragGain: 1,
    innate: [BASE_SHOT, gun('predWide', [-45, -22, 22, 45], { cadence: CAD * 1.3, phase: 0.5 })],
    modifiers: [{ when: { weaponId: 'WIDE_SHOT' }, apply: { addBarrels: 2, addSpreadDeg: 8 } }],
  },

  // ================================================================ POD 19
  dimetrodon: {
    id: 'dimetrodon', name: 'DIMETRODON', pod: 19,
    blurb: 'Ten-bullet scatter forward, on a very short interval.',
    shape: 'dino', drawSize: 46, hitboxRadius: 14, dragGain: 1,
    innate: [gun('scatter', [0], { burst: 10, spreadDeg: 70, cadence: CAD * 1.1, projectile: shot({ size: SZ * 0.85, speed: SPD * 0.95 }) })],
    modifiers: [],
  },
  justin: {
    id: 'justin', name: 'JUSTIN', pod: 19,
    blurb: 'A giant shot that goes through everything, walls and all.',
    shape: 'locker', drawSize: 44, hitboxRadius: 12, dragGain: 1,
    innate: [gun('justin', [0], { cadence: CAD * 2.6, projectile: shot({ shape: 'bulletRound', size: SZ * 4, damage: DMG * 3, speed: SPD * 0.85, maxHits: Number.POSITIVE_INFINITY }) })],
    modifiers: [],
  },
  skater: {
    id: 'skater', name: 'SKATER', pod: 19,
    blurb: 'An auto-aiming rocket cannon.',
    shape: 'locker', drawSize: 40, hitboxRadius: 11, dragGain: 1,
    innate: [BASE_SHOT, gun('aimRocket', [0], { track: 'nearest', trackRange: 520, cadence: CAD * 3.2, phase: 0.5, projectile: ROCKET_SHOT })],
    modifiers: [],
  },

  // ================================================================ POD 20
  beamPsychic: {
    id: 'beamPsychic', name: 'BEAM PSYCHIC', pod: 20,
    blurb: 'Two floating beam cannons. The beams hide enemy fire - careful.',
    shape: 'locker', drawSize: 42, hitboxRadius: 12, dragGain: 1,
    innate: [gun('psyBeam', [-3, 3], { cadence: CAD * 1.8, projectile: shot({ ...BEAM_SHOT, size: SZ * 2 }) })],
    modifiers: [],
  },
  flatLocker: {
    id: 'flatLocker', name: 'FLAT LOCKER', pod: 20,
    blurb: 'An auto-aiming beam that covers the full circle.',
    shape: 'locker', drawSize: 40, hitboxRadius: 11, dragGain: 1,
    innate: [gun('autoBeam', [0], { track: 'nearest', trackRange: 560, cadence: CAD * 1.8, projectile: shot({ ...BEAM_SHOT, lifetime: 1.2 }) })],
    modifiers: [],
  },
  sprayWalker: {
    id: 'sprayWalker', name: 'SPRAY WALKER', pod: 20,
    blurb: 'Its basic shot is a scatter. With LINE it doubles.',
    shape: 'locker', drawSize: 40, hitboxRadius: 11, dragGain: 1,
    // Five, not four: an even burst has no centre barrel, and at this spread
    // its innermost pair straddled anything dead ahead.
    innate: [gun('spray', [0], { burst: 5, spreadDeg: 40, cadence: CAD * 1.2, projectile: shot({ size: SZ * 0.8, damage: DMG * 0.7 }) })],
    modifiers: [{ when: { weaponId: 'LINE' }, apply: { addBarrels: 3, addSpreadDeg: 20 } }],
  },

  // ================================================================ POD 21
  madLocker: {
    id: 'madLocker', name: 'MAD LOCKER', pod: 21,
    blurb: 'A four-rocket cannon. Bosses hate it.',
    shape: 'locker', drawSize: 42, hitboxRadius: 12, dragGain: 1,
    innate: [BASE_SHOT, gun('quadRocket', [-15, -5, 5, 15], { cadence: CAD * 4.4, phase: 0.3, projectile: ROCKET_SHOT })],
    modifiers: [],
  },
  bioRider: {
    id: 'bioRider', name: 'BIO RIDER', pod: 21,
    blurb: 'Twin rockets out to each side.',
    shape: 'locker', drawSize: 42, hitboxRadius: 12, dragGain: 1,
    innate: [BASE_SHOT, gun('sideTwinRocket', [-85, -75, 75, 85], { cadence: CAD * 3.8, phase: 0.5, projectile: ROCKET_SHOT })],
    modifiers: [],
  },
  supporterBear: {
    id: 'supporterBear', name: 'SUPPORTER BEAR', pod: 21,
    blurb: 'Starts with a SUPPORTER - the rarest drop in the game.',
    shape: 'bear', drawSize: 46, hitboxRadius: 14, dragGain: 1,
    innate: [BASE_SHOT], modifiers: [],
    startWeapons: ['SUPPORTER', 'SUPPORTER'],
  },

  // ================================================================ POD 22
  iceLineLocker: {
    id: 'iceLineLocker', name: 'ICE LINE LOCKER', pod: 22,
    blurb: 'Basic fire with freezing rounds mixed in. LINE makes it more.',
    shape: 'locker', drawSize: 40, hitboxRadius: 11, dragGain: 1,
    innate: [BASE_SHOT, gun('mixedIce', [0], { cadence: CAD * 1.6, phase: 0.5, projectile: shot({ ...ICE_SHOT, size: SZ * 0.9, speed: SPD * 0.9 }) })],
    modifiers: [{ when: { weaponId: 'LINE' }, apply: { addBarrels: 1 } }],
  },
  launcher2: {
    id: 'launcher2', name: 'LAUNCHER 2', pod: 22,
    blurb: 'Missiles that hit far harder. Good at breaking things.',
    shape: 'locker', drawSize: 42, hitboxRadius: 12, dragGain: 1,
    innate: [BASE_SHOT, gun('heavyMissile', [-10, 10], { cadence: CAD * 4.2, phase: 0.4, projectile: shot({ ...MISSILE_SHOT, damage: DMG * 6, behaviours: [homing(240, 600), accel(520, 700), boom(80, DMG * 4)] }) })],
    modifiers: [{ when: { weaponId: 'MISSILE' }, apply: { mulDamage: 2 } }],
  },
  xShooter: {
    id: 'xShooter', name: 'X-SHOOTER', pod: 22,
    blurb: 'Big shots in an X. Sides and rear are blind.',
    shape: 'locker', drawSize: 42, hitboxRadius: 12, dragGain: 1,
    innate: [gun('xShot', [-38, -14, 14, 38], { cadence: CAD * 1.3, projectile: shot({ size: SZ * 1.5, damage: DMG * 1.3 }) })],
    modifiers: [],
  },

  // ================================================================ POD 23
  autoIceLaser: {
    id: 'autoIceLaser', name: 'AUTO ICE LASER', pod: 23,
    blurb: 'A self-aiming freeze beam that pierces.',
    shape: 'locker', drawSize: 40, hitboxRadius: 11, dragGain: 1,
    innate: [BASE_SHOT, gun('autoIce', [0], { track: 'nearest', trackRange: 560, cadence: CAD * 2.8, phase: 0.5, projectile: shot({ ...BEAM_SHOT, damage: 0, behaviours: [freeze(2)] }) })],
    modifiers: [],
  },
  xLaser: {
    id: 'xLaser', name: 'X-LASER', pod: 23,
    blurb: 'Beams in a wide X. Reaches enemies before they are on screen.',
    shape: 'locker', drawSize: 42, hitboxRadius: 12, dragGain: 1,
    innate: [gun('xBeam', [-34, -12, 12, 34], { cadence: CAD * 2.4, projectile: shot({ ...BEAM_SHOT, size: SZ * 1.8 }) })],
    modifiers: [],
  },
  missileMaster2: {
    id: 'missileMaster2', name: 'MISSILE MASTER 2', pod: 23,
    blurb: 'Twin homing missiles fired backwards.',
    shape: 'locker', drawSize: 42, hitboxRadius: 12, dragGain: 1,
    innate: [BASE_SHOT, gun('backMissile', [165, 195], { cadence: CAD * 4, phase: 0.4, projectile: shot({ ...MISSILE_SHOT, behaviours: [homing(320, 620), accel(520, 700), boom(62, DMG * 2)] }) })],
    modifiers: [],
  },

  // ================================================================ POD 24
  backSprayShooter: {
    id: 'backSprayShooter', name: 'BACK SPRAY SHOOTER', pod: 24,
    blurb: 'A wide scatter out the back.',
    shape: 'dog', drawSize: 44, hitboxRadius: 13, dragGain: 1,
    innate: [BASE_SHOT, gun('backScatter', [180], { burst: 8, spreadDeg: 90, cadence: CAD * 1.2, projectile: shot({ size: SZ * 0.9 }) })],
    modifiers: [],
  },
  wideJustin: {
    id: 'wideJustin', name: 'WIDE JUSTIN', pod: 24,
    blurb: 'Giant piercing shots, fanned. WIDE SHOT does not add to them.',
    shape: 'locker', drawSize: 46, hitboxRadius: 13, dragGain: 1,
    innate: [gun('wideJustin', [-30, 0, 30], { cadence: CAD * 2.8, projectile: shot({ shape: 'bulletRound', size: SZ * 3.2, damage: DMG * 2.6, speed: SPD * 0.85, maxHits: Number.POSITIVE_INFINITY }) })],
    modifiers: [],
  },
  tracker: {
    id: 'tracker', name: 'TRACKER', pod: 24,
    blurb: 'A twenty-round missile battery. Bosses do not last.',
    shape: 'locker', drawSize: 44, hitboxRadius: 13, dragGain: 1,
    innate: [BASE_SHOT, gun('battery', [0], { burst: 10, spreadDeg: 120, cadence: CAD * 6, phase: 0.5, projectile: shot({ ...MISSILE_SHOT, damage: DMG * 4 }) })],
    modifiers: [],
  },

  // ============================================== POD 25: the paid seven
  // Paid characters in the original. With no real money here they come from
  // a final machine instead.
  panda: {
    id: 'panda', name: 'PANDA', pod: 25,
    // APPROXIMATED: the original's bears wander the field as companions; here
    // they are fired as strong homing rammers. Faithful to the source in
    // one detail that matters: they cannot hit helicopters.
    blurb: 'Bears that charge at enemies. Cannot touch anything airborne.',
    shape: 'bear', drawSize: 46, hitboxRadius: 14, dragGain: 1,
    innate: [gun('bears', [-40, 0, 40], { cadence: CAD * 2.4, projectile: shot({ shape: 'bulletRound', size: SZ * 1.6, damage: DMG * 2.4, speed: SPD * 0.45, lifetime: 3.4, hitsFlying: false, behaviours: [homing(200, 520)] }) })],
    modifiers: [],
  },
  greenMarker: {
    id: 'greenMarker', name: 'GREEN MARKER', pod: 25,
    blurb: 'Homing missiles from behind. These DO reach helicopters.',
    shape: 'locker', drawSize: 42, hitboxRadius: 12, dragGain: 1,
    innate: [BASE_SHOT, gun('rearMissile', [150, 210], { cadence: CAD * 3.4, phase: 0.4, projectile: MISSILE_SHOT })],
    modifiers: [],
  },
  goriWrap: {
    id: 'goriWrap', name: 'GORI WRAP', pod: 25,
    blurb: 'Piercing clones that rush out in all directions.',
    shape: 'gorilla', drawSize: 48, hitboxRadius: 15, dragGain: 1,
    innate: [gun('clones', [0, 60, 120, 180, 240, 300], { cadence: CAD * 2.2, track: 'sweep', sweepDeg: 30, sweepHz: 0.3, projectile: shot({ shape: 'bulletRound', size: SZ * 2.2, damage: DMG * 1.4, speed: SPD * 0.6, maxHits: Number.POSITIVE_INFINITY }) })],
    modifiers: [],
  },
  tortoise: {
    id: 'tortoise', name: 'TORTOISE', pod: 25,
    blurb: 'Two self-aiming rocket cannons.',
    shape: 'frog', drawSize: 46, hitboxRadius: 14, dragGain: 1,
    innate: [gun('tortRockets', [-6, 6], { track: 'nearest', trackRange: 560, cadence: CAD * 3.2, projectile: ROCKET_SHOT }), BASE_SHOT],
    modifiers: [],
  },
  penguin: {
    id: 'penguin', name: 'PENGUIN', pod: 25,
    blurb: 'Shots that burst ten ways on impact.',
    shape: 'penguin', drawSize: 42, hitboxRadius: 12, dragGain: 1,
    innate: [gun('burster', [0], { cadence: CAD * 1.6, projectile: shot({ shape: 'bulletRound', size: SZ * 1.4, behaviours: [{ kind: 'splitOnHit', count: 10, speed: SPD * 0.6, size: SZ * 0.8, damage: DMG * 0.8, lifetime: 0.9 }] }) })],
    modifiers: [],
  },
  husky: {
    id: 'husky', name: 'HUSKY', pod: 25,
    blurb: 'Dog-shots that bounce between enemies and roam for a while.',
    shape: 'dog', drawSize: 42, hitboxRadius: 12, dragGain: 1,
    // Centre-fanned for the same reason as GAME CAST.
    innate: [gun('bouncers', [0], { burst: 2, spreadDeg: 8, cadence: CAD * 1.7, projectile: shot({ shape: 'bulletRound', size: SZ * 1.3, speed: SPD * 0.7, lifetime: 4, maxHits: 7, behaviours: [{ kind: 'bounce', bounces: 6, seekRadius: 360 }] }) })],
    modifiers: [],
  },
  alloSaurus: {
    id: 'alloSaurus', name: 'ALLO SAURUS', pod: 25,
    // APPROXIMATED: the original's two pteranodons are bespoke companions;
    // SUPPORTER behaves the same way - covering fire, then a guided strike -
    // so it stands in for them.
    blurb: 'Two winged companions that hunt, shoot, then dive in.',
    shape: 'dino', drawSize: 46, hitboxRadius: 14, dragGain: 1,
    innate: [BASE_SHOT], modifiers: [],
    startWeapons: ['SUPPORTER', 'SUPPORTER'],
  },
};

export const DEFAULT_CHARACTER = 'theLocker';

export const CHARACTER_IDS = Object.keys(CHARACTERS);

/** Highest POD number that exists in the roster. */
export const MAX_POD = Math.max(
  ...CHARACTER_IDS.map((id) => CHARACTERS[id].pod ?? 0),
);

export function charactersInPod(pod: number): CharacterDef[] {
  return CHARACTER_IDS.map((id) => CHARACTERS[id]).filter((c) => c.pod === pod);
}
