# Researcher Portal

A React application for researchers to browse, analyze, and export observation data from the HyacinthWatch backend.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Setup](#setup)
- [Development](#development)
- [Building for Production](#building-for-production)
- [Backend Integration](#backend-integration)
- [Project Structure](#project-structure)
- [Technologies](#technologies)

## Overview

The Researcher Portal provides a comprehensive interface for analyzing water hyacinth observation data. It enables researchers to:

- Browse and filter observations
- View detailed analytics and quality control metrics
- Export data in multiple formats
- Visualize trends over time
- Inspect individual observations with mask overlays

## Features

### Dashboard
- **Observation Table**: Paginated, sortable table with filtering
- **Real-time Data**: Fetches latest observations from backend
- **Quick Filters**: Filter by date range, status, QC score
- **Observation Details**: Click to view full observation with image and metadata

### Analytics
- **QC Metrics**: Summary statistics for quality control scores
- **Histograms**: Distribution charts for QC metrics
- **Time Series**: Trends over time with configurable granularity
- **Filtering**: Filter analytics by date range, confidence level, platform

### Observation Details
- **Image View**: Full-size observation image
- **Mask Overlay**: Toggle segmentation mask overlay with slider
- **Metadata**: Complete observation metadata display
- **Prediction Results**: Presence detection and segmentation results

### Export
- **CSV Export**: Export filtered observations as CSV
- **GeoJSON Export**: Export as GeoJSON for GIS applications
- **Filter Preservation**: Exports respect current filter settings

### Authentication & Security
- **Login Flow**: Supabase-based authentication
- **Protected Routes**: Route protection for authenticated users
- **Session Management**: Automatic token refresh

### User Experience
- **Theming**: Light/dark mode support (follows system preference)
- **Accessibility**: Keyboard navigation, ARIA labels
- **Responsive**: Works on desktop and tablet devices

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

2. **Configure environment variables**
   Create a `.env` file in the `researcher-portal/` directory:
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
researcher-portal/
├── public/
│   ├── index.html
│   └── manifest.json
├── src/
│   ├── api/              # API client and endpoints
│   │   ├── auth.js       # Authentication API
│   │   ├── client.js     # Axios client configuration
│   │   ├── observations.js # Observation endpoints
│   │   └── qc.js         # QC analytics endpoints
│   ├── components/       # Reusable React components
│   │   ├── FilterBar.js  # Filter controls
│   │   ├── Layout.js     # App layout wrapper
│   │   ├── ObservationDetails.js # Observation detail view
│   │   ├── ObservationTable.js # Observation table
│   │   ├── ProtectedRoute.js # Route protection
│   │   └── Toast.js      # Toast notifications
│   ├── pages/            # Page components
│   │   ├── AnalyticsPage.js # Analytics dashboard
│   │   ├── DashboardPage.js # Main dashboard
│   │   └── LoginPage.js  # Login page
│   ├── store/            # Zustand stores
│   │   ├── authStore.js  # Authentication state
│   │   └── filterStore.js # Filter state
│   ├── utils/            # Utility functions
│   │   ├── debounce.js   # Debounce utility
│   │   ├── supabase.js   # Supabase client
│   │   └── urlSync.js    # URL state synchronization
│   ├── config.js         # App configuration
│   ├── App.js            # Main app component
│   └── index.js          # Entry point
└── tailwind.config.js    # Tailwind CSS configuration
```

### Key Components

#### `api/observations.js`
Observation API client:
- `getObservations()` - Fetch observations list
- `getObservation(id)` - Get single observation
- `getSignedUrl(id)` - Get signed URL for image

#### `api/qc.js`
Quality control analytics API:
- `getQCSummary(params)` - Get QC analytics with filters

#### `store/filterStore.js`
Zustand store for filter state:
- Date range filters
- QC score filters
- URL synchronization

#### `store/authStore.js`
Authentication state management:
- User session
- Login/logout
- Token management

### Development Workflow

1. **Start backend API** (see [../backend/README.md](../backend/README.md))
2. **Start portal dev server**: `npm start`
3. **Make changes** - Hot reload enabled
4. **Test features** - Use browser DevTools for debugging

### Code Style

- Follow React best practices
- Use functional components with hooks
- Maintain component separation of concerns
- Use TypeScript-style JSDoc comments (if applicable)

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

## Backend Integration

The portal integrates with the following backend endpoints:

### Observations

- `GET /v1/observations` - List observations (returns first 50, filtering/pagination done client-side)
- `GET /v1/observations/<uuid>` - Get single observation details
- `GET /v1/observations/<uuid>/signed_url` - Get signed URL for images (requires auth)

### Analytics

- `GET /v1/qc/summary` - Get QC analytics with filters
  - Query parameters: `start`, `end`, `min_confidence`, `granularity`, `platform`, `species`

### Authentication

- `GET /v1/game/profile` - Get user profile (requires auth)

### Limitations

**Note**: The backend currently returns the first 50 observations without pagination. Filtering and pagination are handled client-side. To fully support the portal at scale, consider:

- Adding backend filtering, pagination, and sorting
- Implementing server-side search
- Adding caching for frequently accessed data

## Technologies

- **React 19** - UI library
- **React Router 7** - Client-side routing
- **TanStack Query 5** - Data fetching & caching
- **Zustand 5** - State management
- **Recharts 3** - Charts and visualizations
- **Tailwind CSS 3** - Utility-first CSS framework
- **Axios** - HTTP client
- **date-fns 4** - Date formatting and manipulation
- **lucide-react** - Icon library

## Troubleshooting

### Common Issues

1. **CORS errors**
   - Verify backend CORS settings include portal URL
   - Check `REACT_APP_API_BASE_URL` matches backend

2. **Authentication not working**
   - Verify Supabase credentials
   - Check token refresh logic
   - Review browser console for errors

3. **Data not loading**
   - Verify backend API is running
   - Check network tab for failed requests
   - Review API response format

4. **Build fails**
   - Clear `node_modules` and reinstall
   - Check Node.js version (18+)
   - Review error messages

### Debugging

```bash
# Check environment variables
npm run build
# Review build output for variable substitution

# Test API connectivity
# Open DevTools > Network tab
# Check API requests and responses
```

## Additional Resources

- [React Documentation](https://react.dev/)
- [TanStack Query Documentation](https://tanstack.com/query/latest)
- [Zustand Documentation](https://github.com/pmndrs/zustand)
- [Tailwind CSS Documentation](https://tailwindcss.com/)
- [Recharts Documentation](https://recharts.org/)

---

**Last Updated**: 2025-01-05
