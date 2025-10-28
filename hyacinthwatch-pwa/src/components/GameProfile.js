import React, { useEffect, useState } from 'react'
import { getGameProfile } from '../api'

export default function GameProfile({ sbUser }) {
    const [profile, setProfile] = useState(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)

    useEffect(() => {
        let mounted = true
        const load = async () => {
            if (!sbUser) {
                setProfile(null)
                return
            }
            setLoading(true)
            setError(null)
            try {
                const p = await getGameProfile()
                if (mounted) setProfile(p)
            } catch (err) {
                if (mounted) setError(err.message || String(err))
            } finally {
                if (mounted) setLoading(false)
            }
        }
        load()
        return () => {
            mounted = false
        }
    }, [sbUser])

    if (!sbUser) return null

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#374151' }}>
            {loading && <span>Loading profile…</span>}
            {error && (
                <span title={error} style={{ color: '#b91c1c' }}>
                    Profile error
                </span>
            )}
            {profile && (
                <>
                    <span style={{ fontWeight: 600 }}>{profile.points} pts</span>
                    <span style={{ fontSize: 12, color: '#6b7280' }}>level {profile.level}</span>
                </>
            )}
        </div>
    )
}
