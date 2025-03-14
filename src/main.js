import * as THREE from 'three';

// Add at the beginning of the file, after imports
let ws;
let playerId;
const otherPlayers = new Map();
let playerName = '';

// Add login screen handling
const loginScreen = document.getElementById('loginScreen');
const playerNameInput = document.getElementById('playerName');
const startButton = document.getElementById('startButton');
const playersListDiv = document.getElementById('playersList');

function startGame() {
    playerName = playerNameInput.value.trim();
    if (playerName) {
        connectToServer();
        loginScreen.style.display = 'none';
    }
}

startButton.addEventListener('click', startGame);

// Add Enter key support
playerNameInput.addEventListener('keypress', (event) => {
    if (event.key === 'Enter') {
        event.preventDefault(); // Prevent form submission
        startGame();
    }
});

function connectToServer() {
    ws = new WebSocket(`ws://${window.location.hostname}:3000`);

    ws.onopen = () => {
        console.log('Connected to server');
        ws.send(JSON.stringify({
            type: 'join',
            name: playerName
        }));
    };

    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        handleServerMessage(data);
    };

    ws.onclose = () => {
        console.log('Disconnected from server');
    };
}

function handleServerMessage(data) {
    switch (data.type) {
        case 'joined':
            playerId = data.id;
            // Add existing players
            data.players.forEach(player => {
                if (player.id !== playerId) {
                    addOtherPlayer(player);
                }
            });
            updatePlayersList();
            break;

        case 'playerJoined':
            if (data.id !== playerId) {
                addOtherPlayer({
                    id: data.id,
                    name: data.name,
                    position: { x: 0, y: 0.5, z: 0 },
                    rotation: { x: 0, y: 0, z: 0 }
                });
                updatePlayersList();
            }
            break;

        case 'playerUpdate':
            if (data.id !== playerId) {
                updateOtherPlayer(data);
            }
            break;

        case 'playerLeft':
            if (data.id !== playerId) {
                removeOtherPlayer(data.id);
                updatePlayersList();
            }
            break;

        case 'playerShoot':
            if (data.id !== playerId) {
                handleOtherPlayerShoot(data);
            }
            break;
    }
}

function addOtherPlayer(playerData) {
    const otherCar = createCar();
    otherCar.position.copy(playerData.position);
    otherCar.rotation.copy(playerData.rotation);
    
    // Add player name above car
    const nameDiv = document.createElement('div');
    nameDiv.style.position = 'absolute';
    nameDiv.style.color = 'white';
    nameDiv.style.padding = '5px';
    nameDiv.style.background = 'rgba(0, 0, 0, 0.5)';
    nameDiv.style.borderRadius = '5px';
    nameDiv.style.fontFamily = 'Arial';
    nameDiv.style.fontSize = '12px';
    nameDiv.textContent = playerData.name;
    
    otherPlayers.set(playerData.id, {
        car: otherCar,
        name: playerData.name,
        nameDiv: nameDiv,
        score: playerData.score || 0
    });
    
    scene.add(otherCar);
    document.body.appendChild(nameDiv);
}

function updateOtherPlayer(data) {
    const player = otherPlayers.get(data.id);
    if (player) {
        player.car.position.copy(data.position);
        player.car.rotation.copy(data.rotation);
        player.score = data.score;
        updatePlayerNamePosition(data.id);
        updatePlayersList();
    }
}

function removeOtherPlayer(id) {
    const player = otherPlayers.get(id);
    if (player) {
        scene.remove(player.car);
        document.body.removeChild(player.nameDiv);
        otherPlayers.delete(id);
    }
}

function updatePlayerNamePosition(id) {
    const player = otherPlayers.get(id);
    if (player) {
        const vector = player.car.position.clone();
        vector.y += 3;
        vector.project(camera);
        
        const x = (vector.x * 0.5 + 0.5) * window.innerWidth;
        const y = (-vector.y * 0.5 + 0.5) * window.innerHeight;
        
        player.nameDiv.style.transform = `translate(${x}px, ${y}px)`;
    }
}

function updatePlayersList() {
    if (!playersListDiv) return;

    // Get all players including the current player
    const allPlayers = [...otherPlayers.entries()].map(([id, player]) => ({
        id,
        name: player.name,
        score: player.score
    }));
    
    // Add current player
    allPlayers.push({
        id: playerId,
        name: playerName + ' (You)',
        score: state.score
    });

    // Sort players by score in descending order
    allPlayers.sort((a, b) => b.score - a.score);

    // Update the players list div styling
    playersListDiv.style.position = 'fixed';
    playersListDiv.style.top = '20px';
    playersListDiv.style.right = '20px';
    playersListDiv.style.padding = '15px';
    playersListDiv.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
    playersListDiv.style.color = 'white';
    playersListDiv.style.fontFamily = 'Arial, sans-serif';
    playersListDiv.style.fontSize = '16px';
    playersListDiv.style.borderRadius = '10px';
    playersListDiv.style.boxShadow = '0 0 10px rgba(0,0,0,0.5)';
    playersListDiv.style.minWidth = '200px';
    playersListDiv.style.zIndex = '1000';

    // Create the HTML content
    let html = `
        <div style="font-weight: bold; margin-bottom: 10px; text-align: center; border-bottom: 1px solid rgba(255,255,255,0.3); padding-bottom: 5px;">
            Player Rankings
        </div>
    `;

    // Add each player with their rank
    allPlayers.forEach((player, index) => {
        const rank = index + 1;
        const isCurrentPlayer = player.name.includes('(You)');
        const rankColor = rank === 1 ? '#ffd700' : rank === 2 ? '#c0c0c0' : rank === 3 ? '#cd7f32' : 'white';
        
        html += `
            <div style="
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 5px 0;
                ${isCurrentPlayer ? 'font-weight: bold; color: #00ff00;' : ''}
                margin: 2px 0;
            ">
                <span style="color: ${rankColor};">#${rank}</span>
                <span style="margin: 0 10px; flex-grow: 1;">${player.name}</span>
                <span>${player.score}</span>
            </div>
        `;
    });

    playersListDiv.innerHTML = html;
}

function handleOtherPlayerShoot(data) {
    const direction = new THREE.Vector3(
        data.direction.x,
        data.direction.y,
        data.direction.z
    );
    createBullet(data.position, direction);
}

