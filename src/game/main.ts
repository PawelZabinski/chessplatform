import { Boot } from './scenes/Boot';
import { GameOver } from './scenes/GameOver';
import { Game as MainGame } from './scenes/Game';
import { AUTO, Game } from 'phaser';
import { Preloader } from './scenes/Preloader';
import { StartMenu } from './scenes/StartMenu';
import { LevelSelect } from './scenes/LevelSelect';
import { MultiplayerLobby } from './scenes/MultiplayerLobby';
import { Leaderboard } from './scenes/Leaderboard';

// Find out more information about the Game Config at:
// https://docs.phaser.io/api-documentation/typedef/types-core#gameconfig
const config: Phaser.Types.Core.GameConfig = {
    type: AUTO,
    pixelArt: true,
    scale: {
        // RESIZE makes the canvas track its container, so the game fills the
        // space beside (or above) the board rather than being letterboxed, and
        // follows orientation changes on a phone.
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
    input: {
        // Phones and tablets: the platformer is driven by on-screen controls.
        activePointers: 3
    },
    parent: 'game-container',
    backgroundColor: '#0b0704',
    scene: [
        Boot,
        Preloader,
        StartMenu,
        LevelSelect,
        MultiplayerLobby,
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
