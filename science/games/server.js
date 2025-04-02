const WebSocket = require('ws');
const http = require('http');

const server = http.createServer();
const wss = new WebSocket.Server({ server });

const players = {};
const playerQueue = [];
const maxPlayers = 60;

wss.on('connection', ws => {
    const id = generateId();
    const color = { r: Math.random(), g: Math.random(), b: Math.random() };
    const position = { x: 0, y: 0.5, z: 0 };

    if (Object.keys(players).length < maxPlayers) {
        players[id] = { ws, position, color };
        ws.send(JSON.stringify({ type: 'currentPlayerId', id, position, color }));
        broadcast({ type: 'playerJoined', id, position, color });
    } else {
        playerQueue.push(id);
        ws.send(JSON.stringify({ type: 'queueUpdate', queue: playerQueue }));
        broadcast({ type: 'queueUpdate', queue: playerQueue });
    }

    ws.on('message', message => {
        try {
            const data = JSON.parse(message);
            if (data.type === 'playerUpdate' && players[data.id]) {
                players[data.id].position = data.position;
                broadcast(data);
            }
        } catch (error) {
            console.error('Error parsing message:', error);
        }
    });

    ws.on('close', () => {
        delete players[id];
        broadcast({ type: 'playerLeft', id });
        if (playerQueue.length > 0) {
            const newPlayerId = playerQueue.shift();
            players[newPlayerId] = { ws: wss.clients.find(client => client.readyState === WebSocket.OPEN), position, color };
            if (players[newPlayerId].ws) {
                players[newPlayerId].ws.send(JSON.stringify({ type: 'currentPlayerId', id: newPlayerId, position, color }));
                broadcast({ type: 'playerJoined', id: newPlayerId, position, color });
            }
        }
    });
});

function broadcast(data) {
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(data));
        }
    });
}

function generateId() {
    return Math.random().toString(36).substr(2, 9);
}

const port = process.env.PORT || 3000;
server.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});
