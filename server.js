const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

// Allow CORS so your Android devices can connect
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

// Store game rooms
let rooms = {}; 

io.on('connection', (socket) => {
  console.log(`🔌 Player connected: ${socket.id}`);

  // Connection success debug
  socket.emit('connection_success', { message: 'Connected to UNO server', socketId: socket.id });
  console.log(`✅ Connection successful for socket: ${socket.id}`);

  // When a player joins a room
  socket.on('join_room', ({ roomId, playerName }) => {
    console.log(`🟢 ${playerName} joined room: ${roomId}`);

    // Create room if it doesn't exist
    if (!rooms[roomId]) {
      rooms[roomId] = {
        players: [],
        currentTurnIndex: 0,
        topCard: null,
      };
      console.log(`📦 Room created: ${roomId}`);
    }

    // Avoid duplicate players
    if (!rooms[roomId].players.some(p => p.id === socket.id)) {
      rooms[roomId].players.push({ id: socket.id, name: playerName, hand: [] });
      console.log(`➕ Player added: ${playerName} (${socket.id}) to room ${roomId}`);
    }

    // Join Socket.IO room
    socket.join(roomId);
    console.log(`🏠 Socket ${socket.id} joined Socket.IO room: ${roomId}`);

    // Broadcast updated player list in this room
    io.to(roomId).emit('update_players', rooms[roomId].players);

    // Broadcast updated room list to all clients
    io.emit('room_list', Object.keys(rooms));
  });

  // When a player plays a card
  socket.on('play_card', ({ roomId, card, playerId }) => {
    const room = rooms[roomId];
    if (!room) return;

    // Update top card
    room.topCard = card;
    room.currentTurnIndex = (room.currentTurnIndex + 1) % room.players.length;

    console.log(`🃏 Card played by ${playerId} in room ${roomId}:`, card);
    console.log(`🔄 Next turn index: ${room.currentTurnIndex}`);

    io.to(roomId).emit('card_played', {
      card,
      playerId,
      currentTurnIndex: room.currentTurnIndex,
    });
  });

  // Handle client requesting room list manually
  socket.on('get_rooms', () => {
    console.log("📢 get_rooms called by", socket.id);
    const roomIds = Object.keys(rooms);
    socket.emit('room_list', roomIds);
  });

  // Player disconnects
  socket.on('disconnect', () => {
    console.log(`❌ Player disconnected: ${socket.id}`);

    for (const roomId in rooms) {
      const room = rooms[roomId];
      const removed = room.players.filter(p => p.id === socket.id).map(p => p.name);
      room.players = room.players.filter(p => p.id !== socket.id);

      if (removed.length > 0) {
        console.log(`🗑 Removed player(s) from room ${roomId}:`, removed);
        io.to(roomId).emit('update_players', room.players);
      }

      // Delete empty rooms
      if (room.players.length === 0) {
        delete rooms[roomId];
        console.log(`🗑 Room deleted: ${roomId}`);
        io.emit('room_list', Object.keys(rooms)); // notify all clients
      }
    }
  });
});

// Start server on all network interfaces so devices can connect
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 UNO server running on http://0.0.0.0:${PORT}`);
});
