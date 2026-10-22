/**
 * Every tuning value in the game. Nothing else may hard-code a magic number.
 * Units: design pixels ("world units", 540x960 portrait) and seconds.
 */

// ---------------------------------------------------------------- VIEW
/** Portrait 9:16 design resolution. All gameplay maths is in these units. */
export const VIEW_W = 540;
export const VIEW_H = 960;
/** Cap DPR: nothing in a flat-colour game benefits from 3x, and fill rate hurts. */
export const MAX_DPR = 2;
/** Keep the player inside the corridor by this margin. */
export const PLAY_MARGIN = 16;

// ---------------------------------------------------------------- LOOP
/**
 * Clamp absurd frame gaps (tab switch, GC spike, breakpoint). The darkness uses
 * the SAME clamped value, so a 5-second stall cannot instantly swallow you.
 */
export const MAX_FRAME_DT = 1 / 30;

// ------------------------------------------------------- TIME SCALE (core)
/**
 * The core mechanic. Pointer *path length* per second maps to world time scale.
 *
 *   n         = clamp01((vSmooth - DEADZONE) / (FULL - DEADZONE))
 *   timeScale = TS_MAX * n^TS_GAMMA
 *
 * Path length rather than net displacement, so a 120Hz touch stream and a 60Hz
 * mouse produce the same number. Speed is smoothed BEFORE the curve, because
 * "recent average hand speed" is a physically meaningful quantity; smoothing
 * after the gamma would make tau and the exponent interact unreadably.
 */
/** Below this you are still. Covers finger tremor and mouse jitter. */
export const TS_SPEED_DEADZONE = 20;
/** Crossing the screen width in ~0.9s = full speed. Reachable but committing. */
export const TS_SPEED_FULL = 600;
/** Slightly over 1 rewards panic-dragging, and punishes it: the world speeds up too. */
export const TS_MAX = 1.25;
/**
 * Deliberately 0, not a small floor: the original freezes hard, and the feel
 * test is that a frozen bullet's position must not drift in the third decimal.
 * Visual breathing while frozen comes from realElapsed-driven render pulses
 * (see ENEMY_RING_PULSE_HZ), never from letting the simulation creep.
 */
export const TS_MIN = 0;
/** Below 1, so gentle movement already yields perceptible flow. */
export const TS_GAMMA = 0.75;
/** Time wakes up almost instantly: the game must feel responsive. */
export const TS_TAU_UP = 0.05;
/** Freezing eases over ~2-3 frames so micro-pauses mid-drag do not strobe. */
export const TS_TAU_DOWN = 0.12;
/** On pointer release, a brief momentum tail so a slipped finger is not instant death. */
export const TS_RELEASE_TAU = 0.1;
/**
 * ESSENTIAL. Holding a pointer perfectly still produces NO events, so without
 * staleness detection the instantaneous speed keeps its last value forever and
 * the world never freezes.
 */
export const POINTER_STALE_SEC = 0.05;
/** Snap to a true zero below this, so the freeze is absolute. */
export const TS_SNAP_ZERO = 0.004;

// -------------------------------------------------------------- PLAYER
/** Pointer delta to world movement. 1.0 = 1:1 drag. */
export const PLAYER_DRAG_GAIN = 1.0;
/** Clamp so a flicked pointer cannot teleport you across the field. */
export const PLAYER_MAX_SPEED = 1800;
export const PLAYER_DRAW_SIZE = 40;
/**
 * THE balance lever of the whole roster (ANT BEAR 4 .. T-REX 18). Collision
 * must ALWAYS read this, never drawSize. If it ever derives from the drawn
 * size, all 81 characters lose their differentiation.
 */
export const PLAYER_HITBOX_DEFAULT = 9;
/** REAL seconds: runs even while time is stopped, as in the original. */
export const PLAYER_INVULN_SEC = 3.0;
export const PLAYER_INVULN_BLINK_HZ = 8;

