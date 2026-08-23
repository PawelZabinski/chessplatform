# ChessPlatform

ChessPlatform turns a game of chess into a race up a collapsing tower. Every move on the board affects the climber beside it: captures launch you higher, files steer you across the tower, and taking too long lets the lava catch up.

The project began as a submission for a Cambridge hackathon in 2025. The original experiment joined a chess engine to a platform game; it has since grown into a complete browser game with a campaign, an endless mode, local progression, and real-time multiplayer.

## How it plays

- **Play chess to climb.** Captures create lift, with more valuable pieces producing bigger jumps.
- **Use the board to steer.** The file of a move influences horizontal movement while the platformer continues in real time.
- **Keep moving.** Rising lava punishes slow play, while spikes and gaps make each route different.
- **Find control runes.** Runes temporarily unlock direct movement and jumping.
- **Earn slow motion.** Climbing charges a short slow-motion ability for difficult moments.

The game includes three ways to play:

- **The Tower** — a hand-tuned campaign of increasingly difficult floors, each with its own position, terrain, hazards, and engine strength.
- **Endless Ascent** — a procedurally generated run in which every completed chess game sends you higher and strengthens the opponent.
- **The Race** — create or join a room for up to four players, then race on the same generated tower. Two-player rooms can also use a shared real-time chess board.

Progress, the last display name, and solo leaderboard entries are stored locally in the browser. Multiplayer rooms are temporary and disappear when empty.

## Controls

Most movement comes from chess, but a few direct controls help you survive the tower:

| Control | Action |
| --- | --- |
| `Space` | Brake to a stop |
| `S` or `↓` | Drop through a wooden platform |
| `Q` | Spend charged slow motion |
| `A` / `D` or `←` / `→` | Move while a control rune is active |
| `W`, `↑`, or `Space` | Jump while a control rune is active |

Touch devices use drag, tap, swipe, and an on-screen slow-motion control.

## Run locally

### Prerequisites

- [Node.js](https://nodejs.org/) 22 or newer
- npm

Install dependencies and start the frontend and multiplayer backend together:

```bash
git clone https://github.com/PawelZabinski/chessplatform.git
cd chessplatform
npm install
npm run dev:all
```

Open <http://localhost:8080>. The backend runs at <http://localhost:8787>, provides a health check at `/health`, and accepts multiplayer connections at `/ws/matches`.

To run only the frontend:

```bash
npm run dev-nolog
```

Hot reload is enabled for local development.

## Run with Docker

For a production-style local setup:

```bash
cp .env.example .env
docker compose up --build
```

Open <http://localhost:8080>. Nginx serves the static frontend and proxies multiplayer traffic to the backend on the same origin.

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `HOST` | `0.0.0.0` | Backend listen address |
| `PORT` | `8787` | Backend listen port |
| `LOG_LEVEL` | `info` | Backend log level: `debug`, `info`, `warn`, or `error` |
| `MATCH_WEBSOCKET_PATH` | `/ws/matches` | Multiplayer WebSocket endpoint |
| `PUBLIC_MATCH_SERVER` | automatic locally; `same-origin` in production | Full `ws://` or `wss://` URL, `same-origin`, or `disabled` |
| `WEB_PORT` | `8080` | Host port for the web container |
| `BACKEND_PORT` | `8787` | Host port exposed by the backend container |

When `PUBLIC_MATCH_SERVER` is unset during local development, the frontend connects to port `8787` on the browser host. Production builds default to `same-origin`.

## Useful commands

| Command | Description |
| --- | --- |
| `npm run dev:all` | Start the frontend and backend together |
| `npm run dev-nolog` | Start only the frontend |
| `npm run backend` | Start the backend in watch mode |
| `npm run build-nolog` | Build the static frontend |
| `npm run check` | Type-check the frontend and backend |
| `npm run validate:levels` | Validate campaign level data |
| `npm run test:match:e2e` | Test multiplayer against a running backend |
| `npm run compose:up` | Build and start both containers |
| `npm run compose:down` | Stop both containers |

## Architecture

ChessPlatform is a Svelte and TypeScript frontend paired with a lightweight Node.js multiplayer server.

```text
Browser
├── Svelte UI and Chessground board
├── Canvas platformer engine
└── chess.js rules and Stockfish opponent

Node backend
├── GET /health
├── WebSocket rooms and player sessions
└── Authoritative multiplayer moves, positions, and results
```

The platformer and chess board are deliberately separate systems joined by the play screen. That keeps chess rules independent from rendering and lets multiplayer use server-authoritative game state without changing the climbing engine.

## Built with

- [Svelte](https://svelte.dev/) and [SvelteKit](https://kit.svelte.dev/)
- [TypeScript](https://www.typescriptlang.org/)
- [Chessground](https://github.com/lichess-org/chessground)
- [chess.js](https://github.com/jhlywa/chess.js)
- [Stockfish](https://stockfishchess.org/)
- Canvas 2D and WebSockets

## License

This project is available under the [MIT License](LICENSE).
