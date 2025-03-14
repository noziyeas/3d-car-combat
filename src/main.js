import * as THREE from 'three';

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

// DOM elements
const gameContainer = document.getElementById('gameContainer');
const loginScreen = document.getElementById('loginScreen');
const playerNameInput = document.getElementById('playerName');
const startButton = document.getElementById('startButton');
const playersListDiv = document.getElementById('playersList');

// Scene setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x87CEEB);
gameContainer.appendChild(renderer.domElement);

// Basic lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(10, 20, 10);
scene.add(directionalLight);

// Create player car
const car = createCar();
car.position.y = 0.5;
scene.add(car);

// Initialize HUD
let hudContainer = null;
let scoreDisplay = null;
createHUD();

// Hide game elements initially
gameContainer.style.display = 'none';
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

        // Update player list with single player
        updatePlayersList([{
            name: playerName,
            score: state.score
        }]);
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

function updatePlayersList(players) {
    if (!playersListDiv) return;

    let html = `
        <div style="font-weight: bold; margin-bottom: 10px; text-align: center; border-bottom: 1px solid rgba(255,255,255,0.3); padding-bottom: 5px;">
            Score
        </div>
        <div style="
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 5px 0;
            margin: 2px 0;
        ">
            <span style="color: #ffd700;">#1</span>
            <span style="margin: 0 10px; flex-grow: 1;">${players[0].name}</span>
            <span>${players[0].score}</span>
        </div>
    `;

    playersListDiv.innerHTML = html;
}

function animate() {
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

    // Update score display
    updatePlayersList([{
        name: playerNameInput.value.trim(),
        score: state.score
    }]);

    renderer.render(scene, camera);
    requestAnimationFrame(animate);
}

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

// Start animation loop
animate(); 