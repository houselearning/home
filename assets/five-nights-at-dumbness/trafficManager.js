import * as THREE from 'three';
import { COLORS, SIZES } from 'constants';

const CAR_COLORS = [COLORS.CAR_RED, COLORS.CAR_BLUE, COLORS.CAR_YELLOW, COLORS.CAR_GREEN];
const CAR_SPEED_MIN = 15;
const CAR_SPEED_MAX = 25;
const CAR_SPAWN_Z = SIZES.BUILDING_DEPTH / 2 + 7; // Just beyond the fence
const HIGHWAY_LENGTH = 100;
const HIGHWAY_START_X = -HIGHWAY_LENGTH / 2;
const HIGHWAY_END_X = HIGHWAY_LENGTH / 2;
const NUM_CARS = 10;

export class TrafficManager {
    constructor(scene) {
        this.scene = scene;
        this.cars = [];
        this._createCars();
    }

    _createCars() {
        const carGeo = new THREE.BoxGeometry(1.5, 0.5, 0.8); // width, height, depth

        for (let i = 0; i < NUM_CARS; i++) {
            const color = CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)];
            const carMat = new THREE.MeshStandardMaterial({ color: color });
            const car = new THREE.Mesh(carGeo, carMat);
            car.castShadow = true; // Simple shadows

            // Assign initial random position and speed
            this._resetCar(car);

            this.scene.add(car);
            this.cars.push(car);
        }
    }

    _resetCar(car) {
         // Alternate starting side and direction
         const startLeft = Math.random() > 0.5;
         car.userData.speed = THREE.MathUtils.randFloat(CAR_SPEED_MIN, CAR_SPEED_MAX);

         if (startLeft) {
             car.position.set(HIGHWAY_START_X - Math.random() * 10, 0.25, CAR_SPAWN_Z + Math.random() * 2 - 1); // Stagger Z slightly
             car.userData.direction = 1; // Moving right
             car.rotation.y = 0;
         } else {
             car.position.set(HIGHWAY_END_X + Math.random() * 10, 0.25, CAR_SPAWN_Z + Math.random() * 2 - 1); // Stagger Z slightly
             car.userData.speed *= 1.1; // Slightly faster maybe?
             car.userData.direction = -1; // Moving left
             car.rotation.y = Math.PI; // Face left
         }
    }

    update(delta) {
        this.cars.forEach(car => {
            car.position.x += car.userData.speed * car.userData.direction * delta;

            // Check if car is off-screen and reset
            const carGoneLeft = car.userData.direction === -1 && car.position.x < HIGHWAY_START_X - 15;
             const carGoneRight = car.userData.direction === 1 && car.position.x > HIGHWAY_END_X + 15;

            if (carGoneLeft || carGoneRight) {
                this._resetCar(car);
            }
        });
    }
}
