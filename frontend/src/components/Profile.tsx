import React, { useState, useEffect } from 'react';
import { userAPI } from '../api';
import { User } from '../types';

const Profile: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState<Partial<User>>({});

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await userAPI.getProfile();
        setUser(response.data);
        setFormData(response.data);
      } catch (err) {
        setError('Failed to fetch profile');
        console.error('Error fetching profile:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

  const handleSave = async () => {
    try {
      const response = await userAPI.updateProfile(formData);
      setUser(response.data);
      setEditing(false);
    } catch (err) {
      setError('Failed to update profile');
      console.error('Error updating profile:', err);
    }
  };

  const handleCancel = () => {
    setFormData(user || {});
    setEditing(false);
  };

  if (loading) return <div className="loading">Loading profile...</div>;
  if (error) return <div className="error">Error: {error}</div>;
  if (!user) return <div className="error">Profile not found</div>;

  return (
    <div className="profile">
      <div className="profile-header">
        <h2>User Profile</h2>
        {!editing && (
          <button onClick={() => setEditing(true)} className="btn btn-primary">
            Edit Profile
          </button>
        )}
      </div>

      <div className="profile-content">
        {editing ? (
          <form className="profile-form">
            <div className="form-group">
              <label>Username</label>
              <input
                type="text"
                value={formData.username || ''}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                value={formData.email || ''}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label>Organization</label>
              <input
                type="text"
                value={formData.organization || ''}
                onChange={(e) => setFormData({ ...formData, organization: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label>Location</label>
              <input
                type="text"
                value={formData.location || ''}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label>Bio</label>
              <textarea
                value={formData.bio || ''}
                onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                rows={4}
              />
            </div>

            <div className="form-actions">
              <button type="button" onClick={handleSave} className="btn btn-primary">
                Save Changes
              </button>
              <button type="button" onClick={handleCancel} className="btn btn-secondary">
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <div className="profile-display">
            <div className="profile-info">
              <h3>Basic Information</h3>
              <p><strong>Username:</strong> {user.username}</p>
              <p><strong>Email:</strong> {user.email}</p>
              <p><strong>Role:</strong> {user.role}</p>
              <p><strong>Member since:</strong> {new Date(user.date_joined).toLocaleDateString()}</p>
            </div>

            {(user.organization || user.location) && (
              <div className="profile-info">
                <h3>Additional Information</h3>
                {user.organization && <p><strong>Organization:</strong> {user.organization}</p>}
                {user.location && <p><strong>Location:</strong> {user.location}</p>}
              </div>
            )}

            {user.bio && (
              <div className="profile-info">
                <h3>Bio</h3>
                <p>{user.bio}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Profile;