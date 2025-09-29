export async function postObservation(obs, token) {
    const base = process.env.REACT_APP_API_URL
    if (!base) {
        throw new Error('REACT_APP_API_URL missing')
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
