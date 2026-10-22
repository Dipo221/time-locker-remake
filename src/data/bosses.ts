import type { EnemyDef } from './enemies';

/**
 * The five bosses, from the researched roster. Shared traits per the source:
 * very high durability, very large, they press the player rather than charge
 * past, and they do not leave until killed.
 *
 * The source rates durability on a scale where ordinary enemies sit at 1-5 and
 * bosses at 6-10. Those ratings are preserved as the RELATIVE ordering here -
 * the bear is the squishiest, the dinosaur the toughest - multiplied into
 * real hit points by BOSS_HP_PER_POINT.
 */
/**
 * Hit points per durability rating, before score scaling.
 *
 * This has come down twice, and the second time was the instructive one. The
 * numbers that produced 90, then 45, came from a simulated player that was
 * INVULNERABLE - it could park in front of a boss and pour fire in, so its
 * damage output was close to the theoretical maximum. A real player spends
 * most of a boss fight dodging, with the boss blocking the way forward and
 * the darkness closing from behind, so far less of their damage ever lands.
 * Play-testing reported bosses as unbeatable, which is the gap between those
 * two things. Measure against a bot that cannot die and you will tune every
 * fight too hard.
 */
export const BOSS_HP_PER_POINT = 18;

const BOSS_SHOT = {
  shape: 'bulletRound',
  size: 15,
  speed: 240,
  damage: 1,
  lifetime: 1.5, // the source calls the bear's range short
  maxHits: 1,
} as const;

export const BOSSES: readonly EnemyDef[] = [
  /** Mammoth: "the most orthodox boss, and not fast." */
  {
    id: 'boss.mammoth',
    displayName: 'MAMMOTH',
    isBoss: true,
    colorRole: 'boss',
    shape: 'mammoth',
    drawSize: 112,
    hitboxRadius: 42,
    hp: 8 * BOSS_HP_PER_POINT,
    archetype: 'orbitPlayer',
    orbitRadius: 190,
    speed: 105,
    scoreValue: 400,
    drop: 'weapon',
    minScore: 0,
    spawnWeight: 1,
  },

  /**
   * Bear: armed, fires three-shot bursts while chasing, shortest range, and
   * the lowest durability of the five. The one you can out-trade.
   */
  {
    id: 'boss.bear',
    displayName: 'WAR BEAR',
    isBoss: true,
    colorRole: 'boss',
    shape: 'bear',
    drawSize: 98,
    hitboxRadius: 36,
    hp: 6 * BOSS_HP_PER_POINT,
    archetype: 'orbitPlayer',
    orbitRadius: 150,
    speed: 112,
    scoreValue: 350,
    drop: 'weapon',
    minScore: 0,
    spawnWeight: 1,
    aim: 'player',
    weapon: {
      id: 'bossBearBurst',
      anglesDeg: [0],
      burst: 3,
      spreadDeg: 20,
      cadence: 1.7,
      phase: 0.3,
      muzzleY: 40,
      projectile: BOSS_SHOT,
    },
  },

  /**
   * Gorilla: faster than the player, which makes it hard to hit. The source
   * says the counter is a freezing weapon - and ICE CANON does not exist yet,
   * so for now the counter is the time freeze itself: stop, let it commit to
   * an arc, and fire into where it is going.
   */
  {
    id: 'boss.gorilla',
    displayName: 'GORILLA',
    isBoss: true,
    colorRole: 'boss',
    shape: 'gorilla',
    drawSize: 100,
    hitboxRadius: 34,
    hp: 7 * BOSS_HP_PER_POINT,
    archetype: 'orbitPlayer',
    orbitRadius: 120,
    speed: 200,
    scoreValue: 450,
    drop: 'weapon',
    minScore: 0,
    spawnWeight: 1,
  },

  /**
   * Dinosaur: the toughest by a margin, big enough to block the view, and
   * easy to hit. A war of attrition rather than a puzzle.
   */
  {
    id: 'boss.dino',
    displayName: 'T-REX',
    isBoss: true,
    colorRole: 'boss',
    shape: 'dino',
    drawSize: 150,
    hitboxRadius: 54,
    hp: 10 * BOSS_HP_PER_POINT,
    archetype: 'orbitPlayer',
    orbitRadius: 210,
    speed: 95,
    scoreValue: 550,
    drop: 'weapon',
    minScore: 0,
    spawnWeight: 1,
  },

  /**
   * Insect: rated the hardest. It holds still for a beat, then closes the
   * distance fast. The telegraphed pause is the whole fight - it is the
   * window to reposition, and the thing the time freeze lets you read.
   */
  {
    id: 'boss.insect',
    displayName: 'SWARM QUEEN',
    isBoss: true,
    colorRole: 'boss',
    shape: 'insect',
    drawSize: 106,
    hitboxRadius: 36,
    hp: 7 * BOSS_HP_PER_POINT,
    archetype: 'charger',
    speed: 55,
    chargeWindup: 1.15,
    chargeSpeed: 430,
    chargeDuration: 0.75,
    scoreValue: 500,
    drop: 'weapon',
    minScore: 0,
    spawnWeight: 1,
  },
];
