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

// Track room participants and their roles
const rooms = new Map();

io.on('connection', socket => {
  console.log('User connected:', socket.id);
  
  socket.on('join-room', ({ roomId, userName, isStreamer }) => {
    console.log(`User ${socket.id} (${userName}) joining room ${roomId}`);
    
    // Initialize room if it doesn't exist
    if (!rooms.has(roomId)) {
      rooms.set(roomId, {
        participants: new Map(),
        streamer: null,
      });
    }
    
    const room = rooms.get(roomId);
    
    // Join the socket room
    socket.join(roomId);
    
    // Store room info and user info with the socket
    socket.roomId = roomId;
    socket.userName = userName;
    
    // Add user to room record
    room.participants.set(socket.id, {
      name: userName,
      isStreamer: isStreamer
    });
    
    // If this is the first participant or they are marked as streamer, they become the streamer
    if (room.participants.size === 1 || isStreamer) {
      room.streamer = socket.id;
    }
    
    // Notify others that a new user has connected
    socket.to(roomId).emit('user-connected', {
      userId: socket.id,
      userName: userName
    });
    
    // Send current room state to the joining user
    socket.emit('room-info', {
      participants: Array.from(room.participants.entries()).map(([id, data]) => ({
        id,
        name: data.name,
        isStreamer: data.isStreamer
      })),
      streamer: room.streamer
    });
    
    console.log(`Room ${roomId} participants:`, 
      Array.from(room.participants.entries()).map(([id, data]) => `${data.name} (${id})`));
  });
  
  // Handle WebRTC signaling with improved error handling
  socket.on('sending-signal', payload => {
    try {
      if (!socket.roomId || !rooms.has(socket.roomId)) {
        console.error('Invalid room for sending signal');
        return;
      }
      
      const room = rooms.get(socket.roomId);
      if (!room.participants.has(payload.userToSignal)) {
        console.error('Target user not in room');
        return;
      }
      
      io.to(payload.userToSignal).emit('user-joined', {
        signal: payload.signal,
        callerId: payload.callerId
      });
    } catch (err) {
      console.error('Error in sending-signal:', err);
    }
  });
  
  socket.on('returning-signal', payload => {
    try {
      if (!socket.roomId || !rooms.has(socket.roomId)) {
        console.error('Invalid room for returning signal');
        return;
      }
      
      const room = rooms.get(socket.roomId);
      if (!room.participants.has(payload.callerId)) {
        console.error('Caller not in room');
        return;
      }
      
      io.to(payload.callerId).emit('receiving-returned-signal', {
        signal: payload.signal,
        id: socket.id
      });
    } catch (err) {
      console.error('Error in returning-signal:', err);
    }
  });
  
  // Handle disconnection with improved cleanup
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    
    const roomId = socket.roomId;
    if (roomId && rooms.has(roomId)) {
      const room = rooms.get(roomId);
      
      // Remove user from room record
      room.participants.delete(socket.id);
      
      // If streamer disconnected, assign new streamer if there are participants
      if (room.streamer === socket.id && room.participants.size > 0) {
        const nextStreamer = room.participants.keys().next().value;
        room.streamer = nextStreamer;
        const streamerData = room.participants.get(nextStreamer);
        
        // Update the participant's streamer status
        room.participants.set(nextStreamer, {
          ...streamerData,
          isStreamer: true
        });
        
        // Notify room about new streamer
        io.to(roomId).emit('new-streamer', {
          streamerId: nextStreamer,
          streamerName: streamerData.name
        });
      }
      
      // Notify others in the room
      socket.to(roomId).emit('user-disconnected', socket.id);
      
      // Clean up empty rooms
      if (room.participants.size === 0) {
        rooms.delete(roomId);
        console.log(`Room ${roomId} deleted (empty)`);
      } else {
        console.log(`Room ${roomId} participants:`, 
          Array.from(room.participants.entries()).map(([id, data]) => `${data.name} (${id})`));
      }
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});