// ------------------------------------------------------------- CAMERA
/** The view centre sits this far ahead, so you can see what is coming. */
export const CAMERA_LOOKAHEAD = 160;
export const CAMERA_DEADZONE = 70;
export const CAMERA_FOLLOW_TAU = 0.14;
/** Fraction of the view the darkness may claim before the camera stops ceding. */
export const CAMERA_DARKNESS_SLACK = 0.35;

// ---------------------------------------------------------- DARKNESS (core)
/**
 * The ONE thing that ignores timeScale. Advances on the REAL clock, which is
 * why standing still kills you.
 *
 * === THE CENTRAL BALANCE RELATIONSHIP ===
 * Escaping requires at least DARKNESS_BASE_SPEED of pointer travel, which
 * through the curve above gives:
 *   n = (46 - 20) / (600 - 20) = 0.0448  ->  timeScale = 1.25 * 0.0448^0.75 = 0.12
 * So the minimum speed that keeps you alive runs the world at ~12%: slow enough
 * to feel like bullet time, fast enough that enemies close in. Target band
 * 0.10-0.25. Above 0.4 nothing feels slow; below 0.05 it is a freeze-frame
 * puzzle. If you tune ONE relationship in this game, tune this one.
 * It also structurally kills nibbling: tiny movements keep timeScale near zero
 * AND lose ground at the full darkness speed.
 */
export const DARKNESS_BASE_SPEED = 46;
/**
 * Note this starts ABOVE DARKNESS_CATCHUP_GAP, so every run opens with the
 * darkness rubber-banding quickly down to the 520 equilibrium. That fast
 * initial close is the intended 'here it comes' moment, not a bug.
 */
export const DARKNESS_START_GAP = 700;
/** Beyond this it accelerates: you cannot simply outrun it forever. */
export const DARKNESS_CATCHUP_GAP = 520;
export const DARKNESS_CATCHUP_K = 0.9;
/** Hard leash, so it never becomes irrelevant. */
export const DARKNESS_MAX_GAP = 900;
/** Forgiveness at the very edge (the original let you touch the tip). */
export const DARKNESS_KILL_INSET = 6;
export const DARKNESS_FEATHER = 90;
/** Score at which base speed has doubled. */
// A 4-minute sim run hit the 2x ceiling by score ~1200, which demanded a
// sustained 92 u/s just to stay alive and pushed the escape time scale to
// 0.26, above the intended 0.10-0.25 band. Ramping over a longer score
// range keeps the mid-game inside the band.
export const DARKNESS_RAMP_SCORE = 2500;
export const DARKNESS_RAMP_MAX = 2.0;
export const DARKNESS_CONTINUE_PUSHBACK = 600;

// ------------------------------------------------------------ WEAPONS
export const BASE_FIRE_CADENCE = 0.145;
export const BASE_BULLET_SPEED = 780;
export const BASE_BULLET_DAMAGE = 1;
export const BASE_BULLET_SIZE = 9;
export const BASE_BULLET_LIFETIME = 2.2;
/**
 * Unlimited stacking needs a structural answer, not a cap. Past this ceiling
 * barrels are scaled down to fit and damage is multiplied by exactly the ratio
 * of barrels lost, so firepower keeps rising forever against a flat
 * performance ceiling. See weapons/compile.ts for the monotonicity contract.
 */
export const LOADOUT_MAX_BARRELS = 48;
export const LOADOUT_MAX_EMITTERS = 64;
export const BEHAVIOUR_SLOTS = 4;
/** Slow enough that you can out-manoeuvre an orange homer. */
export const TURN_HOMING = 110;
export const TURN_MISSILE = 200;

// ------------------------------------------------------- PROJECTILE CCD
/** Local substepping in the projectile system only: the one real tunneling hazard. */
export const CCD_MIN_TARGET_RADIUS = 10;
export const CCD_MAX_SUBSTEPS = 4;

