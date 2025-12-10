# HyacinthWatch PWA

Progressive Web App for field data collection of water hyacinth observations.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Setup](#setup)
- [Development](#development)
- [Building for Production](#building-for-production)
- [PWA Features](#pwa-features)
- [API Integration](#api-integration)
- [Offline Support](#offline-support)

## Overview

The HyacinthWatch PWA is a React-based mobile web application designed for field data collection. It enables users to:

- Capture and upload photos of water hyacinth
- Record GPS coordinates automatically
- Work offline and sync when connection is restored
- View observation history
- Track gamification points and levels

## Features

### Core Functionality

- 📸 **Photo Capture**: Take photos or select from gallery
- 📍 **GPS Tracking**: Automatic location capture with accuracy metadata
- 📤 **Upload**: Upload observations to backend API
- 📋 **History**: View past observations
- 🎮 **Gamification**: View points and level progress
- 🔐 **Authentication**: Supabase-based user authentication

### PWA Capabilities

- ✅ **Installable**: Add to home screen on mobile devices
- ✅ **Offline Support**: Store observations locally when offline
- ✅ **Service Worker**: Background sync (planned)
- ✅ **Responsive**: Works on mobile and desktop

## Setup

### Prerequisites

- Node.js 18+
- npm or yarn
- Backend API running (see [../backend/README.md](../backend/README.md))

### Installation

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Configure environment**
   Create a `.env` file in the `hyacinthwatch-pwa/` directory:
   ```bash
   REACT_APP_API_BASE_URL=http://localhost:8000
   REACT_APP_SUPABASE_URL=https://your-project.supabase.co
   REACT_APP_SUPABASE_ANON_KEY=your-anon-key
   ```

3. **Start development server**
   ```bash
   npm start
   ```

   The app will open at http://localhost:3000

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `REACT_APP_API_BASE_URL` | Backend API base URL | `http://localhost:8000` |
| `REACT_APP_SUPABASE_URL` | Supabase project URL | Required |
| `REACT_APP_SUPABASE_ANON_KEY` | Supabase anonymous key | Required |

## Development

### Project Structure

```
hyacinthwatch-pwa/
├── public/
│   ├── index.html
│   ├── manifest.json      # PWA manifest
│   └── service-worker.js  # Service worker (planned)
├── src/
│   ├── components/         # React components
│   │   ├── GameProfile.js
│   │   ├── MapHelpers.js
│   │   ├── ObservationFeedback.js
│   │   ├── qcClient.js
│   │   └── qcLabels.js
│   ├── pages/             # Page components
│   │   ├── LoginPage.js
│   │   └── SignupPage.js
│   ├── api.js             # API client
│   ├── db.js              # IndexedDB utilities
│   ├── supabase.js        # Supabase client
│   ├── util.js            # Utility functions
│   └── App.js             # Main app component
└── package.json
```

### Key Components

#### `api.js`
API client for backend communication:
- `postObservation()` - Upload observation
- `getObservations()` - Fetch observation history
- `getGameProfile()` - Get user points/level

#### `db.js`
IndexedDB utilities for offline storage:
- Store observations when offline
- Sync when connection restored

#### `supabase.js`
Supabase client configuration:
- Authentication
- Session management
- Token refresh

### Development Workflow

1. **Start backend API** (see [../backend/README.md](../backend/README.md))
2. **Start PWA dev server**: `npm start`
3. **Make changes** - Hot reload enabled
4. **Test on mobile**: Use network IP or ngrok for mobile testing

### Testing on Mobile Devices

1. **Find your local IP**
   ```bash
   # macOS/Linux
   ifconfig | grep "inet "
   
   # Windows
   ipconfig
   ```

2. **Update CORS settings** in backend
   ```python
   # backend/hyacinthwatch/settings.py
   CORS_ALLOWED_ORIGINS = [
       'http://localhost:3000',
       'http://YOUR_IP:3000',
   ]
   ```

3. **Access from mobile**
   - Open `http://YOUR_IP:3000` on mobile device
   - Ensure mobile device is on same network

## Building for Production

### Build

```bash
npm run build
```

This creates an optimized production build in the `build/` directory.

### Deploy

The `build/` directory can be deployed to:

- **Static hosting**: Netlify, Vercel, GitHub Pages
- **CDN**: CloudFlare, AWS CloudFront
- **Web server**: Nginx, Apache

### Environment Variables for Production

Set environment variables in your hosting platform:
- `REACT_APP_API_BASE_URL` - Production API URL
- `REACT_APP_SUPABASE_URL` - Supabase URL
- `REACT_APP_SUPABASE_ANON_KEY` - Supabase anon key

**Note**: React requires `REACT_APP_` prefix for environment variables.

## PWA Features

### Manifest

The `public/manifest.json` defines PWA metadata:

```json
{
  "short_name": "HyacinthWatch",
  "name": "HyacinthWatch PWA",
  "icons": [...],
  "start_url": "/",
  "display": "standalone",
  "theme_color": "#000000",
  "background_color": "#ffffff"
}
```

### Service Worker

Service worker is configured but not yet fully implemented. Planned features:

- Runtime caching for API calls
- Offline fallback pages
- Background sync for queued uploads

See [../CODE_REVIEW.md](../CODE_REVIEW.md) for PWA TODO items.

### Installing the PWA

**iOS (Safari):**
1. Open app in Safari
2. Tap Share button
3. Select "Add to Home Screen"

**Android (Chrome):**
1. Open app in Chrome
2. Tap menu (three dots)
3. Select "Add to Home Screen" or "Install App"

## API Integration

### Uploading Observations

```javascript
import { postObservation } from './api';

const observation = {
  image: fileBlob,
  metadata: {
    captured_at: new Date().toISOString(),
    lat: 40.7128,
    lon: -74.0060,
    location_accuracy_m: 10,
    device_info: navigator.userAgent,
    notes: 'Optional notes'
  }
};

const result = await postObservation(observation);
```

### Authentication

```javascript
import { supabase } from './supabase';

// Sign up
const { data, error } = await supabase.auth.signUp({
  email: 'user@example.com',
  password: 'password'
});

// Sign in
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'password'
});

// Get session
const { data: { session } } = await supabase.auth.getSession();
```

### Getting Access Token

```javascript
const { data: { session } } = await supabase.auth.getSession();
const token = session?.access_token;

// Include in API requests
const response = await fetch(`${API_BASE_URL}/v1/observations`, {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
```

## Offline Support

### Current Implementation

- Observations stored in IndexedDB when offline
- Manual sync when connection restored (planned)

### Planned Features

- Automatic background sync
- Offline queue management
- Connection status indicator
- Retry failed uploads

## Troubleshooting

### Common Issues

1. **CORS errors**
   - Verify backend CORS settings
   - Check `REACT_APP_API_BASE_URL` matches backend

2. **Authentication not working**
   - Verify Supabase credentials
   - Check token refresh logic
   - Review browser console for errors

3. **GPS not working**
   - Ensure HTTPS (required for geolocation)
   - Check browser permissions
   - Test on actual device (not emulator)

4. **Build fails**
   - Clear `node_modules` and reinstall
   - Check Node.js version (18+)
   - Review error messages

### Debugging

```bash
# Check environment variables
npm run build
# Review build output for variable substitution

# Test service worker
# Open DevTools > Application > Service Workers
```

## Technologies

- **React 19** - UI library
- **React Router** - Client-side routing
- **Leaflet** - Interactive maps
- **Supabase JS** - Authentication and storage
- **IndexedDB** - Offline storage
- **EXIFR** - EXIF data extraction
- **React Scripts** - Build tooling

## Additional Resources

- [React Documentation](https://react.dev/)
- [PWA Documentation](https://web.dev/progressive-web-apps/)
- [Supabase JavaScript Client](https://supabase.com/docs/reference/javascript/introduction)
- [Leaflet Documentation](https://leafletjs.com/)

---

**Last Updated**: 2025-01-05

