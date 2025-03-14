import * as THREE from 'three';

// Add at the beginning of the file, after imports
let ws;
let playerId;
const otherPlayers = new Map();
let playerName = '';

// Add login screen handling
const gameContainer = document.getElementById('gameContainer');
const loginScreen = document.getElementById('loginScreen');
const playerNameInput = document.getElementById('playerName');
const startButton = document.getElementById('startButton');
const playersListDiv = document.getElementById('playersList');

// Game state
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
    damageCooldown: 1000,
    gameStarted: false
};

// Scene setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x87CEEB); // Sky blue color
gameContainer.appendChild(renderer.domElement);

// Basic lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(10, 20, 10);
scene.add(directionalLight);

// Initialize HUD
let hudContainer = null;
let scoreDisplay = null;
createHUD();

// Create player car
const car = createCar();
car.position.y = 0.5;
scene.add(car);

// Hide game elements initially
renderer.domElement.style.display = 'none';
if (hudContainer) hudContainer.style.display = 'none';

function startGame() {
    const playerName = playerNameInput.value.trim();
    if (playerName) {
        // Show game elements
        loginScreen.style.display = 'none';
        gameContainer.style.display = 'block';
        playersListDiv.style.display = 'block';
        if (hudContainer) hudContainer.style.display = 'block';

        // Initialize game state
        state.gameStarted = true;
        state.score = 0;
        state.health = 100;
        state.gameOver = false;
        
        // Reset car position
        car.position.set(0, 0.5, 0);
        car.rotation.set(0, 0, 0);
        
        // Initialize game elements
        updateScoreDisplay();
        updatePlayerHealthBar();
        initializeBotCars();
        
        // Start animation if not already started
        if (!state.animationStarted) {
            state.animationStarted = true;
            animate();
        }
    }
}

// Event listeners
startButton.addEventListener('click', startGame);
playerNameInput.addEventListener('keypress', (event) => {
    if (event.key === 'Enter') {
        event.preventDefault();
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

function updatePlayersList(players) {
    if (!playersListDiv) return;

    // Sort players by score
    players.sort((a, b) => b.score - a.score);

    // Update the players list div
    let html = `
        <div style="font-weight: bold; margin-bottom: 10px; text-align: center; border-bottom: 1px solid rgba(255,255,255,0.3); padding-bottom: 5px;">
            Player Rankings
        </div>
    `;

    players.forEach((player, index) => {
        const rank = index + 1;
        const rankColor = rank === 1 ? '#ffd700' : rank === 2 ? '#c0c0c0' : rank === 3 ? '#cd7f32' : 'white';
        
        html += `
            <div style="
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 5px 0;
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
    if (!state.gameStarted) {
        requestAnimationFrame(animate);
        return;
    }

    const currentTime = Date.now();
    const deltaTime = currentTime - (state.lastTime || currentTime);
    state.lastTime = currentTime;

    // Update game systems
    updateDayNightCycle(deltaTime);
    airplanes.forEach(airplane => airplane.update(deltaTime));

    if (!state.gameOver) {
        handlePlayerMovement();
        handleShooting();
        updateBullets();
        checkBotCarCollision();
    }

    updateCamera();
    updateChunks();
    updateSpeedDisplay();
    updatePlayerHealthBar();
    botCars.forEach(botCar => botCar.update(deltaTime));

    renderer.render(scene, camera);
    requestAnimationFrame(animate);
}

// Handle player movement
function handlePlayerMovement() {
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

    updatePlayerPosition();
}

// Update camera position
function updateCamera() {
    const cameraDistance = 15;
    const cameraHeight = 8;
    const targetCameraHeight = cameraHeight + car.position.y;
    
    camera.position.set(
        car.position.x - Math.sin(car.rotation.y) * cameraDistance,
        targetCameraHeight,
        car.position.z - Math.cos(car.rotation.y) * cameraDistance
    );
    camera.lookAt(car.position);
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