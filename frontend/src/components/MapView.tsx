import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { observationAPI } from '../api';
import { Observation } from '../types';
import 'leaflet/dist/leaflet.css';

// Fix for default markers in react-leaflet
import L from 'leaflet';

let DefaultIcon = L.divIcon({
  html: '📍',
  iconSize: [25, 25],
  className: 'custom-div-icon'
});

L.Marker.prototype.options.icon = DefaultIcon;

const MapView: React.FC = () => {
  const [observations, setObservations] = useState<Observation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string>('');

  useEffect(() => {
    const fetchObservations = async () => {
      try {
        const params = selectedStatus ? { status: selectedStatus } : {};
        const response = await observationAPI.getObservations(params);
        setObservations(response.data.results);
      } catch (err) {
        setError('Failed to fetch observations');
        console.error('Error fetching observations:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchObservations();
  }, [selectedStatus]);

  const getMarkerColor = (status: string) => {
    const colors = {
      pending: '🟡',
      approved: '🟢',
      rejected: '🔴',
      processing: '🔵'
    };
    return colors[status as keyof typeof colors] || '⚪';
  };

  if (loading) return <div className="loading">Loading map...</div>;
  if (error) return <div className="error">Error: {error}</div>;

  return (
    <div className="map-view">
      <div className="map-controls">
        <h2>Observation Map</h2>
        <select 
          value={selectedStatus} 
          onChange={(e) => setSelectedStatus(e.target.value)}
        >
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="processing">Processing</option>
        </select>
      </div>

      <div className="map-container">
        <MapContainer
          center={[0, 0]} // Default center, will be adjusted based on observations
          zoom={2}
          style={{ height: '600px', width: '100%' }}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />
          
          {observations.map(observation => (
            <Marker
              key={observation.id}
              position={[observation.latitude, observation.longitude]}
            >
              <Popup>
                <div className="popup-content">
                  <h4>Observation #{observation.id}</h4>
                  <p><strong>Status:</strong> {getMarkerColor(observation.status)} {observation.status}</p>
                  <p><strong>User:</strong> {observation.user.username}</p>
                  <p><strong>Date:</strong> {new Date(observation.captured_at).toLocaleDateString()}</p>
                  {observation.location_name && (
                    <p><strong>Location:</strong> {observation.location_name}</p>
                  )}
                  {observation.coverage_estimate && (
                    <p><strong>Coverage:</strong> {observation.coverage_estimate}%</p>
                  )}
                  <img 
                    src={observation.image} 
                    alt="Water hyacinth observation" 
                    style={{ width: '200px', height: 'auto', marginTop: '10px' }}
                  />
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      <div className="map-legend">
        <h4>Legend</h4>
        <div className="legend-item">🟡 Pending QC</div>
        <div className="legend-item">🟢 Approved</div>
        <div className="legend-item">🔴 Rejected</div>
        <div className="legend-item">🔵 Processing</div>
      </div>
    </div>
  );
};

export default MapView;