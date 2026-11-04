/**
 * Every tuning value in the game. Nothing else may hard-code a magic number.
 * Units: design pixels ("world units", 540x960 portrait) and seconds.
 */

import type { ShotFamily } from './game/weapons/types';

// ---------------------------------------------------------------- VIEW
/** Portrait 9:16 design resolution: the window you see through. */
export const VIEW_W = 540;
export const VIEW_H = 960;
/**
 * The playfield is WIDER than the view, and the camera pans sideways to
 * follow you. With the corridor pinned to the screen width there was no
 * lateral room to dodge into - the walls were simply the screen edges.
 *
 * The camera maps the player's position across the world onto its own range,
 * so reaching either wall always brings that wall fully into view.
 */
export const WORLD_W = 760;
/** Horizontal camera smoothing (real time). */
export const CAMERA_X_TAU = 0.18;
/** The camera never lets the player closer than this to a view edge. */
export const CAMERA_X_PLAYER_MARGIN = 30;
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
// Density was raised after play-testing reported the field looking empty.
// Most of the fix is group spawning (see EnemyDef.groupMin/groupMax) rather
// than a shorter interval: arriving in rows and flocks is what the original
// actually does, and it populates the screen without making every single
// enemy a separate dodge.
export const SPAWN_BASE = 0.85;
export const SPAWN_MIN = 0.22;
export const SPAWN_HALVING_SCORE = 450;
export const CAP_BASE = 12;
export const CAP_STEP = 70;
export const CAP_MAX = 34;
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
/**
 * Spacing between bosses, in score.
 *
 * Measured from the score at which the LAST boss died, not from an absolute
 * schedule. The absolute version (500, 1250, 2000, ...) looked fine on paper
 * and was wrong in play: score accrues faster and faster, so late in a run a
 * single boss fight earns more than the whole fixed interval, and the next
 * boss was already due the instant the last one died. Play-testing reported
 * exactly that - back-to-back bosses with no breathing room.
 *
 *     gap = min(BOSS_GAP_MAX, BOSS_GAP_BASE + score * BOSS_GAP_SLOPE)
 *
 * It saturates rather than growing without bound, because the measured score
 * rate saturates too: it climbs from ~2/s to ~120/s over the first 90 seconds
 * and then plateaus, since spawn density hits its own ceiling. A purely
 * proportional gap would therefore make late bosses rarer and rarer. These
 * values put roughly 20-30 seconds between bosses across the whole run.
 */
export const BOSS_GAP_BASE = 300;
export const BOSS_GAP_SLOPE = 0.85;
export const BOSS_GAP_MAX = 2600;
/**
 * After a boss SPAWNS, the next is held off by this fraction of a full gap.
 * Only relevant once concurrent bosses are allowed; it stops two arriving on
 * the same frame.
 */
export const BOSS_GAP_AFTER_SPAWN = 0.6;
/**
 * Concurrency grows with experience, so late in a long run the next boss can
 * arrive before the current one is finished - which is the intended escalation
 * rather than a scheduling accident.
 */
export const BOSS_CONCURRENT_PER_DEFEATS = 5;
export const BOSS_MAX_CONCURRENT = 3;
/**
 * Boss catch-up. Beyond BOSS_CATCHUP_START from its station a boss speeds up,
 * reaching BOSS_CATCHUP_MAX once BOSS_CATCHUP_RANGE further out.
 *
 * The multiplier has to be large, and it is safe for it to be: a player
 * holding the time scale at its ceiling travels ~600 u/s, so at 4x even the
 * full catch-up of the slowest boss (T-Rex, 95 u/s) was still slower than a
 * determined sprinter and could be escaped for good. At 10x it closes at
 * ~950 u/s, which nothing outruns.
 *
 * Nobody ever sees that speed, which is the point: full catch-up only applies
 * about a screen-height away, so it plays out off-screen and decays back to 1x
 * as the boss arrives. On screen a boss always moves at its own speed.
 */
/**
 * Boss health scales with SCORE rather than with how many bosses you have
 * already met. Score is the better proxy because it tracks the thing that
 * actually decides a fight - how much weaponry the player has stacked up -
 * whereas a count says nothing about whether they arrived strong or lucky.
 *
 *     scale = BOSS_HP_SCALE_BASE + sqrt(score) / BOSS_HP_SQRT_DIVISOR
 *
 * The square root is the important part, and it was measured rather than
 * chosen. A linear-in-score version made late fights drag to 40 seconds,
 * because score and player damage do NOT grow together: over one run, between
 * t=40s and t=280s score grew 12.4x while the player's damage grew only 2.7x.
 * Score accelerates with enemy density; damage only grows as fast as weapon
 * carriers can be shot down, which plateaus. Scaling health on the square root
 * tracks the damage curve instead, keeping fights roughly constant in length
 * for the whole run.
 *
 * Base is well below 1 so the first boss, which arrives at score 500 with the
 * player barely armed, is deliberately by far the softest of the run - it is
 * the one that has to be winnable, because a player who never beats a boss
 * never finds out that bosses are beatable.
 */
