import type { Action, Input } from './Input';

/**
 * Touch gestures for the climb.
 *
 * The on-screen d-pad this replaces had the usual problem with a game you play
 * one-handed: the buttons sit where your thumb is, which is exactly where the
 * climber is about to be. Gestures put the controls wherever the finger lands
 * instead, so nothing occludes the part of the screen you are reading.
 *
 * Three gestures, mapped onto the same actions the keyboard produces:
 *
 *   drag horizontally  → hold left/right   (a virtual stick anchored where you touched)
 *   tap                → brake, and jump   (jump only bites while a control rune is lit)
 *   swipe down         → drop through the plank underfoot
 *
 * Deliberately no "swipe up to jump": a tap is faster, and an upward flick is
 * too easily produced by the tail of a horizontal drag.
 */

/** How far the finger must travel before it steers rather than taps. */
const DEAD_ZONE = 14;
/**
 * The stick re-anchors if the finger wanders further than this, so reversing
 * direction after a long drag costs one dead zone rather than the whole trip
 * back. Without it, steering right across the screen makes turning left feel
 * broken.
 */
const MAX_OFFSET = 72;
/** Movement still forgiven as a tap — thumbs are not precise. */
const TAP_SLOP = 12;
const TAP_MS = 280;
/** Downward travel that counts as a deliberate swipe, not drag jitter. */
const SWIPE_DOWN = 48;

export class Gestures {
	private pointerId: number | null = null;
	private anchorX = 0;
	private startX = 0;
	private startY = 0;
	private startedAt = 0;
	private travelled = 0;
	private steering: Action | null = null;
	private swiped = false;

	constructor(
		private readonly target: HTMLElement,
		private input: Input | null
	) {
		target.addEventListener('pointerdown', this.onDown);
		target.addEventListener('pointermove', this.onMove);
		target.addEventListener('pointerup', this.onUp);
		target.addEventListener('pointercancel', this.onCancel);
	}

	setInput(input: Input | null) {
		this.input = input;
	}

	/** Which way the stick is currently pushed, for the on-screen indicator. */
	get direction(): 'left' | 'right' | null {
		return this.steering === 'left' || this.steering === 'right' ? this.steering : null;
	}

	private onDown = (event: PointerEvent) => {
		// One finger drives the climb; the rest belong to the ability buttons.
		if (this.pointerId !== null) return;
		event.preventDefault();

		this.pointerId = event.pointerId;
		this.anchorX = this.startX = event.clientX;
		this.startY = event.clientY;
		this.startedAt = performance.now();
		this.travelled = 0;
		this.swiped = false;

		// Must come last, and must not be allowed to throw past this point.
		// setPointerCapture rejects a pointer the browser does not consider active,
		// and it used to run before the fields above were set — so the throw left
		// `startedAt` stale, every tap measured as far too slow to count, and
		// tapping did nothing at all while dragging still worked. Capture is an
		// optimisation (it keeps a finger that slides off the element reporting to
		// us); losing it is survivable, losing the tap is not.
		try {
			this.target.setPointerCapture?.(event.pointerId);
		} catch {
			/* Pointer already released or not capturable; gestures still work. */
		}
	};

	private onMove = (event: PointerEvent) => {
		if (event.pointerId !== this.pointerId) return;
		event.preventDefault();

		const dy = event.clientY - this.startY;
		const fromStart = Math.hypot(event.clientX - this.startX, dy);
		this.travelled = Math.max(this.travelled, fromStart);

		// Once per gesture, and only when the motion is clearly downward rather
		// than a horizontal drag that happened to sag.
		if (!this.swiped && dy > SWIPE_DOWN && dy > Math.abs(event.clientX - this.startX)) {
			this.swiped = true;
			this.input?.pressTouch('drop');
		}

		const dx = event.clientX - this.anchorX;
		if (dx > MAX_OFFSET) this.anchorX = event.clientX - MAX_OFFSET;
		else if (dx < -MAX_OFFSET) this.anchorX = event.clientX + MAX_OFFSET;

		const offset = event.clientX - this.anchorX;
		if (offset > DEAD_ZONE) this.steer('right');
		else if (offset < -DEAD_ZONE) this.steer('left');
		else this.steer(null);
	};

	private onUp = (event: PointerEvent) => {
		if (event.pointerId !== this.pointerId) return;
		event.preventDefault();

		const quick = performance.now() - this.startedAt <= TAP_MS;
		if (!this.swiped && quick && this.travelled <= TAP_SLOP) {
			// Both, matching the space bar: brake always applies, jump is ignored
			// unless a control rune is lit.
			this.input?.pressTouch('brake');
			this.input?.pressTouch('jump');
		}
		this.reset();
	};

	private onCancel = (event: PointerEvent) => {
		if (event.pointerId !== this.pointerId) return;
		event.preventDefault();
		this.reset();
	};

	private steer(next: Action | null) {
		if (next === this.steering) return;
		if (this.steering) this.input?.releaseTouch(this.steering);
		this.steering = next;
		if (next) this.input?.setTouch(next, true);
	}

	/** Lifting off must always stop the climber — never leave a hold latched. */
	private reset() {
		this.steer(null);
		this.pointerId = null;
		this.travelled = 0;
		this.swiped = false;
	}

	destroy() {
		this.reset();
		this.target.removeEventListener('pointerdown', this.onDown);
		this.target.removeEventListener('pointermove', this.onMove);
		this.target.removeEventListener('pointerup', this.onUp);
		this.target.removeEventListener('pointercancel', this.onCancel);
	}
}
