import * as THREE from 'three';
import { COLORS, SIZES } from 'constants';

export class CharacterManager {
    constructor(scene) {
        this.scene = scene;
        this.characters = []; // Stores the character groups
        this.characterData = new Map(); // Stores additional data like patrol info
    }
    _createWoodyLike() {
        const group = new THREE.Group();

        // Body (cylinder)
        const bodyGeo = new THREE.CylinderGeometry(0.3, 0.3, 1.0, 16);
        const bodyMat = new THREE.MeshStandardMaterial({ color: COLORS.WOODY_BODY });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.castShadow = true;
        body.position.y = 0.5; // Sit on ground
        group.add(body);

        // Head (sphere)
        const headGeo = new THREE.SphereGeometry(0.3, 16, 16);
        const headMat = new THREE.MeshStandardMaterial({ color: COLORS.WOODY_HEAD });
        const head = new THREE.Mesh(headGeo, headMat);
        head.position.y = 1.0 + 0.3; // Body height + head radius
        head.castShadow = true;
        group.add(head);

        // Hat (cone)
        const hatGeo = new THREE.ConeGeometry(0.4, 0.3, 16); // radius, height
        const hatMat = new THREE.MeshStandardMaterial({ color: COLORS.WOODY_HAT });
        const hat = new THREE.Mesh(hatGeo, hatMat);
        hat.position.y = 1.0 + 0.6 + 0.15; // Above head
        hat.castShadow = true;
        group.add(hat);

        group.name = "WoodyLike";
        return group;
    }

    _createBuzzLike() {
        const group = new THREE.Group();

        // Torso (box)
        const torsoGeo = new THREE.BoxGeometry(0.7, 0.8, 0.4);
        const torsoMat = new THREE.MeshStandardMaterial({ color: COLORS.BUZZ_TORSO });
        const torso = new THREE.Mesh(torsoGeo, torsoMat);
        torso.position.y = 0.6; // Slightly higher base
        torso.castShadow = true;
        group.add(torso);

         // Helmet (sphere)
        const helmetGeo = new THREE.SphereGeometry(0.4, 16, 16);
        // Make helmet slightly transparent purple
        const helmetMat = new THREE.MeshStandardMaterial({
            color: COLORS.BUZZ_HELMET,
            transparent: true,
            opacity: 0.6,
            side: THREE.FrontSide // Render front face only for transparency
         });
        const helmet = new THREE.Mesh(helmetGeo, helmetMat);
        helmet.position.y = 0.6 + 0.4 + 0.1; // Above torso center
        helmet.castShadow = true; // Transparent objects usually don't cast great shadows
        group.add(helmet);

         // Simple green accents (cubes)
        const accentGeo = new THREE.BoxGeometry(0.2, 0.2, 0.2);
        const accentMat = new THREE.MeshStandardMaterial({ color: COLORS.BUZZ_ACCENT });

        const accent1 = new THREE.Mesh(accentGeo, accentMat);
        accent1.position.set(0.3, 0.6, 0.25);
        accent1.castShadow = true;
        group.add(accent1);

        const accent2 = new THREE.Mesh(accentGeo, accentMat);
        accent2.position.set(-0.3, 0.6, 0.25);
        accent2.castShadow = true;
        group.add(accent2);


        group.name = "BuzzLike";
        return group;
    }


    addCharacters() {
        const woody = this._createWoodyLike();
        const woodyStartPos = new THREE.Vector3(-SIZES.BUILDING_WIDTH * 0.3, 0, -SIZES.BUILDING_DEPTH * 0.3);
        woody.position.copy(woodyStartPos);
        woody.rotation.y = Math.PI / 4;
        this.scene.add(woody);
        this.characters.push(woody);
        // --- Woody Patrol Setup ---
        const woodyPatrolTarget = new THREE.Vector3(SIZES.BUILDING_WIDTH * 0.3, 0, -SIZES.BUILDING_DEPTH * 0.3); // Move along X-axis
        this.characterData.set(woody, {
            isPatrolling: true,
            patrolSpeed: 0.8, // Units per second
            patrolPoints: [woodyStartPos.clone(), woodyPatrolTarget.clone()],
            currentPatrolIndex: 1, // Start moving towards the second point
            waitTime: 0, // Time spent waiting at a point
            maxWaitTime: 2.0 // Seconds to wait at each end
        });
        // --- End Woody Patrol Setup ---
        const buzz = this._createBuzzLike();
        // Move Buzz to the new back-right room
        buzz.position.set(SIZES.BUILDING_WIDTH * 0.35, 0, -SIZES.BUILDING_DEPTH * 0.3);
        buzz.rotation.y = Math.PI; // Face towards the center maybe
        this.scene.add(buzz);
        this.characters.push(buzz);
        // Buzz is static for now
        this.characterData.set(buzz, { isPatrolling: false });
        // Add more character placements as needed
    }
    update(delta) {
        this.characters.forEach(character => {
            const data = this.characterData.get(character);
            if (data && data.isPatrolling) {
                this._updatePatrol(character, data, delta);
            }
        });
    }
     _updatePatrol(character, data, delta) {
        if (data.waitTime > 0) {
            data.waitTime -= delta;
            if (data.waitTime <= 0) {
                 // Finished waiting, choose next target
                 data.currentPatrolIndex = (data.currentPatrolIndex + 1) % data.patrolPoints.length;
                 // Optional: Make character look towards next point
                 const nextTarget = data.patrolPoints[data.currentPatrolIndex];
                 character.lookAt(nextTarget.x, character.position.y, nextTarget.z); // Keep Y level
            }
            return; // Don't move while waiting
        }
        const targetPosition = data.patrolPoints[data.currentPatrolIndex];
        const direction = targetPosition.clone().sub(character.position);
        const distanceToTarget = direction.length();
        if (distanceToTarget < 0.1) {
            // Reached target, start waiting
            character.position.copy(targetPosition); // Snap to target
            data.waitTime = data.maxWaitTime;
            // No need to change index here, waitTime check handles it
        } else {
            // Move towards target
            const moveDistance = data.patrolSpeed * delta;
            direction.normalize().multiplyScalar(moveDistance);
            character.position.add(direction);
             // Ensure character is roughly looking in the direction of movement
             // Only rotate if moving significantly to avoid jitter
            if (direction.lengthSq() > 0.001) {
                 // Calculate target look position slightly ahead
                 const lookTargetPos = character.position.clone().add(direction.normalize().multiplyScalar(1.0));
                 character.lookAt(lookTargetPos.x, character.position.y, lookTargetPos.z);
            }
        }
    }
}
