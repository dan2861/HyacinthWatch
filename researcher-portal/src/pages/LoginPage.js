import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { apiClient } from '../api/client';
import { signInWithPassword, getAccessToken } from '../utils/supabase';
import { config } from '../config';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [useToken, setUseToken] = useState(false); // Toggle between email/password and token entry
  const navigate = useNavigate();
  const { setUser } = useAuthStore();
  
  const hasSupabaseConfig = !!(config.supabaseUrl && config.supabaseAnonKey);

  // For now, use Supabase token from localStorage or allow direct token entry
  // Adjust based on your actual auth flow
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      let token = null;
      let userInfo = null;
      
      if (useToken) {
        // Token-based login (manual token entry)
        const isValidJWT = (str) => {
          if (!str || typeof str !== 'string') return false;
          const parts = str.split('.');
          return parts.length === 3 && parts.every(part => part.length > 0);
        };
        
        // Try to get Supabase token from localStorage first
        token = localStorage.getItem('sb_token') || localStorage.getItem('sb_access_token') || localStorage.getItem('auth_token');
        
        // If password field is provided and looks like a JWT, use it as token
        if (!token && password && isValidJWT(password)) {
          token = password;
        } else if (!token && password) {
          setError('Invalid token format. Please enter a valid Supabase JWT token (should be a long string with dots, like "eyJ...").');
          return;
        }
        
        if (!token || !isValidJWT(token)) {
          setError('No valid token found. Please enter a valid Supabase JWT token.');
          return;
        }
      } else {
        // Email/password login with Supabase
        if (!hasSupabaseConfig) {
          setError('Supabase is not configured. Please set REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY, or use token login mode.');
          return;
        }
        
        if (!email || !password) {
          setError('Please enter both email and password.');
          return;
        }
        
        try {
          const result = await signInWithPassword(email, password);
          token = result.access_token;
          userInfo = result.user;
        } catch (authError) {
          setError(authError.message || 'Login failed. Please check your email and password.');
          return;
        }
      }
      
      // Store token for API client
      if (token) {
        localStorage.setItem('auth_token', token);
        localStorage.setItem('sb_token', token);
        apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      }
      
      // Try to get current user to verify token works
      try {
        const userResponse = await apiClient.get('/v1/game/profile');
        setUser({ 
          id: userResponse.data.user || userInfo?.id || email, 
          username: userResponse.data.user || userInfo?.email || email, 
          email: userInfo?.email || email || null 
        });
      } catch (profileErr) {
        // If profile endpoint doesn't work, use Supabase user info if available
        if (userInfo) {
          setUser({ 
            id: userInfo.id, 
            username: userInfo.email || email, 
            email: userInfo.email || email || null 
          });
        } else {
          console.warn('Profile endpoint failed, but proceeding with login:', profileErr);
          setUser({ id: email || 'user', username: email || 'user', email: email || null });
        }
      }
      
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="max-w-md w-full space-y-8 bg-white dark:bg-gray-800 p-8 rounded-lg shadow">
        <div>
          <h2 className="text-3xl font-bold text-center text-gray-900 dark:text-white">
            Researcher Portal
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
            Sign in to access the dashboard
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 px-4 py-3 rounded">
              {error}
            </div>
          )}
          {/* Toggle between email/password and token login */}
          <div className="flex items-center justify-center gap-2 mb-4">
            <button
              type="button"
              onClick={() => setUseToken(false)}
              className={`px-4 py-2 text-sm rounded-md transition-colors ${
                !useToken
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              Email & Password
            </button>
            <button
              type="button"
              onClick={() => setUseToken(true)}
              className={`px-4 py-2 text-sm rounded-md transition-colors ${
                useToken
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              Token Login
            </button>
          </div>
          
          {!useToken ? (
            <>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="your@email.com"
                  disabled={loading}
                />
              </div>
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter your password"
                  disabled={loading}
                />
                {!hasSupabaseConfig && (
                  <p className="mt-1 text-xs text-yellow-600 dark:text-yellow-400">
                    ⚠️ Supabase not configured. Please set REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY for email/password login.
                  </p>
                )}
              </div>
            </>
          ) : (
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Supabase Access Token (JWT)
              </label>
              <input
                id="password"
                type="text"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                disabled={loading}
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Enter your Supabase JWT access token. Get one by logging into the PWA app first.
              </p>
            </div>
          )}
          <div>
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

