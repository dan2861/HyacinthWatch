import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { observationAPI } from '../api';
import { Observation } from '../types';

const ObservationDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [observation, setObservation] = useState<Observation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchObservation = async () => {
      if (!id) return;
      
      try {
        const response = await observationAPI.getObservation(parseInt(id));
        setObservation(response.data);
      } catch (err) {
        setError('Failed to fetch observation details');
        console.error('Error fetching observation:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchObservation();
  }, [id]);

  const handleTriggerProcessing = async () => {
    if (!observation) return;
    
    try {
      await observationAPI.triggerProcessing(observation.id);
      // Refresh the observation data
      const response = await observationAPI.getObservation(observation.id);
      setObservation(response.data);
    } catch (err) {
      console.error('Error triggering processing:', err);
    }
  };

  if (loading) return <div className="loading">Loading observation...</div>;
  if (error) return <div className="error">Error: {error}</div>;
  if (!observation) return <div className="error">Observation not found</div>;

  return (
    <div className="observation-detail">
      <div className="detail-header">
        <h2>Observation #{observation.id}</h2>
        <span className={`status-badge status-${observation.status}`}>
          {observation.status.charAt(0).toUpperCase() + observation.status.slice(1)}
        </span>
      </div>

      <div className="detail-content">
        <div className="image-section">
          <img src={observation.image} alt="Water hyacinth observation" />
          {observation.segmentation && (
            <div className="segmentation-result">
              <h4>Segmentation Result</h4>
              <img src={observation.segmentation.segmented_image} alt="Segmented view" />
              <p><strong>Coverage:</strong> {observation.segmentation.coverage_percentage}%</p>
              <p><strong>Confidence:</strong> {(observation.segmentation.confidence_score * 100).toFixed(1)}%</p>
            </div>
          )}
        </div>

        <div className="info-section">
          <div className="info-group">
            <h3>Basic Information</h3>
            <p><strong>User:</strong> {observation.user.username} ({observation.user.role})</p>
            <p><strong>Captured:</strong> {new Date(observation.captured_at).toLocaleString()}</p>
            <p><strong>Location:</strong> {observation.location_name || 'Unknown'}</p>
            <p><strong>Coordinates:</strong> {observation.latitude}, {observation.longitude}</p>
            <p><strong>Water Body Type:</strong> {observation.water_body_type || 'Not specified'}</p>
            <p><strong>Weather:</strong> {observation.weather_conditions || 'Not specified'}</p>
          </div>

          {observation.notes && (
            <div className="info-group">
              <h3>Notes</h3>
              <p>{observation.notes}</p>
            </div>
          )}

          {observation.qc_score && (
            <div className="info-group">
              <h3>Quality Control Score</h3>
              <div className="qc-scores">
                <p><strong>Overall Score:</strong> {observation.qc_score.overall_score}/5</p>
                <p><strong>Image Quality:</strong> {observation.qc_score.image_quality}/5</p>
                <p><strong>Species Visibility:</strong> {observation.qc_score.species_visibility}/5</p>
                <p><strong>Location Accuracy:</strong> {observation.qc_score.location_accuracy}/5</p>
                <p><strong>Metadata Completeness:</strong> {observation.qc_score.metadata_completeness}/5</p>
                <p><strong>Reviewer:</strong> {observation.qc_score.reviewer.username}</p>
                {observation.qc_score.comments && (
                  <p><strong>Comments:</strong> {observation.qc_score.comments}</p>
                )}
              </div>
            </div>
          )}

          <div className="actions">
            {observation.status === 'pending' && (
              <button onClick={handleTriggerProcessing} className="btn btn-primary">
                Trigger Processing
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ObservationDetail;