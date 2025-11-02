import { apiClient, getCancelToken } from './client';

// Backend currently returns first 50 observations without filtering/pagination
// We'll fetch all and do filtering/pagination client-side
export async function fetchObservations(filters, pagination, sort, signal) {
  const response = await apiClient.get('/v1/observations', {
    signal,
    cancelToken: getCancelToken('observations'),
  });
  
  let results = response.data.results || [];
  
  // Client-side filtering
  if (filters.dateFrom) {
    const dateFrom = new Date(filters.dateFrom);
    results = results.filter(obs => new Date(obs.captured_at) >= dateFrom);
  }
  if (filters.dateTo) {
    const dateTo = new Date(filters.dateTo);
    dateTo.setHours(23, 59, 59, 999); // End of day
    results = results.filter(obs => new Date(obs.captured_at) <= dateTo);
  }
  if (filters.status && filters.status !== 'all') {
    results = results.filter(obs => obs.status === filters.status);
  }
  if (filters.minQuality !== null) {
    results = results.filter(obs => {
      const qcScore = obs.qc_score ?? obs.qc?.score ?? 0;
      return qcScore >= filters.minQuality;
    });
  }
  if (filters.minConfidence !== null) {
    results = results.filter(obs => {
      const presenceScore = obs.pred?.presence?.score ?? 0;
      return presenceScore >= filters.minConfidence;
    });
  }
  if (filters.hasMask !== null) {
    results = results.filter(obs => {
      const hasMask = !!obs.pred?.seg?.mask_url || !!obs.mask_url;
      return hasMask === filters.hasMask;
    });
  }
  if (filters.modelVersion) {
    results = results.filter(obs => {
      const modelVersion = obs.pred?.seg?.model_v;
      return modelVersion === filters.modelVersion;
    });
  }
  
  // Client-side sorting
  if (sort.field) {
    results = [...results].sort((a, b) => {
      let aVal, bVal;
      
      if (sort.field === 'captured_at') {
        aVal = new Date(a.captured_at);
        bVal = new Date(b.captured_at);
      } else if (sort.field === 'qc_score') {
        aVal = a.qc_score ?? a.qc?.score ?? 0;
        bVal = b.qc_score ?? b.qc?.score ?? 0;
      } else if (sort.field === 'confidence') {
        aVal = a.pred?.presence?.score ?? 0;
        bVal = b.pred?.presence?.score ?? 0;
      } else if (sort.field === 'coverage') {
        aVal = a.pred?.seg?.cover_pct ?? 0;
        bVal = b.pred?.seg?.cover_pct ?? 0;
      } else if (sort.field === 'created_at') {
        aVal = new Date(a.created_at);
        bVal = new Date(b.created_at);
      } else {
        aVal = a[sort.field] ?? '';
        bVal = b[sort.field] ?? '';
      }
      
      if (aVal < bVal) return sort.order === 'asc' ? -1 : 1;
      if (aVal > bVal) return sort.order === 'asc' ? 1 : -1;
      return 0;
    });
  }
  
  // Client-side pagination
  const count = results.length;
  const startIndex = (pagination.page - 1) * pagination.pageSize;
  const endIndex = startIndex + pagination.pageSize;
  const paginatedResults = results.slice(startIndex, endIndex);
  
  return {
    count,
    next: endIndex < count ? pagination.page + 1 : null,
    previous: pagination.page > 1 ? pagination.page - 1 : null,
    results: paginatedResults,
  };
}

export async function fetchObservation(id) {
  const response = await apiClient.get(`/v1/observations/${id}`);
  return response.data;
}

export async function fetchObservationSignedUrl(id) {
  try {
    const response = await apiClient.get(`/v1/observations/${id}/signed_url`);
    return response.data.signed_url;
  } catch (error) {
    console.warn('Failed to fetch signed URL:', error);
    return null;
  }
}

// These endpoints don't exist yet in the backend
export async function updateObservationStatus(id, status) {
  // TODO: Implement when backend adds PATCH /v1/observations/<id>
  throw new Error('Status update endpoint not yet implemented in backend');
}

export async function reprocessObservation(id) {
  // TODO: Implement when backend adds POST /v1/observations/<id>/reprocess
  throw new Error('Reprocess endpoint not yet implemented in backend');
}

// Export functions - backend doesn't have export endpoints yet
// For now, we'll generate CSV/GeoJSON client-side
export async function exportObservationsCSV(filters, pagination, sort) {
  // Fetch all observations first (with client-side filtering)
  const data = await fetchObservations(filters, { page: 1, pageSize: 10000 }, sort);
  const observations = data.results;
  
  // Generate CSV
  const headers = ['ID', 'Captured At', 'Status', 'QC Score', 'Presence', 'Confidence', 'Coverage %', 'Lat', 'Lon'];
  const rows = observations.map(obs => [
    obs.id,
    obs.captured_at,
    obs.status,
    obs.qc_score ?? obs.qc?.score ?? '',
    obs.pred?.presence?.label ?? '',
    obs.pred?.presence?.score ? (obs.pred.presence.score * 100).toFixed(1) + '%' : '',
    obs.pred?.seg?.cover_pct?.toFixed(1) ?? '',
    obs.lat ?? '',
    obs.lon ?? '',
  ]);
  
  const csv = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
  ].join('\n');
  
  return new Blob([csv], { type: 'text/csv' });
}

export async function exportObservationsGeoJSON(filters, pagination, sort) {
  // Fetch all observations first (with client-side filtering)
  const data = await fetchObservations(filters, { page: 1, pageSize: 10000 }, sort);
  const observations = data.results.filter(obs => obs.lat !== null && obs.lon !== null);
  
  // Generate GeoJSON
  const geojson = {
    type: 'FeatureCollection',
    features: observations.map(obs => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [obs.lon, obs.lat],
      },
      properties: {
        id: obs.id,
        captured_at: obs.captured_at,
        status: obs.status,
        qc_score: obs.qc_score ?? obs.qc?.score ?? null,
        presence: obs.pred?.presence?.label ?? null,
        confidence: obs.pred?.presence?.score ?? null,
        coverage_pct: obs.pred?.seg?.cover_pct ?? null,
      },
    })),
  };
  
  return new Blob([JSON.stringify(geojson, null, 2)], { type: 'application/json' });
}

