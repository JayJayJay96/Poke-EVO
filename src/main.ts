import Phaser from 'phaser';
import { RunScene } from './scenes/RunScene';
import { SelectScene } from './scenes/SelectScene';

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'app',
  backgroundColor: '#1b2418',
  scale: {
    mode: Phaser.Scale.RESIZE,
    width: '100%',
    height: '100%',
  },
  // The first scene starts automatically: pick a Pokémon, then run.
  scene: [SelectScene, RunScene],
});
