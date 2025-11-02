import { useQuery } from '@tanstack/react-query';
import { useFilterStore } from '../store/filterStore';
import { useFilterUrlSync } from '../utils/urlSync';
import { fetchQCSummary } from '../api/qc';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
import { FilterBar } from '../components/FilterBar';
import { TrendingUp, TrendingDown, Eye, CheckCircle } from 'lucide-react';

export function AnalyticsPage() {
  useFilterUrlSync();
  const { filters } = useFilterStore();

  const { data, isLoading, error } = useQuery({
    queryKey: ['qc-summary', filters],
    queryFn: () => fetchQCSummary(filters),
    staleTime: 60000, // 1 minute
  });

  if (error) {
    const errorMessage = error.response?.data?.detail || error.message || 'Unknown error';
    const errorStatus = error.response?.status;
    const hasToken = !!localStorage.getItem('sb_token') || !!localStorage.getItem('auth_token');
    
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Analytics</h1>
        </div>
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 px-4 py-3 rounded-lg space-y-2">
          <div>
            <strong>Error loading analytics:</strong> {errorMessage}
            {errorStatus && <span className="ml-2 text-sm">(Status: {errorStatus})</span>}
          </div>
          <div className="text-sm">
            {!hasToken && (
              <p className="mb-2">⚠️ No authentication token found. Please log in with a valid Supabase token.</p>
            )}
            {errorStatus === 403 && (
              <p className="mb-2">
                ⚠️ Access forbidden. This might be due to:
                <ul className="list-disc list-inside mt-1 ml-2">
                  <li>Missing or invalid authentication token</li>
                  <li>Token does not have required role (researcher, moderator, or admin)</li>
                  <li>Token expired or invalid</li>
                </ul>
              </p>
            )}
            <details className="mt-2">
              <summary className="cursor-pointer underline">Debug Info</summary>
              <pre className="mt-2 text-xs overflow-auto bg-gray-100 dark:bg-gray-900 p-2 rounded">
                {JSON.stringify({
                  status: errorStatus,
                  hasToken,
                  error: errorMessage,
                  responseData: error.response?.data,
                }, null, 2)}
              </pre>
            </details>
          </div>
          <div className="flex gap-2 mt-2">
            <button
              onClick={() => window.location.reload()}
              className="text-sm underline hover:no-underline"
            >
              Retry
            </button>
            {!hasToken && (
              <button
                onClick={() => window.location.href = '/login'}
                className="text-sm underline hover:no-underline ml-4"
              >
                Go to Login
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Analytics</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Loading analytics data...</p>
        </div>
        <FilterBar />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 animate-pulse">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-2" />
              <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Analytics</h1>
        </div>
        <FilterBar />
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          No analytics data available. Try adjusting your filters.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Analytics</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Quality control metrics and time series analysis
        </p>
      </div>

      {/* Filters */}
      <FilterBar />

      {/* KPI Tiles */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Observations</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">{data.count}</p>
            </div>
            <Eye className="text-blue-500" size={32} />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Avg Quality</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
                {(data.avg_quality ?? data.avg_qc ?? 0).toFixed(2)}
              </p>
            </div>
            <CheckCircle className="text-green-500" size={32} />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Avg Blur Variance</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
                {(data.avg_blur_var ?? data.blur_var ?? 0).toFixed(2)}
              </p>
            </div>
            <TrendingDown className="text-yellow-500" size={32} />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Avg Brightness</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
                {(data.avg_brightness ?? data.brightness ?? 0).toFixed(0)}
              </p>
            </div>
            <TrendingUp className="text-purple-500" size={32} />
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Blur Distribution */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Blur Variance Distribution
          </h3>
          {data.blur_bins && data.blur_bins.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.blur_bins}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="bin" stroke="#6b7280" />
                <YAxis stroke="#6b7280" />
                <Tooltip />
                <Bar dataKey="count" fill="#f59e0b" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-gray-500 dark:text-gray-400">
              No blur data available
            </div>
          )}
        </div>

        {/* Brightness Distribution */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Brightness Distribution
          </h3>
          {data.brightness_bins && data.brightness_bins.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.brightness_bins}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="bin" stroke="#6b7280" />
                <YAxis stroke="#6b7280" />
                <Tooltip />
                <Bar dataKey="count" fill="#8b5cf6" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-gray-500 dark:text-gray-400">
              No brightness data available
            </div>
          )}
        </div>

        {/* Time Series */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 lg:col-span-2">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Submissions & Quality Over Time
          </h3>
          {(data.time_series || data.buckets) && (data.time_series?.length || data.buckets?.length || 0) > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={data.time_series || data.buckets}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey={data.time_series ? "date" : "time"} stroke="#6b7280" />
                <YAxis yAxisId="left" stroke="#6b7280" />
                <YAxis yAxisId="right" orientation="right" stroke="#6b7280" />
                <Tooltip />
                <Legend />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey={data.time_series ? "count" : "uploads"}
                  stroke="#3b82f6"
                  name="Count"
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey={data.time_series ? "avg_quality" : "avg_qc"}
                  stroke="#10b981"
                  name="Avg Quality"
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-gray-500 dark:text-gray-400">
              No time series data available
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

