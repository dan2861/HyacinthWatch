import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchObservation, fetchObservationSignedUrl } from '../api/observations';
import { X, Download, RefreshCw, Check, X as XIcon } from 'lucide-react';
import { format } from 'date-fns';

export function ObservationDetails({ obsId, onClose, onStatusUpdate, isAdmin = false }) {
  const [maskOpacity, setMaskOpacity] = useState(0.5);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  const { data: obs, isLoading, error } = useQuery({
    queryKey: ['observation', obsId],
    queryFn: () => obsId ? fetchObservation(obsId) : null,
    enabled: !!obsId,
    staleTime: 30000,
  });

  // Fetch signed URL for download
  const { data: signedUrl } = useQuery({
    queryKey: ['observation-signed-url', obsId],
    queryFn: () => obsId ? fetchObservationSignedUrl(obsId) : null,
    enabled: !!obsId && !!obs,
    staleTime: 600000, // 10 minutes (signed URLs expire in 10 minutes)
  });

  // Determine the image URL to display/download
  // If image_url is supabase://, we need signed URL; otherwise use image_url directly
  const needsSignedUrl = obs?.image_url?.startsWith('supabase://');
  const displayImageUrl = needsSignedUrl ? signedUrl : obs?.image_url || null;
  const downloadImageUrl = needsSignedUrl ? signedUrl : obs?.image_url || null;

  if (!obsId) return null;

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
          <div className="p-6">
            <div className="animate-pulse space-y-4">
              <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
              <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !obs) {
    return (
      <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
          <div className="p-6">
            <div className="text-red-600 dark:text-red-400">
              Error loading observation: {error instanceof Error ? error.message : 'Unknown error'}
            </div>
            <button
              onClick={onClose}
              className="mt-4 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  const qcScore = obs.qc_score ?? obs.qc?.score ?? null;
  const presence = obs.pred?.presence;
  const seg = obs.pred?.seg;
  const coverPct = seg?.cover_pct ?? null;

  const handleStatusUpdate = async (newStatus) => {
    if (!isAdmin) return;
    setIsUpdatingStatus(true);
    try {
      // TODO: Implement when backend adds status update endpoint
      console.log('Status update not yet implemented', obs.id, newStatus);
      if (onStatusUpdate) onStatusUpdate();
    } catch (err) {
      console.error('Failed to update status:', err);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="observation-details-title"
      >
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
          <h2 id="observation-details-title" className="text-xl font-bold text-gray-900 dark:text-white">
            Observation Details
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-md text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700"
            aria-label="Close"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Image with mask overlay */}
          <div className="relative">
            <div className="relative bg-gray-100 dark:bg-gray-900 rounded-lg overflow-hidden">
              {displayImageUrl ? (
                <img
                  src={displayImageUrl}
                  alt={`Observation ${obs.id}`}
                  className="w-full h-auto"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-64 bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-500">
                  No image available
                </div>
              )}
              {obs.mask_url && (
                <img
                  src={obs.mask_url}
                  alt="Segmentation mask"
                  className="absolute inset-0 mix-blend-multiply pointer-events-none"
                  style={{ opacity: maskOpacity }}
                  loading="lazy"
                />
              )}
            </div>
            {obs.mask_url && (
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Mask Overlay Opacity: {(maskOpacity * 100).toFixed(0)}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={maskOpacity}
                  onChange={(e) => setMaskOpacity(parseFloat(e.target.value))}
                  className="w-full"
                />
              </div>
            )}
          </div>

          {/* Metadata Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Status</h3>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                  obs.status === 'done' ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200' :
                  obs.status === 'error' ? 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200' :
                  obs.status === 'processing' ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200' :
                  'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
                }`}>
                  {obs.status}
                </span>
                {isAdmin && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleStatusUpdate('done')}
                      disabled={isUpdatingStatus || obs.status === 'done'}
                      className="p-1 rounded text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 disabled:opacity-50"
                      aria-label="Accept"
                    >
                      <Check size={16} />
                    </button>
                    <button
                      onClick={() => handleStatusUpdate('error')}
                      disabled={isUpdatingStatus || obs.status === 'error'}
                      className="p-1 rounded text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
                      aria-label="Reject"
                    >
                      <XIcon size={16} />
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Captured At</h3>
              <p className="text-sm text-gray-900 dark:text-white">
                {format(new Date(obs.captured_at), 'PPpp')}
              </p>
            </div>

            {(() => {
              const toNum = (v) => {
                if (v === null || v === undefined) return null;
                const n = typeof v === 'number' ? v : parseFloat(v);
                return Number.isFinite(n) ? n : null;
              };
              const lat = toNum(obs.lat);
              const lon = toNum(obs.lon);
              if (lat === null || lon === null) return null;
              return (
                <div>
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Location</h3>
                  <p className="text-sm text-gray-900 dark:text-white">
                    {lat.toFixed(5)}, {lon.toFixed(5)}
                  </p>
                </div>
              );
            })()}

            {qcScore !== null && (
              <div>
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Quality Score</h3>
                <p className="text-sm text-gray-900 dark:text-white">{qcScore.toFixed(2)}</p>
              </div>
            )}

            {presence && (
              <div>
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Presence</h3>
                <p className="text-sm text-gray-900 dark:text-white">
                  {presence.label} ({(presence.score * 100).toFixed(0)}%)
                </p>
              </div>
            )}

            {coverPct !== null && (
              <div>
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Coverage</h3>
                <p className="text-sm text-gray-900 dark:text-white">{coverPct.toFixed(1)}%</p>
              </div>
            )}

            {seg?.model_v && (
              <div>
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Model Version</h3>
                <p className="text-sm text-gray-900 dark:text-white">{seg.model_v}</p>
              </div>
            )}

            {obs.device_info && (
              <div>
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Device</h3>
                <p className="text-sm text-gray-900 dark:text-white">{obs.device_info}</p>
              </div>
            )}

            {obs.notes && (
              <div className="md:col-span-2">
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Notes</h3>
                <p className="text-sm text-gray-900 dark:text-white">{obs.notes}</p>
              </div>
            )}
          </div>

          {/* QC Details */}
          {obs.qc && (
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Quality Metrics</h3>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Blur Variance:</span>
                  <span className="ml-2 text-gray-900 dark:text-white">{obs.qc.blur_var?.toFixed(2) ?? '-'}</span>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Brightness:</span>
                  <span className="ml-2 text-gray-900 dark:text-white">{obs.qc.brightness?.toFixed(0) ?? '-'}</span>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Score:</span>
                  <span className="ml-2 text-gray-900 dark:text-white">{obs.qc.score?.toFixed(2) ?? '-'}</span>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 border-t border-gray-200 dark:border-gray-700 pt-4">
            {downloadImageUrl ? (
              <a
                href={downloadImageUrl}
                download={`observation-${obs.id}.jpg`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                <Download size={16} />
                Download Image
              </a>
            ) : obs?.image_url ? (
              <button
                onClick={async () => {
                  try {
                    const url = await fetchObservationSignedUrl(obsId);
                    if (url) {
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `observation-${obs.id}.jpg`;
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                    } else {
                      console.error('No signed URL available');
                    }
                  } catch (err) {
                    console.error('Failed to download image:', err);
                  }
                }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                <Download size={16} />
                Download Image
              </button>
            ) : null}
            {isAdmin && (
              <button
                onClick={() => {
                  console.log('Reprocess observation', obs.id);
                }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                <RefreshCw size={16} />
                Reprocess
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

