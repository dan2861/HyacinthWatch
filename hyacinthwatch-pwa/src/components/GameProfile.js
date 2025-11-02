import React, { useEffect, useState, useImperativeHandle, forwardRef, useCallback } from 'react'
import { getGameProfile } from '../api'

const GameProfile = forwardRef(function GameProfile({ sbUser }, ref) {
    const [profile, setProfile] = useState(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)

    const refresh = useCallback(async () => {
        if (!sbUser) {
            setProfile(null)
            return
        }
        setLoading(true)
        setError(null)
        try {
            const p = await getGameProfile()
            setProfile(p)
        } catch (err) {
            setError(err.message || String(err))
        } finally {
            setLoading(false)
        }
    }, [sbUser])

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

    // Expose refresh function via ref
    useImperativeHandle(ref, () => ({
        refresh: refresh
    }), [refresh])

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
})

export default GameProfile
