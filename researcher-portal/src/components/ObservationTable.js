import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useFilterStore } from '../store/filterStore';
import { fetchObservations, fetchObservationSignedUrl } from '../api/observations';
import { format } from 'date-fns';
import { ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react';

// Component to handle thumbnail loading with signed URLs
function ObservationThumbnail({ obsId }) {
  const { data: signedUrl } = useQuery({
    queryKey: ['observation-signed-url', obsId],
    queryFn: () => fetchObservationSignedUrl(obsId),
    enabled: !!obsId,
    staleTime: 600000, // 10 minutes
  });

  if (!signedUrl) {
    return (
      <div className="w-16 h-16 bg-gray-200 dark:bg-gray-700 rounded flex items-center justify-center text-xs text-gray-500 animate-pulse">
        Loading...
      </div>
    );
  }

  return (
    <img
      src={signedUrl}
      alt={`Observation ${obsId}`}
      className="w-16 h-16 object-cover rounded"
      loading="lazy"
      onError={(e) => {
        e.target.style.display = 'none';
        e.target.nextElementSibling?.style.setProperty('display', 'flex');
      }}
    />
  );
}

function ObservationRow({ obs, onClick }) {
  const toNum = (v) => {
    if (v === null || v === undefined) return null;
    const n = typeof v === 'number' ? v : parseFloat(v);
    return Number.isFinite(n) ? n : null;
  };
  const qcScore = obs.qc_score ?? obs.qc?.score ?? null;
  const presenceScore = obs.pred?.presence?.score ?? null;
  const coverPct = obs.pred?.seg?.cover_pct ?? null;

  return (
    <tr
      className="bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer border-b border-gray-200 dark:border-gray-700"
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      tabIndex={0}
      role="button"
      aria-label={`View observation ${obs.id}`}
    >
      <td className="px-6 py-4 whitespace-nowrap">
        {obs.image_url && !obs.image_url.startsWith('supabase://') ? (
          <img
            src={obs.image_url}
            alt={`Observation ${obs.id}`}
            className="w-16 h-16 object-cover rounded"
            loading="lazy"
            onError={(e) => {
              e.target.style.display = 'none';
              e.target.nextElementSibling?.style.setProperty('display', 'flex');
            }}
          />
        ) : null}
        {obs.image_url?.startsWith('supabase://') ? (
          <ObservationThumbnail obsId={obs.id} />
        ) : null}
        {!obs.image_url && (
          <div className="w-16 h-16 bg-gray-200 dark:bg-gray-700 rounded flex items-center justify-center text-xs text-gray-500">
            No image
          </div>
        )}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
        {format(new Date(obs.captured_at), 'MMM dd, yyyy HH:mm')}
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
          obs.status === 'done' ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200' :
          obs.status === 'error' ? 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200' :
          obs.status === 'processing' ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200' :
          'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
        }`}>
          {obs.status}
        </span>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
        {qcScore !== null ? qcScore.toFixed(2) : '-'}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
        {presenceScore !== null ? (presenceScore * 100).toFixed(0) + '%' : '-'}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
        {coverPct !== null ? coverPct.toFixed(1) + '%' : '-'}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
        {(() => {
          const lat = toNum(obs.lat);
          const lon = toNum(obs.lon);
          return lat !== null && lon !== null ? (
            <span>{lat.toFixed(5)}, {lon.toFixed(5)}</span>
          ) : '-';
        })()}
      </td>
    </tr>
  );
}

function TableHeader({ field, label, sort, onSort }) {
  const isSorted = sort.field === field;
  return (
    <th
      scope="col"
      className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
      onClick={() => onSort(field)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSort(field);
        }
      }}
    >
      <div className="flex items-center gap-2">
        {label}
        <ArrowUpDown size={14} className={isSorted ? 'text-blue-600 dark:text-blue-400' : ''} />
      </div>
    </th>
  );
}

function ObservationRowSkeleton({ count = 10 }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <tr key={i} className="bg-white dark:bg-gray-800 animate-pulse">
          <td className="px-6 py-4 whitespace-nowrap">
            <div className="w-16 h-16 bg-gray-200 dark:bg-gray-700 rounded" />
          </td>
          <td className="px-6 py-4 whitespace-nowrap">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-32" />
          </td>
          <td className="px-6 py-4 whitespace-nowrap">
            <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-20" />
          </td>
          <td className="px-6 py-4 whitespace-nowrap">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-12" />
          </td>
          <td className="px-6 py-4 whitespace-nowrap">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-12" />
          </td>
          <td className="px-6 py-4 whitespace-nowrap">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-12" />
          </td>
          <td className="px-6 py-4 whitespace-nowrap">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24" />
          </td>
        </tr>
      ))}
    </>
  );
}

export function ObservationTable({ onRowClick }) {
  const { filters } = useFilterStore();
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [sort, setSort] = useState({ field: 'created_at', order: 'desc' });

  const { data, isLoading, error, isFetching } = useQuery({
    queryKey: ['observations', filters, page, pageSize, sort],
    queryFn: ({ signal }) => fetchObservations(filters, { page, pageSize }, sort, signal),
    staleTime: 30000, // 30 seconds
  });

  const handleSort = (field) => {
    setSort((prev) => ({
      field,
      order: prev.field === field && prev.order === 'asc' ? 'desc' : 'asc',
    }));
    setPage(1); // Reset to first page on sort
  };

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 px-4 py-3 rounded-lg">
        Error loading observations: {error instanceof Error ? error.message : 'Unknown error'}
        <button
          onClick={() => window.location.reload()}
          className="ml-4 text-sm underline hover:no-underline"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <TableHeader field="image" label="Image" sort={sort} onSort={handleSort} />
              <TableHeader field="captured_at" label="Captured" sort={sort} onSort={handleSort} />
              <TableHeader field="status" label="Status" sort={sort} onSort={handleSort} />
              <TableHeader field="qc_score" label="Quality" sort={sort} onSort={handleSort} />
              <TableHeader field="confidence" label="Confidence" sort={sort} onSort={handleSort} />
              <TableHeader field="coverage" label="Coverage %" sort={sort} onSort={handleSort} />
              <TableHeader field="location" label="Location" sort={sort} onSort={handleSort} />
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {isLoading || isFetching ? (
              <ObservationRowSkeleton count={pageSize} />
            ) : data?.results && data.results.length > 0 ? (
              data.results.map((obs) => (
                <ObservationRow key={obs.id} obs={obs} onClick={() => onRowClick(obs)} />
              ))
            ) : (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                  No observations found. Try adjusting your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {data && (data.count || data.results?.length || 0) > pageSize && (
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div className="text-sm text-gray-700 dark:text-gray-300">
            Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, data.count || data.results?.length || 0)} of {data.count || data.results?.length || 0} results
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1 || isLoading}
              className="p-2 rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Previous page"
            >
              <ChevronLeft size={20} />
            </button>
            <span className="text-sm text-gray-700 dark:text-gray-300">
              Page {page} of {Math.ceil((data.count || data.results?.length || 0) / pageSize)}
            </span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= Math.ceil((data.count || data.results?.length || 0) / pageSize) || isLoading}
              className="p-2 rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Next page"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

