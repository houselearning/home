import * as THREE from 'three';
import { Game } from 'game';

// Get the render target
const renderDiv = document.getElementById('renderDiv');

// Initialize the game with the render target
const game = new Game(renderDiv);

// Start the game
game.start();