// Modify the animate function to send updates
function sendUpdate() {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
            type: 'update',
            position: car.position,
            rotation: car.rotation,
            score: state.score
        }));
    }
}

// Modify handleShooting function to broadcast shots
const originalHandleShooting = handleShooting;
handleShooting = function() {
    if (keys[' '] && Date.now() - state.lastShootTime > state.shootCooldown) {
        const direction = new THREE.Vector3(
            Math.sin(car.rotation.y),
            0,
            Math.cos(car.rotation.y)
        );
        
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
                type: 'shoot',
                position: car.position.clone(),
                direction: direction
            }));
        }
        
        createBullet(car.position.clone(), direction);
        state.lastShootTime = Date.now();
    }
};

// Modify the animate function to update other players' name positions
const originalAnimate = animate;
animate = function() {
    originalAnimate();
    
    // Update other players' name positions
    otherPlayers.forEach((player, id) => {
        updatePlayerNamePosition(id);
    });
    
    // Send position updates to server
    sendUpdate();
};

// Scene setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x87CEEB); // Sky blue color
document.body.appendChild(renderer.domElement);

// Basic lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(10, 20, 10);
scene.add(directionalLight);

// Sun
const sunGeometry = new THREE.SphereGeometry(10, 32, 32);
const sunMaterial = new THREE.MeshBasicMaterial({
    color: 0xffff00,
    emissive: 0xffff00,
    emissiveIntensity: 1
});
const sun = new THREE.Mesh(sunGeometry, sunMaterial);
sun.position.set(100, 200, 100);
scene.add(sun);

// Moon
const moonGeometry = new THREE.SphereGeometry(8, 32, 32);
const moonMaterial = new THREE.MeshBasicMaterial({
    color: 0xDCDCDC,
    emissive: 0xDCDCDC,
    emissiveIntensity: 0.8
});
const moon = new THREE.Mesh(moonGeometry, moonMaterial);
moon.position.set(-100, 200, -100);
scene.add(moon);

// Constants
const BLOCK_SIZE = 50;
const ROAD_WIDTH = 10;
const CHUNK_SIZE = 200;
const VIEW_DISTANCE = 1;
const BULLET_SPEED = 2;
const BULLET_LIFETIME = 2000; // milliseconds
const MOUNTAIN_COUNT = 3; // Mountains per chunk
const MOUNTAIN_MIN_HEIGHT = 10;
const MOUNTAIN_MAX_HEIGHT = 30;

// Ground chunks
const groundChunks = new Map();

function createMountain(x, z) {
    const mountain = new THREE.Group();
    
    const height = MOUNTAIN_MIN_HEIGHT + Math.random() * (MOUNTAIN_MAX_HEIGHT - MOUNTAIN_MIN_HEIGHT);
    const baseWidth = height * 1.5;
    const segments = 4;
    
    const mountainGeometry = new THREE.ConeGeometry(baseWidth, height, segments);
    const mountainMaterial = new THREE.MeshStandardMaterial({
        color: 0x4a5d23,  // Darker green
        roughness: 0.8
    });
    
    const mountainMesh = new THREE.Mesh(mountainGeometry, mountainMaterial);
    mountainMesh.position.y = height/2;
    mountain.add(mountainMesh);
    
    // Add snow cap
    const snowCapHeight = height * 0.2;
    const snowCapGeometry = new THREE.ConeGeometry(baseWidth * 0.3, snowCapHeight, segments);
    const snowCapMaterial = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.6
    });
    
    const snowCap = new THREE.Mesh(snowCapGeometry, snowCapMaterial);
    snowCap.position.y = height - snowCapHeight/2;
    mountain.add(snowCap);
    
    mountain.position.set(x, 0, z);
    return mountain;
}

function createGroundChunk(chunkX, chunkZ) {
    const key = `${chunkX},${chunkZ}`;
    if (groundChunks.has(key)) return;

    const chunk = {
        ground: null,
        roads: [],
        buildings: [],
        mountains: []
    };

    // Create ground
    const groundGeometry = new THREE.PlaneGeometry(CHUNK_SIZE, CHUNK_SIZE);
    const groundMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x2d5a27,
        roughness: 0.8
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(chunkX * CHUNK_SIZE, 0, chunkZ * CHUNK_SIZE);
    scene.add(ground);
    chunk.ground = ground;

    // Add mountains before roads and buildings
    for (let i = 0; i < MOUNTAIN_COUNT; i++) {
        const offsetX = (Math.random() - 0.5) * (CHUNK_SIZE - MOUNTAIN_MAX_HEIGHT * 2);
        const offsetZ = (Math.random() - 0.5) * (CHUNK_SIZE - MOUNTAIN_MAX_HEIGHT * 2);
        const mountainX = chunkX * CHUNK_SIZE + offsetX;
        const mountainZ = chunkZ * CHUNK_SIZE + offsetZ;
        
        // Check if mountain is too close to roads
        if (Math.abs(offsetX % BLOCK_SIZE) > ROAD_WIDTH * 2 && 
            Math.abs(offsetZ % BLOCK_SIZE) > ROAD_WIDTH * 2) {
            const mountain = createMountain(mountainX, mountainZ);
            scene.add(mountain);
            chunk.mountains.push(mountain);
        }
    }

    // Create roads
    createRoadsForChunk(chunkX, chunkZ, chunk);
    createBuildingsForChunk(chunkX, chunkZ, chunk);

    groundChunks.set(key, chunk);
}

// Roads
function createRoadsForChunk(chunkX, chunkZ, chunk) {
    const startX = chunkX * CHUNK_SIZE;
    const startZ = chunkZ * CHUNK_SIZE;
    const numBlocks = Math.floor(CHUNK_SIZE / BLOCK_SIZE);
    
    const roadMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x333333,
        roughness: 0.8
    });

    for (let i = 0; i <= numBlocks; i++) {
        if (i % 2 === 0) {
            // Horizontal roads
            const roadH = new THREE.Mesh(
                new THREE.PlaneGeometry(CHUNK_SIZE, ROAD_WIDTH),
                roadMaterial
            );
            roadH.rotation.x = -Math.PI / 2;
            roadH.position.set(startX, 0.01, startZ - CHUNK_SIZE/2 + i * BLOCK_SIZE);
            scene.add(roadH);
            chunk.roads.push(roadH);

            // Vertical roads
            const roadV = new THREE.Mesh(
                new THREE.PlaneGeometry(ROAD_WIDTH, CHUNK_SIZE),
                roadMaterial
            );
            roadV.rotation.x = -Math.PI / 2;
            roadV.position.set(startX - CHUNK_SIZE/2 + i * BLOCK_SIZE, 0.01, startZ);
            scene.add(roadV);
            chunk.roads.push(roadV);
        }
    }
}

