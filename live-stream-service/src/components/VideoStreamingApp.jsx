// Frontend (React) - VideoStreamingApp.js
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import StreamManager from './StreamManager';

const VideoStreamingApp = () => {
  const { roomId: roomIdParam } = useParams();
  const navigate = useNavigate();
  const socketRef = useRef();
  
  const [roomId, setRoomId] = useState(roomIdParam || '');
  const [userName, setUserName] = useState('');
  const [isStreamer, setIsStreamer] = useState(false);
  const [joinedRoom, setJoinedRoom] = useState(false);
  const [participants, setParticipants] = useState(new Map());
  const [manualRoomId, setManualRoomId] = useState('');

  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  const createRoom = async () => {
    if (!userName.trim()) {
      alert('Please enter your name');
      return;
    }
    const generatedRoomId = Math.random().toString(36).substring(2, 7);
    setRoomId(generatedRoomId);
    setIsStreamer(true);
    setJoinedRoom(true);
    navigate(`/room/${generatedRoomId}`);
    initializeSocketConnection(generatedRoomId, true);
  };

  const joinRoom = async () => {
    if (!roomIdParam || !userName.trim()) {
      alert('Please enter your name');
      return;
    }
    setIsStreamer(false);
    setJoinedRoom(true);
    initializeSocketConnection(roomIdParam, false);
  };

  const joinRoomWithId = async () => {
    if (!manualRoomId.trim() || !userName.trim()) {
      alert('Please enter both your name and room ID');
      return;
    }
    setRoomId(manualRoomId);
    setIsStreamer(false);
    setJoinedRoom(true);
    navigate(`/room/${manualRoomId}`);
    initializeSocketConnection(manualRoomId, false);
  };

  const initializeSocketConnection = (roomId, isStreamer) => {
    socketRef.current = io('http://localhost:5001');
    
    socketRef.current.emit('join-room', {
      roomId,
      userName: userName.trim(),
      isStreamer
    });

    socketRef.current.on('room-info', ({ participants: roomParticipants }) => {
      const participantsMap = new Map();
      roomParticipants.forEach(({ id, name }) => {
        participantsMap.set(id, name);
      });
      setParticipants(participantsMap);
    });

    socketRef.current.on('user-connected', ({ userId, userName }) => {
      console.log('New user connected:', userId, userName);
      setParticipants(prev => new Map(prev).set(userId, userName));
    });

    socketRef.current.on('user-disconnected', (userId) => {
      console.log('User disconnected:', userId);
      setParticipants(prev => {
        const newMap = new Map(prev);
        newMap.delete(userId);
        return newMap;
      });
    });
  };

  if (!joinedRoom) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-md w-96">
          <h2 className="text-2xl font-bold mb-6 text-center">
            {roomIdParam ? 'Join Stream' : 'Live Stream'}
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="userName">
                Your Name
              </label>
              <input
                type="text"
                id="userName"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                placeholder="Enter your name"
                required
              />
            </div>
            
            {roomIdParam ? (
              // Direct room link - show join button
              <div>
                <p className="text-gray-600 text-sm mb-3">
                  You're joining room: <span className="font-semibold">{roomIdParam}</span>
                </p>
                <button
                  onClick={joinRoom}
                  className="w-full bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
                >
                  🚀 Join Stream
                </button>
              </div>
            ) : (
              // Homepage - show create and join options
              <div className="space-y-3">
                <button
                  onClick={createRoom}
                  className="w-full bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
                >
                  🎬 Create Streaming Room
                </button>
                
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-300" />
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-white text-gray-500">OR</span>
                  </div>
                </div>
                
                <div>
                  <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="roomId">
                    Join Existing Room
                  </label>
                  <input
                    type="text"
                    id="roomId"
                    value={manualRoomId}
                    onChange={(e) => setManualRoomId(e.target.value)}
                    className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline mb-3"
                    placeholder="Enter Room ID (e.g., abc123)"
                    maxLength={5}
                  />
                  <button
                    onClick={joinRoomWithId}
                    className="w-full bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
                    disabled={!manualRoomId.trim()}
                  >
                    👥 Join Stream
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-2xl font-bold">Room: {roomId}</h1>
            {isStreamer && (
              <div className="flex items-center space-x-3">
                <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2">
                  <div className="text-sm text-blue-600 font-medium">Share this Room ID:</div>
                  <div className="flex items-center space-x-2">
                    <code className="text-lg font-bold text-blue-800 bg-blue-100 px-2 py-1 rounded">
                      {roomId}
                    </code>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(roomId);
                        alert('Room ID copied to clipboard!');
                      }}
                      className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm"
                      title="Copy Room ID"
                    >
                      📋 Copy
                    </button>
                  </div>
                </div>
                <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-2">
                  <div className="text-sm text-green-600 font-medium">Share this URL:</div>
                  <div className="flex items-center space-x-2">
                    <code className="text-sm text-green-800 bg-green-100 px-2 py-1 rounded">
                      {window.location.href}
                    </code>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(window.location.href);
                        alert('URL copied to clipboard!');
                      }}
                      className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded text-sm"
                      title="Copy URL"
                    >
                      📋 Copy
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          <StreamManager
            socket={socketRef.current}
            roomId={roomId}
            isStreamer={isStreamer}
            userName={userName}
          />
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold mb-4">Participants</h2>
          <div className="space-y-2">
            <div className="flex items-center space-x-2 p-2 bg-gray-100 rounded">
              <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white">
                You
              </div>
              <span>{userName} ({isStreamer ? 'Streamer' : 'Viewer'})</span>
            </div>
            {Array.from(participants.entries()).map(([id, name]) => (
              <div key={id} className="flex items-center space-x-2 p-2 bg-gray-100 rounded">
                <div className="w-8 h-8 bg-gray-500 rounded-full flex items-center justify-center text-white">
                  {name[0]}
                </div>
                <span>{name}</span>
              </div>
            ))}
          </div>
          {isStreamer && participants.size === 0 && (
            <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="text-yellow-800">
                <strong>💡 No viewers yet!</strong>
                <p className="text-sm mt-1">
                  Share your <strong>Room ID: {roomId}</strong> or the URL above with others so they can join your stream.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VideoStreamingApp;