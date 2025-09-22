import { createStore, set, get, del, keys } from 'idb-keyval'

// One DB with object store
const store = createStore('hwdb', 'observations')

export async function putObservation(obs) {
    // obs: { id, blob, mime, capturedAt, lat, lon, notes?, status }
    await set(obs.id, obs, store)
}

export async function getObservation(id) {
    return get(id, store)
}

export async function deleteObservation(id) {
    await del(id, store)
}

export async function listObservations() {
    const k = await keys(store)
    const items = await Promise.all(k.map((key) => get(key, store)))
    // newest first
    return items.sort((a, b) => new Date(b.captruedAt) - new Date(a.captruedAt))
}