// After the basic lighting setup
// Day/Night cycle
const DAY_DURATION = 60000; // 60 seconds for a full day/night cycle
let dayTime = 0;

function updateDayNightCycle(deltaTime) {
    dayTime = (dayTime + deltaTime) % DAY_DURATION;
    const cycleProgress = dayTime / DAY_DURATION;
    const angle = cycleProgress * Math.PI * 2;
    
    // Update sun position
    sun.position.x = Math.cos(angle) * 300;
    sun.position.y = Math.sin(angle) * 300;
    sun.position.z = 0;
    
    // Update moon position (opposite to sun)
    moon.position.x = -Math.cos(angle) * 300;
    moon.position.y = -Math.sin(angle) * 300;
    moon.position.z = 0;
    
    // Update lighting
    const dayIntensity = Math.max(0, Math.sin(angle));
    const nightIntensity = 0.2;
    directionalLight.intensity = dayIntensity * 0.8;
    ambientLight.intensity = dayIntensity * 0.4 + nightIntensity;
    
    // Update sky color
    const dayColor = new THREE.Color(0x87CEEB);
    const nightColor = new THREE.Color(0x1a1a2a);
    const skyColor = new THREE.Color();
    skyColor.lerpColors(nightColor, dayColor, dayIntensity);
    renderer.setClearColor(skyColor);
}

// Airplane class
class Airplane {
    constructor() {
        this.object = this.createAirplane();
        this.speed = 1 + Math.random() * 0.5;
        this.height = 50 + Math.random() * 50;
        this.direction = Math.random() * Math.PI * 2;
        this.turnSpeed = (Math.random() - 0.5) * 0.02;
        this.updateTargetPosition();
    }

    createAirplane() {
        const airplane = new THREE.Group();

        // Fuselage
        const fuselageGeometry = new THREE.CylinderGeometry(0.5, 0.5, 4, 8);
        const fuselageMaterial = new THREE.MeshStandardMaterial({ color: 0xcccccc });
        const fuselage = new THREE.Mesh(fuselageGeometry, fuselageMaterial);
        fuselage.rotation.z = Math.PI / 2;
        airplane.add(fuselage);

        // Wings
        const wingGeometry = new THREE.BoxGeometry(6, 0.1, 1);
        const wingMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff });
        const wings = new THREE.Mesh(wingGeometry, wingMaterial);
        airplane.add(wings);

        // Tail
        const tailGeometry = new THREE.BoxGeometry(1, 0.8, 0.1);
        const tail = new THREE.Mesh(tailGeometry, wingMaterial);
        tail.position.set(0, 0.4, -1.8);
        airplane.add(tail);

        airplane.position.y = this.height;
        scene.add(airplane);
        return airplane;
    }

    updateTargetPosition() {
        this.targetX = (Math.random() - 0.5) * 1000;
        this.targetZ = (Math.random() - 0.5) * 1000;
    }

    update(deltaTime) {
        // Move forward
        this.object.position.x += Math.sin(this.direction) * this.speed;
        this.object.position.z += Math.cos(this.direction) * this.speed;
        
        // Rotate gradually
        this.direction += this.turnSpeed;
        this.object.rotation.y = this.direction;
        
        // Check if we need a new target
        const distanceToTarget = Math.sqrt(
            Math.pow(this.object.position.x - this.targetX, 2) +
            Math.pow(this.object.position.z - this.targetZ, 2)
        );
        
        if (distanceToTarget < 50) {
            this.updateTargetPosition();
            this.turnSpeed = (Math.random() - 0.5) * 0.02;
        }
    }
}

// Create airplanes
const airplanes = [];
for (let i = 0; i < 5; i++) {
    airplanes.push(new Airplane());
}

// Update building creation chance and variety
function createBuilding(x, z) {
    const building = new THREE.Group();
    
    // Random building properties
    const floors = Math.floor(Math.random() * 5) + 2; // 2-6 floors
    const width = 6 + Math.random() * 4;
    const depth = 6 + Math.random() * 4;
    const floorHeight = 3;
    const totalHeight = floors * floorHeight;
    
    // Create floors
    for (let floor = 0; floor < floors; floor++) {
        const floorGeometry = new THREE.BoxGeometry(width, floorHeight, depth);
        const floorMaterial = new THREE.MeshStandardMaterial({ 
            color: new THREE.Color(0.5 + Math.random() * 0.2, 0.5 + Math.random() * 0.2, 0.5 + Math.random() * 0.2),
            roughness: 0.7
        });
        const floorMesh = new THREE.Mesh(floorGeometry, floorMaterial);
        floorMesh.position.y = floor * floorHeight + floorHeight/2;
        building.add(floorMesh);
        
        // Add windows
        const windowSize = 0.5;
        const windowGeometry = new THREE.BoxGeometry(windowSize, windowSize, 0.1);
        const windowMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x88ccff,
            emissive: 0x88ccff,
            emissiveIntensity: 0.2
        });
        
        // Add windows to each side
        for (let w = 0; w < 3; w++) {
            const spacing = width / 4;
            // Front windows
            const frontWindow = new THREE.Mesh(windowGeometry, windowMaterial);
            frontWindow.position.set((w - 1) * spacing, floor * floorHeight + floorHeight/2, depth/2 + 0.1);
            building.add(frontWindow);
            
            // Back windows
            const backWindow = new THREE.Mesh(windowGeometry, windowMaterial);
            backWindow.position.set((w - 1) * spacing, floor * floorHeight + floorHeight/2, -depth/2 - 0.1);
            building.add(backWindow);
            
            // Side windows
            if (w < 2) {
                const leftWindow = new THREE.Mesh(windowGeometry, windowMaterial);
                leftWindow.rotation.y = Math.PI/2;
                leftWindow.position.set(-width/2 - 0.1, floor * floorHeight + floorHeight/2, (w - 0.5) * spacing);
                building.add(leftWindow);
                
                const rightWindow = new THREE.Mesh(windowGeometry, windowMaterial);
                rightWindow.rotation.y = Math.PI/2;
                rightWindow.position.set(width/2 + 0.1, floor * floorHeight + floorHeight/2, (w - 0.5) * spacing);
                building.add(rightWindow);
            }
        }
    }
    
    building.position.set(x, 0, z);
    
    // Update collision box
    building.userData.boundingBox = new THREE.Box3();
    building.userData.boundingBox.setFromObject(building);
    
    return building;
}

