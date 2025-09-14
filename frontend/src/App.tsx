import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate } from 'react-router-dom';
import Dashboard from './components/Dashboard';
import ObservationList from './components/ObservationList';
import ObservationDetail from './components/ObservationDetail';
import MapView from './components/MapView';
import Profile from './components/Profile';
import PhotoCapture from './components/PhotoCapture';
import './App.css';

function App() {
  return (
    <Router>
      <div className="App">
        <nav className="navbar">
          <div className="nav-brand">
            <h1>🌿 HyacinthWatch</h1>
            <p>Researcher Portal</p>
          </div>
          <div className="nav-links">
            <Link to="/dashboard" className="nav-link">Dashboard</Link>
            <Link to="/observations" className="nav-link">Observations</Link>
            <Link to="/map" className="nav-link">Map</Link>
            <Link to="/capture" className="nav-link">📸 Capture</Link>
            <Link to="/profile" className="nav-link">Profile</Link>
          </div>
        </nav>

        <main className="main-content">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/observations" element={<ObservationList />} />
            <Route path="/observations/:id" element={<ObservationDetail />} />
            <Route path="/map" element={<MapView />} />
            <Route path="/capture" element={<PhotoCapture />} />
            <Route path="/profile" element={<Profile />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
