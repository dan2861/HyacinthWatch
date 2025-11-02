import { useFilterStore } from '../store/filterStore';
import { useState, useEffect } from 'react';
import { debounce } from '../utils/debounce';
import { X, Calendar, Filter } from 'lucide-react';

export function FilterBar() {
  const { filters, setFilter, resetFilters } = useFilterStore();
  const [localFilters, setLocalFilters] = useState(filters);

  // Debounce filter updates
  const debouncedSetFilter = debounce((key, value) => {
    setFilter(key, value);
  }, 300);

  useEffect(() => {
    setLocalFilters(filters);
  }, [filters]);

  const handleChange = (key, value) => {
    setLocalFilters((prev) => ({ ...prev, [key]: value }));
    debouncedSetFilter(key, value);
  };

  const hasActiveFilters = Object.values(filters).some((v) => {
    if (v === null || v === 'all') return false;
    if (typeof v === 'boolean') return v !== null;
    if (typeof v === 'number') return v !== null;
    return true;
  });

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-6">
      <div className="flex items-center gap-2 mb-4">
        <Filter size={20} className="text-gray-500 dark:text-gray-400" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Filters</h3>
        {hasActiveFilters && (
          <button
            onClick={resetFilters}
            className="ml-auto text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
          >
            <X size={16} />
            Clear all
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Date From */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            <Calendar size={14} className="inline mr-1" />
            Date From
          </label>
          <input
            type="date"
            value={localFilters.dateFrom || ''}
            onChange={(e) => handleChange('dateFrom', e.target.value || null)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
          />
        </div>

        {/* Date To */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            <Calendar size={14} className="inline mr-1" />
            Date To
          </label>
          <input
            type="date"
            value={localFilters.dateTo || ''}
            onChange={(e) => handleChange('dateTo', e.target.value || null)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
          />
        </div>

        {/* Status */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Status
          </label>
          <select
            value={localFilters.status || 'all'}
            onChange={(e) => handleChange('status', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
          >
            <option value="all">All</option>
            <option value="queued">Queued</option>
            <option value="received">Received</option>
            <option value="processing">Processing</option>
            <option value="done">Done</option>
            <option value="error">Error</option>
          </select>
        </div>

        {/* Min Quality */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Min Quality (0-1)
          </label>
          <input
            type="number"
            min="0"
            max="1"
            step="0.1"
            value={localFilters.minQuality ?? ''}
            onChange={(e) => handleChange('minQuality', e.target.value ? parseFloat(e.target.value) : null)}
            placeholder="0.0"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
          />
        </div>

        {/* Min Confidence */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Min Confidence (0-1)
          </label>
          <input
            type="number"
            min="0"
            max="1"
            step="0.1"
            value={localFilters.minConfidence ?? ''}
            onChange={(e) => handleChange('minConfidence', e.target.value ? parseFloat(e.target.value) : null)}
            placeholder="0.0"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
          />
        </div>

        {/* Has Mask */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Has Mask
          </label>
          <select
            value={localFilters.hasMask === null ? 'all' : localFilters.hasMask ? 'true' : 'false'}
            onChange={(e) => handleChange('hasMask', e.target.value === 'all' ? null : e.target.value === 'true')}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
          >
            <option value="all">All</option>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        </div>

        {/* Model Version */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Model Version
          </label>
          <input
            type="text"
            value={localFilters.modelVersion || ''}
            onChange={(e) => handleChange('modelVersion', e.target.value || null)}
            placeholder="e.g., 1.0.0"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
          />
        </div>
      </div>
    </div>
  );
}