// Update building placement chance
function createBuildingsForChunk(chunkX, chunkZ, chunk) {
    const startX = chunkX * CHUNK_SIZE;
    const startZ = chunkZ * CHUNK_SIZE;
    const numBlocks = Math.floor(CHUNK_SIZE / BLOCK_SIZE) - 1;
    const buildings = [];

    for (let bx = 0; bx < numBlocks; bx++) {
        for (let bz = 0; bz < numBlocks; bz++) {
            const blockX = startX - CHUNK_SIZE/2 + bx * BLOCK_SIZE;
            const blockZ = startZ - CHUNK_SIZE/2 + bz * BLOCK_SIZE;
            
            // Skip road areas
            if (Math.abs(blockX % BLOCK_SIZE) < ROAD_WIDTH * 1.5 || 
                Math.abs(blockZ % BLOCK_SIZE) < ROAD_WIDTH * 1.5) {
                continue;
            }
            
            if (Math.random() < 0.5) { // Increased chance to 50%
                const building = createBuilding(
                    blockX + (Math.random() - 0.5) * 5,
                    blockZ + (Math.random() - 0.5) * 5
                );
                scene.add(building);
                buildings.push(building);
            }
        }
    }
    
    chunk.buildings = buildings;
}

// Car
const carWidth = 2;
const carHeight = 1;
const carLength = 4;

function createCar() {
    const car = new THREE.Group();

    // Main body
    const bodyGeometry = new THREE.BoxGeometry(carWidth, carHeight, carLength);
    const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000 });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.y = carHeight/2;
    car.add(body);

    // Roof
    const roofWidth = carWidth * 0.8;
    const roofHeight = carHeight * 0.7;
    const roofLength = carLength * 0.6;
    const roofGeometry = new THREE.BoxGeometry(roofWidth, roofHeight, roofLength);
    const roofMaterial = new THREE.MeshStandardMaterial({ color: 0xdd0000 });
    const roof = new THREE.Mesh(roofGeometry, roofMaterial);
    roof.position.y = carHeight + roofHeight/2;
    car.add(roof);

    // Wheels
    const wheelRadius = 0.4;
    const wheelThickness = 0.2;
    const wheelGeometry = new THREE.CylinderGeometry(wheelRadius, wheelRadius, wheelThickness, 16);
    const wheelMaterial = new THREE.MeshStandardMaterial({ color: 0x202020 });
    
    // Add wheels
    const wheelPositions = [
        [-carWidth/2 - wheelThickness/2, wheelRadius, carLength/3],
        [carWidth/2 + wheelThickness/2, wheelRadius, carLength/3],
        [-carWidth/2 - wheelThickness/2, wheelRadius, -carLength/3],
        [carWidth/2 + wheelThickness/2, wheelRadius, -carLength/3]
    ];

    wheelPositions.forEach(position => {
        const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
        wheel.rotation.z = Math.PI/2;
        wheel.position.set(...position);
        car.add(wheel);
    });

    // Windshield
    const windshieldGeometry = new THREE.BoxGeometry(roofWidth * 0.9, roofHeight * 1.2, 0.1);
    const windshieldMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x88ccff,
        transparent: true,
        opacity: 0.7
    });
    const windshield = new THREE.Mesh(windshieldGeometry, windshieldMaterial);
    windshield.position.set(0, carHeight + roofHeight/2, carLength/4);
    windshield.rotation.x = Math.PI/6;
    car.add(windshield);

    return car;
}

const car = createCar();
car.position.y = 0.5;
scene.add(car);

// Camera setup
camera.position.set(0, 10, 15);
camera.lookAt(car.position);

// Game state with simplified terrain following
const state = {
    speed: 0,
    rotationSpeed: 0,
    maxSpeed: 0.8,
    acceleration: 0.015,
    deceleration: 0.01,
    rotationAcceleration: 0.003,
    score: 0,
    bullets: [],
    lastShootTime: 0,
    shootCooldown: 250,
    speedDisplay: null,
    currentHeight: 0.5,
    gameOver: false,
    health: 100,
    lastDamageTime: 0,
    damageCooldown: 1000
};

// Controls
const keys = {
    w: false,
    s: false,
    a: false,
    d: false,
    ArrowLeft: false,
    ArrowRight: false,
    ' ': false // Space bar for shooting
};

window.addEventListener('keydown', (e) => {
    if (keys.hasOwnProperty(e.key)) {
        keys[e.key] = true;
    }
});

window.addEventListener('keyup', (e) => {
    if (keys.hasOwnProperty(e.key)) {
        keys[e.key] = false;
    }
});

// Simplified terrain height calculation
function getTerrainHeight(position) {
    const chunkX = Math.floor(position.x / CHUNK_SIZE);
    const chunkZ = Math.floor(position.z / CHUNK_SIZE);
    let maxHeight = 0;

    // Check nearby chunks
    for (let dx = -1; dx <= 1; dx++) {
        for (let dz = -1; dz <= 1; dz++) {
            const key = `${chunkX + dx},${chunkZ + dz}`;
            const chunk = groundChunks.get(key);
            if (chunk && chunk.mountains) {
                for (const mountain of chunk.mountains) {
                    const mountainPos = mountain.position;
                    const distanceToMountain = Math.sqrt(
                        Math.pow(position.x - mountainPos.x, 2) +
                        Math.pow(position.z - mountainPos.z, 2)
                    );
                    
                    const mountainHeight = MOUNTAIN_MIN_HEIGHT + 
                        (((mountainPos.x * 10000) + mountainPos.z) % (MOUNTAIN_MAX_HEIGHT - MOUNTAIN_MIN_HEIGHT));
                    const mountainRadius = mountainHeight * 2;
                    
                    if (distanceToMountain < mountainRadius) {
                        const heightFactor = 1 - (distanceToMountain / mountainRadius);
                        const height = mountainHeight * heightFactor;
                        maxHeight = Math.max(maxHeight, height);
                    }
                }
            }
        }
    }
    
    return maxHeight;
}

