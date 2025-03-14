const express = require('express');
const { WebSocketServer } = require('ws');
const path = require('path');
const http = require('http');

const app = express();
const port = process.env.PORT || 3000;

// Serve static files from the dist directory after building
app.use(express.static('dist'));

// Serve index.html for all routes (for client-side routing)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Store connected players
const players = new Map();

function broadcastToAll(message, excludeId = null) {
    wss.clients.forEach(client => {
        if (client.readyState === 1 && (!excludeId || client.id !== excludeId)) {
            client.send(JSON.stringify(message));
        }
    });
}

function broadcastPlayersList() {
    const playersList = Array.from(players.values()).map(player => ({
        id: player.id,
        name: player.name,
        score: player.score,
        position: player.position,
        rotation: player.rotation
    }));

    broadcastToAll({
        type: 'playersList',
        players: playersList
    });
}

wss.on('connection', (ws) => {
    const playerId = Date.now().toString();
    ws.id = playerId;

    console.log(`New client connected: ${playerId}`);

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            
            switch (data.type) {
                case 'join':
                    // Store player info
                    players.set(playerId, {
                        id: playerId,
                        name: data.name,
                        score: 0,
                        position: { x: 0, y: 0.5, z: 0 },
                        rotation: { x: 0, y: 0, z: 0 }
                    });

                    // Send current players list to new player
                    ws.send(JSON.stringify({
                        type: 'joined',
                        id: playerId,
                        players: Array.from(players.values())
                    }));

                    // Broadcast new player to others
                    broadcastToAll({
                        type: 'playerJoined',
                        id: playerId,
                        name: data.name
                    }, playerId);
                    break;

                case 'update':
                    const player = players.get(playerId);
                    if (player) {
                        player.position = data.position;
                        player.rotation = data.rotation;
                        player.score = data.score;

                        broadcastToAll({
                            type: 'playerUpdate',
                            id: playerId,
                            position: data.position,
                            rotation: data.rotation,
                            score: data.score
                        }, playerId);
                    }
                    break;

                case 'shoot':
                    broadcastToAll({
                        type: 'playerShoot',
                        id: playerId,
                        position: data.position,
                        direction: data.direction
                    }, playerId);
                    break;
            }
        } catch (error) {
            console.error('Error processing message:', error);
        }
    });

    ws.on('close', () => {
        console.log(`Client disconnected: ${playerId}`);
        players.delete(playerId);
        broadcastToAll({
            type: 'playerLeft',
            id: playerId
        });
    });
});

server.listen(port, () => {
    console.log(`Server is running on port ${port}`);
}); 