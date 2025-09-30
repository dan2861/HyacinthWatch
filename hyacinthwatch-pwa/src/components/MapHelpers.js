import React, { useMemo } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';

export function FitButton({ items }) {
  const map = useMap();
  const bounds = useMemo(() => {
    const pts = items
      .filter(it => typeof it.lat === 'number' && typeof it.lon === 'number')
      .map(it => L.latLng(it.lat, it.lon));
    return pts.length ? L.latLngBounds(pts) : null;
  }, [items]);

  if (!bounds) return null;
  return (
    <button
      className="btn"
      style={{ position: 'absolute', zIndex: 1000, right: 12, top: 12 }}
      onClick={() => map.fitBounds(bounds.pad(0.2))}
    >
      Fit to markers
    </button>
  );
}

export function LocateMeButton() {
  const map = useMap();
  const locate = () => {
    if (!('geolocation' in navigator)) return alert('Geolocation not available');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        const here = L.latLng(latitude, longitude);
        map.setView(here, Math.max(map.getZoom(), 14));
        // Optional: a quick pulse circle (non-persistent)
        const layer = L.circle(here, { radius: Math.max(accuracy, 15) }).addTo(map);
        setTimeout(() => map.removeLayer(layer), 3000);
      },
      (err) => alert('Location error: ' + err.message),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };
  return (
    <button
      className="btn"
      style={{ position: 'absolute', zIndex: 1000, right: 12, top: 60 }}
      onClick={locate}
    >
      Locate me
    </button>
  );
}