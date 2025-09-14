import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { observationAPI } from '../api';
import { Observation } from '../types';

const ObservationList: React.FC = () => {
  const [observations, setObservations] = useState<Observation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    status: '',
    location: '',
    page: 1
  });

  useEffect(() => {
    const fetchObservations = async () => {
      try {
        setLoading(true);
        const response = await observationAPI.getObservations(filters);
        setObservations(response.data.results);
      } catch (err) {
        setError('Failed to fetch observations');
        console.error('Error fetching observations:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchObservations();
  }, [filters]);

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value, page: 1 }));
  };

  const getStatusBadge = (status: string) => {
    return (
      <span className={`status-badge status-${status}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  if (loading) return <div className="loading">Loading observations...</div>;
  if (error) return <div className="error">Error: {error}</div>;

  return (
    <div className="observation-list">
      <div className="page-header">
        <h2>Observations</h2>
        <div className="filters">
          <select 
            value={filters.status} 
            onChange={(e) => handleFilterChange('status', e.target.value)}
          >
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="processing">Processing</option>
          </select>
          <input
            type="text"
            placeholder="Filter by location"
            value={filters.location}
            onChange={(e) => handleFilterChange('location', e.target.value)}
          />
        </div>
      </div>

      <div className="observations-grid">
        {observations.map(observation => (
          <div key={observation.id} className="observation-card">
            <Link to={`/observations/${observation.id}`}>
              <div className="card-image">
                <img src={observation.image} alt="Water hyacinth observation" />
                {getStatusBadge(observation.status)}
              </div>
              <div className="card-content">
                <h4>Observation #{observation.id}</h4>
                <p><strong>User:</strong> {observation.user.username}</p>
                <p><strong>Location:</strong> {observation.location_name || 'Unknown'}</p>
                <p><strong>Coverage:</strong> {observation.coverage_estimate ? `${observation.coverage_estimate}%` : 'Not estimated'}</p>
                <p><strong>Date:</strong> {new Date(observation.captured_at).toLocaleDateString()}</p>
              </div>
            </Link>
          </div>
        ))}
      </div>

      {observations.length === 0 && (
        <div className="empty-state">
          <p>No observations found matching your criteria.</p>
        </div>
      )}
    </div>
  );
};

export default ObservationList;