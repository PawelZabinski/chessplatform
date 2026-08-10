import { Boot } from './scenes/Boot';
import { GameOver } from './scenes/GameOver';
import { Game as MainGame } from './scenes/Game';
import { AUTO, Game } from 'phaser';
import { Preloader } from './scenes/Preloader';
import { StartMenu } from './scenes/StartMenu';
import { LevelSelect } from './scenes/LevelSelect';
import { Leaderboard } from './scenes/Leaderboard';

// Find out more information about the Game Config at:
// https://docs.phaser.io/api-documentation/typedef/types-core#gameconfig
const config: Phaser.Types.Core.GameConfig = {
    type: AUTO,
    pixelArt: true,
    scale: {
        // RESIZE makes the canvas track its container, so the game fills the
        // column beside the board instead of being letterboxed inside it.
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
    parent: 'game-container',
    backgroundColor: '#0b0704',
    scene: [
        Boot,
        Preloader,
        StartMenu,
        LevelSelect,
        Leaderboard,
        MainGame,
        GameOver
    ],
    physics: {
            default: 'arcade',
            arcade: {
                gravity: { y: 200 }
            }
        },
    render: {
        pixelArt: true,
        antialias: false,
        roundPixels: true
    }
};

const StartGame = (parent: string): Game => {
    return new Game({ ...config, parent });
};

export default StartGame;
