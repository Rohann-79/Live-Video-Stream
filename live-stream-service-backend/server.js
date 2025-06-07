// Backend (Node.js) - server.js
const express = require('express');
const http = require('http');
const app = express();
const server = http.createServer(app);
const socket = require('socket.io');
const io = socket(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 5001;

// Track room participants and their roles
const rooms = new Map();

io.on('connection', socket => {
  console.log('User connected:', socket.id);
  
  socket.on('join-room', ({ roomId, userName, isStreamer }) => {
    console.log(`User ${userName} (${socket.id}) joining room ${roomId}`);
    
    // Join the socket room
    socket.join(roomId);
    
    // Get or create room
    if (!rooms.has(roomId)) {
      rooms.set(roomId, {
        participants: new Map(),
        streamer: null
      });
    }
    
    const room = rooms.get(roomId);
    
    // Add participant to room
    room.participants.set(socket.id, {
      name: userName,
      isStreamer
    });
    
    // If this is the first participant or they're designated as streamer, make them the streamer
    if (!room.streamer || isStreamer) {
      room.streamer = socket.id;
    }
    
    // Send current room state to new participant first
    const participants = Array.from(room.participants.entries())
      .filter(([id]) => id !== socket.id) // Exclude self
      .map(([id, data]) => ({
        id,
        name: data.name,
        isStreamer: room.streamer === id
      }));
    socket.emit('room-info', { participants });
    
    // Then notify others in the room of new participant (excluding the new participant)
    socket.to(roomId).emit('user-connected', {
      userId: socket.id,
      userName,
      isStreamer: room.streamer === socket.id
    });
  });
  
  // Handle signaling
  socket.on('sending-signal', payload => {
    // Prevent self-signaling
    if (payload.callerId === payload.userToSignal) {
      console.log('Prevented self-signaling attempt');
      return;
    }
    
    console.log('Signal from:', payload.callerId, 'to:', payload.userToSignal);
    // Find the caller's room to get their streamer status
    let callerIsStreamer = false;
    for (const [roomId, room] of rooms.entries()) {
      if (room.participants.has(payload.callerId)) {
        callerIsStreamer = room.streamer === payload.callerId;
        break;
      }
    }
    
    io.to(payload.userToSignal).emit('user-joined', {
      signal: payload.signal,
      callerId: payload.callerId,
      userName: payload.userName,
      isStreamer: callerIsStreamer
    });
  });
  
  socket.on('returning-signal', payload => {
    // Prevent self-signaling
    if (socket.id === payload.callerId) {
      console.log('Prevented self-return-signaling attempt');
      return;
    }
    
    console.log('Return signal from:', socket.id, 'to:', payload.callerId);
    io.to(payload.callerId).emit('receiving-returned-signal', {
      signal: payload.signal,
      id: socket.id
    });
  });

  // Handle stream start/stop events
  socket.on('stream-started', ({ roomId }) => {
    console.log('Stream started in room:', roomId);
    socket.to(roomId).emit('stream-started');
  });

  socket.on('stream-stopped', ({ roomId }) => {
    console.log('Stream stopped in room:', roomId);
    socket.to(roomId).emit('stream-stopped');
  });


  
  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    
    // Find and clean up room
    for (const [roomId, room] of rooms.entries()) {
      if (room.participants.has(socket.id)) {
        // Remove participant
        room.participants.delete(socket.id);
        
        // If streamer disconnected, assign new streamer
        if (room.streamer === socket.id && room.participants.size > 0) {
          const firstParticipant = room.participants.entries().next().value;
          room.streamer = firstParticipant[0];
          io.to(roomId).emit('user-connected', {
            userId: firstParticipant[0],
            userName: firstParticipant[1].name,
            isStreamer: true
          });
        }
        
        // Notify room of disconnection
        socket.to(roomId).emit('user-disconnected', socket.id);
        
        // Clean up empty rooms
        if (room.participants.size === 0) {
          rooms.delete(roomId);
          console.log(`Room ${roomId} deleted - no participants remaining`);
        }
        
        break;
      }
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});