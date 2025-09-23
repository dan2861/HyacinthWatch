import React, { useEffect, useMemo, useState } from 'react';
import * as exifr from 'exifr'
import { putObservation, getObservation, deleteObservation, listObservations } from './db'
import { uuid, nowIso } from './util';
import logo from './logo.svg';
import './App.css';

function App() {
  const [items, setItems] = useState([])
  const [busy, setBusy] = useState(false)
  const [online, setOnline] = useState(navigator.onLine)

  // load queue
  async function refresh() {
    const data = await listObservations()
    setItems(data)
  }

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

  async function handleSelect(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setBusy(true)

    let lat = null, lon = null, capturedAt = nowIso()
    try {
      // Try EXIF GPS and DateTimeOriginal
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
      id: uuid(),
      blob: file,
      mime: file.type || 'image/jpeg',
      capturedAt,
      lat, lon,
      status: 'queued'
    }

    await putObservation(obs)
    await refresh()
    setBusy(false)
    // reset input
    e.target.value = ''
  }

  async function remove(id) {
    await deleteObservation(id)
    await refresh()
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
            <img className='thumb' alt='preview' src={URL.createObjectURL(it.blob)} />
            <div style={{ flex: 1 }}>
              <div className="status">{String(it.status).toUpperCase()}</div>
              <div className="meta">{new Date(it.capturedAt).toLocaleString()}</div>
              <div className="meta">{it.lat?.toFixed?.(5)}, {it.lon?.toFixed?.(5)}</div>
            </div>
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
