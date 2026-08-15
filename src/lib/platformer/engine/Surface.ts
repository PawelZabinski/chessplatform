/**
 * The drawing surface.
 *
 * Owns the canvas sizing so nothing else has to think about it. Two things
 * matter here and neither was handled well before:
 *
 *  - Device pixel ratio. The canvas backing store is sized in device pixels and
 *    the context pre-scaled, so everything downstream can work in CSS pixels and
 *    still come out sharp on a phone or a retina display.
 *  - Actual element size. A ResizeObserver watches the container, so orientation
 *    changes and mobile browser chrome sliding in and out are picked up directly
 *    rather than inferred from window events.
 */
export class Surface {
	readonly canvas: HTMLCanvasElement;
	readonly ctx: CanvasRenderingContext2D;

	/** Logical size in CSS pixels — what game code works in. */
	width = 0;
	height = 0;
	dpr = 1;

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
		const width = Math.max(1, Math.round(rect.width));
		const height = Math.max(1, Math.round(rect.height));

		if (width === this.width && height === this.height && dpr === this.dpr) return;

		this.width = width;
		this.height = height;
		this.dpr = dpr;

		this.canvas.width = Math.round(width * dpr);
		this.canvas.height = Math.round(height * dpr);

		// Crisp pixel art: no smoothing when scaling the sprite sheets up.
		this.ctx.imageSmoothingEnabled = false;

		this.onResize(width, height);
	};

	/** Resets the transform and applies the DPR scale for a fresh frame. */
	beginFrame() {
		this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
		this.ctx.imageSmoothingEnabled = false;
	}

	destroy() {
		this.observer?.disconnect();
		window.removeEventListener('resize', this.measure);
		this.canvas.remove();
	}
}
