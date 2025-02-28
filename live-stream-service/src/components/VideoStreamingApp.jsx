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
  
  const socketRef = useRef();
  const userVideoRef = useRef();
  const screenStreamRef = useRef();
  const peersRef = useRef([]);
  
  // Room creation or joining
  const createRoom = () => {
    const generatedRoomId = Math.random().toString(36).substring(2, 7);
    setRoomId(generatedRoomId);
    setIsStreamer(true);
    setJoinedRoom(true);
    navigate(`/room/${generatedRoomId}`, { replace: true });
    initializeRoom(generatedRoomId, true);
  };
  
  const joinRoom = () => {
    if (newRoomId) {
      setRoomId(newRoomId);
      setIsStreamer(false);
      setJoinedRoom(true);
      navigate(`/room/${newRoomId}`, { replace: true });
      initializeRoom(newRoomId, false);
    }
  };
  
  const initializeRoom = async (roomId, isStreamer) => {
    socketRef.current = io.connect('http://localhost:5001');
    
    // Get audio only by default
    try {
      const audioStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false
      });
      
      socketRef.current.emit('join-room', roomId);
      
      // If streamer, they need to start a share explicitly
      if (isStreamer) {
        // We'll just use audio initially, screen share starts on button click
        screenStreamRef.current = audioStream;
      }
      
      // When a new user connects
      socketRef.current.on('user-connected', userId => {
        console.log('User connected:', userId);
        const peer = createPeer(userId, socketRef.current.id, screenStreamRef.current || audioStream);
        
        peersRef.current.push({
          peerId: userId,
          peer,
        });
        
        setPeers(prevPeers => [...prevPeers, { peerId: userId, peer }]);
      });
      
      // Receiving a call
      socketRef.current.on('user-joined', payload => {
        console.log('User joined with signal:', payload);
        const peer = addPeer(payload.signal, payload.callerId, screenStreamRef.current || audioStream);
        
        peersRef.current.push({
          peerId: payload.callerId,
          peer,
        });
        
        setPeers(prevPeers => [...prevPeers, { peerId: payload.callerId, peer }]);
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
  // In your VideoStreamingApp.js, update the startScreenShare function:

const startScreenShare = async () => {
  try {
    const screenStream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        cursor: 'always',
        displaySurface: 'monitor',
        logicalSurface: true,
        frameRate: 60,
        height: 1080,
        width: 1920
      }
    });
    
    // Store the screen stream reference
    screenStreamRef.current = screenStream;
    
    // Add audio tracks to the screen stream
    const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioStream.getAudioTracks().forEach(track => {
      screenStreamRef.current.addTrack(track);
    });
    
    // IMPORTANT: Make sure to set the srcObject property properly
    if (userVideoRef.current) {
      userVideoRef.current.srcObject = screenStreamRef.current;
      // Ensure the video element is visible
      userVideoRef.current.style.display = 'block';
      // Ensure autoplay is enabled
      userVideoRef.current.autoplay = true;
    }
    
    // Listen for the end of screen sharing
    screenStream.getVideoTracks()[0].onended = () => {
      stopScreenShare();
    };
    
    // Update all existing peers with the new stream
    peersRef.current.forEach(({ peer }) => {
      // Replace all tracks
      screenStreamRef.current.getTracks().forEach(track => {
        const senders = peer._pc.getSenders();
        const sender = senders.find(s => s.track && s.track.kind === track.kind);
        if (sender) {
          sender.replaceTrack(track);
        } else {
          peer.addTrack(track, screenStreamRef.current);
        }
      });
    });
    
    setIsSharing(true);
    
    // Log to confirm stream is active
    console.log('Screen sharing started, tracks:', screenStreamRef.current.getTracks().map(t => t.kind));
  } catch (err) {
    console.error('Error starting screen share:', err);
  }
};
  
  // Stop screen sharing
  const stopScreenShare = async () => {
    try {
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(track => {
          track.stop();
        });
        
        // Get audio only stream to replace
        const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        screenStreamRef.current = audioStream;
        
        if (userVideoRef.current) {
          userVideoRef.current.srcObject = null;
        }
        
        // Update peers with audio-only stream
        peersRef.current.forEach(({ peer }) => {
          audioStream.getTracks().forEach(track => {
            const senders = peer._pc.getSenders();
            const sender = senders.find(s => s.track && s.track.kind === track.kind);
            if (sender) {
              sender.replaceTrack(track);
            }
          });
        });
      }
      
      setIsSharing(false);
    } catch (err) {
      console.error('Error stopping screen share:', err);
    }
  };
  
  // Create peer (initiator)
  const createPeer = (userToSignal, callerId, stream) => {
    const peer = new Peer({
      initiator: true,
      trickle: false,
      stream,
    });
    
    peer.on('signal', signal => {
      socketRef.current.emit('sending-signal', { userToSignal, callerId, signal });
    });
    
    return peer;
  };
  
  // Add peer (receiver)
  const addPeer = (incomingSignal, callerId, stream) => {
    const peer = new Peer({
      initiator: false,
      trickle: false,
      stream,
    });
    
    peer.on('signal', signal => {
      socketRef.current.emit('returning-signal', { signal, callerId });
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
            <button 
              onClick={createRoom} 
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded"
            >
              Create Streaming Room
            </button>
            <div className="flex items-center space-x-2">
              <input
                type="text"
                placeholder="Enter Room ID"
                value={newRoomId}
                onChange={(e) => setNewRoomId(e.target.value)}
                className="bg-gray-800 text-white px-4 py-2 rounded flex-grow"
              />
              <button 
                onClick={joinRoom} 
                className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
              >
                Join
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
            {isStreamer && isSharing && (
              <div className="relative bg-gray-800 rounded-lg overflow-hidden aspect-video">
                <video ref={userVideoRef} autoPlay muted className="w-full h-full object-contain" />
                <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 px-2 py-1 rounded">
                  You (Streaming)
                </div>
              </div>
            )}
            
            {/* Replace this section in your return statement */}

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
            
            {/* Voice chat participants */}
            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="text-xl font-semibold mb-2">Voice Chat Participants</h3>
              <div className="space-y-2">
                <div className="flex items-center space-x-2 p-2 bg-gray-700 rounded">
                  <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center">
                    <span>You</span>
                  </div>
                  <span>You {isStreamer ? '(Streamer)' : '(Viewer)'}</span>
                </div>
                
                {peers.map((peer, index) => (
                  <div key={index} className="flex items-center space-x-2 p-2 bg-gray-700 rounded">
                    <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                      <span>{index + 1}</span>
                    </div>
                    <span>Participant {index + 1} {isStreamer ? '(Viewer)' : index === 0 ? '(Streamer)' : '(Viewer)'}</span>
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
          // Force a play attempt
          ref.current.play().catch(err => {
            console.warn('Autoplay prevented:', err);
            // Add a play button if autoplay is blocked
            if (err.name === 'NotAllowedError') {
              const container = ref.current.parentElement;
              const playButton = document.createElement('button');
              playButton.textContent = 'Click to Play';
              playButton.className = 'absolute inset-0 bg-black bg-opacity-50 text-white flex items-center justify-center';
              playButton.onclick = () => {
                ref.current.play();
                container.removeChild(playButton);
              };
              container.appendChild(playButton);
            }
          });
        }
      });
    }
    
    return () => {
      // Clean up on unmount
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
    />
  );
};

export default VideoStreamingApp;