import { useFilterStore } from '../store/filterStore';
import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

export function useFilterUrlSync() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { filters, setFilters } = useFilterStore();

  // Initialize filters from URL on mount
  useEffect(() => {
    const urlFilters = {};
    
    const dateFrom = searchParams.get('date_from');
    const dateTo = searchParams.get('date_to');
    const status = searchParams.get('status');
    const minQuality = searchParams.get('min_quality');
    const minConfidence = searchParams.get('min_confidence');
    const hasMask = searchParams.get('has_mask');
    const modelVersion = searchParams.get('model_version');

    if (dateFrom) urlFilters.dateFrom = dateFrom;
    if (dateTo) urlFilters.dateTo = dateTo;
    if (status && status !== 'all') urlFilters.status = status;
    if (minQuality) urlFilters.minQuality = parseFloat(minQuality);
    if (minConfidence) urlFilters.minConfidence = parseFloat(minConfidence);
    if (hasMask !== null) urlFilters.hasMask = hasMask === 'true';
    if (modelVersion) urlFilters.modelVersion = modelVersion;

    if (Object.keys(urlFilters).length > 0) {
      setFilters(urlFilters);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only on mount

  // Sync filters to URL
  useEffect(() => {
    const params = new URLSearchParams();
    
    if (filters.dateFrom) params.set('date_from', filters.dateFrom);
    if (filters.dateTo) params.set('date_to', filters.dateTo);
    if (filters.status && filters.status !== 'all') params.set('status', filters.status);
    if (filters.minQuality !== null) params.set('min_quality', String(filters.minQuality));
    if (filters.minConfidence !== null) params.set('min_confidence', String(filters.minConfidence));
    if (filters.hasMask !== null) params.set('has_mask', String(filters.hasMask));
    if (filters.modelVersion) params.set('model_version', filters.modelVersion);

    setSearchParams(params, { replace: true });
  }, [filters, setSearchParams]);
}

