import { TOUGHNESS_REF_SCORE } from '../config';

/**
 * How much tougher ordinary enemies and obstacles are at this score: a
 * multiplier on their health, 1 until TOUGHNESS_REF_SCORE and rising with
 * the square root after. Bosses have their own curve (BOSS_HP_SCALE_BASE).
 */
export function toughness(score: number): number {
  return Math.max(1, Math.sqrt(score / TOUGHNESS_REF_SCORE));
}