export const BOSS_HP_SCALE_BASE = 0.1;
export const BOSS_HP_SQRT_DIVISOR = 60;

/**
 * A pursuing boss matches at least this multiple of the player's own travel
 * per frame, so it can always regain its station.
 *
 * Without it a boss whose speed is merely below the player's settles just
 * BELOW them - outside the forward firing arc - and the fight stalls
 * completely. Measured before the fix: a T-Rex parked 101 units behind the
 * player and lost about 1 hit point per 40 seconds, surviving over two
 * minutes and blocking every later boss.
 *
 * It is expressed against per-frame travel rather than speed because the
 * player moves on the real clock and enemies on the scaled one, so comparing
 * the two speeds directly is wrong whenever time is dilated.
 */
export const BOSS_PURSUE_MARGIN = 1.3;

export const BOSS_CATCHUP_START = 300;
export const BOSS_CATCHUP_RANGE = 700;
export const BOSS_CATCHUP_MAX = 10;
export const BOSS_SUPPRESSION = 0.5;
export const SCORE_HARD_MODE = 10000;
/**
 * Coins per green carrier. Measured: at 1 a typical early run paid 6 coins
 * against 15 free, so how well you played was nearly irrelevant to income.
 */
export const COIN_VALUE = 3;
/**
 * Coins awarded per this much score at the end of a run.
 *
 * The main lever that makes PLAYING WELL pay. Without it, income came almost
 * entirely from pickups and a flat per-run handout, so a 1,500-point run and
 * a 12,000-point run were worth nearly the same.
 */
export const COIN_PER_SCORE = 150;

// ------------------------------------------------------------- META / SHOP
/**
 * The vending machine. 100 coins per pull, as in the original.
 *
 * POD_PULL_USES is the original's rule - a pulled character lasts exactly
 * three runs - and POD_PERMANENT_COST is the fix for it. Losing a character
 * you just unlocked is the single most complained-about thing in the reviews
 * ("you can't permanently unlock characters... even if it costs 5000 coins"),
 * so the pull stays as the cheap way in and buying one outright is the answer
 * to that complaint.
 */
export const POD_PULL_COST = 100;
export const POD_PULL_USES = 3;
export const POD_PERMANENT_COST = 800;
/**
 * Cumulative score at which each further vending machine opens: entry k opens
 * POD k + 2, so there is one threshold per machine after the first.
 *
 * The source says machines grow with accumulated score but gives no numbers,
 * so this is a quadratic curve: early machines come quickly, then each takes
 * longer. At a few thousand points a run, the first handful open within a
 * session and the last of the 25 is a long-term goal.
 *   POD 2 at 1,400    POD 6 at 15,000    POD 11 at 50,000
 *   POD 16 at 105,000 POD 21 at 180,000  POD 25 at 254,400
 */
export const POD_UNLOCK_SCORES: readonly number[] = Array.from(
  { length: 24 },
  (_, i) => {
    const k = i + 1;
    return Math.round((1000 * k + 400 * k * k) / 100) * 100;
  },
);

/**
 * Weapons bought before a run start already in the loadout. The original
 * allows three purchases of ordinary weapons per play, so the shop offers
 * three slots and each can be taken once.
 */
export const SHOP_SLOTS = 3;
export const SHOP_WEAPON_COST = 70;
/**
 * A free handful before each run, as the original's coin box gives. Small on
 * purpose: it is a consolation after a bad run, not an income stream. At 15 it
 * was most of a beginner's earnings, which made play feel unrewarded.
 */
export const FREE_COINS_PER_RUN = 8;

// -------------------------------------------------------------- DEATH
export const DEATH_SLOWMO = 0.1;
export const DEATH_HOLD_SEC = 1.1;
export const DEATH_PARTICLES = 90;

// ----------------------------------------------------- WEAPON CARRIERS
/**
 * Weapons come from a blue member of an ordinary group - one blue bird in a
 * flock - as in the original, not from a crate of their own. This is the
 * crate's old spawn weight, rolled alongside each spawn, so weapons arrive
 * exactly as often as they did: about one roll in five at the start of a
 * run, falling to one in twenty as the roster fills out.
 */
export const WEAPON_CARRIER_WEIGHT = 20;

// ---------------------------------------------------------- OBSTACLES
/**
 * Clusters of terrain - big blocks and trees - laid across the corridor by
 * DISTANCE travelled, not by time: they are scenery you run into, so they
 * arrive at the same rate however fast you push. Shooting them scores
 * nothing; they are there to make you steer.
 */
