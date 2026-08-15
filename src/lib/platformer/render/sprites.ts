import type { PlayerAnim } from '../world/Player';

/**
 * The authored sprite sheets — the frog ninja, kept exactly as they were.
 *
 * Each sheet is a horizontal strip of 32x32 frames. Loading is a plain image
 * fetch rather than an asset pipeline: there are four files and they are tiny.
 */

function loadImage(src: string): Promise<HTMLImageElement | undefined> {
	return new Promise((resolve) => {
		const image = new Image();
		image.onload = () => resolve(image);
		image.onerror = () => resolve(undefined);
		image.src = src;
	});
}

interface Sheet {
	image: HTMLImageElement;
	frames: number;
	fps: number;
}

const SHEETS: Record<PlayerAnim, { src: string; frames: number; fps: number }> = {
	idle: { src: '/assets/IdleNinja.png', frames: 11, fps: 8 },
	run: { src: '/assets/RunNinja.png', frames: 12, fps: 14 },
	jump: { src: '/assets/JumpNinja.png', frames: 1, fps: 1 },
	double: { src: '/assets/DoubleJumpNinja.png', frames: 6, fps: 16 }
};

export const FRAME_SIZE = 32;

/** The authored spike sheet: 4 frames of 54x52, kept as drawn. */
const SPIKE_SHEET = { src: '/assets/Spike.png', frames: 4, fps: 6, w: 54, h: 52 };

export class NinjaSprites {
	private sheets = new Map<PlayerAnim, Sheet>();
	private spike?: HTMLImageElement;
	ready = false;

	async load(): Promise<void> {
		const entries = Object.entries(SHEETS) as [PlayerAnim, (typeof SHEETS)[PlayerAnim]][];

		await Promise.all(
			entries.map(
				([anim, def]) =>
					new Promise<void>((resolve) => {
						const image = new Image();
						image.onload = () => {
							this.sheets.set(anim, { image, frames: def.frames, fps: def.fps });
							resolve();
						};
						// A missing sheet must not stop the game starting; the climber
						// falls back to a drawn placeholder.
						image.onerror = () => resolve();
						image.src = def.src;
					})
			)
		);

		this.spike = await loadImage(SPIKE_SHEET.src);
		this.ready = this.sheets.size > 0;
	}

	/** Draws the authored spike, animated. Falls back to nothing if absent. */
	drawSpike(
		ctx: CanvasRenderingContext2D,
		x: number,
		y: number,
		size: number,
		timeMs: number,
		phase: number
	): boolean {
		if (!this.spike) return false;
		const frame =
			Math.floor((timeMs / 1000) * SPIKE_SHEET.fps + phase) % SPIKE_SHEET.frames;
		ctx.drawImage(
			this.spike,
			frame * SPIKE_SHEET.w,
			0,
			SPIKE_SHEET.w,
			SPIKE_SHEET.h,
			Math.round(x),
			Math.round(y),
			Math.round(size),
			Math.round(size)
		);
		return true;
	}

	draw(
		ctx: CanvasRenderingContext2D,
		anim: PlayerAnim,
		animTimeMs: number,
		x: number,
		y: number,
		width: number,
		height: number,
		facing: 1 | -1
	) {
		const sheet = this.sheets.get(anim);

		ctx.save();
		// Sprites are drawn a little larger than the collision box so the body
		// reads properly; the extra hangs off the top, where nothing collides.
		const drawW = width * 1.9;
		const drawH = height * 1.55;
		const dx = x + width / 2 - drawW / 2;
		const dy = y + height - drawH;

		if (facing === -1) {
			ctx.translate(dx + drawW / 2, 0);
			ctx.scale(-1, 1);
			ctx.translate(-(dx + drawW / 2), 0);
		}

		if (sheet) {
			const frame = Math.floor((animTimeMs / 1000) * sheet.fps) % sheet.frames;
			ctx.drawImage(
				sheet.image,
				frame * FRAME_SIZE,
				0,
				FRAME_SIZE,
				FRAME_SIZE,
				Math.round(dx),
				Math.round(dy),
				Math.round(drawW),
				Math.round(drawH)
			);
		} else {
			ctx.fillStyle = '#6f8a4a';
			ctx.fillRect(Math.round(x), Math.round(y), width, height);
		}

		ctx.restore();
	}
}