// Update collision detection to only check buildings
function checkCollision(newPosition) {
    const carBox = new THREE.Box3();
    const carSize = new THREE.Vector3(carWidth * 1.2, carHeight * 2, carLength * 1.2);
    carBox.setFromCenterAndSize(newPosition, carSize);

    const chunkX = Math.floor(newPosition.x / CHUNK_SIZE);
    const chunkZ = Math.floor(newPosition.z / CHUNK_SIZE);

    for (let dx = -1; dx <= 1; dx++) {
        for (let dz = -1; dz <= 1; dz++) {
            const key = `${chunkX + dx},${chunkZ + dz}`;
            const chunk = groundChunks.get(key);
            if (chunk && chunk.buildings) {
                for (const building of chunk.buildings) {
                    building.userData.boundingBox.setFromObject(building);
                    if (carBox.intersectsBox(building.userData.boundingBox)) {
                        return true;
                    }
                }
            }
        }
    }
    return false;
}

// Chunk management
function updateChunks() {
    const chunkX = Math.floor(car.position.x / CHUNK_SIZE);
    const chunkZ = Math.floor(car.position.z / CHUNK_SIZE);

    for (let dx = -VIEW_DISTANCE; dx <= VIEW_DISTANCE; dx++) {
        for (let dz = -VIEW_DISTANCE; dz <= VIEW_DISTANCE; dz++) {
            createGroundChunk(chunkX + dx, chunkZ + dz);
        }
    }

    // Clean up far chunks
    for (const [key, chunk] of groundChunks.entries()) {
        const [cx, cz] = key.split(',').map(Number);
        if (Math.abs(cx - chunkX) > VIEW_DISTANCE + 1 || 
            Math.abs(cz - chunkZ) > VIEW_DISTANCE + 1) {
            scene.remove(chunk.ground);
            chunk.roads.forEach(road => scene.remove(road));
            chunk.buildings.forEach(building => scene.remove(building));
            chunk.mountains.forEach(mountain => scene.remove(mountain));
            groundChunks.delete(key);
        }
    }
}

// Add shooting mechanics
function createBullet(position, direction) {
    const bulletGeometry = new THREE.SphereGeometry(0.2, 8, 8);
    const bulletMaterial = new THREE.MeshStandardMaterial({ 
        color: 0xffff00,
        emissive: 0xffff00,
        emissiveIntensity: 0.5
    });
    const bullet = new THREE.Mesh(bulletGeometry, bulletMaterial);
    
    bullet.position.copy(position);
    bullet.position.y = 1;
    
    bullet.userData.direction = direction;
    bullet.userData.creationTime = Date.now();
    
    scene.add(bullet);
    state.bullets.push(bullet);
}

// Bot car class
class BotCar {
    constructor(x, z) {
        this.object = this.createBotCar();
        this.object.position.set(x, 0.5, z);
        this.speed = 0.3 + Math.random() * 0.3;
        this.direction = Math.random() * Math.PI * 2;
        this.turnSpeed = 0;
        this.maxTurnSpeed = 0.03;
        this.targetDirection = this.direction;
        this.updateTargetTimer = 0;
        this.updateTargetInterval = 2000 + Math.random() * 2000;
        this.health = 100;
        scene.add(this.object);
    }

    createBotCar() {
        const botCar = new THREE.Group();

        // Main body
        const bodyGeometry = new THREE.BoxGeometry(carWidth, carHeight, carLength);
        const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0x444444 });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.position.y = carHeight/2;
        botCar.add(body);

        // Roof
        const roofWidth = carWidth * 0.8;
        const roofHeight = carHeight * 0.7;
        const roofLength = carLength * 0.6;
        const roofGeometry = new THREE.BoxGeometry(roofWidth, roofHeight, roofLength);
        const roofMaterial = new THREE.MeshStandardMaterial({ color: 0x666666 });
        const roof = new THREE.Mesh(roofGeometry, roofMaterial);
        roof.position.y = carHeight + roofHeight/2;
        botCar.add(roof);

        // Add health bar
        const healthBarGeometry = new THREE.BoxGeometry(2, 0.2, 0.2);
        const healthBarMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
        const healthBar = new THREE.Mesh(healthBarGeometry, healthBarMaterial);
        healthBar.position.y = carHeight * 2;
        healthBar.userData.isHealthBar = true;
        botCar.add(healthBar);

        return botCar;
    }

    updateHealthBar() {
        const healthBar = this.object.children.find(child => child.userData.isHealthBar);
        if (healthBar) {
            healthBar.scale.x = Math.max(0, this.health / 100);
            healthBar.material.color.setHex(this.health > 50 ? 0x00ff00 : 0xff0000);
        }
    }

    damage(amount) {
        this.health -= amount;
        this.updateHealthBar();
        
        // Visual feedback
        const originalColor = this.object.children[0].material.color.clone();
        this.object.children[0].material.color.setHex(0xff0000);
        setTimeout(() => {
            this.object.children[0].material.color.copy(originalColor);
        }, 200);

        if (this.health <= 0) {
            this.destroy();
            return true;
        }
        return false;
    }

    destroy() {
        scene.remove(this.object);
        const index = botCars.indexOf(this);
        if (index > -1) {
            botCars.splice(index, 1);
        }
        // Spawn a new bot car
        spawnBotCar();
    }

    update(deltaTime) {
        // Update target direction periodically
        this.updateTargetTimer += deltaTime;
        if (this.updateTargetTimer >= this.updateTargetInterval) {
            this.updateTargetTimer = 0;
            this.targetDirection = Math.random() * Math.PI * 2;
        }

        // Gradually turn towards target direction
        const angleDiff = (this.targetDirection - this.direction + Math.PI * 3) % (Math.PI * 2) - Math.PI;
        this.turnSpeed = Math.sign(angleDiff) * Math.min(Math.abs(angleDiff), this.maxTurnSpeed);
        this.direction += this.turnSpeed;

        // Move forward
        const moveX = Math.sin(this.direction) * this.speed;
        const moveZ = Math.cos(this.direction) * this.speed;
        
        const newPosition = new THREE.Vector3(
            this.object.position.x + moveX,
            this.object.position.y,
            this.object.position.z + moveZ
        );

        // Get terrain height and update position
        const terrainHeight = getTerrainHeight(newPosition);
        newPosition.y = 0.5 + terrainHeight;
        
        // Check for collisions with buildings
        if (!checkCollision(newPosition)) {
            this.object.position.copy(newPosition);
        } else {
            // If collision, change direction
            this.targetDirection = this.direction + Math.PI + (Math.random() - 0.5);
        }

        // Update rotation
        this.object.rotation.y = this.direction;

        // Update health bar to face camera
        const healthBar = this.object.children.find(child => child.userData.isHealthBar);
        if (healthBar) {
            healthBar.lookAt(camera.position);
        }
    }
}