export const OBSTACLE_FIRST_Y = 1400;
export const OBSTACLE_GAP_MIN = 1100;
export const OBSTACLE_GAP_MAX = 2100;
/** How deep a cluster is, measured along the run. */
export const OBSTACLE_BAND = 200;
/** Clear space kept between any two members, so a cluster is never a wall. */
export const OBSTACLE_PASSAGE = 74;
/** Chance a cluster hides one green, coin-carrying member. */
export const OBSTACLE_GREEN_CHANCE = 0.4;
/**
 * Fraction of the player's DRAWN size that stops against an obstacle. The
 * hitbox is far smaller than the silhouette on purpose (it decides deaths);
 * solids use something near the visible body, or you would sink into blocks.
 */
export const PLAYER_SOLID_RADIUS_FRAC = 0.4;

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
  /**
   * You. Magenta, because it is the one hue no enemy uses - the old ink body
   * was all but identical to the black enemies, so the player was the hardest
   * thing on screen to find.
   */
  player: '#dc4ac1',
  /** The UI accent, and explosive player fire. See SHOT_COLORS. */
  playerShot: '#2b6cf6',
  playerShotEdge: '#133b8f',
  /**
   * Enemy fire: the hot warning colour. Nothing of the PLAYER'S may come near
   * this hue; the enemies that chase you and the bosses share it, as in the
   * original, and the bullets stay apart from them by their ring, round shape
   * and pulse (see drawEnemyShots).
   */
  enemyShot: '#ff3b1f',
  enemyShotEdge: '#8d1300',
  freeze: '#7fd4ff',
  enemyBlack: '#262a30',
  /** The chasers: the original's bright orange-red, the same danger colour as
   * enemy fire. The role keeps its old name. */
  enemyOrange: '#ff4a1c',
  enemyPurple: '#8b4bd8',
  enemyGreen: '#2eb872',
  /**
   * Bright orange-red, as in the original. A boss fires from inside its own
   * body in the same hue, which is why every enemy shot carries a white
   * separator ring: without it a fresh bullet would vanish into the boss.
   */
  boss: '#ff4a1c',
  pickup: '#2b6cf6',
  darkness: '#06070a',
  hud: '#1e2024',
  hudDim: '#a7a29a',
  /**
   * Obstacles. A notch darker than the side walls, so a block in the field
   * never reads as part of the corridor edge; the side shade is the face
   * turned toward the player.
   */
  obstacle: '#c9c5bc',
  obstacleSide: '#9f9a90',
  /** The face of a green, coin-carrying obstacle. */
  coinCarrierSide: '#1d7f4e',
  /** Pause screen, after the original: the score turns red while stopped. */
  pauseScore: '#e3262d',
  /** The original's teal for secondary buttons (the settings gear). */
  uiTeal: '#1aa0c0',
} as const;

/**
 * Player fire, coloured by what the shot DOES, so a glance at the screen says
 * what your loadout is doing. Chosen by measured perceptual distance (OKLab)
 * from each other, from the enemies and above all from the reserved enemy-fire
 * hue - palette.test.ts holds that last line.
 *
 * `edge` is a dark shade of the same hue: the rim that keeps the light ones
 * (amber, ice) visible on the near-white field, and the HUD chip text colour.
 */
export const SHOT_COLORS = {
  /**
   * Orange, as in the original. Pushed as far toward yellow as it can go and
   * still read as orange, because a true orange sits too close to enemy fire.
   */
  basic: { body: '#fea92f', edge: '#6c4300' },
  homing: { body: '#7cb518', edge: '#395800' },
  /** Took over the old plain-shot blue: any warm colour was too near orange. */
  explosive: { body: COLOR.playerShot, edge: COLOR.playerShotEdge },
  /** Deep blue, as in the original's BEAM. */
  pierce: { body: '#1a37a8', edge: '#0c1a66' },
  /** The same family as the frozen-enemy tint: the cause matches the effect. */
  ice: { body: '#3abdee', edge: '#005570' },
} as const satisfies Record<ShotFamily, { body: string; edge: string }>;

/**
 * Outline drawn behind the player, in screen pixels. Nothing an enemy owns is
 * outlined, so the outline itself says "yours" - shots get a thinner one.
 */
export const PLAYER_OUTLINE_PX = 2.5;
export const SHOT_RIM_PX = 1.1;
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

// ------------------------------------------------------------- SHARING
/** Where a shared score points friends. The public copy, not this page. */
export const PUBLIC_URL = 'https://dipo221.github.io/time-locker-remake/';

// -------------------------------------------------------------- FLAGS
export const FLAGS = {
  lobby: false,
  shop: false,
  bosses: true,
  save: false,
};
