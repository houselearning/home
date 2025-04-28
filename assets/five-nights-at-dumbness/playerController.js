import * as THREE from 'three';
import { SIZES } from 'constants';

export class PlayerController {
    constructor(controls, scene) {
        this.controls = controls;
        this.camera = controls.getObject(); // The camera is nested inside the controls object
        this.scene = scene; // Needed for potential collision checks later

        this.moveSpeed = 5.0;
        this.velocity = new THREE.Vector3();
        this.direction = new THREE.Vector3();

        this.moveForward = false;
        this.moveBackward = false;
        this.moveLeft = false;
        this.moveRight = false;

        this.raycaster = new THREE.Raycaster(new THREE.Vector3(), new THREE.Vector3(0, -1, 0), 0, SIZES.PLAYER_HEIGHT * 0.6); // Ray down
        this.collisionRaycaster = new THREE.Raycaster();
        this.collisionDistance = 0.5; // How close player can get to walls


        this.inputActive = false; // Track if any movement key is pressed


        // Listeners are bound here but added/removed by the Game class
        this.onKeyDown = this._handleKeyDown.bind(this);
        this.onKeyUp = this._handleKeyUp.bind(this);
         document.addEventListener('keydown', this.onKeyDown);
         document.addEventListener('keyup', this.onKeyUp);
    }
    // Renamed to avoid conflict if Game class also listens
    _handleKeyDown(event) {
         this.inputActive = true;
        switch (event.code) {
            case 'ArrowUp':
            case 'KeyW':
                this.moveForward = true;
                break;
            case 'ArrowLeft':
            case 'KeyA':
                this.moveLeft = true;
                break;
            case 'ArrowDown':
            case 'KeyS':
                this.moveBackward = true;
                break;
            case 'ArrowRight':
            case 'KeyD':
                this.moveRight = true;
                break;
        }
    }

    // Renamed to avoid conflict
    _handleKeyUp(event) {
        // No need to check this.inputActive here, calculation below is sufficient
        switch (event.code) {
            case 'ArrowUp':
            case 'KeyW':
                this.moveForward = false;
                break;
            case 'ArrowLeft':
            case 'KeyA':
                this.moveLeft = false;
                break;
            case 'ArrowDown':
            case 'KeyS':
                this.moveBackward = false;
                break;
            case 'ArrowRight':
            case 'KeyD':
                this.moveRight = false;
                break;
        }
         // Check again if any key is still pressed after this keyup
        this.inputActive = this.moveForward || this.moveBackward || this.moveLeft || this.moveRight;
    }

     _canMove(moveDirection) {
        if (!this.scene) return true; // Should not happen in normal flow

        this.collisionRaycaster.set(this.camera.position, moveDirection.normalize());
        this.collisionRaycaster.far = this.collisionDistance;

        const obstacles = this.scene.children.filter(child =>
            child.isMesh &&
            child.geometry && // Check if geometry exists
            !(child.material && child.material.transparent) && // Ignore transparent things if any
             child !== this.camera // Don't collide with self (camera is child of controls object)
        );


        const intersections = this.collisionRaycaster.intersectObjects(obstacles, false); // Non-recursive check needed for simple scene


        if (intersections.length > 0) {
            // Check distance if needed, otherwise any intersection blocks
            // console.log("Collision detected!", intersections[0].object.name || intersections[0].object);
            return false; // Cannot move in this direction
        }

        return true; // Can move
    }


    update(delta) {
        if (!this.controls.isLocked) {
             // Dampen velocity quickly when controls are unlocked or no input
            this.velocity.x -= this.velocity.x * 10.0 * delta;
            this.velocity.z -= this.velocity.z * 10.0 * delta;
            return;
        }

        // Use exponential decay for smoother stopping when input stops
        const damping = this.inputActive ? 1.0 : 10.0; // Less damping when moving, more when stopped
        this.velocity.x -= this.velocity.x * damping * delta;
        this.velocity.z -= this.velocity.z * damping * delta;

        this.direction.z = Number(this.moveForward) - Number(this.moveBackward);
        this.direction.x = Number(this.moveRight) - Number(this.moveLeft);
        this.direction.normalize(); // Ensures consistent speed in all directions

        const currentMoveSpeed = this.moveSpeed * delta;

        // Calculate potential movement vectors based on camera direction
        const moveDelta = new THREE.Vector3();
        const forwardVector = new THREE.Vector3();
        const rightVector = new THREE.Vector3();

        this.camera.getWorldDirection(forwardVector); // Get camera's forward direction
        rightVector.crossVectors(this.camera.up, forwardVector).normalize(); // Get camera's right direction

        // Scale movement by direction input
        forwardVector.multiplyScalar(this.direction.z * currentMoveSpeed);
        rightVector.multiplyScalar(this.direction.x * currentMoveSpeed);

        moveDelta.add(forwardVector).add(rightVector);


        // --- Simple Collision Detection ---
        const worldMoveDir = moveDelta.clone().normalize();
        if (this._canMove(worldMoveDir)) {
             this.controls.moveForward(-this.direction.z * currentMoveSpeed); // Negative Z is forward in controls
             this.controls.moveRight(this.direction.x * currentMoveSpeed);
        } else {
            // Try moving only along axes if direct path blocked
             const forwardOnly = new THREE.Vector3();
             this.camera.getWorldDirection(forwardOnly);
             forwardOnly.multiplyScalar(this.direction.z);

             const rightOnly = new THREE.Vector3();
             rightOnly.crossVectors(this.camera.up, forwardVector).normalize();
             rightOnly.multiplyScalar(this.direction.x);


             if (this.direction.z !== 0 && this._canMove(forwardOnly.normalize())) {
                 this.controls.moveForward(-this.direction.z * currentMoveSpeed);
             }
             if (this.direction.x !== 0 && this._canMove(rightOnly.normalize())) {
                  this.controls.moveRight(this.direction.x * currentMoveSpeed);
             }
        }


        // Keep player roughly on the ground (simple version)
         const currentY = this.camera.position.y;
        if (currentY < SIZES.PLAYER_HEIGHT * 0.9) {
            this.camera.position.y = SIZES.PLAYER_HEIGHT;
            this.velocity.y = 0; // Stop falling if we force position
        } else if (currentY > SIZES.PLAYER_HEIGHT * 1.1) {
             this.camera.position.y = SIZES.PLAYER_HEIGHT;
             this.velocity.y = 0;
        } else {
            // Allow slight adjustment if needed, or keep fixed
             this.camera.position.y = SIZES.PLAYER_HEIGHT;
        }


         // Boundary checks (prevent escaping the building easily)
        const halfWidth = SIZES.BUILDING_WIDTH / 2 - this.collisionDistance;
        const halfDepth = SIZES.BUILDING_DEPTH / 2 - this.collisionDistance;
        this.camera.position.x = Math.max(-halfWidth, Math.min(halfWidth, this.camera.position.x));
        this.camera.position.z = Math.max(-halfDepth, Math.min(halfDepth, this.camera.position.z));

    }

     dispose() {
        // Remove listeners using the bound methods
        document.removeEventListener('keydown', this.onKeyDown);
        document.removeEventListener('keyup', this.onKeyUp);
        console.log("PlayerController listeners removed.");
    }
}
