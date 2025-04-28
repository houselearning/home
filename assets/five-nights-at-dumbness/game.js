import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { setupScene } from 'sceneSetup';
import { PlayerController } from 'playerController';
import { CharacterManager } from 'characterManager';
import { TrafficManager } from 'trafficManager'; // Import TrafficManager
import { COLORS, SIZES } from 'constants';

const INSTRUCTIONS_TEXT = `Welcome to the Dumbness Institution!
Look around with the mouse.
Move with Arrow Keys or WASD.
Click to lock controls. Press ESC to unlock.
Try not to get too spooked...`;

export class Game {
    constructor(renderDiv) {
        this.renderDiv = renderDiv;
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.clock = new THREE.Clock();
        this.controls = null;
        this.playerController = null;
        this.characterManager = null;
        this.requestId = null;
        this.trafficManager = null; // Add traffic manager property
        this.jumpscareOverlay = null;
        this.jumpscareTriggered = false; // Prevent multiple triggers
        this.jumpscareDistance = 1.5; // How close the player needs to be
        this.flashlight = null; // Add flashlight property
        this._setupRenderer();
        this._setupCamera();
        this._setupScene();
        this._setupControls();
        this._setupPlayer();
        this._setupCharacters();
        this._setupTraffic(); // Add call to setup traffic
        this._setupFlashlight(); // Add flashlight setup call
        this._setupUI();
        this._setupInputListeners(); // Centralize input listeners
        window.addEventListener('resize', this._onWindowResize.bind(this));
    }
    _setupRenderer() {
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderDiv.appendChild(this.renderer.domElement);
    }

     _setupCamera() {
        this.camera.position.set(0, SIZES.PLAYER_HEIGHT, 5); // Start inside, facing towards -Z
        this.scene.add(this.camera); // Add camera to scene so player controller can move it
    }

    _setupScene() {
        this.scene.background = new THREE.Color(COLORS.SKY_DARK);
        this.scene.fog = new THREE.Fog(COLORS.SKY_DARK, 10, 50);
        setupScene(this.scene);
    }

    _setupControls() {
        this.controls = new PointerLockControls(this.camera, this.renderDiv);
        this.scene.add(this.controls.getObject()); // Add the controls' object (which contains the camera)

        this.renderDiv.addEventListener('click', () => {
            this.controls.lock();
        });

        this.controls.addEventListener('lock', () => {
            console.log('PointerLockControls locked');
             this.hideInstructions();
        });

        this.controls.addEventListener('unlock', () => {
            console.log('PointerLockControls unlocked');
             this.showInstructions();
        });
    }

     _setupPlayer() {
        if (!this.controls) {
            console.error("Controls must be initialized before PlayerController.");
            return;
        }
        // Pass the controls object, not just the camera
        this.playerController = new PlayerController(this.controls, this.scene);
    }


    _setupCharacters() {
        this.characterManager = new CharacterManager(this.scene);
        this.characterManager.addCharacters();
    }
     _setupTraffic() {
        this.trafficManager = new TrafficManager(this.scene);
    }
    _setupFlashlight() {
        this.flashlight = new THREE.SpotLight(0xffffff, 2, 15, Math.PI / 6, 0.3, 1.5); // color, intensity, distance, angle, penumbra, decay
        this.flashlight.castShadow = true;
        this.flashlight.shadow.mapSize.width = 512;
        this.flashlight.shadow.mapSize.height = 512;
        this.flashlight.shadow.camera.near = 0.5;
        this.flashlight.shadow.camera.far = 15;
        this.flashlight.visible = false; // Start with flashlight off
        // Position flashlight relative to camera
        this.camera.add(this.flashlight);
        this.camera.add(this.flashlight.target); // Target needs to be child of camera too
        this.flashlight.position.set(0, 0.1, 0.2); // Slightly above and in front of camera origin
        this.flashlight.target.position.set(0, 0, -1); // Point forward relative to camera
    }
     _setupUI() {
        this.instructionsElement = document.createElement('div');
        this.instructionsElement.id = 'instructions';
        this.instructionsElement.style.position = 'absolute';
        this.instructionsElement.style.top = '50%';
        this.instructionsElement.style.left = '50%';
        this.instructionsElement.style.transform = 'translate(-50%, -50%)';
        this.instructionsElement.style.color = 'white';
        this.instructionsElement.style.fontSize = '20px';
        this.instructionsElement.style.fontFamily = 'Arial, sans-serif';
        this.instructionsElement.style.textAlign = 'center';
        this.instructionsElement.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        this.instructionsElement.style.padding = '20px';
        this.instructionsElement.style.borderRadius = '10px';
        this.instructionsElement.style.whiteSpace = 'pre-wrap'; // Preserve line breaks
        this.instructionsElement.textContent = INSTRUCTIONS_TEXT;
        this.renderDiv.appendChild(this.instructionsElement);

        const crosshair = document.createElement('div');
        crosshair.style.position = 'absolute';
        crosshair.style.top = '50%';
        crosshair.style.left = '50%';
        crosshair.style.width = '4px';
        crosshair.style.height = '4px';
        crosshair.style.backgroundColor = 'rgba(255, 255, 255, 0.5)';
        crosshair.style.borderRadius = '50%';
        crosshair.style.transform = 'translate(-50%, -50%)';
        this.renderDiv.appendChild(crosshair);
        // Jumpscare Overlay Div
        this.jumpscareOverlay = document.createElement('div');
        this.jumpscareOverlay.id = 'jumpscare';
        this.jumpscareOverlay.style.position = 'absolute';
        this.jumpscareOverlay.style.top = '0';
        this.jumpscareOverlay.style.left = '0';
        this.jumpscareOverlay.style.width = '100%';
        this.jumpscareOverlay.style.height = '100%';
        this.jumpscareOverlay.style.backgroundColor = 'rgba(200, 0, 0, 0.9)'; // Red flash
        this.jumpscareOverlay.style.display = 'none'; // Hidden initially
        this.jumpscareOverlay.style.zIndex = '100'; // Ensure it's on top
        this.jumpscareOverlay.style.color = 'white';
        this.jumpscareOverlay.style.fontSize = '48px';
        this.jumpscareOverlay.style.fontFamily = 'Impact, sans-serif';
        this.jumpscareOverlay.style.textAlign = 'center';
        this.jumpscareOverlay.style.paddingTop = '40vh'; // Center text vertically-ish
        this.jumpscareOverlay.textContent = 'D U M B N E S S !';
        this.renderDiv.appendChild(this.jumpscareOverlay);
    }
     hideInstructions() {
        if (this.instructionsElement) {
            this.instructionsElement.style.display = 'none';
        }
    }
    // Centralized input handling
    _setupInputListeners() {
        this.onKeyDown = this._onKeyDown.bind(this);
        document.addEventListener('keydown', this.onKeyDown);
    }
    _onKeyDown(event) {
        switch (event.code) {
            case 'KeyF':
                this._toggleFlashlight();
                break;
            // Add other global key handlers here if needed
        }
        // Pass event to player controller if it exists and needs it
        if (this.playerController && this.playerController.onKeyDown) {
             // playerController handles WASD/Arrows itself now
             // this.playerController.onKeyDown(event);
        }
    }
     _toggleFlashlight() {
        if (this.flashlight) {
            this.flashlight.visible = !this.flashlight.visible;
            console.log("Flashlight toggled:", this.flashlight.visible);
        }
    }
    showInstructions() {
         if (this.instructionsElement) {
            this.instructionsElement.style.display = 'block';
        }
    }