// Add to game state
const botCars = [];
const BOT_CAR_COUNT = 55; // Increased from 5 to 55
const BOT_RESPAWN_DELAY = 3000;

// Add bot car spawning function
function spawnBotCar() {
    // Increase spawn radius for better distribution
    const angle = Math.random() * Math.PI * 2;
    const distance = 150 + Math.random() * 200; // Increased distance range
    const x = car.position.x + Math.cos(angle) * distance;
    const z = car.position.z + Math.sin(angle) * distance;
    
    // Check if spawn position is too close to other bot cars
    const tooClose = botCars.some(botCar => {
        const dx = botCar.object.position.x - x;
        const dz = botCar.object.position.z - z;
        return Math.sqrt(dx * dx + dz * dz) < 20; // Minimum distance between bot cars
    });
    
    if (!tooClose) {
        botCars.push(new BotCar(x, z));
    } else {
        // Try spawning again if position was too close
        setTimeout(spawnBotCar, 100);
    }
}

// Initialize bot cars
for (let i = 0; i < BOT_CAR_COUNT; i++) {
    spawnBotCar();
}

// Update bullet collision detection in updateBullets function
function updateBullets() {
    const currentTime = Date.now();
    
    for (let i = state.bullets.length - 1; i >= 0; i--) {
        const bullet = state.bullets[i];
        
        bullet.position.x += bullet.userData.direction.x * BULLET_SPEED;
        bullet.position.z += bullet.userData.direction.z * BULLET_SPEED;
        
        if (currentTime - bullet.userData.creationTime > BULLET_LIFETIME) {
            scene.remove(bullet);
            state.bullets.splice(i, 1);
            continue;
        }
        
        // Check building collisions
        const bulletPos = bullet.position.clone();
        const chunkX = Math.floor(bulletPos.x / CHUNK_SIZE);
        const chunkZ = Math.floor(bulletPos.z / CHUNK_SIZE);
        
        let hitSomething = false;
        
        // Check building collisions
        for (let dx = -1; dx <= 1; dx++) {
            for (let dz = -1; dz <= 1; dz++) {
                const key = `${chunkX + dx},${chunkZ + dz}`;
                const chunk = groundChunks.get(key);
                if (chunk && chunk.buildings) {
                    for (const building of chunk.buildings) {
                        if (building.userData.boundingBox.containsPoint(bulletPos)) {
                            hitSomething = true;
                            break;
                        }
                    }
                }
            }
        }
        
        // Check bot car collisions
        if (!hitSomething) {
            for (const botCar of botCars) {
                const distance = bulletPos.distanceTo(botCar.object.position);
                if (distance < 3) {
                    if (botCar.damage(34)) { // 3 hits to destroy
                        state.score += 50;
                        updateScoreDisplay();
                    }
                    hitSomething = true;
                    break;
                }
            }
        }
        
        if (hitSomething) {
            scene.remove(bullet);
            state.bullets.splice(i, 1);
        }
    }
}

// Add HUD
let hudContainer = null;
let scoreDisplay = null;

function createHUD() {
    if (!hudContainer) {
        hudContainer = document.createElement('div');
        hudContainer.style.position = 'fixed';
        hudContainer.style.top = '0';
        hudContainer.style.left = '0';
        hudContainer.style.width = '100%';
        hudContainer.style.height = '100%';
        hudContainer.style.pointerEvents = 'none';
        hudContainer.style.zIndex = '1000';
        document.body.appendChild(hudContainer);

        // Controls info - Always visible
        const controlsInfo = document.createElement('div');
        controlsInfo.style.position = 'absolute';
        controlsInfo.style.top = '20px';
        controlsInfo.style.left = '20px';
        controlsInfo.style.padding = '15px';
        controlsInfo.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
        controlsInfo.style.color = 'white';
        controlsInfo.style.fontFamily = 'Arial, sans-serif';
        controlsInfo.style.fontSize = '16px';
        controlsInfo.style.borderRadius = '10px';
        controlsInfo.style.boxShadow = '0 0 10px rgba(0,0,0,0.5)';
        controlsInfo.innerHTML = `
            <div style="font-weight: bold; margin-bottom: 10px;">Controls:</div>
            W/S - Accelerate/Brake<br>
            A/D or ←/→ - Turn<br>
            Space - Shoot
        `;
        hudContainer.appendChild(controlsInfo);

        // Score display - Always visible
        scoreDisplay = document.createElement('div');
        scoreDisplay.style.position = 'absolute';
        scoreDisplay.style.top = '150px';
        scoreDisplay.style.left = '20px';
        scoreDisplay.style.padding = '15px';
        scoreDisplay.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
        scoreDisplay.style.color = 'white';
        scoreDisplay.style.fontFamily = 'Arial, sans-serif';
        scoreDisplay.style.fontSize = '16px';
        scoreDisplay.style.borderRadius = '10px';
        scoreDisplay.style.boxShadow = '0 0 10px rgba(0,0,0,0.5)';
        hudContainer.appendChild(scoreDisplay);
        updateScoreDisplay(); // Update score immediately

        // Speed display - Always visible
        const speedDisplay = document.createElement('div');
        speedDisplay.style.position = 'absolute';
        speedDisplay.style.bottom = '20px';
        speedDisplay.style.right = '20px';
        speedDisplay.style.padding = '15px';
        speedDisplay.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
        speedDisplay.style.color = 'white';
        speedDisplay.style.fontFamily = 'Arial, sans-serif';
        speedDisplay.style.fontSize = '16px';
        speedDisplay.style.borderRadius = '10px';
        speedDisplay.style.boxShadow = '0 0 10px rgba(0,0,0,0.5)';
        hudContainer.appendChild(speedDisplay);
        state.speedDisplay = speedDisplay;
        updateSpeedDisplay(); // Update speed immediately
    }
}

