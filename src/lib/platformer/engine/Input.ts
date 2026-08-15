/**
 * Input.
 *
 * Keyboard and touch feed the same small set of actions, so the game never asks
 * "was this a key or a button?" — it asks whether an action is held, or was
 * pressed this step. Edge-triggered actions (jump, drop, slow-motion) are
 * latched and consumed, which is what makes a held on-screen button behave like
 * a single press.
 */

export type Action = 'left' | 'right' | 'jump' | 'drop' | 'brake' | 'slow';

const KEY_MAP: Record<string, Action> = {
	ArrowLeft: 'left',
	KeyA: 'left',
	ArrowRight: 'right',
	KeyD: 'right',
	ArrowUp: 'jump',
	KeyW: 'jump',
	Space: 'jump',
	ArrowDown: 'drop',
	KeyS: 'drop',
	KeyQ: 'slow'
};

/** Space brakes when it is not being used to jump. */
const BRAKE_KEYS = new Set(['Space']);

export class Input {
	private held = new Set<Action>();
	private pressed = new Set<Action>();
	private touchHeld = new Set<Action>();

	constructor(private readonly target: HTMLElement) {
		window.addEventListener('keydown', this.onKeyDown);
		window.addEventListener('keyup', this.onKeyUp);
		window.addEventListener('blur', this.releaseAll);
	}

	private onKeyDown = (event: KeyboardEvent) => {
		const action = KEY_MAP[event.code];
		if (!action) return;

		// Arrows and space would otherwise scroll the page underneath the game.
		if (event.code.startsWith('Arrow') || event.code === 'Space') event.preventDefault();

		if (!this.held.has(action)) this.pressed.add(action);
		this.held.add(action);

		if (BRAKE_KEYS.has(event.code)) this.pressed.add('brake');
	};

	private onKeyUp = (event: KeyboardEvent) => {
		const action = KEY_MAP[event.code];
		if (action) this.held.delete(action);
	};

	private releaseAll = () => {
		this.held.clear();
		this.touchHeld.clear();
	};

	/** Called by the on-screen controls. */
	setTouch(action: Action, down: boolean) {
		if (down) {
			if (!this.touchHeld.has(action)) this.pressed.add(action);
			this.touchHeld.add(action);
		} else {
			this.touchHeld.delete(action);
		}
	}

	isHeld(action: Action): boolean {
		return this.held.has(action) || this.touchHeld.has(action);
	}

	/** True once per press. Consumes the latch. */
	consume(action: Action): boolean {
		if (!this.pressed.has(action)) return false;
		this.pressed.delete(action);
		return true;
	}

	/** Clears any presses that were not consumed this step. */
	endStep() {
		this.pressed.clear();
	}

	destroy() {
		window.removeEventListener('keydown', this.onKeyDown);
		window.removeEventListener('keyup', this.onKeyUp);
		window.removeEventListener('blur', this.releaseAll);
	}
}

/** Whether this device is primarily touch-driven, for showing on-screen controls. */
export function isTouchDevice(): boolean {
	if (typeof window === 'undefined') return false;
	return (
		(navigator.maxTouchPoints ?? 0) > 0 && window.matchMedia('(pointer: coarse)').matches
	);
}
