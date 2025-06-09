import React, { useState, useEffect, useRef } from 'react';

const ChatRoom = ({ socket, roomId, userName }) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [typingUsers, setTypingUsers] = useState(new Set());
  const messagesEndRef = useRef(null);
  const chatInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // Common emojis for quick access
  const quickEmojis = ['👍', '👎', '😂', '❤️', '😮', '😢', '😡', '🎉', '👏', '🔥'];

  // Scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Handle incoming chat messages and typing indicators
  useEffect(() => {
    if (!socket) return;

    const handleChatMessage = (messageData) => {
      const isOwn = messageData.id === socket.id;
      setMessages(prev => [...prev, {
        ...messageData,
        isOwn,
        id: `${messageData.id}-${messageData.timestamp}` // Unique ID for React key
      }]);
      
      // Remove typing indicator when message is received
      if (!isOwn) {
        setTypingUsers(prev => {
          const newSet = new Set(prev);
          newSet.delete(messageData.userName);
          return newSet;
        });
      }
    };

    const handleTypingStart = ({ userId, userName }) => {
      if (userId !== socket.id) {
        setTypingUsers(prev => new Set(prev).add(userName));
      }
    };

    const handleTypingStop = ({ userId, userName }) => {
      if (userId !== socket.id) {
        setTypingUsers(prev => {
          const newSet = new Set(prev);
          newSet.delete(userName);
          return newSet;
        });
      }
    };

    socket.on('chat-message', handleChatMessage);
    socket.on('typing-start', handleTypingStart);
    socket.on('typing-stop', handleTypingStop);

    return () => {
      socket.off('chat-message', handleChatMessage);
      socket.off('typing-start', handleTypingStart);
      socket.off('typing-stop', handleTypingStop);
    };
  }, [socket]);

  // Send message
  const sendMessage = (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !socket) return;

    const messageData = {
      roomId,
      message: newMessage.trim(),
      userName,
      timestamp: Date.now()
    };

    socket.emit('chat-message', messageData);
    setNewMessage('');
  };

  // Send emoji
  const sendEmoji = (emoji) => {
    if (!socket) return;

    const messageData = {
      roomId,
      message: emoji,
      userName,
      timestamp: Date.now()
    };

    socket.emit('chat-message', messageData);
  };

  // Handle typing indicators
  const handleInputChange = (e) => {
    const value = e.target.value;
    setNewMessage(value);

    if (!socket) return;

    if (value.trim() && !typingTimeoutRef.current) {
      // Start typing
      socket.emit('typing-start', { roomId, userName });
    }

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set new timeout to stop typing
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('typing-stop', { roomId, userName });
      typingTimeoutRef.current = null;
    }, 1000);

    // If input is empty, stop typing immediately
    if (!value.trim()) {
      socket.emit('typing-stop', { roomId, userName });
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
  };

  // Format timestamp
  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  // Focus input when expanded
  useEffect(() => {
    if (isExpanded && chatInputRef.current) {
      chatInputRef.current.focus();
    }
  }, [isExpanded]);

  // Cleanup typing timeout on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className={`bg-white rounded-lg shadow-md transition-all duration-300 ${
      isExpanded ? 'h-96' : 'h-16'
    }`}>
      {/* Chat Header */}
      <div 
        className="flex items-center justify-between p-4 border-b cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
          <h3 className="font-semibold text-gray-800">
            💬 Chat Room {messages.length > 0 && `(${messages.length})`}
          </h3>
          {messages.length > 0 && !isExpanded && (
            <div className="bg-green-500 text-white text-xs px-2 py-1 rounded-full">
              {messages.length}
            </div>
          )}
        </div>
        <button className="text-gray-500 hover:text-gray-700 transition-colors">
          {isExpanded ? '▼' : '▲'}
        </button>
      </div>

      {/* Chat Content */}
      {isExpanded && (
        <div className="flex flex-col h-80">
          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 ? (
              <div className="text-center text-gray-500 text-sm">
                No messages yet. Start the conversation! 👋
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.isOwn ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-xs lg:max-w-md px-3 py-2 rounded-lg ${
                      msg.isOwn
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-200 text-gray-800'
                    }`}
                  >
                    {!msg.isOwn && (
                      <div className="text-xs font-semibold mb-1 opacity-75">
                        {msg.userName}
                      </div>
                    )}
                    <div className="break-words">{msg.message}</div>
                    <div className={`text-xs mt-1 ${
                      msg.isOwn ? 'text-blue-100' : 'text-gray-500'
                    }`}>
                      {formatTime(msg.timestamp)}
                    </div>
                  </div>
                </div>
              ))
            )}
            
            {/* Typing Indicators */}
            {typingUsers.size > 0 && (
              <div className="flex items-center space-x-2 text-gray-500 text-sm italic">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
                <span>
                  {Array.from(typingUsers).join(', ')} {typingUsers.size === 1 ? 'is' : 'are'} typing...
                </span>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Emojis */}
          <div className="px-4 py-2 border-t bg-gray-50">
            <div className="flex space-x-2 overflow-x-auto">
              {quickEmojis.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => sendEmoji(emoji)}
                  className="flex-shrink-0 text-xl hover:bg-gray-200 rounded p-1 transition-colors"
                  title={`Send ${emoji}`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          {/* Message Input */}
          <form onSubmit={sendMessage} className="p-4 border-t">
            <div className="flex space-x-2">
              <input
                ref={chatInputRef}
                type="text"
                value={newMessage}
                onChange={handleInputChange}
                placeholder="Type a message..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                maxLength={500}
              />
              <button
                type="submit"
                disabled={!newMessage.trim()}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Send
              </button>
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {newMessage.length}/500 characters
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default ChatRoom; 