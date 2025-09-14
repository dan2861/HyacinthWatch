import React, { useState, useEffect } from 'react';
import { statsAPI } from '../api';
import { ObservationStats } from '../types';

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<ObservationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await statsAPI.getStats();
        setStats(response.data);
      } catch (err) {
        setError('Failed to fetch statistics');
        console.error('Error fetching stats:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (loading) return <div className="loading">Loading dashboard...</div>;
  if (error) return <div className="error">Error: {error}</div>;
  if (!stats) return <div className="error">No data available</div>;

  return (
    <div className="dashboard">
      <h2>Dashboard</h2>
      <div className="stats-grid">
        <div className="stat-card">
          <h3>Total Observations</h3>
          <div className="stat-number">{stats.total_observations}</div>
        </div>
        <div className="stat-card">
          <h3>Pending QC</h3>
          <div className="stat-number">{stats.pending_qc}</div>
        </div>
        <div className="stat-card">
          <h3>Approved</h3>
          <div className="stat-number">{stats.approved}</div>
        </div>
        <div className="stat-card">
          <h3>Processing</h3>
          <div className="stat-number">{stats.processing}</div>
        </div>
        <div className="stat-card">
          <h3>Rejected</h3>
          <div className="stat-number">{stats.rejected}</div>
        </div>
      </div>
      
      <div className="recent-activity">
        <h3>Recent Activity</h3>
        <p>Recent observations and QC activities will appear here...</p>
      </div>
    </div>
  );
};

export default Dashboard;