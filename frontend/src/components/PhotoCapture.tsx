import React, { useState, useRef, useCallback } from 'react';
import { observationAPI } from '../api';

interface PhotoCaptureProps {
  onCapture?: (observation: any) => void;
}

const PhotoCapture: React.FC<PhotoCaptureProps> = ({ onCapture }) => {
  const [isCapturing, setIsCapturing] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [location, setLocation] = useState<{latitude: number, longitude: number} | null>(null);
  const [formData, setFormData] = useState({
    location_name: '',
    notes: '',
    water_body_type: '',
    weather_conditions: '',
    coverage_estimate: ''
  });
  const [submitting, setSubmitting] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const startCamera = useCallback(async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: 'environment', // Use back camera on mobile
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });
      
      setStream(mediaStream);
      setIsCapturing(true);
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      
      // Get location
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            setLocation({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude
            });
          },
          (error) => {
            console.error('Error getting location:', error);
          },
          { enableHighAccuracy: true, timeout: 10000 }
        );
      }
    } catch (err) {
      console.error('Error starting camera:', err);
      alert('Could not access camera. Please check permissions.');
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setIsCapturing(false);
  }, [stream]);

  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    
    if (!context) return;
    
    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // Draw video frame to canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Convert to data URL
    const photoDataUrl = canvas.toDataURL('image/jpeg', 0.8);
    setPhoto(photoDataUrl);
    
    // Stop camera
    stopCamera();
  }, [stopCamera]);

  const dataURLtoFile = (dataurl: string, filename: string): File => {
    const arr = dataurl.split(',');
    const mime = arr[0].match(/:(.*?);/)![1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
  };

  const submitObservation = async () => {
    if (!photo || !location) {
      alert('Photo and location are required');
      return;
    }
    
    setSubmitting(true);
    
    try {
      const file = dataURLtoFile(photo, `observation_${Date.now()}.jpg`);
      const submitData = new FormData();
      
      submitData.append('image', file);
      submitData.append('latitude', location.latitude.toString());
      submitData.append('longitude', location.longitude.toString());
      submitData.append('captured_at', new Date().toISOString());
      
      // Add optional fields
      if (formData.location_name) submitData.append('location_name', formData.location_name);
      if (formData.notes) submitData.append('notes', formData.notes);
      if (formData.water_body_type) submitData.append('water_body_type', formData.water_body_type);
      if (formData.weather_conditions) submitData.append('weather_conditions', formData.weather_conditions);
      if (formData.coverage_estimate) submitData.append('coverage_estimate', formData.coverage_estimate);
      
      const response = await observationAPI.createObservation(submitData);
      
      if (onCapture) {
        onCapture(response.data);
      }
      
      // Reset form
      setPhoto(null);
      setLocation(null);
      setFormData({
        location_name: '',
        notes: '',
        water_body_type: '',
        weather_conditions: '',
        coverage_estimate: ''
      });
      
      alert('Observation submitted successfully!');
    } catch (err) {
      console.error('Error submitting observation:', err);
      alert('Failed to submit observation. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const retakePhoto = () => {
    setPhoto(null);
    startCamera();
  };

  return (
    <div className="photo-capture">
      <h2>📸 Capture Water Hyacinth Observation</h2>
      
      {!isCapturing && !photo && (
        <div className="capture-start">
          <p>Take a photo of water hyacinth to create an observation.</p>
          <button onClick={startCamera} className="btn btn-primary">
            Start Camera
          </button>
        </div>
      )}
      
      {isCapturing && (
        <div className="camera-view">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            style={{ width: '100%', maxHeight: '400px', objectFit: 'cover' }}
          />
          <div className="camera-controls">
            <button onClick={capturePhoto} className="btn btn-primary">
              📸 Capture Photo
            </button>
            <button onClick={stopCamera} className="btn btn-secondary">
              Cancel
            </button>
          </div>
          {location && (
            <p className="location-status">
              📍 Location captured: {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
            </p>
          )}
        </div>
      )}
      
      {photo && (
        <div className="photo-review">
          <img src={photo} alt="Captured observation" style={{ width: '100%', maxHeight: '400px', objectFit: 'cover' }} />
          
          <form className="observation-form">
            <div className="form-group">
              <label>Location Name (optional)</label>
              <input
                type="text"
                value={formData.location_name}
                onChange={(e) => setFormData({ ...formData, location_name: e.target.value })}
                placeholder="e.g., Lake Smith, North Shore"
              />
            </div>
            
            <div className="form-group">
              <label>Water Body Type (optional)</label>
              <select
                value={formData.water_body_type}
                onChange={(e) => setFormData({ ...formData, water_body_type: e.target.value })}
              >
                <option value="">Select type...</option>
                <option value="lake">Lake</option>
                <option value="pond">Pond</option>
                <option value="river">River</option>
                <option value="canal">Canal</option>
                <option value="wetland">Wetland</option>
                <option value="other">Other</option>
              </select>
            </div>
            
            <div className="form-group">
              <label>Estimated Coverage % (optional)</label>
              <input
                type="number"
                min="0"
                max="100"
                value={formData.coverage_estimate}
                onChange={(e) => setFormData({ ...formData, coverage_estimate: e.target.value })}
                placeholder="0-100"
              />
            </div>
            
            <div className="form-group">
              <label>Weather Conditions (optional)</label>
              <input
                type="text"
                value={formData.weather_conditions}
                onChange={(e) => setFormData({ ...formData, weather_conditions: e.target.value })}
                placeholder="e.g., Sunny, overcast, windy"
              />
            </div>
            
            <div className="form-group">
              <label>Notes (optional)</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Additional observations or notes..."
                rows={3}
              />
            </div>
          </form>
          
          <div className="photo-actions">
            <button 
              onClick={submitObservation} 
              disabled={submitting} 
              className="btn btn-primary"
            >
              {submitting ? 'Submitting...' : 'Submit Observation'}
            </button>
            <button onClick={retakePhoto} className="btn btn-secondary">
              Retake Photo
            </button>
          </div>
          
          {location && (
            <p className="location-info">
              📍 Location: {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
            </p>
          )}
        </div>
      )}
      
      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  );
};

export default PhotoCapture;