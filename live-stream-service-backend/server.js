// Backend (Node.js) - server.js
const express = require('express');
const http = require('http');
const app = express();
const server = http.createServer(app);
const socket = require('socket.io');
const io = socket(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 5001;

// Track room participants
const rooms = {};

io.on('connection', socket => {
  console.log('User connected:', socket.id);
  
  socket.on('join-room', roomId => {
    console.log(`User ${socket.id} joining room ${roomId}`);
    
    // Initialize room if it doesn't exist
    if (!rooms[roomId]) {
      rooms[roomId] = [];
    }
    
    // Join the socket room
    socket.join(roomId);
    
    // Store the room ID with the socket for disconnection handling
    socket.roomId = roomId;
    
    // Notify others that a new user has connected
    socket.to(roomId).emit('user-connected', socket.id);
    
    // Add user to room record
    rooms[roomId].push(socket.id);
    
    console.log(`Room ${roomId} participants:`, rooms[roomId]);
  });
  
  // Handle WebRTC signaling
  socket.on('sending-signal', payload => {
    io.to(payload.userToSignal).emit('user-joined', { 
      signal: payload.signal, 
      callerId: payload.callerId 
    });
  });
  
  socket.on('returning-signal', payload => {
    io.to(payload.callerId).emit('receiving-returned-signal', { 
      signal: payload.signal, 
      id: socket.id 
    });
  });
  
  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    
    const roomId = socket.roomId;
    if (roomId && rooms[roomId]) {
      // Remove user from room record
      rooms[roomId] = rooms[roomId].filter(id => id !== socket.id);
      
      // Notify others in the room
      socket.to(roomId).emit('user-disconnected', socket.id);
      
      // Clean up empty rooms
      if (rooms[roomId].length === 0) {
        delete rooms[roomId];
        console.log(`Room ${roomId} deleted (empty)`);
      } else {
        console.log(`Room ${roomId} participants:`, rooms[roomId]);
      }
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});