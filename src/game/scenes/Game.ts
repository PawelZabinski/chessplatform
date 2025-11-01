import { EventBus } from '../EventBus';
import { GameObjects, Scene } from 'phaser';

export class Game extends Scene
{
    camera: Phaser.Cameras.Scene2D.Camera;
    background: GameObjects.Image;
    gameText: GameObjects.Text;

    //background: GameObjects.Image;
    character: GameObjects.Image;
    ground: GameObjects.Image[] = [];
    first_floor: GameObjects.Image[] = [];
    second_floor: GameObjects.Image[] = [];
    title: GameObjects.Text;
    logoTween: Phaser.Tweens.Tween | null;
    first_ground_function: GroundFunction;
    second_ground_function: GroundFunction;
    third_ground_function: GroundFunction;
    spikes: GameObjects.Image[] = [];


    pos: number = 1.05;


    constructor ()
    {
        super('Game');

    }

    create ()
    {
        this.camera = this.cameras.main;
        this.camera.setBackgroundColor(0x00ff00);

        this.background = this.add.image(512, 384, 'background');
        this.background.setAlpha(0.5);

        this.character = this.add.image(500, 500, 'Pawn_image');
        this.character.scaleX = 0.03;
        this.character.scaleY = 0.03;

        this.create_ground();

        EventBus.emit('current-scene-ready', this);
    }

    changeScene ()
    {
        this.scene.start('GameOver');
    }

    create_ground()
    {
        //yes i know this code sucks.
        //some values have been tuned for these test images
        //TODO implement proper images and refine these values

        this.first_ground_function = new GroundFunction();
        this.second_ground_function = new GroundFunction();
        this.third_ground_function = new GroundFunction();
        for (var i = 0; i < 20; i++) {

            this.ground.push(this.add.image(60 * i, 650 + Math.abs(20 * this.first_ground_function.get_value(i / 20)), 'Ground_block'))
            if (this.generate_spikes()) {
                this.spikes.push(this.add.image(60 * i, 604 + Math.abs(20 * this.first_ground_function.get_value(i / 20)), 'Spike'))
                this.spikes[this.spikes.length - 1].scale = 0.1;
            }
        }
        for (var i = 0; i < 20; i++) {

            if (Math.random() < 0.7) {
                this.first_floor.push(this.add.image(60 * i, 400 + Math.abs(20 * this.second_ground_function.get_value(i / 20)), 'Ground_block'))
                if (this.generate_spikes()) {
                    this.spikes.push(this.add.image(60 * i, 354 + Math.abs(20 * this.second_ground_function.get_value(i / 20)), 'Spike'))
                    this.spikes[this.spikes.length - 1].scale = 0.1;
                }
            }
        }
        for (var i = 0; i < 20; i++) {

            if (Math.random() < 0.4) {
                this.second_floor.push(this.add.image(60 * i, 150 + Math.abs(20 * this.third_ground_function.get_value(i / 20)), 'Ground_block'))
                if (this.generate_spikes()) {
                    this.spikes.push(this.add.image(60 * i, 104 + Math.abs(20 * this.third_ground_function.get_value(i / 20)), 'Spike'))
                    this.spikes[this.spikes.length - 1].scale = 0.1;
                }
            }
        }
        //for (var i = 0; i < 10; i++)
        //{
        //    this.update_ground();
        //}

        
    }

    generate_spikes()
    {
        //chance there is aspike on any given platform
        if (Math.random() < 0.2)
        {
            return true;
        }
        return false;
    }


    update_ground()
    {
        this.ground.shift();
        for (var i = 0; i < 19; i++)
        {
            this.ground[i].x -= 60;
        }
        this.ground.push(this.add.image(60 * 19, 650 + Math.abs(20 * this.first_ground_function.get_value(this.pos)), 'Ground_block'));
        this.pos + 0.05;

    }

}
export class GroundFunction {
    //function f(x) = a1sin(b1(x+c1))+a2sin(b2(x+c2))+a3sin(b3(x+c3))+a4sin(b4(x+c4))+a5sin(b5(x+c5))
    a_coefficents: number[] = []
    b_coefficents: number[] = []
    c_coefficents: number[] = []

    constructor() {
        for (var i = 0; i < 5; i++) {
            this.a_coefficents.push(this.get_random(-3, 3));
            this.b_coefficents.push(this.get_random(-5, 5));
            this.c_coefficents.push(this.get_random(-7, 7));
        }
    }

    get_random(min: number, max: number) {
        return Math.random() * (max - min) + min;
    }

    get_value(pos: number) {
        let amount: number = 0;
        for (var i = 0; i < 5; i++) {
            amount += (this.a_coefficents[i] * Math.sin(this.b_coefficents[i] * (pos + this.c_coefficents[i])))
        }

        return amount;
    }
}


