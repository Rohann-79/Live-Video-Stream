// Frontend (React) - VideoStreamingApp.js
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import Peer from 'simple-peer';

const VideoStreamingApp = () => {
  const { roomId: roomIdParam } = useParams();
  const navigate = useNavigate();
  
  const [peers, setPeers] = useState([]);
  const [roomId, setRoomId] = useState(roomIdParam || '');
  const [isStreamer, setIsStreamer] = useState(false);
  const [joinedRoom, setJoinedRoom] = useState(!!roomIdParam);
  const [newRoomId, setNewRoomId] = useState('');
  const [isMuted, setIsMuted] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [userName, setUserName] = useState('');
  const [participants, setParticipants] = useState(new Map());
  
  const socketRef = useRef();
  const userVideoRef = useRef();
  const screenStreamRef = useRef();
  const peersRef = useRef([]);
  
  // Room creation or joining
  const createRoom = () => {
    if (!userName.trim()) {
      alert('Please enter your name');
      return;
    }
    const generatedRoomId = Math.random().toString(36).substring(2, 7);
    setRoomId(generatedRoomId);
    setIsStreamer(true);
    setJoinedRoom(true);
    navigate(`/room/${generatedRoomId}`, { replace: true });
    initializeRoom(generatedRoomId, true);
  };
  
  const joinRoom = () => {
    if (!userName.trim()) {
      alert('Please enter your name');
      return;
    }
    if (!newRoomId) {
      alert('Please enter a room ID');
      return;
    }
    setRoomId(newRoomId);
    setIsStreamer(false);
    setJoinedRoom(true);
    navigate(`/room/${newRoomId}`, { replace: true });
    initializeRoom(newRoomId, false);
  };
  
  const initializeRoom = async (roomId, isStreamer) => {
    socketRef.current = io.connect('http://localhost:5001');
    
    try {
      // Get audio only by default
      const audioStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
        },
        video: false
      });
      
      // Send user info when joining room
      socketRef.current.emit('join-room', {
        roomId,
        userName: userName.trim(),
        isStreamer
      });
      
      // If streamer, they need to start a share explicitly
      if (isStreamer) {
        screenStreamRef.current = audioStream;
      }
      
      // When a new user connects
      socketRef.current.on('user-connected', ({ userId, userName: newUserName }) => {
        console.log('User connected:', userId, newUserName);
        setParticipants(prev => new Map(prev).set(userId, newUserName));
        
        // Only create peer if we're the streamer or if the new user is the streamer
        const shouldCreatePeer = isStreamer || (peers.length === 0 && !isStreamer);
        if (shouldCreatePeer) {
          const peer = createPeer(userId, socketRef.current.id, screenStreamRef.current || audioStream);
          
          peersRef.current.push({
            peerId: userId,
            peer,
            userName: newUserName
          });
          
          setPeers(prevPeers => [...prevPeers, { peerId: userId, peer, userName: newUserName }]);
        }
      });
      
      // Receiving room info
      socketRef.current.on('room-info', ({ participants: roomParticipants }) => {
        const participantsMap = new Map();
        roomParticipants.forEach(({ id, name }) => {
          participantsMap.set(id, name);
        });
        setParticipants(participantsMap);
      });
      
      // Receiving a call
      socketRef.current.on('user-joined', payload => {
        console.log('User joined with signal:', payload);
        const peer = addPeer(payload.signal, payload.callerId, screenStreamRef.current || audioStream);
        
        const userName = participants.get(payload.callerId) || 'Unknown User';
        
        peersRef.current.push({
          peerId: payload.callerId,
          peer,
          userName
        });
        
        setPeers(prevPeers => [...prevPeers, { peerId: payload.callerId, peer, userName }]);
      });
      
      // Receiving returned signal
      socketRef.current.on('receiving-returned-signal', payload => {
        const item = peersRef.current.find(p => p.peerId === payload.id);
        if (item) {
          item.peer.signal(payload.signal);
        }
      });
      
      // User disconnected
      socketRef.current.on('user-disconnected', userId => {
        console.log('User disconnected:', userId);
        const peerObj = peersRef.current.find(p => p.peerId === userId);
        if (peerObj) {
          peerObj.peer.destroy();
        }
        
        const peers = peersRef.current.filter(p => p.peerId !== userId);
        peersRef.current = peers;
        setPeers(peers);
      });
    } catch (err) {
      console.error('Error getting media devices:', err);
    }
  };
  
  // Start screen sharing
  const startScreenShare = async () => {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          cursor: 'always',
          displaySurface: 'monitor',
          logicalSurface: true,
          frameRate: 30,
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
        }
      });
      
      // Store the screen stream reference
      screenStreamRef.current = screenStream;
      
      // Add audio tracks if not present in screen share
      const hasAudio = screenStream.getAudioTracks().length > 0;
      if (!hasAudio) {
        try {
          const audioStream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
            }
          });
          audioStream.getAudioTracks().forEach(track => {
            screenStreamRef.current.addTrack(track);
          });
        } catch (err) {
          console.warn('Could not add audio to screen share:', err);
        }
      }
      
      // Set up screen share end handler
      screenStream.getVideoTracks()[0].onended = () => {
        stopScreenShare();
      };

      // Update video element
      if (userVideoRef.current) {
        userVideoRef.current.srcObject = screenStreamRef.current;
        userVideoRef.current.style.display = 'block';
      }
      
      // Update all existing peers with the new stream
      peersRef.current.forEach(({ peer }) => {
        // First remove any existing tracks
        const senders = peer._pc.getSenders();
        senders.forEach(sender => {
          if (sender.track) {
            peer._pc.removeTrack(sender);
          }
        });

        // Then add the new tracks
        screenStreamRef.current.getTracks().forEach(track => {
          peer.addTrack(track, screenStreamRef.current);
        });
      });
      
      setIsSharing(true);
    } catch (err) {
      console.error('Error starting screen share:', err);
      setIsSharing(false);
    }
  };
  
  // Stop screen sharing
  const stopScreenShare = async () => {
    try {
      if (screenStreamRef.current) {
        // Stop all tracks
        screenStreamRef.current.getTracks().forEach(track => {
          track.stop();
        });

        // Clear video element
        if (userVideoRef.current) {
          userVideoRef.current.srcObject = null;
        }

        // Get new audio-only stream for continued participation
        const audioStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
          }
        });

        // Update screen stream reference
        screenStreamRef.current = audioStream;

        // Update all peers with audio-only stream
        peersRef.current.forEach(({ peer }) => {
          // Remove all existing tracks
          const senders = peer._pc.getSenders();
          senders.forEach(sender => {
            if (sender.track) {
              peer._pc.removeTrack(sender);
            }
          });

          // Add new audio track
          audioStream.getAudioTracks().forEach(track => {
            peer.addTrack(track, audioStream);
          });
        });

        setIsSharing(false);
      }
    } catch (err) {
      console.error('Error stopping screen share:', err);
      setIsSharing(false);
    }
  };
  
  // Create peer (initiator)
  const createPeer = (userToSignal, callerId, stream) => {
    const peer = new Peer({
      initiator: true,
      trickle: false,
      stream,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:global.stun.twilio.com:3478' }
        ]
      },
      reconnectTimer: 1000,
      iceTransportPolicy: 'all',
    });
    
    peer.on('signal', signal => {
      socketRef.current.emit('sending-signal', { userToSignal, callerId, signal });
    });
    
    peer.on('connect', () => {
      console.log('Peer connection established');
    });
    
    peer.on('error', err => {
      console.error('Peer connection error:', err);
      // Attempt to reconnect on error
      if (peer && !peer.destroyed) {
        peer.destroy();
        const newPeer = createPeer(userToSignal, callerId, stream);
        // Update the peers list with the new peer
        setPeers(prevPeers => {
          const peerIndex = prevPeers.findIndex(p => p.peerId === userToSignal);
          if (peerIndex !== -1) {
            const newPeers = [...prevPeers];
            newPeers[peerIndex] = { peerId: userToSignal, peer: newPeer };
            return newPeers;
          }
          return prevPeers;
        });
      }
    });
    
    return peer;
  };
  
  // Add peer (receiver)
  const addPeer = (incomingSignal, callerId, stream) => {
    const peer = new Peer({
      initiator: false,
      trickle: false,
      stream,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:global.stun.twilio.com:3478' }
        ]
      },
      reconnectTimer: 1000,
      iceTransportPolicy: 'all',
    });
    
    peer.on('signal', signal => {
      socketRef.current.emit('returning-signal', { signal, callerId });
    });
    
    peer.on('connect', () => {
      console.log('Peer connection established');
    });
    
    peer.on('error', err => {
      console.error('Peer connection error:', err);
      // Attempt to reconnect on error
      if (peer && !peer.destroyed) {
        peer.destroy();
        const newPeer = addPeer(incomingSignal, callerId, stream);
        // Update the peers list with the new peer
        setPeers(prevPeers => {
          const peerIndex = prevPeers.findIndex(p => p.peerId === callerId);
          if (peerIndex !== -1) {
            const newPeers = [...prevPeers];
            newPeers[peerIndex] = { peerId: callerId, peer: newPeer };
            return newPeers;
          }
          return prevPeers;
        });
      }
    });
    
    peer.signal(incomingSignal);
    
    return peer;
  };
  
  // Toggle mute
  const toggleMute = () => {
    if (screenStreamRef.current) {
      const audioTracks = screenStreamRef.current.getAudioTracks();
      audioTracks.forEach(track => {
        track.enabled = isMuted;
      });
      setIsMuted(!isMuted);
    }
  };
  
  // Handle direct navigation to a room
  useEffect(() => {
    if (roomIdParam && !joinedRoom) {
      setRoomId(roomIdParam);
      setJoinedRoom(true);
      initializeRoom(roomIdParam, false);
    }
  }, [roomIdParam, joinedRoom]);
  
  // Clean up on component unmount
  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
      
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(track => {
          track.stop();
        });
      }
      
      peers.forEach(peer => {
        peer.peer.destroy();
      });
    };
  }, [peers]);
  
  return (
    <div className="flex flex-col min-h-screen bg-gray-900 text-white p-4">
      {!joinedRoom ? (
        <div className="flex flex-col items-center justify-center flex-grow space-y-6">
          <h1 className="text-3xl font-bold">Game Streaming App</h1>
          <div className="flex flex-col space-y-4 w-full max-w-md">
            <input
              type="text"
              placeholder="Enter Your Name"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              className="bg-gray-800 text-white px-4 py-2 rounded"
            />
            <button 
              onClick={createRoom} 
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded"
            >
              Create Streaming Room
            </button>
            <div className="flex flex-col space-y-2">
              <input
                type="text"
                placeholder="Enter Room ID"
                value={newRoomId}
                onChange={(e) => setNewRoomId(e.target.value)}
                className="bg-gray-800 text-white px-4 py-2 rounded"
              />
              <button 
                onClick={joinRoom} 
                className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
              >
                Join Stream
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col h-full">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-2xl font-bold">Room: {roomId}</h1>
            <div className="flex items-center space-x-2">
              <button 
                onClick={toggleMute} 
                className={`px-4 py-2 rounded font-semibold ${isMuted ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}`}
              >
                {isMuted ? 'Unmute' : 'Mute'}
              </button>
              
              {isStreamer && (
                <button 
                  onClick={isSharing ? stopScreenShare : startScreenShare} 
                  className={`px-4 py-2 rounded font-semibold ${isSharing ? 'bg-red-600 hover:bg-red-700' : 'bg-purple-600 hover:bg-purple-700'}`}
                >
                  {isSharing ? 'Stop Sharing' : 'Share Screen'}
                </button>
              )}
            </div>
          </div>
          
          <div className="grid grid-cols-1 gap-4 flex-grow">
            {/* Streamer's view */}
            {isStreamer && (
              <div className="relative bg-gray-800 rounded-lg overflow-hidden aspect-video">
                <video 
                  ref={userVideoRef} 
                  autoPlay 
                  playsInline 
                  muted 
                  className="w-full h-full object-contain" 
                />
                <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 px-2 py-1 rounded">
                  You (Streaming)
                </div>
              </div>
            )}
            
            {/* Viewer's view */}
            {!isStreamer && peers.length > 0 && (
              <div className="relative bg-gray-800 rounded-lg overflow-hidden aspect-video">
                <Video peer={peers[0].peer} />
                <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 px-2 py-1 rounded">
                  {peers[0].userName || 'Streamer'}
                </div>
              </div>
            )}
            
            {/* Updated participants list */}
            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="text-xl font-semibold mb-2">Participants</h3>
              <div className="space-y-2">
                <div className="flex items-center space-x-2 p-2 bg-gray-700 rounded">
                  <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center">
                    <span>You</span>
                  </div>
                  <span>{userName} {isStreamer ? '(Streamer)' : '(Viewer)'}</span>
                </div>
                
                {peers.map((peer, index) => (
                  <div key={peer.peerId} className="flex items-center space-x-2 p-2 bg-gray-700 rounded">
                    <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                      <span>{index + 1}</span>
                    </div>
                    <span>{peer.userName || `Participant ${index + 1}`} {isStreamer ? '(Viewer)' : index === 0 ? '(Streamer)' : '(Viewer)'}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Video component for remote peers
const Video = ({ peer }) => {
  const ref = useRef();

  useEffect(() => {
    if (peer) {
      peer.on('stream', stream => {
        console.log('Received peer stream with tracks:', stream.getTracks().map(t => t.kind));
        if (ref.current) {
          ref.current.srcObject = stream;
          ref.current.play().catch(err => {
            console.warn('Autoplay prevented:', err);
            if (err.name === 'NotAllowedError') {
              const container = ref.current.parentElement;
              const playButton = document.createElement('button');
              playButton.textContent = 'Click to Play';
              playButton.className = 'absolute inset-0 bg-black bg-opacity-50 text-white flex items-center justify-center cursor-pointer';
              playButton.onclick = () => {
                ref.current.play().catch(console.error);
                container.removeChild(playButton);
              };
              container.appendChild(playButton);
            }
          });
        }
      });

      peer.on('track', (track, stream) => {
        console.log('Received new track:', track.kind);
        if (ref.current) {
          ref.current.srcObject = stream;
        }
      });

      // Handle peer errors
      peer.on('error', err => {
        console.error('Peer video error:', err);
        // Try to reconnect the video
        if (ref.current && ref.current.srcObject) {
          ref.current.srcObject.getTracks().forEach(track => track.stop());
          ref.current.srcObject = null;
        }
      });
    }

    return () => {
      if (ref.current && ref.current.srcObject) {
        ref.current.srcObject.getTracks().forEach(track => track.stop());
        ref.current.srcObject = null;
      }
    };
  }, [peer]);

  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      className="w-full h-full object-contain"
      style={{ display: 'block' }}
    />
  );
};

export default VideoStreamingApp;