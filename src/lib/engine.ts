import { Chess, type Move } from 'chess.js';

type EngineState = 'uninitialised' | 'initialising' | 'waiting' | 'searching';

export interface EngineOptions {
	moveTime?: number;
	depth?: number;
	color?: 'w' | 'b';
	stockfishPath?: string;
	randomMoveProbability?: number;
}

type UciCallback = (uci: string) => void;

export class Engine {
	private stockfish?: Worker;
	private state: EngineState = 'uninitialised';
	private moveTime: number;
	private depth: number;
	private readonly stockfishPath: string;
	private onUciOk?: () => void;
	private onBestMove?: UciCallback;
	private externalUciCallback?: UciCallback;
	private randomMoveProbability: number;
	/** Stockfish Skill Level, 0 (weakest) to 20 (full strength). */
	private skillLevel = 1;
	private readonly handleUciMessage = (event: MessageEvent<string>) => {
		this.onUci(event.data);
	};

	public readonly color: 'w' | 'b';

	constructor(options: EngineOptions = {}) {
		this.moveTime = options.moveTime ?? 2000;
		this.depth = options.depth ?? 1;
		this.color = options.color ?? 'b';
		this.stockfishPath = options.stockfishPath ?? 'stockfish.js';
		this.randomMoveProbability = options.randomMoveProbability ?? 0.5;
	}

	/**
	 * Applies an engine strength. Tower floors set this once per floor; Endless
	 * raises it as the run progresses. Skill Level has to move alongside depth —
	 * a deep search pinned at Skill Level 1 still plays weakly.
	 */
	configure(settings: {
		randomMoveProbability?: number;
		depth?: number;
		moveTime?: number;
		skillLevel?: number;
	}): void {
		if (settings.randomMoveProbability !== undefined) {
			this.randomMoveProbability = settings.randomMoveProbability;
		}
		if (settings.depth !== undefined) this.depth = settings.depth;
		if (settings.moveTime !== undefined) this.moveTime = settings.moveTime;
		if (settings.skillLevel !== undefined) {
			this.skillLevel = Math.min(20, Math.max(0, Math.round(settings.skillLevel)));
			this.applySkillLevel();
		}
	}

	private applySkillLevel(): void {
		// Only meaningful once the worker exists; init() re-applies it otherwise.
		if (!this.stockfish) return;
		this.stockfish.postMessage('setoption name UCI_LimitStrength value false');
		this.stockfish.postMessage(`setoption name Skill Level value ${this.skillLevel}`);
	}

	/** Initialise Stockfish. Resolve promise after receiving uciok. */
	init(): Promise<void> {
		return new Promise((resolve) => {
			this.state = 'initialising';
			this.stockfish = new Worker(this.stockfishPath);
			this.stockfish.addEventListener('message', this.handleUciMessage);
			this.onUciOk = () => {
				if (this.state === 'initialising') {
					this.state = 'waiting';
					this.onUciOk = undefined;
					resolve();
				}
			};
			this.stockfish.postMessage('uci');
			this.applySkillLevel();
		});
	}

	private onUci(uci: string): void {
		if (this.onUciOk && uci === 'uciok') this.onUciOk();
		if (this.onBestMove && uci.startsWith('bestmove')) this.onBestMove(uci);
		if (this.externalUciCallback) this.externalUciCallback(uci);
	}

	setUciCallback(callback: UciCallback): void {
		this.externalUciCallback = callback;
	}

	getMove(fen: string): Promise<string> {
		return new Promise((resolve) => {
			if (!this.stockfish) throw new Error('Engine not initialised');
			if (this.state !== 'waiting') throw new Error(`Engine not ready (state: ${this.state})`);

			this.state = 'searching';
			this.stockfish.postMessage(`position fen ${fen}`);
			this.stockfish.postMessage(`go depth ${this.depth} movetime ${this.moveTime}`);

			this.onBestMove = (uci) => {
				const uciArray = uci.split(' ');
				const bestMoveLan = uciArray[1] ?? '';
				this.state = 'waiting';
				this.onBestMove = undefined;

				if (Math.random() < this.randomMoveProbability) {
					const game = new Chess(fen);
					const allLegalMoves = game.moves({ verbose: true }) as Move[];
					const blunderMoves = allLegalMoves
						.map((move) => {
							const promotionSuffix = move.promotion ?? '';
							return `${move.from}${move.to}${promotionSuffix}`;
						})
						.filter((candidate) => candidate !== bestMoveLan);

					if (blunderMoves.length > 0) {
						const randomIndex = Math.floor(Math.random() * blunderMoves.length);
						resolve(blunderMoves[randomIndex]);
						return;
					}
				}

				resolve(bestMoveLan);
			};
		});
	}

	getColor(): 'w' | 'b' {
		return this.color;
	}

	isSearching(): boolean {
		return this.state === 'searching';
	}

	async stopSearch(): Promise<void> {
		return new Promise((resolve) => {
			if (!this.stockfish) throw new Error('Engine not initialised');
			if (this.state !== 'searching') {
				resolve();
				return;
			}
			this.onBestMove = () => {
				this.state = 'waiting';
				this.onBestMove = undefined;
				resolve();
			};
			this.stockfish.postMessage('stop');
		});
	}
}
