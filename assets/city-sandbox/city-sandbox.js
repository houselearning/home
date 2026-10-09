    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x9ed0fb);
    scene.fog = new THREE.Fog(0x9ed0fb, 120, 420);

    const camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.1, 2200);
    camera.position.set(0, 7, 28);

    const gameSettings = {
      resolution: 1,
      maxFps: 60,
      unlimitedFps: false,
      textures: true,
      planeDespawn: true,
      destruction: true,
      npcs: true,
      cornerMap: true,
      trafficLights: true,
      medicalRescue: true,
      characterDetail: true
    };
    let lastRenderedFrameTime = 0;
    let lastSimulationTime = performance.now();

    const webOptimizer = {
      lowLag: true,
      pixelRatio: 0.85,
      apply() {
        const lowLag = this.lowLag;
        const adaptiveScale = lowLag ? Math.min(this.pixelRatio, gameSettings.resolution) : gameSettings.resolution;
        renderer.setPixelRatio(Math.min((window.devicePixelRatio || 1) * adaptiveScale, 2));
        const shadowsEnabled = !lowLag;
        renderer.shadowMap.enabled = shadowsEnabled;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.shadowMap.needsUpdate = true;
        scene.traverse((object) => {
          if (!object.isMesh) return;
          object.castShadow = shadowsEnabled;
          object.receiveShadow = shadowsEnabled;
        });
        renderer.toneMappingExposure = lowLag ? 0.9 : 1.18;
        scene.fog.near = lowLag ? 70 : 120;
        scene.fog.far = lowLag ? 220 : 420;
      },
      adjustFrameRate(fps) {
        if (!this.lowLag || (!gameSettings.unlimitedFps && gameSettings.maxFps < 40)) return;
        if (fps < 40 && this.pixelRatio > 0.55) {
          this.pixelRatio = Math.max(0.55, this.pixelRatio - 0.1);
        } else if (fps > 50 && this.pixelRatio < gameSettings.resolution) {
          this.pixelRatio = Math.min(gameSettings.resolution, this.pixelRatio + 0.05);
        } else {
          return;
        }
        this.apply();
      }
    };

    const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'low-power' });
    renderer.shadowMap.enabled = false;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.toneMappingExposure = 0.9;
    document.getElementById('game-root').appendChild(renderer.domElement);

    function applyTextureMode() {
      scene.traverse((object) => {
        if (!object.isMesh || !object.material) return;
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => {
          if (!(material instanceof THREE.MeshStandardMaterial)) return;
          if (material.map && material.map !== material.userData.originalMap) {
            material.userData.originalMap = material.map;
            material.userData.originalColor = material.color.clone();
          }
          const originalMap = material.userData.originalMap || null;
          material.map = gameSettings.textures ? originalMap : null;
          if (gameSettings.textures) {
            if (material.userData.originalColor) material.color.copy(material.userData.originalColor);
          } else if (originalMap && originalMap.userData.solidColor !== undefined) {
            material.color.setHex(originalMap.userData.solidColor);
          }
          material.needsUpdate = true;
        });
      });
    }

    function applyGameSettings() {
      webOptimizer.pixelRatio = Math.min(gameSettings.resolution, webOptimizer.lowLag ? 0.85 : gameSettings.resolution);
      webOptimizer.apply();
      applyTextureMode();
      minimap.style.display = gameSettings.cornerMap ? '' : 'none';
      if (!gameSettings.destruction) {
        while (debrisPieces.length) {
          const piece = debrisPieces.pop();
          world.removeBody(piece.body);
          scene.remove(piece.mesh);
        }
        while (vehicleDebris.length) scene.remove(vehicleDebris.pop().mesh);
      }
      npcCars.forEach((car) => {
        const visible = gameSettings.npcs && car.active;
        car.mesh.visible = visible;
        if (gameSettings.npcs && visible) car.body.wakeUp();
        else car.body.sleep();
      });
      people.forEach((person) => {
        person.mesh.visible = gameSettings.npcs && person.active;
        if (person.deviceGroup) person.deviceGroup.visible = gameSettings.npcs && person.active && person.useDevice;
        if (person.hair) person.hair.visible = !!gameSettings.characterDetail;
      });
      const playerHairVisible = !!gameSettings.characterDetail;
      if (playerHair && playerHair.group) playerHair.group.visible = playerHairVisible;
      unlimitedFpsToggle.checked = gameSettings.unlimitedFps;
      maxFpsSelect.disabled = gameSettings.unlimitedFps;
    }

    function updateSettingsFromControls() {
      gameSettings.resolution = Number(resolutionSelect.value);
      gameSettings.maxFps = Number(maxFpsSelect.value);
      gameSettings.unlimitedFps = unlimitedFpsToggle.checked;
      gameSettings.textures = texturesToggle.checked;
      gameSettings.planeDespawn = planeDespawnToggle.checked;
      gameSettings.destruction = destructionToggle.checked;
      gameSettings.npcs = npcsToggle.checked;
      gameSettings.cornerMap = cornerMapToggle.checked;
      gameSettings.trafficLights = trafficLightsToggle.checked;
      gameSettings.medicalRescue = medicalRescueToggle.checked;
      gameSettings.characterDetail = characterDetailToggle.checked;
      lastRenderedFrameTime = 0;
      applyGameSettings();
      if (gameStarted) saveGameState();
    }

    function showSettingsView(show) {
      menuHome.classList.toggle('hidden', show);
      settingsPanel.classList.toggle('hidden', !show);
      if (show) syncSettingsControls();
    }

    function syncSettingsControls() {
      resolutionSelect.value = String(gameSettings.resolution);
      maxFpsSelect.value = String(gameSettings.maxFps);
      unlimitedFpsToggle.checked = gameSettings.unlimitedFps;
      texturesToggle.checked = gameSettings.textures;
      planeDespawnToggle.checked = gameSettings.planeDespawn;
      destructionToggle.checked = gameSettings.destruction;
      npcsToggle.checked = gameSettings.npcs;
      cornerMapToggle.checked = gameSettings.cornerMap;
      trafficLightsToggle.checked = gameSettings.trafficLights;
      medicalRescueToggle.checked = gameSettings.medicalRescue;
      characterDetailToggle.checked = gameSettings.characterDetail;
      maxFpsSelect.disabled = gameSettings.unlimitedFps;
    }

    const lowLagToggle = document.getElementById('low-lag-toggle');
    if (lowLagToggle) {
      lowLagToggle.checked = webOptimizer.lowLag;
      lowLagToggle.addEventListener('change', () => {
        webOptimizer.lowLag = !!lowLagToggle.checked;
        webOptimizer.apply();
      });
      webOptimizer.apply();
    }

    const world = new CANNON.World();
    world.gravity.set(0, -18, 0);
    world.broadphase = new CANNON.SAPBroadphase(world);
    world.solver.iterations = 6;
    world.defaultContactMaterial.friction = 0.45;
    world.defaultContactMaterial.restitution = 0.08;

    const textureLoader = new THREE.TextureLoader();
    const textureMap = {
      asphalt: 'textures/asphalt.png',
      asphaltDark: 'textures/asphalt_dark.png',
      sidewalk: 'textures/sidewalk.png',
      stoneLight: 'textures/stone_light.png',
      plaza: 'textures/plaza.png',
      fountainMarble: 'textures/fountain_marble.png',
      grass: 'textures/grass.png',
      parkGrass: 'textures/park_grass.png',
      windowGrid: 'textures/window_grid.png',
      glassWindowBlue: 'textures/glass_window_blue.png',
      brick: 'textures/brick_red.png',
      brickRed: 'textures/brick_red.png',
      roofTiles: 'textures/roof_tiles.png',
      border: 'textures/border.jpeg',
      metalSilverBright: 'textures/metal_silver_bright.png',
      water: 'textures/water.png',
      waterPool: 'textures/water_pool.png',
      woodFloor: 'textures/wood_floor.png',
      woodDoor: 'textures/wood_door.png',
      metalDoor: 'textures/metal_door.png',
      metalSilver: 'textures/metal_silver.png',
      darkMetal: 'textures/dark_metal.png',
      concreteGrey: 'textures/concrete_grey.png',
      plasterGrey: 'textures/plaster_grey.png',
      stuccoWhite: 'textures/stucco_white.png',
      crosswalkWhite: 'textures/crosswalk_white.png',
      phoneScreenGif: 'gifs/phone_screen.gif',
      laptopScreenGif: 'gifs/laptop_interaction.gif'
    };
    const textures = {};
    const textureClones = new Map();
    const textureKeys = Object.keys(textureMap);
    let texturesReady = false;
    let gameInitialized = false;

    function withTexture(texture, options = {}) {
      if (!texture) return options;
      return { ...options, map: texture };
    }

    function cloneTexture(sourceTexture, key) {
      const texture = sourceTexture.clone();
      texture.userData = { ...sourceTexture.userData };
      texture.image = sourceTexture.image;
      if (!textureClones.has(key)) textureClones.set(key, []);
      textureClones.get(key).push(texture);
      return texture;
    }

    function createSurfaceTexture(key, width, depth, tileSize) {
      const sourceTexture = textures[key];
      if (!sourceTexture) return null;
      const texture = cloneTexture(sourceTexture, key);
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(width / tileSize, depth / tileSize);
      texture.needsUpdate = true;
      return texture;
    }

    function syncTextureClones(key, sourceTexture) {
      (textureClones.get(key) || []).forEach((texture) => {
        texture.image = sourceTexture.image;
        texture.needsUpdate = true;
      });
    }

    function loadTextures() {
      const solidColors = {
        asphalt: 0x4b5563, asphaltDark: 0x555c60, sidewalk: 0xd9dde2,
        grass: 0x7fa95c, parkGrass: 0x4f8a3c, water: 0x187d91,
        waterPool: 0x6abad6, plaza: 0xd6d0c5, stoneLight: 0xb4b7b4,
        roofTiles: 0xb7b3a6, windowGrid: 0xa9d8ef, crosswalkWhite: 0xe9eceb
      };
      const configureTexture = (tex, key) => {
          tex.userData = tex.userData || {};
          tex.wrapS = THREE.RepeatWrapping;
          tex.wrapT = THREE.RepeatWrapping;
          tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
          tex.needsUpdate = true;
          if (solidColors[key] !== undefined) tex.userData.solidColor = solidColors[key];
          if (['asphalt', 'asphaltDark', 'sidewalk', 'stoneLight', 'plaza', 'grass', 'parkGrass', 'roofTiles', 'windowGrid', 'crosswalkWhite', 'water', 'waterPool'].includes(key)) {
            const repeatX = key === 'parkGrass' ? 26 : key === 'grass' ? 30 : key === 'sidewalk' || key === 'stoneLight' ? 6 : key === 'water' || key === 'waterPool' ? 8 : key === 'roofTiles' ? 2 : key === 'windowGrid' ? 3 : 12;
            const repeatY = key === 'parkGrass' ? 23 : key === 'grass' ? 30 : key === 'sidewalk' || key === 'stoneLight' ? 6 : key === 'water' || key === 'waterPool' ? 8 : key === 'roofTiles' ? 2 : key === 'windowGrid' ? 3 : 12;
            tex.repeat.set(repeatX, repeatY);
          }
      };
      const promises = textureKeys.map((key) => new Promise((resolve) => {
        let tex;
        try {
          tex = textureLoader.load(textureMap[key], () => {
            syncTextureClones(key, tex);
            resolve();
          }, undefined, (error) => {
            console.error('Failed to load texture: ' + textureMap[key], error);
            const fallback = document.createElement('canvas');
            fallback.width = 1;
            fallback.height = 1;
            const context = fallback.getContext('2d');
            context.fillStyle = '#' + (solidColors[key] || 0xffffff).toString(16).padStart(6, '0');
            context.fillRect(0, 0, 1, 1);
            tex.image = fallback;
            tex.needsUpdate = true;
            syncTextureClones(key, tex);
            resolve();
          });
          configureTexture(tex, key);
          textures[key] = tex;
        } catch (error) {
          console.error('Failed to initialize texture: ' + textureMap[key], error);
          resolve();
        }
      }));
      init();
      Promise.all(promises).then(() => {
        texturesReady = true;
        applyTextureMode();
      });
    }

    const walkKeys = { forward: false, backward: false, left: false, right: false, brake: false, jump: false, sprint: false };
    const driveKeys = { forward: false, backward: false, left: false, right: false, brake: false, jump: false, sprint: false, up: false, down: false };
    let activeMode = 'walk';
    let cameraMode = 'third';
    let cameraViewOffset = new THREE.Vector3(0, 1.8, 4.8);
    const debugEntries = [];
    let debugVisible = false;
    let playerHeight = 1.7;
    let playerVelocity = new THREE.Vector3();
    let playerOnGround = true;
    let playerInputActive = true;
    let playerStunUntil = 0;
    let playingConflictLoop = false;
    let lastWPressTime = 0;
    let controlledVehicle = null;
    let controlledBoat = null;
    let controlledAirplane = null;
    let currentGarageModel = 'sedan';
    let garageColor = 0x60a5fa;
    let gameStarted = false;
    let controllerVerticalTracking = false;
    let missionIndex = 0;
    const missions = ['Downtown cruise', 'City core loop', 'Parking district sweep', 'Plaza promenade'];
    const cityRoot = new THREE.Group();
    scene.add(cityRoot);

    function syncActiveMode() {
      activeMode = controlledVehicle ? 'drive' : controlledAirplane ? 'aircraft' : controlledBoat ? 'boat' : 'walk';
    }

    function clearVehicleKeys() {
      Object.keys(driveKeys).forEach((key) => { driveKeys[key] = false; });
      Object.keys(walkKeys).forEach((key) => { walkKeys[key] = false; });
    }

    const solids = [];
    const buildings = [];
    const buildingColliders = [];
    const worldBarriers = [];
    const footprintBuildingAreas = [];
    const destructibleProps = [];
    const debrisPieces = [];
    const wreckageCrowds = [];
    const vehicleDebris = [];
    const cars = [];
    const npcCars = [];
    const people = [];
    const buildingWorkers = [];
    const fallingDrivers = [];
    const medicalRescueState = { active: false, ambulance: null, medics: [], startedAt: 0, patientLoaded: false };
    const boats = [];
    const airplanes = [];
    const asphaltAreas = [];
    const sidewalkAreas = [];
    const tireTracks = [];
    const footprints = [];
    let playerFootprintPosition = null;
    let playerFootprintDistance = 0;
    let playerFootprintSide = 1;
    const smokeEmitters = [];
    const smokeParticles = [];
    const fireEffects = [];
    const explosionParticles = [];
    const fireMaterial = new THREE.MeshBasicMaterial({ color: 0xff5a12, transparent: true, opacity: 0.88, depthWrite: false });
    const innerFireMaterial = new THREE.MeshBasicMaterial({ color: 0xffd34e, transparent: true, opacity: 0.95, depthWrite: false });
    const parkFenceMaterial = new THREE.MeshStandardMaterial({ color: 0x48565a, metalness: 0.72, roughness: 0.38 });
    const parkFenceHorizontalRailGeometry = new THREE.BoxGeometry(1, 0.12, 0.14);
    const parkFenceVerticalRailGeometry = new THREE.BoxGeometry(0.14, 0.12, 1);
    const parkFencePostGeometry = new THREE.BoxGeometry(0.2, 1.18, 0.2);
    const childCapBrimGeometry = new THREE.CylinderGeometry(0.27, 0.27, 0.035, 12);
    const childCapCrownGeometry = new THREE.SphereGeometry(0.23, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    const spinningTopBodyGeometry = new THREE.SphereGeometry(0.14, 12, 8);
    const spinningTopPointGeometry = new THREE.ConeGeometry(0.055, 0.14, 10);
    const childCapMaterials = [
      0xd34b45, 0x3478b8, 0x3a9161, 0xe0a52f
    ].map((color) => new THREE.MeshStandardMaterial({ color, roughness: 0.76 }));
    const spinningTopMaterials = [
      0xe04f5f, 0x3d8ed0, 0xf1bd3d, 0x65ad67
    ].map((color) => new THREE.MeshStandardMaterial({ color, roughness: 0.42, metalness: 0.08 }));
    const smokeParticleGeometry = new THREE.SphereGeometry(0.34, 8, 6);
    const explosionParticleGeometry = new THREE.SphereGeometry(1, 8, 6);
    const fireOuterGeometry = new THREE.ConeGeometry(0.78, 2.2, 8);
    const fireInnerGeometry = new THREE.ConeGeometry(0.43, 1.45, 8);
    const tireTrackGeometry = new THREE.BoxGeometry(0.26, 0.018, 1.35);
    const tireTrackMaterial = new THREE.MeshBasicMaterial({ color: 0x171a1c, transparent: true, opacity: 0.58, depthWrite: false });
    const dirtTrackGeometry = new THREE.BoxGeometry(0.28, 0.016, 1.75);
    const dirtTrackMaterial = new THREE.MeshStandardMaterial({ color: 0x66452b, roughness: 0.96, metalness: 0.02, transparent: true, opacity: 0.9 });
    const footprintGeometry = (() => {
      const shape = new THREE.Shape();
      shape.moveTo(-0.085, -0.14);
      shape.quadraticCurveTo(-0.11, -0.03, -0.075, 0.09);
      shape.quadraticCurveTo(-0.04, 0.16, 0, 0.16);
      shape.quadraticCurveTo(0.07, 0.13, 0.085, 0.04);
      shape.quadraticCurveTo(0.08, -0.06, 0.06, -0.14);
      shape.quadraticCurveTo(0, -0.18, -0.085, -0.14);
      return new THREE.ShapeGeometry(shape, 8);
    })();
    const footprintMaterial = new THREE.MeshBasicMaterial({
      color: 0x443a2c,
      transparent: true,
      opacity: 0.52,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    const RIVER_X = 190;
    const RIVER_WIDTH = 34;
    const WATERWAY_KEEP_OUT = 3;
    const riverBridgeCenters = [-480, -320, 0, 320, 480];
    const RIVER_SURFACE_Y = -9.14;
    const roadAxisXValues = new Set();
    const roadAxisZValues = new Set();
    function overlapsRiverKeepOut(x, z, width, depth, clearance = 0) {
      return Math.abs(x - RIVER_X) < width / 2 + clearance + RIVER_WIDTH / 2 + WATERWAY_KEEP_OUT &&
        Math.abs(z) < depth / 2 + clearance + 600;
    }
    const buildingElevators = [];
    const sidewalkTargets = [];
    const pedestrianSpawnPoints = [];
    const parkActivityAreas = [];
    const benchSeats = [];
    const pushableObjects = [];
    const rampZones = [];
    const cityGoals = { targetBuildings: 180, targetParkedCars: 18 };
    const worldBounds = { minX: -570, maxX: 570, minZ: -570, maxZ: 570 };
    class WorldPlacementEngine {
      constructor(cellSize = 32, searchRadius = 48, searchStep = 4) {
        this.cellSize = cellSize;
        this.buckets = new Map();
        this.offsets = [];
        for (let dx = -searchRadius; dx <= searchRadius; dx += searchStep) {
          for (let dz = -searchRadius; dz <= searchRadius; dz += searchStep) {
            if (Math.hypot(dx, dz) <= searchRadius) this.offsets.push({ dx, dz, distance: dx * dx + dz * dz });
          }
        }
        this.offsets.sort((a, b) => a.distance - b.distance || a.dx - b.dx || a.dz - b.dz);
      }

      getBucketKeys(x, z, halfWidth, halfDepth) {
        const minX = Math.floor((x - halfWidth) / this.cellSize);
        const maxX = Math.floor((x + halfWidth) / this.cellSize);
        const minZ = Math.floor((z - halfDepth) / this.cellSize);
        const maxZ = Math.floor((z + halfDepth) / this.cellSize);
        const keys = [];
        for (let bx = minX; bx <= maxX; bx++) {
          for (let bz = minZ; bz <= maxZ; bz++) keys.push(`${bx},${bz}`);
        }
        return keys;
      }

      isAreaClear(x, z, width, depth, clearance = 0.8) {
        const halfWidth = width / 2 + clearance;
        const halfDepth = depth / 2 + clearance;
        if (overlapsRiverKeepOut(x, z, width, depth, clearance)) return false;
        const nearby = new Set();
        this.getBucketKeys(x, z, halfWidth, halfDepth).forEach((key) => {
          const bucket = this.buckets.get(key);
          if (bucket) bucket.forEach((entry) => nearby.add(entry));
        });
        for (const entry of nearby) {
          if (
            Math.abs(x - entry.x) >= halfWidth + entry.halfWidth ||
            Math.abs(z - entry.z) >= halfDepth + entry.halfDepth
          ) {
            continue;
          }
          return false;
        }
        return true;
      }

      reserve(x, z, width, depth, kind, clearance = 0.8) {
        const entry = { x, z, halfWidth: width / 2 + clearance, halfDepth: depth / 2 + clearance, kind };
        this.getBucketKeys(x, z, entry.halfWidth, entry.halfDepth).forEach((key) => {
          if (!this.buckets.has(key)) this.buckets.set(key, new Set());
          this.buckets.get(key).add(entry);
        });
        return { x, z };
      }

      reserveNearest(x, z, width, depth, kind, clearance = 0.8) {
        for (const offset of this.offsets) {
          const candidateX = x + offset.dx;
          const candidateZ = z + offset.dz;
          if (!this.isAreaClear(candidateX, candidateZ, width, depth, clearance)) continue;
          return this.reserve(candidateX, candidateZ, width, depth, kind, clearance);
        }
        return null;
      }
    }
    const worldPlacement = new WorldPlacementEngine();
    worldPlacement.reserve(RIVER_X, 0, RIVER_WIDTH + WATERWAY_KEEP_OUT * 2, 1200, 'river', 0);
    const entityVisibilityRadius = () => webOptimizer.lowLag ? 20 : 150;
    const chunkCacheKey = 'citySandboxChunkCache';
    const chunkCache = {};
    let lastVisibilityUpdate = 0;
    let lastSeenChunkKey = null;
    let fpsSampleTime = performance.now();
    let fpsFrameCount = 0;
    let flyMode = false;
    let lastSpaceTapTime = 0;
    const playerState = {
      position: new THREE.Vector3(0, 1.7, 28),
      yaw: 0,
      pitch: -0.35,
      velocity: new THREE.Vector3(),
      onGround: true,
      inRiver: false,
      height: 1.7,
      moveSpeed: 8.5,
      sprintScalar: 1.6,
      riverJumpBoost: 0,
      lastGroundedMoveAt: performance.now(),
      lastGroundedPosition: new THREE.Vector3(0, 0, 28),
      pointerLocked: false,
      boat: null,
      airplane: null,
      seatedOn: null,
      seatedOffset: null
    };
    const playerCharacter = new THREE.Group();
    const playerHair = createHumanHair(Math.random() < 0.5 ? 'female' : 'male');
    playerHair.group.position.set(0, 2.08, 0.02);
    playerCharacter.add(playerHair.group);
    const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || window.matchMedia('(pointer: coarse)').matches;
    const touchLook = { active: false, x: 0, y: 0 };
    const airportPlaneTemplate = new THREE.Group();
    const PLANE_SPAWN_INTERVAL = 3000;
    let lastAirportPlaneSpawn = 0;
    const playerBodyMaterial = new THREE.MeshStandardMaterial({ color: 0x3b82f6, roughness: 0.8 });
    const playerSkinMaterial = new THREE.MeshStandardMaterial({ color: 0xf5d0b5, roughness: 1 });
    const playerBody = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.84, 12), playerBodyMaterial);
    playerBody.position.y = 0.9;
    const playerHead = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 16), playerSkinMaterial);
    playerHead.position.y = 1.9;
    const playerLeftArm = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.72, 0.14), playerBodyMaterial);
    playerLeftArm.position.set(-0.36, 1.1, 0);
    const playerRightArm = playerLeftArm.clone();
    playerRightArm.position.x = 0.36;
    const playerLeftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.82, 0.18), playerBodyMaterial);
    playerLeftLeg.position.set(-0.14, 0.25, 0);
    const playerRightLeg = playerLeftLeg.clone();
    playerRightLeg.position.x = 0.14;
    playerCharacter.add(playerBody, playerHead, playerLeftArm, playerRightArm, playerLeftLeg, playerRightLeg);
    const fullscreenFlash = document.getElementById('fullscreen-flash');
    const navigationNodes = [];
    const navigationEdges = new Map();
    let boundaryZones = [];
    let entityPopulation = [];
    scene.add(playerCharacter);

    const startButton = document.getElementById('start-button');
    const loadButton = document.getElementById('load-button');
    const garageButton = document.getElementById('garage-button');
    const settingsButton = document.getElementById('settings-button');
    const settingsBackButton = document.getElementById('settings-back-button');
    const playSaveButton = document.getElementById('play-save-button');
    const menuHome = document.getElementById('menu-home');
    const settingsPanel = document.getElementById('settings-panel');
    const resolutionSelect = document.getElementById('resolution-select');
    const maxFpsSelect = document.getElementById('max-fps-select');
    const unlimitedFpsToggle = document.getElementById('unlimited-fps-toggle');
    const texturesToggle = document.getElementById('textures-toggle');
    const planeDespawnToggle = document.getElementById('plane-despawn-toggle');
    const destructionToggle = document.getElementById('destruction-toggle');
    const npcsToggle = document.getElementById('npcs-toggle');
    const cornerMapToggle = document.getElementById('corner-map-toggle');
    const trafficLightsToggle = document.getElementById('traffic-lights-toggle');
    const medicalRescueToggle = document.getElementById('medical-rescue-toggle');
    const characterDetailToggle = document.getElementById('character-detail-toggle');
    const vehicleSelect = document.getElementById('vehicle-select');
    const colorPicker = document.getElementById('color-picker');
    const menu = document.getElementById('menu');
    const teleportMenu = document.getElementById('teleport-menu');
    const menuStatus = document.getElementById('menu-status');
    const missionText = document.getElementById('mission-text');
    const missionPanel = document.getElementById('mission-panel');
    const missionPanelText = document.getElementById('mission-panel-text');
    const minimap = document.getElementById('minimap');
    const minimapCtx = minimap.getContext('2d');
    const closeGuideButton = document.getElementById('close-guide-button');
    const closeRoutineButton = document.getElementById('close-routine-button');
    const speedometer = document.getElementById('speedometer');
    const speedReadout = document.getElementById('speed-readout');
    const fpsCounter = document.getElementById('fps-counter');
    const mobileControls = document.getElementById('mobile-controls');

    function setMission(index) {
      missionIndex = (index + missions.length) % missions.length;
      const value = missions[missionIndex];
      missionText.textContent = value;
      if (missionPanelText) {
        missionPanelText.textContent = 'City routine: ' + value + ' • visit the plaza, blocks, sidewalks, and parking lanes.';
      }
    }

    function setGuideVisible(visible) {
      const guide = document.getElementById('hud');
      if (guide) guide.style.display = visible ? 'block' : 'none';
    }

    function setRoutineVisible(visible) {
      if (missionPanel) missionPanel.style.display = visible ? 'block' : 'none';
    }

    function setCookie(name, value, days = 365) {
      const expiry = new Date(Date.now() + days * 86400000).toUTCString();
      document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expiry}; path=/; SameSite=Lax`;
    }

    function getCookie(name) {
      const cookies = document.cookie.split('; ');
      for (const entry of cookies) {
        const [cookieName, ...rest] = entry.split('=');
        if (cookieName === name) return decodeURIComponent(rest.join('='));
      }
      return '';
    }

    function getChunkKey(x, z) {
      return `${Math.floor(x / 32)},${Math.floor(z / 32)}`;
    }

    function loadChunkCache() {
      const raw = getCookie(chunkCacheKey);
      if (!raw) return;
      try {
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return;
        Object.keys(parsed).forEach((key) => {
          const value = parsed[key];
          if (value && typeof value === 'object' && typeof value.updatedAt === 'number') {
            chunkCache[key] = value;
          }
        });
      } catch (error) {
        console.warn('Chunk cookie load failed', error);
      }
    }

    function saveChunkCache() {
      const snapshot = {};
      Object.keys(chunkCache).slice(-32).forEach((key) => {
        snapshot[key] = chunkCache[key];
      });
      setCookie(chunkCacheKey, JSON.stringify(snapshot), 7);
    }

    function markChunkSeen(x, z) {
      const key = getChunkKey(x, z);
      if (key === lastSeenChunkKey) return;
      lastSeenChunkKey = key;
      if (!chunkCache[key]) chunkCache[key] = { key, x: Math.floor(x / 32) * 32, z: Math.floor(z / 32) * 32, updatedAt: Date.now() };
      else chunkCache[key].updatedAt = Date.now();
      if (Object.keys(chunkCache).length > 64) {
        const entries = Object.entries(chunkCache).sort((a, b) => a[1].updatedAt - b[1].updatedAt);
        while (entries.length > 64) {
          const oldestKey = entries.shift()[0];
          delete chunkCache[oldestKey];
        }
      }
      saveChunkCache();
    }

    function updateVisibleEntities() {
      const now = performance.now();
      const updateInterval = webOptimizer.lowLag ? 200 : 50;
      if (now - lastVisibilityUpdate < updateInterval) return;
      lastVisibilityUpdate = now;
      const visibilityOrigin = controlledVehicle
        ? controlledVehicle.body.position
        : controlledAirplane
          ? controlledAirplane.mesh.position
          : playerState.position;
      const px = visibilityOrigin.x;
      const py = visibilityOrigin.y === undefined ? playerState.position.y : visibilityOrigin.y;
      const pz = visibilityOrigin.z;
      const radius = entityVisibilityRadius();
      const isNear = (entityX, entityY, entityZ) => Math.hypot(entityX - px, entityY - py, entityZ - pz) <= radius;

      cars.forEach((car) => {
        if (!car || !car.mesh || car.destroyed) return;
        if (car === controlledVehicle) {
          car.mesh.visible = true;
          car.body.wakeUp();
          return;
        }
        const near = isNear(car.body.position.x, car.body.position.y, car.body.position.z);
        car.mesh.visible = near;
        if (near && !car.parked) car.body.wakeUp();
        else car.body.sleep();
      });

      npcCars.forEach((car) => {
        if (!car || !car.mesh || car.destroyed) return;
        const near = gameSettings.npcs && isNear(car.body.position.x, car.body.position.y, car.body.position.z);
        car.mesh.visible = car === controlledVehicle || near;
        car.active = near;
        if (!near) car.body.sleep();
        else car.body.wakeUp();
      });

      people.forEach((person) => {
        if (!person || !person.mesh) return;
        const near = gameSettings.npcs && isNear(person.mesh.position.x, person.mesh.position.y, person.mesh.position.z);
        if (near && !person.renderAttached) {
          scene.add(person.mesh);
          person.renderAttached = true;
        } else if (!near && person.renderAttached && person.mesh.parent === scene) {
          scene.remove(person.mesh);
          person.renderAttached = false;
        }
        person.mesh.visible = near;
        person.active = near;
        if (person.deviceGroup) person.deviceGroup.visible = near && person.useDevice;
      });

      boats.forEach((boat) => {
        if (!boat || !boat.mesh) return;
        boat.mesh.visible = boat === controlledBoat || isNear(boat.mesh.position.x, boat.mesh.position.y, boat.mesh.position.z);
      });

      airplanes.forEach((aircraft) => {
        if (!aircraft || !aircraft.mesh || aircraft.crashed) return;
        const position = aircraft.mesh.getWorldPosition(new THREE.Vector3());
        aircraft.mesh.visible = aircraft === controlledAirplane || isNear(position.x, position.y, position.z);
      });

      markChunkSeen(px, pz);
    }

    function saveGameState() {
      if (!gameStarted) return;
      const safeCamera = {
        x: Number.isFinite(camera.position.x) ? camera.position.x : playerState.position.x,
        y: Number.isFinite(camera.position.y) ? camera.position.y : playerState.position.y,
        z: Number.isFinite(camera.position.z) ? camera.position.z : playerState.position.z
      };
      const state = {
        position: {
          x: Number.isFinite(safeCamera.x) ? safeCamera.x : 0,
          y: Number.isFinite(safeCamera.y) ? safeCamera.y : 1.7,
          z: Number.isFinite(safeCamera.z) ? safeCamera.z : 28
        },
        missionIndex,
        garageColor,
        currentGarageModel,
        settings: { ...gameSettings },
        timestamp: Date.now()
      };
      setCookie('citySandboxSave', JSON.stringify(state));
      menuStatus.textContent = 'City saved to cookie.';
      logDebug('info', 'Saved city state');
    }

    function loadGameState() {
      const raw = getCookie('citySandboxSave');
      if (!raw) {
        menuStatus.textContent = 'No saved city yet.';
        return null;
      }
      try {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.position) {
          const savedX = Number.isFinite(parsed.position.x) ? parsed.position.x : 0;
          const savedY = Number.isFinite(parsed.position.y) ? parsed.position.y : 6;
          const savedZ = Number.isFinite(parsed.position.z) ? parsed.position.z : 28;
          camera.position.set(savedX, savedY, savedZ);
          playerState.position.set(savedX, Math.max(1.7, savedY), savedZ);
          missionIndex = Number(parsed.missionIndex || 0);
          garageColor = Number(parsed.garageColor || 0x60a5fa);
          currentGarageModel = parsed.currentGarageModel || 'sedan';
          vehicleSelect.value = currentGarageModel;
          colorPicker.value = '#' + garageColor.toString(16).padStart(6, '0');
          setMission(missionIndex);
          if (parsed.settings && typeof parsed.settings === 'object') {
            const resolution = Number(parsed.settings.resolution);
            const maxFps = Number(parsed.settings.maxFps);
            if ([0.5, 0.75, 1, 1.25].includes(resolution)) gameSettings.resolution = resolution;
            if ([30, 40, 50, 60, 75, 90, 120].includes(maxFps)) gameSettings.maxFps = maxFps;
            ['unlimitedFps', 'textures', 'planeDespawn', 'destruction', 'npcs', 'cornerMap', 'trafficLights', 'medicalRescue', 'characterDetail'].forEach((key) => {
              if (typeof parsed.settings[key] === 'boolean') gameSettings[key] = parsed.settings[key];
            });
            syncSettingsControls();
            applyGameSettings();
          }
          menuStatus.textContent = 'Saved city loaded.';
          return parsed;
        }
      } catch (error) {
        console.warn('Cookie load failed', error);
      }
      menuStatus.textContent = 'Saved data is invalid.';
      return null;
    }

    function applyGarageSelection() {
      currentGarageModel = vehicleSelect.value;
      garageColor = parseInt(colorPicker.value.replace('#', ''), 16);
      if (controlledVehicle) {
        controlledVehicle.color = garageColor;
        controlledVehicle.mesh.children[0].material.color.setHex(garageColor);
      }
      saveGameState();
      showMessage('Garage updated: ' + currentGarageModel);
    }

    let pointerLockPausedByEscape = false;

    function handlePointerLockFailure() {
      document.body.style.cursor = 'auto';
      if (gameStarted && !pointerLockPausedByEscape) {
        showMessage('Cursor lock was blocked here. Open the game in a top-level browser tab over localhost or HTTPS.');
      }
    }

    function requestGamePointerLock() {
      if (!gameStarted || pointerLockPausedByEscape || !menu.classList.contains('hidden') || teleportMenu.classList.contains('visible')) return;
      try {
        const request = renderer.domElement.requestPointerLock();
        if (request && typeof request.catch === 'function') {
          request.catch(handlePointerLockFailure);
        }
      } catch (error) {
        handlePointerLockFailure();
      }
    }

    function showMenu(show = true) {
      menu.classList.toggle('hidden', !show);
      if (show) {
        showSettingsView(false);
        document.body.style.cursor = 'auto';
        if (document.pointerLockElement === renderer.domElement) document.exitPointerLock();
      } else {
        pointerLockPausedByEscape = false;
        document.body.style.cursor = 'none';
        if (document.pointerLockElement !== renderer.domElement) requestGamePointerLock();
      }
    }

    function showTeleportMenu(show = true) {
      if (isMobile || !gameStarted) return;
      teleportMenu.classList.toggle('visible', show);
      if (show) {
        document.body.style.cursor = 'auto';
        if (document.pointerLockElement === renderer.domElement) document.exitPointerLock();
      } else {
        document.body.style.cursor = 'none';
        if (document.pointerLockElement !== renderer.domElement) requestGamePointerLock();
      }
    }

    function setSafePlayerPosition(x, y, z) {
      const safeX = Number.isFinite(x) ? x : 0;
      const safeY = Number.isFinite(y) ? y : 1.7;
      const safeZ = Number.isFinite(z) ? z : 28;
      playerState.position.set(safeX, safeY, safeZ);
      if (!Number.isFinite(playerState.position.x) || !Number.isFinite(playerState.position.y) || !Number.isFinite(playerState.position.z)) {
        playerState.position.set(0, 1.7, 28);
      }
    }

    function teleportPlayer(destination) {
      if (!gameStarted) return;
      const exitVehicle = controlledVehicle || controlledAirplane || playerState.boat;
      if (controlledVehicle) {
        controlledVehicle = null;
        clearVehicleKeys();
      }
      if (controlledAirplane) {
        controlledAirplane = null;
        clearVehicleKeys();
      }
      if (playerState.boat) {
        leaveBoat();
      }
      let x = 0;
      let z = 28;
      let y = 1.7;
      let yaw = 0;
      let planeTarget = null;
      if (destination === 'airport') { x = -450; z = -450; y = 1.7; yaw = Math.PI * 0.7; }
      else if (destination === 'plane') {
        const nearbyPlanes = airplanes.filter((aircraft) => !aircraft.crashed && aircraft.mesh && aircraft !== controlledAirplane);
        nearbyPlanes.sort((a, b) => {
          const da = Math.hypot(a.mesh.position.x - playerState.position.x, a.mesh.position.z - playerState.position.z);
          const db = Math.hypot(b.mesh.position.x - playerState.position.x, b.mesh.position.z - playerState.position.z);
          return da - db;
        });
        planeTarget = nearbyPlanes[0] || null;
        if (planeTarget) {
          const worldPosition = planeTarget.mesh.getWorldPosition(new THREE.Vector3());
          x = Number.isFinite(worldPosition.x) ? worldPosition.x : 0;
          z = Number.isFinite(worldPosition.z) ? worldPosition.z : 28;
          y = Number.isFinite(worldPosition.y) ? worldPosition.y + 1.2 : 1.7;
          yaw = Number.isFinite(planeTarget.heading) ? planeTarget.heading : planeTarget.mesh.rotation.y;
          setSafePlayerPosition(x, y, z);
          playerState.velocity.set(0, 0, 0);
          const didBoard = boardAirplane(planeTarget);
          if (didBoard) {
            showMessage('Teleported to nearest plane and took full control.');
            showTeleportMenu(false);
            return;
          }
        }
      } else if (destination === 'house') {
        const houses = buildings.filter((building) => building.zone === 'residential');
        const target = houses[Math.floor(Math.random() * houses.length)] || { x: 0, z: 0 };
        x = target.x; z = target.z + 12;
      } else if (destination === 'car') {
        const availableCars = cars.filter((car) => !car.destroyed && car.mesh);
        const targetCar = availableCars[Math.floor(Math.random() * availableCars.length)];
        if (targetCar) { x = targetCar.body.position.x; z = targetCar.body.position.z + 4; }
      } else if (destination === 'plow') {
        const plow = cars.find((car) => car.isPlow && !car.destroyed);
        x = plow ? plow.body.position.x : 535;
        z = plow ? plow.body.position.z - 9 : 531;
        yaw = Math.PI;
      } else if (destination === 'building') {
        const target = buildings[Math.floor(Math.random() * buildings.length)] || { x: 0, z: 0 };
        x = target.x; z = target.z;
      } else if (destination === 'random') {
        x = THREE.MathUtils.randFloat(worldBounds.minX + 30, worldBounds.maxX - 30);
        z = THREE.MathUtils.randFloat(worldBounds.minZ + 30, worldBounds.maxZ - 30);
      } else if (destination === 'river') {
        x = RIVER_X; z = 0; y = RIVER_SURFACE_Y + 1.7; yaw = 0;
      } else if (destination === 'spawn') {
        x = 0; z = 28; y = 1.7; yaw = 0;
      }
      const groundY = groundHeightAt(x, z) + y;
      setSafePlayerPosition(x, groundY, z);
      playerState.velocity.set(0, 0, 0);
      playerState.yaw = yaw;
      playerState.onGround = true;
      playerState.inRiver = destination === 'river';
      playerState.boat = null;
      playerState.airplane = null;
      playerState.seatedOn = null;
      playerState.riverJumpBoost = 0;
      camera.position.y = Math.max(1.7, groundY + 2.4);
      if (exitVehicle) showMessage('Teleported to ' + destination + '.');
      else showMessage('Teleported to ' + destination + '.');
      showTeleportMenu(false);
    }

    function makeProceduralGroundTexture(baseColor, accentColor, tileSize = 32) {
      const canvas = document.createElement('canvas');
      canvas.width = tileSize * 2;
      canvas.height = tileSize * 2;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = baseColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      for (let y = 0; y < canvas.height; y += tileSize) {
        for (let x = 0; x < canvas.width; x += tileSize) {
          ctx.fillStyle = (x + y) % (tileSize * 2) === 0 ? accentColor : baseColor;
          ctx.fillRect(x, y, tileSize, tileSize);
        }
      }
      for (let i = 0; i < 120; i++) {
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height;
        const size = 2 + Math.random() * 4;
        ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)';
        ctx.fillRect(x, y, size, size);
      }
      const texture = new THREE.CanvasTexture(canvas);
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(8, 8);
      texture.needsUpdate = true;
      return texture;
    }

    function showMessage(text, duration = 1400) {
      const message = document.getElementById('message');
      if (!message) return;
      message.textContent = text;
      message.style.display = 'block';
      clearTimeout(showMessage.timer);
      showMessage.timer = setTimeout(() => { message.style.display = 'none'; }, duration);
    }

    function logDebug(type, text) {
      debugEntries.push({ type, text: String(text) });
      if (debugEntries.length > 40) debugEntries.shift();
      renderDebug();
    }

    function renderDebug() {
      const menuElement = document.getElementById('debug-menu');
      const list = document.getElementById('debug-log');
      if (!menuElement || !list) return;
      list.innerHTML = '';
      debugEntries.slice(-18).forEach((entry) => {
        const item = document.createElement('li');
        item.className = entry.type;
        item.textContent = entry.text;
        list.appendChild(item);
      });
      menuElement.classList.toggle('visible', debugVisible);
    }

    function addStaticMesh(mesh, body = null) {
      cityRoot.add(mesh);
      if (body) solids.push({ mesh, body });
    }

    function pointIsInsideBuildingRect(x, z, padding = 0.8) {
      const insideBuilding = buildingColliders.some((box) => {
        if (box.collapsing) return false;
        const minX = box.minX - padding;
        const maxX = box.maxX + padding;
        const minZ = box.minZ - padding;
        const maxZ = box.maxZ + padding;
        const inside = x >= minX && x <= maxX && z >= minZ && z <= maxZ;
        if (!inside) return false;

        const wallThickness = box.wallThickness || 0.3;
        const insideRoom = x > box.minX + wallThickness + padding && x < box.maxX - wallThickness - padding &&
          z > box.minZ + wallThickness + padding && z < box.maxZ - wallThickness - padding;
        if (insideRoom) return false;

        const openingHalfWidth = Math.max(1.2, (box.entranceWidth || Math.min(box.sizeX * 0.32, 6)) / 2);
        const frontOpeningDepth = box.entranceDepth || 2.4;
        const centerX = box.x;
        const frontMiddle = z >= box.maxZ - frontOpeningDepth - padding && z <= box.maxZ + padding;
        const centerPassage = x >= centerX - openingHalfWidth && x <= centerX + openingHalfWidth;
        return !(frontMiddle && centerPassage);
      });
      return insideBuilding || worldBarriers.some((box) =>
        x >= box.minX - padding && x <= box.maxX + padding && z >= box.minZ - padding && z <= box.maxZ + padding
      );
    }

    function isRiverPosition(x, z) {
      const bridgeWidth = 34;
      const onBridge = riverBridgeCenters.some((bridgeZ) => Math.abs(z - bridgeZ) <= 11 && Math.abs(x - RIVER_X) <= bridgeWidth / 2 + 2);
      return !onBridge && Math.abs(x - RIVER_X) <= RIVER_WIDTH / 2 && Math.abs(z) <= 600;
    }

    function groundHeightAt(x, z) {
      if (Math.abs(z) <= 11) return 0;
      if (z >= 241.4 && z <= 246.6 && x >= 155 && x <= RIVER_X - RIVER_WIDTH / 2) {
        return RIVER_SURFACE_Y * (x - 155) / (RIVER_X - RIVER_WIDTH / 2 - 155);
      }
      if (isRiverPosition(x, z)) return RIVER_SURFACE_Y + 1.7;
      return 0;
    }

    function resolveFootstep(x, z, radius = 0.75) {
      const proposedX = THREE.MathUtils.clamp(x, worldBounds.minX + radius, worldBounds.maxX - radius);
      const proposedZ = THREE.MathUtils.clamp(z, worldBounds.minZ + radius, worldBounds.maxZ - radius);

      if (pointIsInsideBuildingRect(proposedX, proposedZ, radius + 0.4)) {
        return { x: x, z: z, blocked: true };
      }

      return { x: proposedX, z: proposedZ, blocked: false };
    }

    function updatePlayerCharacter() {
      playerCharacter.position.set(playerState.position.x, playerState.position.y - 1.7, playerState.position.z);
      playerCharacter.rotation.y = playerState.yaw;
      const isPaddling = playerState.boat && controlledBoat === playerState.boat;
      const personVisible = !controlledVehicle && (!playerState.boat || isPaddling) && !playerState.seatedOn;
      playerCharacter.visible = personVisible;
      const isWalking = personVisible && !playerState.airplane && (walkKeys.forward || walkKeys.backward || walkKeys.left || walkKeys.right);
      const walkPhase = isWalking ? performance.now() * 0.01 : 0;
      const armSwing = Math.sin(walkPhase) * 0.8;
      const legSwing = Math.sin(walkPhase) * 0.9;
      playerLeftArm.rotation.z = isWalking ? armSwing : 0;
      playerRightArm.rotation.z = isWalking ? -armSwing : 0;
      playerLeftLeg.rotation.x = isWalking ? -legSwing : 0;
      playerRightLeg.rotation.x = isWalking ? legSwing : 0;
      playerBody.rotation.z = playerState.velocity.y > 0 ? -0.2 : 0;
    }

    function applyPointerLook() {
      camera.rotation.order = 'YXZ';
      const base = playerState.position.clone();
      if (controlledVehicle) {
        camera.rotation.y = playerState.yaw;
        camera.rotation.x = playerState.pitch;
        return;
      }
      if (playerState.seatedOn) {
        camera.position.set(playerState.position.x + Math.sin(playerState.yaw) * 1.2, playerState.position.y + 1.3, playerState.position.z + Math.cos(playerState.yaw) * 1.2);
        camera.rotation.y = playerState.yaw;
        camera.rotation.x = playerState.pitch * 0.8;
        return;
      }
      if (cameraMode === 'first') {
        camera.position.set(base.x, base.y + 1.6, base.z);
        camera.rotation.y = playerState.yaw;
        camera.rotation.x = playerState.pitch;
      } else {
        const offset = new THREE.Vector3(Math.sin(playerState.yaw) * -4.4, 2.0, Math.cos(playerState.yaw) * -4.4);
        camera.position.copy(base.clone().add(offset));
        camera.rotation.y = playerState.yaw + Math.PI;
        camera.rotation.x = playerState.pitch * 0.8;
      }
    }

    function updateMinimap() {
      const ctx = minimapCtx;
      const size = minimap.width;
      const margin = 14;
      const worldWidth = worldBounds.maxX - worldBounds.minX;
      const worldHeight = worldBounds.maxZ - worldBounds.minZ;
      const scale = Math.min((size - margin * 2) / worldWidth, (size - margin * 2) / worldHeight);
      const cx = size / 2;
      const cy = size / 2;

      ctx.clearRect(0, 0, size, size);
      ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
      ctx.fillRect(0, 0, size, size);
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.85)';
      ctx.lineWidth = 2;
      ctx.strokeRect(margin, margin, size - margin * 2, size - margin * 2);

      ctx.fillStyle = 'rgba(100, 116, 139, 0.82)';
      ctx.fillRect(cx - 80, cy - 80, 160, 160);
      ctx.fillStyle = 'rgba(148, 163, 184, 0.9)';
      ctx.fillRect(cx - 60, cy - 60, 120, 120);
      const riverMapX = cx + (RIVER_X - (worldBounds.minX + worldBounds.maxX) / 2) * scale;
      ctx.strokeStyle = '#27a9bd'; ctx.lineWidth = Math.max(2, RIVER_WIDTH * scale);
      ctx.beginPath(); ctx.moveTo(riverMapX, margin); ctx.lineTo(riverMapX, size - margin); ctx.stroke();
      ctx.fillStyle = '#fbbf24';
      const airportMapX = cx + (-450 - (worldBounds.minX + worldBounds.maxX) / 2) * scale;
      const airportMapY = cy + (-450 - (worldBounds.minZ + worldBounds.maxZ) / 2) * scale;
      ctx.fillRect(airportMapX - 4, airportMapY - 4, 8, 8);
      ctx.fillStyle = '#f97316';
      const plowMapX = cx + (535 - (worldBounds.minX + worldBounds.maxX) / 2) * scale;
      const plowMapY = cy + (540 - (worldBounds.minZ + worldBounds.maxZ) / 2) * scale;
      ctx.fillRect(plowMapX - 4, plowMapY - 4, 8, 8);

      buildings.forEach((b) => {
        const x = cx + (b.x - (worldBounds.minX + worldBounds.maxX) / 2) * scale;
        const y = cy + (b.z - (worldBounds.minZ + worldBounds.maxZ) / 2) * scale;
        const w = Math.max(6, b.sizeX * scale * 0.82);
        const h = Math.max(6, b.sizeZ * scale * 0.82);
        ctx.fillStyle = 'rgba(96, 165, 250, 0.82)';
        ctx.fillRect(x - w / 2, y - h / 2, w, h);
      });

      const trackedPosition = controlledVehicle ? controlledVehicle.body.position : new CANNON.Vec3(playerState.position.x, 0, playerState.position.z);
      const px = cx + (trackedPosition.x - (worldBounds.minX + worldBounds.maxX) / 2) * scale;
      const py = cy + (trackedPosition.z - (worldBounds.minZ + worldBounds.maxZ) / 2) * scale;
      ctx.fillStyle = controlledVehicle ? '#34d399' : '#f8fafc';
      ctx.beginPath(); ctx.arc(px, py, controlledVehicle ? 7 : 5, 0, Math.PI * 2); ctx.fill();
      if (controlledVehicle) {
        const angle = controlledVehicle.mesh.rotation.y;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px + Math.sin(angle) * 12, py + Math.cos(angle) * 12);
        ctx.strokeStyle = '#dcfce7';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }

    function createGroundPlane() {
      const grassTexture = textures.grass || makeProceduralGroundTexture('#a6d67b', '#679f5a');
      [[-213.5, 0, 773], [403.5, 0, 393]].forEach(([x, z, width]) => {
        const groundTexture = grassTexture === textures.grass
          ? createSurfaceTexture('grass', width, 1200, 2)
          : grassTexture.clone();
        if (grassTexture !== textures.grass) groundTexture.repeat.set(width / 2, 600);
        groundTexture.needsUpdate = true;
        const groundMaterial = new THREE.MeshStandardMaterial(withTexture(groundTexture, { color: 0xffffff, roughness: 1 }));
        const ground = new THREE.Mesh(new THREE.PlaneGeometry(width, 1200), groundMaterial);
        ground.rotation.x = -Math.PI / 2; ground.position.set(x, -0.02, z); ground.receiveShadow = true; scene.add(ground);
        const groundBody = new CANNON.Body({ mass: 0 });
        groundBody.addShape(new CANNON.Box(new CANNON.Vec3(width / 2, 0.35, 600)));
        groundBody.position.set(x, -0.35, z); world.addBody(groundBody);
      });
    }

    function createWorldEdgeBackdrop() {
      const width = worldBounds.maxX - worldBounds.minX + 60;
      const height = 712;
      const geometry = new THREE.PlaneGeometry(width, height);
      const material = new THREE.MeshBasicMaterial({
        map: textures.border || null,
        color: 0xffffff,
        side: THREE.DoubleSide
      });
      const centerX = (worldBounds.minX + worldBounds.maxX) / 2;
      const centerZ = (worldBounds.minZ + worldBounds.maxZ) / 2;
      const edgeOffset = 32;
      [
        { x: centerX, z: worldBounds.minZ - edgeOffset, rotationY: 0 },
        { x: centerX, z: worldBounds.maxZ + edgeOffset, rotationY: Math.PI },
        { x: worldBounds.minX - edgeOffset, z: centerZ, rotationY: Math.PI / 2 },
        { x: worldBounds.maxX + edgeOffset, z: centerZ, rotationY: -Math.PI / 2 }
      ].forEach(({ x, z, rotationY }) => {
        const backdrop = new THREE.Mesh(geometry, material);
        backdrop.position.set(x, -144, z);
        backdrop.rotation.y = rotationY;
        scene.add(backdrop);
      });
    }

    function createBarrier(x, z, width, depth, height = 1.4, y = height / 2, color = 0xb6b9bb, breakable = false, kind = 'wall') {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(width, height, depth),
        new THREE.MeshStandardMaterial({ map: textures.concreteGrey || null, color, roughness: 0.84 })
      );
      mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; cityRoot.add(mesh);
      const body = new CANNON.Body({ mass: 0 });
      body.addShape(new CANNON.Box(new CANNON.Vec3(width / 2, height / 2, depth / 2)));
      body.position.set(x, y, z); world.addBody(body);
      worldBarriers.push({ x, z, width, depth, height, y, kind, breakable, health: breakable ? (kind === 'airport-wall' ? 90 : 42) : Infinity, minX: x - width / 2, maxX: x + width / 2, minZ: z - depth / 2, maxZ: z + depth / 2, mesh, body });
      return mesh;
    }

    function createBreakableBarrierLine(x, z, width, depth, height, y, color, kind = 'airport-wall') {
      const horizontal = width >= depth;
      const length = horizontal ? width : depth;
      const sectionCount = Math.ceil(length / 12);
      const sectionLength = length / sectionCount;
      for (let index = 0; index < sectionCount; index++) {
        const offset = -length / 2 + sectionLength * (index + 0.5);
        createBarrier(
          x + (horizontal ? offset : 0),
          z + (horizontal ? 0 : offset),
          horizontal ? sectionLength : width,
          horizontal ? depth : sectionLength,
          height, y, color, true, kind
        );
      }
    }

    function createParkFenceSegment(x, z, length, horizontal) {
      const sectionCount = Math.ceil(length / 10);
      const sectionLength = length / sectionCount;
      const railGeometry = horizontal ? parkFenceHorizontalRailGeometry : parkFenceVerticalRailGeometry;
      for (let sectionIndex = 0; sectionIndex < sectionCount; sectionIndex++) {
        const offset = -length / 2 + sectionLength * (sectionIndex + 0.5);
        const sectionX = x + (horizontal ? offset : 0);
        const sectionZ = z + (horizontal ? 0 : offset);
        const fence = new THREE.Group();
        const rails = new THREE.InstancedMesh(railGeometry, parkFenceMaterial, 2);
        const transform = new THREE.Object3D();
        [0.38, 0.96].forEach((railHeight, index) => {
          transform.position.set(0, railHeight, 0);
          transform.scale.set(horizontal ? sectionLength : 1, 1, horizontal ? 1 : sectionLength);
          transform.updateMatrix();
          rails.setMatrixAt(index, transform.matrix);
        });
        const postCount = Math.max(1, Math.ceil(sectionLength / 2.8));
        const posts = new THREE.InstancedMesh(parkFencePostGeometry, parkFenceMaterial, postCount + 1);
        for (let index = 0; index <= postCount; index++) {
          const postOffset = -sectionLength / 2 + sectionLength * index / postCount;
          transform.position.set(horizontal ? postOffset : 0, 0.59, horizontal ? 0 : postOffset);
          transform.scale.set(1, 1, 1);
          transform.updateMatrix();
          posts.setMatrixAt(index, transform.matrix);
        }
        rails.instanceMatrix.needsUpdate = true;
        posts.instanceMatrix.needsUpdate = true;
        fence.add(rails, posts);
        fence.position.set(sectionX, 0, sectionZ);
        cityRoot.add(fence);
        worldBarriers.push({
          x: sectionX, z: sectionZ, width: horizontal ? sectionLength : 0.32, depth: horizontal ? 0.32 : sectionLength,
          height: 1.18, y: 0.59, kind: 'park-fence', breakable: true, health: 42,
          minX: sectionX - (horizontal ? sectionLength / 2 : 0.16),
          maxX: sectionX + (horizontal ? sectionLength / 2 : 0.16),
          minZ: sectionZ - (horizontal ? 0.16 : sectionLength / 2),
          maxZ: sectionZ + (horizontal ? 0.16 : sectionLength / 2),
          mesh: fence
        });
      }
    }

    function createParkFence(x, z, width, depth, entranceWidth = 6) {
      const halfWidth = width / 2;
      const halfDepth = depth / 2;
      createParkFenceSegment(x, z - halfDepth, width, true);
      createParkFenceSegment(x - halfWidth, z, depth, false);
      createParkFenceSegment(x + halfWidth, z, depth, false);
      const sideLength = (width - entranceWidth) / 2;
      if (sideLength > 0) {
        createParkFenceSegment(x - (entranceWidth + sideLength) / 2, z + halfDepth, sideLength, true);
        createParkFenceSegment(x + (entranceWidth + sideLength) / 2, z + halfDepth, sideLength, true);
      }
    }

    function isFootprintSurface(x, z) {
      if (isRiverPosition(x, z)) return false;
      const insideBuilding = footprintBuildingAreas.some((area) =>
        Math.abs(x - area.x) <= area.halfWidth &&
        Math.abs(z - area.z) <= area.halfDepth
      );
      if (insideBuilding) return false;
      const onAsphalt = asphaltAreas.some((area) =>
        Math.abs(x - area.x) <= area.halfWidth &&
        Math.abs(z - area.z) <= area.halfDepth
      );
      if (onAsphalt) return false;
      return !sidewalkAreas.some((area) =>
        Math.abs(x - area.x) <= area.halfWidth &&
        Math.abs(z - area.z) <= area.halfDepth
      );
    }

    function createRiver() {
      const bed = new THREE.Mesh(new THREE.BoxGeometry(RIVER_WIDTH, 0.8, 1200), new THREE.MeshStandardMaterial({ color: 0x354a43, roughness: 1 }));
      bed.position.set(RIVER_X, -16.3, 0); bed.receiveShadow = true; cityRoot.add(bed);
      const bedBody = new CANNON.Body({ mass: 0 });
      bedBody.addShape(new CANNON.Box(new CANNON.Vec3(RIVER_WIDTH / 2, 0.4, 600)));
      bedBody.position.copy(bed.position); world.addBody(bedBody);
      const waterTexture = createSurfaceTexture('water', RIVER_WIDTH - 1, 1200, 8);
      const water = new THREE.Mesh(
        new THREE.PlaneGeometry(RIVER_WIDTH - 1, 1200),
        new THREE.MeshStandardMaterial({ map: waterTexture, color: 0x187d91, roughness: 0.18, metalness: 0.18, transparent: true, opacity: 0.9 })
      );
      water.rotation.x = -Math.PI / 2; water.position.set(RIVER_X, RIVER_SURFACE_Y, 0); cityRoot.add(water);

      const bankOpenings = riverBridgeCenters.map((center) => [center - 12, center + 12]).concat([[232, 256]]).sort((a, b) => a[0] - b[0]);
      const bankSegments = [];
      let bankStart = -600;
      bankOpenings.forEach(([openingStart, openingEnd]) => {
        if (openingStart > bankStart) bankSegments.push([bankStart, openingStart]);
        bankStart = openingEnd;
      });
      if (bankStart < 600) bankSegments.push([bankStart, 600]);
      for (const side of [-1, 1]) {
        const bankX = RIVER_X + side * (RIVER_WIDTH / 2 + 1.2);
        bankSegments.forEach(([start, end]) => createBarrier(bankX, (start + end) / 2, 2.4, end - start, 10.5, -4.5, 0x777f82));
      }

      riverBridgeCenters.forEach((z) => {
        const bridge = new THREE.Mesh(new THREE.BoxGeometry(RIVER_WIDTH + 13, 0.7, 22), new THREE.MeshStandardMaterial({ map: textures.asphalt || null, color: 0x8b9294, roughness: 0.82 }));
        bridge.position.set(RIVER_X, 0.05, z); bridge.receiveShadow = true; cityRoot.add(bridge);
        const bridgeBody = new CANNON.Body({ mass: 0 });
        bridgeBody.addShape(new CANNON.Box(new CANNON.Vec3((RIVER_WIDTH + 13) / 2, 0.35, 11)));
        bridgeBody.position.copy(bridge.position); world.addBody(bridgeBody);
      });

      for (let step = 0; step < 18; step++) {
        const x = 155.5 + step;
        const y = -step * 0.52;
        const stair = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.55, 5.2), new THREE.MeshStandardMaterial({ map: textures.stoneLight || null, color: 0xb4b7b4, roughness: 0.9 }));
        stair.position.set(x, y - 0.26, 244); stair.receiveShadow = true; cityRoot.add(stair);
        const stairBody = new CANNON.Body({ mass: 0 });
        stairBody.addShape(new CANNON.Box(new CANNON.Vec3(0.525, 0.275, 2.6)));
        stairBody.position.copy(stair.position); world.addBody(stairBody);
      }
      const buoyMaterial = new THREE.MeshStandardMaterial({ color: 0xf05b46, roughness: 0.48, metalness: 0.08 });
      const buoyStripe = new THREE.MeshStandardMaterial({ color: 0xf5eee0, roughness: 0.6 });
      for (let i = 0; i < 8; i++) {
        const buoy = new THREE.Group();
        const float = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.48, 0.9, 12), buoyMaterial);
        float.position.y = 0.15; buoy.add(float);
        const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.39, 0.43, 0.2, 12), buoyStripe);
        stripe.position.y = 0.2; buoy.add(stripe);
        buoy.position.set(RIVER_X + (i % 2 ? 12 : -12), RIVER_SURFACE_Y, -490 + i * 140);
        cityRoot.add(buoy);
      }
      const logMaterial = new THREE.MeshStandardMaterial({ map: textures.woodFloor || null, color: 0x715039, roughness: 0.92 });
      for (let i = 0; i < 5; i++) {
        const log = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.28, 3.8, 9), logMaterial);
        log.rotation.x = Math.PI / 2; log.rotation.z = (i % 2 ? 0.12 : -0.08);
        log.position.set(RIVER_X + (i % 2 ? 5 : -5), RIVER_SURFACE_Y - 0.45, -420 + i * 190);
        cityRoot.add(log);
      }
      createBarrier(190, 232, 34, 1.5, 1.8, 0.9, 0x777f82);
      createBarrier(190, 256, 34, 1.5, 1.8, 0.9, 0x777f82);
    }

    function createAirport() {
      worldPlacement.reserve(-450, -450, 360, 150, 'airport', 0);
      const airport = new THREE.Group();
      airport.position.set(-450, 0, -450);
      cityRoot.add(airport);
      const runwayTexture = createSurfaceTexture('asphaltDark', 300, 44, 12) || createSurfaceTexture('asphalt', 300, 44, 12);
      const runwayMaterial = new THREE.MeshStandardMaterial({ map: runwayTexture, color: 0x555c60, roughness: 0.92 });
      const runway = new THREE.Mesh(new THREE.BoxGeometry(300, 0.12, 44), runwayMaterial);
      runway.position.set(0, 0.06, 0); runway.receiveShadow = true; airport.add(runway);
      asphaltAreas.push({ x: -450, z: -450, halfWidth: 150, halfDepth: 22 });
      const runwayBody = new CANNON.Body({ mass: 0 });
      runwayBody.addShape(new CANNON.Box(new CANNON.Vec3(150, 0.06, 22)));
      runwayBody.position.set(-450, 0.06, -450); world.addBody(runwayBody);
      const markingMaterial = new THREE.MeshStandardMaterial({ map: textures.crosswalkWhite || null, color: 0xe9eceb, roughness: 0.65 });
      for (let z = -16; z <= 16; z += 8) {
        const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.025, 0.65), markingMaterial);
        stripe.position.set(0, 0.14, z); airport.add(stripe);
      }
      const terminal = new THREE.Mesh(new THREE.BoxGeometry(58, 9, 22), new THREE.MeshStandardMaterial({ map: textures.stuccoWhite || null, color: 0xd5d7d4, roughness: 0.72 }));
      terminal.position.set(0, 4.5, 48); terminal.castShadow = true; airport.add(terminal);
      footprintBuildingAreas.push({ x: -450, z: -402, halfWidth: 29, halfDepth: 11 });
      const glassFront = new THREE.Mesh(new THREE.BoxGeometry(48, 5.6, 0.3), new THREE.MeshStandardMaterial({ map: textures.glassWindowBlue || null, color: 0x90bfd0, metalness: 0.32, roughness: 0.2 }));
      glassFront.position.set(0, 4.2, 36.8); airport.add(glassFront);

      const plane = new THREE.Group();
      plane.position.set(0, 3.2, -4);
      airport.add(plane);
      const fuselageMaterial = new THREE.MeshStandardMaterial({ color: 0xe6e8e6, metalness: 0.34, roughness: 0.34, side: THREE.DoubleSide });
      const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(2.25, 2.25, 42, 24, 1, true, 0, Math.PI), fuselageMaterial);
      fuselage.rotation.x = Math.PI / 2; fuselage.position.y = 2.1; plane.add(fuselage);
      const cabinFloor = new THREE.Mesh(new THREE.BoxGeometry(3.7, 0.24, 31), new THREE.MeshStandardMaterial({ color: 0x555b5d, roughness: 0.96 }));
      cabinFloor.position.set(0, 0.7, 0); plane.add(cabinFloor);
      const aisle = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.04, 28), new THREE.MeshStandardMaterial({ color: 0xaba18f, roughness: 0.95 }));
      aisle.position.set(0, 0.84, 0); plane.add(aisle);
      const seatMaterial = new THREE.MeshStandardMaterial({ color: 0x287a83, roughness: 0.74 });
      const seatBackMaterial = new THREE.MeshStandardMaterial({ color: 0x1b5a63, roughness: 0.78 });
      for (let row = 0; row < 8; row++) {
        const z = -12.25 + row * 3.5;
        for (const x of [-1.25, -0.55, 0.55, 1.25]) {
          const seat = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.22, 0.68), seatMaterial);
          seat.position.set(x, 1.18, z); plane.add(seat);
          const back = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.95, 0.16), seatBackMaterial);
          back.position.set(x, 1.72, z - 0.24); plane.add(back);
        }
      }
      for (const side of [-1, 1]) {
        for (let row = 0; row < 9; row++) {
          const window = new THREE.Mesh(new THREE.CircleGeometry(0.25, 16), new THREE.MeshStandardMaterial({ color: 0x66a9c3, metalness: 0.45, roughness: 0.18 }));
          window.position.set(side * 2.12, 2.3, -15 + row * 3.5); window.rotation.y = side * Math.PI / 2; plane.add(window);
        }
      }
      const wing = new THREE.Mesh(new THREE.BoxGeometry(52, 0.6, 7), new THREE.MeshStandardMaterial({ color: 0xd4d8d7, metalness: 0.38, roughness: 0.4 }));
      wing.position.set(0, 1.25, 0); plane.add(wing);
      const tail = new THREE.Mesh(new THREE.BoxGeometry(16, 0.45, 3.2), fuselageMaterial);
      tail.position.set(0, 3.2, -18); plane.add(tail);
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.55, 6, 5), fuselageMaterial);
      fin.position.set(0, 4.4, -18); plane.add(fin);
      airportPlaneTemplate.add(plane.clone(true));
      for (const side of [-1, 1]) {
        const engine = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 4.5, 16), new THREE.MeshStandardMaterial({ color: 0x737b7d, metalness: 0.7, roughness: 0.3 }));
        engine.rotation.x = Math.PI / 2; engine.position.set(side * 11, 0.15, 4); plane.add(engine);
      }
      for (const wheelZ of [-12, 9]) {
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.24, 16), new THREE.MeshStandardMaterial({ color: 0x202629, roughness: 0.9 }));
        wheel.rotation.z = Math.PI / 2; wheel.position.set(0, 0.3, wheelZ); plane.add(wheel);
      }
      airplanes.push({ mesh: plane, parked: true, ai: false, mass: 8200, speed: 0, heading: 0, pitch: 0, verticalSpeed: 0, health: 1000 });
      [
        { centerX: 0, centerZ: 0, radius: 285, phase: -0.42 },
        { centerX: 40, centerZ: 0, radius: 330, phase: 2.25 }
      ].forEach((route) => {
        const mesh = plane.clone(true);
        mesh.position.set(route.centerX + Math.sin(route.phase) * route.radius, 132, route.centerZ + Math.cos(route.phase) * route.radius);
        mesh.rotation.y = route.phase + Math.PI / 2;
        mesh.scale.setScalar(0.72);
        scene.add(mesh);
        const driver = createSeatedDriver(mesh, 0, 0.15, 14, 0.42);
        airplanes.push({ mesh, driver, parked: false, ai: true, mass: 8200, speed: 38, heading: route.phase + Math.PI / 2, pitch: 0, verticalSpeed: 0, health: 1000, phase: route.phase, centerX: route.centerX, centerZ: route.centerZ, radius: route.radius, cruiseAltitude: 132 });
      });
      const fenceMaterial = new THREE.MeshStandardMaterial({ color: 0xd4dad8, metalness: 0.72, roughness: 0.34 });
      for (let x = -140; x <= 140; x += 20) {
        const light = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.18, 7, 8), fenceMaterial);
        light.position.set(x, 3.5, -25); airport.add(light);
      }
      createBreakableBarrierLine(-450, -475, 300, 1.2, 1.4, 0.7, 0x969d9e);
      createBreakableBarrierLine(-537, -425, 126, 1.2, 1.4, 0.7, 0x969d9e);
      createBreakableBarrierLine(-363, -425, 126, 1.2, 1.4, 0.7, 0x969d9e);
      createBreakableBarrierLine(-600, -450, 1.2, 50, 1.4, 0.7, 0x969d9e);
      createBreakableBarrierLine(-300, -450, 1.2, 50, 1.4, 0.7, 0x969d9e);
      createRoad(-450, -375, 18, 190);
    }

    function createPlaneField() {
      const field = new THREE.Group();
      field.position.set(420, 0, -430);
      cityRoot.add(field);

      const pad = new THREE.Mesh(
        new THREE.BoxGeometry(150, 0.14, 70),
        new THREE.MeshStandardMaterial({ map: textures.asphaltDark || textures.asphalt || null, color: 0x4f5960, roughness: 0.92 })
      );
      pad.position.set(0, 0.07, 0); pad.receiveShadow = true; field.add(pad);

      const strip = new THREE.Mesh(
        new THREE.BoxGeometry(110, 0.08, 18),
        new THREE.MeshStandardMaterial({ map: textures.asphaltDark || textures.asphalt || null, color: 0x5a646a, roughness: 0.92 })
      );
      strip.position.set(0, 0.12, 0); field.add(strip);

      const lineMaterial = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.5 });
      for (let x = -44; x <= 44; x += 12) {
        const line = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.04, 0.8), lineMaterial);
        line.position.set(x, 0.18, 0); field.add(line);
      }

      const markerMaterial = new THREE.MeshStandardMaterial({ color: 0xdbeafe, roughness: 0.7 });
      for (const x of [-40, 0, 40]) {
        const marker = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 1.6, 10), markerMaterial);
        marker.position.set(x, 0.9, -16); field.add(marker);
      }

      const parkedPlaneTemplate = airportPlaneTemplate.children[0];
      const planePositions = [-40, 0, 40];
      planePositions.forEach((x, index) => {
        const planeMesh = parkedPlaneTemplate ? parkedPlaneTemplate.clone(true) : new THREE.Group();
        planeMesh.position.set(x, 2.8, 0);
        planeMesh.rotation.y = index % 2 === 0 ? Math.PI * 0.06 : -Math.PI * 0.06;
        planeMesh.scale.setScalar(0.72);
        field.add(planeMesh);
        airplanes.push({ mesh: planeMesh, parked: true, ai: false, mass: 8200, speed: 0, heading: planeMesh.rotation.y, pitch: 0, verticalSpeed: 0, health: 1000 });
      });

      const fenceColor = 0xcfd8dd;
      const fenceMaterial = new THREE.MeshStandardMaterial({ color: fenceColor, metalness: 0.72, roughness: 0.34 });
      for (let i = -1; i <= 1; i++) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.2, 8, 8), fenceMaterial);
        post.position.set(-60 + i * 60, 4, -28); field.add(post);
        const post2 = post.clone(); post2.position.z = 28; field.add(post2);
      }
      for (let z = -20; z <= 20; z += 10) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(120, 0.2, 0.18), fenceMaterial);
        rail.position.set(0, 4.5, z - 28); field.add(rail);
        const rail2 = rail.clone(); rail2.position.z = -rail.position.z; field.add(rail2);
      }
    }

    function spawnAirportPlane() {
      if (!gameStarted || !menu.classList.contains('hidden')) return false;
      const nearAirport = Math.hypot(playerState.position.x + 450, playerState.position.z + 450) < 110;
      if (!nearAirport) {
        showMessage('Move to the airport to spawn a plane.');
        return false;
      }
      const now = performance.now();
      if (now - lastAirportPlaneSpawn < PLANE_SPAWN_INTERVAL) {
        showMessage('A plane can spawn again in 3 seconds.');
        return false;
      }
      const spawnXOptions = [-120, -60, 0, 60, 120];
      const spawnY = 3.2;
      const spawnZ = -4;
      const availableSlot = spawnXOptions.find((x) => !airplanes.some((aircraft) => {
        const position = aircraft.mesh.position;
        return Math.hypot(position.x - (-450 + x), position.z - (-450 + spawnZ)) < 34;
      }));
      if (availableSlot === undefined) {
        showMessage('No airport runway slots are available.');
        return false;
      }
      const mesh = airportPlaneTemplate.children[0].clone(true);
      mesh.position.set(-450 + availableSlot, spawnY, -450 + spawnZ);
      mesh.rotation.y = 0;
      mesh.rotation.x = 0;
      mesh.rotation.z = 0;
      scene.add(mesh);
      airplanes.push({ mesh, parked: true, ai: false, mass: 8200, speed: 0, heading: 0, pitch: 0, verticalSpeed: 0, health: 1000 });
      lastAirportPlaneSpawn = now;
      showMessage('Airport plane spawned. Click it to board.');
      return true;
    }

    function boardAirplane(aircraft) {
      if (!aircraft || !aircraft.mesh || aircraft.crashed || controlledVehicle || controlledBoat) return false;
      aircraft.mesh.updateMatrixWorld(true);
      const worldPosition = aircraft.mesh.getWorldPosition(new THREE.Vector3());
      if (!Number.isFinite(worldPosition.x) || !Number.isFinite(worldPosition.y) || !Number.isFinite(worldPosition.z)) return false;
      const distance = Math.hypot(playerState.position.x - worldPosition.x, playerState.position.z - worldPosition.z);
      const boardingDistance = aircraft.parked ? 60 : 54;
      if (distance > boardingDistance) return false;
      if (aircraft.ai && aircraft.driver) ejectAirplaneDriver(aircraft);
      aircraft.ai = false;
      scene.attach(aircraft.mesh);
      aircraft.parked = false;
      aircraft.heading = Number.isFinite(aircraft.heading) ? aircraft.heading : aircraft.mesh.rotation.y;
      aircraft.mesh.rotation.y = aircraft.heading;
      controlledAirplane = aircraft;
      playerState.airplane = aircraft;
      playerState.onGround = false;
      playerState.seatedOn = aircraft;
      setSafePlayerPosition(worldPosition.x, worldPosition.y + 1.8, worldPosition.z);
      playerState.yaw = aircraft.heading;
      clearVehicleKeys();
      syncActiveMode();
      showMessage('Plane boarded. Arrow keys steer; up accelerates; Q exits.');
      return true;
    }

    function placePlayerAtWreckage(x, z, yaw) {
      const groundY = groundHeightAt(x, z) + 1.7;
      setSafePlayerPosition(x, groundY, z);
      playerState.velocity.set(0, 0, 0);
      playerState.yaw = yaw;
      playerState.onGround = true;
      playerState.inRiver = isRiverPosition(x, z);
      playerState.airplane = null;
      playerState.seatedOn = null;
      playerState.seatedOffset = null;
      playerState.boat = null;
      playerState.riverJumpBoost = 0;
      playerState.pointerLocked = false;
    }

    function leaveAirplane(atWreckage = false) {
      if (!controlledAirplane) return;
      const aircraft = controlledAirplane;
      if (atWreckage) {
        placePlayerAtWreckage(aircraft.mesh.position.x, aircraft.mesh.position.z, aircraft.heading);
      } else {
        playerState.position.set(aircraft.mesh.position.x + Math.sin(aircraft.heading) * 3.5, aircraft.mesh.position.y + 1.8, aircraft.mesh.position.z + Math.cos(aircraft.heading) * 3.5);
        playerState.velocity.set(0, -2.5, 0);
        playerState.yaw = aircraft.heading;
        playerState.airplane = null;
        playerState.seatedOn = null;
        playerState.seatedOffset = null;
      }
      controlledAirplane = null;
      clearVehicleKeys();
      syncActiveMode();
      if (!atWreckage) playerState.onGround = false;
      showMessage(atWreckage ? 'Aircraft wrecked. You are at the crash site.' : 'Shifted out of the plane.');
    }

    function updateAirplanes(dt) {
      const now = performance.now() / 1000;
      airplanes.forEach((aircraft) => {
        if (aircraft.parked || aircraft.crashed) return;
        if (aircraft.ai) {
          aircraft.phase += aircraft.speed / aircraft.radius * dt;
          aircraft.heading = aircraft.phase + Math.PI / 2;
          aircraft.mesh.position.set(
            aircraft.centerX + Math.sin(aircraft.phase) * aircraft.radius,
            aircraft.cruiseAltitude + Math.sin(now * 0.22 + aircraft.phase) * 4,
            aircraft.centerZ + Math.cos(aircraft.phase) * aircraft.radius
          );
        } else if (controlledAirplane === aircraft) {
          const turn = (driveKeys.right ? 1 : 0) - (driveKeys.left ? 1 : 0);
          const throttle = (driveKeys.forward ? 1 : 0) - (driveKeys.backward ? 1 : 0);
          const climb = (driveKeys.up ? 1 : 0) - (driveKeys.down ? 1 : 0);
          aircraft.speed = THREE.MathUtils.clamp(aircraft.speed + throttle * 18 * dt, 0, 62);
          aircraft.heading += turn * (0.35 + aircraft.speed * 0.008) * dt;
          aircraft.pitch = THREE.MathUtils.clamp(aircraft.pitch + (throttle * 0.3 + climb * 0.6) * dt, -0.3, 0.7);
          if (!throttle && !climb) aircraft.pitch *= 0.985;
          aircraft.verticalSpeed += (Math.sin(aircraft.pitch) * aircraft.speed + Math.max(0, aircraft.speed - 18) * 0.024 - 1.1) * dt;
          aircraft.verticalSpeed = THREE.MathUtils.clamp(aircraft.verticalSpeed, -12, 16);
          aircraft.mesh.position.x += Math.sin(aircraft.heading) * aircraft.speed * dt;
          aircraft.mesh.position.z += Math.cos(aircraft.heading) * aircraft.speed * dt;
          aircraft.mesh.position.y = THREE.MathUtils.clamp(aircraft.mesh.position.y + aircraft.verticalSpeed * dt, 3.2, 180);
          aircraft.mesh.rotation.x = aircraft.pitch;
          aircraft.mesh.rotation.z = -turn * 0.42;
          playerState.position.set(aircraft.mesh.position.x, aircraft.mesh.position.y + 2, aircraft.mesh.position.z);
          playerState.yaw = aircraft.heading;
        }
        aircraft.mesh.rotation.y = aircraft.heading;
        const hitBuilding = buildingColliders.find((box) =>
          !box.collapsing && aircraft.mesh.position.y < box.height + 18 &&
          Math.abs(aircraft.mesh.position.x - box.x) < box.sizeX / 2 + 22 &&
          Math.abs(aircraft.mesh.position.z - box.z) < box.sizeZ / 2 + 20
        );
        if (hitBuilding && gameSettings.planeDespawn) {
          let impactScore = 0;
          if (gameSettings.destruction) {
            const rating = rateCollision(aircraft.mass, Math.max(aircraft.speed, Math.abs(aircraft.verticalSpeed)), hitBuilding.impactResistance, 0.96);
            impactScore = rating.score;
            hitBuilding.health -= rating.score * 0.12;
            if (rating.destroys || hitBuilding.health <= 0) collapseBuilding(hitBuilding, aircraft.mesh.position.x < hitBuilding.x ? -1 : 1, true, aircraft.speed);
          }
          const wasControlled = controlledAirplane === aircraft;
          aircraft.crashed = true;
          if (wasControlled) leaveAirplane(true);
          aircraft.mesh.updateMatrixWorld(true);
          scene.attach(aircraft.mesh);
          aircraft.mesh.visible = true;
          aircraft.mesh.rotation.x += 0.35;
          aircraft.mesh.rotation.z += (Math.random() - 0.5) * 0.45;
          const wreckBody = new CANNON.Body({ mass: 420, material: new CANNON.Material('aircraft-wreckage') });
          wreckBody.addShape(new CANNON.Box(new CANNON.Vec3(8, 2, 22)));
          wreckBody.position.set(aircraft.mesh.position.x, aircraft.mesh.position.y, aircraft.mesh.position.z);
          wreckBody.quaternion.setFromEuler(aircraft.mesh.rotation.x, aircraft.mesh.rotation.y, aircraft.mesh.rotation.z);
          wreckBody.linearDamping = 0.22;
          wreckBody.angularDamping = 0.48;
          wreckBody.velocity.set(
            Math.sin(aircraft.heading) * Math.min(aircraft.speed * 0.22, 12),
            Math.max(-3, aircraft.verticalSpeed * 0.25),
            Math.cos(aircraft.heading) * Math.min(aircraft.speed * 0.22, 12)
          );
          world.addBody(wreckBody);
          debrisPieces.push({
            mesh: aircraft.mesh,
            body: wreckBody,
            width: 16,
            depth: 44,
            cleared: false,
            createdAt: performance.now(),
            lifetime: 60000,
            kind: 'aircraft'
          });
          createWreckageEvent(aircraft.mesh.position.x, aircraft.mesh.position.z, 'aircraft', true);
          if (!wasControlled) showMessage('Aircraft impact. Structural damage score: ' + Math.round(impactScore));
        }
      });
    }

    function createRoad(x, z, width, depth) {
      if (depth > width && Math.abs(x - RIVER_X) < width / 2 + RIVER_WIDTH / 2 + WATERWAY_KEEP_OUT) {
        x = x < RIVER_X
          ? RIVER_X - RIVER_WIDTH / 2 - WATERWAY_KEEP_OUT - width / 2
          : RIVER_X + RIVER_WIDTH / 2 + WATERWAY_KEEP_OUT + width / 2;
      }
      const roadStartX = x - width / 2;
      const roadEndX = x + width / 2;
      const riverStartX = RIVER_X - RIVER_WIDTH / 2 - WATERWAY_KEEP_OUT;
      const riverEndX = RIVER_X + RIVER_WIDTH / 2 + WATERWAY_KEEP_OUT;
      const crossesRiver = width > depth && roadStartX < riverEndX && roadEndX > riverStartX;
      const hasBridge = riverBridgeCenters.some((center) => Math.abs(z - center) <= depth / 2 + 11);
      let roadSegments = [{ x, width }];
      if (crossesRiver && !hasBridge) {
        roadSegments = [
          { x: (roadStartX + Math.min(roadEndX, riverStartX)) / 2, width: Math.max(0, Math.min(roadEndX, riverStartX) - roadStartX) },
          { x: (Math.max(roadStartX, riverEndX) + roadEndX) / 2, width: Math.max(0, roadEndX - Math.max(roadStartX, riverEndX)) }
        ].filter((segment) => segment.width > 0.1);
      }
      roadSegments.forEach((segment) => {
        if (width > depth) roadAxisXValues.add(segment.x); else roadAxisZValues.add(z);
        if (width > depth) roadAxisXValues.add(segment.x); else roadAxisZValues.add(z);
        worldPlacement.reserve(segment.x, z, segment.width, depth, 'road', 0);
        asphaltAreas.push({ x: segment.x, z, halfWidth: segment.width / 2, halfDepth: depth / 2 });
        const asphaltTexture = createSurfaceTexture('asphalt', segment.width, depth, 12) || makeProceduralGroundTexture('#4b5563', '#2b3440');
        const road = new THREE.Mesh(new THREE.BoxGeometry(segment.width, 0.08, depth), new THREE.MeshStandardMaterial(withTexture(asphaltTexture, { color: 0xffffff, roughness: 0.9 })));
        road.position.set(segment.x, 0.04, z); road.receiveShadow = true; cityRoot.add(road);
        const roadBody = new CANNON.Body({ mass: 0 });
        roadBody.addShape(new CANNON.Box(new CANNON.Vec3(segment.width / 2, 0.04, depth / 2)));
        roadBody.position.set(segment.x, 0.04, z); world.addBody(roadBody); solids.push({ mesh: road, body: roadBody });
      });
      const laneMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.4 });
      const halfWidth = Math.max(width, depth) / 2;
      for (let offset = -halfWidth + 8; offset < halfWidth; offset += 14) {
        const dash = new THREE.Mesh(new THREE.BoxGeometry(width > depth ? 7 : 1.2, 0.02, width > depth ? 1.2 : 7), laneMat);
        if (width > depth) dash.position.set(x + offset, 0.11, z); else dash.position.set(x, 0.11, z + offset);
        if (crossesRiver && !hasBridge && width > depth && Math.abs(dash.position.x - RIVER_X) < RIVER_WIDTH / 2 + WATERWAY_KEEP_OUT + 3) continue;
        cityRoot.add(dash);
      }
      const edgeOffset = width > depth ? width / 2 + 1.8 : depth / 2 + 1.8;
      const axisPoints = width > depth
        ? Array.from({ length: Math.max(3, Math.floor(width / 12) + 1) }, (_, i) => {
            const step = -width / 2 + 10 + i * 12;
            return [x + step, z + edgeOffset];
          }).concat(Array.from({ length: Math.max(3, Math.floor(width / 12) + 1) }, (_, i) => {
            const step = -width / 2 + 10 + i * 12;
            return [x + step, z - edgeOffset];
          }))
        : Array.from({ length: Math.max(3, Math.floor(depth / 12) + 1) }, (_, i) => {
            const step = -depth / 2 + 10 + i * 12;
            return [x + edgeOffset, z + step];
          }).concat(Array.from({ length: Math.max(3, Math.floor(depth / 12) + 1) }, (_, i) => {
            const step = -depth / 2 + 10 + i * 12;
            return [x - edgeOffset, z + step];
          }));
      axisPoints.forEach(([px, pz]) => {
        if (crossesRiver && !hasBridge && Math.abs(px - RIVER_X) < RIVER_WIDTH / 2 + WATERWAY_KEEP_OUT + 2) return;
        sidewalkTargets.push(new THREE.Vector3(px, 0, pz));
        pedestrianSpawnPoints.push(new THREE.Vector3(px, 0, pz));
      });
    }

    function registerSidewalkArea(x, z, width, depth) {
      sidewalkAreas.push({ x, z, halfWidth: width / 2, halfDepth: depth / 2 });
    }

    function createSidewalk(x, z, width, depth) {
      if (overlapsRiverKeepOut(x, z, width, depth)) return;
      registerSidewalkArea(x, z, width, depth);
      const sidewalkTexture = createSurfaceTexture('sidewalk', width, depth, 8);
      const sidewalk = new THREE.Mesh(new THREE.BoxGeometry(width, 0.12, depth), new THREE.MeshStandardMaterial({ map: sidewalkTexture, color: 0xd9dde2, roughness: 0.95 }));
      sidewalk.position.set(x, 0.06, z); sidewalk.receiveShadow = true; cityRoot.add(sidewalk); sidewalkTargets.push(new THREE.Vector3(x, 0, z));
    }

    function createParkingBay(x, z, orientation = 'horizontal') {
      const width = orientation === 'horizontal' ? 4.8 : 2.5;
      const depth = orientation === 'horizontal' ? 2.5 : 4.8;
      if (overlapsRiverKeepOut(x, z, width, depth)) return;
      const bay = new THREE.Mesh(new THREE.BoxGeometry(width, 0.06, depth), new THREE.MeshStandardMaterial({ color: 0xdfe7ef, roughness: 0.9 }));
      bay.position.set(x, 0.08, z); cityRoot.add(bay);
    }

    function addTree(x, z, scale = 1.2) {
      const placement = worldPlacement.reserveNearest(x, z, scale * 2.8, scale * 2.8, 'tree', 0.35);
      if (!placement) return null;
      x = placement.x;
      z = placement.z;
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22 * scale, 0.30 * scale, 2.4 * scale, 12), new THREE.MeshStandardMaterial({ color: 0x7c4a27, roughness: 1 }));
      trunk.position.y = 1.2 * scale; trunk.castShadow = true;
      const g = new THREE.Group();
      g.add(trunk);
      if (!webOptimizer.lowLag) {
        const leafMaterial = new THREE.MeshStandardMaterial({ color: 0x4caf50, roughness: 0.85 });
        const leafOffsets = [
          [0, 2.9 * scale, 0],
          [0.95 * scale, 2.5 * scale, 0.4 * scale],
          [-0.8 * scale, 2.7 * scale, 0.6 * scale],
          [0.7 * scale, 2.2 * scale, -0.9 * scale],
          [-1.1 * scale, 2.3 * scale, -0.3 * scale],
          [0.2 * scale, 3.2 * scale, 0.1 * scale]
        ];
        leafOffsets.forEach(([lx, ly, lz], index) => {
          const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.72 * scale + (index % 2) * 0.12, 16, 16), leafMaterial);
          leaf.position.set(lx, ly, lz);
          leaf.scale.set(1.15, 1.0, 1.15);
          leaf.castShadow = true;
          leaf.receiveShadow = true;
          g.add(leaf);
        });
      }
      g.position.set(x, 0, z); cityRoot.add(g);
      destructibleProps.push({ mesh: g, trunk, leaves: webOptimizer.lowLag ? null : g.children.filter((child) => child !== trunk), x, z, scale, radius: 1.5 * scale, health: 24, destroyed: false, outcome: null });
    }

    function createStopSign(x, z, rotationY = 0) {
      const group = new THREE.Group();
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.2, 10), new THREE.MeshStandardMaterial({ color: 0x9ca3af, metalness: 0.72, roughness: 0.45 }));
      pole.position.y = 1.1;
      const sign = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.12, 8), new THREE.MeshStandardMaterial({ color: 0xe11d48, roughness: 0.5, metalness: 0.18 }));
      sign.position.y = 2.05;
      sign.rotation.x = Math.PI / 2;
      sign.rotation.z = Math.PI / 8;
      group.add(pole, sign);
      if (!webOptimizer.lowLag) {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#d11d2a';
        ctx.font = 'bold 76px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('STOP', canvas.width / 2, canvas.height / 2 + 2);
        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;
        const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }));
        label.scale.set(1.1, 0.55, 1);
        label.position.set(0, 2.05, 0.08);
        group.add(label);
      }
      group.position.set(x, 0, z);
      group.rotation.y = rotationY;
      cityRoot.add(group);
      return group;
    }

    function createTrafficLight(x, z, rotationY = 0) {
      const group = new THREE.Group();
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.8, 10), new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.8, roughness: 0.4 }));
      pole.position.y = 1.4;
      const housing = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.9, 0.22), new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.62 }));
      housing.position.y = 2.7;
      housing.rotation.y = Math.PI / 2;
      group.add(pole, housing);
      const lights = [
        { color: 0xff3d3d, y: 2.9 },
        { color: 0xffc642, y: 2.55 },
        { color: 0x39d353, y: 2.2 }
      ].map(({ color, y }) => {
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 12), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.9 }));
        bulb.position.set(0.11, y, 0.03);
        housing.add(bulb);
        return bulb;
      });
      group.position.set(x, 0, z);
      group.rotation.y = rotationY;
      cityRoot.add(group);
      return { group, lights };
    }

    function createIntersectionSignage() {
      const roadXValues = Array.from(roadAxisXValues).sort((a, b) => a - b);
      const roadZValues = Array.from(roadAxisZValues).sort((a, b) => a - b);
      roadXValues.forEach((x) => {
        roadZValues.forEach((z) => {
          if (Math.abs(x) > 560 || Math.abs(z) > 560) return;
          if (Math.abs(x - RIVER_X) < 18 && Math.abs(z) < 600) return;
          const stopRotation = Math.random() < 0.5 ? 0 : Math.PI / 2;
          createStopSign(x, z, stopRotation);
          if (gameSettings.trafficLights && Math.random() < 0.7) createTrafficLight(x, z, stopRotation);
        });
      });
    }
    function collapseTreeIntoBits(prop, car) {
      prop.destroyed = true;
      const origin = prop.mesh.position.clone();
      cityRoot.remove(prop.mesh);
      const fallbackLeafMaterial = prop.leaves && prop.leaves.length ? prop.leaves[0].material : prop.trunk.material;
      for (let index = 0; index < 12; index++) {
        const isLeaf = index >= 7;
        const size = isLeaf ? 0.24 + Math.random() * 0.3 : 0.16 + Math.random() * 0.18;
        const mesh = new THREE.Mesh(
          new THREE.BoxGeometry(size, size * (isLeaf ? 0.75 : 1.8), size),
          isLeaf ? (prop.leaves && prop.leaves.length ? prop.leaves[0].material : prop.trunk.material) : prop.trunk.material
        );
        mesh.position.set(
          origin.x + (Math.random() - 0.5) * prop.scale * 2.2,
          0.6 + Math.random() * prop.scale * 2,
          origin.z + (Math.random() - 0.5) * prop.scale * 2.2
        );
        mesh.rotation.set(Math.random(), Math.random() * Math.PI, Math.random());
        scene.add(mesh);
        if (vehicleDebris.length >= 80) scene.remove(vehicleDebris.shift().mesh);
        vehicleDebris.push({
          mesh,
          velocity: new THREE.Vector3((Math.random() - 0.5) * 8, 2 + Math.random() * 5, (Math.random() - 0.5) * 8),
          createdAt: performance.now()
        });
      }
      const now = performance.now();
      car.smokingUntil = now + 6500;
      createCrashSmoke(car, now, 6500);
    }

    function resolveTreeImpact(prop, car, impact, roll = Math.random()) {
      if (!prop || prop.destroyed || prop.outcome || impact <= 5) return;
      if (roll < 0.8) {
        prop.outcome = 'lean';
        const offsetX = car.body.position.x - prop.x;
        const offsetZ = car.body.position.z - prop.z;
        const axis = Math.abs(offsetX) > Math.abs(offsetZ) ? 'z' : 'x';
        const side = axis === 'z' ? Math.sign(offsetX || 1) : -Math.sign(offsetZ || 1);
        const from = prop.mesh.rotation[axis];
        const to = side * THREE.MathUtils.degToRad(20);
        const startedAt = performance.now();
        const animateLean = () => {
          const progress = Math.min((performance.now() - startedAt) / 420, 1);
          const eased = progress * progress * (3 - 2 * progress);
          prop.mesh.rotation[axis] = THREE.MathUtils.lerp(from, to, eased);
          if (progress < 1) requestAnimationFrame(animateLean);
        };
        requestAnimationFrame(animateLean);
      } else {
        prop.outcome = 'collapse';
        collapseTreeIntoBits(prop, car);
      }
    }

    function addBench(x, z, rot = 0) {
      const placement = worldPlacement.reserveNearest(x, z, 2.4, 2.4, 'bench', 0.2);
      if (!placement) return null;
      x = placement.x;
      z = placement.z;
      const bench = new THREE.Group();
      const wood = new THREE.MeshStandardMaterial({ color: 0x8b5e3c, roughness: 0.82 });
      const metal = new THREE.MeshStandardMaterial({ color: 0x4b5563, metalness: 0.8, roughness: 0.28 });
      const seat = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.12, 0.42), wood); seat.position.y = 0.55; bench.add(seat);
      const back = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.52, 0.1), wood); back.position.set(0, 0.8, -0.15); bench.add(back);
      for (const px of [-0.75, 0.75]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.55, 0.1), metal); leg.position.set(px, 0.25, 0.1); bench.add(leg); }
      bench.position.set(x, 0, z); bench.rotation.y = rot; cityRoot.add(bench);
      benchSeats.push({ x, z, rot, group: bench });
    }

    function addFountain() {
      const group = new THREE.Group();
      const base = new THREE.Mesh(new THREE.CylinderGeometry(5.5, 6.2, 1.4, 32), new THREE.MeshStandardMaterial({ map: textures.plaza || null, color: 0xc8beaf, roughness: 0.88 }));
      base.position.y = 0.7; base.receiveShadow = true; group.add(base);
      const rim = new THREE.Mesh(new THREE.CylinderGeometry(4.4, 4.8, 0.8, 32), new THREE.MeshStandardMaterial({ color: 0xd4c5b0, roughness: 0.7 })); rim.position.y = 1.7; group.add(rim);
      const pool = new THREE.Mesh(new THREE.CylinderGeometry(3.9, 4.2, 0.8, 32), new THREE.MeshStandardMaterial({ map: textures.water || null, color: 0x6abad6, transparent: true, opacity: 0.92 })); pool.position.y = 2.2; group.add(pool);
      const monument = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, 4.5, 18), new THREE.MeshStandardMaterial({ color: 0xf0ead2, roughness: 0.6, metalness: 0.2 })); monument.position.y = 4.7; group.add(monument);
      const top = new THREE.Mesh(new THREE.SphereGeometry(0.8, 18, 18), new THREE.MeshStandardMaterial({ color: 0xf7d15d, emissive: 0x5e4a00, emissiveIntensity: 0.3 })); top.position.y = 7.6; group.add(top);
      group.position.set(0, 0, 0); cityRoot.add(group);
    }

    function addPlaza() {
      const plaza = new THREE.Mesh(new THREE.BoxGeometry(50, 0.16, 50), new THREE.MeshStandardMaterial({ map: textures.plaza || null, color: 0xd6d0c5, roughness: 0.92 })); plaza.position.set(0, 0.08, 0); plaza.receiveShadow = true; cityRoot.add(plaza);
      const bigPad = new THREE.Mesh(new THREE.BoxGeometry(55, 0.35, 55), new THREE.MeshStandardMaterial({ color: 0x7f8d8e, roughness: 0.9 })); bigPad.position.set(0, -0.18, 0); cityRoot.add(bigPad);
      addFountain();
      for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2; const x = Math.cos(angle) * 17; const z = Math.sin(angle) * 17; addBench(x, z, angle + Math.PI / 2);
      }
    }

    function addStreetMarkings() {
      const dashMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.55 });
      const crosswalkMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.5 });
      const roads = [
        { x: 0, z: 0, w: 200, d: 12 }, { x: 0, z: 52, w: 200, d: 12 }, { x: 0, z: -52, w: 200, d: 12 },
        { x: 66, z: 0, w: 12, d: 200 }, { x: -66, z: 0, w: 12, d: 200 }, { x: 0, z: 120, w: 220, d: 10 }, { x: 0, z: -120, w: 220, d: 10 }
      ];
      roads.forEach((road) => {
        const laneLength = road.w > road.d ? road.w : road.d;
        for (let offset = -laneLength / 2 + 8; offset < laneLength / 2; offset += 14) {
          const dash = new THREE.Mesh(new THREE.BoxGeometry(road.w > road.d ? 7 : 1.2, 0.02, road.w > road.d ? 1.2 : 7), dashMat);
          if (road.w > road.d) dash.position.set(road.x + offset, 0.11, road.z); else dash.position.set(road.x, 0.11, road.z + offset);
          cityRoot.add(dash);
        }
      });
      for (let i = -2; i <= 2; i++) {
        const z = i * 26;
        const cross1 = new THREE.Mesh(new THREE.BoxGeometry(10, 0.02, 1.4), crosswalkMat); cross1.position.set(0, 0.11, z + 7); cityRoot.add(cross1);
        const cross2 = new THREE.Mesh(new THREE.BoxGeometry(10, 0.02, 1.4), crosswalkMat); cross2.position.set(0, 0.11, z - 7); cityRoot.add(cross2);
      }
      for (let px = -84; px <= 84; px += 18) {
        for (let pz = -100; pz <= 100; pz += 24) {
          createParkingBay(px + 2, pz, 'horizontal');
          createParkingBay(px + 2, pz + 12, 'horizontal');
        }
      }
    }

    function createBuilding(x, z, sizeX, sizeZ, floors, color, zone = 'office') {
      if (buildings.length >= cityGoals.targetBuildings) return null;
      sizeX *= 1.25;
      sizeZ *= 1.25;
      floors = Math.ceil(floors * 1.1);
      const placement = worldPlacement.reserveNearest(x, z, sizeX, sizeZ, 'building', 1.2);
      if (!placement) return null;
      x = placement.x;
      z = placement.z;
      const towerHeight = Math.max(8, (floors * 3.1 + 2) * 1.12);
      const building = new THREE.Group(); building.position.set(x, 0, z);
      const palette = {
        commercial: { base: 0x2a3343, roof: 0x9ca3af, trim: 0xdfe7ef, facade: textures.brickRed || textures.concreteGrey || textures.plasterGrey, accent: textures.windowGrid || textures.glassWindowBlue },
        office: { base: 0x4a5d75, roof: 0xb7b3a6, trim: 0xf0f4f7, facade: textures.concreteGrey || textures.plasterGrey || textures.stuccoWhite, accent: textures.windowGrid || textures.glassWindowBlue },
        residential: { base: 0x8a6f5d, roof: 0xc7b39b, trim: 0xf3efe8, facade: textures.stuccoWhite || textures.plasterGrey || textures.brickRed, accent: textures.windowGrid || textures.glassWindowBlue }
      };
      const p = palette[zone] || palette.office;
      const entranceWidth = Math.min(sizeX * 0.32, 6.5);
      const podium = new THREE.Group();
      const podiumMaterial = new THREE.MeshStandardMaterial({ map: textures.plasterGrey || null, color: p.base, roughness: 0.9 });
      const podiumHeight = 0.9;
      const frontWidth = (sizeX - entranceWidth) / 2;
      const baseFloor = new THREE.Mesh(new THREE.BoxGeometry(sizeX, 0.16, sizeZ), podiumMaterial);
      baseFloor.position.y = 0.08; podium.add(baseFloor);
      const frontLeft = new THREE.Mesh(new THREE.BoxGeometry(frontWidth, podiumHeight, 0.2), podiumMaterial);
      frontLeft.position.set(-(entranceWidth + frontWidth) / 2, podiumHeight / 2 + 0.08, sizeZ / 2 - 0.1); podium.add(frontLeft);
      const frontRight = new THREE.Mesh(new THREE.BoxGeometry(frontWidth, podiumHeight, 0.2), podiumMaterial);
      frontRight.position.set((entranceWidth + frontWidth) / 2, podiumHeight / 2 + 0.08, sizeZ / 2 - 0.1); podium.add(frontRight);
      const baseBack = new THREE.Mesh(new THREE.BoxGeometry(sizeX, podiumHeight, 0.2), podiumMaterial);
      baseBack.position.set(0, podiumHeight / 2 + 0.08, -sizeZ / 2 + 0.1); podium.add(baseBack);
      for (const side of [-1, 1]) {
        const baseSide = new THREE.Mesh(new THREE.BoxGeometry(0.2, podiumHeight, sizeZ), podiumMaterial);
        baseSide.position.set(side * (sizeX / 2 - 0.1), podiumHeight / 2 + 0.08, 0); podium.add(baseSide);
      }
      podium.traverse((part) => { if (part.isMesh) { part.castShadow = true; part.receiveShadow = true; } });
      building.add(podium);

      const facadeTexture = p.facade || textures.concreteGrey || null;
      const towerMaterial = new THREE.MeshStandardMaterial(withTexture(facadeTexture, {
        color: 0xffffff,
        roughness: 0.82,
        metalness: 0.08
      }));
      if (towerMaterial.map) {
        towerMaterial.map.repeat.set(Math.max(1, sizeX / 6), Math.max(1, towerHeight / 6));
      }

      const towerShell = new THREE.Group();
      const shellHeight = towerHeight * 0.92;
      const shellCenterY = shellHeight * 0.5 + 0.8;
      const facadeDepth = 0.2;
      const frontZ = sizeZ / 2 - facadeDepth / 2;
      const doorwayHeight = 2.8;
      const headerHeight = shellHeight - doorwayHeight;
      const frontLeftWall = new THREE.Mesh(new THREE.BoxGeometry(frontWidth, shellHeight, facadeDepth), towerMaterial);
      frontLeftWall.position.set(-(entranceWidth + frontWidth) / 2, shellCenterY, frontZ); towerShell.add(frontLeftWall);
      const frontRightWall = new THREE.Mesh(new THREE.BoxGeometry(frontWidth, shellHeight, facadeDepth), towerMaterial);
      frontRightWall.position.set((entranceWidth + frontWidth) / 2, shellCenterY, frontZ); towerShell.add(frontRightWall);
      const entranceHeader = new THREE.Mesh(new THREE.BoxGeometry(entranceWidth, headerHeight, facadeDepth), towerMaterial);
      entranceHeader.position.set(0, 0.8 + doorwayHeight + headerHeight / 2, frontZ); towerShell.add(entranceHeader);
      const backWall = new THREE.Mesh(new THREE.BoxGeometry(sizeX, shellHeight, facadeDepth), towerMaterial);
      backWall.position.set(0, shellCenterY, -sizeZ / 2 + facadeDepth / 2); towerShell.add(backWall);
      for (const side of [-1, 1]) {
        const sideWall = new THREE.Mesh(new THREE.BoxGeometry(facadeDepth, shellHeight, sizeZ), towerMaterial);
        sideWall.position.set(side * (sizeX / 2 - facadeDepth / 2), shellCenterY, 0); towerShell.add(sideWall);
      }
      towerShell.traverse((part) => { if (part.isMesh) { part.castShadow = true; part.receiveShadow = true; } });
      const windowMaterial = new THREE.MeshStandardMaterial(withTexture(textures.glassWindowBlue || textures.windowGrid || null, { color: 0xa9d8ef, metalness: 0.35, roughness: 0.2, emissive: 0x18384a, emissiveIntensity: 0.14 }));
      const windowRows = Math.max(1, Math.floor(floors) - 1);
      const windowColumns = Math.max(2, Math.floor(sizeX / 2.4));
      const frontWindows = new THREE.InstancedMesh(
        new THREE.BoxGeometry(sizeX / windowColumns * 0.68, 1.55, 0.08),
        windowMaterial,
        windowRows * windowColumns
      );
      const sideWindows = new THREE.InstancedMesh(
        new THREE.BoxGeometry(0.08, 1.55, sizeZ * 0.62),
        windowMaterial,
        windowRows * 2
      );
      const windowTransform = new THREE.Object3D();
      let frontIndex = 0;
      let sideIndex = 0;
      for (let row = 0; row < windowRows; row++) {
        const windowY = 5.2 + row * 3.1;
        for (let column = 0; column < windowColumns; column++) {
          const windowX = -sizeX / 2 + (column + 0.5) * sizeX / windowColumns;
          windowTransform.position.set(windowX, windowY, sizeZ / 2 + 0.06);
          windowTransform.updateMatrix(); frontWindows.setMatrixAt(frontIndex++, windowTransform.matrix);
        }
        for (const side of [-1, 1]) {
          windowTransform.position.set(side * (sizeX / 2 + 0.06), windowY, 0);
          windowTransform.updateMatrix(); sideWindows.setMatrixAt(sideIndex++, windowTransform.matrix);
        }
      }
      frontWindows.instanceMatrix.needsUpdate = true;
      sideWindows.instanceMatrix.needsUpdate = true;
      towerShell.add(frontWindows, sideWindows);
      building.add(towerShell);

      const roof = new THREE.Mesh(new THREE.BoxGeometry(sizeX * 0.96, 0.5, sizeZ * 0.96), new THREE.MeshStandardMaterial({ map: textures.roofTiles || null, color: p.roof, roughness: 0.7 })); roof.position.y = towerHeight + 1.0; building.add(roof);

      const accentSeed = (x + z + floors) % 5;
      if (zone === 'commercial') {
        const crown = new THREE.Mesh(new THREE.CylinderGeometry(sizeX * 0.16, sizeX * 0.18, 2.2, 18), new THREE.MeshStandardMaterial({ color: 0xf4d35e, emissive: 0x5c4300, emissiveIntensity: 0.4 }));
        crown.position.y = towerHeight + 2.4; building.add(crown);
        const sign = new THREE.Mesh(new THREE.BoxGeometry(sizeX * 0.6, 1.1, 0.3), new THREE.MeshStandardMaterial({ color: 0xf8fafc, emissive: 0x0f172a, emissiveIntensity: 0.15 }));
        sign.position.set(0, towerHeight * 0.4, sizeZ * 0.52); building.add(sign);
      } else if (zone === 'office') {
        const sideWing = new THREE.Mesh(new THREE.BoxGeometry(sizeX * 0.28, towerHeight * 0.5, sizeZ * 0.35), new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.78 }));
        sideWing.position.set(sizeX * 0.34, towerHeight * 0.28 + 1.1, 0); building.add(sideWing);
      } else {
        const balcony = new THREE.Mesh(new THREE.BoxGeometry(sizeX * 0.7, 0.15, 0.9), new THREE.MeshStandardMaterial({ color: 0xe5e7eb, roughness: 0.8 }));
        balcony.position.set(0, 4.5 + (accentSeed % 2), sizeZ * 0.38); building.add(balcony);
        const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 2.5 + accentSeed, 10), new THREE.MeshStandardMaterial({ color: 0xcbd5e1, metalness: 0.9, roughness: 0.25 }));
        antenna.position.set(sizeX * 0.22, towerHeight + 1.3, -sizeZ * 0.22); building.add(antenna);
      }

      const lobby = new THREE.Mesh(new THREE.BoxGeometry(sizeX * 0.42, 0.95, 0.9), new THREE.MeshStandardMaterial({ color: 0x334b50, roughness: 0.72 }));
      lobby.position.set(0, 0.56, sizeZ * 0.18); building.add(lobby);
      const lobbyTop = new THREE.Mesh(new THREE.BoxGeometry(sizeX * 0.44, 0.1, 1.0), new THREE.MeshStandardMaterial({ color: 0xb8b2a4, roughness: 0.62 }));
      lobbyTop.position.set(0, 1.08, sizeZ * 0.18); building.add(lobbyTop);
      const lintel = new THREE.Mesh(new THREE.BoxGeometry(entranceWidth * 1.1, 0.35, 0.24), new THREE.MeshStandardMaterial({ color: 0xf5f5f4, roughness: 0.8 }));
      lintel.position.set(0, 3.05, sizeZ * 0.47); building.add(lintel);
      const shaft = new THREE.Mesh(new THREE.BoxGeometry(sizeX * 0.14, towerHeight, sizeZ * 0.14), new THREE.MeshStandardMaterial({ color: 0x2f4858, transparent: true, opacity: 0.52 })); shaft.position.set(sizeX * 0.24, towerHeight / 2 + 0.9, -sizeZ * 0.26); building.add(shaft);
      const elevatorCar = new THREE.Mesh(new THREE.BoxGeometry(sizeX * 0.12, 2.2, sizeZ * 0.12), new THREE.MeshStandardMaterial({ color: 0x6ee7b7, emissive: 0x0b2a1d })); elevatorCar.position.set(sizeX * 0.24, 1.1, -sizeZ * 0.26); building.add(elevatorCar);
      const elevator = { building, car: elevatorCar, shaft, targetFloor: 0, maxFloor: Math.max(0, floors - 1), currentFloor: 0, yBase: 1.0, x, z, width: sizeX, depth: sizeZ };

      const windowBars = accentSeed % 2 === 0 ? 0.18 : 0.28;
      const floorCount = Math.max(2, floors);
      const matrixObject = new THREE.Object3D();
      const floorPlates = new THREE.InstancedMesh(
        new THREE.BoxGeometry(sizeX * 0.74, 0.16, sizeZ * 0.74),
        new THREE.MeshStandardMaterial({ map: textures.woodFloor || null, color: 0xe5e7eb, roughness: 0.9 }), floorCount
      );
      const floorLights = new THREE.InstancedMesh(
        new THREE.BoxGeometry(sizeX * 0.18, 0.08, sizeZ * 0.18),
        new THREE.MeshStandardMaterial({ color: 0xfff7d6, emissive: 0xfef3c7, emissiveIntensity: 0.7 }), floorCount
      );
      const facadePanels = new THREE.InstancedMesh(
        new THREE.BoxGeometry(sizeX * 0.7, 0.16, 0.16),
        new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.75 }), floorCount
      );
      const floorFurnishings = [];
      const addInstances = (geometry, material, count) => {
        const mesh = new THREE.InstancedMesh(geometry, material, count);
        floorFurnishings.push(mesh);
        return mesh;
      };
      let desks; let chairs; let wallPanels; let apartmentUnits; let apartmentLamps;
      if (zone !== 'residential') {
        desks = addInstances(new THREE.BoxGeometry(0.9, 0.28, 0.7), new THREE.MeshStandardMaterial({ map: textures.woodFloor || null, color: 0x64748b }), floorCount * 3);
        chairs = addInstances(new THREE.BoxGeometry(0.52, 0.52, 0.52), new THREE.MeshStandardMaterial({ map: textures.darkMetal || null, color: 0x334155 }), floorCount * 3);
        wallPanels = addInstances(new THREE.BoxGeometry(sizeX * 0.14, 1.0, 0.08), new THREE.MeshStandardMaterial({ map: textures.plasterGrey || null, color: 0xcbd5e1, roughness: 0.9 }), floorCount * 3);
      } else {
        apartmentUnits = addInstances(new THREE.BoxGeometry(1.6, 0.7, 1.2), new THREE.MeshStandardMaterial({ map: textures.woodFloor || null, color: 0xc4b5fd, roughness: 0.8 }), floorCount);
        apartmentLamps = addInstances(new THREE.CylinderGeometry(0.08, 0.08, 0.75, 8), new THREE.MeshStandardMaterial({ color: 0xfef3c7, emissive: 0xfacc15, emissiveIntensity: 0.4 }), floorCount);
      }
      const setInstancePosition = (mesh, index, px, py, pz) => {
        matrixObject.position.set(px, py, pz);
        matrixObject.updateMatrix();
        mesh.setMatrixAt(index, matrixObject.matrix);
      };
      for (let i = 0; i < floorCount; i++) {
        const floorY = i === 0 ? 0.08 : i * 3.1 + 0.8;
        setInstancePosition(floorPlates, i, 0, floorY, 0);
        setInstancePosition(floorLights, i, 0, floorY + 2.5, 0);
        setInstancePosition(facadePanels, i, 0, floorY + 1.9, sizeZ * 0.22 + windowBars);

        if (zone !== 'residential') {
          for (let slot = 0; slot < 3; slot++) {
            const p = -2 + slot * 2;
            const index = i * 3 + slot;
            setInstancePosition(desks, index, p * 1.2, floorY + 0.3, -0.9 + (p === 0 ? 1.2 : 0));
            setInstancePosition(chairs, index, p * 1.2, floorY + 0.5, 0.9 - (p === 0 ? 1.0 : 0));
            setInstancePosition(wallPanels, index, p * 1.8, floorY + 1.5, sizeZ * 0.22);
          }
        } else {
          setInstancePosition(apartmentUnits, i, -1.1 + (i % 2) * 1.6, floorY + 0.35, -0.8 + (i % 3) * 0.9);
          setInstancePosition(apartmentLamps, i, (i % 2 === 0 ? -1.5 : 1.4) * 0.8, floorY + 0.85, 1.1);
        }
      }
      [floorPlates, floorLights, facadePanels, ...floorFurnishings].forEach((mesh) => {
        mesh.instanceMatrix.needsUpdate = true;
        building.add(mesh);
      });
      const body = new CANNON.Body({ mass: 0, material: new CANNON.Material('building') });
      body.addShape(new CANNON.Box(new CANNON.Vec3(sizeX / 2, towerHeight / 2 + 1, sizeZ / 2))); body.position.set(x, towerHeight / 2 + 0.6, z); world.addBody(body);
      const collider = {
        x,
        z,
        sizeX,
        sizeZ,
        minX: x - sizeX / 2,
        maxX: x + sizeX / 2,
        minZ: z - sizeZ / 2,
        maxZ: z + sizeZ / 2,
        height: towerHeight,
        entranceWidth: Math.min(sizeX * 0.32, 6.5),
        entranceDepth: 2.6,
        wallThickness: 0.3
      };
      footprintBuildingAreas.push({ x, z, halfWidth: sizeX / 2, halfDepth: sizeZ / 2 });
      buildingColliders.push(collider);
      collider.body = body;
      collider.mesh = building;
      collider.health = Math.max(4, floors * 0.8);
      collider.maxHealth = collider.health;
      collider.impactResistance = 50000 + floors * 14000;
      collider.facadeMaterial = towerMaterial;
      collider.collapsing = false;
      solids.push({ mesh: building, body }); buildings.push({ mesh: building, x, z, sizeX, sizeZ, floors, zone, elevator }); buildingElevators.push(elevator); cityRoot.add(building);
      if (zone !== 'residential' && buildingWorkers.length < 100 && Math.random() < 0.62) {
        const workerX = (Math.random() - 0.5) * Math.min(sizeX * 0.28, 5);
        createBuildingWorker(building, workerX, sizeZ * 0.12);
      }
      return building;
    }

    function generateLicensePlate() {
      const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      const segment = () => Array.from({ length: 3 }, () => characters[Math.floor(Math.random() * characters.length)]).join('');
      return `${segment()} ${segment()}`;
    }

    function createVehicleModel(type, color) {
      const group = new THREE.Group();
      const profiles = {
        sedan: { width: 2.2, height: 0.72, length: 4.2, cabinWidth: 1.7, cabinHeight: 0.58, cabinLength: 2.2, cabinY: 1.28, wheelX: 1.05, wheelZ: 1.2, mass: 100 },
        taxi: { width: 2.2, height: 0.72, length: 4.2, cabinWidth: 1.7, cabinHeight: 0.58, cabinLength: 2.2, cabinY: 1.28, wheelX: 1.05, wheelZ: 1.2, mass: 100 },
        sports: { width: 2.0, height: 0.62, length: 3.8, cabinWidth: 1.45, cabinHeight: 0.48, cabinLength: 2.1, cabinY: 1.18, wheelX: 0.96, wheelZ: 1.08, mass: 95 },
        plow: { width: 3.0, height: 1.25, length: 4.8, cabinWidth: 2.0, cabinHeight: 0.58, cabinLength: 2.4, cabinY: 1.55, wheelX: 1.35, wheelZ: 1.45, mass: 320 },
        suv: { width: 2.45, height: 0.95, length: 4.6, cabinWidth: 1.92, cabinHeight: 0.78, cabinLength: 2.65, cabinY: 1.52, wheelX: 1.12, wheelZ: 1.3, mass: 145 },
        hatchback: { width: 2.05, height: 0.72, length: 3.7, cabinWidth: 1.68, cabinHeight: 0.66, cabinLength: 2.15, cabinY: 1.35, wheelX: 0.96, wheelZ: 1.02, mass: 90 },
        pickup: { width: 2.35, height: 0.78, length: 4.8, cabinWidth: 1.75, cabinHeight: 0.62, cabinLength: 1.75, cabinY: 1.34, wheelX: 1.1, wheelZ: 1.45, mass: 155 },
        van: { width: 2.4, height: 1.02, length: 4.9, cabinWidth: 2.08, cabinHeight: 0.98, cabinLength: 3.0, cabinY: 1.57, wheelX: 1.08, wheelZ: 1.48, mass: 160 },
        ambulance: { width: 2.4, height: 1.02, length: 4.9, cabinWidth: 2.08, cabinHeight: 0.98, cabinLength: 3.0, cabinY: 1.57, wheelX: 1.08, wheelZ: 1.48, mass: 180 }
      };
      const profile = profiles[type] || profiles.sedan;
      const bodyColor = type === 'taxi' ? 0xfacc15 : type === 'sports' ? 0xe11d48 : type === 'plow' ? 0xe6a719 : color;
      const mainBody = new THREE.Mesh(new THREE.BoxGeometry(profile.width, profile.height, profile.length), new THREE.MeshStandardMaterial({ color: bodyColor, metalness: 0.52, roughness: 0.3 }));
      mainBody.position.y = 0.8; group.add(mainBody);
      const cabin = new THREE.Mesh(new THREE.BoxGeometry(profile.cabinWidth, profile.cabinHeight, profile.cabinLength), new THREE.MeshStandardMaterial({ color: 0xdfeafc, metalness: 0.7, roughness: 0.2, transparent: true, opacity: 0.42, depthWrite: false }));
      cabin.position.set(0, profile.cabinY, type === 'pickup' ? 0.48 : 0.1); group.add(cabin);
      if (type === 'pickup') {
        const bedMaterial = new THREE.MeshStandardMaterial({ color: 0x374151, metalness: 0.35, roughness: 0.68 });
        const bedFloor = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.12, 1.65), bedMaterial);
        bedFloor.position.set(0, 1.16, -1.28);
        group.add(bedFloor);
        [-1, 1].forEach((side) => {
          const rail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.38, 1.68), bedMaterial);
          rail.position.set(side * 0.86, 1.34, -1.28);
          group.add(rail);
        });
        const tailgate = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.38, 0.12), bedMaterial);
        tailgate.position.set(0, 1.34, -2.05);
        group.add(tailgate);
      }
      if (type === 'suv') {
        const railMaterial = new THREE.MeshStandardMaterial({ color: 0x374151, metalness: 0.72, roughness: 0.38 });
        [-1, 1].forEach((side) => {
          const rail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 2.35), railMaterial);
          rail.position.set(side * 0.78, 2.03, 0.06);
          group.add(rail);
        });
      }
      if (type === 'plow') {
        const blade = new THREE.Mesh(new THREE.BoxGeometry(5.8, 0.9, 0.6), new THREE.MeshStandardMaterial({ color: 0x8d999b, metalness: 0.82, roughness: 0.28 }));
        blade.position.set(0, 0.52, 2.65); group.add(blade);
        for (const side of [-1, 1]) {
          const support = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.8, 1.6), new THREE.MeshStandardMaterial({ color: 0x4b5558, metalness: 0.68, roughness: 0.38 }));
          support.position.set(side * 1.15, 0.85, 2.1); group.add(support);
        }
      }
      if (type === 'taxi') {
        const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.08, 0.1), new THREE.MeshStandardMaterial({ color: 0xfacc15, emissive: 0x524100, emissiveIntensity: 0.25 })); stripe.position.set(0, 1.0, 1.2); group.add(stripe);
      }
      for (const side of [-1, 1]) {
        for (const zSide of [-profile.wheelZ, profile.wheelZ]) {
          const wheelRadius = type === 'suv' || type === 'pickup' || type === 'plow' ? 0.46 : 0.4;
          const wheel = new THREE.Mesh(new THREE.CylinderGeometry(wheelRadius, wheelRadius, 0.44, 18), new THREE.MeshStandardMaterial({ color: 0x1f2937 }));
          wheel.rotation.z = Math.PI / 2; wheel.position.set(side * profile.wheelX, 0.42, zSide); group.add(wheel);
        }
      }
      const headlightMaterial = new THREE.MeshStandardMaterial({ color: 0x59636e, emissive: 0xfff1c2, emissiveIntensity: 0, roughness: 0.3, metalness: 0.1 });
      const headlightWidth = profile.width;
      const headlightDepth = profile.length / 2;
      const headlights = [-1, 1].map((side) => {
        const headlight = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.18, 0.08), headlightMaterial);
        headlight.position.set(side * headlightWidth * 0.31, 0.95, headlightDepth);
        group.add(headlight);
        return headlight;
      });
      const rearLightMaterial = new THREE.MeshStandardMaterial({ color: 0x451116, emissive: 0xff1d2d, emissiveIntensity: 0, roughness: 0.3 });
      const rearLights = [-1, 1].map((side) => {
        const light = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.22, 0.08), rearLightMaterial);
        light.position.set(side * headlightWidth * 0.31, 0.94, -headlightDepth);
        group.add(light);
        return light;
      });
      if (type === 'ambulance') {
        const ambulanceBar = new THREE.Group();
        const lightSpecs = [
          { side: -1, color: 0xff3d3d },
          { side: 1, color: 0x1d4ed8 }
        ];
        lightSpecs.forEach(({ side, color }) => {
          const bulb = new THREE.Mesh(
            new THREE.SphereGeometry(0.14, 12, 12),
            new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.2, roughness: 0.35 })
          );
          bulb.position.set(side * 0.64, 1.9, 0.15);
          ambulanceBar.add(bulb);
        });
        group.add(ambulanceBar);
        group.userData.ambulanceLights = ambulanceBar.children;
      }
      const plateText = generateLicensePlate();
      const plateCanvas = document.createElement('canvas');
      plateCanvas.width = 640;
      plateCanvas.height = 160;
      const plateContext = plateCanvas.getContext('2d');
      plateContext.fillStyle = '#e8edf0';
      plateContext.fillRect(0, 0, plateCanvas.width, plateCanvas.height);
      plateContext.strokeStyle = '#28343b';
      plateContext.lineWidth = 12;
      plateContext.strokeRect(6, 6, plateCanvas.width - 12, plateCanvas.height - 12);
      plateContext.fillStyle = '#17232a';
      plateContext.font = 'bold 94px monospace';
      plateContext.textAlign = 'center';
      plateContext.textBaseline = 'middle';
      plateContext.fillText(plateText, plateCanvas.width / 2, plateCanvas.height / 2 + 4);
      const plateTexture = new THREE.CanvasTexture(plateCanvas);
      plateTexture.encoding = THREE.sRGBEncoding;
      const plateGroup = new THREE.Group();
      const plate = new THREE.Mesh(
        new THREE.BoxGeometry(1.2, 0.3, 0.07),
        new THREE.MeshStandardMaterial({ map: plateTexture, color: 0xffffff, roughness: 0.7, metalness: 0.08 })
      );
      plate.position.y = 0.62;
      plateGroup.add(plate);
      plateGroup.position.z = -headlightDepth - 0.08;
      group.add(plateGroup);
      const body = new CANNON.Body({ mass: profile.mass, material: new CANNON.Material('car') });
      body.addShape(new CANNON.Box(new CANNON.Vec3(profile.width / 2, Math.max(0.48, profile.height * 0.65), profile.length / 2))); body.position.set(0, 1.2, 0); body.linearDamping = 0.18; body.angularDamping = 0.7; world.addBody(body);
      return { mesh: group, body, type, isPlow: type === 'plow', color, originalBodyColor: new THREE.Color(bodyColor), speed: 0, steer: 0, target: null, npc: false, parked: false, owner: null, driver: null, headlights, headlightMaterial, rearLights, rearLightMaterial, licensePlate: plateText, plateGroup, plateDropped: false, plateTexture, crashFlashUntil: 0, treeCollisionGrace: null, inside: false, canEnter: true, fuel: Infinity, maxFuel: Infinity, rampLift: 0, airborne: false, health: 100, destroyed: false, lastCrashEffectAt: -Infinity, trackDistance: 0, trackPosition: null, onFire: false };
    }

    function createRamp(x, z, width = 9, depth = 6, height = 1.4, rotation = 0) {
      if (overlapsRiverKeepOut(x, z, width, depth)) return;
      const ramp = new THREE.Mesh(
        new THREE.BoxGeometry(width, height, depth),
        new THREE.MeshStandardMaterial({ color: 0x8b9bb7, roughness: 0.8, metalness: 0.12 })
      );
      ramp.position.set(x, height / 2, z);
      ramp.rotation.y = rotation;
      ramp.castShadow = true;
      ramp.receiveShadow = true;
      cityRoot.add(ramp);

      const body = new CANNON.Body({ mass: 0 });
      body.addShape(new CANNON.Box(new CANNON.Vec3(width / 2, height / 2, depth / 2)));
      body.position.set(x, height / 2, z);
      body.quaternion.setFromEuler(0, rotation, 0);
      world.addBody(body);
      rampZones.push({ x, z, width, depth, height, rotation, mesh: ramp });
    }

    function createCar(x, z, color = 0x60a5fa, isPlayer = false, parked = false, type = 'sedan') {
      const car = createVehicleModel(type, color);
      car.parked = parked;
      car.owner = isPlayer ? 'player' : null;
      if (parked) {
        car.body.type = CANNON.Body.STATIC;
        car.body.mass = 0;
        car.body.updateMassProperties();
      }
      car.mesh.position.set(x, 0, z); car.body.position.set(x, 1.2, z); scene.add(car.mesh); cars.push(car); return car;
    }

    function updateCarHeadlights(car, now) {
      if (!car || car.destroyed || !car.headlightMaterial) return;
      if (car.isAmbulance && car.medicalLights) {
        const lightsOn = Math.floor(now / 180) % 2 === 0;
        car.mesh.traverse((part) => {
          if (!part.isMesh || !part.material || part.material.emissive === undefined) return;
          const hex = part.material.color ? part.material.color.getHex() : 0;
          if (hex === 0xff3d3d || hex === 0x1d4ed8) {
            part.material.emissiveIntensity = lightsOn ? 3.4 : 0.2;
          }
        });
        return;
      }
      const flashing = now < car.crashFlashUntil;
      const moving = !car.parked && Math.abs(car.speed) * 2.237 > 5;
      const lightsOn = flashing ? Math.floor(now / 180) % 2 === 0 : moving;
      car.headlightMaterial.color.setHex(lightsOn ? 0xfff5d7 : 0x59636e);
      car.headlightMaterial.emissiveIntensity = lightsOn ? (flashing ? 2.8 : 1.5) : 0;
      car.rearLightMaterial.color.setHex(lightsOn ? 0xff5964 : 0x451116);
      car.rearLightMaterial.emissiveIntensity = lightsOn ? (flashing ? 2.8 : 1.5) : 0;
    }

    function dropLicensePlate(car, x, z, impact) {
      if (!car || car.plateDropped || !car.plateGroup) return;
      car.mesh.updateMatrixWorld(true);
      const platePosition = car.plateGroup.getWorldPosition(new THREE.Vector3());
      scene.attach(car.plateGroup);
      car.plateGroup.position.copy(platePosition);
      car.plateGroup.position.x = x - Math.sin(car.mesh.rotation.y) * 2.1;
      car.plateGroup.position.y = Math.max(0.55, car.body.position.y + 0.2);
      car.plateGroup.position.z = z - Math.cos(car.mesh.rotation.y) * 2.1;
      car.plateGroup.rotation.set(0, car.mesh.rotation.y, 0);
      car.plateDropped = true;
      vehicleDebris.push({
        mesh: car.plateGroup,
        velocity: new THREE.Vector3((Math.random() - 0.5) * 2, Math.min(impact * 0.12, 4), (Math.random() - 0.5) * 2),
        createdAt: performance.now(),
        lifetime: 12000,
        isLicensePlate: true,
        landed: false
      });
    }

    function createRoadsideParking(count) {
      const roads = asphaltAreas.filter((area) =>
        Math.min(area.halfWidth, area.halfDepth) >= 7 &&
        Math.min(area.halfWidth, area.halfDepth) <= 12 &&
        Math.max(area.halfWidth, area.halfDepth) >= 70
      );
      let parkedCount = 0;
      let attempts = 0;
      while (parkedCount < count && attempts < count * 50) {
        attempts++;
        const road = roads[Math.floor(Math.random() * roads.length)];
        if (!road) break;
        const horizontal = road.halfWidth > road.halfDepth;
        const roadHalfWidth = horizontal ? road.halfDepth : road.halfWidth;
        const roadHalfLength = horizontal ? road.halfWidth : road.halfDepth;
        const along = (Math.random() * 2 - 1) * (roadHalfLength - 8);
        const side = Math.random() < 0.5 ? -1 : 1;
        const x = horizontal ? road.x + along : road.x + side * (roadHalfWidth + 3.8);
        const z = horizontal ? road.z + side * (roadHalfWidth + 3.8) : road.z + along;
        if (x < worldBounds.minX + 4 || x > worldBounds.maxX - 4 || z < worldBounds.minZ + 4 || z > worldBounds.maxZ - 4) continue;
        if (overlapsRiverKeepOut(x, z, 4.6, 2.4, 1) || pointIsInsideBuildingRect(x, z, 2.5)) continue;
        if (cars.some((car) => Math.hypot(car.body.position.x - x, car.body.position.z - z) < 7)) continue;
        const types = ['sedan', 'taxi', 'sports', 'hatchback', 'suv', 'pickup', 'van'];
        const car = createCar(x, z, (Math.random() * 0xffffff) >>> 0, false, true, types[Math.floor(Math.random() * types.length)]);
        car.mesh.rotation.y = horizontal ? Math.PI / 2 : 0;
        car.body.position.set(x, 1.1, z);
        car.mesh.position.copy(car.body.position);
        parkedCount++;
      }
      return parkedCount;
    }

    function spawnPlayerCar() {
      if (!gameStarted || controlledVehicle || controlledAirplane || controlledBoat) return;
      const origin = playerState.position;
      const yaw = playerState.yaw;
      let position = null;
      for (const distance of [8, 12, 16, 20]) {
        const x = origin.x + Math.sin(yaw) * distance;
        const z = origin.z + Math.cos(yaw) * distance;
        const occupied = cars.some((car) => !car.destroyed && Math.hypot(car.body.position.x - x, car.body.position.z - z) < 6);
        if (!occupied && !pointIsInsideBuildingRect(x, z, 2)) { position = { x, z }; break; }
      }
      if (!position) { showMessage('No room to spawn a car nearby.'); return; }
      const car = createCar(position.x, position.z, garageColor, true, false, currentGarageModel);
      car.owner = 'player';
      car.mesh.rotation.y = yaw;
      car.body.position.set(position.x, 1.2, position.z);
      car.body.quaternion.setFromEuler(0, yaw, 0);
      car.mesh.position.copy(car.body.position);
      showMessage('Car spawned nearby. Click it to drive.');
    }

    function isOnAsphalt(x, z) {
      return asphaltAreas.some((area) =>
        Math.abs(x - area.x) <= area.halfWidth &&
        Math.abs(z - area.z) <= area.halfDepth
      );
    }

    function getCarWheelPositions(car) {
      const x = car.body.position.x;
      const z = car.body.position.z;
      const yaw = car.mesh.rotation.y;
      const cos = Math.cos(yaw);
      const sin = Math.sin(yaw);
      return [-1.05, 1.05].flatMap((side) => [-1.2, 1.2].map((longitudinal) => ({
        x: x + cos * side + sin * longitudinal,
        z: z - sin * side + cos * longitudinal
      })));
    }

    function addTireTrackMark(car, wheel, now, surface = 'asphalt') {
      if (!car || !wheel) return;
      const markGeometry = surface === 'asphalt' ? tireTrackGeometry : dirtTrackGeometry;
      const markMaterial = surface === 'asphalt' ? tireTrackMaterial : dirtTrackMaterial;
      const mark = new THREE.Mesh(markGeometry, markMaterial);
      mark.position.set(wheel.x, 0.12, wheel.z);
      mark.rotation.y = car.mesh.rotation.y + (surface === 'asphalt' ? 0 : (Math.random() - 0.5) * 0.65);
      mark.rotation.z = surface === 'asphalt' ? 0 : (Math.random() - 0.5) * 0.7;
      scene.add(mark);
      tireTracks.push({ mesh: mark, createdAt: now, permanent: true, surface });
    }

    function updateTireTracks(now) {
      cars.forEach((car) => {
        if (!car || car.destroyed) {
          if (car) car.trackPosition = null;
          return;
        }
        const previousSpeed = car.lastSpeed ?? car.speed ?? 0;
        const suddenBrake = Math.abs(car.speed) > 4 && Math.abs(car.speed - previousSpeed) > 7 && car.speed < previousSpeed;
        const position = car.body.position;
        if (!car.trackPosition) {
          car.trackPosition = { x: position.x, z: position.z };
        }
        const distance = car.trackPosition ? Math.hypot(position.x - car.trackPosition.x, position.z - car.trackPosition.z) : 0;
        car.trackPosition.x = position.x;
        car.trackPosition.z = position.z;
        if (suddenBrake && Math.abs(car.speed) > 4) {
          getCarWheelPositions(car).forEach((wheel) => {
            const surface = isOnAsphalt(wheel.x, wheel.z) ? 'asphalt' : 'dirt';
            addTireTrackMark(car, wheel, now, surface);
          });
        }
        if (Math.abs(car.speed) >= 3 && distance > 5) {
          car.trackDistance = 0;
          car.lastSpeed = car.speed;
          return;
        }
        if (Math.abs(car.speed) >= 3) {
          car.trackDistance = (car.trackDistance || 0) + distance;
          if ((car.trackDistance || 0) < 1.35) {
            car.lastSpeed = car.speed;
            return;
          }
          car.trackDistance %= 1.35;
        }
        car.lastSpeed = car.speed;
        if (Math.abs(car.speed) < 3) return;
        getCarWheelPositions(car).forEach((wheel) => {
          const surface = isOnAsphalt(wheel.x, wheel.z) ? 'asphalt' : 'dirt';
          if (surface === 'asphalt' && !isOnAsphalt(wheel.x, wheel.z)) return;
          const mark = new THREE.Mesh(surface === 'asphalt' ? tireTrackGeometry : dirtTrackGeometry, surface === 'asphalt' ? tireTrackMaterial : dirtTrackMaterial);
          mark.position.set(wheel.x, 0.13, wheel.z);
          mark.rotation.y = car.mesh.rotation.y;
          mark.rotation.z = surface === 'asphalt' ? 0 : (Math.random() - 0.5) * 0.7;
          scene.add(mark);
          tireTracks.push({ mesh: mark, createdAt: now, permanent: false, surface });
        });
      });
      for (let index = tireTracks.length - 1; index >= 0; index--) {
        const track = tireTracks[index];
        if (track.permanent) continue;
        if (now - track.createdAt < 5000) continue;
        scene.remove(track.mesh);
        tireTracks.splice(index, 1);
      }
      while (tireTracks.length > 1200) {
        const oldest = tireTracks.shift();
        if (oldest) scene.remove(oldest.mesh);
      }
    }

    function addFootprint(x, z, yaw, side, now) {
      if (!isFootprintSurface(x, z)) return;
      const lateralOffset = side * 0.12;
      const mesh = new THREE.Mesh(footprintGeometry, footprintMaterial);
      mesh.position.set(
        x + Math.cos(yaw) * lateralOffset,
        groundHeightAt(x, z) + 0.025,
        z - Math.sin(yaw) * lateralOffset
      );
      mesh.rotation.set(-Math.PI / 2, yaw, 0);
      scene.add(mesh);
      footprints.push({ mesh, createdAt: now });
      while (footprints.length > 450) scene.remove(footprints.shift().mesh);
    }

    function updateFootprints(now) {
      people.forEach((person) => {
        const position = person.mesh.position;
        const previous = person.footprintPosition;
        const moving = gameSettings.npcs && person.active && !person.ridingBoat && !person.knockedDown && person.task !== 'bench';
        if (!previous) {
          person.footprintPosition = { x: position.x, z: position.z };
          person.footprintDistance = 0;
          person.footprintSide = 1;
          return;
        }
        const distance = Math.hypot(position.x - previous.x, position.z - previous.z);
        previous.x = position.x;
        previous.z = position.z;
        if (!moving || distance > 5) {
          person.footprintDistance = 0;
          return;
        }
        person.footprintDistance = (person.footprintDistance || 0) + distance;
        while (person.footprintDistance >= 0.72) {
          person.footprintDistance -= 0.72;
          addFootprint(position.x, position.z, person.mesh.rotation.y, person.footprintSide || 1, now);
          person.footprintSide = -(person.footprintSide || 1);
        }
      });

      if (!gameStarted || controlledVehicle || controlledAirplane || playerState.boat || !playerState.onGround) {
        playerFootprintPosition = null;
        playerFootprintDistance = 0;
      } else {
        const position = playerState.position;
        if (!playerFootprintPosition) {
          playerFootprintPosition = { x: position.x, z: position.z };
        } else {
          const distance = Math.hypot(position.x - playerFootprintPosition.x, position.z - playerFootprintPosition.z);
          playerFootprintPosition.x = position.x;
          playerFootprintPosition.z = position.z;
          if (distance > 5) {
            playerFootprintDistance = 0;
          } else {
            playerFootprintDistance += distance;
            while (playerFootprintDistance >= 0.72) {
              playerFootprintDistance -= 0.72;
              addFootprint(position.x, position.z, playerState.yaw, playerFootprintSide, now);
              playerFootprintSide = -playerFootprintSide;
            }
          }
        }
      }

      for (let index = footprints.length - 1; index >= 0; index--) {
        const footprint = footprints[index];
        if (now - footprint.createdAt < 2000) continue;
        scene.remove(footprint.mesh);
        footprints.splice(index, 1);
      }
    }

    function addSmokeParticle(x, y, z) {
      if (smokeParticles.length >= 120) {
        const oldest = smokeParticles.shift();
        scene.remove(oldest.mesh);
        oldest.mesh.material.dispose();
      }
      const mesh = new THREE.Mesh(
        smokeParticleGeometry,
        new THREE.MeshBasicMaterial({ color: 0x62686a, transparent: true, opacity: 0.56, depthWrite: false })
      );
      mesh.position.set(x, y, z);
      mesh.scale.setScalar(0.7 + Math.random() * 0.45);
      scene.add(mesh);
      smokeParticles.push({
        mesh,
        velocity: new THREE.Vector3((Math.random() - 0.5) * 0.8, 1.1 + Math.random() * 1.2, (Math.random() - 0.5) * 0.8),
        createdAt: performance.now(),
        lifetime: 900 + Math.random() * 550
      });
    }

    function createCrashSmoke(car, now, duration = 2200) {
      const emitter = {
        car,
        x: car.body.position.x,
        y: car.body.position.y,
        z: car.body.position.z,
        yaw: car.mesh.rotation.y,
        expiresAt: now + duration,
        nextEmissionAt: now
      };
      smokeEmitters.push(emitter);
      return emitter;
    }

    function createExplosionBurst(x, y, z) {
      for (let index = 0; index < 14; index++) {
        if (explosionParticles.length >= 100) {
          const oldest = explosionParticles.shift();
          scene.remove(oldest.mesh);
          oldest.mesh.material.dispose();
        }
        const particleScale = 0.38 + Math.random() * 0.42;
        const mesh = new THREE.Mesh(
          explosionParticleGeometry,
          new THREE.MeshBasicMaterial({
            color: Math.random() < 0.55 ? 0xff5a12 : 0xffd34e,
            transparent: true,
            opacity: 0.92,
            depthWrite: false
          })
        );
        mesh.scale.setScalar(particleScale);
        mesh.position.set(x, y, z);
        scene.add(mesh);
        explosionParticles.push({
          mesh,
          velocity: new THREE.Vector3((Math.random() - 0.5) * 9, 1.5 + Math.random() * 7, (Math.random() - 0.5) * 9),
          createdAt: performance.now(),
          lifetime: 450 + Math.random() * 500
        });
      }
    }

    function createFireEffect(car, x, z, lifetime) {
      const group = new THREE.Group();
      const outer = new THREE.Mesh(fireOuterGeometry, fireMaterial);
      outer.position.y = 1.05;
      const inner = new THREE.Mesh(fireInnerGeometry, innerFireMaterial);
      inner.position.y = 0.72;
      group.add(outer, inner);
      group.position.set(x, 0, z);
      scene.add(group);
      fireEffects.push({ group, car, x, z, createdAt: performance.now(), lifetime, nextSmokeAt: 0, flickerAt: 0 });
      if (car) car.onFire = true;
    }

    function updateCrashEffects(dt, now) {
      for (let index = smokeEmitters.length - 1; index >= 0; index--) {
        const emitter = smokeEmitters[index];
        if (now >= emitter.expiresAt) {
          smokeEmitters.splice(index, 1);
          continue;
        }
        if (now < emitter.nextEmissionAt) continue;
        emitter.nextEmissionAt = now + 120;
        let x = emitter.x;
        let y = emitter.y;
        let z = emitter.z;
        let yaw = emitter.yaw;
        if (emitter.car && !emitter.car.destroyed) {
          x = emitter.car.body.position.x;
          y = emitter.car.body.position.y;
          z = emitter.car.body.position.z;
          yaw = emitter.car.mesh.rotation.y;
        }
        addSmokeParticle(x + Math.sin(yaw) * 2.25, y + 1.25, z + Math.cos(yaw) * 2.25);
      }

      for (let index = smokeParticles.length - 1; index >= 0; index--) {
        const particle = smokeParticles[index];
        const age = now - particle.createdAt;
        if (age >= particle.lifetime) {
          scene.remove(particle.mesh);
          particle.mesh.material.dispose();
          smokeParticles.splice(index, 1);
          continue;
        }
        particle.velocity.y += 0.35 * dt;
        particle.mesh.position.addScaledVector(particle.velocity, dt);
        particle.mesh.scale.multiplyScalar(1 + dt * 0.65);
        particle.mesh.material.opacity = 0.56 * (1 - age / particle.lifetime);
      }

      for (let index = fireEffects.length - 1; index >= 0; index--) {
        const fire = fireEffects[index];
        const age = now - fire.createdAt;
        if (age >= fire.lifetime) {
          if (fire.car) fire.car.onFire = false;
          scene.remove(fire.group);
          fireEffects.splice(index, 1);
          continue;
        }
        if (fire.car && !fire.car.destroyed) {
          fire.x = fire.car.body.position.x;
          fire.z = fire.car.body.position.z;
        } else if (fire.car) {
          fire.car.onFire = false;
          fire.car = null;
        }
        fire.group.position.set(fire.x, 0, fire.z);
        if (now >= fire.flickerAt) {
          fire.flickerAt = now + 75;
          fire.group.scale.set(0.82 + Math.random() * 0.35, 0.85 + Math.random() * 0.5, 0.82 + Math.random() * 0.35);
          fire.group.rotation.y += (Math.random() - 0.5) * 0.4;
        }
        if (now >= fire.nextSmokeAt) {
          fire.nextSmokeAt = now + 190;
          addSmokeParticle(fire.x, 1.8, fire.z);
        }
      }

      for (let index = explosionParticles.length - 1; index >= 0; index--) {
        const particle = explosionParticles[index];
        const age = now - particle.createdAt;
        if (age >= particle.lifetime) {
          scene.remove(particle.mesh);
          particle.mesh.material.dispose();
          explosionParticles.splice(index, 1);
          continue;
        }
        particle.velocity.y -= 7 * dt;
        particle.mesh.position.addScaledVector(particle.velocity, dt);
        particle.mesh.material.opacity = 0.92 * (1 - age / particle.lifetime);
      }
    }

    function handleVehicleCrash(car, now, impactSpeed = Math.abs(car.speed), suppressSecondaryDamage = false) {
      if (!car || car.destroyed || impactSpeed < 4) return;
      car.crashFlashUntil = Math.max(car.crashFlashUntil || 0, now + 4200);
      if (now - car.lastCrashEffectAt < 1200) return;
      car.lastCrashEffectAt = now;
      createCrashSmoke(car, now);
      if (car.onFire || suppressSecondaryDamage) return;
      const outcome = Math.random();
      if (outcome < 0.05) {
        const x = car.body.position.x;
        const y = car.body.position.y;
        const z = car.body.position.z;
        createExplosionBurst(x, y + 1.2, z);
        createFireEffect(null, x, z, 10000);
        addSmokeParticle(x, y + 1.5, z);
        destroyVehicle(car);
      } else if (outcome < 0.20) {
        createFireEffect(car, car.body.position.x, car.body.position.z, 8000);
      }
    }

    function destroyVehicle(car) {
      if (car.destroyed) return;
      const wasControlled = controlledVehicle === car;
      const wreckX = car.body.position.x;
      const wreckZ = car.body.position.z;
      const wreckYaw = car.mesh.rotation.y;
      const wreckAlreadyBurning = car.onFire || fireEffects.some((fire) =>
        Math.hypot(fire.x - wreckX, fire.z - wreckZ) < 2 &&
        performance.now() - fire.createdAt < fire.lifetime
      );
      car.destroyed = true;
      world.removeBody(car.body);
      if (gameSettings.destruction) {
        car.mesh.updateMatrixWorld(true);
        car.mesh.traverse((part) => {
          if (!part.isMesh) return;
          if (vehicleDebris.length >= 80) scene.remove(vehicleDebris.shift().mesh);
          const debris = new THREE.Mesh(part.geometry, part.material);
          part.getWorldPosition(debris.position);
          part.getWorldQuaternion(debris.quaternion);
          debris.scale.copy(part.getWorldScale(new THREE.Vector3()));
          scene.add(debris);
          vehicleDebris.push({
            mesh: debris,
            velocity: new THREE.Vector3((Math.random() - 0.5) * 7, 2 + Math.random() * 5, (Math.random() - 0.5) * 7),
            createdAt: performance.now()
          });
        });
      }
      scene.remove(car.mesh);
      createWreckageEvent(wreckX, wreckZ, 'vehicle', !wreckAlreadyBurning);
      if (wasControlled) {
        placePlayerAtWreckage(wreckX, wreckZ, wreckYaw);
        controlledVehicle = null;
        clearVehicleKeys();
        syncActiveMode();
      }
      showMessage('Vehicle wrecked.');
    }

    function updateVehicleDebris(dt) {
      const now = performance.now();
      for (let index = vehicleDebris.length - 1; index >= 0; index--) {
        const piece = vehicleDebris[index];
        if (now - piece.createdAt > (piece.lifetime || 1800)) {
          scene.remove(piece.mesh);
          if (piece.isLicensePlate) {
            piece.mesh.traverse((part) => {
              if (!part.isMesh) return;
              part.geometry.dispose();
              part.material.dispose();
            });
            piece.mesh.clear();
          }
          vehicleDebris.splice(index, 1);
          continue;
        }
        if (piece.isLicensePlate && piece.landed) continue;
        piece.velocity.y -= 9.8 * dt;
        piece.mesh.position.addScaledVector(piece.velocity, dt);
        piece.mesh.rotation.x += 2.4 * dt;
        piece.mesh.rotation.z += 1.8 * dt;
        if (piece.isLicensePlate) {
          const floorY = groundHeightAt(piece.mesh.position.x, piece.mesh.position.z) + 0.04;
          if (piece.mesh.position.y <= floorY) {
            piece.mesh.position.y = floorY;
            piece.velocity.set(0, 0, 0);
            piece.mesh.rotation.set(-Math.PI / 2, piece.mesh.rotation.y, 0);
            piece.landed = true;
          }
        }
      }
    }

    function damageVehicle(car, damage) {
      if (!gameSettings.destruction || !car || car.destroyed || damage <= 0) return;
      car.health -= damage;
      const damageRatio = THREE.MathUtils.clamp(1 - car.health / 100, 0, 1);
      const mainBody = car.mesh.children[0];
      mainBody.scale.y = 1 - damageRatio * 0.35;
      mainBody.material.color.copy(car.originalBodyColor).lerp(new THREE.Color(0x562c27), damageRatio * 0.55);
      if (car.health <= 0) destroyVehicle(car);
    }

    function rateCollision(mass, relativeSpeed, resistance, incidence = 1) {
      const impactEnergy = 0.5 * Math.max(0, mass) * relativeSpeed * relativeSpeed * THREE.MathUtils.clamp(incidence, 0, 1);
      const score = THREE.MathUtils.clamp(impactEnergy / Math.max(1, resistance) * 100, 0, 200);
      return { impactEnergy, score, destroys: score >= 100 };
    }

    function createWreckageEvent(x, z, kind, fireChance = true) {
      const now = performance.now();
      const event = {
        x,
        z,
        kind,
        gatherAt: now + 8000 + Math.random() * 2000,
        expiresAt: now + 65000,
        crowdSize: 3 + Math.floor(Math.random() * 3),
        assigned: false,
        people: []
      };
      wreckageCrowds.push(event);
      if (fireChance && Math.random() < 0.5) createFireEffect(null, x, z, 12000);
      return event;
    }

    function removeDebrisPiece(piece) {
      world.removeBody(piece.body);
      scene.remove(piece.mesh);
      if (piece.kind === 'aircraft') {
        piece.mesh.traverse((part) => {
          if (!part.isMesh) return;
          part.geometry.dispose();
          if (Array.isArray(part.material)) part.material.forEach((material) => material.dispose());
          else part.material.dispose();
        });
      } else {
        piece.mesh.geometry.dispose();
        if (piece.kind === 'item' || piece.kind === 'prop') piece.mesh.material.dispose();
      }
    }

    function createItemWreckage(x, z, size, color, kind = 'item') {
      const now = performance.now();
      const fragmentCount = webOptimizer.lowLag ? 2 : 3;
      const maxDebrisPieces = webOptimizer.lowLag ? 80 : 180;
      while (debrisPieces.length + fragmentCount > maxDebrisPieces) {
        removeDebrisPiece(debrisPieces.shift());
      }
      createWreckageEvent(x, z, kind, true);
      for (let index = 0; index < fragmentCount; index++) {
        const width = size * (0.45 + Math.random() * 0.3);
        const height = size * (0.35 + Math.random() * 0.35);
        const depth = size * (0.45 + Math.random() * 0.3);
        const mesh = new THREE.Mesh(
          new THREE.BoxGeometry(width, height, depth),
          new THREE.MeshStandardMaterial({ color, roughness: 0.92 })
        );
        mesh.position.set(x + (Math.random() - 0.5) * size, height / 2 + 0.15, z + (Math.random() - 0.5) * size);
        mesh.rotation.set(Math.random() * 0.2, Math.random() * Math.PI, Math.random() * 0.2);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        scene.add(mesh);

        const body = new CANNON.Body({ mass: 18 + Math.random() * 12, material: new CANNON.Material('rubble') });
        body.addShape(new CANNON.Box(new CANNON.Vec3(width / 2, height / 2, depth / 2)));
        body.position.set(mesh.position.x, mesh.position.y, mesh.position.z);
        body.quaternion.setFromEuler(mesh.rotation.x, mesh.rotation.y, mesh.rotation.z);
        body.linearDamping = 0.2;
        body.angularDamping = 0.45;
        body.velocity.set((Math.random() - 0.5) * 3, 1.5 + Math.random() * 2, (Math.random() - 0.5) * 3);
        body.angularVelocity.set((Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2);
        world.addBody(body);
        debrisPieces.push({ mesh, body, width, depth, cleared: false, createdAt: now, lifetime: 60000, kind });
      }
    }

    function updateWreckageCrowds(now) {
      for (let index = wreckageCrowds.length - 1; index >= 0; index--) {
        const event = wreckageCrowds[index];
        if (now >= event.expiresAt) {
          event.people.forEach((person) => {
            if (person.wreckageEvent !== event) return;
            person.wreckageEvent = null;
            person.wreckageTarget = null;
            person.task = 'walk';
            person.path = [];
            person.destination.copy(getSidewalkPointNear(person.mesh.position.clone()));
          });
          wreckageCrowds.splice(index, 1);
          continue;
        }
        if (event.assigned || now < event.gatherAt || !gameSettings.npcs) continue;

        const candidates = people.filter((person) =>
          person && !person.wreckageEvent && !person.ridingBoat && !person.knockedDown &&
          person.state !== 'State_Pursuit' && person.state !== 'State_LinkedToUser' &&
          Math.hypot(person.mesh.position.x - event.x, person.mesh.position.z - event.z) <= 420
        );
        if (candidates.length < 3) {
          candidates.push(...people.filter((person) =>
            person && !person.wreckageEvent && !person.ridingBoat && !person.knockedDown &&
            person.state !== 'State_Pursuit' && person.state !== 'State_LinkedToUser' &&
            !candidates.includes(person)
          ));
        }
        candidates.sort((a, b) =>
          Math.hypot(b.mesh.position.x - event.x, b.mesh.position.z - event.z) -
          Math.hypot(a.mesh.position.x - event.x, a.mesh.position.z - event.z)
        );
        const attendees = candidates.slice(0, event.crowdSize);
        attendees.forEach((person, attendeeIndex) => {
          const angle = attendeeIndex / Math.max(1, attendees.length) * Math.PI * 2 + Math.random() * 0.25;
          const radius = 3.5 + (attendeeIndex % 2) * 1.5;
          person.wreckageEvent = event;
          person.wreckageTarget = new THREE.Vector3(
            event.x + Math.cos(angle) * radius,
            0,
            event.z + Math.sin(angle) * radius
          );
          person.task = 'wreckage';
          person.bench = null;
          person.path = [];
          person.pathTimer = 0;
          person.wreckageSpeed = 7.5 + Math.random() * 2.5;
          person.mesh.visible = true;
          person.active = true;
          if (person.deviceGroup) person.deviceGroup.visible = false;
          event.people.push(person);
        });
        event.assigned = true;
      }
    }

    function updateWreckageCrowdPerson(person, dt, now, lowLagHumans) {
      const target = person.wreckageTarget;
      if (!target) return;
      const distance = Math.hypot(target.x - person.mesh.position.x, target.z - person.mesh.position.z);
      if (distance > 1.35) {
        if (now >= (person.pathTimer || 0)) {
          person.path = getNavigationPath(person.mesh.position, target);
          person.pathTimer = now + 1400;
        }
        const pathTarget = person.path.length > 1 ? person.path[1] : target;
        const direction = pathTarget.clone().sub(person.mesh.position).setY(0);
        if (direction.lengthSq() < 0.01) direction.copy(target).sub(person.mesh.position).setY(0);
        if (direction.lengthSq() > 0.01) {
          direction.normalize();
          const step = Math.min(distance, (person.wreckageSpeed || 8.5) * dt * 1.8);
          const next = person.mesh.position.clone().addScaledVector(direction, step);
          const resolved = resolveFootstep(next.x, next.z, 0.55);
          if (!resolved.blocked) {
            person.mesh.position.set(resolved.x, 0, resolved.z);
          } else {
            person.pathTimer = now + 180;
          }
          person.mesh.rotation.y = Math.atan2(direction.x, direction.z);
        }
        person.walkPhase += dt * 12;
        const swing = lowLagHumans ? 0 : Math.sin(person.walkPhase) * 0.95;
        person.leftArm.rotation.x = swing;
        person.rightArm.rotation.x = -swing;
        person.leftLeg.rotation.x = -swing;
        person.rightLeg.rotation.x = swing;
        return;
      }

      person.mesh.rotation.y = Math.atan2(
        person.wreckageEvent.x - person.mesh.position.x,
        person.wreckageEvent.z - person.mesh.position.z
      );
      person.leftArm.rotation.x = -0.18;
      person.rightArm.rotation.x = -0.18;
      person.leftLeg.rotation.x = 0;
      person.rightLeg.rotation.x = 0;
    }

    function createBuildingDebris(box, tiltDirection, impactSpeed) {
      if (!gameSettings.destruction) return;
      const fragmentLimit = webOptimizer.lowLag ? 10 : 24;
      const maxDebrisPieces = webOptimizer.lowLag ? 80 : 180;
      while (debrisPieces.length + fragmentLimit > maxDebrisPieces) {
        removeDebrisPiece(debrisPieces.shift());
      }
      const rubbleMaterial = new THREE.MeshStandardMaterial({
        map: box.facadeMaterial.map,
        color: box.facadeMaterial.color.clone().multiplyScalar(0.76),
        roughness: 0.94
      });
      const debrisStarted = performance.now();
      const fragmentCount = THREE.MathUtils.clamp(
        Math.round(fragmentLimit * THREE.MathUtils.clamp(Math.abs(impactSpeed) / 24, 0.5, 1.5)),
        6,
        fragmentLimit
      );
      for (let index = 0; index < fragmentCount; index++) {
        const width = 1.2 + Math.random() * 1.8;
        const height = 0.8 + Math.random() * 1.7;
        const depth = 1.2 + Math.random() * 1.8;
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), rubbleMaterial);
        mesh.position.set(
          box.x + (Math.random() - 0.5) * box.sizeX * 0.88,
          0.6 + Math.random() * box.height * 0.82,
          box.z + (Math.random() - 0.5) * box.sizeZ * 0.88
        );
        mesh.rotation.set(Math.random() * 0.3, Math.random() * Math.PI, Math.random() * 0.3);
        mesh.castShadow = true; mesh.receiveShadow = true; scene.add(mesh);
        const body = new CANNON.Body({ mass: 18 + Math.random() * 36, material: new CANNON.Material('rubble') });
        body.addShape(new CANNON.Box(new CANNON.Vec3(width / 2, height / 2, depth / 2)));
        body.position.set(mesh.position.x, mesh.position.y, mesh.position.z);
        body.quaternion.setFromEuler(mesh.rotation.x, mesh.rotation.y, mesh.rotation.z);
        body.linearDamping = 0.12; body.angularDamping = 0.34;
        const eject = Math.min(impactSpeed * 0.1, 10);
        body.velocity.set((Math.random() - 0.5) * eject + tiltDirection * eject * 0.25, 2 + Math.random() * eject * 0.4, (Math.random() - 0.5) * eject);
        body.angularVelocity.set((Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4);
        world.addBody(body);
        debrisPieces.push({ mesh, body, width, depth, cleared: false, createdAt: debrisStarted, lifetime: 60000, kind: 'building' });
      }
    }

    function updateBuildingDebris() {
      const now = performance.now();
      for (let index = debrisPieces.length - 1; index >= 0; index--) {
        const piece = debrisPieces[index];
        if (piece.body.position.y < -60 || now - piece.createdAt > (piece.lifetime || 15000)) {
          removeDebrisPiece(piece);
          debrisPieces.splice(index, 1);
          continue;
        }
        piece.mesh.position.set(piece.body.position.x, piece.body.position.y, piece.body.position.z);
        piece.mesh.quaternion.set(piece.body.quaternion.x, piece.body.quaternion.y, piece.body.quaternion.z, piece.body.quaternion.w);
      }
    }

    function collapseBuilding(box, tiltDirection, makeRubble = false, impactSpeed = 18) {
      if (!gameSettings.destruction) return;
      if (box.collapsing) return;
      box.collapsing = true;
      world.removeBody(box.body);
      createWreckageEvent(box.x, box.z, 'building', true);
      if (makeRubble) createBuildingDebris(box, tiltDirection, impactSpeed);
      const collapseStart = performance.now();
      const collapse = () => {
        const progress = Math.min((performance.now() - collapseStart) / (makeRubble ? 850 : 1500), 1);
        const easedProgress = progress * progress * (3 - 2 * progress);
        box.mesh.rotation.z = easedProgress * tiltDirection * (makeRubble ? 0.42 : 0.22);
        box.mesh.position.y = -easedProgress * (makeRubble ? 1.2 : 5);
        if (progress < 1) requestAnimationFrame(collapse); else cityRoot.remove(box.mesh);
      };
      requestAnimationFrame(collapse);
    }

    const BUILDING_CAVE_IN_MIN_SPEED = 40 / 2.237;
    const buildingCaveRecessMaterial = new THREE.MeshBasicMaterial({ color: 0x171a1c, side: THREE.DoubleSide });
    function createBuildingCaveIn(box, impactX, impactZ, impactSpeed) {
      if (!box || box.collapsing || impactSpeed <= BUILDING_CAVE_IN_MIN_SPEED) return false;
      const dx = (impactX - box.x) / box.sizeX;
      const dz = (impactZ - box.z) / box.sizeZ;
      const onXFace = Math.abs(dx) > Math.abs(dz);
      const side = onXFace ? (dx >= 0 ? 'east' : 'west') : (dz >= 0 ? 'front' : 'back');
      const sideLength = onXFace ? box.sizeZ : box.sizeX;
      const impactAlongFace = onXFace ? impactZ - box.z : impactX - box.x;
      const caveWidth = Math.min(4.2, Math.max(1.8, sideLength * 0.62));
      const caveSection = Math.floor((impactAlongFace + sideLength / 2) / caveWidth);
      const sectionKey = `${side}:${caveSection}`;
      if (!box.caveInSections) box.caveInSections = new Set();
      if (box.caveInSections.has(sectionKey) || box.caveInSections.size >= 4) return false;
      box.caveInSections.add(sectionKey);

      const caveHeight = Math.min(3.2, Math.max(2, box.height * 0.16));
      const caveY = Math.min(2.2, box.height - caveHeight / 2 - 0.2);
      const caveX = onXFace
        ? (side === 'east' ? box.sizeX / 2 + 0.12 : -box.sizeX / 2 - 0.12)
        : THREE.MathUtils.clamp(impactX - box.x, -box.sizeX / 2 + caveWidth / 2, box.sizeX / 2 - caveWidth / 2);
      const caveZ = onXFace
        ? THREE.MathUtils.clamp(impactZ - box.z, -box.sizeZ / 2 + caveWidth / 2, box.sizeZ / 2 - caveWidth / 2)
        : (side === 'front' ? box.sizeZ / 2 + 0.12 : -box.sizeZ / 2 - 0.12);

      const cave = new THREE.Group();
      cave.position.set(caveX, caveY, caveZ);
      if (side === 'east') cave.rotation.y = Math.PI / 2;
      else if (side === 'west') cave.rotation.y = -Math.PI / 2;
      else if (side === 'back') cave.rotation.y = Math.PI;
      const recess = new THREE.Mesh(
        new THREE.PlaneGeometry(caveWidth, caveHeight),
        buildingCaveRecessMaterial
      );
      recess.position.z = -0.04;
      cave.add(recess);

      const tileWidth = caveWidth / 2;
      const tileHeight = caveHeight / 2;
      const fragments = [];
      for (let row = 0; row < 2; row++) {
        for (let column = 0; column < 2; column++) {
          const fragment = new THREE.Mesh(
            new THREE.BoxGeometry(tileWidth * 0.96, tileHeight * 0.96, 0.28),
            box.facadeMaterial
          );
          const initialPosition = new THREE.Vector3(
            (column - 0.5) * tileWidth,
            (row - 0.5) * tileHeight,
            0.12
          );
          fragment.position.copy(initialPosition);
          fragment.castShadow = true;
          fragment.receiveShadow = true;
          cave.add(fragment);
          fragments.push({
            mesh: fragment,
            initialPosition,
            fallDistance: 1.6 + Math.random() * 1.2,
            rotationX: (Math.random() - 0.5) * 0.8,
            rotationY: (Math.random() - 0.5) * 0.8,
            rotationZ: (Math.random() - 0.5) * 0.8
          });
        }
      }
      box.mesh.add(cave);
      box.caveInCount = (box.caveInCount || 0) + 1;

      const startedAt = performance.now();
      const animateCaveIn = (now) => {
        const progress = Math.min((now - startedAt) / 900, 1);
        fragments.forEach((fragment) => {
          const eased = progress * progress;
          fragment.mesh.position.copy(fragment.initialPosition);
          fragment.mesh.position.y -= eased * fragment.fallDistance;
          fragment.mesh.position.z -= progress * 0.7;
          fragment.mesh.rotation.set(
            progress * fragment.rotationX,
            progress * fragment.rotationY,
            progress * fragment.rotationZ
          );
        });
        if (progress < 1) {
          requestAnimationFrame(animateCaveIn);
          return;
        }
        fragments.forEach(({ mesh }) => {
          cave.remove(mesh);
          mesh.geometry.dispose();
        });
      };
      requestAnimationFrame(animateCaveIn);
      return true;
    }

    function breakWorldBarrier(barrier, car, impact) {
      if (!barrier || !barrier.breakable || !gameSettings.destruction) return false;
      barrier.health -= Math.max(1, (impact - 3) * (car.isPlow ? 4 : 2));
      if (barrier.health > 0) return false;

      barrier.destroyed = true;
      worldBarriers.splice(worldBarriers.indexOf(barrier), 1);
      if (barrier.body) world.removeBody(barrier.body);
      cityRoot.remove(barrier.mesh);

      const horizontal = barrier.width > barrier.depth;
      const sectionLength = horizontal ? barrier.width : barrier.depth;
      const pieceCount = Math.min(8, Math.max(3, Math.ceil(sectionLength / 2.5)));
      const material = barrier.kind === 'park-fence' ? parkFenceMaterial : barrier.mesh.material;
      for (let index = 0; index < pieceCount; index++) {
        const pieceLength = sectionLength / pieceCount;
        const offset = -sectionLength / 2 + pieceLength * (index + 0.5);
        const piece = new THREE.Mesh(
          new THREE.BoxGeometry(horizontal ? pieceLength : 0.2, barrier.kind === 'park-fence' ? 0.2 : barrier.height * 0.7, horizontal ? 0.2 : pieceLength),
          material
        );
        piece.position.set(
          barrier.x + (horizontal ? offset : 0),
          barrier.y + barrier.height * 0.25,
          barrier.z + (horizontal ? 0 : offset)
        );
        scene.add(piece);
        if (vehicleDebris.length >= 80) scene.remove(vehicleDebris.shift().mesh);
        vehicleDebris.push({
          mesh: piece,
          velocity: new THREE.Vector3((Math.random() - 0.5) * 8, 2 + Math.random() * 4, (Math.random() - 0.5) * 8),
          createdAt: performance.now()
        });
      }
      showMessage(barrier.kind === 'park-fence' ? 'Fence section smashed open.' : 'Airport wall section smashed open.');
      return true;
    }

    function resolveVehicleMove(car, nextX, nextZ) {
      const now = performance.now();
      const hitProp = destructibleProps.find((prop) => !prop.destroyed && !(car.treeCollisionGrace && car.treeCollisionGrace.prop === prop && now < car.treeCollisionGrace.until) && Math.abs(nextX - prop.x) < prop.radius + 1.25 && Math.abs(nextZ - prop.z) < prop.radius + 2.2);
      const hitBuilding = buildingColliders.find((box) => !box.collapsing && Math.abs(nextX - box.x) < box.sizeX / 2 + 1.25 && Math.abs(nextZ - box.z) < box.sizeZ / 2 + 2.2);
      const hitBarrier = worldBarriers.find((box) => nextX >= box.minX - 1.25 && nextX <= box.maxX + 1.25 && nextZ >= box.minZ - 2.2 && nextZ <= box.maxZ + 2.2);
      const hitCar = cars.find((other) => other !== car && !other.destroyed && Math.hypot(nextX - other.body.position.x, nextZ - other.body.position.z) < 3.2);
      const hitDebris = debrisPieces.find((piece) => !piece.cleared && piece.body.position.y < 7 &&
        Math.abs(nextX - piece.body.position.x) < piece.width / 2 + (car.isPlow ? 2.8 : 1.8) &&
        Math.abs(nextZ - piece.body.position.z) < piece.depth / 2 + (car.isPlow ? 3.2 : 2.2)
      );
      if (!hitProp && !hitBuilding && !hitBarrier && !hitCar) {
        if (hitDebris) {
          const forward = new CANNON.Vec3(Math.sin(car.mesh.rotation.y), 0.15, Math.cos(car.mesh.rotation.y));
          const impulse = Math.min(hitDebris.kind === 'aircraft' ? 1800 : 900, car.body.mass * Math.abs(car.speed) * 0.08);
          hitDebris.body.applyImpulse(forward.scale(impulse), new CANNON.Vec3(0, 0, 0));
          const debrisSpeed = Math.hypot(hitDebris.body.velocity.x, hitDebris.body.velocity.y, hitDebris.body.velocity.z);
          if (debrisSpeed > 22) hitDebris.body.velocity.scale(22 / debrisSpeed, hitDebris.body.velocity);
        }
        car.body.position.x = nextX;
        car.body.position.z = nextZ;
        return true;
      }
      const impact = Math.abs(car.speed);
      dropLicensePlate(car, nextX, nextZ, impact);
      if (hitProp && impact > 5) {
        resolveTreeImpact(hitProp, car, impact);
        car.treeCollisionGrace = { prop: hitProp, until: now + 850 };
      }
      if (hitBarrier && impact > 6) breakWorldBarrier(hitBarrier, car, impact);
      const rebound = hitProp ? -0.55 : -0.16;
      car.speed *= rebound;
      car.body.velocity.x *= rebound;
      car.body.velocity.z *= rebound;
      handleVehicleCrash(car, now, impact, !!hitProp);
      if (gameSettings.destruction && hitBuilding && impact > BUILDING_CAVE_IN_MIN_SPEED) {
        createBuildingCaveIn(hitBuilding, nextX, nextZ, impact);
      }
      if (gameSettings.destruction && hitCar && impact > 4) {
        const otherSpeed = Math.hypot(hitCar.body.velocity.x, hitCar.body.velocity.z);
        const effectiveMass = car.body.mass * hitCar.body.mass / (car.body.mass + hitCar.body.mass);
        const rating = rateCollision(effectiveMass, impact + otherSpeed, 120000, 0.9);
        if (rating.score >= 8) {
          damageVehicle(car, rating.score * 0.55);
          damageVehicle(hitCar, rating.score * 0.55);
          hitCar.body.velocity.x += (hitCar.body.position.x - nextX) * 0.5;
          hitCar.body.velocity.z += (hitCar.body.position.z - nextZ) * 0.5;
        }
      }
      if (gameSettings.destruction && impact > 5 && !hitCar) {
        const rating = rateCollision(car.body.mass, impact, 90000, 0.82);
        if (rating.score >= 8) damageVehicle(car, rating.score * 0.45);
      }
      return false;
    }

    function createBreakableCrate(x, z, size = 1.8, color = 0x8b5d3c, maxHealth = 3) {
      const placement = worldPlacement.reserveNearest(x, z, size, size, 'crate', 0.2);
      if (!placement) return null;
      x = placement.x;
      z = placement.z;
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(size, size, size),
        new THREE.MeshStandardMaterial({ color, roughness: 0.9, metalness: 0.08 })
      );
      mesh.position.set(x, size / 2, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      cityRoot.add(mesh);

      const crate = {
        mesh,
        size,
        health: maxHealth,
        maxHealth,
        hitFlash: 0,
        radius: size * 0.75,
        broken: false
      };
      pushableObjects.push(crate);
      return crate;
    }

    function createNPCCar() {
      const colors = [0xff7f50, 0x3b82f6, 0x34d399, 0xfbbf24, 0xf472b6];
      const color = colors[Math.floor(Math.random() * colors.length)];
      const trafficTypes = ['sedan', 'sedan', 'hatchback', 'hatchback', 'suv', 'pickup', 'van', 'taxi', 'sports'];
      const type = trafficTypes[Math.floor(Math.random() * trafficTypes.length)];
      const direction = Math.random() < 0.5 ? -1 : 1;
      const routeCandidates = asphaltAreas.filter((area) =>
        Math.min(area.halfWidth, area.halfDepth) >= 7 &&
        Math.min(area.halfWidth, area.halfDepth) <= 11 &&
        Math.max(area.halfWidth, area.halfDepth) >= 70
      );
      const centralRoutes = routeCandidates.filter((area) => Math.hypot(area.x, area.z) <= 260);
      const routePool = centralRoutes.length && Math.random() < 0.65 ? centralRoutes : routeCandidates;
      const routeArea = routePool[Math.floor(Math.random() * routePool.length)];
      const horizontal = routeArea ? routeArea.halfWidth > routeArea.halfDepth : true;
      const roadAxis = routeArea ? (horizontal ? routeArea.z : routeArea.x) : 0;
      const routeCenter = routeArea ? (horizontal ? routeArea.x : routeArea.z) : 0;
      const roadHalfWidth = routeArea ? (horizontal ? routeArea.halfDepth : routeArea.halfWidth) : 9;
      const routeHalfLength = routeArea ? (horizontal ? routeArea.halfWidth : routeArea.halfDepth) : 550;
      const laneOffset = Math.min(roadHalfWidth * 0.55, 4.2);
      const fixed = roadAxis + (horizontal ? -direction : direction) * laneOffset;
      const min = routeCenter - routeHalfLength + 16;
      const max = routeCenter + routeHalfLength - 16;
      let along = 0;
      for (let attempt = 0; attempt < 12; attempt++) {
        const centralRange = Math.min(130, routeHalfLength - 16);
        const useCentralRange = routeHalfLength > 180 && Math.random() < 0.65;
        along = useCentralRange
          ? THREE.MathUtils.clamp(routeCenter + (Math.random() * 2 - 1) * centralRange, min, max)
          : min + Math.random() * (max - min);
        const candidateX = horizontal ? along : fixed;
        const candidateZ = horizontal ? fixed : along;
        const overlapsTraffic = npcCars.some((other) =>
          other && !other.destroyed &&
          Math.hypot(other.body.position.x - candidateX, other.body.position.z - candidateZ) < 28
        );
        if (!overlapsTraffic) break;
      }
      const x = horizontal ? along : fixed;
      const z = horizontal ? fixed : along;
      const car = createCar(x, z, color, false, false, type);
      car.npc = true;
      car.driver = createSeatedDriver(car.mesh, 0, -0.08, 0.12, 0.58);
      car.route = { horizontal, fixed, direction, min, max };
      car.speed = 8 + Math.random() * 5;
      car.mesh.rotation.y = horizontal ? direction * Math.PI / 2 : direction < 0 ? Math.PI : 0;
      car.body.position.set(x, 1.2, z);
      car.body.velocity.set(0, 0, 0);
      car.body.quaternion.setFromEuler(0, car.mesh.rotation.y, 0);
      car.mesh.position.copy(car.body.position);
      return car;
    }

    function getQuaternionYaw(quaternion) {
      const x = quaternion.x; const y = quaternion.y; const z = quaternion.z; const w = quaternion.w;
      return Math.atan2(2 * (w * y + x * z), 1 - 2 * (y * y + z * z));
    }

    function getSidewalkPointNear(position) {
      const source = pedestrianSpawnPoints.length ? pedestrianSpawnPoints : sidewalkTargets;
      let best = null; let bestDist = Infinity;
      source.forEach((target) => {
        const d = target.distanceTo(position); if (d < bestDist) { bestDist = d; best = target.clone(); }
      });
      return best || new THREE.Vector3(0, 0, 0);
    }

    function getPedestrianSpawnPoint() {
      const source = pedestrianSpawnPoints.length ? pedestrianSpawnPoints : sidewalkTargets;
      if (!source.length) return new THREE.Vector3(0, 0, 0);
      if (Math.random() < 0.55) {
        for (let attempt = 0; attempt < 12; attempt++) {
          const candidate = source[Math.floor(Math.random() * source.length)];
          if (Math.hypot(candidate.x, candidate.z) <= 260) return candidate.clone();
        }
      }
      return source[Math.floor(Math.random() * source.length)].clone();
    }

    function getNearbyPedestrianDestination(position) {
      const source = pedestrianSpawnPoints.length ? pedestrianSpawnPoints : sidewalkTargets;
      if (!source.length) return new THREE.Vector3(0, 0, 0);
      let nearest = null;
      let nearestDistance = Infinity;
      for (let attempt = 0; attempt < 16; attempt++) {
        const candidate = source[Math.floor(Math.random() * source.length)];
        const distance = candidate.distanceTo(position);
        if (distance < nearestDistance) {
          nearest = candidate;
          nearestDistance = distance;
        }
        if (distance >= 14 && distance <= 110) return candidate.clone();
      }
      return nearest ? nearest.clone() : getPedestrianSpawnPoint();
    }

    const humanTorsoGeometry = new THREE.CylinderGeometry(0.28, 0.32, 0.92, 12);
    const humanHeadGeometry = new THREE.SphereGeometry(0.22, 16, 16);
    const humanArmGeometry = new THREE.CylinderGeometry(0.08, 0.08, 0.52, 8);
    const humanLegGeometry = new THREE.CylinderGeometry(0.1, 0.1, 0.75, 8);

    function createHumanHair(gender) {
      const isFemale = gender === 'female';
      const hairMaterial = new THREE.MeshStandardMaterial({ color: 0x1f1d1b, roughness: 0.84 });
      const group = new THREE.Group();
      if (isFemale) {
        const backHair = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 0.9, 12), hairMaterial);
        backHair.position.set(0, 0.08, -0.1);
        backHair.rotation.z = 0.16;
        group.add(backHair);
        const fringe = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.14, 0.12), hairMaterial);
        fringe.position.set(0, 0.2, 0.14);
        group.add(fringe);
      } else {
        const shortHair = new THREE.Mesh(new THREE.SphereGeometry(0.23, 12, 12, 0, Math.PI * 2, 0, Math.PI / 2), hairMaterial);
        shortHair.position.set(0, 0.08, 0.04);
        shortHair.scale.set(1.0, 0.7, 1.0);
        group.add(shortHair);
      }
      return { group, gender: isFemale ? 'female' : 'male' };
    }

    function makeMedicalCross() {
      const group = new THREE.Group();
      const red = new THREE.MeshStandardMaterial({ color: 0xdf253a, emissive: 0x7d1829, emissiveIntensity: 0.28, roughness: 0.7 });
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.04, 0.04), red);
      const stem = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.18, 0.04), red);
      bar.position.set(0, 0.08, 0.16);
      stem.position.set(0, 0.08, 0.16);
      group.add(bar, stem);
      return group;
    }

    function applyMedicalUniform(person) {
      if (!person || !person.torso) return;
      const whiteSuit = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.72 });
      const pants = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.82 });
      person.torso.material = whiteSuit;
      if (person.leftLeg && person.leftLeg.children[0]) person.leftLeg.children[0].material = pants;
      if (person.rightLeg && person.rightLeg.children[0]) person.rightLeg.children[0].material = pants;
      const cross = makeMedicalCross();
      person.torso.add(cross);
      person.medicalCross = cross;
      person.isMedic = true;
    }

    function generateClothingOutfit() {
      const outfits = [
        { shirt: 0x256d85, pants: 0x26354d, skin: 0xf0c7a5 },
        { shirt: 0xb94739, pants: 0x39495a, skin: 0xe8b996 },
        { shirt: 0x587c4a, pants: 0x383630, skin: 0xf4d2bc },
        { shirt: 0xd29a35, pants: 0x34435c, skin: 0xb97855 },
        { shirt: 0x824e89, pants: 0x34313b, skin: 0x8c563c },
        { shirt: 0x3b526c, pants: 0x816847, skin: 0xf1c7a2 },
        { shirt: 0xd3d8d6, pants: 0x4b5155, skin: 0x6d4231 },
        { shirt: 0x2f8374, pants: 0x302e3d, skin: 0xd99d77 }
      ];
      const outfit = outfits[Math.floor(Math.random() * outfits.length)];
      return { ...outfit, style: Math.floor(Math.random() * 4) };
    }

    function createBuildingWorker(building, x, z) {
      const outfit = generateClothingOutfit();
      const skin = new THREE.MeshStandardMaterial({ color: outfit.skin, roughness: 0.88 });
      const shirt = new THREE.MeshStandardMaterial({ color: outfit.shirt, roughness: 0.78 });
      const pants = new THREE.MeshStandardMaterial({ color: outfit.pants, roughness: 0.82 });
      const worker = new THREE.Group();
      const torso = new THREE.Mesh(humanTorsoGeometry, shirt);
      torso.position.y = 1.18;
      const head = new THREE.Mesh(humanHeadGeometry, skin);
      head.position.y = 1.9;
      const leftArm = new THREE.Group();
      const rightArm = new THREE.Group();
      const leftSleeve = new THREE.Mesh(humanArmGeometry, shirt);
      const rightSleeve = new THREE.Mesh(humanArmGeometry, shirt);
      leftSleeve.position.y = -0.25;
      rightSleeve.position.y = -0.25;
      leftArm.add(leftSleeve);
      rightArm.add(rightSleeve);
      leftArm.position.set(-0.33, 1.33, 0.22);
      rightArm.position.set(0.33, 1.33, 0.22);
      const leftLeg = new THREE.Mesh(humanLegGeometry, pants);
      const rightLeg = new THREE.Mesh(humanLegGeometry, pants);
      leftLeg.position.set(-0.13, 0.33, 0);
      rightLeg.position.set(0.13, 0.33, 0);
      worker.add(torso, head, leftArm, rightArm, leftLeg, rightLeg);
      worker.position.set(x, 0.12, z);
      worker.rotation.y = Math.PI;
      worker.traverse((part) => {
        if (!part.isMesh) return;
        part.castShadow = true;
        part.receiveShadow = true;
      });
      building.add(worker);
      buildingWorkers.push({ mesh: worker, leftArm, rightArm, phase: Math.random() * Math.PI * 2, outfit });
    }

    function updateBuildingWorkers(now) {
      buildingWorkers.forEach((worker) => {
        const workMotion = Math.sin(now * 0.006 + worker.phase) * 0.32;
        worker.leftArm.rotation.x = -0.75 + workMotion;
        worker.rightArm.rotation.x = -0.75 - workMotion;
        worker.mesh.rotation.y = Math.PI + Math.sin(now * 0.0005 + worker.phase) * 0.08;
      });
    }

    function createHuman(type = 'A', state = 'State_Default', addToScene = true) {
      const group = new THREE.Group();
      const outfit = generateClothingOutfit();
      const genderRoll = Math.random() < 0.5 ? 'female' : 'male';
      const hair = createHumanHair(genderRoll);
      const torsoMaterial = new THREE.MeshStandardMaterial({ color: outfit.shirt });
      const skinMat = new THREE.MeshStandardMaterial({ color: outfit.skin });
      const pantsMat = new THREE.MeshStandardMaterial({ color: outfit.pants });
      const torso = new THREE.Mesh(humanTorsoGeometry, torsoMaterial); torso.position.y = 1.18; torso.castShadow = true; group.add(torso);
      const head = new THREE.Mesh(humanHeadGeometry, skinMat); head.position.y = 1.9; head.castShadow = true; group.add(head);
      head.add(hair.group);
      const leftArm = new THREE.Group(); const rightArm = new THREE.Group(); const leftLeg = new THREE.Group(); const rightLeg = new THREE.Group();
      const leftArmMesh = new THREE.Mesh(humanArmGeometry, skinMat); leftArmMesh.position.y = -0.28; leftArm.add(leftArmMesh); leftArm.position.set(-0.33, 1.33, 0); group.add(leftArm);
      const rightArmMesh = new THREE.Mesh(humanArmGeometry, skinMat); rightArmMesh.position.y = -0.28; rightArm.add(rightArmMesh); rightArm.position.set(0.33, 1.33, 0); group.add(rightArm);
      const leftLegMesh = new THREE.Mesh(humanLegGeometry, pantsMat); leftLegMesh.position.y = -0.48; leftLeg.add(leftLegMesh); leftLeg.position.set(-0.12, 0.7, 0); group.add(leftLeg);
      const rightLegMesh = new THREE.Mesh(humanLegGeometry, pantsMat); rightLegMesh.position.y = -0.48; rightLeg.add(rightLegMesh); rightLeg.position.set(0.12, 0.7, 0); group.add(rightLeg);
      const start = getPedestrianSpawnPoint(); group.position.copy(start);
      const destination = getPedestrianSpawnPoint();

      const useDevice = Math.random() < 0.4;
      const deviceType = useDevice && Math.random() < 0.5 ? 'phone' : (useDevice ? 'laptop' : 'none');
      const deviceGroup = new THREE.Group();
      const deviceMesh = new THREE.Mesh(
        new THREE.BoxGeometry(deviceType === 'phone' ? 0.18 : 0.46, deviceType === 'phone' ? 0.34 : 0.26, 0.03),
        new THREE.MeshBasicMaterial({ map: deviceType === 'phone' ? textures.phoneScreenGif : textures.laptopScreenGif, transparent: true, side: THREE.DoubleSide })
      );
      deviceMesh.position.set(0, 1.6, 0.18);
      deviceGroup.add(deviceMesh);
      group.add(deviceGroup);
      deviceGroup.visible = !!useDevice;

      const person = {
        mesh: group,
        leftArm,
        rightArm,
        leftLeg,
        rightLeg,
        torso,
        destination,
        speed: 1.3 + Math.random() * 0.8,
        velocity: 1.0,
        walkPhase: Math.random() * Math.PI * 2,
        isPunching: false,
        punchUntil: 0,
        task: 'walk',
        bench: null,
        deviceType,
        deviceGroup,
        deviceMesh,
        useDevice,
        gender: hair.gender,
        hair: hair.group,
        benchTimer: 0,
        type,
        outfit,
        state,
        targetTypeObject: null,
        targetUser: null,
        parentTarget: null,
        path: [],
        pathIndex: 0,
        pathTimer: 0,
        linkRelease: null,
        linkedUserOffset: new THREE.Vector3(),
        pursuitVelocity: 0,
        collisionRadius: 1.1,
        boundingBox: { minX: -0.45, maxX: 0.45, minZ: -0.45, maxZ: 0.45 }
      };

      if (benchSeats.length && Math.random() < 0.35) {
        const benchChoice = benchSeats[Math.floor(Math.random() * benchSeats.length)];
        person.task = 'bench';
        person.bench = benchChoice;
      }

      group.scale.x = type === 'A' ? 1.0 : 0.4;
      group.scale.y = 1.0;
      group.scale.z = 1.0;
      if (addToScene) {
        scene.add(group);
        person.renderAttached = true;
      } else {
        person.renderAttached = false;
      }
      people.push(person); return person;
    }

    function attachAmbulanceLights(car) {
      if (!car || !car.mesh || car.mesh.userData.ambulanceLights) return;
      const ambulanceBar = new THREE.Group();
      const lightSpecs = [
        { side: -1, color: 0xff3d3d },
        { side: 1, color: 0x1d4ed8 }
      ];
      lightSpecs.forEach(({ side, color }) => {
        const bulb = new THREE.Mesh(
          new THREE.SphereGeometry(0.14, 12, 12),
          new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.2, roughness: 0.35 })
        );
        bulb.position.set(side * 0.64, 1.9, 0.15);
        ambulanceBar.add(bulb);
      });
      car.mesh.add(ambulanceBar);
      car.mesh.userData.ambulanceLights = ambulanceBar.children;
    }

    function getNearestRescueCar(position) {
      const candidates = cars.filter((car) => !car.destroyed && car.body && car.mesh && !car.isAmbulance);
      if (!candidates.length) return null;
      candidates.sort((a, b) => {
        const da = Math.hypot(a.body.position.x - position.x, a.body.position.z - position.z);
        const db = Math.hypot(b.body.position.x - position.x, b.body.position.z - position.z);
        return da - db;
      });
      return candidates[0];
    }

    function triggerMedicalRescue() {
      if (!gameSettings.medicalRescue || medicalRescueState.active) return;
      const ambulance = getNearestRescueCar(playerState.position) || createCar(playerState.position.x + 8, playerState.position.z + 7, 0xf8fafc, false, false, 'ambulance');
      attachAmbulanceLights(ambulance);
      ambulance.isAmbulance = true;
      ambulance.medicalLights = true;
      ambulance.parked = false;
      ambulance.owner = 'medical';
      ambulance.body.type = CANNON.Body.DYNAMIC;
      ambulance.body.mass = 220;
      ambulance.body.updateMassProperties();

      const medics = [];
      for (let index = 0; index < 2; index++) {
        const medic = createHuman('A', 'State_Default', true);
        medic.mesh.scale.setScalar(0.96);
        medic.task = 'medical';
        medic.deviceGroup.visible = false;
        medic.mesh.position.set(playerState.position.x + (index === 0 ? -1.2 : 1.2), 0, playerState.position.z + 1.4);
        medic.active = true;
        applyMedicalUniform(medic);
        medics.push(medic);
      }

      medicalRescueState.active = true;
      medicalRescueState.ambulance = ambulance;
      medicalRescueState.medics = medics;
      medicalRescueState.startedAt = performance.now();
      medicalRescueState.patientLoaded = false;
      playerInputActive = false;
      playerState.velocity.set(0, 0, 0);
      playerCharacter.visible = false;
      showMessage('Emergency medical response is on the way.');
    }

    function updateMedicalRescue(dt, now) {
      if (!medicalRescueState.active) {
        const floorY = groundHeightAt(playerState.position.x, playerState.position.z) + 1.7;
        const prone = playerState.onGround && !flyMode && !controlledVehicle && !controlledBoat && !controlledAirplane && !playerState.seatedOn && !playerState.inRiver && playerState.position.y <= floorY + 0.9;
        if (prone) {
          const hasMovementInput = walkKeys.forward || walkKeys.backward || walkKeys.left || walkKeys.right;
          const movementDistance = playerState.position.distanceTo(playerState.lastGroundedPosition);
          if (hasMovementInput || movementDistance > 0.12) {
            playerState.lastGroundedMoveAt = now;
            playerState.lastGroundedPosition.copy(playerState.position);
          } else if (now - playerState.lastGroundedMoveAt > 3000) {
            triggerMedicalRescue();
          }
        } else {
          playerState.lastGroundedMoveAt = now;
          playerState.lastGroundedPosition.copy(playerState.position);
        }
        return;
      }

      const rescue = medicalRescueState;
      const ambulance = rescue.ambulance;
      const medics = rescue.medics || [];
      if (!ambulance || ambulance.destroyed || !ambulance.body || !ambulance.mesh) {
        medicalRescueState.active = false;
        return;
      }

      const ambulanceForward = new THREE.Vector3(Math.sin(ambulance.mesh.rotation.y), 0, Math.cos(ambulance.mesh.rotation.y));
      const patientPosition = playerState.position.clone();

      if (!rescue.patientLoaded) {
        medics.forEach((medic, index) => {
          const target = patientPosition.clone().add(new THREE.Vector3(index === 0 ? -0.9 : 0.9, 0, 1.2));
          const diff = target.clone().sub(medic.mesh.position);
          if (diff.lengthSq() > 0.05) {
            diff.y = 0;
            medic.mesh.position.addScaledVector(diff.normalize(), Math.min(diff.length(), 3.2 * dt));
            medic.mesh.rotation.y = Math.atan2(diff.x, diff.z);
          }
        });
        const closeEnough = medics.every((medic, index) => {
          const target = patientPosition.clone().add(new THREE.Vector3(index === 0 ? -0.9 : 0.9, 0, 1.2));
          return medic.mesh.position.distanceTo(target) < 0.8;
        });
        if (closeEnough) {
          rescue.patientLoaded = true;
        }
      } else {
        ambulance.body.velocity.x = ambulanceForward.x * 26;
        ambulance.body.velocity.z = ambulanceForward.z * 26;
        ambulance.mesh.rotation.y = Math.atan2(ambulanceForward.x, ambulanceForward.z);
        const distance = Math.hypot(ambulance.body.position.x - playerState.position.x, ambulance.body.position.z - playerState.position.z);
        if (distance > 180) {
          medics.forEach((medic) => { if (medic && medic.mesh) scene.remove(medic.mesh); });
          if (ambulance && ambulance.mesh && ambulance.mesh.parent) scene.remove(ambulance.mesh);
          const index = cars.indexOf(ambulance);
          if (index >= 0) cars.splice(index, 1);
          medicalRescueState.active = false;
          playerCharacter.visible = true;
          setSafePlayerPosition(playerState.position.x + 10, 1.7, playerState.position.z + 10);
          playerInputActive = true;
          showMessage('The patient has been taken to hospital.');
        }
      }

      ambulance.mesh.position.set(ambulance.body.position.x, ambulance.body.position.y, ambulance.body.position.z);
      ambulance.mesh.rotation.y = getQuaternionYaw(ambulance.body.quaternion);
      medics.forEach((medic) => {
        if (!medic || !medic.mesh) return;
        medic.mesh.position.y = groundHeightAt(medic.mesh.position.x, medic.mesh.position.z) + 0.02;
        medic.mesh.visible = true;
      });
    }

    function createSeatedDriver(parent, x, y, z, scale) {
      const driver = createHuman('A');
      const personIndex = people.indexOf(driver);
      if (personIndex >= 0) people.splice(personIndex, 1);
      parent.add(driver.mesh);
      driver.mesh.position.set(x, y, z);
      driver.mesh.rotation.set(0, 0, 0);
      driver.mesh.scale.setScalar(scale);
      driver.leftLeg.rotation.x = -Math.PI / 2;
      driver.rightLeg.rotation.x = -Math.PI / 2;
      driver.leftArm.rotation.x = -0.65;
      driver.rightArm.rotation.x = -0.65;
      driver.deviceGroup.visible = false;
      driver.task = 'driver';
      driver.active = false;
      return driver;
    }

    function restoreDriverToPedestrian(driver, x, z, yaw) {
      driver.mesh.scale.set(driver.type === 'A' ? 1 : 0.4, 1, 1);
      driver.mesh.rotation.set(0, yaw, 0);
      driver.mesh.position.set(x, groundHeightAt(x, z) + 0.03, z);
      driver.leftLeg.rotation.x = 0;
      driver.rightLeg.rotation.x = 0;
      driver.leftArm.rotation.x = 0;
      driver.rightArm.rotation.x = 0;
      driver.task = 'walk';
      driver.bench = null;
      driver.destination = getNearbyPedestrianDestination(driver.mesh.position);
      driver.path = [];
      driver.pathIndex = 0;
      driver.active = true;
      driver.knockedDown = false;
      driver.ridingBoat = null;
      driver.mesh.visible = true;
      if (!people.includes(driver)) people.push(driver);
    }

    function ejectCarDriver(car) {
      if (!car || !car.driver) return;
      const driver = car.driver;
      const yaw = car.mesh.rotation.y;
      scene.attach(driver.mesh);
      const x = car.body.position.x + Math.cos(yaw) * 3.2;
      const z = car.body.position.z - Math.sin(yaw) * 3.2;
      restoreDriverToPedestrian(driver, x, z, yaw + Math.PI / 2);
      car.driver = null;
    }

    function ejectAirplaneDriver(aircraft) {
      if (!aircraft || !aircraft.driver) return;
      const driver = aircraft.driver;
      aircraft.mesh.updateMatrixWorld(true);
      scene.attach(driver.mesh);
      driver.mesh.scale.setScalar(0.62);
      driver.mesh.rotation.x = Math.PI / 2;
      driver.active = false;
      driver.mesh.visible = true;
      fallingDrivers.push({ person: driver, velocity: new THREE.Vector3(0, -1, 0) });
      aircraft.driver = null;
    }

    function buildNavigationGraph() {
      navigationNodes.length = 0;
      navigationEdges.clear();
      const minX = -520;
      const maxX = 520;
      const minZ = -520;
      const maxZ = 520;
      const spacing = 30;
      for (let x = minX; x <= maxX; x += spacing) {
        for (let z = minZ; z <= maxZ; z += spacing) {
          const node = { x, z, neighbors: [] };
          navigationNodes.push(node);
          const key = `${x},${z}`;
          navigationEdges.set(key, node.neighbors);
        }
      }
      navigationNodes.forEach((node) => {
        const { x, z } = node;
        for (const offset of [[spacing, 0], [-spacing, 0], [0, spacing], [0, -spacing]]) {
          const adjacent = navigationEdges.get(`${x + offset[0]},${z + offset[1]}`);
          if (adjacent) node.neighbors.push({ x: x + offset[0], z: z + offset[1] });
        }
      });
      return navigationNodes;
    }

    function getNearestNavigationNode(position) {
      let best = navigationNodes[0];
      let bestDistance = Infinity;
      navigationNodes.forEach((node) => {
        const distance = Math.hypot(node.x - position.x, node.z - position.z);
        if (distance < bestDistance) {
          bestDistance = distance;
          best = node;
        }
      });
      return best;
    }

    function getNavigationPath(startPosition, endPosition) {
      if (!navigationNodes.length) return [];
      const startNode = getNearestNavigationNode(startPosition);
      const endNode = getNearestNavigationNode(endPosition);
      const startKey = `${startNode.x},${startNode.z}`;
      const endKey = `${endNode.x},${endNode.z}`;
      const queue = [startNode];
      const visited = new Set([startKey]);
      const parents = new Map();
      let queueIndex = 0;
      while (queueIndex < queue.length && !visited.has(endKey)) {
        const current = queue[queueIndex++];
        const currentKey = `${current.x},${current.z}`;
        const neighbors = navigationEdges.get(currentKey) || [];
        neighbors.forEach((neighbor) => {
          const neighborKey = `${neighbor.x},${neighbor.z}`;
          if (visited.has(neighborKey)) return;
          visited.add(neighborKey);
          parents.set(neighborKey, currentKey);
          queue.push({ x: neighbor.x, z: neighbor.z });
        });
      }
      const path = [];
      let currentKey = endKey;
      if (!visited.has(endKey)) {
        return [endPosition.clone()];
      }
      while (currentKey !== startKey) {
        const match = currentKey.match(/^(-?\d+),(-?\d+)$/);
        if (!match) break;
        path.unshift(new THREE.Vector3(Number(match[1]), 0, Number(match[2])));
        currentKey = parents.get(currentKey);
      }
      path.unshift(new THREE.Vector3(startNode.x, 0, startNode.z));
      if (!path.length) path.push(endPosition.clone());
      return path;
    }

    function createBoundaryZone(x, z, radius, color, label) {
      const zone = new THREE.Group();
      zone.position.set(x, 0, z);
      const ring = new THREE.Mesh(
        new THREE.CylinderGeometry(radius, radius, 0.6, 32),
        new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.3, transparent: true, opacity: 0.68 })
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.3;
      zone.add(ring);
      const trigger = new THREE.Mesh(
        new THREE.CylinderGeometry(radius * 0.7, radius * 0.7, 2.2, 20),
        new THREE.MeshStandardMaterial({ color: 0x111827, transparent: true, opacity: 0.2 })
      );
      trigger.position.y = 1.1;
      zone.add(trigger);
      zone.userData = { label, radius, color, trigger };
      scene.add(zone);
      boundaryZones.push(zone);
      return zone;
    }

    function addBoundaryZones() {
      const boundaryConfig = [
        { x: -430, z: 0, radius: 26, color: 0x60a5fa, label: 'North boundary' },
        { x: 430, z: 0, radius: 26, color: 0xa78bfa, label: 'South boundary' }
      ];
      boundaryConfig.forEach((spec) => createBoundaryZone(spec.x, spec.z, spec.radius, spec.color, spec.label));
    }

    function updateBoundaryZoneState() {
      let activeZone = null;
      boundaryZones.forEach((zone) => {
        const distance = Math.hypot(playerState.position.x - zone.position.x, playerState.position.z - zone.position.z);
        const active = distance <= zone.userData.radius + 3.5;
        zone.userData.trigger.visible = active;
        zone.rotation.y += active ? 0.02 : 0.004;
        if (active) activeZone = zone;
      });
      return activeZone;
    }

    function activateVerticalTracking() {
      controllerVerticalTracking = true;
      playerState.position.y = Math.max(playerState.position.y, 6);
      playerState.onGround = false;
      showMessage('Vertical tracking mode');
    }

    function resetPopulationState() {
      people.forEach((person) => {
        if (person.state === 'State_LinkedToUser') {
          person.state = 'State_Default';
          person.linkRelease = null;
          person.targetTypeObject = null;
          person.targetUser = null;
          person.path = [];
        }
      });
    }

    function setFullscreenFlash(active) {
      fullscreenFlash.style.opacity = active ? '1' : '0';
    }

    function triggerInputConflict() {
      if (!gameSettings.npcs) return;
      const pursuing = people.filter((person) => person.type === 'A' && person.state === 'State_Pursuit');
      const linked = people.filter((person) => person.type === 'B' && person.state === 'State_LinkedToUser');
      if (!pursuing.length || !linked.length) return;
      const now = performance.now();
      if (playerStunUntil > now) return;
      const pursuingTarget = pursuing.find((person) => {
        const distance = Math.hypot(playerState.position.x - person.mesh.position.x, playerState.position.z - person.mesh.position.z);
        return distance < person.collisionRadius + 1.9;
      });
      const linkedTarget = linked.find((person) => {
        const distance = Math.hypot(playerState.position.x - person.mesh.position.x, playerState.position.z - person.mesh.position.z);
        return distance < person.collisionRadius + 2.25;
      });
      if (!pursuingTarget || !linkedTarget || playingConflictLoop) return;
      playingConflictLoop = true;
      const loopCount = 3 + Math.floor(Math.random() * 3);
      let iteration = 0;
      const runIteration = () => {
        const delay = 0.2 + Math.random() * 0.3;
        setFullscreenFlash(true);
        setTimeout(() => setFullscreenFlash(false), 200);
        if (iteration === 0) {
          playerInputActive = false;
          playerStunUntil = performance.now() + 3000;
          const groundedY = groundHeightAt(playerState.position.x, playerState.position.z) + 1.7;
          playerState.position.y = groundedY;
          playerState.velocity.y = 0;
          playerState.onGround = true;
        }
        iteration += 1;
        if (iteration < loopCount) {
          setTimeout(runIteration, delay * 1000);
        } else {
          setTimeout(() => { playingConflictLoop = false; }, 500);
        }
      };
      runIteration();
    }

    function createBoat(z) {
      const mesh = new THREE.Group();
      const hull = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 1.05, 5.2, 10), new THREE.MeshStandardMaterial({ color: 0x7b482b, roughness: 0.76, metalness: 0.06 }));
      hull.rotation.x = Math.PI / 2; hull.position.y = -0.15; mesh.add(hull);
      const floor = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.12, 3.7), new THREE.MeshStandardMaterial({ color: 0x9b704a, roughness: 0.85 }));
      floor.position.y = 0.12; mesh.add(floor);
      for (const seatZ of [-1.1, 0.5, 1.5]) {
        const seat = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.14, 0.36), new THREE.MeshStandardMaterial({ color: 0x886143, roughness: 0.88 }));
        seat.position.set(0, 0.38, seatZ); mesh.add(seat);
      }
      mesh.position.set(RIVER_X, RIVER_SURFACE_Y, z);
      mesh.traverse((part) => { if (part.isMesh) { part.castShadow = true; part.receiveShadow = true; } });
      scene.add(mesh);
      const boat = { mesh, crew: [], paddler: null, heading: Math.random() * Math.PI * 2, speed: 1.1, nextTurn: 0, paddle: null };
      const crewCount = 2 + Math.floor(Math.random() * 2);
      for (let i = 0; i < crewCount; i++) {
        const person = createHuman();
        person.task = 'boat';
        person.bench = null;
        person.ridingBoat = boat;
        boat.crew.push(person);
        if (i === 0) boat.paddler = person;
      }
      const paddle = new THREE.Group();
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 2.8, 8), new THREE.MeshStandardMaterial({ color: 0x66452e, roughness: 0.72 }));
      shaft.rotation.z = Math.PI / 2; paddle.add(shaft);
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.12, 0.36), new THREE.MeshStandardMaterial({ color: 0x9c744e, roughness: 0.76 }));
      blade.position.x = 1.45; paddle.add(blade);
      mesh.add(paddle);
      boat.paddle = paddle;
      boats.push(boat);
      return boat;
    }

    function createBoats() {
      createBoat(-170);
      createBoat(170);
    }

    function updateBoats(dt) {
      const now = performance.now();
      boats.forEach((boat) => {
        if (controlledBoat === boat) {
          boat.heading += ((walkKeys.right ? 1 : 0) - (walkKeys.left ? 1 : 0)) * dt * 1.4;
          boat.speed = THREE.MathUtils.clamp(boat.speed + ((walkKeys.forward ? 1 : 0) - (walkKeys.backward ? 1 : 0)) * dt * 1.8, 0, 5);
        } else if (now > boat.nextTurn) {
          boat.heading = Math.random() * Math.PI * 2;
          boat.speed = 0.7 + Math.random() * 1.2;
          boat.nextTurn = now + 2500 + Math.random() * 3500;
        }
        boat.mesh.position.x = THREE.MathUtils.clamp(boat.mesh.position.x + Math.sin(boat.heading) * boat.speed * dt, RIVER_X - 11, RIVER_X + 11);
        boat.mesh.position.z += Math.cos(boat.heading) * boat.speed * dt;
        if (boat.mesh.position.z > 580) boat.mesh.position.z = -580;
        if (boat.mesh.position.z < -580) boat.mesh.position.z = 580;
        boat.mesh.rotation.y = boat.heading;
        boat.paddle.rotation.z = Math.sin(now * 0.008) * 0.42;
        boat.crew.forEach((person, index) => {
          const sideOffset = index === 0 ? 0.48 : index % 2 === 0 ? -0.45 : 0.45;
          const rowOffset = index === 0 ? -0.15 : index === 1 ? 1.0 : -1.1;
          person.mesh.visible = person !== boat.paddler || controlledBoat !== boat;
          person.mesh.position.set(boat.mesh.position.x + Math.cos(boat.heading) * sideOffset, RIVER_SURFACE_Y - 0.35, boat.mesh.position.z - Math.sin(boat.heading) * sideOffset + rowOffset);
          person.mesh.rotation.set(0, boat.heading, 0);
          const paddling = person === boat.paddler && controlledBoat !== boat;
          person.leftArm.rotation.x = paddling ? Math.sin(now * 0.008) * 0.8 : 0;
          person.rightArm.rotation.x = paddling ? -Math.sin(now * 0.008) * 0.8 : 0;
        });
        if (playerState.boat === boat) {
          playerState.position.set(boat.mesh.position.x, RIVER_SURFACE_Y + 1.7, boat.mesh.position.z + 0.3);
          playerState.yaw = boat.heading;
        }
      });
    }

    function tryBoardBoat(event) {
      if (!gameStarted || !menu.classList.contains('hidden') || controlledVehicle || playerState.boat) return false;
      const raycaster = getPointerRaycaster(event);
      const pickables = boats.flatMap((boat) => [boat.mesh, ...boat.crew.map((person) => person.mesh)]);
      const hits = raycaster.intersectObjects(pickables, true);
      let selectedBoat = null;
      let selectedPaddler = false;
      if (hits.length) {
        for (let object = hits[0].object; object && !selectedBoat; object = object.parent) {
          selectedBoat = boats.find((boat) => boat.mesh === object || boat.crew.some((person) => person.mesh === object));
          if (selectedBoat) selectedPaddler = selectedBoat.paddler.mesh === object;
        }
      }
      if (!selectedBoat) {
        const position = playerState.position;
        selectedBoat = boats.find((boat) => Math.hypot(boat.mesh.position.x - position.x, boat.mesh.position.z - position.z) < 8) || null;
      }
      if (!selectedBoat) return false;
      if (Math.hypot(selectedBoat.mesh.position.x - playerState.position.x, selectedBoat.mesh.position.z - playerState.position.z) > 14) return false;
      playerState.boat = selectedBoat;
      if (selectedPaddler) controlledBoat = selectedBoat;
      syncActiveMode();
      showMessage(selectedPaddler ? 'You are paddling. Use WASD to steer.' : 'Boarded the boat. Click the paddler to take the oars.');
      return true;
    }

    function leaveBoat() {
      if (!playerState.boat) return;
      const boat = playerState.boat;
      playerState.position.set(boat.mesh.position.x, RIVER_SURFACE_Y + 1.7, boat.mesh.position.z);
      playerState.inRiver = true;
      playerState.boat = null;
      controlledBoat = null;
      syncActiveMode();
      clearVehicleKeys();
      showMessage('You are in the river. The boat crew has the oars again.');
    }

    function createPeople() {
      const populationCount = (webOptimizer.lowLag
        ? 120 + Math.floor(Math.random() * 21)
        : 180 + Math.floor(Math.random() * 31)) * 10;
      const typeA = Math.floor(populationCount * 0.7);
      const typeB = populationCount - typeA;
      const linkedTargetCount = Math.max(1, Math.round(typeB * 0.1));
      const linkedIndexes = new Set();
      while (linkedIndexes.size < linkedTargetCount) {
        linkedIndexes.add(Math.floor(Math.random() * typeB));
      }
      const typeAObjects = [];
      for (let i = 0; i < populationCount; i++) {
        const type = i < typeA ? 'A' : 'B';
        const person = createHuman(type, 'State_Default', false);
        person.mesh.position.set(person.mesh.position.x + (i % 2) * 1.2, 0, person.mesh.position.z + Math.floor(i / 2) * 0.6);
        if (type === 'A') typeAObjects.push(person);
      }
      const typeBObjects = people.filter((person) => person.type === 'B');
      typeBObjects.forEach((person, index) => {
        if (!linkedIndexes.has(index)) return;
        person.targetTypeObject = typeAObjects[index % typeAObjects.length];
        person.state = 'State_Default';
      });
      createParkActivities(typeAObjects, typeBObjects);
      entityPopulation = people.slice();
    }

    function addParkChildAccessories(person) {
      const hat = new THREE.Group();
      const colorMaterial = childCapMaterials[Math.floor(Math.random() * childCapMaterials.length)];
      const brim = new THREE.Mesh(childCapBrimGeometry, colorMaterial);
      brim.position.y = 2.08;
      brim.castShadow = true;
      const crown = new THREE.Mesh(childCapCrownGeometry, colorMaterial);
      crown.position.y = 2.08;
      crown.scale.set(0.9, 0.82, 0.9);
      crown.castShadow = true;
      hat.add(brim, crown);
      person.mesh.add(hat);
      person.capHat = hat;

      const top = new THREE.Group();
      const topMaterial = spinningTopMaterials[Math.floor(Math.random() * spinningTopMaterials.length)];
      const body = new THREE.Mesh(spinningTopBodyGeometry, topMaterial);
      body.scale.y = 0.7;
      body.castShadow = true;
      const point = new THREE.Mesh(spinningTopPointGeometry, topMaterial);
      point.rotation.z = Math.PI;
      point.position.y = -0.12;
      top.add(body, point);
      top.position.set(0.48, 1.14, 0.12);
      person.mesh.add(top);
      person.spinningTop = top;
    }

    function createParkActivities(typeAObjects, typeBObjects) {
      const park = parkActivityAreas.find((area) => area.activityPark);
      if (!park) return;

      const availableChildren = typeBObjects.filter((person) =>
        person && person.state !== 'State_LinkedToUser' && person.task !== 'bench' && !person.ridingBoat
      );
      const playerCount = Math.min(availableChildren.length, 4 + Math.floor(Math.random() * 5));
      for (let index = 0; index < playerCount; index++) {
        const person = availableChildren[index];
        person.task = 'park-play';
        person.bench = null;
        person.parkCenter = new THREE.Vector3(park.x, 0, park.z);
        person.mesh.position.set(
          park.x + (Math.random() - 0.5) * 20,
          0,
          park.z + (Math.random() - 0.5) * 16
        );
        person.destination.set(
          park.x + (Math.random() - 0.5) * 22,
          0,
          park.z + (Math.random() - 0.5) * 18
        );
        person.parkPauseUntil = 0;
        person.speed = 2.1 + Math.random() * 0.7;
        person.parkActivity = true;
        person.mesh.scale.set(0.7, 0.68, 0.7);
        person.walkPhase = Math.random() * Math.PI * 2;
        addParkChildAccessories(person);
      }

      const availableWalkers = typeAObjects.filter((person) =>
        person && person.state !== 'State_Pursuit' && person.state !== 'State_LinkedToUser' &&
        person.task !== 'bench' && !person.ridingBoat
      );
      const walkerCount = Math.min(availableWalkers.length, 1 + Math.floor(Math.random() * 2));
      for (let index = 0; index < walkerCount; index++) {
        const person = availableWalkers[index];
        person.task = 'park-lap';
        person.bench = null;
        person.parkCenter = new THREE.Vector3(park.x, 0, park.z);
        person.parkRadius = 30 + Math.random() * 2;
        person.parkAngle = Math.random() * Math.PI * 2;
        person.parkLapSpeed = (0.75 + Math.random() * 0.2) * (Math.random() < 0.5 ? -1 : 1);
        person.parkActivity = true;
        person.mesh.position.set(
          park.x + Math.cos(person.parkAngle) * person.parkRadius,
          0,
          park.z + Math.sin(person.parkAngle) * person.parkRadius
        );
      }
    }

    function updateHumans(dt) {
      if (!gameSettings.npcs) return;
      const now = performance.now();
      const lowLagHumans = webOptimizer.lowLag;
      people.forEach((person) => {
        if (!person.active) return;
        if (person.deviceGroup) person.deviceGroup.visible = person.useDevice && person.task !== 'walk' ? true : person.useDevice;

        if (person.ridingBoat) return;
        if (person.knockedDown) {
          if (person.knockedDown.getUp && now >= person.knockedDown.until) {
            person.knockedDown = null;
            person.mesh.rotation.set(0, person.mesh.rotation.y, 0);
          } else {
            person.mesh.rotation.z = 1.45;
            return;
          }
        }
        if (now > (person.nextImpactAt || 0)) {
          const impactCar = cars.find((car) => !car.destroyed && Math.abs(car.speed) > 6 && Math.hypot(car.mesh.position.x - person.mesh.position.x, car.mesh.position.z - person.mesh.position.z) < 2.2);
          const playerMoving = !controlledVehicle && (walkKeys.forward || walkKeys.backward || walkKeys.left || walkKeys.right);
          const playerDistance = Math.hypot(playerState.position.x - person.mesh.position.x, playerState.position.z - person.mesh.position.z);
          if (impactCar || (playerMoving && playerDistance < 1.4)) {
            person.knockedDown = { getUp: Math.random() < 0.5, until: now + 1800 };
            person.nextImpactAt = now + 2500;
            person.mesh.rotation.z = 1.45;
            return;
          }
        }

        if (person.isPunching && now < person.punchUntil) {
          if (lowLagHumans) {
            person.mesh.rotation.z = 0; person.mesh.rotation.x = 0; person.leftArm.rotation.x = 0; person.rightArm.rotation.x = 0; person.leftLeg.rotation.x = 0; person.rightLeg.rotation.x = 0;
          } else {
            person.mesh.rotation.z = Math.sin(now * 0.02) * 0.45; person.mesh.rotation.x = 1.2; person.leftArm.rotation.x = -1.6; person.rightArm.rotation.x = 1.2; person.leftLeg.rotation.x = 0.3; person.rightLeg.rotation.x = -0.3;
          }
          return;
        }
        if (person.isPunching && now >= person.punchUntil) { person.isPunching = false; person.mesh.rotation.z = 0; person.mesh.rotation.x = 0; }

        if (person.wreckageEvent) {
          updateWreckageCrowdPerson(person, dt, now, lowLagHumans);
          return;
        }

        if (person.task === 'park-play' && person.parkCenter) {
          if (person.spinningTop) person.spinningTop.rotation.y += dt * 18;
          if (now < person.parkPauseUntil) {
            person.leftArm.rotation.x = Math.sin(now * 0.012) * 0.4 - 0.35;
            person.rightArm.rotation.x = -Math.sin(now * 0.012) * 0.4 - 0.35;
            person.leftLeg.rotation.x = Math.sin(now * 0.009) * 0.16;
            person.rightLeg.rotation.x = -person.leftLeg.rotation.x;
            return;
          }
          const direction = person.destination.clone().sub(person.mesh.position).setY(0);
          if (direction.length() < 1.2) {
            person.destination.set(
              person.parkCenter.x + (Math.random() - 0.5) * 22,
              0,
              person.parkCenter.z + (Math.random() - 0.5) * 18
            );
            person.parkPauseUntil = now + 500 + Math.random() * 1400;
            return;
          }
          direction.normalize();
          const step = person.speed * dt * 1.35;
          person.mesh.position.addScaledVector(direction, step);
          person.mesh.rotation.y = Math.atan2(direction.x, direction.z);
          person.walkPhase += dt * 9;
          const swing = lowLagHumans ? 0 : Math.sin(person.walkPhase) * 0.7;
          person.leftArm.rotation.x = swing - 0.25;
          person.rightArm.rotation.x = -swing - 0.25;
          person.leftLeg.rotation.x = -swing;
          person.rightLeg.rotation.x = swing;
          return;
        }

        if (person.task === 'park-lap' && person.parkCenter) {
          person.parkAngle += dt * person.parkLapSpeed / person.parkRadius;
          const nextX = person.parkCenter.x + Math.cos(person.parkAngle) * person.parkRadius;
          const nextZ = person.parkCenter.z + Math.sin(person.parkAngle) * person.parkRadius;
          person.mesh.position.set(nextX, 0, nextZ);
          person.mesh.rotation.y = Math.atan2(
            -Math.sin(person.parkAngle) * person.parkLapSpeed,
            Math.cos(person.parkAngle) * person.parkLapSpeed
          );
          person.walkPhase += dt * 7;
          const swing = lowLagHumans ? 0 : Math.sin(person.walkPhase) * 0.55;
          person.leftArm.rotation.x = swing;
          person.rightArm.rotation.x = -swing;
          person.leftLeg.rotation.x = -swing;
          person.rightLeg.rotation.x = swing;
          return;
        }

        if (person.type === 'A' && person.state === 'State_Pursuit' && person.targetUser) {
          const targetVector = person.targetUser.position.clone();
          if (now >= (person.pathTimer || 0)) {
            person.path = getNavigationPath(person.mesh.position, targetVector);
            person.pathTimer = now + 450;
          }
          let pathTarget = targetVector;
          if (person.path.length > 1) pathTarget = person.path[1];
          const direction = pathTarget.clone().sub(person.mesh.position).setY(0);
          const distance = direction.length();
          person.velocity = Math.max(1.0, person.targetUser.sprintScalar || playerState.sprintScalar);
          if (distance > 0.75) {
            direction.normalize();
            const nextPosition = person.mesh.position.clone().addScaledVector(direction, person.velocity * dt * 2.4);
            const resolved = resolveFootstep(nextPosition.x, nextPosition.z, 0.55);
            if (!resolved.blocked) {
              person.mesh.position.set(resolved.x, 0, resolved.z);
            }
            person.mesh.rotation.y = Math.atan2(direction.x, direction.z);
          }
          person.walkPhase += dt * 8;
          const swing = lowLagHumans ? 0 : Math.sin(person.walkPhase) * 0.8;
          person.leftArm.rotation.x = swing; person.rightArm.rotation.x = -swing; person.leftLeg.rotation.x = -swing; person.rightLeg.rotation.x = swing;
          return;
        }

        if (person.type === 'B' && person.state === 'State_LinkedToUser') {
          const playerForward = new THREE.Vector3(Math.sin(playerState.yaw), 0, Math.cos(playerState.yaw));
          const offset = playerForward.clone().multiplyScalar(-3.5);
          const targetPosition = playerState.position.clone().add(offset);
          if (now >= (person.pathTimer || 0)) {
            person.path = getNavigationPath(person.mesh.position, targetPosition);
            person.pathTimer = now + 450;
          }
          let pathTarget = targetPosition;
          if (person.path.length > 1) pathTarget = person.path[1];
          const direction = pathTarget.clone().sub(person.mesh.position).setY(0);
          const distance = direction.length();
          if (distance > 3 && distance > 0.01) {
            direction.normalize();
            const nextPosition = person.mesh.position.clone().addScaledVector(direction, person.speed * dt * 1.9);
            const resolved = resolveFootstep(nextPosition.x, nextPosition.z, 0.55);
            if (!resolved.blocked) person.mesh.position.set(resolved.x, 0, resolved.z);
          }
          const desiredYaw = Math.atan2(playerState.position.x - person.mesh.position.x, playerState.position.z - person.mesh.position.z);
          person.mesh.rotation.y = desiredYaw;
          person.walkPhase += dt * 8;
          const swing = lowLagHumans ? 0 : Math.sin(person.walkPhase) * 0.8;
          person.leftArm.rotation.x = swing; person.rightArm.rotation.x = -swing; person.leftLeg.rotation.x = -swing; person.rightLeg.rotation.x = swing;
          return;
        }

        if (person.task === 'bench' && person.bench) {
          const bx = person.bench.x + Math.cos(person.bench.rot) * 0.5;
          const bz = person.bench.z + Math.sin(person.bench.rot) * 0.5;
          person.mesh.position.set(bx, 0, bz);
          person.mesh.rotation.y = person.bench.rot + Math.PI / 2;
          person.walkPhase += dt * 2;
          const swing = lowLagHumans ? 0 : Math.sin(person.walkPhase) * 0.2;
          person.leftArm.rotation.x = swing; person.rightArm.rotation.x = -swing; person.leftLeg.rotation.x = -swing * 0.4; person.rightLeg.rotation.x = swing * 0.4;
          if (person.useDevice) {
            person.deviceGroup.visible = true;
            person.deviceGroup.position.set(0.18, 0.6, 0.15);
            person.deviceGroup.rotation.set(0.1, 0, 0);
          }
          return;
        }

        const dir = new THREE.Vector3(person.destination.x - person.mesh.position.x, 0, person.destination.z - person.mesh.position.z);
        if (dir.length() < 1.5) {
          if (person.useDevice && Math.random() < 0.2) {
            person.task = 'bench';
            person.bench = benchSeats[Math.floor(Math.random() * benchSeats.length)] || null;
          } else {
            person.destination.copy(getNearbyPedestrianDestination(person.mesh.position));
          }
          return;
        }

        dir.normalize();
        const nextX = person.mesh.position.x + dir.x * person.speed * dt * 1.8;
        const nextZ = person.mesh.position.z + dir.z * person.speed * dt * 1.8;
        const resolved = resolveFootstep(nextX, nextZ, 0.55);

        if (!resolved.blocked) {
          person.mesh.position.x = resolved.x;
          person.mesh.position.z = resolved.z;
        } else {
          person.destination.copy(getNearbyPedestrianDestination(person.mesh.position));
        }

        person.mesh.rotation.y = Math.atan2(dir.x, dir.z);
        person.walkPhase += dt * 7;
        const swing = lowLagHumans ? 0 : Math.sin(person.walkPhase) * 0.8;
        person.leftArm.rotation.x = swing; person.rightArm.rotation.x = -swing; person.leftLeg.rotation.x = -swing; person.rightLeg.rotation.x = swing;

        if (person.useDevice) {
          person.deviceGroup.visible = true;
          person.deviceGroup.position.set(0.15, 1.25, 0.22);
          person.deviceGroup.rotation.set(0, 0, 0);
          person.deviceMesh.rotation.y = Math.PI * 0.16;
        }
      });
    }

    function nearestBenchToPlayer() {
      let bestBench = null; let bestDistance = Infinity;
      const benches = [];
      const benchPositions = [
        { x: -110, z: 0 }, { x: -70, z: 30 }, { x: 70, z: 30 }, { x: 110, z: 0 }, { x: -70, z: -30 }, { x: 70, z: -30 }
      ];
      benchPositions.forEach((bench) => {
        const d = Math.hypot(playerState.position.x - bench.x, playerState.position.z - bench.z);
        if (d < bestDistance) { bestDistance = d; bestBench = bench; }
      });
      return bestDistance < 8 ? bestBench : null;
    }

    function getPointerRaycaster(event) {
      const rect = renderer.domElement.getBoundingClientRect();
      const useCenter = document.pointerLockElement === renderer.domElement || !event || typeof event.clientX !== 'number';
      const targetX = useCenter ? 0 : ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const targetY = useCenter ? 0 : -((event.clientY - rect.top) / rect.height) * 2 + 1;
      const mouse = new THREE.Vector2(useCenter ? 0 : targetX, useCenter ? 0 : targetY);
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, camera);
      return raycaster;
    }

    function maybePunchPersonAtPointer(event) {
      const raycaster = getPointerRaycaster(event);
      const hits = raycaster.intersectObjects(people.map((p) => p.mesh), true);
      if (!hits.length) return;
      const hit = hits[0].object; const person = people.find((p) => p.mesh === hit || p.mesh.children.includes(hit) || p.mesh === hit.parent || p.mesh === hit.parent?.parent);
      if (!person) return;
      person.isPunching = true; person.punchUntil = performance.now() + 3000; showMessage('Punch landed!');
    }

    function handleEntityClick(event) {
      if (!gameStarted || !menu.classList.contains('hidden') || controlledVehicle || playerState.boat) return;
      const raycaster = getPointerRaycaster(event);
      const hits = raycaster.intersectObjects(people.map((person) => person.mesh), true);
      if (!hits.length) return;
      const hitObject = hits[0].object;
      const hitPerson = people.find((person) => person.mesh === hitObject || person.mesh.children.includes(hitObject) || person.mesh === hitObject.parent || person.mesh === hitObject.parent?.parent);
      if (!hitPerson || event.button !== 0) return;
      const hitNormal = hits[0].face ? hits[0].face.normal.clone().transformDirection(hitObject.matrixWorld) : new THREE.Vector3(0, 1, 0);
      const pushDirection = hitNormal.clone().setY(0).normalize();
      if (pushDirection.lengthSq() === 0) pushDirection.set(0, 0, 1);
      hitPerson.mesh.position.addScaledVector(pushDirection, 1.4);
      hitPerson.path = [];
      const playerForward = new THREE.Vector3(Math.sin(playerState.yaw), 0, Math.cos(playerState.yaw));
      hitPerson.mesh.position.addScaledVector(playerForward, 0.6);
      showMessage('Entity pushed.');
    }

    function handleLinkedEntitySelection(event) {
      if (!gameStarted || !menu.classList.contains('hidden') || controlledVehicle || playerState.boat) return;
      const raycaster = getPointerRaycaster(event);
      const hits = raycaster.intersectObjects(people.map((person) => person.mesh), true);
      if (!hits.length) return;
      const target = people.find((person) => person.mesh === hits[0].object || person.mesh.children.includes(hits[0].object) || person.mesh === hits[0].object.parent || person.mesh === hits[0].object.parent?.parent);
      if (!target || target.type !== 'B') return;
      target.state = 'State_LinkedToUser';
      target.targetUser = { position: playerState.position, sprintScalar: playerState.sprintScalar };
      target.path = [];
      target.parentTarget = null;
      if (target.targetTypeObject) {
        target.targetTypeObject.state = 'State_Pursuit';
        target.targetTypeObject.targetUser = { position: playerState.position, sprintScalar: playerState.sprintScalar };
      }
      showMessage('Type-B linked to player.');
    }

    function pickCarFromPointer(event) {
      if (!gameStarted || !menu.classList.contains('hidden') || playerState.boat) return false;
      const raycaster = getPointerRaycaster(event);
      const activeCars = cars.filter((car) => !car.destroyed && car.mesh.visible);
      const hits = raycaster.intersectObjects(activeCars.map((car) => car.mesh), true);
      let selectedCar = null;

      if (hits.length) {
        const hit = hits[0].object;
        selectedCar = activeCars.find((car) => car.mesh === hit || car.mesh.children.includes(hit) || car.mesh === hit.parent || car.mesh === hit.parent?.parent);
      }

      if (!selectedCar) {
        const playerPos = controlledVehicle ? controlledVehicle.body.position : playerState.position;
        selectedCar = cars
          .filter((car) => car && !car.destroyed && car.mesh && car.mesh.visible)
          .filter((car) => Math.hypot(car.mesh.position.x - playerPos.x, car.mesh.position.z - playerPos.z) < 8)
          .sort((a, b) => Math.hypot(a.mesh.position.x - playerPos.x, a.mesh.position.z - playerPos.z) - Math.hypot(b.mesh.position.x - playerPos.x, b.mesh.position.z - playerPos.z))[0] || null;
      }

      if (!selectedCar) return false;
      if (selectedCar.npc) {
        ejectCarDriver(selectedCar);
        const npcIndex = npcCars.indexOf(selectedCar);
        if (npcIndex >= 0) npcCars.splice(npcIndex, 1);
        selectedCar.npc = false;
        selectedCar.route = null;
      }
      if (selectedCar.parked) {
        selectedCar.body.type = CANNON.Body.DYNAMIC;
        selectedCar.body.mass = selectedCar.isPlow ? 320 : 100;
        selectedCar.body.updateMassProperties();
        selectedCar.parked = false;
      }
      controlledVehicle = selectedCar;
      selectedCar.owner = 'player';
      selectedCar.body.wakeUp();
      syncActiveMode();
      showMessage('Entered vehicle. Drive with WASD.');
      selectedCar.inside = true;
      return true;
    }

    function handleDriving(dt) {
      syncActiveMode();
      if (!controlledVehicle) return;
      const car = controlledVehicle;
      const maxSpeedMph = 75;
      const maxSpeed = (maxSpeedMph / 2.237) * 1.05;
      car.fuel = Infinity;
      car.maxFuel = Infinity;

      const turnInput = (driveKeys.right ? 1 : 0) - (driveKeys.left ? 1 : 0);
      const steeringTarget = turnInput * 1.6;
      const steeringResponse = 1 - Math.exp(-(turnInput ? 12 : 8) * dt);
      car.steer = THREE.MathUtils.lerp(car.steer, steeringTarget, steeringResponse);

      const turnStrength = 1.8 + Math.abs(car.speed) * 0.09;
      if (turnInput !== 0) {
        car.mesh.rotation.y += car.steer * turnStrength * dt;
      }
      car.body.quaternion.setFromEuler(0, car.mesh.rotation.y, 0);

      const forward = new THREE.Vector3(Math.sin(car.mesh.rotation.y), 0, Math.cos(car.mesh.rotation.y));
      const throttle = (driveKeys.forward ? 1 : 0) - (driveKeys.backward ? 1 : 0);
      const brakeFactor = driveKeys.brake ? 0.55 : 1;
      car.speed += throttle * 26 * dt * brakeFactor;
      if (!driveKeys.forward && !driveKeys.backward) car.speed *= 0.96;
      if (driveKeys.brake) car.speed *= 0.92;
      car.speed = THREE.MathUtils.clamp(car.speed, -18, maxSpeed);

      let rampBoost = 0;
      for (const ramp of rampZones) {
        const dx = car.body.position.x - ramp.x;
        const dz = car.body.position.z - ramp.z;
        const forwardDot = (forward.x * dx + forward.z * dz);
        const distance = Math.hypot(dx, dz);
        const onRamp = Math.abs(distance) < Math.hypot(ramp.width, ramp.depth) * 0.45 && forwardDot > -ramp.depth * 0.5 && forwardDot < ramp.depth * 0.5;
        if (onRamp && Math.abs(car.body.position.y - 1.2) < 2.5) {
          rampBoost = 1.2;
          car.body.position.y = 1.2 + ramp.height * 0.88;
        }
      }
      if (rampBoost > 0) {
        car.body.velocity.y = 7 + Math.abs(car.speed) * 0.08;
      } else {
        car.body.velocity.y *= 0.92;
      }
      car.body.velocity.x = forward.x * car.speed;
      car.body.velocity.z = forward.z * car.speed;
      const nextX = THREE.MathUtils.clamp(car.body.position.x + car.body.velocity.x * dt, worldBounds.minX, worldBounds.maxX);
      const nextZ = THREE.MathUtils.clamp(car.body.position.z + car.body.velocity.z * dt, worldBounds.minZ, worldBounds.maxZ);
      resolveVehicleMove(car, nextX, nextZ);
      car.body.position.y += car.body.velocity.y * dt * 0.55;
      car.mesh.position.set(car.body.position.x, car.body.position.y, car.body.position.z);
      car.body.position.x = THREE.MathUtils.clamp(car.body.position.x, worldBounds.minX, worldBounds.maxX);
      car.body.position.z = THREE.MathUtils.clamp(car.body.position.z, worldBounds.minZ, worldBounds.maxZ);
      if (car.body.position.y < 1.2) {
        car.body.position.y = 1.2;
        car.body.velocity.y = 0;
      }
    }

    function updateSpeedometer() {
      if (!controlledVehicle) {
        speedometer.classList.remove('visible');
        return;
      }
      const speedMps = new THREE.Vector3(controlledVehicle.body.velocity.x, 0, controlledVehicle.body.velocity.z).length();
      const speedMph = Math.min(99, Math.round(speedMps * 2.237));
      speedReadout.textContent = String(speedMph);
      speedometer.classList.add('visible');
    }

    function updateMobileControls() {
      const visible = isMobile && gameStarted && menu.classList.contains('hidden');
      mobileControls.classList.toggle('visible', visible);
      hud.style.display = isMobile ? 'none' : '';
      missionPanel.style.display = isMobile ? 'none' : '';
      fpsCounter.style.display = isMobile ? 'none' : '';
      if (!visible) return;
      if (!document.pointerLockElement && !controlledVehicle && !controlledAirplane && !playerState.boat) {
        renderer.domElement.style.cursor = 'grab';
      }
    }

    function updatePlayerFromVehicle() {
      if (controlledAirplane) {
        const aircraft = controlledAirplane;
        if (!aircraft || !aircraft.mesh || !Number.isFinite(aircraft.mesh.position.x) || !Number.isFinite(aircraft.mesh.position.z)) {
          controlledAirplane = null;
          playerState.airplane = null;
          return;
        }
        const offset = new THREE.Vector3(0, 7, -28).applyAxisAngle(new THREE.Vector3(0, 1, 0), aircraft.heading || aircraft.mesh.rotation.y);
        camera.position.lerp(aircraft.mesh.position.clone().add(offset), 0.1);
        camera.lookAt(aircraft.mesh.position.x, aircraft.mesh.position.y + 2, aircraft.mesh.position.z);
        return;
      }
      if (!controlledVehicle) {
        if (document.pointerLockElement === renderer.domElement) {
          playerState.pointerLocked = true;
        } else {
          playerState.pointerLocked = false;
        }

        camera.position.x = THREE.MathUtils.clamp(playerState.position.x, -170, 170);
        camera.position.z = THREE.MathUtils.clamp(playerState.position.z, -170, 170);
        applyPointerLook();
        return;
      }

      const vehicle = controlledVehicle.mesh;
      camera.position.lerp(new THREE.Vector3(vehicle.position.x, vehicle.position.y + 3.4, vehicle.position.z + 6), 0.12);
      camera.lookAt(vehicle.position.x, vehicle.position.y + 1.2, vehicle.position.z);
    }

    function updatePushableObjects(dt) {
      pushableObjects.forEach((crate) => {
        if (crate.broken) return;
        const dx = playerState.position.x - crate.mesh.position.x;
        const dz = playerState.position.z - crate.mesh.position.z;
        const dist = Math.hypot(dx, dz);
        const reach = crate.radius + 0.9;
        if (dist < reach && dist > 0.01) {
          const moveX = (dx / dist) * 0.22;
          const moveZ = (dz / dist) * 0.22;
          crate.mesh.position.x -= moveX;
          crate.mesh.position.z -= moveZ;
        }

        cars.forEach((car) => {
          if (!car || car.destroyed || !car.mesh) return;
          const dX = car.mesh.position.x - crate.mesh.position.x;
          const dZ = car.mesh.position.z - crate.mesh.position.z;
          const d = Math.hypot(dX, dZ);
          if (d < crate.radius + 1.6 && Math.abs(car.speed) > 3) {
            const push = (Math.abs(car.speed) * 0.08);
            crate.mesh.position.x += (dX / (d || 1)) * push;
            crate.mesh.position.z += (dZ / (d || 1)) * push;
            crate.health -= 1;
            crate.hitFlash = 0.2;
            if (crate.health <= 0) {
              crate.broken = true;
              const x = crate.mesh.position.x;
              const z = crate.mesh.position.z;
              cityRoot.remove(crate.mesh);
              createItemWreckage(x, z, crate.size, crate.mesh.material.color.getHex(), 'item');
            }
          }
        });

        if (crate.hitFlash > 0) {
          crate.hitFlash = Math.max(0, crate.hitFlash - dt * 2.4);
          crate.mesh.material.emissive = new THREE.Color(0x3b2f00);
          crate.mesh.material.emissiveIntensity = crate.hitFlash;
        } else {
          crate.mesh.material.emissive = new THREE.Color(0x000000);
          crate.mesh.material.emissiveIntensity = 0;
        }
      });
      debrisPieces.forEach((piece) => {
        if (piece.cleared || piece.body.position.y > 6) return;
        const dx = piece.body.position.x - playerState.position.x;
        const dz = piece.body.position.z - playerState.position.z;
        const distance = Math.hypot(dx, dz);
        const reach = Math.max(piece.width, piece.depth) * 0.35 + 0.9;
        if (distance < reach && distance > 0.05) {
          const strength = piece.kind === 'aircraft' ? 8 : 0.45;
          piece.body.applyImpulse(
            new CANNON.Vec3(dx / distance * strength, 0.02, dz / distance * strength),
            new CANNON.Vec3(0, 0, 0)
          );
        }
      });
    }

    function toggleFlightMode() {
      flyMode = !flyMode;
      if (flyMode) {
        playerState.onGround = false;
        playerState.velocity.y = 0;
        showMessage('Flight enabled');
      } else {
        playerState.velocity.y = 0;
        showMessage('Flight disabled');
      }
    }

    function updatePlayerControls(dt) {
      if (!Number.isFinite(playerState.position.x) || !Number.isFinite(playerState.position.y) || !Number.isFinite(playerState.position.z)) {
        setSafePlayerPosition(0, 1.7, 28);
        playerState.velocity.set(0, 0, 0);
        playerState.yaw = 0;
        playerState.pitch = 0;
        playerState.onGround = true;
        controlledAirplane = null;
        playerState.airplane = null;
        playerState.seatedOn = null;
        showMessage('Position recovered.');
      }
      if (!playerInputActive) {
        if (performance.now() >= playerStunUntil) playerInputActive = true;
        else {
          playerState.velocity.y = 0;
          playerState.position.y = Math.max(playerState.position.y, groundHeightAt(playerState.position.x, playerState.position.z) + 1.7);
          applyPointerLook();
          return;
        }
      }
      if (playerState.boat) {
        applyPointerLook();
        return;
      }
      if (playerState.seatedOn) {
        const bench = playerState.seatedOn;
        playerState.position.set(bench.x, 1.7, bench.z);
        applyPointerLook();
        return;
      }

      const borderTrigger = updateBoundaryZoneState();
      if (borderTrigger && walkKeys.jump && !controllerVerticalTracking) {
        activateVerticalTracking();
      }

      const forwardAmount = (walkKeys.forward ? 1 : 0) - (walkKeys.backward ? 1 : 0);
      const strafeAmount = (walkKeys.right ? 1 : 0) - (walkKeys.left ? 1 : 0);
      const moveDirection = new THREE.Vector3();

      if (forwardAmount !== 0 || strafeAmount !== 0) {
        const forward = new THREE.Vector3(Math.sin(playerState.yaw), 0, Math.cos(playerState.yaw));
        const right = new THREE.Vector3(Math.cos(playerState.yaw), 0, -Math.sin(playerState.yaw));
        moveDirection.addScaledVector(forward, forwardAmount);
        moveDirection.addScaledVector(right, strafeAmount);
        moveDirection.normalize();
      }

      const moveSpeed = (walkKeys.sprint && walkKeys.forward) ? 14.5 : playerState.moveSpeed;
      if (moveDirection.lengthSq() > 0) {
        const nextX = playerState.position.x + moveDirection.x * moveSpeed * dt;
        const nextZ = playerState.position.z + moveDirection.z * moveSpeed * dt;
        const resolved = resolveFootstep(nextX, nextZ, 0.7);
        if (!resolved.blocked) {
          playerState.position.x = resolved.x;
          playerState.position.z = resolved.z;
        }
      }

      if (flyMode) {
        const flightLift = walkKeys.jump ? 7.2 : 0;
        const flightSink = walkKeys.backward ? 2.8 : 0;
        playerState.velocity.y = flightLift - flightSink;
        playerState.position.y += playerState.velocity.y * dt;
        playerState.onGround = false;
      } else if (controllerVerticalTracking) {
        const verticalMove = (walkKeys.forward ? 1 : 0) - (walkKeys.backward ? 1 : 0);
        playerState.position.y = THREE.MathUtils.clamp(playerState.position.y + verticalMove * 6 * dt, 4, 28);
        playerState.velocity.y = 0;
        playerState.onGround = false;
      } else if (isRiverPosition(playerState.position.x, playerState.position.z)) {
        if (!playerState.inRiver) showMessage('Swimming. Hold Space to rise; hold S to dive.');
        playerState.inRiver = true;
        playerState.riverJumpBoost = 0;
        const verticalInput = (walkKeys.jump ? 1 : 0) - (walkKeys.backward ? 1 : 0);
        const swimTarget = RIVER_SURFACE_Y - 0.65 + verticalInput * 1.25;
        const swimAcceleration = (swimTarget - playerState.position.y) * 9 - playerState.velocity.y * 3.5;
        playerState.velocity.y += swimAcceleration * dt;
        playerState.position.y += playerState.velocity.y * dt;
        playerState.position.y = THREE.MathUtils.clamp(playerState.position.y, RIVER_SURFACE_Y - 4.2, RIVER_SURFACE_Y + 0.3);
        playerState.onGround = false;
      } else {
        playerState.inRiver = false;
        const standingY = groundHeightAt(playerState.position.x, playerState.position.z) + 1.7;
        if (walkKeys.jump && playerState.onGround) {
          const jumpStrength = isRiverPosition(playerState.position.x, playerState.position.z) ? 9.2 : 6.8;
          playerState.velocity.y = jumpStrength;
          playerState.onGround = false;
          playerState.riverJumpBoost = isRiverPosition(playerState.position.x, playerState.position.z) ? 18 : 0;
          walkKeys.jump = false;
        }

        if (playerState.riverJumpBoost > 0 && playerState.position.y > 1.7) {
          const jumpDirection = new THREE.Vector3(Math.sin(playerState.yaw), 0, Math.cos(playerState.yaw));
          playerState.position.addScaledVector(jumpDirection, 18 * dt);
          playerState.riverJumpBoost = Math.max(0, playerState.riverJumpBoost - 18 * dt);
        }

        playerState.velocity.y += -16 * dt;
        playerState.position.y += playerState.velocity.y * dt;
        const groundedY = standingY;
        if (playerState.position.y < groundedY) {
          playerState.position.y = groundedY;
          playerState.velocity.y = 0;
          playerState.onGround = true;
          playerState.riverJumpBoost = 0;
        }
      }

      playerState.position.x = THREE.MathUtils.clamp(playerState.position.x, worldBounds.minX + 1.5, worldBounds.maxX - 1.5);
      playerState.position.z = THREE.MathUtils.clamp(playerState.position.z, worldBounds.minZ + 1.5, worldBounds.maxZ - 1.5);
      applyPointerLook();
    }

    function updateNPCs(dt) {
      if (!gameSettings.npcs) return;
      npcCars.forEach((car) => {
        if (!car.route || car.destroyed || !car.active) return;
        const route = car.route;
        const current = route.horizontal ? car.body.position.x : car.body.position.z;
        let next = current + route.direction * car.speed * dt;
        if (next > route.max) { next = route.max; route.direction = -1; }
        if (next < route.min) { next = route.min; route.direction = 1; }
        const nextX = route.horizontal ? next : route.fixed;
        const nextZ = route.horizontal ? route.fixed : next;
        car.mesh.rotation.y = route.horizontal ? route.direction * Math.PI / 2 : route.direction < 0 ? Math.PI : 0;
        car.body.velocity.x = route.horizontal ? route.direction * car.speed : 0;
        car.body.velocity.z = route.horizontal ? 0 : route.direction * car.speed;
        if (!resolveVehicleMove(car, nextX, nextZ)) {
          route.direction *= -1;
          car.speed = Math.max(7, Math.abs(car.speed));
        }
        car.mesh.position.set(car.body.position.x, car.body.position.y, car.body.position.z);
        car.body.quaternion.setFromEuler(0, car.mesh.rotation.y, 0);
      });
    }

    function updateFallingDrivers(dt) {
      for (let index = fallingDrivers.length - 1; index >= 0; index--) {
        const falling = fallingDrivers[index];
        const person = falling.person;
        const position = person.mesh.position;
        falling.velocity.y -= 16 * dt;
        position.addScaledVector(falling.velocity, dt);
        const distance = Math.hypot(position.x - playerState.position.x, position.y - playerState.position.y, position.z - playerState.position.z);
        person.mesh.visible = !webOptimizer.lowLag || distance <= entityVisibilityRadius();
        const floorY = groundHeightAt(position.x, position.z) + 0.03;
        if (position.y > floorY) continue;
        restoreDriverToPedestrian(person, position.x, position.z, person.mesh.rotation.y);
        fallingDrivers.splice(index, 1);
      }
    }

    function maybeElevatorNearPlayer() {
      const playerPos = camera.position; let nearest = null; let best = Infinity; buildingElevators.forEach((elev) => { const d = Math.hypot(playerPos.x - elev.x, playerPos.z - elev.z); if (d < best) { best = d; nearest = elev; } }); return best < 12 ? nearest : null;
    }

    function setElevatorFloor(elevator, targetFloor) {
      elevator.targetFloor = Math.max(0, Math.min(targetFloor, elevator.maxFloor)); const targetY = elevator.yBase + elevator.targetFloor * 3.1; const startY = elevator.car.position.y; const duration = 1400; const startTime = performance.now();
      function animate() { const elapsed = performance.now() - startTime; const t = Math.min(elapsed / duration, 1); elevator.car.position.y = THREE.MathUtils.lerp(startY, targetY, t); if (t < 1) requestAnimationFrame(animate); else showMessage('Elevator reached floor ' + (elevator.targetFloor + 1)); }
      requestAnimationFrame(animate);
    }

    function handleElevatorSelection() {
      const elevator = maybeElevatorNearPlayer(); if (!elevator) { showMessage('Move near a building elevator.'); return; }
      const value = prompt('Enter a floor number from 1 to ' + (elevator.maxFloor + 1), String(elevator.currentFloor + 1)); if (value === null) return; const floor = parseInt(value, 10); if (Number.isNaN(floor) || floor < 1 || floor > elevator.maxFloor + 1) { showMessage('Invalid elevator floor.'); return; }
      setElevatorFloor(elevator, floor - 1);
    }

    function createDowntownBlock(centerX, centerZ, blockW, blockD) {
      if (overlapsRiverKeepOut(centerX, centerZ, blockW + 8, blockD + 8)) return;
      const sidewalkPad = 3.8;
      registerSidewalkArea(centerX, centerZ, blockW + 8, blockD + 8);
      const sidewalkTexture = createSurfaceTexture('roofTiles', blockW + 8, blockD + 8, 8);
      const blockSidewalk = new THREE.Mesh(
        new THREE.BoxGeometry(blockW + 8, 0.14, blockD + 8),
        new THREE.MeshStandardMaterial({ map: sidewalkTexture, color: 0xffffff, roughness: 0.96 })
      );
      blockSidewalk.position.set(centerX, 0.07, centerZ); blockSidewalk.receiveShadow = true; cityRoot.add(blockSidewalk);

      const buildingPlacements = [
        { x: centerX - 12, z: centerZ - 12, sx: 11, sz: 11, zone: 'office' },
        { x: centerX + 11, z: centerZ - 11, sx: 10, sz: 10, zone: 'residential' },
        { x: centerX, z: centerZ + 9, sx: 16, sz: 12, zone: 'commercial' }
      ];

      buildingPlacements.forEach((spec, idx) => {
        const seed = idx * 7 + Math.abs(Math.round(centerX)) + Math.abs(Math.round(centerZ));
        const floors = seed % 5 === 0 ? 2 + seed % 4 : 8 + seed % 23;
        const color = new THREE.Color().setHSL((idx / buildingPlacements.length + Math.abs(centerX) / 350) % 1, 0.28, spec.zone === 'residential' ? 0.64 : 0.52).getHex();
        createBuilding(spec.x, spec.z, spec.sx, spec.sz, floors, color, spec.zone);
      });

      const edgeTreePositions = [
        [-blockW / 2 + 4, -blockD / 2 + 4], [blockW / 2 - 4, -blockD / 2 + 4],
        [-blockW / 2 + 4, blockD / 2 - 4], [blockW / 2 - 4, blockD / 2 - 4],
        [0, -blockD / 2 + 4], [0, blockD / 2 - 4], [-blockW / 2 + 4, 0], [blockW / 2 - 4, 0]
      ];
      edgeTreePositions.forEach(([tx, tz]) => addTree(centerX + tx, centerZ + tz, 1.2));
      const benchPositions = [
        { x: centerX - 4, z: centerZ - blockD / 2 + 5, rot: Math.PI / 2 },
        { x: centerX + 4, z: centerZ + blockD / 2 - 5, rot: -Math.PI / 2 },
        { x: centerX - blockW / 2 + 6, z: centerZ + 4, rot: 0 },
        { x: centerX + blockW / 2 - 6, z: centerZ - 4, rot: Math.PI }
      ];
      benchPositions.forEach((bench) => addBench(centerX + bench.x * 0.18, centerZ + bench.z * 0.18, bench.rot));
    }

    function createResidentialNeighborhood(centerX, centerZ, blockW = 52, blockD = 48) {
      if (overlapsRiverKeepOut(centerX, centerZ, blockW + 6, blockD + 6)) return;
      registerSidewalkArea(centerX, centerZ, blockW + 6, blockD + 6);
      const sidewalkTexture = createSurfaceTexture('roofTiles', blockW + 6, blockD + 6, 8);
      const blockPad = new THREE.Mesh(
        new THREE.BoxGeometry(blockW + 6, 0.12, blockD + 6),
        new THREE.MeshStandardMaterial({ map: sidewalkTexture, color: 0xffffff, roughness: 0.96 })
      );
      blockPad.position.set(centerX, 0.06, centerZ); blockPad.receiveShadow = true; cityRoot.add(blockPad);

      const houses = [
        { x: centerX - 15, z: centerZ - 10, sx: 8, sz: 7, floors: 2 },
        { x: centerX + 2, z: centerZ - 12, sx: 9, sz: 8, floors: 2 },
        { x: centerX + 18, z: centerZ - 8, sx: 7, sz: 7, floors: 2 },
        { x: centerX - 12, z: centerZ + 12, sx: 7, sz: 7, floors: 1 },
        { x: centerX + 9, z: centerZ + 13, sx: 8, sz: 8, floors: 2 },
        { x: centerX + 2, z: centerZ + 2, sx: 12, sz: 10, floors: 3, zone: 'residential' }
      ];

      houses.forEach((spec, index) => {
        const hue = (Math.abs(centerX) * 0.7 + Math.abs(centerZ) * 0.9 + index * 13) % 360;
        const color = new THREE.Color().setHSL(hue / 360, 0.18, 0.62).getHex();
        createBuilding(spec.x, spec.z, spec.sx, spec.sz, spec.floors, color, spec.zone || 'residential');
      });

      const treePositions = [
        [-blockW / 2 + 5, -blockD / 2 + 5], [0, -blockD / 2 + 6], [blockW / 2 - 5, -blockD / 2 + 5],
        [-blockW / 2 + 5, blockD / 2 - 5], [0, blockD / 2 - 6], [blockW / 2 - 5, blockD / 2 - 5],
        [-blockW / 2 + 5, 0], [blockW / 2 - 5, 0]
      ];
      treePositions.forEach(([tx, tz]) => addTree(centerX + tx, centerZ + tz, 1.1));
      for (let i = 0; i < 3; i++) {
        const offset = (i - 1) * 12;
        addBench(centerX + offset, centerZ + blockD / 2 - 6, -Math.PI / 2);
      }
    }

    function createCivicDistrict(centerX, centerZ, blockW = 64, blockD = 58) {
      if (overlapsRiverKeepOut(centerX, centerZ, blockW + 10, blockD + 10)) return;
      registerSidewalkArea(centerX, centerZ, blockW + 10, blockD + 10);
      const sidewalkTexture = createSurfaceTexture('sidewalk', blockW + 10, blockD + 10, 8);
      const districtPad = new THREE.Mesh(
        new THREE.BoxGeometry(blockW + 10, 0.14, blockD + 10),
        new THREE.MeshStandardMaterial({ map: sidewalkTexture, color: 0xd7dfe6, roughness: 0.96 })
      );
      districtPad.position.set(centerX, 0.07, centerZ); districtPad.receiveShadow = true; cityRoot.add(districtPad);

      const placements = [
        { x: centerX - 18, z: centerZ - 12, sx: 14, sz: 12, zone: 'commercial' },
        { x: centerX + 16, z: centerZ - 14, sx: 12, sz: 11, zone: 'office' },
        { x: centerX - 10, z: centerZ + 17, sx: 11, sz: 12, zone: 'residential' },
        { x: centerX + 20, z: centerZ + 16, sx: 13, sz: 10, zone: 'office' }
      ];

      placements.forEach((spec, index) => {
        const seed = Math.abs(Math.round(centerX)) + Math.abs(Math.round(centerZ)) + index * 11;
        const floors = 8 + (seed % 18);
        const color = new THREE.Color().setHSL((seed / 29) % 1, 0.25, spec.zone === 'residential' ? 0.6 : 0.5).getHex();
        createBuilding(spec.x, spec.z, spec.sx, spec.sz, floors, color, spec.zone);
      });

      for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2;
        const treeX = centerX + Math.cos(angle) * (blockW * 0.28);
        const treeZ = centerZ + Math.sin(angle) * (blockD * 0.26);
        addTree(treeX, treeZ, 1.4);
      }
    }

    function createSuburbanRing() {
      const ringOffsets = [
        [-510, -510], [-510, -300], [-510, -90], [-510, 120], [-510, 330],
        [-300, -510], [-90, -510], [120, -510], [330, -510],
        [510, -510], [510, -300], [510, -90], [510, 120], [510, 330],
        [-510, 510], [-300, 510], [-90, 510], [120, 510], [330, 510],
        [510, 510],
        [-390, -610], [-180, -610], [30, -610], [240, -610], [450, -610],
        [-610, -390], [-610, -180], [-610, 30], [-610, 240], [-610, 450],
        [610, -390], [610, -180], [610, 30], [610, 240], [610, 450]
      ];

      ringOffsets.forEach(([x, z], index) => {
        const cluster = index % 5 === 0 ? 'residential' : (index % 3 === 0 ? 'office' : 'commercial');
        const baseX = x + (index % 2 === 0 ? -8 : 8);
        const baseZ = z + (index % 3 === 0 ? -10 : 10);
        const width = cluster === 'residential' ? 7 + (index % 3) : 10 + (index % 4);
        const depth = cluster === 'residential' ? 7 + (index % 3) : 9 + (index % 4);
        const floors = cluster === 'residential' ? 2 + (index % 3) : 6 + (index % 12);
        const color = new THREE.Color().setHSL((index / ringOffsets.length + Math.abs(x) / 800) % 1, 0.2, cluster === 'residential' ? 0.68 : 0.52).getHex();
        createBuilding(baseX, baseZ, width, depth, floors, color, cluster);

        if (cluster === 'residential') {
          const houseSet = [
            { dx: -12, dz: 0, sx: 6, sz: 6, floors: 2 },
            { dx: 0, dz: -12, sx: 7, sz: 7, floors: 2 },
            { dx: 12, dz: 0, sx: 6, sz: 6, floors: 2 },
            { dx: 0, dz: 12, sx: 7, sz: 7, floors: 1 }
          ];
          houseSet.forEach((spec, homeIndex) => {
            const houseColor = new THREE.Color().setHSL(((index * 7 + homeIndex) / 15) % 1, 0.18, 0.66).getHex();
            createBuilding(x + spec.dx, z + spec.dz, spec.sx, spec.sz, spec.floors, houseColor, 'residential');
          });
        }
      });

      const farNeighborhoods = [];
      for (let x = -480; x <= 480; x += 120) {
        for (let z = -480; z <= 480; z += 120) {
          if (Math.abs(x) < 150 && Math.abs(z) < 150) continue;
          farNeighborhoods.push({ x, z });
        }
      }
      farNeighborhoods.forEach(({ x, z }, index) => {
        const family = index % 4 === 0 ? 'residential' : index % 3 === 0 ? 'commercial' : 'office';
        const localX = x + (index % 2 === 0 ? -14 : 14);
        const localZ = z + (index % 3 === 0 ? -18 : 18);
        const size = family === 'residential' ? 8 : 11;
        const floors = family === 'residential' ? 2 + (index % 3) : 7 + (index % 16);
        const color = new THREE.Color().setHSL((index / 36 + Math.abs(x) / 960) % 1, 0.22, family === 'residential' ? 0.69 : 0.52).getHex();
        createBuilding(localX, localZ, size, size, floors, color, family);

        if (family === 'residential') {
          for (let i = 0; i < 4; i++) {
            const offsetX = (i % 2 === 0 ? -1 : 1) * (12 + (i % 2) * 6);
            const offsetZ = (i % 2 === 0 ? 1 : -1) * (12 + ((i + 1) % 2) * 6);
            const houseColor = new THREE.Color().setHSL(((index + i) / 12) % 1, 0.16, 0.64).getHex();
            createBuilding(x + offsetX, z + offsetZ, 5 + (i % 2), 5 + ((i + 1) % 2), 1 + (i % 3), houseColor, 'residential');
          }
        }
      });
    }

    function createHighwayBelt() {
      const beltRoads = [
        { x: 0, z: -585, w: 1200, d: 18 }, { x: 0, z: 585, w: 1200, d: 18 },
        { x: -585, z: 0, w: 18, d: 1200 }, { x: 585, z: 0, w: 18, d: 1200 },
        { x: -420, z: -585, w: 18, d: 140 }, { x: 420, z: -585, w: 18, d: 140 },
        { x: -420, z: 585, w: 18, d: 140 }, { x: 420, z: 585, w: 18, d: 140 },
        { x: -585, z: -420, w: 140, d: 18 }, { x: -585, z: 420, w: 140, d: 18 },
        { x: 585, z: -420, w: 140, d: 18 }, { x: 585, z: 420, w: 140, d: 18 }
      ];
      beltRoads.forEach((road) => createRoad(road.x, road.z, road.w, road.d));

      const beltTrees = [];
      for (let x = -520; x <= 520; x += 80) {
        beltTrees.push([x, -560], [x, 560]);
      }
      for (let z = -520; z <= 520; z += 80) {
        beltTrees.push([-560, z], [560, z]);
      }
      beltTrees.forEach(([x, z]) => {
        addTree(x, z, 1.4);
        addTree(x + 16, z + 10, 1.1);
      });
    }

    function createIndustrialDistrict(centerX, centerZ) {
      if (overlapsRiverKeepOut(centerX, centerZ, 120, 92)) return;
      registerSidewalkArea(centerX, centerZ, 120, 92);
      const sidewalkTexture = createSurfaceTexture('sidewalk', 120, 92, 8);
      const pad = new THREE.Mesh(
        new THREE.BoxGeometry(120, 0.12, 92),
        new THREE.MeshStandardMaterial({ map: sidewalkTexture, color: 0xcfd6dc, roughness: 0.97 })
      );
      pad.position.set(centerX, 0.06, centerZ); pad.receiveShadow = true; cityRoot.add(pad);

      const factories = [
        { x: centerX - 24, z: centerZ - 14, sx: 18, sz: 18, floors: 2 },
        { x: centerX + 28, z: centerZ - 18, sx: 20, sz: 16, floors: 2 },
        { x: centerX - 22, z: centerZ + 24, sx: 16, sz: 20, floors: 1 },
        { x: centerX + 30, z: centerZ + 18, sx: 18, sz: 18, floors: 2 },
        { x: centerX, z: centerZ, sx: 22, sz: 22, floors: 3 }
      ];
      factories.forEach((spec, index) => {
        const color = new THREE.Color().setHSL((index / factories.length + Math.abs(centerX) / 1000) % 1, 0.16, 0.52).getHex();
        createBuilding(spec.x, spec.z, spec.sx, spec.sz, spec.floors, color, 'commercial');
      });

      for (let i = 0; i < 10; i++) {
        const px = centerX - 42 + (i % 5) * 22;
        const pz = centerZ - 30 + Math.floor(i / 5) * 24;
        createParkingBay(px, pz, i % 2 === 0 ? 'horizontal' : 'vertical');
      }

      for (let i = 0; i < 9; i++) {
        const treeX = centerX - 48 + (i % 3) * 28;
        const treeZ = centerZ + 34 - Math.floor(i / 3) * 20;
        addTree(treeX, treeZ, 1.2);
      }
    }

    function createParkBelt() {
      const parkCenters = [
        [-330, -190], [-150, -190], [30, -190], [210, -190],
        [-330, 190], [-150, 190], [30, 190], [210, 190],
        [-190, -330], [-190, -70], [-190, 150], [-190, 310],
        [238, -330], [238, -70], [238, 150], [238, 310],
        [0, -520], [0, 520], [-520, 0], [520, 0]
      ];

      parkCenters.forEach(([x, z], index) => {
        if (overlapsRiverKeepOut(x, z, 52, 46)) return;
        parkActivityAreas.push({
          x,
          z,
          halfWidth: 26,
          halfDepth: 23,
          activityPark: index === 2
        });
        const park = new THREE.Mesh(
          new THREE.BoxGeometry(52, 0.1, 46),
          new THREE.MeshStandardMaterial({ map: textures.parkGrass || null, color: 0xffffff, roughness: 0.96 })
        );
        park.position.set(x, 0.05, z); park.receiveShadow = true; cityRoot.add(park);

        const treeCount = 5 + (index % 4);
        for (let i = 0; i < treeCount; i++) {
          const wx = x + (i - treeCount / 2) * 8;
          const wz = z + ((i % 2) - 0.5) * 12;
          addTree(wx, wz, 1.1 + (i % 2) * 0.2);
        }
        const benchX = x + 10;
        const benchZ = z - 12;
        addBench(benchX, benchZ, 0);
        addBench(benchX - 16, benchZ + 6, Math.PI / 2);
        createParkFence(x, z, 52, 46);
      });
    }

    function cityLayout() {
      createGroundPlane(); createWorldEdgeBackdrop(); addPlaza(); createRiver(); createAirport(); createPlaneField();
      const sidewalkPoints = [
        { x: 0, z: 20 }, { x: 0, z: -20 }, { x: -18, z: 20 }, { x: 18, z: 20 }, { x: -24, z: -20 }, { x: 24, z: -20 },
        { x: -82, z: 20 }, { x: -82, z: -20 }, { x: 82, z: 20 }, { x: 82, z: -20 },
        { x: 20, z: 82 }, { x: -20, z: 82 }, { x: 20, z: -82 }, { x: -20, z: -82 },
        { x: 110, z: 30 }, { x: -110, z: 30 }, { x: 110, z: -30 }, { x: -110, z: -30 },
        { x: 0, z: 110 }, { x: 0, z: -110 }, { x: 110, z: 0 }, { x: -110, z: 0 }
      ];
      sidewalkPoints.forEach((p) => {
        sidewalkTargets.push(new THREE.Vector3(p.x, 0, p.z));
        pedestrianSpawnPoints.push(new THREE.Vector3(p.x, 0, p.z));
      });
      const roads = [
        { x: -100, z: 0, w: 18, d: 250 },
        { x: 0, z: 0, w: 18, d: 250 },
        { x: 100, z: 0, w: 18, d: 250 },
        { x: 0, z: -100, w: 250, d: 18 },
        { x: 0, z: 0, w: 1200, d: 18 },
        { x: 0, z: 100, w: 250, d: 18 },
        { x: 0, z: -180, w: 320, d: 18 },
        { x: 0, z: 180, w: 320, d: 18 },
        { x: -180, z: 0, w: 18, d: 320 },
        { x: 180, z: 0, w: 18, d: 320 }
      ];
      [-480, -320, 320, 480].forEach((axis) => {
        roads.push({ x: axis, z: 0, w: 16, d: 1200 });
        roads.push({ x: 0, z: axis, w: 1200, d: 16 });
      });
      roads.forEach((road) => createRoad(road.x, road.z, road.w, road.d));

      const blockCenters = [-110, -35, 35, 110];
      const blockSets = [];
      blockCenters.forEach((bx) => {
        blockCenters.forEach((bz) => {
          if (Math.abs(bx) < 10 && Math.abs(bz) < 10) return;
          blockSets.push({ x: bx, z: bz });
        });
      });
      blockSets.forEach((block) => createDowntownBlock(block.x, block.z, 42, 42));
      [-510, -390, 390, 510].forEach((bx) => {
        [-510, -390, 390, 510].forEach((bz) => createDowntownBlock(bx, bz, 42, 42));
      });
      [
        [-240, -240], [-240, 0], [-240, 240],
        [0, -240], [0, 240],
        [240, -240], [240, 0], [240, 240],
        [-420, 200], [-420, -200], [420, 200], [420, -200],
        [-180, -420], [-180, 420], [180, -420], [180, 420],
        [-420, -420], [420, -420], [-420, 420], [420, 420],
        [-300, -300], [-300, 300], [300, -300], [300, 300],
        [-540, 0], [540, 0], [0, -540], [0, 540]
      ].forEach(([x, z]) => createResidentialNeighborhood(x, z));
      [
        [-290, -110], [-290, 110], [290, -110], [290, 110],
        [-120, -420], [120, -420], [-120, 420], [120, 420],
        [-420, 0], [420, 0], [0, -420], [0, 420],
        [-350, -350], [350, -350], [-350, 350], [350, 350]
      ].forEach(([x, z]) => createCivicDistrict(x, z));
      createSuburbanRing();
      createHighwayBelt();
      createParkBelt();
      createIndustrialDistrict(-560, -280);
      createIndustrialDistrict(560, -280);
      createIndustrialDistrict(-560, 280);
      createIndustrialDistrict(560, 280);

      for (let x = -540; x <= 540; x += 120) {
        for (let z = -540; z <= 540; z += 120) {
          if (Math.abs(x) < 180 && Math.abs(z) < 180) continue;
          if (Math.abs(x) < 40 && Math.abs(z) < 40) continue;
          const useCivic = (Math.abs(x) + Math.abs(z)) > 520 || (Math.abs(x) > 420 && Math.abs(z) > 420);
          if (useCivic) {
            createCivicDistrict(x, z, 52, 48);
          } else {
            createResidentialNeighborhood(x, z, 46, 40);
          }
        }
      }

      const buildingTotal = buildings.length;
      if (buildingTotal > cityGoals.targetBuildings) {
        while (buildings.length > cityGoals.targetBuildings) {
          const last = buildings.pop();
          if (last && last.elevator) buildingElevators.splice(buildingElevators.indexOf(last.elevator), 1);
          if (last && last.mesh) cityRoot.remove(last.mesh);
        }
      }

      const parkingSpots = [];
      for (let i = 0; i < cityGoals.targetParkedCars; i++) {
        const col = i % 6;
        const row = Math.floor(i / 6);
        const x = (col - 2.5) * 18 + 12;
        const z = (row - 1.5) * 22 + 130;
        parkingSpots.push({ x, z });
      }
      parkingSpots.forEach((spot) => {
        const car = createCar(spot.x, spot.z, (Math.random() * 0xFFFFFF) >>> 0, false, true, 'sedan');
        car.mesh.rotation.y = Math.PI / 2; car.body.position.set(spot.x, 1.1, spot.z); car.mesh.position.copy(car.body.position);
      });
      [-510, -390, 390, 510].forEach((bx) => {
        [-510, -390, 390, 510].forEach((bz) => {
          for (const side of [-1, 1]) {
            const x = bx + side * 25;
            const z = bz + 24;
            const parked = createCar(x, z, (Math.random() * 0xFFFFFF) >>> 0, false, true, 'sedan');
            parked.mesh.rotation.y = Math.PI / 2;
            parked.body.position.set(x, 1.1, z);
            parked.mesh.position.copy(parked.body.position);
          }
        });
      });
      createRoadsideParking(486);

      createRamp(0, 128, 12, 8, 1.6, 0);
      createRamp(-32, 140, 12, 9, 1.7, Math.PI / 3);
      createRamp(32, 140, 12, 9, 1.7, -Math.PI / 3);
      createRoad(535, 540, 58, 34);
      const debrisPlow = createCar(535, 540, 0xe6a719, false, true, 'plow');
      debrisPlow.mesh.rotation.y = Math.PI;
      debrisPlow.body.position.set(535, 1.2, 540);
      debrisPlow.mesh.position.copy(debrisPlow.body.position);
      buildNavigationGraph();
      createIntersectionSignage();

      [
        { type: 'sedan', x: -8, z: 22 }, { type: 'taxi', x: 0, z: 22 }, { type: 'sports', x: 8, z: 22 }
      ].forEach((spec) => { const car = createCar(spec.x, spec.z, 0x60a5fa, false, true, spec.type); car.mesh.rotation.y = 0; });
      [
        { x: 18, z: -18, size: 1.5 }, { x: -18, z: 18, size: 1.9 }, { x: 36, z: 18, size: 1.7 }, { x: -36, z: -18, size: 1.8 },
        { x: 10, z: 56, size: 1.6 }, { x: -12, z: -54, size: 1.8 }
      ].forEach((spec) => createBreakableCrate(spec.x, spec.z, spec.size, 0x8b5d3c, 3));
      const trafficCount = (webOptimizer.lowLag ? 14 : 24) * 10;
      for (let i = 0; i < trafficCount; i++) npcCars.push(createNPCCar());
      addBoundaryZones();
      createPeople();
      createBoats();
    }

    function tick(timestamp) {
      const frameTime = Number.isFinite(timestamp) ? timestamp : performance.now();
      const frameInterval = gameSettings.unlimitedFps ? 0 : 1000 / gameSettings.maxFps;
      if (frameTime - lastRenderedFrameTime < frameInterval) {
        requestAnimationFrame(tick);
        return;
      }
      const dt = Math.min(Math.max((frameTime - lastSimulationTime) / 1000, 1 / 120), 1 / 30);
      lastSimulationTime = frameTime;
      lastRenderedFrameTime = frameTime;
      world.broadphase.dirty = true;
      world.step(1 / 60, dt, 3);
      updateBuildingDebris();
      updateVehicleDebris(dt);
      updateFallingDrivers(dt);
      updateMedicalRescue(dt, frameTime);
      fpsFrameCount++;
      const fpsNow = performance.now();
      if (fpsNow - fpsSampleTime >= 1000) {
        const sampledFps = Math.round(fpsFrameCount * 1000 / (fpsNow - fpsSampleTime));
        fpsCounter.textContent = 'FPS ' + sampledFps;
        webOptimizer.adjustFrameRate(sampledFps);
        fpsFrameCount = 0;
        fpsSampleTime = fpsNow;
      }
      cars.forEach((car) => {
        if (!car || !car.body || car.destroyed) return;
        car.mesh.position.set(car.body.position.x, car.body.position.y, car.body.position.z);
        car.mesh.rotation.y = getQuaternionYaw(car.body.quaternion);
        updateCarHeadlights(car, frameTime);
      });
      updateBoats(dt);
      updateAirplanes(dt);
      if (controlledVehicle) {
        activeMode = 'drive';
        handleDriving(dt);
      } else if (controlledAirplane) {
        activeMode = 'aircraft';
      } else {
        activeMode = controlledBoat ? 'boat' : 'walk';
        updatePlayerControls(dt);
      }
      updatePushableObjects(dt);
      updateWreckageCrowds(frameTime);
      updateVisibleEntities();
      updateNPCs(dt); updateTireTracks(frameTime); updateCrashEffects(dt, frameTime); updateHumans(dt); updateBuildingWorkers(frameTime); updateFootprints(frameTime); triggerInputConflict(); updatePlayerFromVehicle(); updatePlayerCharacter(); if (gameSettings.cornerMap) updateMinimap(); updateSpeedometer(); updateMobileControls(); renderer.render(scene, camera); requestAnimationFrame(tick);
    }

    function init() {
      if (gameInitialized) return;
      gameInitialized = true;
      loadChunkCache();
      cityLayout(); setMission(0); const saved = loadGameState(); if (!saved) { camera.position.set(0, 6, 28); camera.lookAt(0, 0, 0); }
      applyGameSettings();
      applyTextureMode();
      renderDebug(); logDebug('info', 'City Sandbox initialized'); tick();
    }

    function applyKeyState(eventCode, pressed) {
      syncActiveMode();
      const activeInput = controlledVehicle || controlledAirplane ? driveKeys : walkKeys;
      if (eventCode === 'Space') {
        activeInput.jump = pressed && !flyMode;
      }
      if (eventCode === 'KeyW') {
        if (pressed && !controlledVehicle && !controlledAirplane) {
          const now = performance.now();
          if (now - lastWPressTime < 260) {
            walkKeys.sprint = true;
            showMessage('Sprinting');
          }
          lastWPressTime = now;
        }
        activeInput.forward = pressed;
        driveKeys.forward = pressed;
        walkKeys.forward = pressed;
        if (!pressed) {
          activeInput.sprint = false;
          walkKeys.sprint = false;
        }
      }
      if (eventCode === 'ArrowUp') {
        activeInput.forward = pressed;
        activeInput.up = pressed;
        driveKeys.forward = pressed;
        walkKeys.forward = pressed;
      }
      if (eventCode === 'ArrowDown' && controlledAirplane) {
        activeInput.down = pressed;
      } else if (eventCode === 'KeyS' || eventCode === 'ArrowDown') {
        activeInput.backward = pressed;
        driveKeys.backward = pressed;
        walkKeys.backward = pressed;
      }
      if ((eventCode === 'Digit0' || eventCode === 'Numpad0') && controlledAirplane) {
        driveKeys.backward = pressed;
      }
      if (eventCode === 'KeyA' || eventCode === 'ArrowLeft') {
        activeInput.right = pressed;
        driveKeys.right = pressed;
        walkKeys.right = pressed;
      }
      if (eventCode === 'KeyD' || eventCode === 'ArrowRight') {
        activeInput.left = pressed;
        driveKeys.left = pressed;
        walkKeys.left = pressed;
      }
      if (eventCode === 'ShiftLeft' || eventCode === 'ShiftRight') {
        if (pressed && playerState.boat) {
          leaveBoat();
          return;
        }
        if (pressed && controlledAirplane) {
          leaveAirplane();
          return;
        }
        if (pressed && controlledVehicle) {
          playerState.position.set(controlledVehicle.body.position.x, 1.7, controlledVehicle.body.position.z);
          playerState.yaw = controlledVehicle.mesh.rotation.y;
          playerState.onGround = true;
          controlledVehicle = null;
          syncActiveMode();
          clearVehicleKeys();
          showMessage('Exited vehicle.');
          return;
        }
        if (pressed && playerState.seatedOn) {
          playerState.seatedOn = null;
          playerState.position.y = 1.7;
          showMessage('Left the bench.');
          return;
        }
        if (!pressed) {
          const linked = people.find((person) => person.type === 'B' && person.state === 'State_LinkedToUser');
          if (linked) {
            linked.state = 'State_Default';
            linked.targetUser = null;
            linked.path = [];
            if (linked.targetTypeObject) {
              linked.targetTypeObject.state = 'State_Default';
              linked.targetTypeObject.targetUser = null;
            }
            linked.targetTypeObject = null;
            linked.parentTarget = null;
            controllerVerticalTracking = false;
            showMessage('Linked entity released.');
          }
        }
        activeInput.brake = pressed;
      }
      if (eventCode === 'AltLeft' || eventCode === 'AltRight') {
        if (pressed && !controlledVehicle) {
          cameraMode = cameraMode === 'first' ? 'third' : 'first';
          showMessage(cameraMode === 'first' ? 'First-person view' : 'Third-person view');
        }
      }
    }

    document.addEventListener('keydown', (event) => {
      if ((controlledVehicle || controlledAirplane) &&
        ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.code)) {
        event.preventDefault();
      }
      if (event.code === 'Escape') {
        pointerLockPausedByEscape = true;
        if (teleportMenu.classList.contains('visible')) showTeleportMenu(false);
        showMenu(true);
        return;
      }
      if (event.code === 'Space' && !event.repeat) {
        const now = performance.now();
        if (now - lastSpaceTapTime < 260) {
          toggleFlightMode();
        } else if (!controlledVehicle && !flyMode && playerState.onGround) {
          playerState.velocity.y = 6.8;
          playerState.onGround = false;
        }
        lastSpaceTapTime = now;
      }
      if (event.code === 'KeyX') { debugVisible = !debugVisible; renderDebug(); }
      if (event.code === 'KeyE') {
        const nearbyPlane = airplanes.find((aircraft) => {
          if (!aircraft || !aircraft.mesh || aircraft.crashed) return false;
          aircraft.mesh.updateMatrixWorld(true);
          const position = aircraft.mesh.getWorldPosition(new THREE.Vector3());
          return Math.hypot(playerState.position.x - position.x, playerState.position.z - position.z) < 60;
        });
        if (nearbyPlane && boardAirplane(nearbyPlane)) return;
        const bench = nearestBenchToPlayer();
        if (bench && !playerState.seatedOn) {
          playerState.seatedOn = bench;
          playerState.position.set(bench.x, 1.7, bench.z);
          showMessage('Sitting on the bench.');
          return;
        }
        handleElevatorSelection();
      }
      if (event.code === 'KeyQ') {
        if (controlledAirplane) leaveAirplane();
        else if (playerState.boat) leaveBoat();
        else if (controlledVehicle) { playerState.position.set(controlledVehicle.body.position.x, 1.7, controlledVehicle.body.position.z); playerState.yaw = controlledVehicle.mesh.rotation.y; playerState.onGround = true; controlledVehicle = null; syncActiveMode(); clearVehicleKeys(); showMessage('Exited vehicle.'); }
      }
      if (event.code === 'Space' && !event.repeat && controllerVerticalTracking) {
        activeInput.jump = true;
      }
      if (event.code === 'KeyG') { const options = ['sedan', 'taxi', 'sports', 'hatchback', 'suv', 'pickup', 'van', 'ambulance', 'plow']; const nextIndex = (options.indexOf(currentGarageModel) + 1) % options.length; currentGarageModel = options[nextIndex]; vehicleSelect.value = currentGarageModel; applyGarageSelection(); }
      if (event.code === 'KeyC' && !event.repeat) spawnPlayerCar();
      if (event.code === 'KeyM') setMission(missionIndex + 1);
      if (event.code === 'KeyP' && !event.repeat) {
        spawnAirportPlane();
      }
      if (event.code === 'Slash' && !event.repeat && !isMobile) {
        event.preventDefault();
        showTeleportMenu(!teleportMenu.classList.contains('visible'));
      }
      applyKeyState(event.code, true);
    });

    document.addEventListener('keyup', (event) => {
      if ((controlledVehicle || controlledAirplane) &&
        ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.code)) {
        event.preventDefault();
      }
      applyKeyState(event.code, false);
    });

    document.addEventListener('mousemove', (event) => {
      if (controlledVehicle || controlledAirplane) return;
      if (document.pointerLockElement !== renderer.domElement) return;
      playerState.yaw -= event.movementX * 0.0023;
      playerState.pitch -= event.movementY * 0.0018;
      playerState.pitch = THREE.MathUtils.clamp(playerState.pitch, -1.4, 1.4);
    });

    document.addEventListener('pointermove', (event) => {
      if (!isMobile || controlledVehicle || controlledAirplane || playerState.boat || !touchLook.active) return;
      playerState.yaw -= event.movementX * 0.0035;
      playerState.pitch -= event.movementY * 0.0026;
      playerState.pitch = THREE.MathUtils.clamp(playerState.pitch, -1.4, 1.4);
    });

    document.addEventListener('pointerup', () => {
      touchLook.active = false;
    });

    document.addEventListener('pointerlockchange', () => {
      playerState.pointerLocked = document.pointerLockElement === renderer.domElement;
      document.body.style.cursor = playerState.pointerLocked ? 'none' : 'auto';
      if (playerState.pointerLocked) return;
      if (!gameStarted) {
        showMenu(true);
        return;
      }
      if (pointerLockPausedByEscape || !menu.classList.contains('hidden') || teleportMenu.classList.contains('visible')) return;
      requestGamePointerLock();
    });

    renderer.domElement.addEventListener('click', () => {
      if (gameStarted && menu.classList.contains('hidden') && !teleportMenu.classList.contains('visible') && document.pointerLockElement !== renderer.domElement) {
        requestGamePointerLock();
      }
    });

    document.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      if (!tryBoardBoat(event) && !pickCarFromPointer(event)) {
        handleLinkedEntitySelection(event);
      }
    });

    function setMobileKeyState(code, pressed) {
      if (code === 'Camera') {
        touchLook.active = pressed;
        return;
      }
      if (code === 'MobileSprint') {
        walkKeys.sprint = pressed;
        return;
      }
      applyKeyState(code, pressed);
    }

    document.querySelectorAll('[data-mobile-key]').forEach((button) => {
      const code = button.dataset.mobileKey;
      button.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        button.setPointerCapture?.(event.pointerId);
        setMobileKeyState(code, true);
      });
      button.addEventListener('pointerup', (event) => {
        event.preventDefault();
        setMobileKeyState(code, false);
      });
      button.addEventListener('pointerleave', () => setMobileKeyState(code, false));
      button.addEventListener('pointercancel', () => setMobileKeyState(code, false));
    });

    document.addEventListener('pointerdown', (event) => {
      if (event.button === 0 && !event.ctrlKey) {
        if (tryBoardBoat(event)) return;
        if (pickCarFromPointer(event)) return;
        const raycaster = getPointerRaycaster(event);
        const planeHits = raycaster.intersectObjects(airplanes.map((aircraft) => aircraft.mesh), true);
        const selectedPlane = planeHits.length ? airplanes.find((aircraft) =>
          aircraft.mesh === planeHits[0].object ||
          aircraft.mesh.children.includes(planeHits[0].object) ||
          aircraft.mesh === planeHits[0].object.parent ||
          aircraft.mesh === planeHits[0].object.parent?.parent
        ) : null;
        if (selectedPlane && selectedPlane.parked && boardAirplane(selectedPlane)) return;
        handleEntityClick(event);
      }
      if (event.button === 2) {
        if (!tryBoardBoat(event) && !pickCarFromPointer(event)) {
          handleLinkedEntitySelection(event);
        }
      }
    });
    window.addEventListener('resize', () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
      webOptimizer.apply();
    });

    function initLights() {
      const hemi = new THREE.HemisphereLight(0xdfeeff, 0x4d5d3d, 1.15); scene.add(hemi);
      const sun = new THREE.DirectionalLight(0xfff7d6, 1.3); sun.position.set(30, 70, 40); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.camera.left = -120; sun.shadow.camera.right = 120; sun.shadow.camera.top = 120; sun.shadow.camera.bottom = -120; scene.add(sun);
    }

    closeGuideButton.addEventListener('click', () => setGuideVisible(false));
    closeRoutineButton.addEventListener('click', () => setRoutineVisible(false));
    function startCityFromMenu(event) {
      event.preventDefault();
      event.stopPropagation();
      applyGameSettings();
      gameStarted = true;
      pointerLockPausedByEscape = false;
      const garageValue = currentGarageModel || 'sedan';
      vehicleSelect.value = garageValue;
      applyGarageSelection();
      menu.classList.add('hidden');
      document.body.style.cursor = 'none';
      saveGameState();
      requestGamePointerLock();
      showMessage('City online. Explore the plaza and downtown blocks.');
    }
    startButton.addEventListener('click', startCityFromMenu);
    settingsButton.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      showSettingsView(true);
    });
    settingsBackButton.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      showSettingsView(false);
    });
    playSaveButton.addEventListener('click', startCityFromMenu);
    [resolutionSelect, maxFpsSelect, unlimitedFpsToggle, texturesToggle, planeDespawnToggle, destructionToggle, npcsToggle, cornerMapToggle].forEach((control) => {
      control.addEventListener('change', updateSettingsFromControls);
    });
    loadButton.addEventListener('click', (event) => { event.preventDefault(); event.stopPropagation(); const saved = loadGameState(); if (saved) { gameStarted = true; showMenu(false); showMessage('Saved city restored.'); } else showMessage('No city save found.'); });
    garageButton.addEventListener('click', (event) => { event.preventDefault(); event.stopPropagation(); applyGarageSelection(); showMessage('Garage updated.'); });
    vehicleSelect.addEventListener('change', () => { currentGarageModel = vehicleSelect.value; });
    colorPicker.addEventListener('input', () => { garageColor = parseInt(colorPicker.value.replace('#', ''), 16); });
    document.querySelectorAll('.teleport-option').forEach((button) => {
      button.addEventListener('click', () => teleportPlayer(button.dataset.destination));
    });

    initLights();
    loadTextures();
