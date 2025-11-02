# Researcher Portal

A React application for researchers to browse, analyze, and export observation data from the HyacinthWatch backend.

## Features

- **Dashboard**: Paginated, sortable table of observations with filtering
- **Analytics**: QC metrics, histograms, and time series charts
- **Observation Details**: Full image view with mask overlay slider
- **Export**: CSV and GeoJSON export with current filters
- **Auth**: Login flow with protected routes
- **Theming**: Light/dark mode support (system preference)
- **Accessibility**: Keyboard navigation, ARIA labels

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create `.env` file:
```bash
cp .env.example .env
```

3. Configure environment variables:
- `REACT_APP_API_BASE_URL`: Backend API URL (default: http://localhost:8000)
- `REACT_APP_SUPABASE_URL`: Supabase URL (if using Supabase auth)
- `REACT_APP_SUPABASE_ANON_KEY`: Supabase anonymous key (if using Supabase auth)

4. Start development server:
```bash
npm start
```

## Backend Integration

The portal integrates with the following backend endpoints:

- `GET /v1/observations` - List observations (returns first 50, filtering/pagination done client-side)
- `GET /v1/observations/<uuid>` - Get single observation details
- `GET /v1/qc/summary` - Get QC analytics with filters (start, end, min_confidence, etc.)
- `GET /v1/game/profile` - Get user profile (requires auth)
- `GET /v1/observations/<uuid>/signed_url` - Get signed URL for images

**Note**: The backend currently returns the first 50 observations without pagination. Filtering and pagination are handled client-side. To fully support the portal, consider adding backend filtering, pagination, and sorting.

## Project Structure

```
src/
  api/              # API client and endpoints
  components/       # Reusable React components
  pages/            # Page components
  store/            # Zustand stores (filters, auth)
  utils/            # Utility functions
```

## Technologies

- **React 19** - UI library
- **React Router** - Routing
- **TanStack Query** - Data fetching & caching
- **Zustand** - State management
- **Recharts** - Charts
- **Tailwind CSS** - Styling
- **Axios** - HTTP client
- **date-fns** - Date formatting
- **lucide-react** - Icons