function updateScoreDisplay() {
    if (!scoreDisplay) {
        createHUD();
    }
    const formattedScore = state.score.toString().padStart(6, '0');
    scoreDisplay.innerHTML = `
        <div style="font-size: 16px; margin-bottom: 5px;">SCORE</div>
        <div style="font-size: 24px; font-weight: bold;">${formattedScore}</div>
        <div style="font-size: 12px; margin-top: 5px;">Destroy cars to score 50 points!</div>
    `;
}

// Add speed display update function
function updateSpeedDisplay() {
    if (state.speedDisplay) {
        const speedKmh = Math.abs(state.speed) * 200; // Convert to km/h (approximate)
        state.speedDisplay.innerHTML = `
            <div style="font-size: 16px; margin-bottom: 5px;">SPEED</div>
            <div style="font-size: 24px; font-weight: bold;">${Math.round(speedKmh)} km/h</div>
        `;
    }
}

// Add the handleShooting function before the animate loop
function handleShooting() {
    if (keys[' '] && Date.now() - state.lastShootTime > state.shootCooldown) {
        const direction = new THREE.Vector3(
            Math.sin(car.rotation.y),
            0,
            Math.cos(car.rotation.y)
        );
        createBullet(car.position.clone(), direction);
        state.lastShootTime = Date.now();
    }
}

// Add game over screen
function showGameOverScreen() {
    if (!hudContainer) {
        createHUD();
    }

    const gameOverScreen = document.createElement('div');
    gameOverScreen.style.position = 'fixed';
    gameOverScreen.style.top = '50%';
    gameOverScreen.style.left = '50%';
    gameOverScreen.style.transform = 'translate(-50%, -50%)';
    gameOverScreen.style.backgroundColor = 'rgba(0, 0, 0, 0.9)';
    gameOverScreen.style.color = 'white';
    gameOverScreen.style.padding = '40px';
    gameOverScreen.style.borderRadius = '15px';
    gameOverScreen.style.textAlign = 'center';
    gameOverScreen.style.fontFamily = 'Arial, sans-serif';
    gameOverScreen.style.zIndex = '2000';
    gameOverScreen.style.pointerEvents = 'auto';
    gameOverScreen.style.boxShadow = '0 0 20px rgba(255,0,0,0.5)';

    const finalScore = state.score.toString().padStart(6, '0');
    gameOverScreen.innerHTML = `
        <h1 style="color: red; margin-bottom: 20px;">GAME OVER</h1>
        <div style="font-size: 24px; margin-bottom: 30px;">Final Score: ${finalScore}</div>
        <button id="restartButton" style="
            background-color: #ff3333;
            color: white;
            border: none;
            padding: 15px 30px;
            font-size: 18px;
            border-radius: 8px;
            cursor: pointer;
            transition: background-color 0.3s;
        ">Restart Game</button>
    `;

    hudContainer.appendChild(gameOverScreen);

    const restartButton = document.getElementById('restartButton');
    restartButton.addEventListener('mouseover', () => {
        restartButton.style.backgroundColor = '#ff6666';
    });
    restartButton.addEventListener('mouseout', () => {
        restartButton.style.backgroundColor = '#ff3333';
    });
    restartButton.addEventListener('click', restartGame);
}

function restartGame() {
    // Reset game state
    state.score = 0;
    state.speed = 0;
    state.rotationSpeed = 0;
    state.gameOver = false;
    
    // Reset car position
    car.position.set(0, 0.5, 0);
    car.rotation.set(0, 0, 0);
    
    // Remove all bullets
    state.bullets.forEach(bullet => scene.remove(bullet));
    state.bullets = [];
    
    // Remove all bot cars and respawn them
    botCars.forEach(botCar => scene.remove(botCar.object));
    botCars.length = 0;
    
    // Respawn bot cars
    for (let i = 0; i < BOT_CAR_COUNT; i++) {
        spawnBotCar();
    }
    
    // Update displays
    updateScoreDisplay();
    updateSpeedDisplay();
    
    // Remove game over screen
    const gameOverScreen = hudContainer.querySelector('div[style*="transform: translate(-50%, -50%)"]');
    if (gameOverScreen) {
        hudContainer.removeChild(gameOverScreen);
    }

    state.health = 100;
    state.lastDamageTime = 0;
    updatePlayerHealthBar();
}

// Add health bar for player
function createPlayerHealthBar() {
    const healthBarContainer = document.createElement('div');
    healthBarContainer.style.position = 'fixed';
    healthBarContainer.style.bottom = '20px';
    healthBarContainer.style.left = '20px';
    healthBarContainer.style.width = '200px';
    healthBarContainer.style.height = '20px';
    healthBarContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    healthBarContainer.style.border = '2px solid white';
    healthBarContainer.style.borderRadius = '10px';
    healthBarContainer.style.overflow = 'hidden';
    healthBarContainer.style.zIndex = '1000';

    const healthBarFill = document.createElement('div');
    healthBarFill.style.width = '100%';
    healthBarFill.style.height = '100%';
    healthBarFill.style.backgroundColor = '#00ff00';
    healthBarFill.style.transition = 'width 0.3s, background-color 0.3s';
    healthBarContainer.appendChild(healthBarFill);

    const healthText = document.createElement('div');
    healthText.style.position = 'absolute';
    healthText.style.width = '100%';
    healthText.style.textAlign = 'center';
    healthText.style.color = 'white';
    healthText.style.fontFamily = 'Arial';
    healthText.style.fontSize = '14px';
    healthText.style.lineHeight = '20px';
    healthText.style.textShadow = '1px 1px 2px black';
    healthBarContainer.appendChild(healthText);

    document.body.appendChild(healthBarContainer);
    return { container: healthBarContainer, fill: healthBarFill, text: healthText };
}

const playerHealthBar = createPlayerHealthBar();

