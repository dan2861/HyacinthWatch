import React, { useEffect, useMemo, useState } from 'react';
import * as exifr from 'exifr'
import { putObservation, getObservation, deleteObservation, listObservations, setStatus } from './db'
import { postObservation } from './api';
import { uuid, nowIso } from './util';
import logo from './logo.svg';
import './App.css';

function App() {
  const [items, setItems] = useState([])
  const [busy, setBusy] = useState(false)
  const [online, setOnline] = useState(navigator.onLine)

  // load queue
  async function refresh() {
    const data = await listObservations() // Get all observations from IndexedDB
    setItems(data) // Update UI with loaded data
  }

  // Load saved observations on startup
  useEffect(() => { refresh() }, [])

  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off)
    }
  }, [])

  // Auto upload when back online
  useEffect(() => {
    const tryAuto = async () => {
      if (!navigator.onLine) return
      const data = await listObservations()
      for (const it of data) {
        if (it.status !== 'sent') await uploadOne(it)
      }
    }
    window.addEventListener('online', tryAuto)
    return () => window.removeEventListener('online', tryAuto)
  }, [])

  async function handleSelect(e) {
    const file = e.target.files?.[0] // Get selected image
    if (!file) return
    setBusy(true) // Show "Processing..."

    let lat = null, lon = null, capturedAt = nowIso()
    try {
      // Extract GPS coordinates from EXIF data
      const gps = await exifr.gps(file)
      if (gps && typeof gps.latitude === 'number' && typeof gps.longitude == 'number') {
        lat = gps.latitude
        lon = gps.longitude
      }
      const meta = await exifr.parse(file)
      if (meta?.DateTimeOriginal) {
        capturedAt = new Date(meta.DateTimeOriginal).toISOString()
      }
    } catch { }

    const obs = {
      id: uuid(),                       // Generate unique ID
      blob: file,                       // Store image data
      mime: file.type || 'image/jpeg',  // Store image format
      capturedAt,                       // Timestamp
      lat, lon,                         // GPS coordinates
      status: 'queued'                  // Initial status
    }

    await putObservation(obs)   // Save to IndexedDb
    await refresh()             // Update UI
    setBusy(false)              // Hide "Processing..."
    e.target.value = ''         // reset input
  }

  async function remove(id) {
    await deleteObservation(id)
    await refresh()
  }

  async function uploadOne(item) {
    try {
      await setStatus(item.id, 'uploading')
      await refresh() // Instantly update UI to show "UPLOADING"

      const result = await postObservation(item)  // Send to server
      await setStatus(item.id, 'sent')            // store server id back into the record
      await refresh()

    } catch (err) {
      await setStatus(item.id, 'queued', String(err.message || err))
      await refresh()
    }
  }

  return (
    <div className="App">
      <div className='hdr'>
        <h1>HyacinthWatch</h1>
      </div>

      <div className='card'>
        <h2>Capture</h2>
        <input type="file" accept="image/*" capture="environment" onChange={handleSelect} />
        {busy && <p>Processing...</p>}
        <p className='meta'>☑️ Photos are saved offline</p>
      </div>

      <div className='card'>
        <h2>Queue</h2>
        {!items.length && <p>No observation yet.</p>}
        {items.map((it) => (
          <div className='row' key={it.id}>
            <img
              className='thumb'
              alt='preview'
              src={URL.createObjectURL(it.blob)}
              onError={(e) => {
                console.error('Image failed to load:', e);
                e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBmaWxsPSIjZjBmMGYwIi8+Cjx0ZXh0IHg9IjIwIiB5PSIyMCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iIGZvbnQtZmFtaWx5PSJzYW5zLXNlcmlmIiBmb250LXNpemU9IjEyIiBmaWxsPSIjOTk5Ij5JTUc8L3RleHQ+Cjwvc3ZnPgo=';
              }} />
            <div style={{ flex: 1 }}>
              <div className="status">{String(it.status).toUpperCase()}</div>
              {it.error && <div className="meta" style={{ color: '#b91c1c' }}>Error: {it.error}</div>}
              <div className="meta">{new Date(it.capturedAt).toLocaleString()}</div>
              <div className="meta">{it.lat?.toFixed?.(5)}, {it.lon?.toFixed?.(5)}</div>
            </div>
            {(it.status === 'queued' || it.status === 'error') && (
              <button className="btn" onClick={() => uploadOne(it)}>Upload</button>
            )}
            {it.status === 'uploading' && <div>Uploading…</div>}
            <button className='btn' onClick={() => remove(it.id)}>Delete</button>
          </div>
        ))}
      </div>

      <NetIndicator online={online} />
    </div>
  );
}

function NetIndicator({ online }) {
  return (
    <div className='offline' data-offline={online ? 'false' : 'true'}>
      {online ? 'Online' : 'Offline'}
    </div>
  )
}

export default App;
