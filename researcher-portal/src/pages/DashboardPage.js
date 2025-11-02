import { useState } from 'react';
import { FilterBar } from '../components/FilterBar';
import { ObservationTable } from '../components/ObservationTable';
import { ObservationDetails } from '../components/ObservationDetails';
import { useFilterUrlSync } from '../utils/urlSync';
import { useFilterStore } from '../store/filterStore';
import { exportObservationsCSV, exportObservationsGeoJSON } from '../api/observations';
import { FileDown, MapPin } from 'lucide-react';
import { showToast } from '../components/Toast';

export function DashboardPage() {
  useFilterUrlSync(); // Sync filters with URL
  const { filters } = useFilterStore();
  const [selectedObs, setSelectedObs] = useState(null);
  const [exporting, setExporting] = useState(false);

  const handleRowClick = (obs) => {
    setSelectedObs(obs.id);
  };

  const handleCloseDetails = () => {
    setSelectedObs(null);
  };

  const handleExportCSV = async () => {
    setExporting(true);
    showToast('Exporting CSV...', 'info', 2000);
    try {
      // Get all observations first (we'll paginate through them if needed)
      const sort = { field: 'created_at', order: 'desc' };
      const blob = await exportObservationsCSV(filters, { page: 1, pageSize: 10000 }, sort);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `observations-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      showToast('CSV exported successfully', 'success');
    } catch (error) {
      showToast(`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    } finally {
      setExporting(false);
    }
  };

  const handleExportGeoJSON = async () => {
    setExporting(true);
    showToast('Exporting GeoJSON...', 'info', 2000);
    try {
      const sort = { field: 'created_at', order: 'desc' };
      const blob = await exportObservationsGeoJSON(filters, { page: 1, pageSize: 10000 }, sort);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `observations-${new Date().toISOString().split('T')[0]}.geojson`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      showToast('GeoJSON exported successfully', 'success');
    } catch (error) {
      showToast(`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    } finally {
      setExporting(false);
    }
  };

  // Check if user is admin (you may want to get this from auth store)
  const isAdmin = false; // TODO: Get from auth store

  return (
    <div className="space-y-6">
      {/* Header with export buttons */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Observations</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Browse and analyze observation data
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExportCSV}
            disabled={exporting}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FileDown size={16} />
            Export CSV
          </button>
          <button
            onClick={handleExportGeoJSON}
            disabled={exporting}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <MapPin size={16} />
            Export GeoJSON
          </button>
        </div>
      </div>

      {/* Filters */}
      <FilterBar />

      {/* Table */}
      <ObservationTable onRowClick={handleRowClick} />

      {/* Details Drawer */}
      {selectedObs && (
        <ObservationDetails
          obsId={selectedObs}
          onClose={handleCloseDetails}
          isAdmin={isAdmin}
        />
      )}
    </div>
  );
}

