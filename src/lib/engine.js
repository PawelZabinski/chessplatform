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
                const bestMoveLan = uciArray[1];
                this.state = 'waiting';
                this.onBestMove = undefined;
                resolve(bestMoveLan);
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