function updatePlayerHealthBar() {
    const healthPercent = (state.health / 100) * 100;
    playerHealthBar.fill.style.width = `${healthPercent}%`;
    playerHealthBar.text.textContent = `Health: ${Math.ceil(state.health)}%`;
    
    // Update color based on health
    if (state.health > 60) {
        playerHealthBar.fill.style.backgroundColor = '#00ff00';
    } else if (state.health > 30) {
        playerHealthBar.fill.style.backgroundColor = '#ffff00';
    } else {
        playerHealthBar.fill.style.backgroundColor = '#ff0000';
    }
}

// Modify the checkBotCarCollision function
function checkBotCarCollision() {
    if (state.gameOver) return;

    const currentTime = Date.now();
    if (currentTime - state.lastDamageTime < state.damageCooldown) {
        return; // Still in invulnerability period
    }

    const playerBox = new THREE.Box3();
    const playerSize = new THREE.Vector3(carWidth * 1.2, carHeight * 2, carLength * 1.2);
    playerBox.setFromCenterAndSize(car.position, playerSize);

    for (const botCar of botCars) {
        const botBox = new THREE.Box3();
        const botSize = new THREE.Vector3(carWidth * 1.2, carHeight * 2, carLength * 1.2);
        botBox.setFromCenterAndSize(botCar.object.position, botSize);

        if (playerBox.intersectsBox(botBox)) {
            // Damage both player and bot
            state.health -= 20;
            botCar.damage(20);
            state.lastDamageTime = currentTime;

            // Visual feedback
            car.material = new THREE.MeshStandardMaterial({ color: 0xff0000 });
            setTimeout(() => {
                car.material = new THREE.MeshStandardMaterial({ color: 0xff0000 });
            }, 200);

            updatePlayerHealthBar();

            // Check if player is dead
            if (state.health <= 0) {
                state.gameOver = true;
                showGameOverScreen();
                return true;
            }
            break;
        }
    }
    return false;
}

// Simplified animation loop with basic terrain following
function animate() {
    const currentTime = Date.now();
    const deltaTime = currentTime - (state.lastTime || currentTime);
    state.lastTime = currentTime;

    requestAnimationFrame(animate);

    // Update day/night cycle
    updateDayNightCycle(deltaTime);

    // Update airplanes
    airplanes.forEach(airplane => airplane.update(deltaTime));

    // Only update player movement if game is not over
    if (!state.gameOver) {
        // Basic movement
        if (keys.w) {
            state.speed = Math.min(state.speed + state.acceleration, state.maxSpeed);
        } else if (keys.s) {
            state.speed = Math.max(state.speed - state.acceleration, -state.maxSpeed * 0.7);
        } else {
            state.speed *= (1 - state.deceleration);
        }

        if (keys.ArrowLeft || keys.a) {
            state.rotationSpeed = Math.min(state.rotationSpeed + state.rotationAcceleration, 0.1);
        } else if (keys.ArrowRight || keys.d) {
            state.rotationSpeed = Math.max(state.rotationSpeed - state.rotationAcceleration, -0.1);
        } else {
            state.rotationSpeed *= 0.95;
        }

        // Update position with simple terrain following
        const newRotation = car.rotation.y + state.rotationSpeed;
        const moveX = Math.sin(car.rotation.y) * state.speed;
        const moveZ = Math.cos(car.rotation.y) * state.speed;
        
        const newPosition = new THREE.Vector3(
            car.position.x + moveX,
            car.position.y,
            car.position.z + moveZ
        );
        
        if (!checkCollision(newPosition)) {
            const terrainHeight = getTerrainHeight(newPosition);
            const targetHeight = 0.5 + terrainHeight;
            
            newPosition.y = targetHeight;
            car.position.copy(newPosition);
            
            // Basic car tilting
            const forwardPos = new THREE.Vector3(
                newPosition.x + Math.sin(car.rotation.y) * 4,
                0,
                newPosition.z + Math.cos(car.rotation.y) * 4
            );
            const backwardPos = new THREE.Vector3(
                newPosition.x - Math.sin(car.rotation.y) * 4,
                0,
                newPosition.z - Math.cos(car.rotation.y) * 4
            );
            
            const forwardHeight = getTerrainHeight(forwardPos);
            const backwardHeight = getTerrainHeight(backwardPos);
            
            // Simple pitch calculation
            const pitchAngle = Math.atan2(forwardHeight - backwardHeight, 8) * 0.5;
            car.rotation.x = pitchAngle;
            
            // Simple roll calculation
            const leftPos = new THREE.Vector3(
                newPosition.x + Math.cos(car.rotation.y) * 2,
                0,
                newPosition.z - Math.sin(car.rotation.y) * 2
            );
            const rightPos = new THREE.Vector3(
                newPosition.x - Math.cos(car.rotation.y) * 2,
                0,
                newPosition.z + Math.sin(car.rotation.y) * 2
            );
            
            const leftHeight = getTerrainHeight(leftPos);
            const rightHeight = getTerrainHeight(rightPos);
            
            const rollAngle = Math.atan2(leftHeight - rightHeight, 4) * 0.5;
            car.rotation.z = rollAngle;
        }
        
        car.rotation.y = newRotation;
        
        // Check for collisions with bot cars
        checkBotCarCollision();
    }

    // Camera following
    const cameraDistance = 15;
    const cameraHeight = 8;
    const targetCameraHeight = cameraHeight + car.position.y;
    
    camera.position.set(
        car.position.x - Math.sin(car.rotation.y) * cameraDistance,
        targetCameraHeight,
        car.position.z - Math.cos(car.rotation.y) * cameraDistance
    );
    camera.lookAt(car.position);

    // Update game systems
    if (!state.gameOver) {
        handleShooting();
        updateBullets();
    }
    updateChunks();
    updateSpeedDisplay();

    // Update player health bar
    updatePlayerHealthBar();

    // Update bot cars
    botCars.forEach(botCar => botCar.update(deltaTime));

    // Render
    renderer.render(scene, camera);
}

// Handle window resizing
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Initialize first chunk
createGroundChunk(0, 0);

// After scene setup, before animation loop
// Initialize HUD immediately
createHUD();
updateScoreDisplay();
updateSpeedDisplay();

// Start animation
animate(); 