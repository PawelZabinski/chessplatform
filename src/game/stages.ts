/**
 * Stage progression.
 *
 * The climb is endless, but it is divided into named stages of LEVELS_PER_STAGE
 * altitude levels each. Each stage tunes how the procedural generator behaves —
 * how many platforms per band, how often they are blocked, how often they carry
 * a spike — and how much each level is worth.
 *
 * Stages beyond the named list keep escalating via `extrapolateStage`, so the
 * endless mode stays endless without needing an entry per stage.
 */

export const LEVELS_PER_STAGE = 15;

export interface StageConfig {
	/** 1-based stage number. */
	index: number;
	name: string;
	/** Tint applied to the stage banner. */
	accent: string;
	/** Probability that a given platform carries a spike. */
	spikeChance: number;
	/** Probability that a given platform is solid from below (tinted dark). */
	blockedChance: number;
	/** Relative weights for generating 1, 2 or 3 platforms in a band. */
	platformWeights: [number, number, number];
	/** Points awarded per level climbed while in this stage. */
	pointsPerLevel: number;
}

const NAMED_STAGES: StageConfig[] = [
	{
		index: 1,
		name: 'Foothills',
		accent: '#7dd3a0',
		spikeChance: 0.08,
		blockedChance: 0.15,
		platformWeights: [0.1, 0.65, 0.25],
		pointsPerLevel: 10
	},
	{
		index: 2,
		name: 'The Ascent',
		accent: '#7dc3e8',
		spikeChance: 0.14,
		blockedChance: 0.22,
		platformWeights: [0.15, 0.65, 0.2],
		pointsPerLevel: 15
	},
	{
		index: 3,
		name: 'Thin Air',
		accent: '#c9a7f0',
		spikeChance: 0.2,
		blockedChance: 0.3,
		platformWeights: [0.25, 0.6, 0.15],
		pointsPerLevel: 20
	},
	{
		index: 4,
		name: 'The Spire',
		accent: '#f0b37d',
		spikeChance: 0.27,
		blockedChance: 0.36,
		platformWeights: [0.35, 0.55, 0.1],
		pointsPerLevel: 25
	},
	{
		index: 5,
		name: 'Endgame',
		accent: '#f08a8a',
		spikeChance: 0.33,
		blockedChance: 0.42,
		platformWeights: [0.45, 0.5, 0.05],
		pointsPerLevel: 30
	}
];

const HARDEST_NAMED = NAMED_STAGES[NAMED_STAGES.length - 1];

/** Beyond the named stages difficulty keeps creeping, but stays winnable. */
function extrapolateStage(index: number): StageConfig {
	const stepsPast = index - HARDEST_NAMED.index;
	return {
		index,
		name: `Endgame +${stepsPast}`,
		accent: '#f08a8a',
		spikeChance: Math.min(0.45, HARDEST_NAMED.spikeChance + stepsPast * 0.02),
		blockedChance: Math.min(0.55, HARDEST_NAMED.blockedChance + stepsPast * 0.02),
		platformWeights: HARDEST_NAMED.platformWeights,
		pointsPerLevel: HARDEST_NAMED.pointsPerLevel + stepsPast * 5
	};
}

/** The stage a given altitude level belongs to. Level 0 is stage 1. */
export function stageForLevel(level: number): StageConfig {
	const index = Math.max(1, Math.floor(level / LEVELS_PER_STAGE) + 1);
	return NAMED_STAGES[index - 1] ?? extrapolateStage(index);
}

/** Levels remaining before `level` crosses into the next stage. */
export function levelsUntilNextStage(level: number): number {
	return LEVELS_PER_STAGE - (level % LEVELS_PER_STAGE);
}

/** Picks 1, 2 or 3 platforms according to the stage's weighting. */
export function pickPlatformCount(stage: StageConfig, roll: number): number {
	const [one, two] = stage.platformWeights;
	if (roll < one) return 1;
	if (roll < one + two) return 2;
	return 3;
}
