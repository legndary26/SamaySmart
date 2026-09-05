const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static(path.join(__dirname, '../client')));

const rooms = {};

io.on('connection', (socket) => {
    socket.on('join-room', (roomId) => {
        socket.join(roomId);
        // Send current state to the newly joined user if it exists
        if (rooms[roomId]) {
            socket.emit('sync-state', rooms[roomId]);
        }
    });

    socket.on('update-state', (data) => {
        const { roomId, state } = data;
        rooms[roomId] = state; // Store latest state on server
        socket.to(roomId).emit('sync-state', state); // Broadcast to everyone else
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));