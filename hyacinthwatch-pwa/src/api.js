import supabase, { getUser, ensureSupabaseSession, getAccessToken } from './supabase'

export async function postObservation(obs, token) {
    const base = process.env.REACT_APP_API_URL
    if (!base) {
        throw new Error('REACT_APP_API_URL missing')
    }

    // Get token if not provided
    if (!token) {
        try {
            token = await getAccessToken({ refresh: true })
        } catch (err) {
            console.warn('getAccessToken failed for postObservation', err)
        }
    }

    const form = new FormData()
    const filename = `${obs.id}.${(obs.mime || 'image/jpeg').split('/').pop()}`
    form.append('image', obs.blob, filename)
    form.append('metadata', JSON.stringify({
        id: obs.id,
        captured_at: obs.capturedAt,
        lat: obs.lat,
        lon: obs.lon,
        device_info: navigator.userAgent
    }))

    const headers = token ? { Authorization: `Bearer ${token}` } : {}

    const response = await fetch(`${base}/v1/observations`, {
        method: 'POST',
        headers,
        body: form,
    })

    if (!response.ok) {
        const text = await response.text().catch(() => '')
        throw new Error(`Upload failed ${response.status}: ${text.slice(0, 200)}`)
    }

    return response.json()
}

export async function uploadToSupabase(file, pathPrefix = '') {
    if (!supabase) throw new Error('supabase client not initialized')
    await ensureSupabaseSession()
    const user = await getUser()
    if (!user) throw new Error('not authenticated')
    const uid = user.id
    const path = `${uid}/${pathPrefix}${Date.now()}/${crypto.randomUUID()}.${(file.type || 'image/jpeg').split('/').pop()}`
    const { data, error } = await supabase.storage.from('observations').upload(path, file, { upsert: true, contentType: file.type || 'image/jpeg' })
    return { data, error, path }
}

// Notify backend that a client has uploaded an object to Supabase storage.
// payload: { id, bucket, path, captured_at, lat, lon, device_info }
export async function notifyObservationRef(payload) {
    const base = process.env.REACT_APP_API_URL
    if (!base) throw new Error('REACT_APP_API_URL missing')

    // Get token for authentication
    let token = null
    try {
        token = await getAccessToken({ refresh: true })
    } catch (err) {
        console.warn('getAccessToken failed for notifyObservationRef', err)
    }

    const headers = { 'Content-Type': 'application/json' }
    if (token) {
        headers['Authorization'] = `Bearer ${token}`
    }

    const res = await fetch(`${base}/v1/observations/ref`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
    })

    if (!res.ok) {
        const txt = await res.text().catch(() => '')
        throw new Error(`notifyObservationRef failed ${res.status}: ${txt.slice(0, 200)}`)
    }

    return res.json()
}

// Convenience helper: upload file to Supabase then notify backend. Returns backend JSON on success.
// Falls through errors to caller — callers may implement fallback to server upload.
export async function uploadAndNotifyToSupabase(file, { id = null, captured_at = null, lat = null, lon = null, device_info = null } = {}) {
    const bucket = process.env.REACT_APP_STORAGE_BUCKET_OBS || 'observations'

    const up = await uploadToSupabase(file)
    if (up?.error || !up?.path) {
        const msg = up?.error?.message || 'supabase upload failed'
        const err = new Error(msg)
        err.details = up
        throw err
    }

    const payload = {
        id,
        bucket,
        path: up.path,
        captured_at,
        lat,
        lon,
        device_info: device_info || navigator.userAgent,
    }

    return notifyObservationRef(payload)
}

export async function getObservationSignedUrl(obsId) {
    const base = process.env.REACT_APP_API_URL
    if (!base) throw new Error('REACT_APP_API_URL missing')
    const res = await fetch(`${base}/v1/observations/${obsId}/signed_url`)
    if (!res.ok) {
        const txt = await res.text().catch(() => '')
        throw new Error(`signed url request failed ${res.status}: ${txt.slice(0, 200)}`)
    }
    return res.json() // { signed_url }
}


export async function getGameProfile() {
    const base = process.env.REACT_APP_API_URL
    if (!base) throw new Error('REACT_APP_API_URL missing')
    // Try to obtain an access token with a short retry window — sometimes
    // the supabase session may not be immediately available at UI render time.
    let token = null
    const maxAttempts = 6
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
            token = await getAccessToken({ refresh: true })
        } catch (err) {
            console.warn('getAccessToken attempt failed', err)
            token = null
        }
        if (token) break
        // small backoff before retrying
        await new Promise(res => setTimeout(res, 150 * (attempt + 1)))
    }
    const hasBearer = typeof token === 'string' && token.trim().length > 0
    const headers = hasBearer ? { Authorization: `Bearer ${token}` } : {}
    // Helpful dev-only debug: do not print tokens, only whether one was found.
    try { console.debug && console.debug('getGameProfile: hasToken=', hasBearer) } catch (e) { }
    // If we have a bearer token, avoid sending credentials to prevent unnecessary cookie handling.
    // Otherwise include credentials so session-cookie auth works when available.
    const options = hasBearer ? { headers } : { headers, credentials: 'include' }
    const res = await fetch(`${base}/v1/game/profile`, options)
    if (!res.ok) {
        const txt = await res.text().catch(() => '')
        throw new Error(`getGameProfile failed ${res.status}: ${txt.slice(0, 200)}`)
    }
    return res.json()
}
