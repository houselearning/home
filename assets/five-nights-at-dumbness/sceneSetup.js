import * as THREE from 'three';
import { COLORS, SIZES } from 'constants';

function createBuilding(scene) {
    const wallMaterial = new THREE.MeshStandardMaterial({ color: COLORS.WALL, side: THREE.DoubleSide });
    const floorMaterial = new THREE.MeshStandardMaterial({ color: COLORS.FLOOR });
    const ceilingMaterial = new THREE.MeshStandardMaterial({ color: COLORS.CEILING, side: THREE.DoubleSide });
    const furnitureMaterial = new THREE.MeshStandardMaterial({ color: COLORS.FURNITURE });
    // Floor
    const floorGeometry = new THREE.PlaneGeometry(SIZES.BUILDING_WIDTH, SIZES.BUILDING_DEPTH);
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // Ceiling
    const ceiling = new THREE.Mesh(floorGeometry, ceilingMaterial);
    ceiling.position.y = SIZES.BUILDING_HEIGHT;
    ceiling.rotation.x = Math.PI / 2;
    ceiling.receiveShadow = true; // Shadows can be cast onto the ceiling too
    scene.add(ceiling);

    // Walls
    const wallHeight = SIZES.BUILDING_HEIGHT;
    const wallThickness = 0.2;

    // --- Front Wall with Windows ---
    const windowWidth = 3;
    const windowHeight = 1.5;
    const windowYPos = wallHeight * 0.6; // Center the window vertically higher up
    const numWindows = 3;
    const wallSegmentWidth = (SIZES.BUILDING_WIDTH - numWindows * windowWidth) / (numWindows + 1);
    for (let i = 0; i <= numWindows; i++) {
        // Wall segment left/right of windows
        const segmentGeo = new THREE.BoxGeometry(wallSegmentWidth, wallHeight, wallThickness);
        const segment = new THREE.Mesh(segmentGeo, wallMaterial);
        const segmentX = -SIZES.BUILDING_WIDTH / 2 + wallSegmentWidth / 2 + i * (windowWidth + wallSegmentWidth);
        segment.position.set(segmentX, wallHeight / 2, SIZES.BUILDING_DEPTH / 2);
        segment.castShadow = true;
        segment.receiveShadow = true;
        scene.add(segment);
        if (i < numWindows) {
            // Wall segment above window
            const aboveGeo = new THREE.BoxGeometry(windowWidth, wallHeight - windowYPos - windowHeight / 2, wallThickness);
            const above = new THREE.Mesh(aboveGeo, wallMaterial);
            const windowCenterX = segmentX + wallSegmentWidth / 2 + windowWidth / 2;
            above.position.set(windowCenterX, windowYPos + windowHeight/2 + (wallHeight - windowYPos - windowHeight/2)/2 , SIZES.BUILDING_DEPTH / 2);
            above.castShadow = true;
            above.receiveShadow = true;
            scene.add(above);
             // Wall segment below window
            const belowGeo = new THREE.BoxGeometry(windowWidth, windowYPos - windowHeight / 2, wallThickness);
            const below = new THREE.Mesh(belowGeo, wallMaterial);
            below.position.set(windowCenterX, (windowYPos - windowHeight / 2) / 2, SIZES.BUILDING_DEPTH / 2);
            below.castShadow = true;
            below.receiveShadow = true;
            scene.add(below);
            // Optional: Add simple "broken glass" shards (very basic)
            // const shardMat = new THREE.MeshStandardMaterial({ color: 0xaaaaaa, transparent: true, opacity: 0.3, side: THREE.DoubleSide });
            // for(let j=0; j<3; j++) {
            //     const shardGeo = new THREE.TetrahedronGeometry(Math.random() * 0.3 + 0.1);
            //     const shard = new THREE.Mesh(shardGeo, shardMat);
            //     shard.position.set(
            //         windowCenterX + (Math.random() - 0.5) * windowWidth * 0.8,
            //         windowYPos + (Math.random() - 0.5) * windowHeight * 0.8,
            //         SIZES.BUILDING_DEPTH / 2 + (Math.random() - 0.5) * 0.2
            //     );
            //     shard.rotation.set(Math.random()*Math.PI, Math.random()*Math.PI, Math.random()*Math.PI);
            //     scene.add(shard);
            // }
        }
    }
    // --- End Front Wall ---
    // Back Wall
    const backWallGeometry = new THREE.BoxGeometry(SIZES.BUILDING_WIDTH, wallHeight, wallThickness);
    const backWall = new THREE.Mesh(backWallGeometry, wallMaterial);
    backWall.position.set(0, wallHeight / 2, -SIZES.BUILDING_DEPTH / 2);
    backWall.castShadow = true;
    backWall.receiveShadow = true;
    scene.add(backWall);
    // Left Wall
    const leftWallGeometry = new THREE.BoxGeometry(wallThickness, wallHeight, SIZES.BUILDING_DEPTH);
    const leftWall = new THREE.Mesh(leftWallGeometry, wallMaterial);
    leftWall.position.set(-SIZES.BUILDING_WIDTH / 2, wallHeight / 2, 0);
    leftWall.castShadow = true;
    leftWall.receiveShadow = true;
    scene.add(leftWall);
    // Right Wall
    const rightWallGeometry = new THREE.BoxGeometry(wallThickness, wallHeight, SIZES.BUILDING_DEPTH);
    const rightWall = new THREE.Mesh(rightWallGeometry, wallMaterial);
    rightWall.position.set(SIZES.BUILDING_WIDTH / 2, wallHeight / 2, 0);
    rightWall.castShadow = true;
    rightWall.receiveShadow = true;
    scene.add(rightWall);

    // --- Interior Walls ---
    const doorwayWidth = 1.2;
    const doorwayHeight = SIZES.BUILDING_HEIGHT * 0.8; // Most of the wall height
    // Function to create a wall segment (part of a larger wall with openings)
    function createWallSegment(width, height, depth, position, rotationY = 0) {
        const geo = new THREE.BoxGeometry(width, height, depth);
        const mesh = new THREE.Mesh(geo, wallMaterial);
        mesh.position.copy(position);
        mesh.rotation.y = rotationY;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        scene.add(mesh);
        return mesh; // Optional: return if needed later
    }
    // --- Main Divider (Z=0) with Doorway ---
    const mainDividerDoorwayX = -SIZES.BUILDING_WIDTH * 0.1; // Position the doorway off-center
    const mainDividerLeftWidth = mainDividerDoorwayX - (-SIZES.BUILDING_WIDTH / 2) - doorwayWidth / 2;
    const mainDividerRightWidth = (SIZES.BUILDING_WIDTH / 2) - (mainDividerDoorwayX + doorwayWidth / 2);
    const mainDividerAboveHeight = wallHeight - doorwayHeight;
    // Left segment
    createWallSegment(mainDividerLeftWidth, wallHeight, wallThickness,
        new THREE.Vector3(-SIZES.BUILDING_WIDTH / 2 + mainDividerLeftWidth / 2, wallHeight / 2, 0));
    // Right segment
    createWallSegment(mainDividerRightWidth, wallHeight, wallThickness,
        new THREE.Vector3(SIZES.BUILDING_WIDTH / 2 - mainDividerRightWidth / 2, wallHeight / 2, 0));
    // Above doorway segment
    createWallSegment(doorwayWidth, mainDividerAboveHeight, wallThickness,
        new THREE.Vector3(mainDividerDoorwayX, doorwayHeight + mainDividerAboveHeight / 2, 0));
    // --- Side Room Divider (X = SIZES.BUILDING_WIDTH * 0.2) with Doorway ---
    const sideDividerWallDepth = SIZES.BUILDING_DEPTH * 0.5; // Original intended depth
    const sideDividerDoorwayZ = -sideDividerWallDepth * 0.5; // Place doorway in the middle of this partial wall
    const sideDividerStartX = SIZES.BUILDING_WIDTH * 0.2;
    const sideDividerStartZ = 0; // Starts from the main divider Z=0
    const sideDividerEndZ = -sideDividerWallDepth;
    const sideDividerFrontDepth = sideDividerDoorwayZ - sideDividerEndZ - doorwayWidth / 2; // Depth from back end to doorway start
    const sideDividerBackDepth = sideDividerStartZ - (sideDividerDoorwayZ + doorwayWidth / 2); // Depth from front start to doorway end
    const sideDividerAboveHeight = wallHeight - doorwayHeight;
     // Back segment (closer to back wall)
    if (sideDividerFrontDepth > 0.01) {
        createWallSegment(wallThickness, wallHeight, sideDividerFrontDepth,
            new THREE.Vector3(sideDividerStartX, wallHeight / 2, sideDividerEndZ + sideDividerFrontDepth / 2));
    }
    // Front segment (closer to Z=0)
     if (sideDividerBackDepth > 0.01) {
        createWallSegment(wallThickness, wallHeight, sideDividerBackDepth,
            new THREE.Vector3(sideDividerStartX, wallHeight / 2, sideDividerStartZ - sideDividerBackDepth / 2));
    }
    // Above doorway segment
    createWallSegment(wallThickness, sideDividerAboveHeight, doorwayWidth, // Width is along Z here
        new THREE.Vector3(sideDividerStartX, doorwayHeight + sideDividerAboveHeight / 2, sideDividerDoorwayZ));
    // --- Simple Furniture ---
    // Table 1 (in main front area)
    const tableTopGeo = new THREE.BoxGeometry(2, 0.1, 1);
    const legGeo = new THREE.BoxGeometry(0.1, 0.7, 0.1);
    const table1 = new THREE.Group();
    const top1 = new THREE.Mesh(tableTopGeo, furnitureMaterial);
    top1.position.y = 0.7;
    top1.castShadow = true;
    table1.add(top1);
    const legPositions1 = [[0.9, 0.35, 0.4], [-0.9, 0.35, 0.4], [0.9, 0.35, -0.4], [-0.9, 0.35, -0.4]];
    legPositions1.forEach(pos => {
        const leg = new THREE.Mesh(legGeo, furnitureMaterial);
        leg.position.set(pos[0], pos[1], pos[2]);
        leg.castShadow = true;
        table1.add(leg);
    });
    table1.position.set(-SIZES.BUILDING_WIDTH * 0.3, 0, SIZES.BUILDING_DEPTH * 0.2);
    scene.add(table1);
    // "Chair" 1 near table 1
    const chairSeatGeo = new THREE.BoxGeometry(0.5, 0.1, 0.5);
    const chairBackGeo = new THREE.BoxGeometry(0.5, 0.6, 0.1);
    const chairLegGeo = new THREE.BoxGeometry(0.05, 0.4, 0.05);
    const chair1 = new THREE.Group();
    const seat1 = new THREE.Mesh(chairSeatGeo, furnitureMaterial);
    seat1.position.y = 0.4;
    chair1.add(seat1);
    const back1 = new THREE.Mesh(chairBackGeo, furnitureMaterial);
    back1.position.set(0, 0.4 + 0.3, -0.2); // Behind seat
    chair1.add(back1);
     const chairLegPos1 = [[0.2, 0.2, 0.2], [-0.2, 0.2, 0.2], [0.2, 0.2, -0.2], [-0.2, 0.2, -0.2]];
     chairLegPos1.forEach(pos => {
        const leg = new THREE.Mesh(chairLegGeo, furnitureMaterial);
        leg.position.set(pos[0], pos[1], pos[2]);
        chair1.add(leg);
    });
    chair1.position.set(-SIZES.BUILDING_WIDTH * 0.3 + 1.5, 0, SIZES.BUILDING_DEPTH * 0.2);
    chair1.rotation.y = -Math.PI / 8;
    chair1.castShadow = true; // Apply to group if children don't need individual shadow control
    scene.add(chair1);
    // Table 2 (in back right room)
    const table2 = table1.clone(); // Reuse geometry/structure
    table2.position.set(SIZES.BUILDING_WIDTH * 0.35, 0, -SIZES.BUILDING_DEPTH * 0.25);
    scene.add(table2);
}

