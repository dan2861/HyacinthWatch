// Leaflet marker icon fix for CRA
import L from 'leaflet'

// import icon assets
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

import React, { useEffect, useState, useCallback } from 'react'
import { BrowserRouter as Router, Routes, Route, Link, Navigate } from 'react-router-dom'
import supabase, { getUser, onAuthChange, signOut as supabaseSignOut } from './supabase'
import * as exifr from 'exifr'
import { putObservation, deleteObservation, listObservations, setStatus, patchObservation } from './db'
import { postObservation, uploadAndNotifyToSupabase } from './api'
import { uuid, nowIso } from './util'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import { FitButton, LocateMeButton } from './components/MapHelpers'
import { blurLabel, brightLabel, Badge } from './components/qcLabels'
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'
import './App.css'

// fix the icons before any react components use leaflet
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
})

function HomePage({ items, busy, online, sbUser, handleSelect, uploadOne, removeItem }) {
  const hasGeo = (it) => typeof it.lat === 'number' && typeof it.lon === 'number'
  const geoItems = items.filter(hasGeo)
  const defaultCenter = geoItems.length ? [geoItems[0].lat, geoItems[0].lon] : [0, 0]

  return (
    <main>
      <div className="card">
        <h2>Capture</h2>
        <input type="file" accept="image/*" capture="environment" onChange={handleSelect} />
        {busy && <p>Processing...</p>}
        <p className="meta">☑️ Photos are saved offline</p>
        {!sbUser && (
          <p className="meta" style={{ color: '#b91c1c' }}>
            Log in to sync observations to Supabase.
          </p>
        )}
      </div>

      <div className="card">
        <h2>Queue</h2>
        {!items.length && <p>No observation yet.</p>}
        {items.map((it) => (
          <div className="row" key={it.id}>
            <img
              className="thumb"
              alt="preview"
              src={URL.createObjectURL(it.blob)}
              onError={(e) => {
                console.error('Image failed to load:', e)
                e.target.src =
                  'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBmaWxsPSIjZjBmMGYwIi8+Cjx0ZXh0IHg9IjIwIiB5PSIyMCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iIGZvbnQtZmFtaWx5PSJzYW5zLXNlcmlmIiBmb250LXNpemU9IjEyIiBmaWxsPSIjOTk5Ij5JTUc8L3RleHQ+Cjwvc3ZnPgo='
              }}
            />
            <div style={{ flex: 1 }}>
              <div className="status">{String(it.status).toUpperCase()}</div>
              {it.error && (
                <div className="meta" style={{ color: '#b91c1c' }}>
                  Error: {it.error}
                </div>
              )}
              <div className="meta">{new Date(it.capturedAt).toLocaleString()}</div>
              <div className="meta" style={{ marginTop: 4 }}>
                <Badge label={blurLabel(it.qc)} />
                <Badge label={brightLabel(it.qc)} />
                {typeof it?.qc?.score === 'number' && (
                  <span style={{ marginLeft: 6, fontSize: 12, color: '#475569' }}>
                    QC score: {it.qc.score.toFixed(2)}
                  </span>
                )}
              </div>
              <div className="meta">
                {it.lat?.toFixed?.(5)}, {it.lon?.toFixed?.(5)}
              </div>
            </div>
            {(it.status === 'queued' || it.status === 'error') && (
              <button className="btn" onClick={() => uploadOne(it)}>
                Upload
              </button>
            )}
            {it.status === 'uploading' && <div>Uploading…</div>}
            <button className="btn" onClick={() => removeItem(it.id)}>
              Delete
            </button>
          </div>
        ))}
      </div>

      <div className="card">
        <h2>Map (local observations)</h2>
        <p className="meta">Showing only items that have lat/lon (from EXIF or browser GPS).</p>
        <div style={{ height: 400, width: '100%', borderRadius: 12, overflow: 'hidden' }}>
          <MapContainer center={defaultCenter} zoom={geoItems.length ? 12 : 2} style={{ height: '100%', width: '100%' }}>
            <FitButton items={geoItems} />
            <LocateMeButton />
            <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            {geoItems.map((it) => (
              <Marker key={it.id} position={[it.lat, it.lon]}>
                <Popup>
                  <div style={{ maxWidth: 180 }}>
                    <div>
                      <strong>{String(it.status).toUpperCase()}</strong>
                    </div>
                    <div className="meta">{new Date(it.capturedAt).toLocaleString()}</div>
                    <div style={{ marginTop: 4 }}>
                      <Badge label={blurLabel(it.qc)} />
                      <Badge label={brightLabel(it.qc)} />
                    </div>
                    <img alt="preview" src={URL.createObjectURL(it.blob)} style={{ width: '100%', borderRadius: 8, marginTop: 6 }} />
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      </div>

      <NetIndicator online={online} />
    </main>
  )
}

function App() {
  const [items, setItems] = useState([])
  const [busy, setBusy] = useState(false)
  const [online, setOnline] = useState(navigator.onLine)
  const [sbReady, setSbReady] = useState(false)
  const [sbUser, setSbUser] = useState(null)

  const refresh = useCallback(async () => {
    const data = await listObservations()
    setItems(data)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    setSbReady(!!supabase)
    let mounted = true

    getUser()
      .then((u) => {
        if (mounted) setSbUser(u)
      })
      .catch(() => {})

    const unsubscribe = onAuthChange((user) => {
      if (mounted) setSbUser(user)
    })

    return () => {
      mounted = false
      unsubscribe?.()
    }
  }, [])

  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])

  const uploadOne = useCallback(
    async (item) => {
      try {
        if (!sbUser) throw new Error('Log in before uploading')
        await setStatus(item.id, 'uploading')
        await refresh()

        try {
          const resp = await uploadAndNotifyToSupabase(item.blob, {
            id: item.id,
            captured_at: item.capturedAt,
            lat: item.lat,
            lon: item.lon,
          })
          await patchObservation(item.id, {
            status: 'sent',
            qc: resp.qc || null,
            qc_score: resp.qc_score || null,
          })
          await refresh()
          return
        } catch (supErr) {
          console.warn('Direct Supabase upload failed, falling back to server upload:', supErr)
        }

        const result = await postObservation(item)
        await patchObservation(item.id, {
          status: 'sent',
          qc: result.qc || null,
          qc_score: result.qc_score || null,
        })
        await refresh()
      } catch (err) {
        await setStatus(item.id, 'queued', String(err.message || err))
        await refresh()
      }
    },
    [refresh, sbUser]
  )

  useEffect(() => {
    const tryAuto = async () => {
      if (!navigator.onLine || !sbUser) return
      const data = await listObservations()
      for (const it of data) {
        if (it.status !== 'sent') await uploadOne(it)
      }
    }
    window.addEventListener('online', tryAuto)
    return () => window.removeEventListener('online', tryAuto)
  }, [uploadOne, sbUser])

  const handleSelect = useCallback(
    async (e) => {
      const file = e.target.files?.[0]
      if (!file) return
      setBusy(true)

      let lat = null,
        lon = null,
        capturedAt = nowIso()
      try {
        const gps = await exifr.gps(file)
        if (gps && typeof gps.latitude === 'number' && typeof gps.longitude === 'number') {
          lat = gps.latitude
          lon = gps.longitude
        }
        const meta = await exifr.parse(file)
        if (meta?.DateTimeOriginal) {
          capturedAt = new Date(meta.DateTimeOriginal).toISOString()
        }
      } catch {
        // ignore EXIF errors
      }

      const obs = {
        id: uuid(),
        blob: file,
        mime: file.type || 'image/jpeg',
        capturedAt,
        lat,
        lon,
        status: 'queued',
      }

      await putObservation(obs)
      await refresh()
      setBusy(false)
      e.target.value = ''
    },
    [refresh]
  )

  const removeItem = useCallback(
    async (id) => {
      await deleteObservation(id)
      await refresh()
    },
    [refresh]
  )

  const handleSignOut = useCallback(async () => {
    await supabaseSignOut()
    setSbUser(null)
  }, [])

  const userLabel = sbUser?.email || sbUser?.id || ''

  return (
    <Router>
      <div className="App">
        <header className="hdr">
          <div>
            <h1>HyacinthWatch</h1>
            <div style={{ fontSize: 12, color: '#6b7280' }}>
              Supabase: {sbReady ? 'initialized' : 'not initialized'}
              {sbUser ? ` • user=${userLabel}` : ''}
            </div>
          </div>
          <nav style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Link to="/" className="btn" style={{ textDecoration: 'none', padding: '6px 12px' }}>
              Home
            </Link>
            {!sbUser && (
              <>
                <Link to="/login" className="btn" style={{ textDecoration: 'none', padding: '6px 12px' }}>
                  Log In
                </Link>
                <Link to="/signup" className="btn" style={{ textDecoration: 'none', padding: '6px 12px' }}>
                  Sign Up
                </Link>
              </>
            )}
            {sbUser && (
              <button className="btn" onClick={handleSignOut}>
                Log Out
              </button>
            )}
          </nav>
        </header>

        <Routes>
          <Route
            path="/"
            element={
              <HomePage
                items={items}
                busy={busy}
                online={online}
                sbUser={sbUser}
                handleSelect={handleSelect}
                uploadOne={uploadOne}
                removeItem={removeItem}
              />
            }
          />
          <Route path="/login" element={<LoginPage onAuthSuccess={setSbUser} />} />
          <Route path="/signup" element={<SignupPage onAuthSuccess={setSbUser} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </Router>
  )
}

function NetIndicator({ online }) {
  return (
    <div className="offline" data-offline={online ? 'false' : 'true'}>
      {online ? 'Online' : 'Offline'}
    </div>
  )
}

export default App
