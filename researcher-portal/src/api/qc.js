import { apiClient } from './client';

// Backend QC summary expects: start, end, tz, granularity, smooth, min_confidence, user_id, device_model, platform, species
export async function fetchQCSummary(filters) {
  const params = new URLSearchParams();
  
  // Backend uses start/end (ISO8601 timestamps), not dateFrom/dateTo
  if (filters.dateFrom) {
    // Convert date to ISO timestamp
    const date = new Date(filters.dateFrom);
    params.append('start', date.toISOString());
  }
  if (filters.dateTo) {
    const date = new Date(filters.dateTo);
    date.setHours(23, 59, 59, 999);
    params.append('end', date.toISOString());
  }
  
  // Default to last 30 days if no dates provided (instead of 7 days to capture more data)
  if (!filters.dateFrom && !filters.dateTo) {
    const end = new Date();
    const start = new Date(end);
    start.setDate(start.getDate() - 30); // Extended to 30 days to capture more observations
    params.append('start', start.toISOString());
    params.append('end', end.toISOString());
  }
  
  if (filters.minConfidence !== null) {
    params.append('min_confidence', String(filters.minConfidence));
  }
  
  // Backend doesn't support status, minQuality, hasMask, modelVersion filters directly
  // These would need to be added to backend or filtered client-side
  
  params.append('tz', 'UTC');
  params.append('granularity', 'day');
  
  // Only filter by species if explicitly provided in filters
  // Note: Backend filters by notes__icontains, so this might exclude observations
  // that don't have the species name in their notes field
  if (filters.species && filters.species !== 'all') {
    params.append('species', filters.species);
  }
  // Don't send species by default - it filters by notes__icontains which excludes most observations

  try {
    console.log('QC Summary request params:', Object.fromEntries(params));
    const response = await apiClient.get('/v1/qc/summary', { params });
    console.log('QC Summary response:', response.data);
    // Transform backend response to match frontend expectations
    const data = response.data;
    
    const transformed = {
      count: data.counts?.total || 0,
      avg_quality: data.averages?.avg_qc || 0,
      avg_blur_var: data.averages?.avg_blur_var || 0,
      avg_brightness: data.averages?.avg_brightness || 0,
      quality_bins: [], // Backend provides blur/brightness bins, not quality bins
      blur_bins: data.histograms?.blur?.map(([bin, count]) => ({ bin, count })) || [],
      brightness_bins: data.histograms?.brightness?.map(([bin, count]) => ({ bin, count })) || [],
      time_series: data.time_series?.buckets?.map(b => ({
        date: b.time,
        count: b.uploads,
        avg_quality: b.avg_qc,
      })) || [],
      buckets: data.time_series?.buckets || [],
      // Include raw backend data for debugging
      _raw: data,
    };
    
    console.log('QC Summary transformed data:', transformed);
    return transformed;
  } catch (error) {
    // Log detailed error for debugging
    console.error('QC Summary API Error:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message,
      hasToken: !!localStorage.getItem('sb_token') || !!localStorage.getItem('auth_token'),
    });
    throw error;
  }
}

