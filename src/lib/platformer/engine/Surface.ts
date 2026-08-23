/**
 * The drawing surface.
 *
 * Owns the canvas sizing so nothing else has to think about it. Two things
 * matter here and neither was handled well before:
 *
 *  - One canonical world width. Every screen simulates the same 960-unit-wide
 *    tower; the context scales it uniformly to the element. A phone therefore
 *    sees the same platforms as a desktop, only smaller, rather than generating
 *    a narrower and mechanically different course.
 *  - Device pixel ratio. The backing store is sized in device pixels after that
 *    display scale, so the shrunken phone view remains crisp.
 *  - Actual element size. A ResizeObserver watches the container, so orientation
 *    changes and mobile browser chrome sliding in and out are picked up directly
 *    rather than inferred from window events.
 */
export const LOGICAL_WORLD_WIDTH = 960;

export class Surface {
	readonly canvas: HTMLCanvasElement;
	readonly ctx: CanvasRenderingContext2D;

	/** Logical world size — what simulation and rendering code work in. */
	width = 0;
	height = 0;
	dpr = 1;
	displayScale = 1;

	private displayWidth = 0;
	private displayHeight = 0;

	private observer?: ResizeObserver;
	private readonly onResize: (width: number, height: number) => void;

	constructor(
		private readonly container: HTMLElement,
		onResize: (width: number, height: number) => void = () => {}
	) {
		this.onResize = onResize;

		this.canvas = document.createElement('canvas');
		this.canvas.style.display = 'block';
		this.canvas.style.width = '100%';
		this.canvas.style.height = '100%';
		this.canvas.style.touchAction = 'none';
		container.appendChild(this.canvas);

		const ctx = this.canvas.getContext('2d', { alpha: false });
		if (!ctx) throw new Error('2D canvas is not available');
		this.ctx = ctx;

		this.measure();

		if (typeof ResizeObserver !== 'undefined') {
			this.observer = new ResizeObserver(() => this.measure());
			this.observer.observe(container);
		} else {
			window.addEventListener('resize', this.measure);
		}
	}

	private measure = () => {
		const rect = this.container.getBoundingClientRect();
		// Cap DPR: beyond 2 the extra pixels cost far more than they show.
		const dpr = Math.min(window.devicePixelRatio || 1, 2);
		const displayWidth = Math.max(1, Math.round(rect.width));
		const displayHeight = Math.max(1, Math.round(rect.height));
		const displayScale = displayWidth / LOGICAL_WORLD_WIDTH;
		const width = LOGICAL_WORLD_WIDTH;
		// Width determines a uniform scale. The logical height then expands or
		// contracts to fill the panel without stretching or letterboxing the world.
		const height = displayHeight / displayScale;

		if (
			displayWidth === this.displayWidth &&
			displayHeight === this.displayHeight &&
			dpr === this.dpr
		)
			return;

		this.width = width;
		this.height = height;
		this.dpr = dpr;
		this.displayWidth = displayWidth;
		this.displayHeight = displayHeight;
		this.displayScale = displayScale;

		this.canvas.width = Math.round(displayWidth * dpr);
		this.canvas.height = Math.round(displayHeight * dpr);

		// Crisp pixel art: no smoothing when scaling the sprite sheets up.
		this.ctx.imageSmoothingEnabled = false;

		this.onResize(width, height);
	};

	/** Resets the transform and maps logical world units into display pixels. */
	beginFrame() {
		const scale = this.dpr * this.displayScale;
		this.ctx.setTransform(scale, 0, 0, scale, 0, 0);
		this.ctx.imageSmoothingEnabled = false;
	}

	destroy() {
		this.observer?.disconnect();
		window.removeEventListener('resize', this.measure);
		this.canvas.remove();
	}
}
