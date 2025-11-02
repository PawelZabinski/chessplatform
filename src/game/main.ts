import { Boot } from './scenes/Boot';
import { GameOver } from './scenes/GameOver';
import { Game as MainGame } from './scenes/Game';
import { AUTO, Game } from 'phaser';
import { Preloader } from './scenes/Preloader';
import { StartMenu } from './scenes/StartMenu';
import { Leaderboard } from './scenes/Leaderboard';

// Find out more information about the Game Config at:
// https://docs.phaser.io/api-documentation/typedef/types-core#gameconfig
const config: Phaser.Types.Core.GameConfig = {
    type: AUTO,
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: window.innerWidth,
        height: window.innerHeight
    },
    parent: 'game-container',
    backgroundColor: '#028af8',
    scene: [
        Boot,
        Preloader,
        StartMenu,
        Leaderboard,
        MainGame,
        GameOver
    ],
    physics: {
            default: 'arcade',
            arcade: {
                gravity: { y: 200 }
            }
        }
};

const StartGame = (parent: string): Game => {
    return new Game({ ...config, parent });
};

export default StartGame;
