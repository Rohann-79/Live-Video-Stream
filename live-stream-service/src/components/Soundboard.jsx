import React, { useState, useEffect, useRef } from 'react';

const Soundboard = ({ socket, roomId, userName }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [playingSound, setPlayingSound] = useState(null);
  const [soundNotifications, setSoundNotifications] = useState([]);
  const audioRefs = useRef({});

  // Predefined sound effects with descriptions
  const soundEffects = [
    { id: 'applause', name: '👏 Applause', emoji: '👏', description: 'Clapping sounds' },
    { id: 'laugh', name: '😂 Laugh Track', emoji: '😂', description: 'Audience laughter' },
    { id: 'drumroll', name: '🥁 Drum Roll', emoji: '🥁', description: 'Suspenseful drumroll' },
    { id: 'airhorn', name: '📯 Air Horn', emoji: '📯', description: 'Loud air horn' },
    { id: 'crickets', name: '🦗 Crickets', emoji: '🦗', description: 'Awkward silence' },
    { id: 'tada', name: '🎉 Ta-da!', emoji: '🎉', description: 'Success fanfare' },
    { id: 'boo', name: '👻 Boo', emoji: '👻', description: 'Disapproval sound' },
    { id: 'wow', name: '😮 Wow', emoji: '😮', description: 'Amazement sound' },
    { id: 'bell', name: '🔔 Bell', emoji: '🔔', description: 'Notification bell' },
    { id: 'whistle', name: '🎵 Whistle', emoji: '🎵', description: 'Sharp whistle' }
  ];

  // Handle incoming soundboard events
  useEffect(() => {
    if (!socket) return;

    const handleSoundboardPlay = ({ soundName, userName: senderName, timestamp }) => {
      // Show notification
      const notification = {
        id: `${timestamp}-${Math.random()}`,
        soundName,
        userName: senderName,
        timestamp
      };
      
      setSoundNotifications(prev => [...prev, notification]);
      
      // Remove notification after 3 seconds
      setTimeout(() => {
        setSoundNotifications(prev => prev.filter(n => n.id !== notification.id));
      }, 3000);

      // Play the sound locally
      playLocalSound(soundName);
    };

    socket.on('soundboard-play', handleSoundboardPlay);

    return () => {
      socket.off('soundboard-play', handleSoundboardPlay);
    };
  }, [socket]);

  // Create audio elements for sound effects (using Web Audio API)
  const playLocalSound = (soundId) => {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      
      const sounds = {
        applause: () => createApplauseSound(audioContext),
        laugh: () => createLaughSound(audioContext),
        drumroll: () => createDrumrollSound(audioContext),
        airhorn: () => createAirhornSound(audioContext),
        crickets: () => createCricketsSound(audioContext),
        tada: () => createTadaSound(audioContext),
        boo: () => createBooSound(audioContext),
        wow: () => createWowSound(audioContext),
        bell: () => createBellSound(audioContext),
        whistle: () => createWhistleSound(audioContext)
      };

      if (sounds[soundId]) {
        sounds[soundId]();
      }
    } catch (error) {
      console.warn('Audio playback failed:', error);
      // Fallback to simple beep
      createSimpleBeep();
    }
  };

  // Enhanced sound creation functions
  const createApplauseSound = (audioContext) => {
    for (let i = 0; i < 20; i++) {
      setTimeout(() => {
        createNoiseSound(audioContext, 1000 + Math.random() * 2000, 0.1);
      }, i * 50);
    }
  };

  const createLaughSound = (audioContext) => {
    const frequencies = [300, 400, 350, 320, 380];
    frequencies.forEach((freq, index) => {
      setTimeout(() => {
        createOscillatorSound(audioContext, [freq], 0.15);
      }, index * 100);
    });
  };

  const createDrumrollSound = (audioContext) => {
    for (let i = 0; i < 30; i++) {
      setTimeout(() => {
        createNoiseSound(audioContext, 200, 0.05);
      }, i * 50);
    }
  };

  const createAirhornSound = (audioContext) => {
    createOscillatorSound(audioContext, [440, 880, 1320], 0.8);
  };

  const createCricketsSound = (audioContext) => {
    for (let i = 0; i < 5; i++) {
      setTimeout(() => {
        createOscillatorSound(audioContext, [2000 + Math.random() * 400], 0.1);
      }, i * 200);
    }
  };

  const createTadaSound = (audioContext) => {
    const melody = [523, 659, 784, 1047]; // C, E, G, C
    melody.forEach((freq, index) => {
      setTimeout(() => {
        createOscillatorSound(audioContext, [freq], 0.2);
      }, index * 150);
    });
  };

  const createBooSound = (audioContext) => {
    createOscillatorSound(audioContext, [100, 80, 60], 1.0);
  };

  const createWowSound = (audioContext) => {
    createOscillatorSound(audioContext, [200, 400, 600, 800], 0.6);
  };

  const createBellSound = (audioContext) => {
    createOscillatorSound(audioContext, [800, 1600], 0.5);
  };

  const createWhistleSound = (audioContext) => {
    createOscillatorSound(audioContext, [2000, 2200, 2000], 0.4);
  };

  const createSimpleBeep = () => {
    // Fallback beep using HTML5 audio
    const oscillator = new (window.AudioContext || window.webkitAudioContext)();
    const osc = oscillator.createOscillator();
    const gain = oscillator.createGain();
    osc.connect(gain);
    gain.connect(oscillator.destination);
    osc.frequency.setValueAtTime(800, oscillator.currentTime);
    gain.gain.setValueAtTime(0.1, oscillator.currentTime);
    osc.start();
    osc.stop(oscillator.currentTime + 0.2);
  };

  // Create simple oscillator sound
  const createOscillatorSound = (audioContext, frequencies, duration) => {
    frequencies.forEach((freq, index) => {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.setValueAtTime(freq, audioContext.currentTime);
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.1, audioContext.currentTime + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);
      
      oscillator.start(audioContext.currentTime + index * 0.1);
      oscillator.stop(audioContext.currentTime + duration + index * 0.1);
    });
  };

  // Create noise sound
  const createNoiseSound = (audioContext, filterFreq, duration) => {
    const bufferSize = audioContext.sampleRate * duration;
    const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
    const data = buffer.getChannelData(0);
    
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    
    const source = audioContext.createBufferSource();
    const filter = audioContext.createBiquadFilter();
    const gainNode = audioContext.createGain();
    
    source.buffer = buffer;
    filter.frequency.setValueAtTime(filterFreq, audioContext.currentTime);
    gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
    
    source.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    source.start();
  };

  // Play sound and broadcast to room
  const playSound = (soundId) => {
    if (!socket) return;

    setPlayingSound(soundId);
    
    // Play locally first
    playLocalSound(soundId);
    
    // Broadcast to room
    socket.emit('soundboard-play', {
      roomId,
      soundName: soundId,
      userName
    });

    // Reset playing state after a short delay
    setTimeout(() => {
      setPlayingSound(null);
    }, 500);
  };

  return (
    <div className={`bg-white rounded-lg shadow-md transition-all duration-300 ${
      isExpanded ? 'h-80' : 'h-16'
    }`}>
      {/* Soundboard Header */}
      <div 
        className="flex items-center justify-between p-4 border-b cursor-pointer hover:bg-gray-50"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 bg-purple-500 rounded-full animate-pulse"></div>
          <h3 className="font-semibold text-gray-800">
            🎵 Soundboard
          </h3>
        </div>
        <button className="text-gray-500 hover:text-gray-700">
          {isExpanded ? '▼' : '▲'}
        </button>
      </div>

      {/* Sound Notifications */}
      {soundNotifications.length > 0 && (
        <div className="absolute top-0 right-0 mt-2 mr-2 z-10">
          {soundNotifications.map((notification) => (
            <div
              key={notification.id}
              className="bg-purple-500 text-white px-3 py-1 rounded-lg mb-1 text-sm animate-bounce"
            >
              🎵 {notification.userName} played a sound!
            </div>
          ))}
        </div>
      )}

      {/* Soundboard Content */}
      {isExpanded && (
        <div className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {soundEffects.map((sound) => (
              <button
                key={sound.id}
                onClick={() => playSound(sound.id)}
                disabled={playingSound === sound.id}
                className={`p-3 rounded-lg border-2 transition-all duration-200 ${
                  playingSound === sound.id
                    ? 'bg-purple-500 text-white border-purple-600 scale-95'
                    : 'bg-gray-50 hover:bg-purple-50 border-gray-200 hover:border-purple-300'
                }`}
                title={sound.description}
              >
                <div className="text-2xl mb-1">{sound.emoji}</div>
                <div className="text-xs font-medium text-center">
                  {sound.name.replace(/^.+ /, '')}
                </div>
              </button>
            ))}
          </div>
          
          <div className="mt-4 text-center text-xs text-gray-500">
            Click any sound to play it for everyone in the room! 🎉
          </div>
        </div>
      )}
    </div>
  );
};

export default Soundboard; 