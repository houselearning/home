    const gameAssetBaseUrl = new URL('.', document.currentScript?.src || document.baseURI);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x9ed0fb);
    scene.fog = new THREE.Fog(0x9ed0fb, 120, 420);
    const DAY_DURATION_SECONDS = 150;
    const NIGHT_DURATION_SECONDS = 120;
    let dayNightCycleStartedAt = null;
    let nightIntensity = 0;
    let hemisphereLight = null;
    let sunLight = null;
    let lastWindowLightingIntensity = -1;
    const daySkyColor = new THREE.Color(0x9ed0fb);
    const nightSkyColor = new THREE.Color(0x07111f);
    const dayWindowColor = new THREE.Color(0x18384a);
    const nightWindowColor = new THREE.Color(0xffc76a);

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
          if (object.userData && object.userData.lowLagOnly) object.visible = lowLag;
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
        applyVehicleDetailMode();
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
      brick: 'textures/brick.png',
      brickRed: 'textures/brick_red.png',
      roofTiles: 'textures/roof_tiles.png',
      border: 'textures/border.jpeg',
      borderAlternate: 'textures/border.png.sb-e1cee13c-dRZzqE',
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
      if (texture.image) texture.needsUpdate = true;
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
          if (solidColors[key] !== undefined) tex.userData.solidColor = solidColors[key];
          if (['asphalt', 'asphaltDark', 'sidewalk', 'stoneLight', 'plaza', 'grass', 'parkGrass', 'roofTiles', 'windowGrid', 'crosswalkWhite', 'water', 'waterPool'].includes(key)) {
            const repeatX = key === 'parkGrass' ? 26 : key === 'grass' ? 30 : key === 'sidewalk' || key === 'stoneLight' ? 6 : key === 'water' || key === 'waterPool' ? 8 : key === 'roofTiles' ? 2 : key === 'windowGrid' ? 3 : 12;
            const repeatY = key === 'parkGrass' ? 23 : key === 'grass' ? 30 : key === 'sidewalk' || key === 'stoneLight' ? 6 : key === 'water' || key === 'waterPool' ? 8 : key === 'roofTiles' ? 2 : key === 'windowGrid' ? 3 : 12;
            tex.repeat.set(repeatX, repeatY);
          }
      };
      const promises = textureKeys.map((key) => new Promise((resolve) => {
        let tex;
        const textureUrl = new URL(textureMap[key], gameAssetBaseUrl).href;
        try {
          tex = textureLoader.load(textureUrl, () => {
            syncTextureClones(key, tex);
            resolve();
          }, undefined, (error) => {
            console.error('Failed to load texture: ' + textureUrl, error);
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
    const buildingWindowMaterials = [];
    const buildingColliders = [];
    const worldBarriers = [];
    const footprintBuildingAreas = [];
    const destructibleProps = [];
    const fallingTreeTops = [];
    const debrisPieces = [];
    const wreckageCrowds = [];
    const vehicleDebris = [];
    function getDebrisLifetime() {
      return webOptimizer.lowLag ? 10000 : Infinity;
    }
    const cars = [];
    const npcCars = [];
    const jobVehicleRespawns = [];
    const jobAircraftRespawns = [];
    const JOB_VEHICLE_GARAGE = { x: 0, z: 28 };
    let nextJobVehicleGarageBay = 0;
    const people = [];
    const criminals = [];
    const janitors = [];
    const billionaireState = {
      mansion: null,
      billionaire: null,
      escorts: [],
      mansionGuards: [],
      maid: null,
      luxuryCars: [],
      drive: null,
      theft: null,
      nextDriveAt: 0,
      nextCarIndex: 0
    };
    const policeUnits = [];
    const prisonInmates = [];
    const prisonOfficers = [];
    const prisonEncounters = [];
    let playerWasInsidePrison = false;
    let prisonFacility = null;
    const raceCars = [];
    let raceTrack = null;
    const soccerFields = [];
    let activeSoccerField = null;
    let debrisPlowVehicle = null;
    const birds = [];
    const birdFlocks = [];
    const birdsByType = [[], [], [], []];
    const birdRenderers = [];
    const birdTransform = new THREE.Object3D();
    const buildingWorkers = [];
    const fallingDrivers = [];
    const medicalRescueState = { active: false, ambulance: null, medics: [], startedAt: 0, patientLoaded: false, dispatching: false, awaitingAmbulance: false, patientPosition: null };
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
    const npcFlashlightBodyGeometry = new THREE.CylinderGeometry(0.045, 0.06, 0.42, 8);
    const npcFlashlightLensGeometry = new THREE.SphereGeometry(0.065, 8, 6);
    const npcFlashlightBeamGeometry = new THREE.CylinderGeometry(0.015, 0.23, 4.2, 12, 1, true);
    const npcFlashlightBodyMaterial = new THREE.MeshStandardMaterial({ color: 0x273038, metalness: 0.72, roughness: 0.34 });
    const npcFlashlightLensMaterial = new THREE.MeshBasicMaterial({ color: 0xffefad });
    const npcFlashlightBeamMaterial = new THREE.MeshBasicMaterial({ color: 0xffefad, transparent: true, opacity: 0.075, depthWrite: false, side: THREE.DoubleSide });
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
    const RIVER_BRIDGE_DECK_WIDTH = RIVER_WIDTH + 13;
    const RIVER_BRIDGE_DECK_DEPTH = 22;
    const RIVER_BRIDGE_ARCH_HEIGHT = 4.2;
    let riverFenceMaterial = null;
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
          if (!webOptimizer.lowLag && !car.visualModeRegular) setVehicleVisualMode(car, true);
          car.body.wakeUp();
          return;
        }
        const near = isNear(car.body.position.x, car.body.position.y, car.body.position.z);
        car.mesh.visible = near;
        if (!webOptimizer.lowLag && near && !car.visualModeRegular) setVehicleVisualMode(car, true);
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
        const near = gameSettings.npcs && (person.task === 'race-angry' || isNear(person.mesh.position.x, person.mesh.position.y, person.mesh.position.z));
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
        const plow = debrisPlowVehicle && !debrisPlowVehicle.destroyed && debrisPlowVehicle.jobPhase !== 'dispatching'
          ? debrisPlowVehicle
          : null;
        x = plow ? plow.body.position.x : 535;
        z = plow ? plow.body.position.z - 9 : 531;
        yaw = Math.PI;
      } else if (destination === 'racetrack' && raceTrack) {
        x = raceTrack.center.x;
        z = raceTrack.center.z + 15;
        yaw = 0;
      } else if (destination === 'prison' && prisonFacility) {
        x = prisonFacility.x;
        z = prisonFacility.z + prisonFacility.depth / 2 + 5;
        yaw = Math.PI;
      } else if (destination === 'mansion' && billionaireState.mansion) {
        x = billionaireState.mansion.x;
        z = billionaireState.mansion.z + billionaireState.mansion.depth / 2 + 5;
        yaw = Math.PI;
      } else if (destination === 'soccer' && activeSoccerField) {
        x = activeSoccerField.x - 26;
        z = activeSoccerField.z - 42;
        yaw = 0;
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

    function isInsideCollisionBounds(box, x, z, paddingX = 0, paddingZ = paddingX) {
      const bounds = box.collisionSegments || [box];
      return bounds.some((segment) =>
        x >= segment.minX - paddingX && x <= segment.maxX + paddingX &&
        z >= segment.minZ - paddingZ && z <= segment.maxZ + paddingZ
      );
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
      return insideBuilding || worldBarriers.some((box) => isInsideCollisionBounds(box, x, z, padding));
    }

    function isOnRiverBridge(x, z) {
      return Math.abs(x - RIVER_X) <= RIVER_BRIDGE_DECK_WIDTH / 2 &&
        riverBridgeCenters.some((bridgeZ) => Math.abs(z - bridgeZ) <= RIVER_BRIDGE_DECK_DEPTH / 2);
    }

    function riverBridgeSurfaceHeight(x) {
      const normalizedX = THREE.MathUtils.clamp((x - RIVER_X) / (RIVER_BRIDGE_DECK_WIDTH / 2), -1, 1);
      return 0.05 + RIVER_BRIDGE_ARCH_HEIGHT * (1 - normalizedX * normalizedX);
    }

    function isRiverPosition(x, z) {
      return !isOnRiverBridge(x, z) && Math.abs(x - RIVER_X) <= RIVER_WIDTH / 2 && Math.abs(z) <= 600;
    }

    function groundHeightAt(x, z) {
      if (isOnRiverBridge(x, z)) return riverBridgeSurfaceHeight(x);
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

    function resolvePlayerFootstep(x, z, radius = 0.7) {
      const resolved = resolveFootstep(x, z, radius);
      if (resolved.blocked || flyMode || controllerVerticalTracking) return resolved;
      const candidateGround = groundHeightAt(resolved.x, resolved.z);
      for (const person of people) {
        if (!person || !person.active || !person.mesh.visible || person.ridingBoat) continue;
        if (Math.abs(person.mesh.position.y - candidateGround) > 1.7) continue;
        const candidateDistance = Math.hypot(person.mesh.position.x - resolved.x, person.mesh.position.z - resolved.z);
        if (candidateDistance >= 1.05) continue;
        const currentDistance = Math.hypot(person.mesh.position.x - playerState.position.x, person.mesh.position.z - playerState.position.z);
        if (currentDistance < 1.05 && candidateDistance > currentDistance) continue;
        return { x: playerState.position.x, z: playerState.position.z, blocked: true };
      }
      return resolved;
    }

    function resolveCharacterOverlaps() {
      const characters = people.filter((person) =>
        person && person.active && person.mesh.visible && !person.ridingBoat
      );
      const cellSize = 2;
      const minimumDistance = 1.05;
      const isStationary = (person) => person.task === 'police-officer' || person.task === 'mansion-guard' ||
        person.task === 'bench' ||
        (person.task === 'prison-inmate' && person.prisonRoutine === 'cell' && !person.prisonReturnHome) ||
        !!person.knockedDown;
      const moveCharacter = (person, dx, dz) => {
        const resolved = resolveFootstep(person.mesh.position.x + dx, person.mesh.position.z + dz, 0.55);
        if (resolved.blocked) return false;
        person.mesh.position.set(resolved.x, groundHeightAt(resolved.x, resolved.z), resolved.z);
        return true;
      };

      for (let pass = 0; pass < 2; pass++) {
        const grid = new Map();
        characters.forEach((person, index) => {
          const cellX = Math.floor(person.mesh.position.x / cellSize);
          const cellZ = Math.floor(person.mesh.position.z / cellSize);
          const key = cellX + ',' + cellZ;
          if (!grid.has(key)) grid.set(key, []);
          grid.get(key).push(index);
        });

        characters.forEach((first, firstIndex) => {
          const cellX = Math.floor(first.mesh.position.x / cellSize);
          const cellZ = Math.floor(first.mesh.position.z / cellSize);
          for (let offsetX = -1; offsetX <= 1; offsetX++) {
            for (let offsetZ = -1; offsetZ <= 1; offsetZ++) {
              const neighbors = grid.get((cellX + offsetX) + ',' + (cellZ + offsetZ)) || [];
              neighbors.forEach((secondIndex) => {
                if (secondIndex <= firstIndex) return;
                const second = characters[secondIndex];
                if (Math.abs(first.mesh.position.y - second.mesh.position.y) > 1.7) return;
                let dx = second.mesh.position.x - first.mesh.position.x;
                let dz = second.mesh.position.z - first.mesh.position.z;
                let distance = Math.hypot(dx, dz);
                if (distance >= minimumDistance) return;
                if (distance < 0.001) {
                  dx = firstIndex % 2 ? 1 : -1;
                  dz = secondIndex % 2 ? 1 : -1;
                  distance = Math.hypot(dx, dz);
                }
                const overlap = minimumDistance - distance + 0.01;
                dx /= distance;
                dz /= distance;
                const firstStatic = isStationary(first);
                const secondStatic = isStationary(second);
                if (firstStatic && secondStatic) return;
                if (firstStatic) {
                  moveCharacter(second, dx * overlap, dz * overlap);
                } else if (secondStatic) {
                  moveCharacter(first, -dx * overlap, -dz * overlap);
                } else {
                  const movedSecond = moveCharacter(second, dx * overlap * 0.5, dz * overlap * 0.5);
                  const movedFirst = moveCharacter(first, -dx * overlap * 0.5, -dz * overlap * 0.5);
                  if (!movedFirst && movedSecond) moveCharacter(second, dx * overlap * 0.5, dz * overlap * 0.5);
                }
              });
            }
          }
        });
      }

      if (controlledVehicle || controlledAirplane || controlledBoat || playerState.seatedOn || flyMode) return;
      const playerGround = playerState.position.y - 1.7;
      characters.forEach((person) => {
        if (Math.abs(person.mesh.position.y - playerGround) > 1.7) return;
        let dx = person.mesh.position.x - playerState.position.x;
        let dz = person.mesh.position.z - playerState.position.z;
        let distance = Math.hypot(dx, dz);
        if (distance >= minimumDistance) return;
        if (distance < 0.001) {
          dx = 1;
          dz = 0;
          distance = 1;
        }
        moveCharacter(person, dx / distance * (minimumDistance - distance + 0.01), dz / distance * (minimumDistance - distance + 0.01));
      });
    }

    function updatePlayerCharacter() {
      const motorcycle = controlledVehicle?.isMotorcycle ? controlledVehicle : null;
      let personVisible;
      if (motorcycle) {
        if (playerCharacter.parent !== motorcycle.mesh) motorcycle.mesh.add(playerCharacter);
        playerCharacter.position.set(0, 0.62, -0.12);
        playerCharacter.rotation.set(0.16, 0, 0);
        playerCharacter.scale.setScalar(0.72);
        personVisible = true;
      } else {
        if (playerCharacter.parent !== scene) scene.attach(playerCharacter);
        playerCharacter.position.set(playerState.position.x, playerState.position.y - 1.7, playerState.position.z);
        playerCharacter.rotation.set(0, playerState.yaw, 0);
        playerCharacter.scale.setScalar(1);
        const isPaddling = playerState.boat && controlledBoat === playerState.boat;
        personVisible = !controlledVehicle && (!playerState.boat || isPaddling) && !playerState.seatedOn;
      }
      playerCharacter.visible = personVisible;
      const isWalking = !motorcycle && personVisible && !playerState.airplane && (walkKeys.forward || walkKeys.backward || walkKeys.left || walkKeys.right);
      const walkPhase = isWalking ? performance.now() * 0.01 : 0;
      const armSwing = Math.sin(walkPhase) * 0.8;
      const legSwing = Math.sin(walkPhase) * 0.9;
      if (motorcycle) {
        playerLeftArm.rotation.set(-1.15, 0, 0);
        playerRightArm.rotation.set(-1.15, 0, 0);
        playerLeftLeg.rotation.set(-Math.PI / 2, 0, 0);
        playerRightLeg.rotation.set(-Math.PI / 2, 0, 0);
        playerBody.rotation.z = 0;
      } else {
        playerLeftArm.rotation.set(0, 0, isWalking ? armSwing : 0);
        playerRightArm.rotation.set(0, 0, isWalking ? -armSwing : 0);
        playerLeftLeg.rotation.set(isWalking ? -legSwing : 0, 0, 0);
        playerRightLeg.rotation.set(isWalking ? legSwing : 0, 0, 0);
        playerBody.rotation.z = playerState.velocity.y > 0 ? -0.2 : 0;
      }
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
      const centerX = (worldBounds.minX + worldBounds.maxX) / 2;
      const centerZ = (worldBounds.minZ + worldBounds.maxZ) / 2;
      const edgeOffset = 32;
      [
        { x: centerX, z: worldBounds.minZ - edgeOffset, rotationY: 0, texture: textures.border },
        { x: centerX, z: worldBounds.maxZ + edgeOffset, rotationY: Math.PI, texture: textures.borderAlternate },
        { x: worldBounds.minX - edgeOffset, z: centerZ, rotationY: Math.PI / 2, texture: textures.border },
        { x: worldBounds.maxX + edgeOffset, z: centerZ, rotationY: -Math.PI / 2, texture: textures.borderAlternate }
      ].forEach(({ x, z, rotationY, texture }) => {
        const material = new THREE.MeshBasicMaterial({ map: texture || null, color: 0xffffff, side: THREE.DoubleSide });
        const backdrop = new THREE.Mesh(geometry, material);
        backdrop.position.set(x, -144, z);
        backdrop.rotation.y = rotationY;
        scene.add(backdrop);
      });
    }

    function createBarrier(x, z, width, depth, height = 1.4, y = height / 2, color = 0xb6b9bb, breakable = false, kind = 'wall') {
      let mesh;
      if (kind === 'river-fence') {
        if (!riverFenceMaterial) riverFenceMaterial = new THREE.MeshStandardMaterial({ color: 0x78888b, metalness: 0.62, roughness: 0.42 });
        mesh = new THREE.Group();
        const horizontal = width >= depth;
        const length = horizontal ? width : depth;
        const railGeometry = horizontal
          ? new THREE.BoxGeometry(width, 0.12, 0.12)
          : new THREE.BoxGeometry(0.12, 0.12, depth);
        const rails = new THREE.InstancedMesh(railGeometry, riverFenceMaterial, 2);
        const transform = new THREE.Object3D();
        [0.42, 1.02].forEach((railY, index) => {
          transform.position.set(0, railY, 0);
          transform.rotation.set(0, 0, 0);
          transform.updateMatrix();
          rails.setMatrixAt(index, transform.matrix);
        });
        rails.instanceMatrix.needsUpdate = true;
        mesh.add(rails);
        const postCount = Math.max(1, Math.ceil(length / 3));
        const posts = new THREE.InstancedMesh(new THREE.BoxGeometry(0.14, height, 0.14), riverFenceMaterial, postCount + 1);
        for (let postIndex = 0; postIndex <= postCount; postIndex++) {
          const offset = -length / 2 + length * postIndex / postCount;
          transform.position.set(horizontal ? offset : 0, height / 2, horizontal ? 0 : offset);
          transform.updateMatrix();
          posts.setMatrixAt(postIndex, transform.matrix);
        }
        posts.instanceMatrix.needsUpdate = true;
        mesh.add(posts);
        mesh.position.set(x, y - height / 2, z);
        mesh.traverse((part) => {
          if (!part.isMesh) return;
          part.castShadow = true;
          part.receiveShadow = true;
        });
      } else {
        mesh = new THREE.Mesh(
          new THREE.BoxGeometry(width, height, depth),
          new THREE.MeshStandardMaterial({ map: textures.concreteGrey || null, color, roughness: 0.84 })
        );
        mesh.position.set(x, y, z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
      cityRoot.add(mesh);
      const body = new CANNON.Body({ mass: 0 });
      body.addShape(new CANNON.Box(new CANNON.Vec3(width / 2, height / 2, depth / 2)));
      body.position.set(x, y, z); world.addBody(body);
      worldBarriers.push({ x, z, width, depth, height, y, kind, breakable, health: breakable ? (kind === 'airport-wall' ? 90 : 42) : Infinity, minX: x - width / 2, maxX: x + width / 2, minZ: z - depth / 2, maxZ: z + depth / 2, mesh, body, material: kind === 'river-fence' ? riverFenceMaterial : mesh.material });
      return mesh;
    }

    function createBreakableBarrierLine(x, z, width, depth, height, y, color, kind = 'airport-wall') {
      const horizontal = width >= depth;
      const length = horizontal ? width : depth;
      const sectionCount = Math.ceil(length / (kind === 'river-fence' ? 24 : 12));
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
      const canalWallMaterial = new THREE.MeshStandardMaterial({
        map: textures.concreteGrey || textures.stoneLight || null,
        color: 0x929b98,
        roughness: 0.94,
        metalness: 0.04,
        emissive: 0x101817,
        emissiveIntensity: 0.35
      });
      const canalCapMaterial = new THREE.MeshStandardMaterial({ color: 0x697572, roughness: 0.88, metalness: 0.08 });
      for (const side of [-1, 1]) {
        const wallX = RIVER_X + side * (RIVER_WIDTH / 2 - 0.7);
        bankSegments.forEach(([start, end]) => {
          const segmentLength = end - start;
          const wall = new THREE.Mesh(new THREE.BoxGeometry(1.4, 10, segmentLength), canalWallMaterial);
          wall.position.set(wallX, -4.2, (start + end) / 2);
          wall.castShadow = true;
          wall.receiveShadow = true;
          cityRoot.add(wall);
          const cap = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.38, segmentLength), canalCapMaterial);
          cap.position.set(wallX, 0.55, (start + end) / 2);
          cap.castShadow = true;
          cap.receiveShadow = true;
          cityRoot.add(cap);
          const fenceX = RIVER_X + side * (RIVER_WIDTH / 2 + 1.2);
          createBreakableBarrierLine(fenceX, (start + end) / 2, 0.28, segmentLength, 1.3, 0.65, 0x78888b, 'river-fence');
        });
      }

      const bridgeDeckMaterial = new THREE.MeshStandardMaterial({ map: textures.asphalt || null, color: 0x777f82, roughness: 0.82 });
      const bridgeArchMaterial = new THREE.MeshStandardMaterial({ color: 0x68777b, metalness: 0.46, roughness: 0.5 });
      const bridgeRailMaterial = new THREE.MeshStandardMaterial({ color: 0xc6cdcd, metalness: 0.62, roughness: 0.38 });
      riverBridgeCenters.forEach((z) => {
        const segmentCount = 32;
        const segmentLength = RIVER_BRIDGE_DECK_WIDTH / segmentCount;
        const deckThickness = 0.55;
        const deck = new THREE.InstancedMesh(new THREE.BoxGeometry(segmentLength + 0.06, deckThickness, RIVER_BRIDGE_DECK_DEPTH), bridgeDeckMaterial, segmentCount);
        const deckTransform = new THREE.Object3D();
        for (let segmentIndex = 0; segmentIndex < segmentCount; segmentIndex++) {
          const x = RIVER_X - RIVER_BRIDGE_DECK_WIDTH / 2 + (segmentIndex + 0.5) * segmentLength;
          const normalizedX = (x - RIVER_X) / (RIVER_BRIDGE_DECK_WIDTH / 2);
          const surfaceY = riverBridgeSurfaceHeight(x);
          const slope = -2 * RIVER_BRIDGE_ARCH_HEIGHT * normalizedX / (RIVER_BRIDGE_DECK_WIDTH / 2);
          const rotationZ = Math.atan(slope);
          deckTransform.position.set(x, surfaceY - deckThickness / 2, z);
          deckTransform.rotation.set(0, 0, rotationZ);
          deckTransform.updateMatrix();
          deck.setMatrixAt(segmentIndex, deckTransform.matrix);
          const deckBody = new CANNON.Body({ mass: 0 });
          deckBody.addShape(new CANNON.Box(new CANNON.Vec3((segmentLength + 0.06) / 2, deckThickness / 2, RIVER_BRIDGE_DECK_DEPTH / 2)));
          deckBody.position.set(x, surfaceY - deckThickness / 2, z);
          deckBody.quaternion.setFromEuler(0, 0, rotationZ);
          world.addBody(deckBody);
        }
        deck.instanceMatrix.needsUpdate = true;
        deck.receiveShadow = true;
        deck.castShadow = true;
        cityRoot.add(deck);

        const railingPosts = new THREE.InstancedMesh(new THREE.BoxGeometry(0.14, 1.1, 0.14), bridgeRailMaterial, 34);
        const postTransform = new THREE.Object3D();
        [-1, 1].forEach((side, sideIndex) => {
          const archPoints = [];
          const railPoints = [];
          for (let pointIndex = 0; pointIndex <= 24; pointIndex++) {
            const x = RIVER_X - RIVER_BRIDGE_DECK_WIDTH / 2 + RIVER_BRIDGE_DECK_WIDTH * pointIndex / 24;
            const surfaceY = riverBridgeSurfaceHeight(x);
            archPoints.push(new THREE.Vector3(x, surfaceY - 1.2, z + side * (RIVER_BRIDGE_DECK_DEPTH / 2 - 1.2)));
            railPoints.push(new THREE.Vector3(x, surfaceY + 0.56, z + side * (RIVER_BRIDGE_DECK_DEPTH / 2 - 1.2)));
          }
          const arch = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(archPoints), 64, 0.38, 8, false), bridgeArchMaterial);
          arch.castShadow = true;
          cityRoot.add(arch);
          const rail = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(railPoints), 64, 0.09, 8, false), bridgeRailMaterial);
          rail.castShadow = true;
          cityRoot.add(rail);
          for (let postIndex = 0; postIndex <= 16; postIndex++) {
            const x = RIVER_X - RIVER_BRIDGE_DECK_WIDTH / 2 + RIVER_BRIDGE_DECK_WIDTH * postIndex / 16;
            const surfaceY = riverBridgeSurfaceHeight(x);
            const slope = -2 * RIVER_BRIDGE_ARCH_HEIGHT * ((x - RIVER_X) / (RIVER_BRIDGE_DECK_WIDTH / 2)) / (RIVER_BRIDGE_DECK_WIDTH / 2);
            postTransform.position.set(x, surfaceY + 0.28, z + side * (RIVER_BRIDGE_DECK_DEPTH / 2 - 1.2));
            postTransform.rotation.set(0, 0, Math.atan(slope));
            postTransform.updateMatrix();
            railingPosts.setMatrixAt(sideIndex * 17 + postIndex, postTransform.matrix);
          }
        });
        railingPosts.instanceMatrix.needsUpdate = true;
        railingPosts.castShadow = true;
        cityRoot.add(railingPosts);
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
      ].forEach((route, index) => {
        const mesh = plane.clone(true);
        mesh.position.set(route.centerX + Math.sin(route.phase) * route.radius, 132, route.centerZ + Math.cos(route.phase) * route.radius);
        mesh.rotation.y = route.phase + Math.PI / 2;
        mesh.scale.setScalar(0.72);
        scene.add(mesh);
        const driver = createSeatedDriver(mesh, 0, 0.15, 14, 0.42);
        applyPilotUniform(driver);
        driver.task = 'pilot';
        airplanes.push({ mesh, driver, parked: false, ai: true, jobRole: 'ai-aircraft', jobIndex: index, jobPhase: 'route', mass: 8200, speed: 38, heading: route.phase + Math.PI / 2, pitch: 0, verticalSpeed: 0, health: 1000, phase: route.phase, centerX: route.centerX, centerZ: route.centerZ, radius: route.radius, cruiseAltitude: 132 });
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

    function crashAirplane(aircraft, impactScore = 0) {
      if (!aircraft || aircraft.crashed) return;
      const wasControlled = controlledAirplane === aircraft;
      scheduleJobAircraftRespawn(aircraft);
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
        lifetime: getDebrisLifetime(),
        kind: 'aircraft'
      });
      createWreckageEvent(aircraft.mesh.position.x, aircraft.mesh.position.z, 'aircraft', true);
      return { wasControlled, impactScore };
    }

    function updateAirplanes(dt) {
      const now = performance.now() / 1000;
      airplanes.forEach((aircraft) => {
        if (aircraft.parked || aircraft.crashed) return;
        if (aircraft.ai) {
          if (aircraft.jobPhase === 'dispatching') {
            const target = new THREE.Vector3(
              aircraft.centerX + Math.sin(aircraft.phase) * aircraft.radius,
              aircraft.cruiseAltitude,
              aircraft.centerZ + Math.cos(aircraft.phase) * aircraft.radius
            );
            const direction = target.clone().sub(aircraft.mesh.position);
            const distance = direction.length();
            if (distance <= 12) {
              aircraft.mesh.position.copy(target);
              aircraft.jobPhase = 'route';
            } else {
              direction.normalize();
              aircraft.mesh.position.addScaledVector(direction, Math.min(distance - 12, aircraft.speed * dt));
              aircraft.heading = Math.atan2(direction.x, direction.z);
              aircraft.mesh.rotation.x = Math.atan2(direction.y, Math.hypot(direction.x, direction.z));
            }
          } else {
            aircraft.phase += aircraft.speed / aircraft.radius * dt;
            aircraft.heading = aircraft.phase + Math.PI / 2;
            aircraft.mesh.position.set(
              aircraft.centerX + Math.sin(aircraft.phase) * aircraft.radius,
              aircraft.cruiseAltitude + Math.sin(now * 0.22 + aircraft.phase) * 4,
              aircraft.centerZ + Math.cos(aircraft.phase) * aircraft.radius
            );
          }
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
        const hitAircraft = airplanes.find((other) => {
          if (other === aircraft || !other.mesh || other.parked || other.crashed) return false;
          const dx = aircraft.mesh.position.x - other.mesh.position.x;
          const dy = aircraft.mesh.position.y - other.mesh.position.y;
          const dz = aircraft.mesh.position.z - other.mesh.position.z;
          return dx * dx + dz * dz < 28 * 28 && Math.abs(dy) < 12;
        });
        if (hitAircraft) {
          const collisionX = (aircraft.mesh.position.x + hitAircraft.mesh.position.x) / 2;
          const collisionY = (aircraft.mesh.position.y + hitAircraft.mesh.position.y) / 2;
          const collisionZ = (aircraft.mesh.position.z + hitAircraft.mesh.position.z) / 2;
          crashAirplane(aircraft);
          crashAirplane(hitAircraft);
          createExplosionBurst(collisionX, collisionY, collisionZ);
          showMessage('Two aircraft collided!');
          return;
        }
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
          const crash = crashAirplane(aircraft, impactScore);
          if (crash && !crash.wasControlled) showMessage('Aircraft impact. Structural damage score: ' + Math.round(crash.impactScore));
        }
      });
    }

    function scheduleJobAircraftRespawn(aircraft) {
      if (!aircraft || !aircraft.ai || aircraft.jobRole !== 'ai-aircraft' || aircraft.jobRespawnScheduled) return;
      aircraft.jobRespawnScheduled = true;
      jobAircraftRespawns.push({ source: aircraft, readyAt: performance.now() + 1400 });
    }

    function updateJobAircraftRespawns(now) {
      for (let index = jobAircraftRespawns.length - 1; index >= 0; index--) {
        const entry = jobAircraftRespawns[index];
        if (now < entry.readyAt) continue;
        const source = entry.source;
        const mesh = airportPlaneTemplate.children[0].clone(true);
        mesh.position.set(JOB_VEHICLE_GARAGE.x, 132, JOB_VEHICLE_GARAGE.z);
        mesh.scale.setScalar(0.72);
        scene.add(mesh);
        const driver = createSeatedDriver(mesh, 0, 0.15, 14, 0.42);
        applyPilotUniform(driver);
        driver.task = 'pilot';
        airplanes.push({
          mesh,
          driver,
          parked: false,
          ai: true,
          jobRole: 'ai-aircraft',
          jobIndex: source.jobIndex,
          jobPhase: 'dispatching',
          mass: source.mass,
          speed: source.speed,
          heading: source.heading,
          pitch: 0,
          verticalSpeed: 0,
          health: 1000,
          phase: source.phase,
          centerX: source.centerX,
          centerZ: source.centerZ,
          radius: source.radius,
          cruiseAltitude: source.cruiseAltitude
        });
        jobAircraftRespawns.splice(index, 1);
      }
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
      const hasBridge = riverBridgeCenters.some((center) => Math.abs(z - center) <= depth / 2 + RIVER_BRIDGE_DECK_DEPTH / 2);
      let roadSegments = [{ x, width }];
      if (crossesRiver) {
        const crossingStart = hasBridge ? RIVER_X - RIVER_BRIDGE_DECK_WIDTH / 2 : riverStartX;
        const crossingEnd = hasBridge ? RIVER_X + RIVER_BRIDGE_DECK_WIDTH / 2 : riverEndX;
        roadSegments = [
          { x: (roadStartX + Math.min(roadEndX, crossingStart)) / 2, width: Math.max(0, Math.min(roadEndX, crossingStart) - roadStartX) },
          { x: (Math.max(roadStartX, crossingEnd) + roadEndX) / 2, width: Math.max(0, roadEndX - Math.max(roadStartX, crossingEnd)) }
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
        const roadGapHalfWidth = hasBridge ? RIVER_BRIDGE_DECK_WIDTH / 2 : RIVER_WIDTH / 2 + WATERWAY_KEEP_OUT + 3;
        if (crossesRiver && width > depth && Math.abs(dash.position.x - RIVER_X) < roadGapHalfWidth) continue;
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

    function createTreeCanopyGeometry(scale, lowLag) {
      const clusterSpecs = lowLag
        ? [
            [0, 2.85, 0, 0.92], [-0.58, 2.63, 0.08, 0.72], [0.54, 2.57, -0.1, 0.76], [0.02, 3.48, 0.02, 0.61]
          ]
        : [
            [0, 2.84, 0, 0.88], [-0.62, 2.62, 0.12, 0.69], [0.62, 2.68, -0.08, 0.72],
            [-0.22, 2.55, -0.58, 0.7], [0.26, 2.58, 0.58, 0.72], [-0.3, 3.28, 0.2, 0.66],
            [0.38, 3.2, -0.24, 0.68], [0.04, 3.72, 0.04, 0.53], [-0.06, 2.42, 0.04, 0.67]
          ];
      const leafShades = [0x3d7134, 0x4d843a, 0x5b9142, 0x477b35, 0x68994a, 0x386a31];
      const sourceGeometry = new THREE.IcosahedronGeometry(1, lowLag ? 0 : 1);
      const sourcePositions = sourceGeometry.getAttribute('position');
      const sourceIndices = sourceGeometry.index ? Array.from(sourceGeometry.index.array) : Array.from({ length: sourcePositions.count }, (_, index) => index);
      const positions = [];
      const colors = [];
      const indices = [];

      clusterSpecs.forEach((clusterSpec, clusterIndex) => {
        const [offsetX, offsetY, offsetZ, radius] = clusterSpec;
        const color = new THREE.Color(leafShades[clusterIndex % leafShades.length]);
        const vertexOffset = positions.length / 3;
        for (let vertexIndex = 0; vertexIndex < sourcePositions.count; vertexIndex++) {
          const positionX = sourcePositions.getX(vertexIndex);
          const positionY = sourcePositions.getY(vertexIndex);
          const positionZ = sourcePositions.getZ(vertexIndex);
          positions.push(
            (offsetX + positionX * radius * 1.08) * scale,
            (offsetY + positionY * radius) * scale,
            (offsetZ + positionZ * radius * 1.08) * scale
          );
          colors.push(color.r, color.g, color.b);
        }
        sourceIndices.forEach((vertexIndex) => indices.push(vertexOffset + vertexIndex));
      });

      sourceGeometry.dispose();
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
      geometry.setIndex(indices);
      geometry.computeVertexNormals();
      return geometry;
    }

    function addTree(x, z, scale = 1.2) {
      const placement = worldPlacement.reserveNearest(x, z, scale * 2.8, scale * 2.8, 'tree', 0.35);
      if (!placement) return null;
      x = placement.x;
      z = placement.z;
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22 * scale, 0.30 * scale, 2.4 * scale, 12), new THREE.MeshStandardMaterial({ color: 0x7c4a27, roughness: 1 }));
      trunk.position.y = 1.2 * scale; trunk.castShadow = true;
      const lowLag = webOptimizer.lowLag;
      const canopy = new THREE.Mesh(
        createTreeCanopyGeometry(scale, lowLag),
        new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, flatShading: lowLag })
      );
      canopy.castShadow = !lowLag;
      canopy.receiveShadow = !lowLag;
      const g = new THREE.Group();
      g.add(trunk, canopy);
      g.position.set(x, 0, z); cityRoot.add(g);
      destructibleProps.push({ mesh: g, trunk, leaves: [canopy], x, z, scale, radius: 1.5 * scale, health: 24, destroyed: false, outcome: null });
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
      const fallbackLeafMaterial = new THREE.MeshStandardMaterial({ color: 0x4d843a, roughness: 0.92 });
      for (let index = 0; index < 12; index++) {
        const isLeaf = index >= 7;
        const size = isLeaf ? 0.24 + Math.random() * 0.3 : 0.16 + Math.random() * 0.18;
        const mesh = new THREE.Mesh(
          new THREE.BoxGeometry(size, size * (isLeaf ? 0.75 : 1.8), size),
          isLeaf ? fallbackLeafMaterial : prop.trunk.material
        );
        mesh.position.set(
          origin.x + (Math.random() - 0.5) * prop.scale * 2.2,
          0.6 + Math.random() * prop.scale * 2,
          origin.z + (Math.random() - 0.5) * prop.scale * 2.2
        );
        mesh.rotation.set(Math.random(), Math.random() * Math.PI, Math.random());
        scene.add(mesh);
        if (vehicleDebris.length >= (webOptimizer.lowLag ? 80 : Infinity)) scene.remove(vehicleDebris.shift().mesh);
        vehicleDebris.push({
          mesh,
          velocity: new THREE.Vector3((Math.random() - 0.5) * 8, 2 + Math.random() * 5, (Math.random() - 0.5) * 8),
          createdAt: performance.now(),
          lifetime: getDebrisLifetime()
        });
      }
      const now = performance.now();
      car.smokingUntil = now + 6500;
      createCrashSmoke(car, now, 6500);
    }

    function dropTreeTop(prop, impact) {
      if (!prop || prop.topDropped || !prop.leaves || !prop.leaves.length) return;
      const canopy = prop.leaves[0];
      prop.mesh.updateMatrixWorld(true);
      scene.attach(canopy);
      canopy.geometry.computeBoundingBox();
      const localCenter = canopy.geometry.boundingBox.getCenter(new THREE.Vector3());
      const worldCenter = canopy.localToWorld(localCenter.clone());
      const worldBounds = new THREE.Box3().setFromObject(canopy);
      const halfHeight = worldBounds.getSize(new THREE.Vector3()).y / 2;
      canopy.geometry.translate(-localCenter.x, -localCenter.y, -localCenter.z);
      canopy.position.copy(worldCenter);
      prop.leaves = [];
      prop.topDropped = true;
      fallingTreeTops.push({
        mesh: canopy,
        velocity: new THREE.Vector3((Math.random() - 0.5) * 2.5, Math.min(impact * 0.08, 3.5), (Math.random() - 0.5) * 2.5),
        angularVelocity: new THREE.Vector3((Math.random() - 0.5) * 1.2, (Math.random() - 0.5) * 1.4, (Math.random() - 0.5) * 1.2),
        halfHeight,
        createdAt: performance.now(),
        landed: false
      });
    }

    function resolveTreeImpact(prop, car, impact, roll = Math.random()) {
      if (!prop || prop.destroyed || prop.outcome || impact <= 5) return;
      if (Math.random() < 0.7) dropTreeTop(prop, impact);
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
        commercial: { base: 0x2a3343, roof: 0x9ca3af, trim: 0xdfe7ef, facade: textures.brick || textures.concreteGrey || textures.plasterGrey, accent: textures.windowGrid || textures.glassWindowBlue },
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
      const residential = zone === 'residential';
      const windowLightingChance = residential ? 0.78 : zone === 'office' ? 0.62 : 0.48;
      buildingWindowMaterials.push({
        material: windowMaterial,
        nightLevel: Math.random() < windowLightingChance ? 0.8 + Math.random() * 0.55 : 0.025
      });
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

    const vehicleTrimMaterial = new THREE.MeshStandardMaterial({ color: 0x27323a, metalness: 0.58, roughness: 0.42 });
    const vehicleChromeMaterial = new THREE.MeshStandardMaterial({ color: 0x9ba7ad, metalness: 0.86, roughness: 0.25 });
    const vehicleHubGeometry = new THREE.CylinderGeometry(0.22, 0.22, 0.055, 16);

    function createRoundedVehicleGeometry(width, height, length) {
      const shape = new THREE.Shape();
      const left = -width / 2;
      const right = width / 2;
      const bottom = -height / 2;
      const top = height / 2;
      const radius = Math.min(width, height) * 0.16;
      shape.moveTo(left + radius, bottom);
      shape.lineTo(right - radius, bottom);
      shape.quadraticCurveTo(right, bottom, right, bottom + radius);
      shape.lineTo(right, top - radius);
      shape.quadraticCurveTo(right, top, right - radius, top);
      shape.lineTo(left + radius, top);
      shape.quadraticCurveTo(left, top, left, top - radius);
      shape.lineTo(left, bottom + radius);
      shape.quadraticCurveTo(left, bottom, left + radius, bottom);
      const geometry = new THREE.ExtrudeGeometry(shape, {
        depth: Math.max(0.5, length - 0.12),
        bevelEnabled: true,
        bevelSegments: 2,
        steps: 1,
        bevelSize: 0.035,
        bevelThickness: 0.035,
        curveSegments: 4
      });
      geometry.translate(0, 0, -length / 2 + 0.06);
      return geometry;
    }

    function createVehicleDetails(car) {
      const detailGroup = car.detailGroup;
      const profile = car.profile;
      const trimParts = [];
      const chromeParts = [];
      const addPart = (geometry, material, x, y, z, rotationY = 0, rotationZ = 0, ownsGeometry = true) => {
        const part = { geometry, x, y, z, rotationY, rotationZ, ownsGeometry };
        (material === vehicleChromeMaterial ? chromeParts : trimParts).push(part);
      };
      const bumperGeometry = new THREE.BoxGeometry(profile.width * 0.82, 0.16, 0.16);
      addPart(bumperGeometry, vehicleTrimMaterial, 0, 0.64, profile.length / 2 + 0.035);
      addPart(bumperGeometry, vehicleTrimMaterial, 0, 0.64, -profile.length / 2 - 0.035);

      const grilleWidth = profile.width * 0.27;
      const grilleHeight = 0.2;
      addPart(new THREE.BoxGeometry(grilleWidth, grilleHeight, 0.045), vehicleTrimMaterial, 0, 0.82, profile.length / 2 + 0.04);
      for (let barIndex = 0; barIndex < 3; barIndex++) {
        const slat = new THREE.BoxGeometry(grilleWidth * 0.86, 0.025, 0.055);
        addPart(slat, vehicleChromeMaterial, 0, 0.75 + barIndex * 0.065, profile.length / 2 + 0.07);
      }

      const mirrorGeometry = new THREE.BoxGeometry(0.14, 0.12, 0.22);
      const sideGeometry = new THREE.BoxGeometry(0.045, 0.34, profile.cabinLength * 0.62);
      const handleGeometry = new THREE.BoxGeometry(0.16, 0.045, 0.055);
      for (const side of [-1, 1]) {
        addPart(mirrorGeometry, vehicleTrimMaterial, side * (profile.cabinWidth / 2 + 0.1), profile.cabinY - 0.04, profile.cabinLength * 0.34);
        addPart(sideGeometry, vehicleTrimMaterial, side * (profile.cabinWidth / 2 + 0.015), profile.cabinY, 0.05);
        for (const doorOffset of [-0.35, 0.55]) {
          addPart(handleGeometry, vehicleChromeMaterial, side * (profile.width / 2 + 0.025), 0.88, doorOffset);
        }
        for (const wheelOffset of [-profile.wheelZ, profile.wheelZ]) {
          addPart(vehicleHubGeometry, vehicleChromeMaterial, side * (profile.wheelX + 0.23), 0.42, wheelOffset, 0, Math.PI / 2, false);
        }
      }
      const mergeParts = (parts) => {
        const positions = [];
        const indices = [];
        parts.forEach((part) => {
          const geometry = part.geometry.clone();
          const position = new THREE.Vector3(part.x, part.y, part.z);
          const rotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, part.rotationY, part.rotationZ));
          geometry.applyMatrix4(new THREE.Matrix4().compose(position, rotation, new THREE.Vector3(1, 1, 1)));
          const geometryPositions = geometry.getAttribute('position');
          const vertexOffset = positions.length / 3;
          for (let vertexIndex = 0; vertexIndex < geometryPositions.count; vertexIndex++) {
            positions.push(geometryPositions.getX(vertexIndex), geometryPositions.getY(vertexIndex), geometryPositions.getZ(vertexIndex));
          }
          const geometryIndices = geometry.index ? geometry.index.array : Array.from({ length: geometryPositions.count }, (_, index) => index);
          geometryIndices.forEach((vertexIndex) => indices.push(vertexOffset + vertexIndex));
          geometry.dispose();
          if (part.ownsGeometry) part.geometry.dispose();
        });
        const mergedGeometry = new THREE.BufferGeometry();
        mergedGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        mergedGeometry.setIndex(indices);
        mergedGeometry.computeVertexNormals();
        return mergedGeometry;
      };
      const trimMesh = new THREE.Mesh(mergeParts(trimParts), vehicleTrimMaterial);
      const chromeMesh = new THREE.Mesh(mergeParts(chromeParts), vehicleChromeMaterial);
      trimMesh.castShadow = true;
      trimMesh.receiveShadow = true;
      chromeMesh.castShadow = true;
      chromeMesh.receiveShadow = true;
      detailGroup.add(trimMesh, chromeMesh);
      return detailGroup;
    }

    function setVehicleVisualMode(car, regularMode) {
      if (!car || car.isMotorcycle || !car.mainBody || !car.profile) return;
      if (regularMode) {
        if (!car.regularBodyGeometry) car.regularBodyGeometry = createRoundedVehicleGeometry(car.profile.width, car.profile.height, car.profile.length);
        if (!car.regularCabinGeometry) car.regularCabinGeometry = createRoundedVehicleGeometry(car.profile.cabinWidth, car.profile.cabinHeight, car.profile.cabinLength);
        car.mainBody.geometry = car.regularBodyGeometry;
        car.cabin.geometry = car.regularCabinGeometry;
        car.cabin.material.color.setHex(0x66808a);
        car.cabin.material.opacity = 0.3;
        if (!car.detailGroup.children.length) createVehicleDetails(car);
        car.detailGroup.visible = true;
      } else {
        car.mainBody.geometry = car.baseBodyGeometry;
        car.cabin.geometry = car.baseCabinGeometry;
        car.cabin.material.color.setHex(0xdfeafc);
        car.cabin.material.opacity = 0.42;
        car.detailGroup.visible = false;
        while (car.detailGroup.children.length) {
          const detail = car.detailGroup.children[0];
          car.detailGroup.remove(detail);
          if (detail.geometry) detail.geometry.dispose();
        }
        if (car.regularBodyGeometry) car.regularBodyGeometry.dispose();
        if (car.regularCabinGeometry) car.regularCabinGeometry.dispose();
        car.regularBodyGeometry = null;
        car.regularCabinGeometry = null;
      }
      car.visualModeRegular = regularMode;
      car.mainBody.geometry.computeBoundingSphere();
      car.cabin.geometry.computeBoundingSphere();
    }

    function applyVehicleDetailMode() {
      const origin = controlledVehicle ? controlledVehicle.body.position : playerState.position;
      const radius = entityVisibilityRadius();
      cars.forEach((car) => {
        if (!car || car.destroyed) return;
        const near = car === controlledVehicle || Math.hypot(car.body.position.x - origin.x, car.body.position.z - origin.z) <= radius;
        setVehicleVisualMode(car, !webOptimizer.lowLag && near);
      });
    }

    function createMotorcycleModel(color) {
      if (!createMotorcycleModel.shared) {
        createMotorcycleModel.shared = {
          tireGeometry: new THREE.TorusGeometry(0.34, 0.09, 8, 18),
          rimGeometry: new THREE.TorusGeometry(0.22, 0.025, 6, 16),
          tireMaterial: new THREE.MeshStandardMaterial({ color: 0x171b1f, roughness: 0.92 }),
          metalMaterial: new THREE.MeshStandardMaterial({ color: 0x9da8ac, metalness: 0.84, roughness: 0.3 }),
          frameMaterial: new THREE.MeshStandardMaterial({ color: 0x303940, metalness: 0.68, roughness: 0.38 }),
          engineMaterial: new THREE.MeshStandardMaterial({ color: 0x697378, metalness: 0.82, roughness: 0.34 }),
          seatMaterial: new THREE.MeshStandardMaterial({ color: 0x202428, roughness: 0.74 })
        };
      }
      const shared = createMotorcycleModel.shared;
      const group = new THREE.Group();
      const bodyMaterial = new THREE.MeshStandardMaterial({ color, metalness: 0.72, roughness: 0.25 });
      const mainBody = new THREE.Mesh(new THREE.SphereGeometry(0.36, 16, 12), bodyMaterial);
      mainBody.position.set(0, 1.22, 0.08);
      mainBody.scale.set(0.9, 0.56, 1.22);
      mainBody.castShadow = true;
      group.add(mainBody);

      const tires = new THREE.InstancedMesh(shared.tireGeometry, shared.tireMaterial, 2);
      const rims = new THREE.InstancedMesh(shared.rimGeometry, shared.metalMaterial, 2);
      const wheelTransform = new THREE.Object3D();
      [-0.78, 0.78].forEach((wheelZ, index) => {
        wheelTransform.position.set(0, 0.42, wheelZ);
        wheelTransform.rotation.set(0, Math.PI / 2, 0);
        wheelTransform.updateMatrix();
        tires.setMatrixAt(index, wheelTransform.matrix);
        rims.setMatrixAt(index, wheelTransform.matrix);
      });
      tires.instanceMatrix.needsUpdate = true;
      rims.instanceMatrix.needsUpdate = true;
      group.add(tires, rims);

      const engine = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.4, 0.5), shared.engineMaterial);
      engine.position.set(0, 0.76, -0.08);
      group.add(engine);
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.15, 0.66), shared.seatMaterial);
      seat.position.set(0, 1.12, -0.48);
      group.add(seat);
      const tank = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 10), bodyMaterial);
      tank.position.set(0, 1.32, 0.18);
      tank.scale.set(0.78, 0.66, 1.1);
      group.add(tank);

      const frameGeometry = new THREE.CylinderGeometry(0.035, 0.035, 1, 7);
      const addFrameBar = (start, end, material = shared.frameMaterial, radius = 0.035) => {
        const direction = new THREE.Vector3(end[0] - start[0], end[1] - start[1], end[2] - start[2]);
        const bar = new THREE.Mesh(radius === 0.035 ? frameGeometry : new THREE.CylinderGeometry(radius, radius, 1, 7), material);
        bar.position.set((start[0] + end[0]) / 2, (start[1] + end[1]) / 2, (start[2] + end[2]) / 2);
        bar.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize());
        bar.scale.y = direction.length();
        bar.castShadow = true;
        group.add(bar);
      };
      [-1, 1].forEach((side) => {
        addFrameBar([side * 0.14, 0.5, -0.78], [side * 0.14, 0.78, -0.08]);
        addFrameBar([side * 0.14, 0.78, -0.08], [side * 0.14, 1.22, 0.72]);
        addFrameBar([side * 0.14, 0.5, 0.72], [side * 0.14, 1.22, 0.72], shared.metalMaterial, 0.045);
      });
      addFrameBar([-0.18, 0.8, -0.08], [0.18, 0.8, -0.08]);

      const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.075, 0.92, 10), shared.metalMaterial);
      exhaust.rotation.x = Math.PI / 2;
      exhaust.position.set(0.27, 0.58, -0.55);
      group.add(exhaust);
      const handleBar = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.92, 8), shared.frameMaterial);
      handleBar.rotation.z = Math.PI / 2;
      handleBar.position.set(0, 1.31, 0.82);
      group.add(handleBar);
      [-1, 1].forEach((side) => {
        const mirrorArm = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.38, 6), shared.frameMaterial);
        mirrorArm.position.set(side * 0.28, 1.51, 0.84);
        mirrorArm.rotation.z = side * 0.72;
        group.add(mirrorArm);
        const mirror = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), shared.metalMaterial);
        mirror.position.set(side * 0.46, 1.68, 0.92);
        mirror.scale.set(1.2, 0.7, 0.4);
        group.add(mirror);
      });

      const headlightMaterial = new THREE.MeshStandardMaterial({ color: 0x59636e, emissive: 0xfff1c2, emissiveIntensity: 0, roughness: 0.25, metalness: 0.18 });
      const lampHousing = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.23, 0.14, 20), shared.frameMaterial);
      lampHousing.rotation.x = Math.PI / 2;
      lampHousing.position.set(0, 1.25, 0.99);
      group.add(lampHousing);
      const headlight = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 12), headlightMaterial);
      headlight.position.set(0, 1.25, 1.075);
      group.add(headlight);
      const rearLightMaterial = new THREE.MeshStandardMaterial({ color: 0x451116, emissive: 0xff1d2d, emissiveIntensity: 0.3, roughness: 0.3 });
      const rearLight = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.13, 0.08), rearLightMaterial);
      rearLight.position.set(0, 0.92, -1.0);
      group.add(rearLight);

      const plateText = Array.from({ length: 2 }, () => 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)]).join('') + '-' + String(Math.floor(Math.random() * 1000)).padStart(3, '0');
      const plateCanvas = document.createElement('canvas');
      plateCanvas.width = 320;
      plateCanvas.height = 112;
      const plateContext = plateCanvas.getContext('2d');
      plateContext.fillStyle = '#f0f1eb';
      plateContext.fillRect(0, 0, plateCanvas.width, plateCanvas.height);
      plateContext.strokeStyle = '#202a30';
      plateContext.lineWidth = 8;
      plateContext.strokeRect(4, 4, plateCanvas.width - 8, plateCanvas.height - 8);
      plateContext.fillStyle = '#18232a';
      plateContext.font = 'bold 64px monospace';
      plateContext.textAlign = 'center';
      plateContext.textBaseline = 'middle';
      plateContext.fillText(plateText, plateCanvas.width / 2, plateCanvas.height / 2);
      const plateTexture = new THREE.CanvasTexture(plateCanvas);
      plateTexture.encoding = THREE.sRGBEncoding;
      const plateGroup = new THREE.Group();
      const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.2), new THREE.MeshStandardMaterial({ map: plateTexture, roughness: 0.64 }));
      plate.position.y = 0.72;
      plate.rotation.y = Math.PI;
      plateGroup.add(plate);
      plateGroup.position.set(0, 0, -1.15);
      group.add(plateGroup);

      const profile = { width: 0.9, height: 1.35, length: 2.5, cabinWidth: 0, cabinHeight: 0, cabinLength: 0, cabinY: 0, wheelX: 0.4, wheelZ: 0.78, mass: 58 };
      const body = new CANNON.Body({ mass: profile.mass, material: new CANNON.Material('car') });
      body.addShape(new CANNON.Box(new CANNON.Vec3(0.42, 0.52, 1.18)));
      body.position.set(0, 1.2, 0);
      body.linearDamping = 0.12;
      body.angularDamping = 0.48;
      world.addBody(body);
      return {
        mesh: group, body, type: 'motorcycle', profile, mainBody, cabin: null, detailGroup: new THREE.Group(),
        baseBodyGeometry: mainBody.geometry, baseCabinGeometry: null, regularBodyGeometry: null, regularCabinGeometry: null,
        isPlow: false, isMotorcycle: true, color, originalBodyColor: new THREE.Color(color), speed: 0, steer: 0,
        target: null, npc: false, parked: false, owner: null, driver: null, headlights: [headlight], headlightMaterial,
        rearLights: [rearLight], rearLightMaterial, licensePlate: plateText, plateGroup, plateDropped: false, plateTexture,
        crashFlashUntil: 0, treeCollisionGrace: null, inside: false, canEnter: true, fuel: Infinity, maxFuel: Infinity,
        rampLift: 0, airborne: false, health: 100, destroyed: false, fallenOver: false, lastCrashEffectAt: -Infinity, trackDistance: 0, trackPosition: null, onFire: false
      };
    }

    function createVehicleModel(type, color) {
      if (type === 'motorcycle') return createMotorcycleModel(color);
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
      const bodyColor = type === 'taxi' ? 0xfacc15 : type === 'plow' ? 0xe6a719 : color;
      const baseBodyGeometry = new THREE.BoxGeometry(profile.width, profile.height, profile.length);
      const mainBody = new THREE.Mesh(baseBodyGeometry, new THREE.MeshStandardMaterial({ color: bodyColor, metalness: 0.52, roughness: 0.3 }));
      mainBody.position.y = 0.8; group.add(mainBody);
      const baseCabinGeometry = new THREE.BoxGeometry(profile.cabinWidth, profile.cabinHeight, profile.cabinLength);
      const cabin = new THREE.Mesh(baseCabinGeometry, new THREE.MeshStandardMaterial({ color: 0xdfeafc, metalness: 0.7, roughness: 0.2, transparent: true, opacity: 0.42, depthWrite: false }));
      cabin.position.set(0, profile.cabinY, type === 'pickup' ? 0.48 : 0.1); group.add(cabin);
      const detailGroup = new THREE.Group();
      group.add(detailGroup);
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
      const car = { mesh: group, body, type, profile, mainBody, cabin, detailGroup, baseBodyGeometry, baseCabinGeometry, regularBodyGeometry: null, regularCabinGeometry: null, isPlow: type === 'plow', color, originalBodyColor: new THREE.Color(bodyColor), speed: 0, steer: 0, target: null, npc: false, parked: false, owner: null, driver: null, headlights, headlightMaterial, rearLights, rearLightMaterial, licensePlate: plateText, plateGroup, plateDropped: false, plateTexture, crashFlashUntil: 0, treeCollisionGrace: null, inside: false, canEnter: true, fuel: Infinity, maxFuel: Infinity, rampLift: 0, airborne: false, health: 100, destroyed: false, lastCrashEffectAt: -Infinity, trackDistance: 0, trackPosition: null, onFire: false };
      setVehicleVisualMode(car, false);
      return car;
    }

    function addRaceCarVisuals(car, index) {
      const raceAccents = [0xf4f5f2, 0xe34243, 0xf4d24a, 0x101820, 0x42d5c7];
      const accentColor = raceAccents[index % raceAccents.length];
      const group = new THREE.Group();
      const carbon = new THREE.MeshStandardMaterial({ color: 0x151b1e, metalness: 0.34, roughness: 0.68 });
      const accent = new THREE.MeshStandardMaterial({ color: accentColor, metalness: 0.2, roughness: 0.48 });
      const addBox = (width, height, depth, material, x, y, z) => {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
        mesh.position.set(x, y, z);
        mesh.castShadow = !webOptimizer.lowLag;
        mesh.receiveShadow = !webOptimizer.lowLag;
        group.add(mesh);
        return mesh;
      };

      addBox(2.18, 0.075, 0.48, carbon, 0, 0.49, 2.02);
      [-1, 1].forEach((side) => {
        addBox(0.11, 0.13, 2.35, carbon, side * 1.0, 0.55, 0.02);
        addBox(0.13, 0.035, 1.52, accent, side * 0.25, 1.12, 0.94);
        addBox(0.065, 0.16, 0.08, carbon, side * 0.68, 1.48, -1.56);
        addBox(0.035, 0.055, 2.25, accent, side * 1.012, 1.0, -0.18);
      });
      addBox(2.16, 0.12, 0.32, accent, 0, 1.66, -1.62);
      addBox(0.34, 0.035, 0.4, carbon, 0, 1.13, 1.18);

      const numberCanvas = document.createElement('canvas');
      numberCanvas.width = 256;
      numberCanvas.height = 192;
      const numberContext = numberCanvas.getContext('2d');
      numberContext.fillStyle = '#f5f5f1';
      numberContext.fillRect(8, 8, 240, 176);
      numberContext.strokeStyle = '#' + accentColor.toString(16).padStart(6, '0');
      numberContext.lineWidth = 14;
      numberContext.strokeRect(14, 14, 228, 164);
      numberContext.fillStyle = '#101820';
      numberContext.font = '900 132px Arial';
      numberContext.textAlign = 'center';
      numberContext.textBaseline = 'middle';
      numberContext.fillText(String(index + 1).padStart(2, '0'), 128, 98);
      const numberTexture = new THREE.CanvasTexture(numberCanvas);
      const numberMaterial = new THREE.MeshBasicMaterial({ map: numberTexture, side: THREE.DoubleSide, toneMapped: false });
      [-1, 1].forEach((side) => {
        const numberPanel = new THREE.Mesh(new THREE.PlaneGeometry(0.68, 0.5), numberMaterial);
        numberPanel.position.set(side * 1.035, 0.98, 0.24);
        numberPanel.rotation.y = side * Math.PI / 2;
        group.add(numberPanel);
      });
      group.traverse((part) => {
        if (!part.isMesh) return;
        part.castShadow = !webOptimizer.lowLag;
        part.receiveShadow = !webOptimizer.lowLag;
      });
      car.mesh.add(group);
      car.raceVisuals = group;
      car.raceNumber = index + 1;
      car.raceAccent = accentColor;
    }

    const randomCivilianCarTypes = ['sedan', 'taxi', 'sports', 'hatchback', 'suv', 'pickup', 'van'];
    const randomCivilianCarColors = [0x2563eb, 0xf97316, 0x16a34a, 0xfacc15, 0xdc2626, 0xe5e7eb, 0x111827, 0x0891b2, 0xf472b6];

    function getRandomCivilianCarStyle() {
      return {
        type: randomCivilianCarTypes[Math.floor(Math.random() * randomCivilianCarTypes.length)],
        color: randomCivilianCarColors[Math.floor(Math.random() * randomCivilianCarColors.length)]
      };
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
      car.mesh.position.set(x, 0, z); car.body.position.set(x, 1.2, z); scene.add(car.mesh);
      if (!webOptimizer.lowLag && Math.hypot(x - playerState.position.x, z - playerState.position.z) <= entityVisibilityRadius()) {
        setVehicleVisualMode(car, true);
      }
      cars.push(car); return car;
    }

    function updateCarHeadlights(car, now) {
      if (!car || car.destroyed || !car.headlightMaterial) return;
      const night = nightIntensity > 0.25;
      if (car.isMotorcycle) {
        const damaged = car.health < 100;
        const blinking = damaged || now < car.crashFlashUntil;
        const blinkOn = Math.floor(now / 180) % 2 === 0;
        const movingFastEnough = Math.abs(car.speed) * 2.237 > 10;
        const headlightOn = blinking ? blinkOn : night || movingFastEnough;
        car.headlightMaterial.color.setHex(headlightOn ? 0xfff1c2 : 0x59636e);
        car.headlightMaterial.emissiveIntensity = headlightOn ? (blinking ? 3.2 : 1.8) : 0;
        car.rearLightMaterial.emissiveIntensity = blinking ? (blinkOn ? 2.8 : 0.1) : night ? 1.5 : 0.45;
        return;
      }
      if (car.isPolice && car.policeLights) {
        const flashPhase = Math.floor(now / 180) % 2;
        car.policeLights[0].material.emissiveIntensity = car.sirenActive && flashPhase === 0 ? 3.5 : 0.15;
        car.policeLights[1].material.emissiveIntensity = car.sirenActive && flashPhase === 1 ? 3.5 : 0.15;
      }
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
      const lightsOn = flashing ? Math.floor(now / 180) % 2 === 0 : night || moving;
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
        lifetime: getDebrisLifetime(),
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
        const style = getRandomCivilianCarStyle();
        const car = createCar(x, z, style.color, false, true, style.type);
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
      const style = getRandomCivilianCarStyle();
      const car = createCar(position.x, position.z, style.color, true, false, style.type);
      car.owner = 'player';
      car.mesh.rotation.y = yaw;
      car.body.position.set(position.x, 1.2, position.z);
      car.body.quaternion.setFromEuler(0, yaw, 0);
      car.mesh.position.copy(car.body.position);
      showMessage('Car spawned nearby. Click it to drive.');
    }

    function spawnPlayerMotorcycle() {
      if (!gameStarted || controlledVehicle || controlledAirplane || controlledBoat) return;
      const origin = playerState.position;
      const yaw = playerState.yaw;
      let position = null;
      for (const distance of [5, 7, 9, 12]) {
        const x = origin.x + Math.sin(yaw) * distance;
        const z = origin.z + Math.cos(yaw) * distance;
        const occupied = cars.some((car) => !car.destroyed && Math.hypot(car.body.position.x - x, car.body.position.z - z) < 4.2);
        if (!occupied && !pointIsInsideBuildingRect(x, z, 1.2)) { position = { x, z }; break; }
      }
      if (!position) {
        showMessage('No room to spawn a motorcycle nearby.');
        return;
      }
      const color = [0xd32f2f, 0x1565c0, 0x1f783e, 0x33383e, 0xe6a823][Math.floor(Math.random() * 5)];
      const motorcycle = createCar(position.x, position.z, color, true, false, 'motorcycle');
      motorcycle.owner = 'player';
      motorcycle.mesh.rotation.y = yaw;
      motorcycle.body.position.set(position.x, 1.2, position.z);
      motorcycle.body.quaternion.setFromEuler(0, yaw, 0);
      motorcycle.mesh.position.copy(motorcycle.body.position);
      showMessage('Motorcycle spawned. Click it to ride.');
    }

    function createParkedMotorcycles(count = 25) {
      const routeCandidates = asphaltAreas.filter((area) =>
        Math.min(area.halfWidth, area.halfDepth) >= 7 &&
        Math.min(area.halfWidth, area.halfDepth) <= 11 &&
        Math.max(area.halfWidth, area.halfDepth) >= 70
      );
      const colors = [0xc62828, 0x225ca8, 0x277446, 0x303940, 0xdd9e18, 0x8d3e7b];
      let created = 0;
      for (let attempt = 0; attempt < count * 12 && created < count; attempt++) {
        const area = routeCandidates[Math.floor(Math.random() * routeCandidates.length)];
        if (!area) break;
        const horizontal = area.halfWidth > area.halfDepth;
        const along = (Math.random() * 2 - 1) * Math.max(0, (horizontal ? area.halfWidth : area.halfDepth) - 14);
        const side = Math.random() < 0.5 ? -1 : 1;
        const offset = (horizontal ? area.halfDepth : area.halfWidth) + 2.8;
        const x = horizontal ? area.x + along : area.x + side * offset;
        const z = horizontal ? area.z + side * offset : area.z + along;
        if (pointIsInsideBuildingRect(x, z, 1.4) || cars.some((car) => !car.destroyed && Math.hypot(car.body.position.x - x, car.body.position.z - z) < 4.5)) continue;
        const color = colors[created % colors.length];
        const bike = createCar(x, z, color, false, true, 'motorcycle');
        bike.mesh.rotation.y = horizontal ? (side < 0 ? Math.PI / 2 : -Math.PI / 2) : (side < 0 ? 0 : Math.PI);
        bike.body.position.set(x, 1.2, z);
        bike.body.quaternion.setFromEuler(0, bike.mesh.rotation.y, 0);
        bike.mesh.position.copy(bike.body.position);
        created++;
      }
      return created;
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

    function getCarTrackPoints(car) {
      if (car.isMotorcycle) {
        return [{ x: car.body.position.x, z: car.body.position.z }];
      }
      return getCarWheelPositions(car);
    }

    function addTireTrackMark(car, wheel, now, surface = 'asphalt') {
      if (!car || !wheel) return;
      const markGeometry = surface === 'asphalt' ? tireTrackGeometry : dirtTrackGeometry;
      const markMaterial = surface === 'asphalt' ? tireTrackMaterial : dirtTrackMaterial;
      const mark = new THREE.Mesh(markGeometry, markMaterial);
      mark.position.set(wheel.x, 0.12, wheel.z);
      mark.rotation.y = car.mesh.rotation.y + (surface === 'asphalt' || car.isMotorcycle ? 0 : (Math.random() - 0.5) * 0.65);
      mark.rotation.z = surface === 'asphalt' || car.isMotorcycle ? 0 : (Math.random() - 0.5) * 0.7;
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
          getCarTrackPoints(car).forEach((wheel) => {
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
        getCarTrackPoints(car).forEach((wheel) => {
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
      const smokeColors = [0x343638, 0x4b4e50, 0x686966, 0x817d74];
      const baseOpacity = 0.32 + Math.random() * 0.22;
      const mesh = new THREE.Mesh(
        smokeParticleGeometry,
        new THREE.MeshBasicMaterial({
          color: smokeColors[Math.floor(Math.random() * smokeColors.length)],
          transparent: true,
          opacity: baseOpacity,
          depthWrite: false
        })
      );
      mesh.position.set(x, y, z);
      const scale = 0.65 + Math.random() * 0.7;
      mesh.scale.set(scale, scale * (1.1 + Math.random() * 0.45), scale);
      scene.add(mesh);
      smokeParticles.push({
        mesh,
        velocity: new THREE.Vector3((Math.random() - 0.5) * 1.2, 0.85 + Math.random() * 1.15, (Math.random() - 0.5) * 1.2),
        createdAt: performance.now(),
        lifetime: 1600 + Math.random() * 900,
        baseOpacity
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

    function addFlickeringFlame(group, mesh) {
      if (!group.userData.flames) group.userData.flames = [];
      group.userData.flames.push({
        mesh,
        basePosition: mesh.position.clone(),
        baseScale: mesh.scale.clone(),
        baseRotation: mesh.rotation.clone(),
        phase: Math.random() * Math.PI * 2
      });
      group.add(mesh);
    }

    function createFireEffect(car, x, z, lifetime) {
      const group = new THREE.Group();
      const outer = new THREE.Mesh(fireOuterGeometry, fireMaterial);
      outer.position.y = 1.05;
      const inner = new THREE.Mesh(fireInnerGeometry, innerFireMaterial);
      inner.position.y = 0.72;
      const sideTongue = new THREE.Mesh(fireOuterGeometry, fireMaterial);
      sideTongue.position.set(0.28, 0.56, -0.08);
      sideTongue.scale.setScalar(0.56);
      addFlickeringFlame(group, outer);
      addFlickeringFlame(group, inner);
      addFlickeringFlame(group, sideTongue);
      group.position.set(x, 0, z);
      scene.add(group);
      fireEffects.push({ group, flames: group.userData.flames, car, x, y: 0, z, smokeOffset: 1.8, smokeInterval: 190, createdAt: performance.now(), lifetime, nextSmokeAt: 0, flickerAt: 0 });
      if (car) car.onFire = true;
    }

    function createBuildingFire(box, engulfed, impactX, impactZ) {
      const group = new THREE.Group();
      const addFlame = (x, y, z, size = 1) => {
        const outer = new THREE.Mesh(fireOuterGeometry, fireMaterial);
        outer.position.set(x, y + 1.05 * size, z);
        outer.scale.setScalar(size);
        const inner = new THREE.Mesh(fireInnerGeometry, innerFireMaterial);
        inner.position.set(x, y + 0.72 * size, z);
        inner.scale.setScalar(size);
        addFlickeringFlame(group, outer);
        addFlickeringFlame(group, inner);
      };

      if (engulfed) {
        const alongOffsets = webOptimizer.lowLag ? [-0.28, 0.28] : [-0.38, -0.13, 0.13, 0.38];
        const verticalLevels = webOptimizer.lowLag ? [0.15, 0.7] : [0.12, 0.48, 0.82];
        const halfX = box.sizeX * 0.48;
        const halfZ = box.sizeZ * 0.48;
        for (const offset of alongOffsets) {
          for (const level of verticalLevels) {
            const y = Math.max(0.5, Math.min(box.height - 0.5, box.height * level));
            addFlame(offset * box.sizeX, y, halfZ, 1.05);
            addFlame(offset * box.sizeX, y, -halfZ, 1.05);
            addFlame(halfX, y, offset * box.sizeZ, 1.05);
            addFlame(-halfX, y, offset * box.sizeZ, 1.05);
          }
        }
      } else {
        const offsetX = impactX - box.x;
        const offsetZ = impactZ - box.z;
        if (Math.abs(offsetX / box.sizeX) > Math.abs(offsetZ / box.sizeZ)) {
          const sideX = Math.sign(offsetX || 1) * box.sizeX * 0.5;
          addFlame(sideX, 0.1, -0.45, 1.15);
          addFlame(sideX, 0.1, 0.45, 1.15);
        } else {
          const sideZ = Math.sign(offsetZ || 1) * box.sizeZ * 0.5;
          addFlame(-0.45, 0.1, sideZ, 1.15);
          addFlame(0.45, 0.1, sideZ, 1.15);
        }
      }

      group.position.set(box.x, 0, box.z);
      scene.add(group);
      fireEffects.push({
        group,
        flames: group.userData.flames,
        car: null,
        x: box.x,
        y: 0,
        z: box.z,
        smokeOffset: Math.min(box.height, 8),
        smokeInterval: engulfed ? 320 : 520,
        createdAt: performance.now(),
        lifetime: engulfed ? 30000 : 18000,
        nextSmokeAt: 0,
        flickerAt: 0
      });
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
        particle.mesh.material.opacity = particle.baseOpacity * (1 - age / particle.lifetime);
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
        fire.group.position.set(fire.x, fire.y || 0, fire.z);
        if (now >= fire.flickerAt) {
          fire.flickerAt = now + 45;
          fire.group.rotation.y = Math.sin(now * 0.002) * 0.045;
          (fire.flames || []).forEach((flame) => {
            const wave = now * 0.012 + flame.phase;
            const widthPulse = 0.88 + Math.sin(wave) * 0.14;
            const heightPulse = 0.84 + (Math.sin(wave * 1.43) + 1) * 0.16;
            flame.mesh.scale.set(
              flame.baseScale.x * widthPulse,
              flame.baseScale.y * heightPulse,
              flame.baseScale.z * widthPulse
            );
            flame.mesh.position.set(
              flame.basePosition.x + Math.sin(wave * 0.73) * 0.055,
              flame.basePosition.y + Math.max(0, Math.sin(wave * 1.61)) * 0.09,
              flame.basePosition.z + Math.cos(wave) * 0.035
            );
            flame.mesh.rotation.set(
              flame.baseRotation.x,
              flame.baseRotation.y,
              flame.baseRotation.z + Math.sin(wave) * 0.075
            );
          });
        }
        if (now >= fire.nextSmokeAt) {
          fire.nextSmokeAt = now + (fire.smokeInterval || 190);
          addSmokeParticle(fire.x, (fire.y || 0) + (fire.smokeOffset || 1.8), fire.z);
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

    function tipMotorcycleOver(car) {
      if (!car || !car.isMotorcycle || car.destroyed || car.fallenOver) return;
      const yaw = getQuaternionYaw(car.body.quaternion);
      car.fallenOver = true;
      car.fallenYaw = yaw;
      car.speed = 0;
      car.steer = 0;
      car.airborne = false;
      car.parked = false;
      car.body.type = CANNON.Body.STATIC;
      car.body.mass = 0;
      car.body.updateMassProperties();
      car.body.position.y = 0.58;
      car.body.velocity.set(0, 0, 0);
      car.body.angularVelocity.set(0, 0, 0);
      car.body.quaternion.setFromEuler(0, yaw, Math.PI / 2);
      car.mesh.position.set(car.body.position.x, car.body.position.y, car.body.position.z);
      car.mesh.rotation.set(0, yaw, Math.PI / 2);
      if (car.npc) {
        const npcIndex = npcCars.indexOf(car);
        if (npcIndex >= 0) npcCars.splice(npcIndex, 1);
        car.npc = false;
        car.route = null;
      }
      if (controlledVehicle === car) {
        const side = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
        controlledVehicle = null;
        car.inside = false;
        playerState.position.set(
          car.body.position.x + side.x * 1.8,
          groundHeightAt(car.body.position.x + side.x * 1.8, car.body.position.z + side.z * 1.8) + 1.7,
          car.body.position.z + side.z * 1.8
        );
        playerState.velocity.set(0, 0, 0);
        playerState.yaw = yaw;
        playerState.onGround = true;
        clearVehicleKeys();
        syncActiveMode();
        showMessage('You were knocked off your motorcycle.');
      }
    }

    function resetMotorcycleUpright(car) {
      if (!car || !car.isMotorcycle || !car.fallenOver || car.destroyed) return;
      const yaw = car.fallenYaw ?? getQuaternionYaw(car.body.quaternion);
      car.fallenOver = false;
      car.fallenYaw = null;
      car.body.type = CANNON.Body.DYNAMIC;
      car.body.mass = car.profile.mass;
      car.body.updateMassProperties();
      car.body.position.y = 1.2;
      car.body.velocity.set(0, 0, 0);
      car.body.angularVelocity.set(0, 0, 0);
      car.body.quaternion.setFromEuler(0, yaw, 0);
      car.body.wakeUp();
      car.mesh.position.copy(car.body.position);
      car.mesh.rotation.set(0, yaw, 0);
    }

    function handleVehicleCrash(car, now, impactSpeed = Math.abs(car.speed), suppressSecondaryDamage = false) {
      if (!car || car.destroyed || impactSpeed < 4) return;
      if (car.isMotorcycle) tipMotorcycleOver(car);
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
      scheduleJobVehicleRespawn(car);
      car.destroyed = true;
      world.removeBody(car.body);
      if (gameSettings.destruction) {
        car.mesh.updateMatrixWorld(true);
        car.mesh.traverse((part) => {
          if (!part.isMesh) return;
          if (vehicleDebris.length >= (webOptimizer.lowLag ? 80 : Infinity)) scene.remove(vehicleDebris.shift().mesh);
          const debris = new THREE.Mesh(part.geometry, part.material);
          part.getWorldPosition(debris.position);
          part.getWorldQuaternion(debris.quaternion);
          debris.scale.copy(part.getWorldScale(new THREE.Vector3()));
          scene.add(debris);
          vehicleDebris.push({
            mesh: debris,
            velocity: new THREE.Vector3((Math.random() - 0.5) * 7, 2 + Math.random() * 5, (Math.random() - 0.5) * 7),
            createdAt: performance.now(),
            lifetime: getDebrisLifetime()
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

    function scheduleJobVehicleRespawn(car) {
      if (!car || !car.jobRole || car.jobRespawnScheduled) return;
      car.jobRespawnScheduled = true;
      jobVehicleRespawns.push({
        sourceCar: car,
        role: car.jobRole,
        readyAt: performance.now() + 1400,
        replacement: null,
        hadRaceDriver: !!car.driver
      });
      if (car.isRaceCar && raceTrack && raceTrack.stolenCar === car) {
        raceTrack.phase = 'racing';
        raceTrack.stolenCar = null;
        raceTrack.recoveryCar = null;
        raceTrack.recoveryAgent = null;
        raceTrack.canTrigger = false;
      }
    }

    function moveJobVehicleToTarget(car, target, dt, speed = 22) {
      const direction = new THREE.Vector3(target.x - car.body.position.x, 0, target.z - car.body.position.z);
      const distance = direction.length();
      if (distance <= 4) {
        car.body.velocity.set(0, 0, 0);
        car.speed = 0;
        return true;
      }
      direction.normalize();
      const step = Math.min(distance - 4, speed * dt);
      car.body.position.x += direction.x * step;
      car.body.position.z += direction.z * step;
      car.body.position.y = 1.2;
      car.mesh.position.copy(car.body.position);
      car.mesh.rotation.y = Math.atan2(direction.x, direction.z);
      car.body.quaternion.setFromEuler(0, car.mesh.rotation.y, 0);
      car.body.velocity.set(0, 0, 0);
      car.speed = speed;
      return false;
    }

    function createJobVehicleReplacement(entry) {
      const sourceCar = entry.sourceCar;
      let type = sourceCar.type;
      let color = sourceCar.color;
      if (entry.role === 'race-car') color = sourceCar.jobColor;
      if (entry.role === 'police') { type = 'suv'; color = 0x142b42; }
      if (entry.role === 'ambulance') { type = 'ambulance'; color = 0xf8fafc; }
      if (entry.role === 'debris-plow') { type = 'plow'; color = 0xe6a719; }
      const garageBay = nextJobVehicleGarageBay++ % 8;
      const garageX = JOB_VEHICLE_GARAGE.x + (garageBay % 4 - 1.5) * 3.5;
      const garageZ = JOB_VEHICLE_GARAGE.z + Math.floor(garageBay / 4) * 4.5;
      const car = createCar(garageX, garageZ, color, false, false, type);
      car.jobRole = entry.role;
      car.jobPhase = 'dispatching';
      car.jobRespawnScheduled = false;

      if (entry.role === 'race-car') {
        car.isRaceCar = true;
        car.jobIndex = sourceCar.jobIndex;
        car.jobColor = sourceCar.jobColor;
        sourceCar.jobReplacement = car;
        car.raceAngle = sourceCar.raceGridAngle;
        car.raceGridAngle = sourceCar.raceGridAngle;
        car.raceLaneRadius = sourceCar.raceLaneRadius;
        car.raceDirection = sourceCar.raceDirection;
        car.raceSpeedMph = sourceCar.raceSpeedMph;
        addRaceCarVisuals(car, car.jobIndex);
        if (sourceCar.driver) {
          seatRaceDriverInCar(car, sourceCar.driver);
        } else if (entry.hadRaceDriver || !raceTrack || raceTrack.phase !== 'confrontation') {
          car.driver = createSeatedDriver(car.mesh, 0, -0.08, 0.12, 0.58);
          applyRacingUniform(car.driver, car.jobIndex);
        }
        world.removeBody(car.body);
      } else if (entry.role === 'police') {
        configurePoliceCar(car);
        const unit = sourceCar.policeUnit;
        car.policeUnit = unit;
        if (unit) {
          const previousCarIndex = npcCars.indexOf(sourceCar);
          if (previousCarIndex >= 0) npcCars.splice(previousCarIndex, 1);
          unit.car = car;
          unit.resumePhase = unit.resumePhase || unit.phase;
          unit.phase = 'respawning';
          unit.path = [];
          npcCars.push(car);
        }
      } else if (entry.role === 'ambulance') {
        attachAmbulanceLights(car);
        car.isAmbulance = true;
        car.medicalLights = true;
        car.owner = 'medical';
        car.body.mass = 220;
        car.body.updateMassProperties();
        medicalRescueState.ambulance = car;
        medicalRescueState.dispatching = true;
        medicalRescueState.patientLoaded = false;
        medicalRescueState.awaitingAmbulance = false;
      } else if (entry.role === 'debris-plow') {
        car.isPlow = true;
        car.jobHome = sourceCar.jobHome || { x: 535, z: 540 };
        debrisPlowVehicle = car;
      }
      entry.replacement = car;
      return car;
    }

    function updateJobVehicleRespawns(dt, now) {
      updateJobAircraftRespawns(now);
      for (let index = jobVehicleRespawns.length - 1; index >= 0; index--) {
        const entry = jobVehicleRespawns[index];
        if (now < entry.readyAt) continue;
        if (entry.replacement && entry.replacement.destroyed) {
          jobVehicleRespawns.splice(index, 1);
          continue;
        }
        const car = entry.replacement || createJobVehicleReplacement(entry);
        if (entry.role === 'police') {
          jobVehicleRespawns.splice(index, 1);
          continue;
        }

        let target;
        if (entry.role === 'race-car') {
          target = {
            x: raceTrack.center.x + Math.cos(car.raceGridAngle) * car.raceLaneRadius,
            z: raceTrack.center.z + Math.sin(car.raceGridAngle) * car.raceLaneRadius
          };
        } else if (entry.role === 'ambulance') {
          target = medicalRescueState.patientPosition || playerState.position;
        } else {
          target = car.jobHome;
        }

        if (!moveJobVehicleToTarget(car, target, dt, entry.role === 'race-car' ? 32 : 22)) continue;

        if (entry.role === 'race-car') {
          const angle = car.raceGridAngle;
          car.body.position.set(target.x, 1.2, target.z);
          car.mesh.position.copy(car.body.position);
          car.mesh.rotation.y = Math.atan2(-Math.sin(angle), Math.cos(angle));
          car.body.quaternion.setFromEuler(0, car.mesh.rotation.y, 0);
          car.raceAngle = angle;
          car.speed = Math.min(car.raceSpeedMph, raceTrack.maxSpeedMph) / 2.237;
          car.jobPhase = 'racing';
          raceCars[car.jobIndex] = car;
          raceTrack.angryDrivers.forEach((driver) => {
            if (driver.raceCar === entry.sourceCar) driver.raceCar = car;
          });
        } else if (entry.role === 'ambulance') {
          car.jobPhase = 'responding';
          car.body.position.set(target.x, 1.2, target.z);
          car.mesh.position.copy(car.body.position);
          medicalRescueState.dispatching = false;
        } else if (entry.role === 'debris-plow') {
          car.jobPhase = 'ready';
          car.parked = true;
          car.body.type = CANNON.Body.STATIC;
          car.body.mass = 0;
          car.body.updateMassProperties();
        }
        jobVehicleRespawns.splice(index, 1);
      }
    }

    function updateVehicleDebris(dt) {
      const now = performance.now();
      for (let index = vehicleDebris.length - 1; index >= 0; index--) {
        const piece = vehicleDebris[index];
        if (webOptimizer.lowLag && now - piece.createdAt >= 10000) {
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
        if (piece.landed) continue;
        piece.velocity.y -= 9.8 * dt;
        piece.mesh.position.addScaledVector(piece.velocity, dt);
        piece.mesh.rotation.x += 2.4 * dt;
        piece.mesh.rotation.z += 1.8 * dt;
        const floorY = groundHeightAt(piece.mesh.position.x, piece.mesh.position.z) + 0.04;
        if (piece.mesh.position.y <= floorY) {
          piece.mesh.position.y = floorY;
          piece.velocity.set(0, 0, 0);
          if (piece.isLicensePlate) {
            piece.mesh.rotation.set(-Math.PI / 2, piece.mesh.rotation.y, 0);
          }
          piece.landed = true;
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
      const maxDebrisPieces = webOptimizer.lowLag ? 80 : Infinity;
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
        debrisPieces.push({ mesh, body, width, depth, cleared: false, createdAt: now, lifetime: getDebrisLifetime(), kind });
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
      const maxDebrisPieces = webOptimizer.lowLag ? 80 : Infinity;
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
        debrisPieces.push({ mesh, body, width, depth, cleared: false, createdAt: debrisStarted, lifetime: getDebrisLifetime(), kind: 'building' });
      }
    }

    function updateBuildingDebris() {
      const now = performance.now();
      for (let index = debrisPieces.length - 1; index >= 0; index--) {
        const piece = debrisPieces[index];
        if (piece.body.position.y < -60 || (webOptimizer.lowLag && now - piece.createdAt >= 10000)) {
          removeDebrisPiece(piece);
          debrisPieces.splice(index, 1);
          continue;
        }
        if (piece.physicsRemoved) continue;
        const speedSquared = piece.body.velocity.lengthSquared();
        const spinSquared = piece.body.angularVelocity.lengthSquared();
        if (speedSquared < 0.09 && spinSquared < 0.09) {
          piece.restingSince = piece.restingSince || now;
          if (!webOptimizer.lowLag && now - piece.restingSince >= 900) {
            world.removeBody(piece.body);
            piece.physicsRemoved = true;
          }
        } else {
          piece.restingSince = 0;
        }
        piece.mesh.position.set(piece.body.position.x, piece.body.position.y, piece.body.position.z);
        piece.mesh.quaternion.set(piece.body.quaternion.x, piece.body.quaternion.y, piece.body.quaternion.z, piece.body.quaternion.w);
      }
    }

    function collapseBuilding(box, tiltDirection, makeRubble = false, impactSpeed = 18) {
      if (!gameSettings.destruction) return;
      if (box.collapsing) return;
      box.collapsing = true;
      if (box.barrier) box.barrier.collapsing = true;
      world.removeBody(box.body);
      createWreckageEvent(box.x, box.z, 'building', true);
      const collapseStart = performance.now();
      const collapse = () => {
        const progress = Math.min((performance.now() - collapseStart) / (makeRubble ? 2600 : 2200), 1);
        const easedProgress = progress * progress * (3 - 2 * progress);
        box.mesh.rotation.z = easedProgress * Math.sign(tiltDirection || 1) * Math.PI * 0.49;
        box.mesh.updateMatrixWorld(true);
        const worldBounds = new THREE.Box3().setFromObject(box.mesh);
        if (worldBounds.min.y < 0) box.mesh.position.y -= worldBounds.min.y;
        if (progress < 1) {
          requestAnimationFrame(collapse);
        } else {
          box.fallen = true;
          box.fallenAt = performance.now();
        }
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
      recess.userData.lowLagOnly = true;
      recess.visible = webOptimizer.lowLag;
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

    function resolveCarBuildingImpact(box, impactX, impactZ, impactSpeed) {
      if (!box || box.collapsing || impactSpeed <= 5) return;
      const outcome = Math.random();
      if (outcome < 0.1) {
        if (gameSettings.destruction) {
          const tiltDirection = impactX < box.x ? -1 : 1;
          collapseBuilding(box, tiltDirection, true, impactSpeed);
        }
        return;
      }
      if (outcome < 0.4) {
        createBuildingFire(box, true, impactX, impactZ);
        return;
      }
      if (outcome < 0.8) {
        createBuildingFire(box, false, impactX, impactZ);
        return;
      }
      if (gameSettings.destruction && impactSpeed > BUILDING_CAVE_IN_MIN_SPEED) {
        createBuildingCaveIn(box, impactX, impactZ, impactSpeed);
      }
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
      const material = barrier.kind === 'park-fence' ? parkFenceMaterial : barrier.material || barrier.mesh.material;
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
        if (vehicleDebris.length >= (webOptimizer.lowLag ? 80 : Infinity)) scene.remove(vehicleDebris.shift().mesh);
        vehicleDebris.push({
          mesh: piece,
          velocity: new THREE.Vector3((Math.random() - 0.5) * 8, 2 + Math.random() * 4, (Math.random() - 0.5) * 8),
          createdAt: performance.now(),
          lifetime: getDebrisLifetime()
        });
      }
      const message = barrier.kind === 'river-fence' ? 'River fence section smashed open.' : barrier.kind === 'park-fence' ? 'Fence section smashed open.' : 'Airport wall section smashed open.';
      showMessage(message);
      return true;
    }

    function resolveVehicleMove(car, nextX, nextZ) {
      const now = performance.now();
      const hitProp = destructibleProps.find((prop) => !prop.destroyed && !(car.treeCollisionGrace && car.treeCollisionGrace.prop === prop && now < car.treeCollisionGrace.until) && Math.abs(nextX - prop.x) < prop.radius + 1.25 && Math.abs(nextZ - prop.z) < prop.radius + 2.2);
      const hitBuilding = buildingColliders.find((box) => !box.collapsing && isInsideCollisionBounds(box, nextX, nextZ, 1.25, 2.2));
      const hitBarrier = worldBarriers.find((box) => !box.collapsing && isInsideCollisionBounds(box, nextX, nextZ, 1.25, 2.2));
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
      if (hitCar && hitCar.isMotorcycle && impact > 3) tipMotorcycleOver(hitCar);
      if (hitBuilding) resolveCarBuildingImpact(hitBuilding, nextX, nextZ, impact);
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

    let trafficRoadAreasCache = null;

    function getTrafficRoadAreas() {
      if (!trafficRoadAreasCache) {
        trafficRoadAreasCache = asphaltAreas.filter((area) =>
          Math.min(area.halfWidth, area.halfDepth) >= 7 &&
          Math.min(area.halfWidth, area.halfDepth) <= 11 &&
          Math.max(area.halfWidth, area.halfDepth) >= 70
        );
      }
      return trafficRoadAreasCache;
    }

    function createTrafficRoute(area, direction, laneOffset) {
      const horizontal = area.halfWidth > area.halfDepth;
      const roadAxis = horizontal ? area.z : area.x;
      const routeCenter = horizontal ? area.x : area.z;
      const roadHalfWidth = horizontal ? area.halfDepth : area.halfWidth;
      const routeHalfLength = horizontal ? area.halfWidth : area.halfDepth;
      const fixed = roadAxis + (horizontal ? -direction : direction) * Math.min(roadHalfWidth * 0.55, laneOffset);
      return {
        area,
        horizontal,
        roadAxis,
        laneOffset: Math.min(roadHalfWidth * 0.55, laneOffset),
        fixed,
        direction,
        min: routeCenter - routeHalfLength + 16,
        max: routeCenter + routeHalfLength - 16
      };
    }

    function getNextTrafficJunction(route, current) {
      let closest = null;
      getTrafficRoadAreas().forEach((area) => {
        const horizontal = area.halfWidth > area.halfDepth;
        if (horizontal === route.horizontal) return;
        let axis;
        if (route.horizontal) {
          axis = area.x;
          if (route.fixed < area.z - area.halfDepth - 2 || route.fixed > area.z + area.halfDepth + 2) return;
        } else {
          axis = area.z;
          if (route.roadAxis < area.x - area.halfWidth - 2 || route.roadAxis > area.x + area.halfWidth + 2) return;
        }
        const distance = (axis - current) * route.direction;
        if (distance < -1 || axis < route.min || axis > route.max) return;
        if (!closest || distance < closest.distance) closest = { area, axis, distance };
      });
      return closest;
    }

    function createNPCCar(typeOverride = null) {
      const motorcycleColors = [0xc62828, 0x225ca8, 0x277446, 0x303940, 0xdd9e18, 0x8d3e7b];
      const style = typeOverride === 'motorcycle'
        ? { type: 'motorcycle', color: motorcycleColors[Math.floor(Math.random() * motorcycleColors.length)] }
        : getRandomCivilianCarStyle();
      const direction = Math.random() < 0.5 ? -1 : 1;
      const routeCandidates = getTrafficRoadAreas();
      const centralRoutes = routeCandidates.filter((area) => Math.hypot(area.x, area.z) <= 260);
      const routePool = centralRoutes.length && Math.random() < 0.65 ? centralRoutes : routeCandidates;
      const routeArea = routePool[Math.floor(Math.random() * routePool.length)];
      const route = routeArea ? createTrafficRoute(routeArea, direction, 4.2) : {
        area: null, horizontal: true, roadAxis: 0, laneOffset: 4.2, fixed: -direction * 4.2,
        direction, min: -534, max: 534
      };
      const { horizontal, fixed, min, max } = route;
      const routeCenter = routeArea ? (horizontal ? routeArea.x : routeArea.z) : 0;
      const routeHalfLength = routeArea ? (horizontal ? routeArea.halfWidth : routeArea.halfDepth) : 550;
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
      const car = createCar(x, z, style.color, false, false, style.type);
      car.npc = true;
      car.driver = createSeatedDriver(car.mesh, 0, -0.08, 0.12, 0.58);
      if (car.isMotorcycle) {
        poseMotorcycleRider(car.driver);
        addMotorcycleRiderHelmet(car.driver);
      }
      car.route = route;
      car.speed = car.isMotorcycle ? (26 + Math.random() * 8) : 8 + Math.random() * 5;
      car.mesh.rotation.y = horizontal ? direction * Math.PI / 2 : direction < 0 ? Math.PI : 0;
      car.body.position.set(x, 1.2, z);
      car.body.velocity.set(0, 0, 0);
      car.body.quaternion.setFromEuler(0, car.mesh.rotation.y, 0);
      car.mesh.position.copy(car.body.position);
      return car;
    }

    function addMotorcycleRiderHelmet(driver) {
      const helmet = new THREE.Group();
      const shell = new THREE.Mesh(new THREE.SphereGeometry(0.27, 12, 10), new THREE.MeshStandardMaterial({ color: 0x26313a, metalness: 0.34, roughness: 0.3 }));
      shell.position.set(0, 2.02, 0.025);
      const visor = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.11, 0.22), new THREE.MeshStandardMaterial({ color: 0x687a82, metalness: 0.42, roughness: 0.22, transparent: true, opacity: 0.8 }));
      visor.position.set(0, 1.99, 0.2);
      helmet.add(shell, visor);
      driver.mesh.add(helmet);
      driver.helmet = helmet;
    }

    function poseMotorcycleRider(driver) {
      driver.mesh.position.set(0, 0.62, -0.12);
      driver.mesh.rotation.set(0.16, 0, 0);
      driver.mesh.scale.setScalar(0.72);
      driver.leftLeg.rotation.x = -Math.PI / 2;
      driver.rightLeg.rotation.x = -Math.PI / 2;
      driver.leftArm.rotation.x = -1.15;
      driver.rightArm.rotation.x = -1.15;
    }

    function getNearestRoadPosition(x, z) {
      let nearest = null;
      let nearestDistance = Infinity;
      asphaltAreas.forEach((area) => {
        const candidateX = THREE.MathUtils.clamp(x, area.x - area.halfWidth + 3, area.x + area.halfWidth - 3);
        const candidateZ = THREE.MathUtils.clamp(z, area.z - area.halfDepth + 3, area.z + area.halfDepth - 3);
        const distance = Math.hypot(candidateX - x, candidateZ - z);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearest = { x: candidateX, z: candidateZ };
        }
      });
      return nearest || { x, z };
    }

    function configurePoliceCar(car) {
      car.isPolice = true;
      car.jobRole = 'police';
      car.sirenActive = false;
      car.mainBody.material.color.setHex(0x142b42);
      const stripeMaterial = new THREE.MeshStandardMaterial({ color: 0xe5edf2, roughness: 0.68 });
      for (const side of [-1, 1]) {
        const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.24, 1.8), stripeMaterial);
        stripe.position.set(side * 1.24, 0.92, -0.04);
        car.mesh.add(stripe);
        const badge = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.04, 8), new THREE.MeshStandardMaterial({ color: 0xeabf50, metalness: 0.6, roughness: 0.36 }));
        badge.rotation.z = Math.PI / 2;
        badge.position.set(side * 1.29, 0.91, 0.32);
        car.mesh.add(badge);
      }
      const lightBar = new THREE.Group();
      const barBase = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.12, 0.34), vehicleTrimMaterial);
      barBase.position.y = 1.82;
      lightBar.add(barBase);
      const redLight = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 10), new THREE.MeshStandardMaterial({ color: 0xff3030, emissive: 0xff2020, emissiveIntensity: 0.2, roughness: 0.36 }));
      const blueLight = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 10), new THREE.MeshStandardMaterial({ color: 0x2878ff, emissive: 0x1769ff, emissiveIntensity: 0.2, roughness: 0.36 }));
      redLight.position.set(-0.25, 1.86, 0.03);
      blueLight.position.set(0.25, 1.86, 0.03);
      lightBar.add(redLight, blueLight);
      car.mesh.add(lightBar);
      car.policeLights = [redLight, blueLight];
    }

    function createPoliceUnit(x, z) {
      const roadPosition = getNearestRoadPosition(x, z);
      const car = createCar(roadPosition.x, roadPosition.z, 0x142b42, false, false, 'suv');
      configurePoliceCar(car);
      car.body.position.set(roadPosition.x, 1.2, roadPosition.z);
      car.mesh.position.copy(car.body.position);
      car.body.velocity.set(0, 0, 0);
      const unit = { car, target: null, officer: null, phase: 'patrol', path: [], pathIndex: 0, pathTimer: 0, arrestAt: 0, patrolTarget: null };
      car.policeUnit = unit;
      policeUnits.push(unit);
      npcCars.push(car);
      return unit;
    }

    function createPoliceOfficer(unit) {
      const officer = createHuman('A', 'State_Default', true);
      applyPoliceUniform(officer);
      officer.task = 'police-officer';
      officer.state = 'State_Officer';
      officer.useDevice = false;
      officer.deviceGroup.visible = false;
      officer.speed = 5.6;
      officer.active = true;
      officer.mesh.position.set(unit.car.body.position.x - 1.8, 0, unit.car.body.position.z);
      officer.mesh.rotation.y = unit.car.mesh.rotation.y;
      unit.officer = officer;
      return officer;
    }

    function createPrisonGuards(count = 12) {
      const guardPositions = [
        [-27, -22], [-27, 0], [-27, 22], [27, -22], [27, 0], [27, 22],
        [-15.5, -18], [15.5, -18], [-15.5, -8], [15.5, -8], [-8, 24], [8, 24]
      ];
      for (let index = 0; index < count; index++) {
        const officer = createHuman('A', 'State_Default', true);
        applyPoliceUniform(officer);
        officer.task = 'police-officer';
        officer.state = 'State_Officer';
        officer.useDevice = false;
        officer.deviceGroup.visible = false;
        officer.active = true;
        officer.isPrisonGuard = true;
        const [offsetX, offsetZ] = guardPositions[index % guardPositions.length];
        officer.mesh.position.set(prisonFacility.x + offsetX, 0, prisonFacility.z + offsetZ);
        officer.mesh.rotation.y = Math.atan2(-offsetX, -offsetZ);
        officer.speed = 5.6;
        officer.prisonGuardHome = officer.mesh.position.clone();
        officer.prisonResponseTo = null;
        officer.destination.copy(officer.mesh.position);
        prisonOfficers.push(officer);
      }
    }

    function createRaceTrack() {
      const venueSize = 72;
      const placement = worldPlacement.reserveNearest(-268, 368, venueSize, venueSize, 'race-track', 0.2) ||
        worldPlacement.reserve(-268, 368, venueSize, venueSize, 'race-track', 0.2);
      const center = new THREE.Vector3(placement.x, 0, placement.z);
      const innerRadius = 21;
      const outerRadius = 31;
      const wallRadius = 35.5;
      const venue = new THREE.Group();
      venue.position.set(center.x, 0, center.z);

      const asphalt = new THREE.Mesh(new THREE.RingGeometry(innerRadius, outerRadius, 128), new THREE.MeshStandardMaterial({ color: 0x353a3d, roughness: 0.96 }));
      asphalt.rotation.x = -Math.PI / 2;
      asphalt.position.y = 0.045;
      asphalt.receiveShadow = true;
      venue.add(asphalt);
      const innerCurb = new THREE.Mesh(new THREE.RingGeometry(20.4, 21.1, 128), new THREE.MeshStandardMaterial({ color: 0xe8ecee, roughness: 0.72 }));
      innerCurb.rotation.x = -Math.PI / 2;
      innerCurb.position.y = 0.08;
      venue.add(innerCurb);
      const outerCurb = new THREE.Mesh(new THREE.RingGeometry(30.9, 31.6, 128), new THREE.MeshStandardMaterial({ color: 0xd93d38, roughness: 0.72 }));
      outerCurb.rotation.x = -Math.PI / 2;
      outerCurb.position.y = 0.085;
      venue.add(outerCurb);

      const wallMaterial = new THREE.MeshStandardMaterial({ color: 0x40484d, roughness: 0.82, metalness: 0.16 });
      const wallCount = 64;
      const wallHeight = 2.4;
      const wallThickness = 0.7;
      const wallSegmentLength = Math.PI * 2 * wallRadius / wallCount + 0.28;
      const gateAngle = Math.PI / 2;
      const gateHalfAngle = 0.12;
      for (let wallIndex = 0; wallIndex < wallCount; wallIndex++) {
        const angle = wallIndex / wallCount * Math.PI * 2;
        const gateDistance = Math.atan2(Math.sin(angle - gateAngle), Math.cos(angle - gateAngle));
        if (Math.abs(gateDistance) < gateHalfAngle) continue;
        const localWallX = Math.cos(angle) * wallRadius;
        const localWallZ = Math.sin(angle) * wallRadius;
        const wallX = center.x + localWallX;
        const wallZ = center.z + localWallZ;
        const rotationY = angle + Math.PI / 2;
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(wallSegmentLength, wallHeight, wallThickness), wallMaterial);
        mesh.position.set(localWallX, wallHeight / 2, localWallZ);
        mesh.rotation.y = rotationY;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        venue.add(mesh);
        const body = new CANNON.Body({ mass: 0 });
        body.addShape(new CANNON.Box(new CANNON.Vec3(wallSegmentLength / 2, wallHeight / 2, wallThickness / 2)));
        body.position.set(wallX, wallHeight / 2, wallZ);
        body.quaternion.setFromEuler(0, rotationY, 0);
        world.addBody(body);
        const halfX = Math.abs(Math.cos(rotationY)) * wallSegmentLength / 2 + Math.abs(Math.sin(rotationY)) * wallThickness / 2;
        const halfZ = Math.abs(Math.sin(rotationY)) * wallSegmentLength / 2 + Math.abs(Math.cos(rotationY)) * wallThickness / 2;
        worldBarriers.push({
          x: wallX, z: wallZ, width: halfX * 2, depth: halfZ * 2, height: wallHeight, y: wallHeight / 2,
          kind: 'race-track-wall', breakable: false, health: Infinity,
          minX: wallX - halfX, maxX: wallX + halfX, minZ: wallZ - halfZ, maxZ: wallZ + halfZ,
          mesh, body
        });
      }

      const gatePosts = new THREE.MeshStandardMaterial({ color: 0xf1f3f4, roughness: 0.7 });
      [-5, 5].forEach((offset) => {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.8, 3.8, 1.0), gatePosts);
        post.position.set(offset, 1.9, wallRadius);
        venue.add(post);
      });

      const lobby = new THREE.Group();
      const lobbyWall = new THREE.MeshStandardMaterial({ color: 0xd5d0c4, roughness: 0.86 });
      const lobbyRoofMaterial = new THREE.MeshStandardMaterial({ color: 0x37434a, roughness: 0.78 });
      const lobbyBody = new THREE.Mesh(new THREE.BoxGeometry(12, 4.2, 8), lobbyWall);
      lobbyBody.position.set(0, 2.1, 8);
      lobby.add(lobbyBody);
      const lobbyRoof = new THREE.Mesh(new THREE.BoxGeometry(13, 0.6, 9), lobbyRoofMaterial);
      lobbyRoof.position.set(0, 4.5, 8);
      lobby.add(lobbyRoof);
      const frontGlass = new THREE.Mesh(new THREE.BoxGeometry(4.4, 2.6, 0.12), new THREE.MeshStandardMaterial({ color: 0x8ec7d8, metalness: 0.22, roughness: 0.24, transparent: true, opacity: 0.72 }));
      frontGlass.position.set(0, 2.4, 12.05);
      lobby.add(frontGlass);
      const door = new THREE.Mesh(new THREE.BoxGeometry(1.25, 2.5, 0.18), new THREE.MeshStandardMaterial({ color: 0x4d3829, roughness: 0.8 }));
      door.position.set(0, 1.32, 12.12);
      lobby.add(door);
      const lobbySign = new THREE.Mesh(new THREE.BoxGeometry(8.6, 0.85, 0.25), lobbyRoofMaterial);
      lobbySign.position.set(0, 4.2, 12.17);
      lobby.add(lobbySign);
      venue.add(lobby);
      const entryWalk = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.1, 17), new THREE.MeshStandardMaterial({ color: 0x777c7c, roughness: 0.94 }));
      entryWalk.position.set(0, 0.07, 24.2);
      venue.add(entryWalk);
      cityRoot.add(venue);

      const laneRadii = [23, 24.5, 26, 27.5, 29, 30.5];
      const raceColors = [0xc72e34, 0xe9ecef, 0x1573b8, 0xf4c542, 0x28a879, 0xe05f2a];
      raceTrack = {
        center,
        innerRadius,
        outerRadius,
        wallRadius,
        laneRadii,
        phase: 'racing',
        angryDrivers: [],
        confrontationEndsAt: 0,
        canTrigger: true,
        nextYellAt: 0,
        maxSpeedMph: 140
      };
      laneRadii.forEach((laneRadius, index) => {
        const angle = index / laneRadii.length * Math.PI * 2;
        const car = createCar(center.x + Math.cos(angle) * laneRadius, center.z + Math.sin(angle) * laneRadius, raceColors[index], false, false, 'sports');
        car.isRaceCar = true;
        car.jobRole = 'race-car';
        car.jobIndex = index;
        car.jobColor = raceColors[index];
        addRaceCarVisuals(car, index);
        car.raceAngle = angle;
        car.raceGridAngle = angle;
        car.raceLaneRadius = laneRadius;
        car.raceDirection = 1;
        car.raceSpeedMph = 115 + index * 5;
        car.speed = car.raceSpeedMph / 2.237;
        world.removeBody(car.body);
        car.body.position.set(center.x + Math.cos(angle) * laneRadius, 1.2, center.z + Math.sin(angle) * laneRadius);
        car.mesh.position.copy(car.body.position);
        car.mesh.rotation.y = Math.atan2(-Math.sin(angle), Math.cos(angle));
        car.driver = createSeatedDriver(car.mesh, 0, -0.08, 0.12, 0.58);
        applyRacingUniform(car.driver, index);
        raceCars.push(car);
      });
      return raceTrack;
    }

    function startRaceInterference(now, cause = 'track-intrusion') {
      if (!raceTrack || raceTrack.phase !== 'racing') return;
      raceTrack.phase = 'confrontation';
      raceTrack.confrontationCause = cause;
      raceTrack.confrontationEndsAt = now + 15000;
      raceTrack.nextYellAt = now;
      raceTrack.angryDrivers.length = 0;
      raceCars.forEach((car) => {
        if (!car || car.destroyed) return;
        car.speed = 0;
        car.body.velocity.set(0, 0, 0);
        const driver = car.driver;
        if (!driver) return;
        car.driver = null;
        const yaw = car.mesh.rotation.y;
        const forward = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
        const side = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
        scene.attach(driver.mesh);
        const exitPosition = new THREE.Vector3(car.body.position.x, car.body.position.y, car.body.position.z)
          .addScaledVector(forward, 2.2)
          .addScaledVector(side, raceTrack.angryDrivers.length % 2 ? 1.1 : -1.1);
        restoreDriverToPedestrian(driver, exitPosition.x, exitPosition.z, yaw);
        driver.task = 'race-angry';
        driver.raceCar = car;
        driver.raceAngryUntil = raceTrack.confrontationEndsAt;
        driver.nextRacePunchAt = now + 900 + Math.random() * 500;
        driver.raceRunSpeed = 15 / 2.237;
        raceTrack.angryDrivers.push(driver);
      });
      const message = cause === 'npc-hit'
        ? 'A race car hit a pedestrian. The race drivers are furious!'
        : cause === 'player-hit'
          ? 'A race car hit you. The drivers have stopped the race!'
          : cause === 'race-car-entry'
            ? 'You took a race car. The race drivers are coming for you!'
            : 'Race drivers yell: "Get off the track!"';
      showMessage(message);
    }

    function seatRaceDriverInCar(car, driver) {
      const previousCar = car;
      if (car && car.destroyed && car.jobReplacement && !car.jobReplacement.destroyed) car = car.jobReplacement;
      if (!car || !driver) return;
      if (previousCar !== car && previousCar.driver === driver) previousCar.driver = null;
      const personIndex = people.indexOf(driver);
      if (personIndex >= 0) people.splice(personIndex, 1);
      if (driver.mesh.parent) driver.mesh.parent.remove(driver.mesh);
      car.mesh.add(driver.mesh);
      driver.mesh.position.set(0, -0.08, 0.12);
      driver.mesh.rotation.set(0, 0, 0);
      driver.mesh.scale.setScalar(0.58);
      driver.leftLeg.rotation.x = -Math.PI / 2;
      driver.rightLeg.rotation.x = -Math.PI / 2;
      driver.leftArm.rotation.x = -0.65;
      driver.rightArm.rotation.x = -0.65;
      driver.task = 'driver';
      driver.active = false;
      driver.raceCar = null;
      driver.isPunching = false;
      car.driver = driver;
    }

    function startRaceCarTheft(now, stolenCar) {
      if (!raceTrack || !stolenCar || !stolenCar.isRaceCar || raceTrack.phase === 'stolen-chase' || raceTrack.phase.startsWith('recovery-')) return;
      const wasConfrontation = raceTrack.phase === 'confrontation';
      const angryDrivers = wasConfrontation ? raceTrack.angryDrivers.slice() : [];
      raceTrack.angryDrivers.length = 0;

      if (wasConfrontation) {
        angryDrivers.forEach((driver) => {
          const driverCar = driver.raceCar;
          if (driverCar && driverCar.destroyed && driverCar.jobReplacement) driver.raceCar = driverCar.jobReplacement;
          if (driverCar === stolenCar) {
            const personIndex = people.indexOf(driver);
            if (personIndex >= 0) people.splice(personIndex, 1);
            if (driver.mesh.parent) driver.mesh.parent.remove(driver.mesh);
            driver.active = false;
            return;
          }
          seatRaceDriverInCar(driverCar, driver);
        });
      } else if (stolenCar.driver) {
        const formerDriver = stolenCar.driver;
        if (formerDriver.mesh.parent) formerDriver.mesh.parent.remove(formerDriver.mesh);
        formerDriver.active = false;
        stolenCar.driver = null;
      }

      raceTrack.phase = 'stolen-chase';
      raceTrack.stolenCar = stolenCar;
      raceTrack.stolenAt = now;
      raceTrack.recoveryCar = raceCars.find((car) => car && !car.destroyed && car !== stolenCar && car.driver) || null;
      raceTrack.recoveryAgent = null;
      raceTrack.canTrigger = false;
      raceCars.forEach((car) => {
        if (!car || car.destroyed) return;
        car.speed = car === stolenCar ? 0 : Math.min(car.raceSpeedMph, raceTrack.maxSpeedMph) / 2.237;
        car.chasingStolenCar = car !== stolenCar;
      });
      showMessage('You stole a race car! The other racers are chasing you.');
    }

    function moveRaceCarToTarget(car, target, dt, speed) {
      const direction = new THREE.Vector3(target.x - car.body.position.x, 0, target.z - car.body.position.z);
      const distance = direction.length();
      const arrivalRadius = 2.5;
      if (distance <= arrivalRadius) return true;
      direction.normalize();
      const step = Math.min(distance - arrivalRadius, speed * dt);
      car.body.position.x += direction.x * step;
      car.body.position.z += direction.z * step;
      car.mesh.position.set(car.body.position.x, car.body.position.y, car.body.position.z);
      car.mesh.rotation.y = Math.atan2(direction.x, direction.z);
      car.body.quaternion.setFromEuler(0, car.mesh.rotation.y, 0);
      car.speed = speed;
      return false;
    }

    function beginRaceCarRecovery(now) {
      raceTrack.phase = 'recovery-approach';
      raceTrack.recoveryStartedAt = now;
      raceCars.forEach((car) => { car.speed = 0; });
      if (!raceTrack.recoveryCar || raceTrack.recoveryCar.destroyed || !raceTrack.recoveryCar.driver) {
        raceTrack.recoveryCar = raceCars.find((car) => car && !car.destroyed && car !== raceTrack.stolenCar && car.driver) || null;
      }
      if (!raceTrack.recoveryCar) {
        finishRaceCarRecovery();
        return;
      }
      showMessage('A race driver is going to recover the stolen car.');
    }

    function finishRaceCarRecovery() {
      const stolenCar = raceTrack.stolenCar;
      if (!stolenCar || stolenCar.destroyed) return;
      raceCars.forEach((car) => {
        if (!car || car.destroyed) return;
        car.raceAngle = car.raceGridAngle;
        car.body.position.set(
          raceTrack.center.x + Math.cos(car.raceAngle) * car.raceLaneRadius,
          1.2,
          raceTrack.center.z + Math.sin(car.raceAngle) * car.raceLaneRadius
        );
        car.mesh.position.copy(car.body.position);
        car.mesh.rotation.y = Math.atan2(-Math.sin(car.raceAngle), Math.cos(car.raceAngle));
        car.body.quaternion.setFromEuler(0, car.mesh.rotation.y, 0);
        car.speed = Math.min(car.raceSpeedMph, raceTrack.maxSpeedMph) / 2.237;
        car.chasingStolenCar = false;
      });
      raceTrack.phase = 'racing';
      raceTrack.stolenCar = null;
      raceTrack.recoveryCar = null;
      raceTrack.recoveryAgent = null;
      raceTrack.canTrigger = false;
      showMessage('The stolen car is back. The race has reset.');
    }

    function updateRaceCarTheft(dt, now) {
      const stolenCar = raceTrack.stolenCar;
      if (!stolenCar || stolenCar.destroyed) {
        raceTrack.phase = 'racing';
        raceTrack.stolenCar = null;
        raceTrack.recoveryCar = null;
        raceTrack.recoveryAgent = null;
        return;
      }
      if (raceTrack.phase === 'stolen-chase') {
        if (controlledVehicle !== stolenCar) {
          beginRaceCarRecovery(now);
          return;
        }
        const forward = new THREE.Vector3(Math.sin(stolenCar.mesh.rotation.y), 0, Math.cos(stolenCar.mesh.rotation.y));
        const lateral = new THREE.Vector3(forward.z, 0, -forward.x);
        raceCars.forEach((car, index) => {
          if (!car || car.destroyed || car === stolenCar) return;
          const row = Math.floor(index / 2);
          const side = index % 2 === 0 ? -1 : 1;
          const target = new THREE.Vector3(stolenCar.body.position.x, 1.2, stolenCar.body.position.z)
            .addScaledVector(forward, -(6 + row * 6))
            .addScaledVector(lateral, side * 4);
          moveRaceCarToTarget(car, target, dt, raceTrack.maxSpeedMph / 2.237);
        });
        return;
      }

      if (raceTrack.phase === 'recovery-approach') {
        const recoveryCar = raceTrack.recoveryCar;
        if (!recoveryCar) {
          finishRaceCarRecovery();
          return;
        }
        const target = new THREE.Vector3(stolenCar.body.position.x, 1.2, stolenCar.body.position.z);
        if (moveRaceCarToTarget(recoveryCar, target, dt, 18)) {
          const driver = recoveryCar.driver;
          if (!driver) {
            finishRaceCarRecovery();
            return;
          }
          recoveryCar.driver = null;
          const yaw = recoveryCar.mesh.rotation.y;
          const exitPosition = new THREE.Vector3(recoveryCar.body.position.x, 0, recoveryCar.body.position.z)
            .add(new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)).multiplyScalar(2));
          scene.attach(driver.mesh);
          restoreDriverToPedestrian(driver, exitPosition.x, exitPosition.z, yaw);
          driver.task = 'race-recovery';
          driver.speed = 6;
          driver.raceCar = recoveryCar;
          raceTrack.recoveryAgent = driver;
          raceTrack.phase = 'recovery-walk';
        }
        return;
      }

      if (raceTrack.phase === 'recovery-walk') {
        const driver = raceTrack.recoveryAgent;
        if (!driver) {
          finishRaceCarRecovery();
          return;
        }
        const direction = new THREE.Vector3(
          stolenCar.body.position.x - driver.mesh.position.x,
          0,
          stolenCar.body.position.z - driver.mesh.position.z
        );
        const distance = direction.length();
        if (distance <= 2.4) {
          const personIndex = people.indexOf(driver);
          if (personIndex >= 0) people.splice(personIndex, 1);
          if (driver.mesh.parent) driver.mesh.parent.remove(driver.mesh);
          seatRaceDriverInCar(stolenCar, driver);
          raceTrack.phase = 'recovery-drive';
          return;
        }
        direction.normalize();
        const next = driver.mesh.position.clone().addScaledVector(direction, Math.min(distance, driver.speed * dt));
        const resolved = resolveFootstep(next.x, next.z, 0.55);
        if (!resolved.blocked) driver.mesh.position.set(resolved.x, groundHeightAt(resolved.x, resolved.z), resolved.z);
        driver.mesh.rotation.y = Math.atan2(direction.x, direction.z);
        return;
      }

      if (raceTrack.phase === 'recovery-drive') {
        const target = new THREE.Vector3(
          raceTrack.center.x + Math.cos(stolenCar.raceGridAngle) * stolenCar.raceLaneRadius,
          1.2,
          raceTrack.center.z + Math.sin(stolenCar.raceGridAngle) * stolenCar.raceLaneRadius
        );
        if (moveRaceCarToTarget(stolenCar, target, dt, 16)) finishRaceCarRecovery();
      }
    }

    function resetRaceTrack(now) {
      if (controlledVehicle && controlledVehicle.isRaceCar) {
        const stolenCar = controlledVehicle;
        const exitDirection = new THREE.Vector3(
          stolenCar.body.position.x - raceTrack.center.x,
          0,
          stolenCar.body.position.z - raceTrack.center.z
        ).normalize();
        controlledVehicle = null;
        stolenCar.owner = null;
        stolenCar.inside = false;
        clearVehicleKeys();
        setSafePlayerPosition(
          raceTrack.center.x + exitDirection.x * (raceTrack.wallRadius + 5),
          groundHeightAt(raceTrack.center.x + exitDirection.x * (raceTrack.wallRadius + 5), raceTrack.center.z + exitDirection.z * (raceTrack.wallRadius + 5)) + 1.7,
          raceTrack.center.z + exitDirection.z * (raceTrack.wallRadius + 5)
        );
        playerState.velocity.set(0, 0, 0);
        syncActiveMode();
      }
      raceTrack.angryDrivers.forEach((driver) => {
        const car = driver.raceCar;
        seatRaceDriverInCar(car, driver);
      });
      raceTrack.phase = 'racing';
      raceTrack.angryDrivers.length = 0;
      raceTrack.canTrigger = false;
      raceTrack.resetAt = now;
      raceCars.forEach((car) => {
        if (!car || car.destroyed) return;
        car.speed = Math.min(car.raceSpeedMph, raceTrack.maxSpeedMph) / 2.237;
        car.body.position.y = 1.2;
        car.mesh.position.copy(car.body.position);
      });
      showMessage('The race is back on.');
    }

    function updateRaceAngryDriver(person, dt, now) {
      if (!raceTrack || raceTrack.phase !== 'confrontation' || now >= person.raceAngryUntil) return;
      if (person.isPunching && now < person.punchUntil) {
        person.leftArm.rotation.x = -1.6;
        person.rightArm.rotation.x = 1.2;
        person.leftLeg.rotation.x = 0.3;
        person.rightLeg.rotation.x = -0.3;
        return;
      }
      person.isPunching = false;
      const target = controlledVehicle ? controlledVehicle.body.position : playerState.position;
      const direction = new THREE.Vector3(target.x - person.mesh.position.x, 0, target.z - person.mesh.position.z);
      const distance = direction.length();
      if (distance <= 1.65 && now >= person.nextRacePunchAt) {
        person.isPunching = true;
        person.punchUntil = now + 420;
        person.nextRacePunchAt = now + 950;
        if (now >= raceTrack.nextYellAt) {
          showMessage('Race driver yells: "You ruined the race!"');
          raceTrack.nextYellAt = now + 1800;
        }
        playerInputActive = false;
        playerStunUntil = Math.max(playerStunUntil, now + 480);
        return;
      }
      if (distance > 1.15) {
        direction.normalize();
        const step = Math.min(distance - 1.05, Math.min(person.raceRunSpeed, 15 / 2.237) * dt);
        const next = person.mesh.position.clone().addScaledVector(direction, step);
        const resolved = resolveFootstep(next.x, next.z, 0.55);
        if (!resolved.blocked) person.mesh.position.set(resolved.x, groundHeightAt(resolved.x, resolved.z), resolved.z);
      }
      person.mesh.rotation.y = Math.atan2(direction.x, direction.z);
      person.walkPhase += dt * 14;
      const swing = webOptimizer.lowLag ? 0 : Math.sin(person.walkPhase) * 1.1;
      person.leftArm.rotation.x = swing - 0.35;
      person.rightArm.rotation.x = -swing - 0.35;
      person.leftLeg.rotation.x = -swing;
      person.rightLeg.rotation.x = swing;
    }

    function updateRaceTrack(dt, now) {
      if (!raceTrack || raceCars.length !== 6) return;
      const playerPosition = controlledVehicle ? controlledVehicle.body.position : playerState.position;
      const distanceFromCenter = Math.hypot(playerPosition.x - raceTrack.center.x, playerPosition.z - raceTrack.center.z);

      if (raceTrack.phase === 'stolen-chase' || raceTrack.phase.startsWith('recovery-')) {
        updateRaceCarTheft(dt, now);
        return;
      }
      if (raceTrack.phase === 'confrontation') {
        if (now >= raceTrack.confrontationEndsAt) resetRaceTrack(now);
        return;
      }
      if (raceTrack.phase !== 'racing') return;

      if (raceTrack.phase === 'racing') {
        if (!raceTrack.canTrigger && distanceFromCenter > raceTrack.wallRadius + 7) raceTrack.canTrigger = true;
        raceCars.forEach((car) => {
          if (!car || car.destroyed) return;
          car.speed = Math.min(car.raceSpeedMph, raceTrack.maxSpeedMph) / 2.237;
          car.raceAngle = (car.raceAngle + car.raceDirection * car.speed / car.raceLaneRadius * dt + Math.PI * 2) % (Math.PI * 2);
          const x = raceTrack.center.x + Math.cos(car.raceAngle) * car.raceLaneRadius;
          const z = raceTrack.center.z + Math.sin(car.raceAngle) * car.raceLaneRadius;
          const tangentX = -Math.sin(car.raceAngle) * car.raceDirection;
          const tangentZ = Math.cos(car.raceAngle) * car.raceDirection;
          car.body.position.set(x, 1.2, z);
          car.mesh.position.copy(car.body.position);
          car.mesh.rotation.y = Math.atan2(tangentX, tangentZ);
          car.body.quaternion.setFromEuler(0, car.mesh.rotation.y, 0);
        });
        const onTrack = distanceFromCenter >= raceTrack.innerRadius - 1.5 && distanceFromCenter <= raceTrack.outerRadius + 1.5;
        const hitPlayer = raceCars.some((car) => car && !car.destroyed && Math.hypot(playerPosition.x - car.body.position.x, playerPosition.z - car.body.position.z) < 3.5);
        const hitPerson = people.find((person) =>
          person && person.active && !person.isMedic && person.task !== 'race-angry' && !person.ridingBoat &&
          raceCars.some((car) => car && !car.destroyed && Math.hypot(person.mesh.position.x - car.body.position.x, person.mesh.position.z - car.body.position.z) < 2.1)
        );
        if (raceTrack.canTrigger && hitPerson) {
          hitPerson.knockedDown = { getUp: true, until: now + 1800 };
          hitPerson.nextImpactAt = now + 2500;
          hitPerson.mesh.rotation.z = 1.45;
          startRaceInterference(now, 'npc-hit');
        } else if (raceTrack.canTrigger && hitPlayer) {
          playerInputActive = false;
          playerStunUntil = Math.max(playerStunUntil, now + 900);
          startRaceInterference(now, 'player-hit');
        } else if (raceTrack.canTrigger && onTrack) {
          startRaceInterference(now);
        }
        return;
      }

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

    function applyPrisonerUniform(person) {
      if (!person || !person.torso) return;
      const orangeShirt = new THREE.MeshStandardMaterial({ color: 0xf0782e, roughness: 0.86 });
      const orangePants = new THREE.MeshStandardMaterial({ color: 0xd96726, roughness: 0.9 });
      person.torso.material = orangeShirt;
      person.leftArm.children[0].material = orangeShirt;
      person.rightArm.children[0].material = orangeShirt;
      person.leftLeg.children[0].material = orangePants;
      person.rightLeg.children[0].material = orangePants;
      person.isPrisoner = true;
    }

    function applyPoliceUniform(person) {
      if (!person || !person.torso) return;
      const shirt = new THREE.MeshStandardMaterial({ color: 0x1e344c, roughness: 0.82 });
      const pants = new THREE.MeshStandardMaterial({ color: 0x19232d, roughness: 0.9 });
      person.torso.material = shirt;
      person.leftArm.children[0].material = shirt;
      person.rightArm.children[0].material = shirt;
      person.leftLeg.children[0].material = pants;
      person.rightLeg.children[0].material = pants;
      person.isPoliceOfficer = true;
    }

    function applyRoleClothing(person, shirtColor, pantsColor) {
      if (!person || !person.torso) return;
      const shirt = new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.8 });
      const pants = new THREE.MeshStandardMaterial({ color: pantsColor, roughness: 0.86 });
      person.torso.material = shirt;
      person.leftArm.children[0].material = shirt;
      person.rightArm.children[0].material = shirt;
      person.leftLeg.children[0].material = pants;
      person.rightLeg.children[0].material = pants;
    }

    function addRoleCap(person, crownColor, brimColor, bandColor = null) {
      const cap = new THREE.Group();
      const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.21, 0.16, 12), new THREE.MeshStandardMaterial({ color: crownColor, roughness: 0.72 }));
      crown.position.y = 2.08;
      const brim = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.045, 0.2), new THREE.MeshStandardMaterial({ color: brimColor, roughness: 0.76 }));
      brim.position.set(0, 2.03, 0.15);
      cap.add(crown, brim);
      if (bandColor !== null) {
        const band = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.045, 0.19), new THREE.MeshStandardMaterial({ color: bandColor, metalness: 0.35, roughness: 0.48 }));
        band.position.set(0, 2.08, 0.01);
        cap.add(band);
      }
      person.mesh.add(cap);
      person.uniformHeadwear = cap;
    }

    function applyPilotUniform(person) {
      applyRoleClothing(person, 0x244b72, 0xe8ecef);
      addRoleCap(person, 0xf3f4ef, 0x244b72, 0xd4aa45);
      person.isPilot = true;
    }

    function applyBoatUniform(person) {
      applyRoleClothing(person, 0x147b83, 0xe2d7bd);
      addRoleCap(person, 0x183c55, 0x183c55);
      person.isBoatCaptain = true;
    }

    function applyRacingUniform(person, index) {
      const suitColors = [0xc72e34, 0x1573b8, 0xd6a716, 0x23825e, 0x29343d, 0xe05f2a];
      const suitColor = suitColors[index % suitColors.length];
      applyRoleClothing(person, suitColor, 0x23292d);
      const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 10), new THREE.MeshStandardMaterial({ color: suitColor, roughness: 0.38, metalness: 0.12 }));
      helmet.position.set(0, 1.92, 0.015);
      const visor = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.11, 0.12), new THREE.MeshStandardMaterial({ color: 0x27343a, metalness: 0.38, roughness: 0.24 }));
      visor.position.set(0, 1.93, 0.22);
      person.mesh.add(helmet, visor);
      person.isRaceDriver = true;
    }

    function applyBillionaireUniform(person) {
      applyRoleClothing(person, 0x111722, 0x1b2029);
      const tie = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.48, 0.045), new THREE.MeshStandardMaterial({ color: 0xc6a653, metalness: 0.32, roughness: 0.34 }));
      tie.position.set(0, 1.38, 0.29);
      person.mesh.add(tie);
      person.isBillionaire = true;
    }

    function applyBodyguardUniform(person) {
      applyRoleClothing(person, 0x17202a, 0x242a32);
      const glasses = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.075, 0.06), new THREE.MeshStandardMaterial({ color: 0x111820, metalness: 0.18, roughness: 0.26 }));
      glasses.position.set(0, 1.98, 0.19);
      person.mesh.add(glasses);
      person.isBodyguard = true;
    }

    function applyMaidUniform(person) {
      applyRoleClothing(person, 0x20242b, 0x242930);
      const apron = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.62, 0.08), new THREE.MeshStandardMaterial({ color: 0xf1eee4, roughness: 0.88 }));
      apron.position.set(0, 1.15, 0.28);
      person.mesh.add(apron);
      addRoleCap(person, 0xf5f2e9, 0xf5f2e9);
      person.isMaid = true;
      attachBroom(person);
    }

    function applyJanitorUniform(person) {
      applyRoleClothing(person, 0xe86b20, 0xb94c19);
      addRoleCap(person, 0xf2d12e, 0xf2d12e);
      person.isJanitor = true;
      attachBroom(person);
    }

    function attachBroom(person) {
      const broom = new THREE.Group();
      const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, 1.08, 7), new THREE.MeshStandardMaterial({ color: 0x805a35, roughness: 0.84 }));
      handle.position.y = -0.42;
      const bristles = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.2, 0.16), new THREE.MeshStandardMaterial({ color: 0xd4b65e, roughness: 0.9 }));
      bristles.position.y = -0.95;
      broom.add(handle, bristles);
      broom.position.set(0, -0.42, 0.1);
      person.rightArm.add(broom);
      person.broom = broom;
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
      const outfit = { ...generateClothingOutfit(), shirt: 0xd2e53c, pants: 0x344653, role: 'construction-worker' };
      const skin = new THREE.MeshStandardMaterial({ color: outfit.skin, roughness: 0.88 });
      const shirt = new THREE.MeshStandardMaterial({ color: outfit.shirt, roughness: 0.78 });
      const pants = new THREE.MeshStandardMaterial({ color: outfit.pants, roughness: 0.82 });
      const vestMaterial = new THREE.MeshStandardMaterial({ color: 0xf0782e, roughness: 0.7 });
      const reflectiveMaterial = new THREE.MeshStandardMaterial({ color: 0xe8f0dd, metalness: 0.18, roughness: 0.4 });
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
      const vest = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.58, 0.24), vestMaterial);
      vest.position.set(0, 1.2, 0.2);
      const vestStripes = [1.03, 1.36].map((height) => {
        const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.51, 0.065, 0.25), reflectiveMaterial);
        stripe.position.set(0, height, 0.21);
        return stripe;
      });
      const hardHat = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.25, 0.14, 12), new THREE.MeshStandardMaterial({ color: 0xf4cf36, roughness: 0.56 }));
      hardHat.position.set(0, 2.08, 0);
      worker.add(torso, head, leftArm, rightArm, leftLeg, rightLeg, vest, hardHat, ...vestStripes);
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

    function createLuxuryCarDetails(car, accentColor) {
      const trim = new THREE.MeshStandardMaterial({ color: accentColor, metalness: 0.86, roughness: 0.24 });
      const hoodStripe = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.035, 3.4), trim);
      hoodStripe.position.set(0, 1.06, 0.16);
      car.mesh.add(hoodStripe);
      [-1, 1].forEach((side) => {
        const sideTrim = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.08, 2.5), trim);
        sideTrim.position.set(side * 1.06, 0.72, 0.02);
        car.mesh.add(sideTrim);
      });
      car.isBillionaireCar = true;
    }

    function createBillionaireEstate() {
      const placement = worldPlacement.reserveNearest(-490, 490, 88, 80, 'billionaire-estate', 2) ||
        worldPlacement.reserve(-490, 490, 88, 80, 'billionaire-estate', 2);
      const x = placement.x;
      const z = placement.z;
      const property = new THREE.Group();
      property.position.set(x, 0, z);
      const lawn = new THREE.Mesh(new THREE.BoxGeometry(88, 0.1, 80), new THREE.MeshStandardMaterial({ color: 0x526c45, roughness: 0.96 }));
      lawn.position.set(0, 0.05, 0);
      lawn.receiveShadow = true;
      property.add(lawn);
      const stone = new THREE.MeshStandardMaterial({ color: 0xc6c4bc, roughness: 0.78 });
      const interiorWall = new THREE.MeshStandardMaterial({ color: 0xe5dfd2, roughness: 0.82 });
      const marbleFloor = new THREE.MeshStandardMaterial({ color: 0x9eaaa7, roughness: 0.32, metalness: 0.08 });
      const walnut = new THREE.MeshStandardMaterial({ color: 0x493326, roughness: 0.64 });
      const velvet = new THREE.MeshStandardMaterial({ color: 0x24636a, roughness: 0.88 });
      const brass = new THREE.MeshStandardMaterial({ color: 0xb99455, metalness: 0.72, roughness: 0.3 });
      const roofMaterial = new THREE.MeshStandardMaterial({ color: 0x29343d, metalness: 0.28, roughness: 0.54 });
      const glass = new THREE.MeshStandardMaterial({ color: 0x668a98, metalness: 0.26, roughness: 0.2, transparent: true, opacity: 0.82, emissive: 0x18384a, emissiveIntensity: 0.08 });
      buildingWindowMaterials.push({ material: glass, nightLevel: 1.1 });
      const addInteriorBox = (width, height, depth, material, position) => {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
        mesh.position.set(position[0], position[1], position[2]);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        property.add(mesh);
        return mesh;
      };
      addInteriorBox(45.2, 0.36, 29.2, marbleFloor, [0, 0.18, -5]);
      addInteriorBox(0.8, 7, 30, stone, [-22.6, 3.5, -5]);
      addInteriorBox(0.8, 7, 30, stone, [22.6, 3.5, -5]);
      addInteriorBox(46, 7, 0.8, stone, [0, 3.5, -19.6]);
      addInteriorBox(19.8, 7, 0.8, stone, [-13.1, 3.5, 9.6]);
      addInteriorBox(19.8, 7, 0.8, stone, [13.1, 3.5, 9.6]);
      addInteriorBox(34, 0.36, 22, marbleFloor, [0, 7.18, -5]);
      addInteriorBox(0.8, 4.7, 22, interiorWall, [-16.6, 9.55, -5]);
      addInteriorBox(0.8, 4.7, 22, interiorWall, [16.6, 9.55, -5]);
      addInteriorBox(34, 4.7, 0.8, interiorWall, [0, 9.55, -16.1]);
      addInteriorBox(34, 0.5, 0.7, stone, [0, 11.65, 5.8]);
      addInteriorBox(34, 0.45, 0.7, stone, [0, 7.5, 5.8]);
      [-16.2, -5.5, 5.5, 16.2].forEach((postX) => addInteriorBox(0.42, 4.5, 0.6, stone, [postX, 9.55, 5.8]));
      const roof = new THREE.Mesh(new THREE.BoxGeometry(37, 0.8, 25), roofMaterial);
      roof.position.set(0, 12.4, -5);
      property.add(roof);
      const portico = new THREE.Mesh(new THREE.BoxGeometry(20, 0.65, 9), roofMaterial);
      portico.position.set(0, 6.2, 13);
      property.add(portico);
      [-8, -2.7, 2.7, 8].forEach((columnX) => {
        const column = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 5.5, 12), stone);
        column.position.set(columnX, 2.75, 15.8);
        column.castShadow = true;
        property.add(column);
      });
      [-15, -7.5, 7.5, 15].forEach((windowX) => {
        const window = new THREE.Mesh(new THREE.BoxGeometry(3.8, 2.4, 0.18), glass);
        window.position.set(windowX, 4.1, 10.04);
        property.add(window);
      });
      [-11, 0, 11].forEach((windowX) => {
        const window = new THREE.Mesh(new THREE.BoxGeometry(4.2, 2.3, 0.16), glass);
        window.position.set(windowX, 9.4, 6.1);
        property.add(window);
      });
      const rug = new THREE.Mesh(new THREE.BoxGeometry(13, 0.045, 9), new THREE.MeshStandardMaterial({ color: 0x713b38, roughness: 0.96 }));
      rug.position.set(-10, 0.4, 2.1);
      property.add(rug);
      addInteriorBox(6.2, 0.55, 1.5, velvet, [-10, 0.78, 0.7]);
      addInteriorBox(6.2, 1.2, 0.35, velvet, [-10, 1.55, 0.05]);
      [-13.1, -6.9].forEach((armX) => addInteriorBox(0.5, 1, 1.5, velvet, [armX, 1.02, 0.7]));
      addInteriorBox(4.5, 0.22, 2.5, walnut, [-10, 0.82, 4.1]);
      [-11.8, -8.2].forEach((legX) => [-4.7, -3.5].forEach((legZ) => addInteriorBox(0.18, 0.72, 0.18, brass, [legX, 0.38, legZ])));
      addInteriorBox(6.2, 0.24, 3.6, walnut, [11, 1.28, -3.8]);
      [-1, 1].forEach((side) => {
        addInteriorBox(0.22, 1.05, 0.22, brass, [11 + side * 2.7, 0.66, -5.1]);
        [-0.7, 1.2].forEach((offsetZ) => {
          const chairX = 11 + side * 4.1;
          const chairZ = -3.8 + offsetZ;
          addInteriorBox(1.05, 0.18, 1, walnut, [chairX, 0.75, chairZ]);
          addInteriorBox(1.05, 1.1, 0.18, walnut, [chairX, 1.28, chairZ - 0.42]);
        });
      });
      addInteriorBox(9, 0.22, 1.1, walnut, [0, 1.15, -13.6]);
      addInteriorBox(8.6, 0.12, 0.08, brass, [0, 1.32, -13.02]);
      for (let step = 0; step < 10; step++) {
        addInteriorBox(3.4, 0.36, 1.15, walnut, [0, 0.48 + step * 0.62, 7.2 - step * 0.92]);
      }
      const driveway = new THREE.Mesh(new THREE.BoxGeometry(18, 0.12, 29), new THREE.MeshStandardMaterial({ color: 0x4b5052, roughness: 0.92 }));
      driveway.position.set(0, 0.09, 30);
      property.add(driveway);
      const gatePosts = new THREE.MeshStandardMaterial({ color: 0x4c5253, metalness: 0.55, roughness: 0.45 });
      [-12, 12].forEach((postX) => {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.8, 3.4, 0.8), stone);
        post.position.set(postX, 1.7, 42);
        property.add(post);
      });
      const gate = new THREE.Mesh(new THREE.BoxGeometry(22, 1.5, 0.22), gatePosts);
      gate.position.set(0, 1.25, 42);
      property.add(gate);
      cityRoot.add(property);

      const mansionCollider = createBarrier(x, z - 5, 46, 30, 12, 6, 0x111111, false, 'mansion-shell');
      mansionCollider.visible = false;
      const mansionBarrier = worldBarriers[worldBarriers.length - 1];
      const oldMansionBody = mansionBarrier.body;
      world.removeBody(oldMansionBody);
      const mansionBody = new CANNON.Body({ mass: 0, material: oldMansionBody.material });
      mansionBody.position.set(x, 6, z - 5);
      const addMansionCollisionBox = (width, height, depth, offsetX, offsetY, offsetZ) => {
        mansionBody.addShape(
          new CANNON.Box(new CANNON.Vec3(width / 2, height / 2, depth / 2)),
          new CANNON.Vec3(offsetX, offsetY, offsetZ)
        );
      };
      addMansionCollisionBox(0.8, 12, 30, -22.6, 0, 0);
      addMansionCollisionBox(0.8, 12, 30, 22.6, 0, 0);
      addMansionCollisionBox(46, 12, 0.8, 0, 0, -14.6);
      addMansionCollisionBox(19.8, 7, 0.8, -13.1, -2.5, 14.6);
      addMansionCollisionBox(19.8, 7, 0.8, 13.1, -2.5, 14.6);
      world.addBody(mansionBody);
      mansionBarrier.body = mansionBody;
      mansionBarrier.collisionSegments = [
        { minX: x - 23, maxX: x - 22.2, minZ: z - 20, maxZ: z + 10 },
        { minX: x + 22.2, maxX: x + 23, minZ: z - 20, maxZ: z + 10 },
        { minX: x - 23, maxX: x + 23, minZ: z - 20, maxZ: z - 19.2 },
        { minX: x - 23, maxX: x - 3.2, minZ: z + 9.2, maxZ: z + 10 },
        { minX: x + 3.2, maxX: x + 23, minZ: z + 9.2, maxZ: z + 10 }
      ];
      buildingColliders.push({
        x,
        z: z - 5,
        sizeX: 46,
        sizeZ: 30,
        minX: x - 23,
        maxX: x + 23,
        minZ: z - 20,
        maxZ: z + 10,
        height: 13,
        body: mansionBody,
        mesh: property,
        health: 2.4,
        maxHealth: 2.4,
        impactResistance: 92000,
        facadeMaterial: stone,
        collapsing: false,
        barrier: mansionBarrier,
        entranceWidth: 6.4,
        entranceDepth: 2.2,
        wallThickness: 0.8,
        collisionSegments: mansionBarrier.collisionSegments
      });
      billionaireState.mansion = { x, z, width: 88, depth: 80, group: property };
      billionaireState.homePosition = new THREE.Vector3(x, 0, z + 18);
      billionaireState.cityStop = getNearestRoadPosition(0, 28);
      billionaireState.maidRoute = [
        new THREE.Vector3(x - 29, 0, z + 20), new THREE.Vector3(x + 29, 0, z + 20),
        new THREE.Vector3(x + 29, 0, z - 22), new THREE.Vector3(x - 29, 0, z - 22),
        new THREE.Vector3(x, 0, z + 36)
      ];

      const mansion = createHuman('A', 'State_Default', true);
      applyBillionaireUniform(mansion);
      mansion.task = 'billionaire';
      mansion.active = true;
      mansion.speed = 1.1;
      mansion.mesh.position.copy(billionaireState.homePosition);
      mansion.destination.copy(mansion.mesh.position);
      billionaireState.billionaire = mansion;

      const escortOffsets = [[-3, 1], [3, 1], [-3, -3], [3, -3]];
      escortOffsets.forEach(([offsetX, offsetZ], index) => {
        const guard = createHuman('A', 'State_Default', true);
        applyBodyguardUniform(guard);
        guard.task = 'billionaire-escort';
        guard.isBillionaireEscort = true;
        guard.escortIndex = index;
        guard.active = true;
        guard.speed = 7.5;
        guard.mesh.position.set(x + offsetX, 0, z + 16 + offsetZ);
        guard.destination.copy(guard.mesh.position);
        billionaireState.escorts.push(guard);
      });

      const mansionGuardOffsets = [[-36, 31], [36, 31], [-36, -29], [36, -29]];
      mansionGuardOffsets.forEach(([offsetX, offsetZ]) => {
        const guard = createHuman('A', 'State_Default', true);
        applyBodyguardUniform(guard);
        guard.task = 'mansion-guard';
        guard.isMansionGuard = true;
        guard.active = true;
        guard.mesh.position.set(x + offsetX, 0, z + offsetZ);
        guard.destination.copy(guard.mesh.position);
        billionaireState.mansionGuards.push(guard);
      });

      const maid = createHuman('A', 'State_Default', true);
      applyMaidUniform(maid);
      maid.task = 'mansion-maid';
      maid.active = true;
      maid.speed = 1.45;
      maid.cleaningRouteIndex = 0;
      maid.mesh.position.set(x - 29, 0, z + 20);
      maid.destination.copy(maid.mesh.position);
      billionaireState.maid = maid;

      const carSpecs = [
        { color: 0x111820, accent: 0xc6a653, xOffset: -7 },
        { color: 0x144d67, accent: 0xe5e2d8, xOffset: 7 }
      ];
      carSpecs.forEach((spec, index) => {
        const homePosition = { x: x + spec.xOffset, z: z + 29 };
        const car = createCar(homePosition.x, homePosition.z, spec.color, false, true, 'sports');
        createLuxuryCarDetails(car, spec.accent);
        car.owner = 'billionaire';
        car.billionaireCarIndex = index;
        car.mansionHomePosition = { ...homePosition };
        car.mesh.rotation.y = Math.atan2(billionaireState.cityStop.x - homePosition.x, billionaireState.cityStop.z - homePosition.z);
        car.body.position.set(homePosition.x, 1.2, homePosition.z);
        car.body.quaternion.setFromEuler(0, car.mesh.rotation.y, 0);
        car.mesh.position.copy(car.body.position);
        billionaireState.luxuryCars.push(car);
      });
      billionaireState.nextDriveAt = 0;
    }

    function createJanitors(count = 14) {
      for (let index = 0; index < count; index++) {
        const janitor = createHuman('A', 'State_Default', true);
        applyJanitorUniform(janitor);
        janitor.task = 'janitor';
        janitor.active = true;
        janitor.speed = 1.6;
        janitor.cleaningTarget = getNearbyPedestrianDestination(janitor.mesh.position);
        janitor.nextCleanTargetAt = 0;
        janitors.push(janitor);
      }
    }

    function updateCleaningWorker(person, dt, now) {
      const distance = person.destination.distanceTo(person.mesh.position);
      if (!person.destination || distance < 1.3 || now >= (person.nextCleanTargetAt || 0)) {
        if (person.task === 'mansion-maid' && billionaireState.maidRoute.length) {
          person.cleaningRouteIndex = (person.cleaningRouteIndex + 1) % billionaireState.maidRoute.length;
          person.destination = billionaireState.maidRoute[person.cleaningRouteIndex].clone();
        } else {
          person.destination = getNearbyPedestrianDestination(person.mesh.position);
        }
        person.nextCleanTargetAt = now + 7000 + Math.random() * 5000;
      }
      const direction = person.destination.clone().sub(person.mesh.position).setY(0);
      if (direction.length() > 0.01) {
        direction.normalize();
        const next = person.mesh.position.clone().addScaledVector(direction, person.speed * dt);
        const resolved = resolveFootstep(next.x, next.z, 0.55);
        if (!resolved.blocked) person.mesh.position.set(resolved.x, groundHeightAt(resolved.x, resolved.z), resolved.z);
        person.mesh.rotation.y = Math.atan2(direction.x, direction.z);
        person.walkPhase += dt * 8;
      }
      const sweep = webOptimizer.lowLag ? 0 : Math.sin(now * 0.012 + person.walkPhase) * 0.48;
      person.leftArm.rotation.x = -0.5 - sweep * 0.25;
      person.rightArm.rotation.x = -0.85 + sweep;
      person.leftLeg.rotation.x = -sweep * 0.2;
      person.rightLeg.rotation.x = sweep * 0.2;
      if (person.broom) person.broom.rotation.z = sweep * 0.35;
    }

    function seatEstateDriver(car, person, task) {
      const personIndex = people.indexOf(person);
      if (personIndex >= 0) people.splice(personIndex, 1);
      if (person.mesh.parent) person.mesh.parent.remove(person.mesh);
      car.mesh.add(person.mesh);
      person.mesh.position.set(0, -0.08, 0.12);
      person.mesh.rotation.set(0, 0, 0);
      person.mesh.scale.setScalar(0.58);
      person.leftLeg.rotation.x = -Math.PI / 2;
      person.rightLeg.rotation.x = -Math.PI / 2;
      person.leftArm.rotation.x = -0.65;
      person.rightArm.rotation.x = -0.65;
      person.task = task;
      person.active = false;
      car.driver = person;
    }

    function releaseEstatePerson(person, x, z, task) {
      if (person.mesh.parent) scene.attach(person.mesh);
      else scene.add(person.mesh);
      person.mesh.scale.set(1, 1, 1);
      person.mesh.rotation.set(0, 0, 0);
      person.mesh.position.set(x, groundHeightAt(x, z) + 0.03, z);
      person.leftLeg.rotation.x = 0;
      person.rightLeg.rotation.x = 0;
      person.leftArm.rotation.x = 0;
      person.rightArm.rotation.x = 0;
      person.task = task;
      person.active = true;
      person.destination.set(x, 0, z);
      if (!people.includes(person)) people.push(person);
    }

    function setEstateCarParked(car, position) {
      car.body.position.set(position.x, 1.2, position.z);
      car.mesh.position.copy(car.body.position);
      car.speed = 0;
      car.body.velocity.set(0, 0, 0);
      car.body.type = CANNON.Body.STATIC;
      car.body.mass = 0;
      car.body.updateMassProperties();
      car.parked = true;
      car.jobPhase = 'parked';
      car.owner = 'billionaire';
    }

    function moveEstateCar(car, target, dt, remainingSeconds) {
      const direction = new THREE.Vector3(target.x - car.body.position.x, 0, target.z - car.body.position.z);
      const distance = direction.length();
      if (distance <= 2) {
        car.body.position.x = target.x;
        car.body.position.z = target.z;
        car.body.position.y = 1.2;
        car.mesh.position.copy(car.body.position);
        car.speed = 0;
        car.body.velocity.set(0, 0, 0);
        return true;
      }
      direction.normalize();
      const speed = Math.min(34, distance / Math.max(0.1, remainingSeconds));
      const step = Math.min(distance - 2, speed * dt);
      car.body.position.x += direction.x * step;
      car.body.position.z += direction.z * step;
      car.body.position.y = 1.2;
      car.mesh.position.copy(car.body.position);
      car.mesh.rotation.y = Math.atan2(direction.x, direction.z);
      car.body.quaternion.setFromEuler(0, car.mesh.rotation.y, 0);
      car.body.velocity.set(0, 0, 0);
      car.speed = speed;
      return false;
    }

    function startBillionaireDrive(now) {
      const carCount = billionaireState.luxuryCars.length;
      let car = null;
      for (let attempt = 0; attempt < carCount; attempt++) {
        const index = (billionaireState.nextCarIndex + attempt) % carCount;
        const candidate = billionaireState.luxuryCars[index];
        if (candidate && !candidate.destroyed && !candidate.billionaireStolen && controlledVehicle !== candidate) {
          car = candidate;
          billionaireState.nextCarIndex = (index + 1) % carCount;
          break;
        }
      }
      if (!car) {
        billionaireState.nextDriveAt = now + 10000;
        return;
      }
      car.body.type = CANNON.Body.DYNAMIC;
      car.body.mass = 180;
      car.body.updateMassProperties();
      car.parked = false;
      car.owner = 'billionaire';
      car.jobPhase = 'city-drive-outbound';
      seatEstateDriver(car, billionaireState.billionaire, 'billionaire-driver');
      billionaireState.drive = { car, phase: 'outbound', segmentEndsAt: now + 25000 };
      billionaireState.nextDriveAt = now + 30000;
    }

    function startBillionaireCarTheft(car, now) {
      if (!car || !car.isBillionaireCar) return false;
      if (billionaireState.theft && billionaireState.theft.car !== car) {
        showMessage('The bodyguards are already recovering the other car.');
        return false;
      }
      if (billionaireState.theft && billionaireState.theft.car === car && billionaireState.theft.phase === 'returning') {
        const recoveryGuard = billionaireState.theft.recoveryGuard;
        if (recoveryGuard && car.driver === recoveryGuard) {
          car.driver = null;
          releaseEstatePerson(recoveryGuard, car.body.position.x, car.body.position.z + 3, 'billionaire-escort');
        }
      }
      if (billionaireState.drive && billionaireState.drive.car === car) {
        billionaireState.drive = null;
        if (car.driver === billionaireState.billionaire) {
          car.driver = null;
          releaseEstatePerson(billionaireState.billionaire, billionaireState.homePosition.x, billionaireState.homePosition.z, 'billionaire');
        }
      }
      car.billionaireStolen = true;
      billionaireState.theft = { car, phase: 'pursuit', startedAt: now, pursuitStartsAt: now + 5000, recoveryGuard: null };
      showMessage('You have 5 seconds to get away before the bodyguards pursue you!');
      return true;
    }

    function forcePlayerOutOfBillionaireCar(car) {
      if (controlledVehicle !== car) return;
      const yaw = car.mesh.rotation.y;
      const side = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
      controlledVehicle = null;
      car.owner = 'billionaire';
      car.inside = false;
      clearVehicleKeys();
      const x = car.body.position.x + side.x * 3.1;
      const z = car.body.position.z + side.z * 3.1;
      setSafePlayerPosition(x, groundHeightAt(x, z) + 1.7, z);
      playerState.velocity.set(0, 0, 0);
      playerInputActive = true;
      playerStunUntil = 0;
      syncActiveMode();
      showMessage('A bodyguard caught you and pulled you out of the car.');
    }

    function beginBillionaireCarRecovery(theft, now) {
      const car = theft.car;
      if (controlledVehicle === car) forcePlayerOutOfBillionaireCar(car);
      const guard = billionaireState.escorts
        .filter((person) => person.active && person.task === 'billionaire-escort')
        .sort((a, b) => Math.hypot(a.mesh.position.x - car.body.position.x, a.mesh.position.z - car.body.position.z) - Math.hypot(b.mesh.position.x - car.body.position.x, b.mesh.position.z - car.body.position.z))[0] || null;
      theft.phase = 'returning';
      theft.recoveryGuard = guard;
      if (guard) seatEstateDriver(car, guard, 'billionaire-car-driver');
      car.owner = 'billionaire';
      car.body.type = CANNON.Body.DYNAMIC;
      car.body.mass = 180;
      car.body.updateMassProperties();
      car.parked = false;
      car.jobPhase = 'billionaire-car-returning';
      theft.returnStartedAt = now;
      showMessage(guard ? 'A bodyguard is driving the car back to the mansion.' : 'The stolen car is returning to the mansion.');
    }

    function updateBillionaireEscort(guard, target, dt, speed = 7.5) {
      const direction = new THREE.Vector3(target.x - guard.mesh.position.x, 0, target.z - guard.mesh.position.z);
      const distance = direction.length();
      if (distance > 1.25) {
        direction.normalize();
        const next = guard.mesh.position.clone().addScaledVector(direction, Math.min(distance - 0.9, speed * dt));
        const resolved = resolveFootstep(next.x, next.z, 0.55);
        if (!resolved.blocked) guard.mesh.position.set(resolved.x, groundHeightAt(resolved.x, resolved.z), resolved.z);
        else guard.mesh.position.set(next.x, groundHeightAt(next.x, next.z), next.z);
        guard.mesh.rotation.y = Math.atan2(direction.x, direction.z);
        guard.walkPhase += dt * 10;
        const swing = webOptimizer.lowLag ? 0 : Math.sin(guard.walkPhase) * 0.7;
        guard.leftArm.rotation.x = swing - 0.25;
        guard.rightArm.rotation.x = -swing - 0.25;
        guard.leftLeg.rotation.x = -swing;
        guard.rightLeg.rotation.x = swing;
      }
    }

    function updateBillionaireEstate(dt, now) {
      if (!billionaireState.mansion || !gameStarted || !gameSettings.npcs) return;
      if (!billionaireState.nextDriveAt) billionaireState.nextDriveAt = now + 30000;
      const mansion = billionaireState.mansion;
      const home = billionaireState.homePosition;
      const theft = billionaireState.theft;

      if (theft) {
        const car = theft.car;
        if (!car || car.destroyed) {
          billionaireState.theft = null;
          billionaireState.nextDriveAt = now + 30000;
        } else if (theft.phase === 'pursuit') {
          if (controlledVehicle !== car) {
            beginBillionaireCarRecovery(theft, now);
          } else if (now >= theft.pursuitStartsAt) {
            let caught = false;
            billionaireState.escorts.forEach((guard) => {
              const distance = Math.hypot(guard.mesh.position.x - car.body.position.x, guard.mesh.position.z - car.body.position.z);
              if (distance <= 3.5) caught = true;
              updateBillionaireEscort(guard, car.body.position, dt, Math.max(16, Math.abs(car.speed) + 5));
            });
            if (caught) {
              forcePlayerOutOfBillionaireCar(car);
              beginBillionaireCarRecovery(theft, now);
            }
          }
        }
        if (theft.phase === 'returning' && car && !car.destroyed) {
          const arrived = moveEstateCar(car, car.mansionHomePosition, dt, 22);
          if (arrived || now - theft.returnStartedAt > 45_000) {
            setEstateCarParked(car, car.mansionHomePosition);
            if (theft.recoveryGuard && car.driver === theft.recoveryGuard) {
              car.driver = null;
              const guardIndex = billionaireState.escorts.indexOf(theft.recoveryGuard);
              releaseEstatePerson(theft.recoveryGuard, home.x + (guardIndex % 2 ? 3 : -3), home.z - 2, 'billionaire-escort');
            }
            car.billionaireStolen = false;
            billionaireState.theft = null;
            billionaireState.nextDriveAt = now + 30000;
            showMessage('The luxury car is back at the mansion.');
          }
        }
      } else if (billionaireState.drive) {
        const drive = billionaireState.drive;
        const car = drive.car;
        if (!car || car.destroyed || car.billionaireStolen) {
          if (car && car.driver === billionaireState.billionaire) {
            car.driver = null;
            releaseEstatePerson(billionaireState.billionaire, home.x, home.z, 'billionaire');
          }
          billionaireState.drive = null;
        } else {
          const target = drive.phase === 'outbound' ? billionaireState.cityStop : car.mansionHomePosition;
          moveEstateCar(car, target, dt, Math.max(0.1, (drive.segmentEndsAt - now) / 1000));
          car.jobPhase = drive.phase === 'outbound' ? 'city-drive-outbound' : 'city-drive-returning';
          if (now >= drive.segmentEndsAt) {
            if (drive.phase === 'outbound') {
              drive.phase = 'returning';
              drive.segmentEndsAt = now + 25000;
            } else {
              setEstateCarParked(car, car.mansionHomePosition);
              car.driver = null;
              releaseEstatePerson(billionaireState.billionaire, home.x, home.z, 'billionaire');
              billionaireState.drive = null;
              showMessage('The billionaire returned from the city.');
            }
          }
        }
      } else if (now >= billionaireState.nextDriveAt) {
        startBillionaireDrive(now);
      }

      const activeDriveCar = billionaireState.drive && billionaireState.drive.car;
      billionaireState.escorts.forEach((guard, index) => {
        if (!guard.active) return;
        if (billionaireState.theft && billionaireState.theft.phase === 'pursuit') return;
        if (activeDriveCar && !billionaireState.theft) {
          const offsets = [[-2.7, 2.6], [2.7, 2.6], [-2.7, -2.6], [2.7, -2.6]][index];
          const yaw = activeDriveCar.mesh.rotation.y;
          const targetX = activeDriveCar.body.position.x + offsets[0] * Math.cos(yaw) + offsets[1] * Math.sin(yaw);
          const targetZ = activeDriveCar.body.position.z - offsets[0] * Math.sin(yaw) + offsets[1] * Math.cos(yaw);
          guard.mesh.position.set(targetX, groundHeightAt(targetX, targetZ), targetZ);
          guard.mesh.rotation.y = yaw;
        } else if (!billionaireState.theft && billionaireState.billionaire) {
          const offsets = [[-2.4, 1.8], [2.4, 1.8], [-2.4, -2.3], [2.4, -2.3]][index];
          const yaw = billionaireState.billionaire.mesh.rotation.y;
          const targetX = billionaireState.billionaire.mesh.position.x + offsets[0] * Math.cos(yaw) + offsets[1] * Math.sin(yaw);
          const targetZ = billionaireState.billionaire.mesh.position.z - offsets[0] * Math.sin(yaw) + offsets[1] * Math.cos(yaw);
          updateBillionaireEscort(guard, { x: targetX, z: targetZ }, dt);
        } else if (billionaireState.theft && billionaireState.theft.phase === 'returning' && billionaireState.billionaire) {
          updateBillionaireEscort(guard, billionaireState.billionaire.mesh.position, dt);
        }
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
      const candidates = cars.filter((car) => !car.destroyed && car.body && car.mesh && !car.jobRole && !car.isAmbulance);
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
      ambulance.jobRole = 'ambulance';
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
      medicalRescueState.patientPosition = playerState.position.clone();
      medicalRescueState.dispatching = false;
      medicalRescueState.awaitingAmbulance = false;
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
        rescue.awaitingAmbulance = true;
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
        if (closeEnough && !rescue.dispatching) {
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
          medicalRescueState.dispatching = false;
          medicalRescueState.awaitingAmbulance = false;
          medicalRescueState.ambulance = null;
          medicalRescueState.patientPosition = null;
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
        person.task = i === 0 ? 'boat-captain' : 'boat-passenger';
        person.bench = null;
        person.ridingBoat = boat;
        boat.crew.push(person);
        if (i === 0) {
          boat.paddler = person;
          applyBoatUniform(person);
        }
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

    const birdTypes = [
      { name: 'sparrow', body: 0x8b6845, belly: 0xe0cda8, wing: 0x5f4934, beak: 0xd59a48, scale: 0.66 },
      { name: 'cardinal', body: 0xc83d3a, belly: 0xe99380, wing: 0x9f292b, beak: 0xe3ad3d, scale: 0.88 },
      { name: 'blue jay', body: 0x4c83bd, belly: 0xdde8ee, wing: 0x244c78, beak: 0x252b30, scale: 0.86 },
      { name: 'pigeon', body: 0x858d90, belly: 0xb8c0c1, wing: 0x596366, beak: 0x9f8057, scale: 0.94 }
    ];
    const birdFormationOffsets = [
      { x: 0, y: 0, z: 0 },
      { x: -2.8, y: -0.15, z: -3.2 },
      { x: 2.8, y: -0.15, z: -3.2 },
      { x: -5.6, y: -0.35, z: -6.4 },
      { x: 5.6, y: -0.35, z: -6.4 }
    ];
    const birdBodyGeometry = new THREE.SphereGeometry(1, 8, 6);
    const birdWingGeometry = new THREE.BoxGeometry(0.9, 0.08, 0.42);
    const birdBeakGeometry = new THREE.ConeGeometry(0.09, 0.24, 5);
    const birdTailGeometry = new THREE.ConeGeometry(0.14, 0.42, 5);

    function getBirdFormationPosition(flock, slot) {
      const offset = birdFormationOffsets[slot];
      const cosine = Math.cos(flock.heading);
      const sine = Math.sin(flock.heading);
      return new THREE.Vector3(
        flock.leader.position.x + offset.x * cosine + offset.z * sine,
        flock.leader.position.y + offset.y,
        flock.leader.position.z - offset.x * sine + offset.z * cosine
      );
    }

    function createBirdPart(geometry, color, count, typeIndex, partName) {
      const mesh = new THREE.InstancedMesh(
        geometry,
        new THREE.MeshStandardMaterial({ color, roughness: 0.82, flatShading: true }),
        count
      );
      mesh.userData.birdTypeIndex = typeIndex;
      mesh.userData.birdPart = partName;
      mesh.frustumCulled = false;
      mesh.castShadow = !webOptimizer.lowLag;
      mesh.receiveShadow = false;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      scene.add(mesh);
      return mesh;
    }

    function setBirdInstance(mesh, instanceIndex, bird, offsetX, offsetY, offsetZ, scaleX, scaleY, scaleZ, rotationX = 0, rotationZ = 0) {
      const cosine = Math.cos(bird.heading);
      const sine = Math.sin(bird.heading);
      birdTransform.position.set(
        bird.position.x + offsetX * cosine + offsetZ * sine,
        bird.position.y + offsetY,
        bird.position.z - offsetX * sine + offsetZ * cosine
      );
      birdTransform.rotation.order = 'YXZ';
      birdTransform.rotation.set(rotationX, bird.heading, rotationZ);
      birdTransform.scale.set(scaleX, scaleY, scaleZ);
      birdTransform.updateMatrix();
      mesh.setMatrixAt(instanceIndex, birdTransform.matrix);
    }

    function createBirdPopulation(count = 150) {
      if (birds.length) return;
      const flockCount = Math.ceil(count / birdFormationOffsets.length);
      for (let flockIndex = 0; flockIndex < flockCount; flockIndex++) {
        const closeToPlayer = flockIndex < 6;
        const centerX = closeToPlayer ? (Math.random() - 0.5) * 180 : THREE.MathUtils.randFloat(worldBounds.minX + 30, worldBounds.maxX - 30);
        const centerZ = closeToPlayer ? 20 + (Math.random() - 0.5) * 180 : THREE.MathUtils.randFloat(worldBounds.minZ + 30, worldBounds.maxZ - 30);
        const heading = Math.random() * Math.PI * 2;
        const leaderPosition = new THREE.Vector3(
          centerX,
          closeToPlayer ? 4.5 + Math.random() * 4 : 14 + Math.random() * 22,
          centerZ
        );
        const flock = {
          leader: null,
          heading,
          speed: 4 + Math.random() * 2.8,
          destination: new THREE.Vector3(
            THREE.MathUtils.clamp(centerX + (Math.random() - 0.5) * 140, worldBounds.minX + 18, worldBounds.maxX - 18),
            10 + Math.random() * 26,
            THREE.MathUtils.clamp(centerZ + (Math.random() - 0.5) * 140, worldBounds.minZ + 18, worldBounds.maxZ - 18)
          ),
          birds: []
        };
        birdFlocks.push(flock);
        for (let slot = 0; slot < birdFormationOffsets.length && birds.length < count; slot++) {
          const typeIndex = birds.length % birdTypes.length;
          const bird = {
            typeIndex,
            flock,
            formationSlot: slot,
            position: new THREE.Vector3(),
            destination: flock.destination,
            velocity: new THREE.Vector3(),
            heading,
            speed: flock.speed,
            wingPhase: Math.random() * Math.PI * 2,
            state: 'flying',
            knockedUntil: 0,
            recoverAt: 0
          };
          if (slot === 0) {
            bird.position.copy(leaderPosition);
            flock.leader = bird;
          } else {
            bird.position.copy(getBirdFormationPosition(flock, slot));
          }
          flock.birds.push(bird);
          birds.push(bird);
          birdsByType[typeIndex].push(bird);
        }
      }

      birdTypes.forEach((type, typeIndex) => {
        const typedBirds = birdsByType[typeIndex];
        const renderSet = {
          body: createBirdPart(birdBodyGeometry, type.body, typedBirds.length, typeIndex, 'body'),
          belly: createBirdPart(birdBodyGeometry, type.belly, typedBirds.length, typeIndex, 'belly'),
          head: createBirdPart(birdBodyGeometry, type.body, typedBirds.length, typeIndex, 'head'),
          beak: createBirdPart(birdBeakGeometry, type.beak, typedBirds.length, typeIndex, 'beak'),
          tail: createBirdPart(birdTailGeometry, type.wing, typedBirds.length, typeIndex, 'tail'),
          leftWing: createBirdPart(birdWingGeometry, type.wing, typedBirds.length, typeIndex, 'leftWing'),
          rightWing: createBirdPart(birdWingGeometry, type.wing, typedBirds.length, typeIndex, 'rightWing')
        };
        birdRenderers.push(renderSet);
      });
      updateBirdRenderers();
    }

    function updateBirdRenderers() {
      birdTypes.forEach((type, typeIndex) => {
        const typedBirds = birdsByType[typeIndex];
        const renderSet = birdRenderers[typeIndex];
        if (!renderSet) return;
        typedBirds.forEach((bird, instanceIndex) => {
          const size = type.scale;
          const wingFlap = bird.state === 'flying' ? Math.sin(bird.wingPhase) * 0.62 : bird.state === 'takeoff' ? Math.sin(bird.wingPhase) * 0.85 : 0;
          const bodyPitch = bird.state === 'grounded' ? Math.PI / 2 : 0;
          setBirdInstance(renderSet.body, instanceIndex, bird, 0, 0, 0, 0.34 * size, 0.3 * size, 0.52 * size, bodyPitch);
          setBirdInstance(renderSet.belly, instanceIndex, bird, 0, -0.12 * size, 0.04 * size, 0.24 * size, 0.16 * size, 0.35 * size, bodyPitch);
          setBirdInstance(renderSet.head, instanceIndex, bird, 0, 0.15 * size, 0.31 * size, 0.2 * size, 0.19 * size, 0.2 * size, bodyPitch);
          setBirdInstance(renderSet.beak, instanceIndex, bird, 0, 0.12 * size, 0.49 * size, 0.08 * size, 0.1 * size, 0.1 * size, Math.PI / 2 + bodyPitch);
          setBirdInstance(renderSet.tail, instanceIndex, bird, 0, -0.03 * size, -0.43 * size, 0.72 * size, 0.62 * size, 0.56 * size, -Math.PI / 2 + bodyPitch);
          setBirdInstance(renderSet.leftWing, instanceIndex, bird, -0.28 * size, 0.03 * size, -0.02 * size, size, size, size, bodyPitch, -wingFlap);
          setBirdInstance(renderSet.rightWing, instanceIndex, bird, 0.28 * size, 0.03 * size, -0.02 * size, size, size, size, bodyPitch, wingFlap);
        });
        Object.values(renderSet).forEach((mesh) => { mesh.instanceMatrix.needsUpdate = true; });
      });
    }

    function updateBirdFlocks(dt) {
      birdFlocks.forEach((flock) => {
        const flyingBirds = flock.birds.filter((bird) => bird.state === 'flying');
        if (!flyingBirds.length) return;
        if (!flyingBirds.includes(flock.leader)) flock.leader = flyingBirds[0];
        flock.leader.formationSlot = 0;
        let followerSlot = 1;
        flyingBirds.forEach((bird) => {
          if (bird !== flock.leader) bird.formationSlot = followerSlot++;
        });

        const leader = flock.leader;
        let route = flock.destination.clone().sub(leader.position);
        if (route.lengthSq() < 1600) {
          flock.destination.set(
            THREE.MathUtils.clamp(leader.position.x + (Math.random() - 0.5) * 150, worldBounds.minX + 20, worldBounds.maxX - 20),
            12 + Math.random() * 22,
            THREE.MathUtils.clamp(leader.position.z + (Math.random() - 0.5) * 150, worldBounds.minZ + 20, worldBounds.maxZ - 20)
          );
          route = flock.destination.clone().sub(leader.position);
        }
        const desiredHeading = Math.atan2(route.x, route.z);
        const headingDelta = Math.atan2(Math.sin(desiredHeading - flock.heading), Math.cos(desiredHeading - flock.heading));
        flock.heading += THREE.MathUtils.clamp(headingDelta, -0.72 * dt, 0.72 * dt);
        const forwardX = Math.sin(flock.heading);
        const forwardZ = Math.cos(flock.heading);
        leader.position.x += forwardX * flock.speed * dt;
        leader.position.z += forwardZ * flock.speed * dt;
        leader.position.y += (flock.destination.y - leader.position.y) * Math.min(1, dt * 0.2);
        leader.heading = flock.heading;
        leader.velocity.set(forwardX * flock.speed, 0, forwardZ * flock.speed);
        leader.wingPhase += dt * (13 + flock.speed * 0.45);

        flyingBirds.forEach((bird) => {
          if (bird === leader) return;
          const formationPosition = getBirdFormationPosition(flock, bird.formationSlot);
          bird.position.lerp(formationPosition, Math.min(1, dt * 8));
          bird.heading = flock.heading;
          bird.velocity.set(leader.velocity.x, 0, leader.velocity.z);
          bird.wingPhase += dt * (13 + flock.speed * 0.45);
        });
      });
    }

    function updateBirds(dt, now) {
      updateBirdFlocks(dt);
      birds.forEach((bird) => {
        if (bird.state === 'flying') return;
        if (bird.state === 'falling') {
          bird.velocity.y -= 12 * dt;
          bird.position.addScaledVector(bird.velocity, dt);
          bird.wingPhase += dt * 18;
          const groundY = groundHeightAt(bird.position.x, bird.position.z) + 0.28;
          if (bird.position.y <= groundY) {
            bird.position.y = groundY;
            bird.velocity.set(0, 0, 0);
            bird.state = 'grounded';
            bird.recoverAt = now + 3000;
          }
        } else if (bird.state === 'grounded' && now >= bird.recoverAt) {
          bird.state = 'takeoff';
          bird.velocity.set(0, 5.2, 0);
          bird.destination.set(
            THREE.MathUtils.clamp(bird.position.x + (Math.random() - 0.5) * 60, worldBounds.minX + 12, worldBounds.maxX - 12),
            14 + Math.random() * 20,
            THREE.MathUtils.clamp(bird.position.z + (Math.random() - 0.5) * 60, worldBounds.minZ + 12, worldBounds.maxZ - 12)
          );
        } else if (bird.state === 'takeoff') {
          bird.position.addScaledVector(bird.velocity, dt);
          bird.wingPhase += dt * 20;
          if (bird.position.y >= groundHeightAt(bird.position.x, bird.position.z) + 4.5) {
            bird.state = 'flying';
            bird.velocity.set(0, 0, 0);
          }
        }
      });
      updateBirdRenderers();
    }

    function maybePunchBirdAtPointer(event) {
      if (!gameStarted || controlledVehicle || playerState.boat || !birdRenderers.length) return false;
      const raycaster = getPointerRaycaster(event);
      const birdMeshes = birdRenderers.map((renderSet) => renderSet.body);
      const hits = raycaster.intersectObjects(birdMeshes, false);
      if (!hits.length) return false;
      const hit = hits[0];
      const typeIndex = hit.object.userData.birdTypeIndex;
      const bird = birdsByType[typeIndex] && birdsByType[typeIndex][hit.instanceId];
      if (!bird) return false;
      const playerPosition = playerState.position;
      if (bird.position.distanceTo(playerPosition) > 6) {
        showMessage('Move closer to punch the bird.');
        return true;
      }
      if (bird.state !== 'flying') return true;
      bird.state = 'falling';
      bird.velocity.set(0, -1.2, 0);
      showMessage('Bird knocked down.');
      return true;
    }

    function createPrison() {
      let placement = worldPlacement.reserveNearest(460, -360, 64, 58, 'prison', 2);
      if (!placement) placement = worldPlacement.reserveNearest(-460, 360, 64, 58, 'prison', 2);
      if (!placement) placement = worldPlacement.reserve(460, -360, 64, 58, 'prison', 2);
      const x = placement.x;
      const z = placement.z;
      const width = 64;
      const depth = 58;
      const group = new THREE.Group();
      group.position.set(x, 0, z);
      const concrete = new THREE.MeshStandardMaterial({ color: 0x737b80, roughness: 0.92 });
      const darkMetal = new THREE.MeshStandardMaterial({ color: 0x27323a, metalness: 0.72, roughness: 0.4 });
      const yard = new THREE.Mesh(new THREE.BoxGeometry(width - 4, 0.12, depth - 4), new THREE.MeshStandardMaterial({ color: 0x84877e, roughness: 0.95 }));
      yard.position.y = 0.06;
      yard.receiveShadow = true;
      group.add(yard);

      const halfWidth = width / 2;
      const halfDepth = depth / 2;
      createBarrier(x - halfWidth, z, 0.8, depth, 4.2, 2.1, 0x596269, false, 'prison-wall');
      createBarrier(x + halfWidth, z, 0.8, depth, 4.2, 2.1, 0x596269, false, 'prison-wall');
      createBarrier(x, z - halfDepth, width, 0.8, 4.2, 2.1, 0x596269, false, 'prison-wall');
      createBarrier(x - 18, z + halfDepth, 28, 0.8, 4.2, 2.1, 0x596269, false, 'prison-wall');
      createBarrier(x + 18, z + halfDepth, 28, 0.8, 4.2, 2.1, 0x596269, false, 'prison-wall');

      const cellFloor = new THREE.Mesh(new THREE.BoxGeometry(26, 0.35, 17), concrete);
      cellFloor.position.set(0, 0.175, -13);
      cellFloor.receiveShadow = true;
      group.add(cellFloor);
      const cellWalls = [
        { size: [26, 7, 0.6], position: [0, 3.5, -21.2] },
        { size: [0.6, 7, 17], position: [-12.7, 3.5, -13] },
        { size: [0.6, 7, 17], position: [12.7, 3.5, -13] }
      ];
      cellWalls.forEach((wall) => {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(...wall.size), concrete);
        mesh.position.set(...wall.position);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        group.add(mesh);
      });
      for (let barIndex = 0; barIndex <= 32; barIndex++) {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(0.08, 6.6, 0.08), darkMetal);
        bar.position.set(-12.4 + barIndex * 0.775, 3.3, -4.55);
        group.add(bar);
      }
      [0.2, 3.3, 6.4].forEach((height) => {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(26, 0.16, 0.16), darkMetal);
        rail.position.set(0, height, -4.55);
        group.add(rail);
      });
      for (let dividerIndex = 0; dividerIndex < 5; dividerIndex++) {
        const divider = new THREE.Mesh(new THREE.BoxGeometry(0.18, 2.6, 16.4), concrete);
        divider.position.set(-8.6 + dividerIndex * 4.3, 1.3, -13);
        group.add(divider);
      }
      const roof = new THREE.Mesh(new THREE.BoxGeometry(27, 0.6, 18), darkMetal);
      roof.position.set(0, 7.3, -13);
      group.add(roof);
      for (const side of [-1, 1]) {
        const cellWindow = new THREE.Mesh(new THREE.BoxGeometry(0.18, 2.4, 6), darkMetal);
        cellWindow.position.set(side * 13.15, 3.5, -13);
        group.add(cellWindow);
        for (let barIndex = 0; barIndex < 5; barIndex++) {
          const bar = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.2, 0.08), darkMetal);
          bar.position.set(side * 13.28, 3.5, -15.4 + barIndex * 1.2);
          group.add(bar);
        }
      }

      const guardTowerGeometry = new THREE.CylinderGeometry(1.5, 1.9, 7.4, 8);
      const towerRoofGeometry = new THREE.ConeGeometry(2.2, 1.6, 8);
      for (const sideX of [-1, 1]) {
        for (const sideZ of [-1, 1]) {
          const tower = new THREE.Mesh(guardTowerGeometry, concrete);
          tower.position.set(sideX * (halfWidth - 2), 3.7, sideZ * (halfDepth - 2));
          tower.castShadow = true;
          group.add(tower);
          const towerRoof = new THREE.Mesh(towerRoofGeometry, darkMetal);
          towerRoof.position.set(tower.position.x, 8.2, tower.position.z);
          group.add(towerRoof);
        }
      }

      const gatePostGeometry = new THREE.BoxGeometry(0.7, 4.4, 0.7);
      [-6, 6].forEach((offset) => {
        const post = new THREE.Mesh(gatePostGeometry, concrete);
        post.position.set(offset, 2.2, halfDepth - 1);
        group.add(post);
      });
      const sign = new THREE.Mesh(new THREE.BoxGeometry(10, 1.2, 0.25), darkMetal);
      sign.position.set(0, 4.8, halfDepth + 0.15);
      group.add(sign);
      const signCanvas = document.createElement('canvas');
      signCanvas.width = 512;
      signCanvas.height = 96;
      const signContext = signCanvas.getContext('2d');
      signContext.fillStyle = '#27323a';
      signContext.fillRect(0, 0, signCanvas.width, signCanvas.height);
      signContext.fillStyle = '#f1f5f9';
      signContext.font = 'bold 54px Arial';
      signContext.textAlign = 'center';
      signContext.textBaseline = 'middle';
      signContext.fillText('CITY PRISON', signCanvas.width / 2, signCanvas.height / 2);
      const signTexture = new THREE.CanvasTexture(signCanvas);
      const signFace = new THREE.Mesh(new THREE.PlaneGeometry(9.8, 1.05), new THREE.MeshBasicMaterial({ map: signTexture }));
      signFace.position.set(0, 4.8, halfDepth + 0.29);
      group.add(signFace);
      cityRoot.add(group);

      const inmatePositions = [];
      for (let index = 0; index < 6; index++) {
        inmatePositions.push(new THREE.Vector3(x + (index - 2.5) * 4.3, 0, z - 12));
      }
      for (let index = 0; index < 24; index++) {
        const column = index % 6;
        const row = Math.floor(index / 6);
        inmatePositions.push(new THREE.Vector3(x + (column - 2.5) * 4.2, 0, z + 7 + row * 3.2));
      }
      prisonFacility = { x, z, width, depth, group, inmatePositions, nextSlot: 0, nextEscapeAt: 0 };
      return prisonFacility;
    }

    function createPrisonPopulation(count = 18) {
      for (let index = 0; index < Math.min(count, prisonFacility.inmatePositions.length); index++) {
        const prisoner = createHuman('A', 'State_Default', true);
        applyPrisonerUniform(prisoner);
        prisoner.isCriminal = true;
        prisoner.criminalStatus = 'incarcerated';
        prisoner.state = 'State_Imprisoned';
        prisoner.task = 'prison-inmate';
        prisoner.speed = 0.75;
        prisoner.prisonSlotIndex = index;
        prisoner.prisonRoutine = index < 6 ? 'cell' : 'exercise';
        prisoner.active = true;
        prisoner.mesh.position.copy(prisonFacility.inmatePositions[index]);
        prisoner.prisonHomePosition = prisonFacility.inmatePositions[index].clone();
        prisoner.destination = prisoner.mesh.position.clone();
        prisonInmates.push(prisoner);
        criminals.push(prisoner);
      }
      prisonFacility.nextSlot = prisonInmates.length;
      prisonFacility.nextEscapeAt = performance.now() + 45000 + Math.random() * 45000;
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
        if (person.task === 'prison-attacker') {
          updatePrisonAttacker(person, dt, now);
          return;
        }
        if (person.task === 'prison-guard-response') {
          updatePrisonGuardResponse(person, dt, now);
          return;
        }
        if (person.task === 'janitor' || person.task === 'mansion-maid') {
          updateCleaningWorker(person, dt, now);
          return;
        }
        if (person.task === 'billionaire' || person.task === 'billionaire-escort' || person.task === 'mansion-guard' || person.task === 'billionaire-driver' || person.task === 'billionaire-car-driver') return;
        if (person.task === 'race-angry') {
          updateRaceAngryDriver(person, dt, now);
          return;
        }
        if (person.task === 'race-recovery') return;
        if (person.task === 'police-officer') return;
        if (person.task === 'prison-inmate') {
          updatePrisonInmate(person, dt);
          return;
        }
        if (person.criminalStatus === 'arresting') {
          person.mesh.rotation.z = 1.25;
          person.leftArm.rotation.x = -1.2;
          person.rightArm.rotation.x = -1.2;
          return;
        }
        if (person.criminalStatus === 'fugitive') {
          updateCriminalAI(person, dt, now);
          return;
        }
        if (person.knockedDown) {
          if (person.knockedDown.getUp && now >= person.knockedDown.until) {
            person.knockedDown = null;
            person.mesh.rotation.set(0, person.mesh.rotation.y, 0);
          } else {
            person.mesh.rotation.z = 1.45;
            return;
          }
        }
        if (!person.isMedic && now > (person.nextImpactAt || 0)) {
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
      resolveCharacterOverlaps();
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
      if (!person || person.isMedic) return;
      person.isPunching = true; person.punchUntil = performance.now() + 3000; showMessage('Punch landed!');
    }

    function handleEntityClick(event) {
      if (!gameStarted || !menu.classList.contains('hidden') || controlledVehicle || playerState.boat) return;
      const raycaster = getPointerRaycaster(event);
      const hits = raycaster.intersectObjects(people.map((person) => person.mesh), true);
      if (!hits.length) return;
      const hitObject = hits[0].object;
      const hitPerson = people.find((person) => person.mesh === hitObject || person.mesh.children.includes(hitObject) || person.mesh === hitObject.parent || person.mesh === hitObject.parent?.parent);
      if (!hitPerson || hitPerson.isMedic || event.button !== 0) return;
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
      if (selectedCar.isBillionaireCar && !startBillionaireCarTheft(selectedCar, performance.now())) return false;
      if (selectedCar.isRaceCar && raceTrack && (raceTrack.phase === 'racing' || raceTrack.phase === 'confrontation')) {
        startRaceCarTheft(performance.now(), selectedCar);
      }
      if (selectedCar.npc) {
        ejectCarDriver(selectedCar);
        const npcIndex = npcCars.indexOf(selectedCar);
        if (npcIndex >= 0) npcCars.splice(npcIndex, 1);
        selectedCar.npc = false;
        selectedCar.route = null;
      }
      const motorcycleWasFallen = selectedCar.isMotorcycle && selectedCar.fallenOver;
      if (selectedCar.isMotorcycle && selectedCar.fallenOver) {
        if (selectedCar.driver) ejectCarDriver(selectedCar);
        resetMotorcycleUpright(selectedCar);
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
      showMessage(selectedCar.isBillionaireCar ? 'You took a billionaire’s car. The bodyguards are following!' : motorcycleWasFallen ? 'Motorcycle upright and ready to drive.' : 'Entered vehicle. Drive with WASD.');
      selectedCar.inside = true;
      return true;
    }

    function handleDriving(dt) {
      syncActiveMode();
      if (!controlledVehicle) return;
      const car = controlledVehicle;
      const maxSpeedMph = car.isRaceCar && raceTrack ? raceTrack.maxSpeedMph : car.isMotorcycle ? 80 : 75;
      const maxSpeed = maxSpeedMph / 2.237;
      car.fuel = Infinity;
      car.maxFuel = Infinity;

      const turnInput = (driveKeys.right ? 1 : 0) - (driveKeys.left ? 1 : 0);
      const steeringTarget = turnInput * 1.6;
      const steeringResponse = 1 - Math.exp(-(turnInput ? 12 : 8) * dt);
      car.steer = THREE.MathUtils.lerp(car.steer, steeringTarget, steeringResponse);

      const turnStrength = car.isMotorcycle ? 0.85 + Math.abs(car.speed) * 0.035 : 1.8 + Math.abs(car.speed) * 0.09;
      if (turnInput !== 0) {
        car.mesh.rotation.y += car.steer * turnStrength * dt;
      }
      if (car.isMotorcycle) car.mesh.rotation.z = -car.steer * Math.min(0.3, Math.abs(car.speed) * 0.008);
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
      if (car.fallenOver) return;
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
      const displayLimitMph = controlledVehicle.isRaceCar && raceTrack ? raceTrack.maxSpeedMph : controlledVehicle.isMotorcycle ? 80 : 99;
      const speedMph = Math.min(displayLimitMph, Math.round(speedMps * 2.237));
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
        const resolved = resolvePlayerFootstep(nextX, nextZ, 0.7);
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
        if (!car || !car.route || car.destroyed || !car.active || car === controlledVehicle || car.owner === 'player' ||
          car.isPolice || car.jobRole === 'police' || car.isCriminal || car.isCriminalCar || car.jobRole === 'criminal' ||
          car.isRaceCar || car.jobRole === 'race-car') return;
        const route = car.route;
        if (route.turn) {
          route.turn.elapsed += dt;
          const progress = Math.min(route.turn.elapsed / route.turn.duration, 1);
          const inverse = 1 - progress;
          const turnX = inverse * inverse * route.turn.start.x + 2 * inverse * progress * route.turn.control.x + progress * progress * route.turn.end.x;
          const turnZ = inverse * inverse * route.turn.start.z + 2 * inverse * progress * route.turn.control.z + progress * progress * route.turn.end.z;
          car.body.position.set(turnX, car.body.position.y, turnZ);
          car.mesh.position.copy(car.body.position);
          const yawDelta = THREE.MathUtils.euclideanModulo(route.turn.endYaw - route.turn.startYaw + Math.PI, Math.PI * 2) - Math.PI;
          car.mesh.rotation.y = route.turn.startYaw + yawDelta * progress;
          car.body.quaternion.setFromEuler(0, car.mesh.rotation.y, 0);
          if (progress >= 1) route.turn = null;
          return;
        }
        const current = route.horizontal ? car.body.position.x : car.body.position.z;
        let next = current + route.direction * car.speed * dt;
        const junction = route.area ? getNextTrafficJunction(route, current) : null;
        if (junction && junction.distance <= Math.max(3, Math.abs(car.speed * dt) + 1) && Math.random() < 0.24) {
          const newDirection = Math.random() < 0.5 ? -1 : 1;
          const nextRoute = createTrafficRoute(junction.area, newDirection, route.laneOffset);
          const intersectionX = route.horizontal ? junction.axis : route.roadAxis;
          const intersectionZ = route.horizontal ? route.roadAxis : junction.axis;
          const start = new THREE.Vector3(car.body.position.x, 0, car.body.position.z);
          const control = new THREE.Vector3(intersectionX, 0, intersectionZ);
          const end = nextRoute.horizontal
            ? new THREE.Vector3(intersectionX + newDirection * 10, 0, nextRoute.fixed)
            : new THREE.Vector3(nextRoute.fixed, 0, intersectionZ + newDirection * 10);
          const startYaw = car.mesh.rotation.y;
          const endYaw = nextRoute.horizontal ? newDirection * Math.PI / 2 : newDirection < 0 ? Math.PI : 0;
          Object.assign(route, nextRoute);
          route.turn = { start, control, end, startYaw, endYaw, elapsed: 0, duration: 0.65 };
          return;
        }
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

    function updateCriminalAI(person, dt, now) {
      const unit = person.pursuedBy;
      const threat = unit && unit.officer && unit.phase === 'approach'
        ? unit.officer.mesh.position
        : unit && unit.car && unit.phase === 'pursuit'
          ? unit.car.body.position
          : null;
      const closeThreat = threat && Math.hypot(threat.x - person.mesh.position.x, threat.z - person.mesh.position.z) < 32;
      if (closeThreat && now >= (person.nextFleeAt || 0)) {
        const escapeDirection = person.mesh.position.clone().sub(threat).setY(0);
        if (escapeDirection.lengthSq() < 0.01) escapeDirection.set(Math.random() - 0.5, 0, Math.random() - 0.5);
        escapeDirection.normalize();
        person.destination.copy(person.mesh.position).addScaledVector(escapeDirection, 24);
        const responseRadius = Math.min(110, Math.max(16, entityVisibilityRadius() - 4));
        const fleeRadius = Math.max(6, responseRadius - 3);
        const fromPlayer = person.destination.clone().sub(playerState.position).setY(0);
        if (fromPlayer.length() > fleeRadius) {
          person.destination.copy(playerState.position).addScaledVector(fromPlayer.normalize(), fleeRadius);
          person.destination.y = 0;
        }
        person.nextFleeAt = now + 700;
      } else if (person.isPrisonEscape && !person.escapedPrison) {
        if (person.mesh.position.distanceTo(person.escapeGate) < 2.5) {
          person.escapedPrison = true;
          person.escapedPrisonAt = now;
          person.policeResponseAt = now + 7000;
          person.nextEscapeDecisionAt = now;
          if (Math.hypot(playerState.position.x - person.mesh.position.x, playerState.position.z - person.mesh.position.z) < 90) {
            showMessage('An escaped inmate is threatening pedestrians!');
          }
        } else {
          person.destination.copy(person.escapeGate);
        }
      } else if (person.isPrisonEscape && person.escapedPrison && !closeThreat) {
        let target = person.publicThreatTarget;
        if (!target || !target.active || now >= person.nextEscapeDecisionAt) {
          target = people
            .filter((candidate) => candidate && candidate !== person && candidate.active && !candidate.isCriminal && !candidate.isPoliceOfficer && !candidate.isPrisoner && !candidate.isMedic)
            .map((candidate) => ({ person: candidate, distance: Math.hypot(candidate.mesh.position.x - person.mesh.position.x, candidate.mesh.position.z - person.mesh.position.z) }))
            .filter((candidate) => candidate.distance < 28)
            .sort((a, b) => a.distance - b.distance)[0]?.person || null;
          person.publicThreatTarget = target;
          person.nextEscapeDecisionAt = now + 1200;
        }
        if (target) {
          const distance = Math.hypot(target.mesh.position.x - person.mesh.position.x, target.mesh.position.z - person.mesh.position.z);
          person.destination.copy(target.mesh.position);
          if (distance <= 1.5 && now >= (person.nextPublicThreatAt || 0)) {
            target.knockedDown = { getUp: true, until: now + 2200 };
            target.nextImpactAt = now + 2800;
            target.mesh.rotation.z = 1.45;
            person.publicThreatTarget = null;
            person.nextPublicThreatAt = now + 6500;
          }
        } else if (now >= person.nextEscapeDecisionAt) {
          person.destination.copy(getNearbyPedestrianDestination(person.mesh.position));
          person.nextEscapeDecisionAt = now + 1200;
        }
      } else if (!closeThreat && (now >= person.nextEscapeDecisionAt || person.mesh.position.distanceTo(person.destination) < 1.5)) {
        person.destination.copy(getNearbyPedestrianDestination(person.mesh.position));
        person.nextEscapeDecisionAt = now + 2200 + Math.random() * 3800;
      }

      const direction = person.destination.clone().sub(person.mesh.position).setY(0);
      if (direction.lengthSq() < 0.01) return;
      direction.normalize();
      const step = (threat ? 2.7 : person.speed) * dt * 1.8;
      const nextPosition = person.mesh.position.clone().addScaledVector(direction, step);
      const resolved = resolveFootstep(nextPosition.x, nextPosition.z, 0.55);
      if (!resolved.blocked) person.mesh.position.set(resolved.x, groundHeightAt(resolved.x, resolved.z), resolved.z);
      else person.destination.copy(getNearbyPedestrianDestination(person.mesh.position));
      person.mesh.rotation.y = Math.atan2(direction.x, direction.z);
      person.walkPhase += dt * (threat ? 12 : 7);
      const swing = webOptimizer.lowLag ? 0 : Math.sin(person.walkPhase) * 0.85;
      person.leftArm.rotation.x = swing;
      person.rightArm.rotation.x = -swing;
      person.leftLeg.rotation.x = -swing;
      person.rightLeg.rotation.x = swing;
    }

    function updatePrisonInmate(person, dt) {
      if (!prisonFacility) return;
      if (person.prisonReturnHome) {
        const returnDirection = person.prisonReturnHome.clone().sub(person.mesh.position).setY(0);
        if (returnDirection.length() < 1.4) {
          person.mesh.position.copy(person.prisonReturnHome);
          person.prisonReturnHome = null;
        } else {
          returnDirection.normalize();
          const nextPosition = person.mesh.position.clone().addScaledVector(returnDirection, 2.8 * dt);
          const resolved = resolveFootstep(nextPosition.x, nextPosition.z, 0.5);
          if (!resolved.blocked) person.mesh.position.set(resolved.x, 0, resolved.z);
          person.mesh.rotation.y = Math.atan2(returnDirection.x, returnDirection.z);
          return;
        }
      }
      if (person.prisonRoutine === 'cell') {
        const idleMotion = webOptimizer.lowLag ? 0 : Math.sin(performance.now() * 0.0015 + person.walkPhase) * 0.08;
        person.leftArm.rotation.x = idleMotion;
        person.rightArm.rotation.x = -idleMotion;
        return;
      }
      if (!person.destination || person.mesh.position.distanceTo(person.destination) < 1.4) {
        person.destination = new THREE.Vector3(
          prisonFacility.x + (Math.random() - 0.5) * 38,
          0,
          prisonFacility.z + 5 + Math.random() * 17
        );
      }
      const direction = person.destination.clone().sub(person.mesh.position).setY(0);
      if (direction.lengthSq() < 0.01) return;
      direction.normalize();
      const nextPosition = person.mesh.position.clone().addScaledVector(direction, person.speed * dt);
      const resolved = resolveFootstep(nextPosition.x, nextPosition.z, 0.5);
      if (!resolved.blocked) person.mesh.position.set(resolved.x, 0, resolved.z);
      else person.destination.set(prisonFacility.x, 0, prisonFacility.z + 10);
      person.mesh.rotation.y = Math.atan2(direction.x, direction.z);
    }

    function isInsidePrison(position) {
      return !!prisonFacility &&
        Math.abs(position.x - prisonFacility.x) < prisonFacility.width / 2 - 1.2 &&
        Math.abs(position.z - prisonFacility.z) < prisonFacility.depth / 2 - 1.2;
    }

    function tryStartPrisonEncounter(victim, targetPlayer, now) {
      if (Math.random() >= 0.3) return;
      const availableInmates = prisonInmates.filter((person) =>
        person.criminalStatus === 'incarcerated' && person.task === 'prison-inmate' && !person.prisonEncounter
      );
      if (!availableInmates.length) return;
      const attacker = availableInmates[Math.floor(Math.random() * availableInmates.length)];
      const encounter = {
        attacker,
        victim: targetPlayer ? null : victim,
        targetPlayer,
        phase: 'attack',
        startedAt: now,
        endsAt: now + 10000,
        guard: null
      };
      attacker.prisonEncounter = encounter;
      attacker.nextPrisonAttackAt = now + 350;
      attacker.task = 'prison-attacker';
      prisonEncounters.push(encounter);
      if (targetPlayer || Math.hypot(playerState.position.x - victim.mesh.position.x, playerState.position.z - victim.mesh.position.z) < 70) {
        showMessage(targetPlayer ? 'An inmate is attacking you!' : 'An inmate is attacking a civilian!');
      }
    }

    function updatePrisonAttacker(person, dt, now) {
      const encounter = person.prisonEncounter;
      if (!encounter || encounter.phase !== 'attack') {
        person.isPunching = false;
        return;
      }
      const target = encounter.targetPlayer ? playerState.position : encounter.victim.mesh.position;
      const direction = new THREE.Vector3(target.x - person.mesh.position.x, 0, target.z - person.mesh.position.z);
      const distance = direction.length();
      if (distance > 1.25) {
        direction.normalize();
        const nextPosition = person.mesh.position.clone().addScaledVector(direction, Math.min(distance - 1.05, 4.8 * dt));
        const resolved = resolveFootstep(nextPosition.x, nextPosition.z, 0.55);
        if (!resolved.blocked) person.mesh.position.set(resolved.x, groundHeightAt(resolved.x, resolved.z), resolved.z);
        person.mesh.rotation.y = Math.atan2(direction.x, direction.z);
        person.walkPhase += dt * 12;
        const swing = webOptimizer.lowLag ? 0 : Math.sin(person.walkPhase) * 1.0;
        person.leftArm.rotation.x = swing - 0.5;
        person.rightArm.rotation.x = -swing - 0.5;
        return;
      }
      person.mesh.rotation.y = Math.atan2(direction.x, direction.z);
      if (now >= person.nextPrisonAttackAt) {
        person.isPunching = true;
        person.punchUntil = now + 360;
        person.nextPrisonAttackAt = now + 900;
        if (encounter.targetPlayer) {
          playerInputActive = false;
          playerStunUntil = Math.max(playerStunUntil, now + 400);
        } else if (encounter.victim && encounter.victim.active) {
          encounter.victim.knockedDown = { getUp: true, until: now + 1500 };
          encounter.victim.nextImpactAt = now + 1700;
          encounter.victim.mesh.rotation.z = 1.45;
        }
      }
      if (person.isPunching && now < person.punchUntil) {
        person.leftArm.rotation.x = -1.55;
        person.rightArm.rotation.x = 1.1;
      } else {
        person.isPunching = false;
      }
    }

    function finishPrisonEncounter(encounter, now) {
      const attacker = encounter.attacker;
      if (attacker) {
        attacker.task = 'prison-inmate';
        attacker.prisonEncounter = null;
        attacker.isPunching = false;
        attacker.punchUntil = 0;
        attacker.prisonReturnHome = attacker.prisonHomePosition && attacker.prisonHomePosition.clone();
        attacker.destination = attacker.prisonHomePosition ? attacker.prisonHomePosition.clone() : attacker.mesh.position.clone();
      }
      if (encounter.guard) {
        encounter.guard.task = 'police-officer';
        encounter.guard.prisonResponseTo = null;
      }
      const encounterIndex = prisonEncounters.indexOf(encounter);
      if (encounterIndex >= 0) prisonEncounters.splice(encounterIndex, 1);
      if (Math.hypot(playerState.position.x - (attacker ? attacker.mesh.position.x : playerState.position.x), playerState.position.z - (attacker ? attacker.mesh.position.z : playerState.position.z)) < 80) {
        showMessage('A prison guard broke up the attack.');
      }
    }

    function updatePrisonGuardResponse(guard, dt, now) {
      const encounter = guard.prisonResponseTo;
      if (!encounter || !encounter.attacker || !encounter.attacker.active) {
        guard.task = 'police-officer';
        guard.prisonResponseTo = null;
        return;
      }
      const direction = encounter.attacker.mesh.position.clone().sub(guard.mesh.position).setY(0);
      const distance = direction.length();
      if (distance <= 1.4) {
        finishPrisonEncounter(encounter, now);
        return;
      }
      direction.normalize();
      const nextPosition = guard.mesh.position.clone().addScaledVector(direction, Math.min(distance - 1.2, guard.speed * dt));
      const resolved = resolveFootstep(nextPosition.x, nextPosition.z, 0.55);
      if (!resolved.blocked) guard.mesh.position.set(resolved.x, groundHeightAt(resolved.x, resolved.z), resolved.z);
      guard.mesh.rotation.y = Math.atan2(direction.x, direction.z);
      guard.leftArm.rotation.x = -0.55;
      guard.rightArm.rotation.x = -0.55;
    }

    function updatePrisonEncounters(now) {
      if (!prisonFacility || !gameSettings.npcs) return;
      people.forEach((person) => {
        if (!person || !person.active || !person.mesh.visible || person.ridingBoat) return;
        const inside = isInsidePrison(person.mesh.position);
        const isCivilian = !person.isCriminal && !person.isPoliceOfficer && !person.isPrisoner && !person.isMedic && !person.isBoatCaptain && !person.isRaceDriver;
        if (inside && !person.wasInsidePrison && isCivilian) tryStartPrisonEncounter(person, false, now);
        person.wasInsidePrison = inside;
      });
      const playerCanBeAttacked = !controlledVehicle && !controlledAirplane && !controlledBoat && !playerState.seatedOn;
      const playerInside = playerCanBeAttacked && isInsidePrison(playerState.position);
      if (playerInside && !playerWasInsidePrison) tryStartPrisonEncounter(null, true, now);
      playerWasInsidePrison = playerInside;

      for (let index = prisonEncounters.length - 1; index >= 0; index--) {
        const encounter = prisonEncounters[index];
        if (encounter.phase !== 'attack' || now < encounter.endsAt) continue;
        encounter.phase = 'guard-response';
        const guard = prisonOfficers
          .filter((officer) => officer.active && officer.task === 'police-officer' && !officer.prisonResponseTo)
          .sort((a, b) => a.mesh.position.distanceTo(encounter.attacker.mesh.position) - b.mesh.position.distanceTo(encounter.attacker.mesh.position))[0];
        if (!guard) {
          finishPrisonEncounter(encounter, now);
          continue;
        }
        encounter.guard = guard;
        guard.prisonResponseTo = encounter;
        guard.task = 'prison-guard-response';
        if (Math.hypot(playerState.position.x - encounter.attacker.mesh.position.x, playerState.position.z - encounter.attacker.mesh.position.z) < 100) {
          showMessage('A prison guard is coming to break up the fight.');
        }
      }
    }

    function startPrisonerEscape(prisoner, now) {
      const inmateIndex = prisonInmates.indexOf(prisoner);
      if (inmateIndex >= 0) prisonInmates.splice(inmateIndex, 1);
      prisoner.criminalStatus = 'fugitive';
      prisoner.task = 'criminal';
      prisoner.speed = 2.6 + Math.random() * 0.5;
      prisoner.isPrisonEscape = true;
      prisoner.escapedPrison = false;
      prisoner.pursuedBy = null;
      prisoner.publicThreatTarget = null;
      prisoner.escapeGate = new THREE.Vector3(
        prisonFacility.x + (Math.random() - 0.5) * 4,
        0,
        prisonFacility.z + prisonFacility.depth / 2 + 8
      );
      prisoner.destination.copy(prisoner.escapeGate);
      prisoner.nextEscapeDecisionAt = now;
      prisoner.knockedDown = null;
      prisonFacility.nextEscapeAt = Infinity;
    }

    function updatePrisonEscapeSystem(now) {
      if (!prisonFacility || now < prisonFacility.nextEscapeAt) return;
      const activeEscape = criminals.some((person) => person.isPrisonEscape && person.criminalStatus === 'fugitive');
      if (activeEscape) return;
      const eligibleInmates = prisonInmates.filter((person) => person.criminalStatus === 'incarcerated');
      if (!eligibleInmates.length) {
        prisonFacility.nextEscapeAt = now + 15000;
        return;
      }
      const escapee = eligibleInmates[Math.floor(Math.random() * eligibleInmates.length)];
      startPrisonerEscape(escapee, now);
    }

    function movePoliceCar(unit, targetPosition, dt, now, speed) {
      const car = unit.car;
      const direction = new THREE.Vector3(targetPosition.x - car.body.position.x, 0, targetPosition.z - car.body.position.z);
      const distance = direction.length();
      if (distance < 0.5) return;
      direction.normalize();
      car.speed = speed;
      car.mesh.rotation.y = Math.atan2(direction.x, direction.z);
      const step = Math.min(distance, speed * dt);
      const forwardPosition = { x: car.body.position.x + direction.x * step, z: car.body.position.z + direction.z * step };
      const side = new THREE.Vector3(-direction.z, 0, direction.x);
      const candidates = [
        forwardPosition,
        { x: forwardPosition.x + side.x * step, z: forwardPosition.z + side.z * step },
        { x: forwardPosition.x - side.x * step, z: forwardPosition.z - side.z * step }
      ].filter((position) => !pointIsInsideBuildingRect(position.x, position.z, 1.8));
      candidates.sort((a, b) => Math.hypot(targetPosition.x - a.x, targetPosition.z - a.z) - Math.hypot(targetPosition.x - b.x, targetPosition.z - b.z));
      const moved = candidates[0];
      if (moved) car.body.position.set(moved.x, car.body.position.y, moved.z);
      car.body.velocity.set(0, 0, 0);
      if (!moved) unit.pathTimer = now + 350;
      car.mesh.position.set(car.body.position.x, car.body.position.y, car.body.position.z);
      car.body.quaternion.setFromEuler(0, car.mesh.rotation.y, 0);
    }

    function finishCriminalArrest(unit, now) {
      const inmate = unit.target;
      if (!inmate || !prisonFacility) return;
      const occupiedSlots = new Set(prisonInmates.map((person) => person.prisonSlotIndex));
      let slotIndex = Number.isInteger(inmate.prisonSlotIndex) && !occupiedSlots.has(inmate.prisonSlotIndex)
        ? inmate.prisonSlotIndex
        : prisonFacility.inmatePositions.findIndex((_, index) => !occupiedSlots.has(index));
      if (slotIndex < 0) slotIndex = prisonFacility.nextSlot % prisonFacility.inmatePositions.length;
      const slot = prisonFacility.inmatePositions[slotIndex];
      prisonFacility.nextSlot = slotIndex + 1;
      inmate.mesh.position.copy(slot);
      inmate.mesh.rotation.set(0, 0, 0);
      inmate.criminalStatus = 'incarcerated';
      inmate.state = 'State_Imprisoned';
      inmate.task = 'prison-inmate';
      inmate.prisonSlotIndex = slotIndex;
      inmate.prisonRoutine = slotIndex < 6 ? 'cell' : 'exercise';
      inmate.prisonHomePosition = slot.clone();
      const wasPrisonEscape = inmate.isPrisonEscape;
      inmate.isPrisonEscape = false;
      inmate.escapedPrison = false;
      inmate.publicThreatTarget = null;
      inmate.escapeGate = null;
      inmate.knockedDown = null;
      inmate.speed = 0.75;
      inmate.destination = slot.clone();
      if (!prisonInmates.includes(inmate)) prisonInmates.push(inmate);
      if (unit.officer) {
        const officerIndex = people.indexOf(unit.officer);
        if (officerIndex >= 0) people.splice(officerIndex, 1);
        scene.remove(unit.officer.mesh);
        unit.officer = null;
      }
      if (Math.hypot(playerState.position.x - unit.car.body.position.x, playerState.position.z - unit.car.body.position.z) < 140) {
        showMessage('Police arrested a fugitive and transferred them to the prison.');
      }
      unit.target.pursuedBy = null;
      unit.target = null;
      unit.phase = 'patrol';
      unit.path = [];
      unit.car.sirenActive = false;
      unit.patrolTarget = null;
      unit.arrestAt = now;
      if (wasPrisonEscape) prisonFacility.nextEscapeAt = now + 45000 + Math.random() * 60000;
    }

    function updatePoliceAI(dt, now) {
      if (!gameSettings.npcs) return;
      updatePrisonEscapeSystem(now);
      if (!policeUnits.length) createPoliceUnit(playerState.position.x, playerState.position.z);
      const responseRadius = Math.min(110, Math.max(16, entityVisibilityRadius() - 4));
      const nearbyFugitives = criminals
        .filter((person) => person.criminalStatus === 'fugitive' && (
          person.isPrisonEscape
            ? person.escapedPrison && now >= person.policeResponseAt
            : Math.hypot(person.mesh.position.x - playerState.position.x, person.mesh.position.z - playerState.position.z) <= responseRadius
        ))
        .sort((a, b) => Math.hypot(a.mesh.position.x - playerState.position.x, a.mesh.position.z - playerState.position.z) - Math.hypot(b.mesh.position.x - playerState.position.x, b.mesh.position.z - playerState.position.z));

      nearbyFugitives.forEach((fugitive) => {
        if (fugitive.pursuedBy) return;
        let unit = policeUnits.find((candidate) => candidate.phase === 'patrol' && !candidate.target);
        if (!unit && policeUnits.length < 2) unit = createPoliceUnit(playerState.position.x, playerState.position.z);
        if (!unit) return;
        unit.target = fugitive;
        unit.phase = 'pursuit';
        unit.path = [];
        fugitive.pursuedBy = unit;
      });

      policeUnits.forEach((unit) => {
        const car = unit.car;
        if (!car || car.destroyed) return;
        car.body.wakeUp();
        car.sirenActive = ['pursuit', 'approach', 'arresting'].includes(unit.phase) ||
          (unit.phase === 'respawning' && ['pursuit', 'approach', 'arresting'].includes(unit.resumePhase));
        if (unit.phase === 'respawning') {
          const target = unit.target ? unit.target.mesh.position : unit.patrolTarget || getNearestRoadPosition(JOB_VEHICLE_GARAGE.x, JOB_VEHICLE_GARAGE.z);
          const distance = Math.hypot(target.x - car.body.position.x, target.z - car.body.position.z);
          if (distance > 4) {
            movePoliceCar(unit, target, dt, now, 20);
          } else {
            unit.phase = unit.resumePhase || 'patrol';
            unit.resumePhase = null;
            car.body.velocity.set(0, 0, 0);
          }
          return;
        }
        if (unit.phase === 'patrol') {
          if (!unit.patrolTarget || Math.hypot(unit.patrolTarget.x - car.body.position.x, unit.patrolTarget.z - car.body.position.z) < 4) {
            unit.patrolTarget = getNearestRoadPosition(
              playerState.position.x + (Math.random() - 0.5) * 70,
              playerState.position.z + (Math.random() - 0.5) * 70
            );
            unit.path = [];
          }
          movePoliceCar(unit, unit.patrolTarget, dt, now, 7.5);
          return;
        }

        const fugitive = unit.target;
        if (!fugitive || (fugitive.criminalStatus !== 'fugitive' && !(unit.phase === 'arresting' && fugitive.criminalStatus === 'arresting'))) {
          unit.target = null;
          unit.phase = 'patrol';
          unit.path = [];
          return;
        }
        const playerDistance = Math.hypot(fugitive.mesh.position.x - playerState.position.x, fugitive.mesh.position.z - playerState.position.z);
        if (!fugitive.isPrisonEscape && playerDistance > responseRadius * 1.5 && unit.phase !== 'arresting') {
          fugitive.pursuedBy = null;
          unit.target = null;
          unit.phase = 'patrol';
          unit.path = [];
          return;
        }

        if (unit.phase === 'pursuit') {
          const roadTarget = getNearestRoadPosition(fugitive.mesh.position.x, fugitive.mesh.position.z);
          if (Math.hypot(roadTarget.x - car.body.position.x, roadTarget.z - car.body.position.z) > 8) {
            movePoliceCar(unit, roadTarget, dt, now, 20);
            return;
          }
          unit.phase = 'approach';
          unit.path = [];
          createPoliceOfficer(unit);
        }
        if (unit.phase === 'approach') {
          const officer = unit.officer;
          const direction = fugitive.mesh.position.clone().sub(officer.mesh.position).setY(0);
          const distance = direction.length();
          if (distance <= 1.25) {
            fugitive.criminalStatus = 'arresting';
            fugitive.task = 'criminal-arrested';
            fugitive.arrestUntil = now + 1500;
            fugitive.mesh.rotation.z = 1.25;
            officer.leftArm.rotation.x = -1.2;
            officer.rightArm.rotation.x = -1.2;
            unit.phase = 'arresting';
            unit.arrestAt = fugitive.arrestUntil;
            return;
          }
          direction.normalize();
          const next = officer.mesh.position.clone().addScaledVector(direction, officer.speed * dt);
          const resolved = resolveFootstep(next.x, next.z, 0.55);
          if (!resolved.blocked) officer.mesh.position.set(resolved.x, groundHeightAt(resolved.x, resolved.z), resolved.z);
          else officer.destination.copy(getSidewalkPointNear(fugitive.mesh.position));
          officer.mesh.rotation.y = Math.atan2(direction.x, direction.z);
          return;
        }
        if (unit.phase === 'arresting' && now >= unit.arrestAt) finishCriminalArrest(unit, now);
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

    function updateFallingTreeTops(dt, now) {
      for (let index = fallingTreeTops.length - 1; index >= 0; index--) {
        const falling = fallingTreeTops[index];
        if (webOptimizer.lowLag && now - falling.createdAt >= 10000) {
          scene.remove(falling.mesh);
          falling.mesh.geometry.dispose();
          falling.mesh.material.dispose();
          fallingTreeTops.splice(index, 1);
          continue;
        }
        if (falling.landed) continue;
        falling.velocity.y -= 16 * dt;
        falling.mesh.position.addScaledVector(falling.velocity, dt);
        falling.mesh.rotation.x += falling.angularVelocity.x * dt;
        falling.mesh.rotation.y += falling.angularVelocity.y * dt;
        falling.mesh.rotation.z += falling.angularVelocity.z * dt;
        const canopyBounds = new THREE.Box3().setFromObject(falling.mesh);
        const groundY = groundHeightAt(falling.mesh.position.x, falling.mesh.position.z) + 0.025;
        if (canopyBounds.min.y > groundY) continue;
        falling.mesh.position.y += groundY - canopyBounds.min.y;
        falling.velocity.set(0, 0, 0);
        falling.angularVelocity.set(0, 0, 0);
        falling.landed = true;
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

    function reserveSoccerFieldSite(targetX, targetZ) {
      const width = 68;
      const depth = 60;
      const offsets = [];
      for (let dx = -144; dx <= 144; dx += 8) {
        for (let dz = -144; dz <= 144; dz += 8) {
          const distance = dx * dx + dz * dz;
          if (distance <= 144 * 144) offsets.push({ dx, dz, distance });
        }
      }
      offsets.sort((a, b) => a.distance - b.distance || a.dx - b.dx || a.dz - b.dz);
      for (const offset of offsets) {
        const x = targetX + offset.dx;
        const z = targetZ + offset.dz;
        if (Math.abs(x) > worldBounds.maxX - width / 2 - 4 || Math.abs(z) > worldBounds.maxZ - depth / 2 - 4) continue;
        if (!worldPlacement.isAreaClear(x, z, width, depth, 2.5)) continue;
        const overlapsPark = parkActivityAreas.some((park) =>
          Math.abs(x - park.x) < width / 2 + park.halfWidth + 2 &&
          Math.abs(z - park.z) < depth / 2 + park.halfDepth + 2
        );
        if (overlapsPark) continue;
        return worldPlacement.reserve(x, z, width, depth, 'soccer-field', 2.5);
      }
      return null;
    }

    function createSoccerFenceRun(field, startX, startZ, endX, endZ) {
      const horizontal = Math.abs(endX - startX) >= Math.abs(endZ - startZ);
      const length = horizontal ? Math.abs(endX - startX) : Math.abs(endZ - startZ);
      const centerX = (startX + endX) / 2;
      const centerZ = (startZ + endZ) / 2;
      const fenceMaterial = field.fenceMaterial;
      [0.72, 1.62].forEach((y) => {
        const rail = new THREE.Mesh(
          new THREE.BoxGeometry(horizontal ? length : 0.14, 0.12, horizontal ? 0.14 : length),
          fenceMaterial
        );
        rail.position.set(centerX, y, centerZ);
        field.group.add(rail);
      });
      const postCount = Math.max(2, Math.ceil(length / 3.5));
      for (let index = 0; index <= postCount; index++) {
        const along = -length / 2 + length * index / postCount;
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.16, 2.25, 0.16), fenceMaterial);
        post.position.set(centerX + (horizontal ? along : 0), 1.12, centerZ + (horizontal ? 0 : along));
        field.group.add(post);
      }
      const thickness = 0.28;
      const segment = horizontal
        ? { minX: field.x + Math.min(startX, endX), maxX: field.x + Math.max(startX, endX), minZ: field.z + centerZ - thickness / 2, maxZ: field.z + centerZ + thickness / 2 }
        : { minX: field.x + centerX - thickness / 2, maxX: field.x + centerX + thickness / 2, minZ: field.z + Math.min(startZ, endZ), maxZ: field.z + Math.max(startZ, endZ) };
      worldBarriers.push({
        ...segment,
        x: (segment.minX + segment.maxX) / 2,
        z: (segment.minZ + segment.maxZ) / 2,
        width: segment.maxX - segment.minX,
        depth: segment.maxZ - segment.minZ,
        height: 2.25,
        kind: 'soccer-fence',
        collapsing: false
      });
    }

    function addSoccerGoal(field, end) {
      const x = end * field.halfLength;
      const postMaterial = new THREE.MeshStandardMaterial({ color: 0xf4f5ec, metalness: 0.24, roughness: 0.4 });
      [-1, 1].forEach((side) => {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.22, 2.5, 0.22), postMaterial);
        post.position.set(x, 1.25, side * 5.2);
        field.group.add(post);
      });
      const crossbar = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 10.4), postMaterial);
      crossbar.position.set(x, 2.5, 0);
      field.group.add(crossbar);
      const netMaterial = new THREE.MeshBasicMaterial({ color: 0xdde7de, wireframe: true, transparent: true, opacity: 0.42 });
      const net = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.35, 10.2), netMaterial);
      net.position.set(x - end * 1.2, 1.18, 0);
      field.group.add(net);
    }

    function createSoccerPerson(field, x, z, shirtColor, pantsColor = 0xf1f1eb) {
      const person = createHuman('A', 'State_Default', true);
      const personIndex = people.indexOf(person);
      if (personIndex >= 0) people.splice(personIndex, 1);
      person.soccerField = field;
      person.mesh.position.set(field.x + x, 0, field.z + z);
      person.mesh.rotation.y = 0;
      person.active = true;
      person.task = 'soccer';
      person.torso.material.color.setHex(shirtColor);
      [person.leftLeg, person.rightLeg].forEach((leg) => {
        const pants = leg.children.find((child) => child.isMesh);
        if (pants) pants.material.color.setHex(pantsColor);
      });
      return person;
    }

    function createSoccerScoreboard(field) {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 256;
      const texture = new THREE.CanvasTexture(canvas);
      texture.encoding = THREE.sRGBEncoding;
      const board = new THREE.Mesh(
        new THREE.PlaneGeometry(9, 4.5),
        new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide })
      );
      board.position.set(field.halfLength + 5, 5, 0);
      board.rotation.y = -Math.PI / 2;
      field.group.add(board);
      field.scoreCanvas = canvas;
      field.scoreContext = canvas.getContext('2d');
      field.scoreTexture = texture;
      field.scoreBoard = board;
      updateSoccerScoreboard(field);
    }

    function updateSoccerScoreboard(field) {
      if (!field.scoreContext) return;
      const context = field.scoreContext;
      context.fillStyle = '#101b1c';
      context.fillRect(0, 0, 512, 256);
      context.strokeStyle = '#c5a762';
      context.lineWidth = 12;
      context.strokeRect(8, 8, 496, 240);
      context.fillStyle = '#f5f4e9';
      context.textAlign = 'center';
      context.font = 'bold 34px sans-serif';
      context.fillText('LIVE SOCCER', 256, 58);
      context.font = 'bold 70px sans-serif';
      context.fillStyle = '#49a8e8';
      context.fillText(String(field.score[0]), 145, 157);
      context.fillStyle = '#ed695e';
      context.fillText(String(field.score[1]), 367, 157);
      context.fillStyle = '#f5f4e9';
      context.font = 'bold 48px sans-serif';
      context.fillText('-', 256, 156);
      context.font = '24px sans-serif';
      context.fillText('BLUE        RED  |  NO TIME LIMIT', 256, 211);
      field.scoreTexture.needsUpdate = true;
    }

    function createSoccerField(site, index, hasMatch) {
      const field = {
        x: site.x,
        z: site.z,
        group: new THREE.Group(),
        length: 56,
        width: 36,
        halfLength: 28,
        halfWidth: 18,
        fenceMaterial: new THREE.MeshStandardMaterial({ color: 0x263b36, metalness: 0.48, roughness: 0.42 }),
        score: [0, 0],
        players: [],
        spectators: [],
        ballVelocity: new THREE.Vector3(),
        matchSeconds: 0,
        spectatorGateX: -26,
        hasMatch,
        index
      };
      field.group.position.set(field.x, 0, field.z);
      cityRoot.add(field.group);
      soccerFields.push(field);

      for (let stripe = 0; stripe < 7; stripe++) {
        const grass = new THREE.Mesh(
          new THREE.BoxGeometry(field.length / 7, 0.12, field.width),
          new THREE.MeshStandardMaterial({ color: stripe % 2 ? 0x367849 : 0x408553, roughness: 0.96 })
        );
        grass.position.set(-field.halfLength + field.length / 14 + stripe * field.length / 7, 0.06, 0);
        field.group.add(grass);
      }
      const addMarking = (width, depth, x, z) => {
        const marking = new THREE.Mesh(new THREE.BoxGeometry(width, 0.035, depth), new THREE.MeshBasicMaterial({ color: 0xf3f3dc }));
        marking.position.set(x, 0.14, z);
        field.group.add(marking);
      };
      addMarking(field.length, 0.14, 0, -field.halfWidth + 0.07);
      addMarking(field.length, 0.14, 0, field.halfWidth - 0.07);
      addMarking(0.14, field.width, -field.halfLength + 0.07, 0);
      addMarking(0.14, field.width, field.halfLength - 0.07, 0);
      addMarking(0.12, field.width, 0, 0);
      const centerCircle = new THREE.Mesh(
        new THREE.RingGeometry(5.7, 5.85, 56),
        new THREE.MeshBasicMaterial({ color: 0xf3f3dc, side: THREE.DoubleSide })
      );
      centerCircle.rotation.x = -Math.PI / 2;
      centerCircle.position.y = 0.15;
      field.group.add(centerCircle);
      [-1, 1].forEach((end) => {
        addMarking(8, 0.12, end * (field.halfLength - 4), -12);
        addMarking(8, 0.12, end * (field.halfLength - 4), 12);
        addMarking(0.12, 24, end * (field.halfLength - 8), 0);
        addMarking(0.12, 12, end * (field.halfLength - 2), 0);
        addSoccerGoal(field, end);
      });

      const fenceX = 34;
      const fenceFront = -37;
      const fenceBack = 23;
      const gateHalfWidth = 2.2;
      const gateX = field.spectatorGateX;
      createSoccerFenceRun(field, -fenceX, fenceFront, gateX - gateHalfWidth, fenceFront);
      createSoccerFenceRun(field, gateX + gateHalfWidth, fenceFront, fenceX, fenceFront);
      createSoccerFenceRun(field, -fenceX, fenceFront, -fenceX, fenceBack);
      createSoccerFenceRun(field, fenceX, fenceFront, fenceX, fenceBack);
      createSoccerFenceRun(field, -fenceX, fenceBack, fenceX, fenceBack);
      [-1, 1].forEach((side) => {
        const gatePost = new THREE.Mesh(new THREE.BoxGeometry(0.24, 2.5, 0.24), field.fenceMaterial);
        gatePost.position.set(gateX + side * gateHalfWidth, 1.25, fenceFront);
        field.group.add(gatePost);
      });

      if (hasMatch) {
        const standMaterial = new THREE.MeshStandardMaterial({ color: 0x707a7a, metalness: 0.38, roughness: 0.65 });
        [-33, -28].forEach((z, row) => {
          const tier = new THREE.Mesh(new THREE.BoxGeometry(48, 0.55, 3.1), standMaterial);
          tier.position.set(0, row ? 1.05 : 0.55, z);
          field.group.add(tier);
        });
        const seatOffsets = [-19, -11.5, -4, 4, 11.5, 19];
        seatOffsets.forEach((x, index) => {
          const row = index % 2;
          const z = row ? -32 : -27;
          const spectator = createSoccerPerson(field, x, z, [0xc9563e, 0x285e91, 0xd5b54c, 0x4d7754][index % 4]);
          spectator.mesh.position.y = row ? 1.05 : 0.55;
          spectator.mesh.scale.setScalar(0.72);
          spectator.mesh.rotation.y = Math.PI;
          spectator.leftLeg.rotation.x = -1.1;
          spectator.rightLeg.rotation.x = -1.1;
          spectator.leftArm.rotation.x = -0.25;
          spectator.rightArm.rotation.x = -0.25;
          field.spectators.push(spectator);
          const secondRowSpectator = createSoccerPerson(field, x + (x < 0 ? 1.2 : -1.2), -35, [0x506f90, 0xd17643, 0x7b548b, 0x7a8645][index % 4]);
          secondRowSpectator.mesh.position.y = 1.5;
          secondRowSpectator.mesh.scale.setScalar(0.72);
          secondRowSpectator.mesh.rotation.y = Math.PI;
          secondRowSpectator.leftLeg.rotation.x = -1.1;
          secondRowSpectator.rightLeg.rotation.x = -1.1;
          field.spectators.push(secondRowSpectator);
        });

        const coach = createSoccerPerson(field, -30, -21, 0xd18d36, 0x263941);
        coach.soccerCoach = true;
        coach.mesh.rotation.y = 0;
        field.coach = coach;

        for (let team = 0; team < 2; team++) {
          const shirtColor = team === 0 ? 0x287db5 : 0xb83f3d;
          const formation = [[-23, 0], [-17, -12], [-17, 0], [-17, 12], [-7, -12], [-7, 0], [-7, 12]];
          formation.forEach(([baseX, z], roleIndex) => {
            const attackDirection = team === 0 ? 1 : -1;
            const player = createSoccerPerson(field, baseX * attackDirection, z, shirtColor, 0xf1f1eb);
            player.soccerTeam = team;
            player.soccerRole = roleIndex === 0 ? 'keeper' : 'field';
            player.soccerHome = new THREE.Vector2(baseX * attackDirection, z);
            player.soccerKickReadyAt = 0;
            field.players.push(player);
          });
        }
        const referee = createSoccerPerson(field, 0, 0, 0x202326, 0xf4f4ed);
        const refereeStripe = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.7, 0.04), new THREE.MeshBasicMaterial({ color: 0xf4f4ed }));
        refereeStripe.position.set(0, 1.2, 0.25);
        referee.mesh.add(refereeStripe);
        field.referee = referee;

        const ball = new THREE.Mesh(new THREE.SphereGeometry(0.62, 20, 14), new THREE.MeshStandardMaterial({ color: 0xf4f4ea, roughness: 0.68 }));
        ball.position.set(0, 0.68, 0);
        field.group.add(ball);
        field.ball = ball;
        createSoccerScoreboard(field);
      }
      return field;
    }

    function createSoccerFields() {
      const anchors = [[-450, -250], [450, -250], [0, 470], [-460, 450], [460, 450], [0, -450]];
      anchors.forEach(([targetX, targetZ]) => {
        if (soccerFields.length >= 3) return;
        const site = reserveSoccerFieldSite(targetX, targetZ);
        if (!site) return;
        const field = createSoccerField(site, soccerFields.length, !activeSoccerField);
        if (field.hasMatch) activeSoccerField = field;
      });
    }

    function scoreSoccerGoal(field, team) {
      field.score[team]++;
      field.ball.position.set(0, 0.68, 0);
      field.ballVelocity.set(0, 0, 0);
      field.ballLastKickedAt = performance.now();
      updateSoccerScoreboard(field);
      showMessage((team === 0 ? 'Blue' : 'Red') + ' scores! ' + field.score[0] + ' - ' + field.score[1]);
    }

    function moveSoccerPerson(person, targetX, targetZ, dt, speed) {
      const target = new THREE.Vector3(targetX, 0, targetZ);
      const direction = target.sub(person.mesh.position);
      const distance = direction.length();
      if (distance > 0.35) {
        direction.normalize();
        const step = Math.min(distance, speed * dt);
        person.mesh.position.x += direction.x * step;
        person.mesh.position.z += direction.z * step;
        person.mesh.rotation.y = Math.atan2(direction.x, direction.z);
        person.walkPhase += dt * 9;
        const swing = Math.sin(person.walkPhase) * 0.55;
        person.leftArm.rotation.x = swing;
        person.rightArm.rotation.x = -swing;
        person.leftLeg.rotation.x = -swing;
        person.rightLeg.rotation.x = swing;
      } else {
        person.leftArm.rotation.x *= 0.8;
        person.rightArm.rotation.x *= 0.8;
        person.leftLeg.rotation.x *= 0.8;
        person.rightLeg.rotation.x *= 0.8;
      }
    }

    function updateSoccerMatch(field, dt, now) {
      if (!field.hasMatch || !field.ball) return;
      field.matchSeconds += dt;
      const ballX = field.ball.position.x;
      const ballZ = field.ball.position.z;
      const nearestByTeam = [null, null];
      field.players.forEach((player) => {
        const distance = Math.hypot(player.mesh.position.x - field.x - ballX, player.mesh.position.z - field.z - ballZ);
        const current = nearestByTeam[player.soccerTeam];
        if (!current || distance < current.distance) nearestByTeam[player.soccerTeam] = { player, distance };
      });

      field.players.forEach((player) => {
        const direction = player.soccerTeam === 0 ? 1 : -1;
        const isChaser = nearestByTeam[player.soccerTeam]?.player === player;
        let targetX;
        let targetZ;
        if (player.soccerRole === 'keeper') {
          targetX = direction * (field.halfLength - 4.5) + ballX * 0.06;
          targetZ = THREE.MathUtils.clamp(ballZ * 0.42, -9, 9);
        } else if (isChaser) {
          targetX = ballX - direction * 1.6;
          targetZ = ballZ;
        } else {
          targetX = player.soccerHome.x + ballX * 0.14;
          targetZ = player.soccerHome.y + ballZ * 0.18;
        }
        targetX = field.x + THREE.MathUtils.clamp(targetX, -field.halfLength + 2, field.halfLength - 2);
        targetZ = field.z + THREE.MathUtils.clamp(targetZ, -field.halfWidth + 2, field.halfWidth - 2);
        moveSoccerPerson(player, targetX, targetZ, dt, isChaser ? 5.1 : 3.8);

        const distanceToBall = Math.hypot(player.mesh.position.x - (field.x + ballX), player.mesh.position.z - (field.z + ballZ));
        if (distanceToBall < 1.35 && now >= (player.soccerKickReadyAt || 0) && now >= (field.ballLastKickedAt || 0) + 350) {
          const targetGoalX = field.x + direction * (field.halfLength + 3);
          const targetGoalZ = field.z + (Math.random() - 0.5) * 7;
          const shot = new THREE.Vector3(targetGoalX - field.ball.position.x - field.x, 0, targetGoalZ - field.ball.position.z - field.z).normalize();
          const kickSpeed = 15 + Math.random() * 5;
          field.ballVelocity.set(shot.x * kickSpeed, 0, shot.z * kickSpeed);
          field.ballLastKickedAt = now;
          player.soccerKickReadyAt = now + 1000;
        }
      });

      if (!controlledVehicle && !controlledAirplane && !playerState.boat) {
        const ballWorldX = field.x + field.ball.position.x;
        const ballWorldZ = field.z + field.ball.position.z;
        const distanceToPlayer = Math.hypot(playerState.position.x - ballWorldX, playerState.position.z - ballWorldZ);
        const moving = walkKeys.forward || walkKeys.backward || walkKeys.left || walkKeys.right || walkKeys.sprint;
        if (moving && distanceToPlayer < 1.8 && now >= (field.playerKickReadyAt || 0)) {
          const forward = new THREE.Vector3(Math.sin(playerState.yaw), 0, Math.cos(playerState.yaw));
          const side = new THREE.Vector3(Math.cos(playerState.yaw), 0, -Math.sin(playerState.yaw));
          const impulse = new THREE.Vector3();
          if (walkKeys.forward) impulse.add(forward);
          if (walkKeys.backward) impulse.sub(forward);
          if (walkKeys.right) impulse.add(side);
          if (walkKeys.left) impulse.sub(side);
          if (impulse.lengthSq() < 0.01) impulse.copy(forward);
          impulse.normalize();
          field.ballVelocity.set(impulse.x * (walkKeys.sprint ? 21 : 16), 0, impulse.z * (walkKeys.sprint ? 21 : 16));
          field.ballLastKickedAt = now;
          field.playerKickReadyAt = now + 450;
        }
      }

      const refereeTargetX = field.x + THREE.MathUtils.clamp(ballX * 0.28, -9, 9);
      const refereeTargetZ = field.z + THREE.MathUtils.clamp(ballZ + 4, -field.halfWidth + 3, field.halfWidth - 3);
      moveSoccerPerson(field.referee, refereeTargetX, refereeTargetZ, dt, 4.3);

      field.ballVelocity.multiplyScalar(Math.exp(-0.25 * dt));
      field.ball.position.x += field.ballVelocity.x * dt;
      field.ball.position.z += field.ballVelocity.z * dt;
      const crossedRightGoal = field.ball.position.x >= field.halfLength - 0.7 && field.ballVelocity.x > 0;
      const crossedLeftGoal = field.ball.position.x <= -field.halfLength + 0.7 && field.ballVelocity.x < 0;
      if ((crossedRightGoal || crossedLeftGoal) && Math.abs(field.ball.position.z) < 5.1) {
        scoreSoccerGoal(field, crossedRightGoal ? 0 : 1);
        return;
      }
      if (Math.abs(field.ball.position.x) > field.halfLength - 0.7) {
        field.ball.position.x = Math.sign(field.ball.position.x) * (field.halfLength - 0.7);
        field.ballVelocity.x *= -0.62;
      }
      if (Math.abs(field.ball.position.z) > field.halfWidth - 0.7) {
        field.ball.position.z = Math.sign(field.ball.position.z) * (field.halfWidth - 0.7);
        field.ballVelocity.z *= -0.62;
      }
    }

    function updateSoccerFields(dt, now) {
      soccerFields.forEach((field) => updateSoccerMatch(field, dt, now));
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
      createPrison();

      const parkingSpots = [];
      for (let i = 0; i < cityGoals.targetParkedCars; i++) {
        const col = i % 6;
        const row = Math.floor(i / 6);
        const x = (col - 2.5) * 18 + 12;
        const z = (row - 1.5) * 22 + 130;
        parkingSpots.push({ x, z });
      }
      parkingSpots.forEach((spot) => {
        const style = getRandomCivilianCarStyle();
        const car = createCar(spot.x, spot.z, style.color, false, true, style.type);
        car.mesh.rotation.y = Math.PI / 2; car.body.position.set(spot.x, 1.1, spot.z); car.mesh.position.copy(car.body.position);
      });
      [-510, -390, 390, 510].forEach((bx) => {
        [-510, -390, 390, 510].forEach((bz) => {
          for (const side of [-1, 1]) {
            const x = bx + side * 25;
            const z = bz + 24;
            const style = getRandomCivilianCarStyle();
            const parked = createCar(x, z, style.color, false, true, style.type);
            parked.mesh.rotation.y = Math.PI / 2;
            parked.body.position.set(x, 1.1, z);
            parked.mesh.position.copy(parked.body.position);
          }
        });
      });
      createRoadsideParking(486);
      createParkedMotorcycles(25);

      createRamp(0, 128, 12, 8, 1.6, 0);
      createRamp(-32, 140, 12, 9, 1.7, Math.PI / 3);
      createRamp(32, 140, 12, 9, 1.7, -Math.PI / 3);
      createRoad(535, 540, 58, 34);
      debrisPlowVehicle = createCar(535, 540, 0xe6a719, false, true, 'plow');
      debrisPlowVehicle.jobRole = 'debris-plow';
      debrisPlowVehicle.jobHome = { x: 535, z: 540 };
      debrisPlowVehicle.jobPhase = 'ready';
      debrisPlowVehicle.mesh.rotation.y = Math.PI;
      debrisPlowVehicle.body.position.set(535, 1.2, 540);
      debrisPlowVehicle.mesh.position.copy(debrisPlowVehicle.body.position);
      buildNavigationGraph();
      createIntersectionSignage();
      createRaceTrack();
      createSoccerFields();

      [
        { type: 'sedan', x: -8, z: 22 }, { type: 'taxi', x: 0, z: 22 }, { type: 'sports', x: 8, z: 22 }
      ].forEach((spec) => { const car = createCar(spec.x, spec.z, 0x60a5fa, false, true, spec.type); car.mesh.rotation.y = 0; });
      [
        { x: 18, z: -18, size: 1.5 }, { x: -18, z: 18, size: 1.9 }, { x: 36, z: 18, size: 1.7 }, { x: -36, z: -18, size: 1.8 },
        { x: 10, z: 56, size: 1.6 }, { x: -12, z: -54, size: 1.8 }
      ].forEach((spec) => createBreakableCrate(spec.x, spec.z, spec.size, 0x8b5d3c, 3));
      const trafficCount = (webOptimizer.lowLag ? 14 : 24) * 10;
      for (let i = 0; i < trafficCount; i++) npcCars.push(createNPCCar());
      for (let i = 0; i < 14; i++) npcCars.push(createNPCCar('motorcycle'));
      addBoundaryZones();
      createPeople();
      createPrisonPopulation(18);
      createPrisonGuards(12);
      createBillionaireEstate();
      createJanitors(14);
      entityPopulation = people.slice();
      createBoats();
      createBirdPopulation(150);
    }

    function updateDayNightCycle(now) {
      if (!gameStarted) return;
      if (dayNightCycleStartedAt === null) dayNightCycleStartedAt = now;
      const cycleLength = DAY_DURATION_SECONDS + NIGHT_DURATION_SECONDS;
      const cycleTime = ((now - dayNightCycleStartedAt) / 1000) % cycleLength;
      const transitionSeconds = 10;
      const smoothStep = (value) => value * value * (3 - 2 * value);
      if (cycleTime < DAY_DURATION_SECONDS - transitionSeconds) {
        nightIntensity = 0;
      } else if (cycleTime < DAY_DURATION_SECONDS) {
        nightIntensity = smoothStep((cycleTime - DAY_DURATION_SECONDS + transitionSeconds) / transitionSeconds);
      } else if (cycleTime < cycleLength - transitionSeconds) {
        nightIntensity = 1;
      } else {
        nightIntensity = 1 - smoothStep((cycleTime - cycleLength + transitionSeconds) / transitionSeconds);
      }

      scene.background.copy(daySkyColor).lerp(nightSkyColor, nightIntensity);
      scene.fog.color.copy(daySkyColor).lerp(nightSkyColor, nightIntensity);
      if (hemisphereLight) hemisphereLight.intensity = THREE.MathUtils.lerp(1.15, 0.34, nightIntensity);
      if (sunLight) sunLight.intensity = THREE.MathUtils.lerp(1.3, 0.08, nightIntensity);
      if (Math.abs(nightIntensity - lastWindowLightingIntensity) < 0.004) return;
      lastWindowLightingIntensity = nightIntensity;
      buildingWindowMaterials.forEach(({ material, nightLevel }) => {
        material.emissive.copy(dayWindowColor).lerp(nightWindowColor, nightIntensity);
        material.emissiveIntensity = THREE.MathUtils.lerp(0.14, nightLevel, nightIntensity);
      });
    }

    function updateNpcFlashlights(now) {
      if (dayNightCycleStartedAt === null) return;
      const night = nightIntensity > 0.25;
      const nightCycle = Math.floor((now - dayNightCycleStartedAt) / ((DAY_DURATION_SECONDS + NIGHT_DURATION_SECONDS) * 1000));
      const updatePersonFlashlight = (person) => {
        if (!person || !person.mesh) return;
        if (!night || !person.active) {
          if (person.flashlightRig) person.flashlightRig.visible = false;
          return;
        }
        const task = person.task || '';
        const ridingOrDriving = person.ridingBoat || person.mesh.parent !== scene || /driver|pilot|boat-/i.test(task);
        const position = person.mesh.position;
        const indoors = buildingColliders.some((building) =>
          !building.collapsing && position.y < building.height &&
          position.x > building.minX + 0.8 && position.x < building.maxX - 0.8 &&
          position.z > building.minZ + 0.8 && position.z < building.maxZ - 0.8
        );
        const eligible = !ridingOrDriving && !indoors;
        if (night && eligible && person.flashlightNightCycle !== nightCycle) {
          person.flashlightNightCycle = nightCycle;
          person.hasNightFlashlight = Math.random() < 0.5;
        }
        if (person.hasNightFlashlight && !person.flashlightRig) {
          const rig = new THREE.Group();
          const body = new THREE.Mesh(npcFlashlightBodyGeometry, npcFlashlightBodyMaterial);
          body.rotation.x = Math.PI / 2;
          body.position.z = 0.12;
          const lens = new THREE.Mesh(npcFlashlightLensGeometry, npcFlashlightLensMaterial);
          lens.position.z = 0.34;
          const beam = new THREE.Mesh(npcFlashlightBeamGeometry, npcFlashlightBeamMaterial);
          beam.rotation.x = Math.PI / 2;
          beam.position.z = 2.35;
          rig.add(body, lens, beam);
          rig.position.set(0, -0.55, 0.18);
          person.rightArm.add(rig);
          person.flashlightRig = rig;
        }
        if (person.flashlightRig) {
          person.flashlightRig.visible = night && eligible && !!person.hasNightFlashlight;
          if (person.flashlightRig.visible) person.rightArm.rotation.x = -0.7;
        }
      };
      people.forEach(updatePersonFlashlight);
      soccerFields.forEach((field) => {
        field.players.forEach(updatePersonFlashlight);
        field.spectators.forEach(updatePersonFlashlight);
        updatePersonFlashlight(field.coach);
        updatePersonFlashlight(field.referee);
      });
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
      updateDayNightCycle(frameTime);
      world.broadphase.dirty = true;
      world.step(1 / 60, dt, 3);
      updateBuildingDebris();
      updateVehicleDebris(dt);
      updateFallingDrivers(dt);
      updateFallingTreeTops(dt, frameTime);
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
      updateBirds(dt, frameTime);
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
      updateJobVehicleRespawns(dt, frameTime); updateNPCs(dt); updatePoliceAI(dt, frameTime); updateRaceTrack(dt, frameTime); updateSoccerFields(dt, frameTime); updateTireTracks(frameTime); updateCrashEffects(dt, frameTime); updateHumans(dt); updateNpcFlashlights(frameTime); updatePrisonEncounters(frameTime); updateBillionaireEstate(dt, frameTime); updateBuildingWorkers(frameTime); updateFootprints(frameTime); triggerInputConflict(); updatePlayerFromVehicle(); updatePlayerCharacter(); if (gameSettings.cornerMap) updateMinimap(); updateSpeedometer(); updateMobileControls(); renderer.render(scene, camera); requestAnimationFrame(tick);
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
      if (event.code === 'KeyM' && !event.repeat) spawnPlayerMotorcycle();
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
        if (!maybePunchBirdAtPointer(event)) handleLinkedEntitySelection(event);
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
          if (!maybePunchBirdAtPointer(event)) handleLinkedEntitySelection(event);
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
      hemisphereLight = new THREE.HemisphereLight(0xdfeeff, 0x4d5d3d, 1.15); scene.add(hemisphereLight);
      sunLight = new THREE.DirectionalLight(0xfff7d6, 1.3); sunLight.position.set(30, 70, 40); sunLight.castShadow = true; sunLight.shadow.mapSize.set(2048, 2048); sunLight.shadow.camera.left = -120; sunLight.shadow.camera.right = 120; sunLight.shadow.camera.top = 120; sunLight.shadow.camera.bottom = -120; scene.add(sunLight);
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