function createExterior(scene) {
    // Ground outside
    const groundMaterial = new THREE.MeshStandardMaterial({ color: COLORS.GROUND });
    const groundGeometry = new THREE.PlaneGeometry(100, 100);
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.1; // Slightly below building floor
    ground.receiveShadow = true;
    scene.add(ground);

    // Fence
    const fenceMaterial = new THREE.MeshStandardMaterial({ color: COLORS.FENCE, side: THREE.DoubleSide });
    const fenceHeight = 2;
    const fenceDist = Math.max(SIZES.BUILDING_WIDTH, SIZES.BUILDING_DEPTH) / 2 + 2; // Distance from center

    const postGeo = new THREE.CylinderGeometry(0.1, 0.1, fenceHeight, 8);
    const railGeo = new THREE.BoxGeometry(fenceDist * 2, 0.1, 0.1);

    // Front/Back Fence Rails
    const frontRail = new THREE.Mesh(railGeo, fenceMaterial);
    frontRail.position.set(0, fenceHeight * 0.7, fenceDist);
    scene.add(frontRail);
    const backRail = new THREE.Mesh(railGeo, fenceMaterial);
    backRail.position.set(0, fenceHeight * 0.7, -fenceDist);
    scene.add(backRail);

    // Left/Right Fence Rails (rotated)
    const sideRailGeo = new THREE.BoxGeometry(fenceDist * 2, 0.1, 0.1);
    const leftRail = new THREE.Mesh(sideRailGeo, fenceMaterial);
    leftRail.position.set(-fenceDist, fenceHeight * 0.7, 0);
    leftRail.rotation.y = Math.PI / 2;
    scene.add(leftRail);
    const rightRail = new THREE.Mesh(sideRailGeo, fenceMaterial);
    rightRail.position.set(fenceDist, fenceHeight * 0.7, 0);
    rightRail.rotation.y = Math.PI / 2;
    scene.add(rightRail);

    // Corner Posts
    const positions = [[fenceDist, 0, fenceDist], [-fenceDist, 0, fenceDist], [fenceDist, 0, -fenceDist], [-fenceDist, 0, -fenceDist]];
    positions.forEach(pos => {
        const post = new THREE.Mesh(postGeo, fenceMaterial);
        post.position.set(pos[0], fenceHeight / 2, pos[2]);
        post.castShadow = true;
        scene.add(post);
    });


    // Simple Highway Representation
    const highwayMaterial = new THREE.MeshStandardMaterial({ color: COLORS.HIGHWAY });
    const highwayGeometry = new THREE.BoxGeometry(100, 0.1, 5); // Long strip
    const highway = new THREE.Mesh(highwayGeometry, highwayMaterial);
    highway.position.set(0, -0.05, fenceDist + 5); // Place it beyond the front fence
    highway.receiveShadow = true;
    scene.add(highway);

     // Add fake "headlights" on highway
    const lightGeo = new THREE.SphereGeometry(0.3, 8, 8);
    const lightMat = new THREE.MeshBasicMaterial({ color: 0xffffaa });
    for (let i = 0; i < 5; i++) {
        const light1 = new THREE.Mesh(lightGeo, lightMat);
        light1.position.set(-40 + i * 15 + Math.random() * 5, 0.2, fenceDist + 4 + Math.random());
        scene.add(light1);
        const light2 = new THREE.Mesh(lightGeo, lightMat);
        light2.position.set(-35 + i * 17 + Math.random() * 5, 0.2, fenceDist + 6 + Math.random());
        scene.add(light2);
    }

}