    _onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    start() {
        this._animate();
    }

    stop() {
        if (this.requestId) {
            cancelAnimationFrame(this.requestId);
            this.requestId = null;
        }
        if (this.controls) {
             this.controls.unlock(); // Ensure controls are unlocked when stopping
        }
        this.playerController.dispose(); // Clean up event listeners
        if (this.jumpscareOverlay) {
             this.jumpscareOverlay.style.display = 'none'; // Hide overlay if stopping manually
        }
        this.jumpscareTriggered = false; // Reset trigger on stop
        // Remove general input listener
        document.removeEventListener('keydown', this.onKeyDown);
        console.log('Game stopped');
    }
    _triggerJumpscare() {
        if (!this.jumpscareTriggered) {
            console.log("Jumpscare triggered!");
            this.jumpscareTriggered = true;
            if (this.jumpscareOverlay) {
                this.jumpscareOverlay.style.display = 'flex'; // Show the overlay
                 // Optional: Add a slight delay before stopping everything?
                setTimeout(() => {
                    this.stop(); // Stop updates and unlock controls
                    if (this.controls) this.controls.unlock();
                     // Keep overlay visible after stop
                     this.jumpscareOverlay.style.display = 'flex';
                     this.showInstructions(true); // Show instructions again, maybe modified for game over
                }, 100); // 100ms delay
            } else {
                 this.stop(); // Stop immediately if overlay fails
                 if (this.controls) this.controls.unlock();
            }
        }
    }
    _checkJumpscareCondition() {
        if (this.jumpscareTriggered || !this.playerController || !this.characterManager || !this.controls.isLocked) {
            return; // Don't check if already triggered, components missing, or controls unlocked
        }
        const playerPosition = this.camera.position;
        const woody = this.characterManager.characters.find(c => c.name === "WoodyLike");
        if (woody) {
            const distance = playerPosition.distanceTo(woody.position);
             // console.log("Distance to Woody:", distance); // For debugging
            if (distance < this.jumpscareDistance) {
                this._triggerJumpscare();
            }
        }
    }
    _animate() {
        this.requestId = requestAnimationFrame(this._animate.bind(this));
        // If jumpscare triggered, requestId will be cancelled by stop(), ending the loop
        if (this.jumpscareTriggered) {
            return;
        }
        const delta = this.clock.getDelta();
        if (this.playerController && this.controls.isLocked) {
            this.playerController.update(delta);
        }
        // Update character animations/movement
        if (this.characterManager) {
            this.characterManager.update(delta);
        }
        // Update traffic
        if (this.trafficManager) {
             this.trafficManager.update(delta);
        }
        // Check for jumpscare *after* updates
        this._checkJumpscareCondition();
        // Update flashlight target direction every frame
        if (this.flashlight && this.flashlight.visible) {
            // The target is already a child of the camera, so its position is relative.
            // Setting it to (0, 0, -1) keeps it pointing directly forward from the camera.
            // No complex world position calculation needed here.
            // We might need this later if we want it to point at something specific.
        }
        // Render only if not jumpscared (or just before the overlay appears)
        if (!this.jumpscareTriggered) {
            this.renderer.render(this.scene, this.camera);
        }
    }
     // Modify showInstructions to handle game over state
     showInstructions(gameOver = false) {
         if (this.instructionsElement) {
            this.instructionsElement.style.display = 'block';
            if (gameOver) {
                this.instructionsElement.textContent = "You got caught by the Dumbness!\nPress ESCAPE.\nRefresh the page to try again.";
            } else {
                 this.instructionsElement.textContent = INSTRUCTIONS_TEXT;
            }
        }
    }
}