// ----------------------------------------------------------- SPAWNING
export const SPAWN_BASE = 1.4;
export const SPAWN_MIN = 0.33;
export const SPAWN_HALVING_SCORE = 600;
export const CAP_BASE = 8;
export const CAP_STEP = 100;
export const CAP_MAX = 28;
export const SPAWN_MARGIN = 60;
/** An unavoidable spawn-kill in a one-hit game is unforgivable. */
export const SPAWN_MIN_PLAYER_DIST = 120;
export const SPAWN_AIM_JITTER_DEG = 18;
/** Spawn-direction weights [top, left, right, bottom] by score band. */
export const SIDE_BANDS: ReadonlyArray<{
  at: number;
  w: readonly [number, number, number, number];
}> = [
  { at: 0, w: [1.0, 0, 0, 0] },
  { at: 150, w: [0.7, 0.15, 0.15, 0] },
  { at: 400, w: [0.5, 0.2, 0.2, 0.1] },
  { at: 900, w: [0.45, 0.2, 0.2, 0.15] },
];
/** Bottom spawns must never emerge out of the black. */
export const SPAWN_BOTTOM_MIN_GAP = 260;

// -------------------------------------------------------------- SCORE
export const SCORE_FIRST_BOSS = 500;
export const BOSS_SCORE_INTERVAL = 750;
export const BOSS_SUPPRESSION = 0.5;
export const SCORE_HARD_MODE = 10000;
export const COIN_VALUE = 1;

// -------------------------------------------------------------- DEATH
export const DEATH_SLOWMO = 0.1;
export const DEATH_HOLD_SEC = 1.1;
export const DEATH_PARTICLES = 90;

// -------------------------------------------------------------- POOLS
export const POOL_ENEMY = 64;
export const POOL_PSHOT = 512;
export const POOL_ESHOT = 192;
export const POOL_PARTICLE = 1024;
export const POOL_PICKUP = 48;
export const POOL_DRONE = 24;

// ------------------------------------------------------------- RENDER
export const COLOR = {
  /** Near-white play field, as in the original. */
  bg: '#faf9f7',
  pageBg: '#1b1d21',
  frame: '#d9d6cf',
  gridMark: '#eceae4',
  ink: '#1e2024',
  /** Player fire: one cool accent. Nothing else may come near this hue. */
  playerShot: '#2b6cf6',
  playerShotEdge: '#133b8f',
  /** Enemy fire: one hot warning colour. Nothing else may come near this hue. */
  enemyShot: '#ff3b1f',
  enemyShotEdge: '#8d1300',
  freeze: '#7fd4ff',
  enemyBlack: '#262a30',
  enemyOrange: '#f08a1e',
  enemyPurple: '#8b4bd8',
  enemyGreen: '#2eb872',
  pickup: '#2b6cf6',
  darkness: '#06070a',
  hud: '#1e2024',
  hudDim: '#a7a29a',
} as const;
/** Enemy shots may never render visually smaller than player shots. */
export const ENEMY_BULLET_MIN_RADIUS = 6;
/** Pulses on the REAL clock, so enemy bullets keep breathing while frozen. */
export const ENEMY_RING_PULSE_HZ = 2.5;
export const PARTICLE_MIN = 3;
export const PARTICLE_MAX = 6;

// ---------------------------------------------------------- COLLISION
/**
 * Brute force is correct at this scale: ~9.5k circle tests worst case, ~0.2ms.
 * The grid lives behind the same API; flip this only when the overlay shows
 * collision exceeding COLLISION_MS_BUDGET at p95.
 */
export const COLLISION_USE_GRID = false;
export const GRID_CELL = 64;
export const COLLISION_MS_BUDGET = 1.5;

// -------------------------------------------------------------- FLAGS
export const FLAGS = {
  lobby: false,
  shop: false,
  bosses: false,
  save: false,
};