function setupLighting(scene) {
    // Ambient light for overall illumination
    const ambientLight = new THREE.AmbientLight(COLORS.AMBIENT_LIGHT, 0.2);
    scene.add(ambientLight);

    // Main spooky light source (e.g., flickering spotlight)
    const mainLight = new THREE.PointLight(COLORS.MAIN_LIGHT, 15, 25, 1.5); // color, intensity, distance, decay
    mainLight.position.set(0, SIZES.BUILDING_HEIGHT - 1, 0); // Near ceiling center
    mainLight.castShadow = true;
    // Configure shadow properties
    mainLight.shadow.mapSize.width = 1024;
    mainLight.shadow.mapSize.height = 1024;
    mainLight.shadow.camera.near = 0.5;
    mainLight.shadow.camera.far = 30;
    scene.add(mainLight);

    // Add helper to visualize light position (optional, for debugging)
    // const pointLightHelper = new THREE.PointLightHelper( mainLight, 1 );
    // scene.add( pointLightHelper );

     // Optional subtle fill light from outside?
     const windowLight = new THREE.DirectionalLight(0x222233, 0.3); // Cool, dim light
     windowLight.position.set(0, 5, 15); // Simulating light from highway direction
     scene.add(windowLight);
}


export function setupScene(scene) {
    createBuilding(scene);
    createExterior(scene);
    setupLighting(scene);
}
