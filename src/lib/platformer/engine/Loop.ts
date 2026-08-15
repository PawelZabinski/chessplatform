/**
 * Fixed-timestep game loop.
 *
 * Physics runs in fixed steps with an accumulator, so behaviour is identical
 * whether the browser is running at 60fps, 120fps or throttling a background
 * tab. That was a real problem before: the old loop clamped a variable delta, so
 * a throttled tab quietly ran the simulation slower than wall-clock time and
 * timings measured in game time drifted away from real seconds.
 *
 * `timeScale` is the slow-motion hook. It scales simulated time only — the loop
 * still renders every animation frame, so slow motion stays smooth rather than
 * turning into a slideshow.
 */
export const FIXED_STEP_MS = 1000 / 120;

export interface LoopCallbacks {
	/** Called once per fixed step, with a constant dt in milliseconds. */
	update(stepMs: number): void;
	/**
	 * Called once per animation frame. `alpha` is how far between the last two
	 * fixed steps we are, for interpolating positions when drawing.
	 */
	render(alpha: number): void;
}

export class Loop {
	private running = false;
	private frame = 0;
	private previous = 0;
	private accumulator = 0;

	/** 1 = normal speed. Below 1 is slow motion. */
	timeScale = 1;

	/** Simulated milliseconds elapsed — the clock game logic should use. */
	simTime = 0;

	constructor(private readonly callbacks: LoopCallbacks) {}

	start() {
		if (this.running) return;
		this.running = true;
		this.previous = performance.now();
		this.accumulator = 0;
		this.frame = requestAnimationFrame(this.tick);
	}

	stop() {
		this.running = false;
		cancelAnimationFrame(this.frame);
	}

	private tick = (now: number) => {
		if (!this.running) return;
		this.frame = requestAnimationFrame(this.tick);

		let elapsed = now - this.previous;
		this.previous = now;

		// A tab that was backgrounded returns a huge delta. Clamp it so the
		// simulation never tries to catch up thousands of steps at once.
		if (elapsed > 250) elapsed = 250;

		this.accumulator += elapsed * this.timeScale;

		let steps = 0;
		while (this.accumulator >= FIXED_STEP_MS && steps < 8) {
			this.callbacks.update(FIXED_STEP_MS);
			this.simTime += FIXED_STEP_MS;
			this.accumulator -= FIXED_STEP_MS;
			steps++;
		}

		this.callbacks.render(this.accumulator / FIXED_STEP_MS);
	};
}
