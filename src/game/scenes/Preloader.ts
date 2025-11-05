import { Scene } from 'phaser';

export class Preloader extends Scene
{
    constructor ()
    {
        super('Preloader');
    }

    init ()
    {
        //  We loaded this image in our Boot Scene, so we can display it here
        const skySource = this.textures.get('sky').getSourceImage() as HTMLImageElement;
        const scaleFactor = Math.max(
            1,
            Math.ceil(
                Math.max(
                    this.scale.width / skySource.width,
                    this.scale.height / skySource.height
                )
            )
        );
        const displayWidth = skySource.width * scaleFactor;
        const displayHeight = skySource.height * scaleFactor;
        const offsetX = (this.scale.width - displayWidth) / 2;
        const offsetY = (this.scale.height - displayHeight) / 2;

        this.add.image(offsetX, offsetY, 'sky')
            .setOrigin(0, 0)
            .setScale(scaleFactor);

        
        this.add.text(300, 300, "Loading...")
        
        //  A simple progress bar. This is the outline of the bar.
        this.add.rectangle(512, 384, 468, 32).setStrokeStyle(1, 0xffffff);

        //  This is the progress bar itself. It will increase in size from the left based on the % of progress.
        const bar = this.add.rectangle(512-230, 384, 4, 28, 0xffffff);

        //  Use the 'progress' event emitted by the LoaderPlugin to update the loading bar
        this.load.on('progress', (progress: number) => {

            //  Update the progress bar (our bar is 464px wide, so 100% = 464px)
            bar.width = 4 + (460 * progress);

        });
    }

    preload ()
    {
        //  Load the assets for the game - Replace with your own assets
        this.load.setPath('assets');
    }

    create ()
    {
        //  When all the assets have loaded, it's often worth creating global objects here that the rest of the game can use.
        //  For example, you can define global animations here, so we can use them in other scenes.

        // reason: string, result: number, maxScore: number
        //  Move to the MainMenu. You could also swap this for a Scene Transition, such as a camera fade.
        this.scene.start("StartMenu");
    }
}
