import './polyfills';
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import VideoStreamingApp from './components/VideoStreamingApp';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-100">
        <nav className="bg-white shadow-lg">
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex justify-between h-16">
              <div className="flex">
                <Link to="/" className="flex items-center text-xl font-bold text-gray-800">
                  Live Stream
                </Link>
              </div>
            </div>
          </div>
        </nav>

        <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <Routes>
            <Route path="/" element={<VideoStreamingApp />} />
            <Route path="/room/:roomId" element={<VideoStreamingApp />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
}

export default App;