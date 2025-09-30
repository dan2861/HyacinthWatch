import { createStore, set, get, del, keys, update } from 'idb-keyval'

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
    return items.sort((a, b) => new Date(b.capturedAt) - new Date(a.capturedAt))
}

export async function setStatus(id, status, error) {
    const current = await get(id, store)
    if (!current) return
    const next = { ...current, status, error }
    await set(id, next, store)
}

export async function patchObservation(id, patch) {
    const cur = await get(id, store)
    if (!cur) return;
    await set(id, { ...cur, ...patch }, store);
}
