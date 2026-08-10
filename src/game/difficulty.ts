import type { EngineSettings } from './levels';

/**
 * Endless Ascent difficulty ramp.
 *
 * There is no difficulty selector: the run starts very easy and the engine gets
 * steadily stronger as you climb and as you win games. A run is therefore its
 * own difficulty curve — you play until the engine finally beats you.
 */

/** Tier 1 is the gentlest. Beyond MAX_TIER the engine is at full strength. */
export const MAX_TIER = 13;

/**
 * The tier a run is currently at. Both axes of progress raise it: altitude
 * (stage) and games won, so a player who keeps beating the engine ramps up
 * even if they climb slowly.
 */
export function tierFor(stageIndex: number, gamesWon: number): number {
	return Math.max(1, stageIndex + gamesWon);
}

/**
 * Engine strength for a tier. Starts near-random and converges on the engine
 * playing its best move every time.
 */
export function engineForTier(tier: number): EngineSettings {
	const t = Math.max(1, tier);
	const progress = Math.min(1, (t - 1) / (MAX_TIER - 1));

	return {
		// 0.9 (blunders constantly) down to 0 (always the best move).
		randomMoveProbability: Math.max(0, 0.9 * (1 - progress)),
		depth: Math.min(10, 1 + Math.floor(progress * 9)),
		moveTime: Math.min(1500, 400 + Math.round(progress * 1100)),
		// Skill Level has to climb with depth, or a deep search still plays weakly.
		skillLevel: Math.round(progress * 20)
	};
}

/** Short label for the HUD, so the player can see the engine sharpening. */
export function tierLabel(tier: number): string {
	const t = Math.min(tier, MAX_TIER);
	if (t <= 2) return 'Careless';
	if (t <= 4) return 'Loose';
	if (t <= 6) return 'Steady';
	if (t <= 8) return 'Sharp';
	if (t <= 10) return 'Ruthless';
	if (t < MAX_TIER) return 'Merciless';
	return 'Perfect';
}
