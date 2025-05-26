import React, { useEffect, useRef, useState, useCallback } from 'react';
import Peer from 'simple-peer';

const StreamManager = ({ socket, roomId, isStreamer, userName }) => {
  const [peers, setPeers] = useState([]);
  const [isSharing, setIsSharing] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [screenStream, setScreenStream] = useState(null);
  const [audioStream, setAudioStream] = useState(null);
  const [error, setError] = useState(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const [isAudioActive, setIsAudioActive] = useState(false);
  const userVideoRef = useRef();
  const peersRef = useRef([]);
  const audioContextRef = useRef();
  const analyserRef = useRef();
  const animationFrameRef = useRef();

  // Audio visualization component
  const AudioVisualizer = ({ audioLevel, isActive, isMuted }) => {
    const bars = Array.from({ length: 5 }, (_, i) => {
      const height = isActive && !isMuted ? Math.max(10, audioLevel * (i + 1) * 20) : 10;
      const opacity = isActive && !isMuted ? 0.7 + (audioLevel * 0.3) : 0.3;
      
      return (
        <div
          key={i}
          className={`bg-current transition-all duration-100 rounded-full ${
            isActive && !isMuted ? 'text-green-500' : 'text-gray-400'
          }`}
          style={{
            width: '4px',
            height: `${height}px`,
            opacity: opacity,
            animationDelay: `${i * 50}ms`,
          }}
        />
      );
    });

    return (
      <div className="flex items-center space-x-1 h-8">
        {bars}
      </div>
    );
  };

  // Initialize audio analysis
  const initializeAudioAnalysis = useCallback((stream) => {
    try {
      // Clean up any existing audio context first
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
      
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      
      const source = audioContextRef.current.createMediaStreamSource(stream);
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      analyserRef.current.smoothingTimeConstant = 0.8;
      
      source.connect(analyserRef.current);
      
      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
      
      const updateAudioLevel = () => {
        if (analyserRef.current && !isMuted && audioContextRef.current.state === 'running') {
          analyserRef.current.getByteFrequencyData(dataArray);
          
          // Calculate average volume
          const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
          const normalizedLevel = average / 255;
          
          setAudioLevel(normalizedLevel);
          setIsAudioActive(normalizedLevel > 0.01); // Threshold for detecting audio activity
        } else {
          setAudioLevel(0);
          setIsAudioActive(false);
        }
        
        animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
      };
      
      updateAudioLevel();
    } catch (err) {
      console.error('Error initializing audio analysis:', err);
    }
  }, [isMuted]);

  // Cleanup audio analysis
  const cleanupAudioAnalysis = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    setAudioLevel(0);
    setIsAudioActive(false);
  }, []);

  // Create peer (initiator)
  const createPeer = useCallback((userToSignal, callerId, stream) => {
    // Prevent self-connection
    if (userToSignal === socket?.id) {
      console.log('Preventing self-connection');
      return null;
    }

    const peer = new Peer({
      initiator: true,
      trickle: false,
      stream: stream || null,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:global.stun.twilio.com:3478' }
        ]
      }
    });

    peer.on('signal', signal => {
      if (socket && userToSignal !== socket.id) {
        socket.emit('sending-signal', { userToSignal, callerId, signal, userName });
      }
    });

    peer.on('connect', () => {
      console.log('Peer connection established with:', userToSignal);
    });

    peer.on('error', err => {
      console.error('Peer connection error:', err);
      // Clean up failed peer
      const peerIndex = peersRef.current.findIndex(p => p.peerId === userToSignal);
      if (peerIndex !== -1) {
        peersRef.current.splice(peerIndex, 1);
        setPeers(prev => prev.filter(p => p.peerId !== userToSignal));
      }
    });

    peer.on('close', () => {
      console.log('Peer connection closed with:', userToSignal);
    });

    return peer;
  }, [socket, userName]);

  // Add peer (receiver)
  const addPeer = useCallback((incomingSignal, callerId, stream) => {
    // Prevent self-connection
    if (callerId === socket?.id) {
      console.log('Preventing self-connection from caller');
      return null;
    }

    const peer = new Peer({
      initiator: false,
      trickle: false,
      stream: stream || null,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:global.stun.twilio.com:3478' }
        ]
      }
    });

    peer.on('signal', signal => {
      if (socket && callerId !== socket.id) {
        socket.emit('returning-signal', { signal, callerId });
      }
    });

    peer.on('connect', () => {
      console.log('Peer connection established with caller:', callerId);
    });

    peer.on('error', err => {
      console.error('Peer connection error:', err);
      // Clean up failed peer
      const peerIndex = peersRef.current.findIndex(p => p.peerId === callerId);
      if (peerIndex !== -1) {
        peersRef.current.splice(peerIndex, 1);
        setPeers(prev => prev.filter(p => p.peerId !== callerId));
      }
    });

    peer.on('stream', stream => {
      console.log('Received peer stream from:', callerId);
      if (userVideoRef.current && stream && stream.getTracks().length > 0) {
        userVideoRef.current.srcObject = stream;
        userVideoRef.current.play().catch(err => {
          console.warn('Autoplay prevented:', err);
          if (err.name === 'NotAllowedError') {
            const container = userVideoRef.current.parentElement;
            if (container && !container.querySelector('.play-button')) {
              const playButton = document.createElement('button');
              playButton.textContent = 'Click to Play';
              playButton.className = 'play-button absolute inset-0 bg-black bg-opacity-50 text-white flex items-center justify-center cursor-pointer';
              playButton.onclick = () => {
                userVideoRef.current.play().catch(console.error);
                container.removeChild(playButton);
              };
              container.appendChild(playButton);
            }
          }
        });
      }
    });

    peer.on('close', () => {
      console.log('Peer connection closed with caller:', callerId);
    });

    if (incomingSignal) {
      peer.signal(incomingSignal);
    }
    return peer;
  }, [socket]);

  // Stop screen sharing
  const stopScreenShare = useCallback(() => {
    if (screenStream) {
      screenStream.getTracks().forEach(track => {
        track.stop();
      });
      setScreenStream(null);
      setIsSharing(false);

      // Clear the video element for streamer
      if (userVideoRef.current && isStreamer) {
        userVideoRef.current.srcObject = null;
      }

      // Update all peers to remove video tracks
      peersRef.current.forEach(({ peer }) => {
        if (peer && peer._pc && !peer.destroyed) {
          try {
            const senders = peer._pc.getSenders();
            senders.forEach(sender => {
              if (sender.track && sender.track.kind === 'video') {
                peer._pc.removeTrack(sender);
              }
            });
          } catch (err) {
            console.error('Error removing video track from peer:', err);
          }
        }
      });
    }
  }, [screenStream, isStreamer]);

  // Initialize media streams
  useEffect(() => {
    let mounted = true;

    const initializeStreams = async () => {
      try {
        setError(null);
        
        // Get audio stream
        const audio = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
          video: false
        });

        if (!mounted) {
          audio.getTracks().forEach(track => track.stop());
          return;
        }
        setAudioStream(audio);
        
        // Initialize audio analysis
        initializeAudioAnalysis(audio);
        
        console.log('Audio stream initialized successfully');
      } catch (err) {
        console.error('Error initializing streams:', err);
        if (mounted) {
          setError(err.message || 'Failed to initialize audio. Please check microphone permissions.');
        }
      }
    };

    initializeStreams();

    return () => {
      mounted = false;
      // Cleanup streams
      if (audioStream) {
        audioStream.getTracks().forEach(track => track.stop());
      }
      if (screenStream) {
        screenStream.getTracks().forEach(track => track.stop());
      }
      // Cleanup audio analysis
      cleanupAudioAnalysis();
      // Cleanup peers
      peersRef.current.forEach(({ peer }) => {
        if (peer && !peer.destroyed) {
          peer.destroy();
        }
      });
    };
  }, [initializeAudioAnalysis, cleanupAudioAnalysis]);

  // Update audio analysis when mute state changes
  useEffect(() => {
    if (audioStream && !isMuted) {
      // Only initialize audio analysis if we don't have one running
      if (!analyserRef.current) {
        initializeAudioAnalysis(audioStream);
      }
    }
    
    // When muted, just set levels to zero but don't destroy the analyzer
    if (isMuted) {
      setAudioLevel(0);
      setIsAudioActive(false);
    }
    
    // IMPORTANT: Never touch the video element during mute state changes
    // The video stream should remain completely isolated from audio operations
  }, [isMuted, audioStream, initializeAudioAnalysis]);

  // Handle peer connections
  useEffect(() => {
    if (!socket) return;

    const handleUserConnected = ({ userId, userName: newUserName }) => {
      console.log('New user connected:', userId, newUserName);
      
      // Prevent self-connection and only create peer if we're the streamer and it's not ourselves
      if (isStreamer && userId !== socket.id) {
        // Check if peer already exists
        const existingPeer = peersRef.current.find(p => p.peerId === userId);
        if (!existingPeer) {
          // Create combined stream with both screen and audio
          let combinedStream = null;
          if (screenStream && audioStream) {
            combinedStream = new MediaStream([
              ...screenStream.getTracks(),
              ...audioStream.getTracks().filter(track => track.enabled || !isMuted)
            ]);
          } else if (screenStream) {
            combinedStream = screenStream;
          } else if (audioStream) {
            combinedStream = audioStream;
          }

          const peer = createPeer(userId, socket.id, combinedStream);
          if (peer) {
            const peerObj = { peerId: userId, peer, userName: newUserName };
            peersRef.current.push(peerObj);
            setPeers(prev => [...prev, peerObj]);
          }
        }
      }
    };

    const handleUserJoined = (payload) => {
      console.log('Received call from:', payload.callerId);
      
      // Prevent self-connection
      if (payload.callerId === socket.id) {
        console.log('Ignoring self-call');
        return;
      }

      // Check if peer already exists
      const existingPeer = peersRef.current.find(p => p.peerId === payload.callerId);
      if (!existingPeer) {
        // Create combined stream with both screen and audio
        let combinedStream = null;
        if (screenStream && audioStream) {
          combinedStream = new MediaStream([
            ...screenStream.getTracks(),
            ...audioStream.getTracks().filter(track => track.enabled || !isMuted)
          ]);
        } else if (screenStream) {
          combinedStream = screenStream;
        } else if (audioStream) {
          combinedStream = audioStream;
        }

        const peer = addPeer(payload.signal, payload.callerId, combinedStream);
        if (peer) {
          const peerObj = { peerId: payload.callerId, peer, userName: payload.userName };
          peersRef.current.push(peerObj);
          setPeers(prev => [...prev, peerObj]);
        }
      }
    };

    const handleReturnedSignal = (payload) => {
      const item = peersRef.current.find(p => p.peerId === payload.id);
      if (item && item.peer && !item.peer.destroyed) {
        try {
          item.peer.signal(payload.signal);
        } catch (err) {
          console.error('Error handling returned signal:', err);
        }
      }
    };

    const handleUserDisconnected = (userId) => {
      console.log('User disconnected:', userId);
      const peerObj = peersRef.current.find(p => p.peerId === userId);
      if (peerObj && peerObj.peer) {
        if (!peerObj.peer.destroyed) {
          peerObj.peer.destroy();
        }
      }
      peersRef.current = peersRef.current.filter(p => p.peerId !== userId);
      setPeers(prev => prev.filter(p => p.peerId !== userId));
    };

    socket.on('user-connected', handleUserConnected);
    socket.on('user-joined', handleUserJoined);
    socket.on('receiving-returned-signal', handleReturnedSignal);
    socket.on('user-disconnected', handleUserDisconnected);

    return () => {
      socket.off('user-connected', handleUserConnected);
      socket.off('user-joined', handleUserJoined);
      socket.off('receiving-returned-signal', handleReturnedSignal);
      socket.off('user-disconnected', handleUserDisconnected);
    };
  }, [socket, isStreamer, screenStream, audioStream, createPeer, addPeer]);

  // Start screen sharing
  const startScreenShare = async () => {
    try {
      setError(null);
      const screen = await navigator.mediaDevices.getDisplayMedia({
        video: {
          cursor: 'always',
          displaySurface: 'monitor',
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
        }
      });

      setScreenStream(screen);
      setIsSharing(true);

      // Show the screen in the streamer's video element
      if (userVideoRef.current && isStreamer) {
        userVideoRef.current.srcObject = screen;
        userVideoRef.current.onloadedmetadata = () => {
          userVideoRef.current.play().catch(err => {
            console.warn('Autoplay prevented:', err);
          });
        };
      }

      // Update all existing peers with new stream - handle video and audio separately
      peersRef.current.forEach(({ peer }) => {
        if (peer && peer._pc && !peer.destroyed) {
          // Add video tracks from screen
          screen.getVideoTracks().forEach(videoTrack => {
            try {
              const senders = peer._pc.getSenders();
              const videoSender = senders.find(s => s.track && s.track.kind === 'video');
              if (videoSender) {
                videoSender.replaceTrack(videoTrack);
              } else {
                peer._pc.addTrack(videoTrack, screen);
              }
            } catch (err) {
              console.error('Error updating peer video track:', err);
            }
          });

          // Add audio tracks separately if available and not muted
          if (audioStream) {
            audioStream.getAudioTracks().forEach(audioTrack => {
              try {
                const senders = peer._pc.getSenders();
                const audioSender = senders.find(s => s.track && s.track.kind === 'audio');
                if (audioSender) {
                  audioSender.replaceTrack(audioTrack);
                } else {
                  peer._pc.addTrack(audioTrack, audioStream);
                }
              } catch (err) {
                console.error('Error updating peer audio track:', err);
              }
            });
          }
        }
      });

      // Handle screen share stop
      screen.getVideoTracks()[0].onended = () => {
        stopScreenShare();
      };
    } catch (err) {
      console.error('Error starting screen share:', err);
      setError(err.message || 'Failed to start screen sharing. Please check permissions.');
    }
  };

  // Toggle mute
  const toggleMute = () => {
    if (audioStream) {
      const audioTracks = audioStream.getAudioTracks();
      const newMutedState = !isMuted;
      
      // Simply toggle the enabled state of audio tracks
      audioTracks.forEach(track => {
        track.enabled = !newMutedState;
      });
      
      setIsMuted(newMutedState);
      console.log(`Audio ${newMutedState ? 'muted' : 'unmuted'}`);

      // No need to update peers - the track enabled state handles this automatically
    } else {
      console.warn('No audio stream available to mute/unmute');
    }
  };

  return (
    <div className="flex flex-col space-y-4">
      {error && (
        <div className="bg-red-600 text-white p-4 rounded">
          {error}
        </div>
      )}

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
          <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 px-2 py-1 rounded text-white">
            You (Streaming) {isSharing ? '- Screen Sharing' : '- Ready to Share'}
          </div>
          {/* Audio visualizer overlay */}
          <div className="absolute top-2 right-2 bg-black bg-opacity-50 px-3 py-2 rounded flex items-center space-x-2">
            <AudioVisualizer 
              audioLevel={audioLevel} 
              isActive={isAudioActive} 
              isMuted={isMuted} 
            />
            <span className="text-white text-xs">
              {isMuted ? 'Muted' : (isAudioActive ? 'Speaking' : 'Quiet')}
            </span>
          </div>
          {!isSharing && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-700 bg-opacity-50">
              <div className="text-white text-center">
                <p className="mb-4">Click "Share Screen" to start streaming</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Viewer's view */}
      {!isStreamer && (
        <div className="relative bg-gray-800 rounded-lg overflow-hidden aspect-video">
          <video
            ref={userVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-contain"
          />
          <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 px-2 py-1 rounded text-white">
            {peers.length > 0 ? (peers[0].userName || 'Streamer') : 'Waiting for stream...'}
          </div>
          {/* Audio visualizer for viewer's own mic */}
          <div className="absolute top-2 right-2 bg-black bg-opacity-50 px-3 py-2 rounded flex items-center space-x-2">
            <AudioVisualizer 
              audioLevel={audioLevel} 
              isActive={isAudioActive} 
              isMuted={isMuted} 
            />
            <span className="text-white text-xs">
              Your Mic: {isMuted ? 'Muted' : (isAudioActive ? 'Active' : 'Quiet')}
            </span>
          </div>
          {peers.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-700 bg-opacity-50">
              <div className="text-white text-center">
                <p>Waiting for streamer to start sharing...</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Controls */}
      <div className="flex justify-center space-x-4">
        <div className="flex items-center space-x-2 bg-gray-100 px-4 py-2 rounded">
          <AudioVisualizer 
            audioLevel={audioLevel} 
            isActive={isAudioActive} 
            isMuted={isMuted} 
          />
          <button
            onClick={toggleMute}
            className={`px-4 py-2 rounded font-semibold text-white ${
              isMuted ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'
            }`}
            disabled={!audioStream}
          >
            {isMuted ? '🔇 Unmute' : '🎤 Mute'}
          </button>
        </div>

        {isStreamer && (
          <button
            onClick={isSharing ? stopScreenShare : startScreenShare}
            className={`px-4 py-2 rounded font-semibold text-white ${
              isSharing ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {isSharing ? '🛑 Stop Sharing' : '🖥️ Share Screen'}
          </button>
        )}
      </div>

      {/* Enhanced status indicator */}
      <div className="text-center text-sm text-gray-600 space-y-1">
        <div className="flex justify-center items-center space-x-4">
          <div className="flex items-center space-x-2">
            <span>Audio:</span>
            <AudioVisualizer 
              audioLevel={audioLevel} 
              isActive={isAudioActive} 
              isMuted={isMuted} 
            />
            <span className={`font-semibold ${
              !audioStream ? 'text-red-500' : 
              isMuted ? 'text-red-500' : 
              isAudioActive ? 'text-green-500' : 'text-gray-500'
            }`}>
              {!audioStream ? 'Not available' : 
               isMuted ? 'Muted' : 
               isAudioActive ? 'Active' : 'Standby'}
            </span>
          </div>
          {isStreamer && (
            <div className="flex items-center space-x-2">
              <span>Screen:</span>
              <span className={`font-semibold ${isSharing ? 'text-green-500' : 'text-gray-500'}`}>
                {isSharing ? 'Sharing' : 'Not sharing'}
              </span>
            </div>
          )}
        </div>
        <div className="text-xs text-gray-500">
          {isAudioActive && !isMuted ? '🔊 Audio detected' : '🔇 No audio detected'}
        </div>
      </div>
    </div>
  );
};

export default StreamManager; 