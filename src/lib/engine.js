import { Chess } from 'chess.js';

export class Engine {
    constructor(options = {}) {
        this.stockfish = undefined;
        this.state = 'uninitialised';
        this.moveTime = options.moveTime || 2000;
        this.depth = options.depth || 40;
        this.color = options.color || 'b';
        this.stockfishPath = options.stockfishPath || 'stockfish.js';
        this.externalUciCallback = undefined;
        this.onUciOk = undefined;
        this.onBestMove = undefined;
        this.randomMoveProbability = 0.1;
    }

    // Initialise Stockfish. Resolve promise after receiving uciok.
    init() {
        return new Promise((resolve) => {
            this.state = 'initialising';
            this.stockfish = new Worker(this.stockfishPath);
            this.stockfish.addEventListener('message', (e) => this._onUci(e));
            this.onUciOk = () => {
                if (this.state === 'initialising') {
                    this.state = 'waiting';
                    this.onUciOk = undefined;
                    resolve();
                }
            };
            this.stockfish.postMessage('uci');
            this.stockfish.postMessage('setoption name Skill Level value 1');
            this.stockfish.postMessage('setoption name UCI_LimitStrength value true');
            this.stockfish.postMessage('setoption name UCI_Elo value 400');
        });
    }

    // Callback when receiving UCI messages from Stockfish.
    _onUci({ data }) {
        const uci = data;

        if (this.onUciOk && uci === 'uciok') {
            this.onUciOk();
        }
        if (this.onBestMove && uci.slice(0, 8) === 'bestmove') {
            this.onBestMove(uci);
        }
        if (this.externalUciCallback) {
            this.externalUciCallback(uci);
        }
    }

    setUciCallback(callback) {
        this.externalUciCallback = callback;
    }

    getMove(fen) {
        return new Promise((resolve) => {
            if (!this.stockfish)
                throw new Error('Engine not initialised');
            if (this.state !== 'waiting')
                throw new Error('Engine not ready (state: ' + this.state + ')');

            this.state = 'searching';
            this.stockfish.postMessage('position fen ' + fen);
            this.stockfish.postMessage(`go depth ${this.depth} movetime ${this.moveTime}`);

            this.onBestMove = (uci) => {
                const uciArray = uci.split(' ');
                const bestMoveLan = uciArray[1]; // Stockfish's ELO 100 "best" move
                this.state = 'waiting';
                this.onBestMove = undefined;

                if (Math.random() < this.randomMoveProbability) {
                    // 1. Create a game instance from the FEN
                    const game = new Chess(fen);
                    
                    const allLegalMoves = game.moves({ verbose: true }).map(m => m.from + m.to);
                    const blunderMoves = allLegalMoves.filter(move => move !== bestMoveLan);

                    if (blunderMoves.length > 0) {
                        const randomIndex = Math.floor(Math.random() * blunderMoves.length);
                        resolve(blunderMoves[randomIndex]);
                    } else {
                        resolve(bestMoveLan);
                    }
                    
                } else {
                    resolve(bestMoveLan);
                }
            };
        });
    }

    getColor() {
        return this.color;
    }

    isSearching() {
        return this.state === 'searching';
    }

    async stopSearch() {
        return new Promise((resolve) => {
            if (!this.stockfish)
                throw new Error('Engine not initialised');
            if (this.state !== 'searching')
                return resolve();
            
            this.onBestMove = (uci) => {
                this.state = 'waiting';
                this.onBestMove = undefined;
                resolve();
            };
            this.stockfish.postMessage('stop');
        });
    }
}