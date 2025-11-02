import React, { useEffect, useState, useRef } from 'react'
import { getObservation, getGameProfile } from '../api'

export default function ObservationFeedback({ obsId, sbUser, onPointsUpdate }) {
    const [obs, setObs] = useState(null)
    const [profile, setProfile] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [isExpanded, setIsExpanded] = useState(true) // Default to expanded

    // Track previous points to avoid duplicate callbacks
    const previousPointsRef = useRef(null)

    useEffect(() => {
        if (!obsId || !sbUser) {
            setObs(null)
            setProfile(null)
            setLoading(false)
            previousPointsRef.current = null
            return
        }

        let mounted = true
        let pollInterval = null
        let pollCount = 0
        const maxPolls = 30 // Poll for up to 60 seconds (30 * 2s)

        const load = async () => {
            try {
                pollCount++
                console.log(`[ObservationFeedback] Fetching observation ${obsId} (poll #${pollCount})`)
                
                // Load observation and profile in parallel
                const [obsData, profileData] = await Promise.all([
                    getObservation(obsId).catch(err => {
                        console.warn('[ObservationFeedback] Failed to load observation:', err)
                        return null
                    }),
                    getGameProfile().catch(err => {
                        console.warn('[ObservationFeedback] Failed to load profile:', err)
                        return null
                    })
                ])

                if (!mounted) return

                console.log('[ObservationFeedback] Received data:', {
                    obs: obsData ? {
                        id: obsData.id,
                        status: obsData.status,
                        points_earned: obsData.points_earned,
                        has_qc: !!obsData.qc_feedback,
                        has_mask: !!obsData.mask_url,
                        has_pred: !!obsData.pred
                    } : null,
                    profile: profileData
                })

                const previousPoints = previousPointsRef.current
                setObs(obsData)
                setProfile(profileData)

                // Notify parent of points update if points changed
                if (obsData?.points_earned !== undefined && onPointsUpdate) {
                    // Only call if points changed (avoid duplicate calls)
                    if (obsData.points_earned !== previousPoints) {
                        onPointsUpdate(obsData.points_earned, profileData?.points)
                        previousPointsRef.current = obsData.points_earned
                    }
                }

                // If still processing and haven't exceeded max polls, poll again in 2 seconds
                const isProcessing = obsData && (obsData.status === 'processing' || obsData.status === 'received')
                if (isProcessing && pollCount < maxPolls) {
                    pollInterval = setTimeout(load, 2000)
                } else {
                    setLoading(false)
                    if (pollCount >= maxPolls) {
                        console.warn('[ObservationFeedback] Stopped polling after max attempts')
                    }
                }
            } catch (err) {
                if (!mounted) return
                console.error('[ObservationFeedback] Error:', err)
                setError(err.message || String(err))
                setLoading(false)
            }
        }

        load()

        return () => {
            mounted = false
            if (pollInterval) clearTimeout(pollInterval)
        }
    }, [obsId, sbUser, onPointsUpdate])

    if (!obsId || !sbUser) {
        console.log('[ObservationFeedback] Not rendering: obsId=', obsId, 'sbUser=', !!sbUser)
        return null
    }

    if (loading && !obs) {
        console.log('[ObservationFeedback] Loading initial data for', obsId)
        return (
            <div style={{ padding: '8px', fontSize: 13, color: '#6b7280' }}>
                Loading feedback...
            </div>
        )
    }

    if (error) {
        console.error('[ObservationFeedback] Error:', error)
        return (
            <div style={{ padding: '8px', fontSize: 13, color: '#b91c1c' }}>
                Error loading feedback: {error}
            </div>
        )
    }

    if (!obs) {
        console.warn('[ObservationFeedback] No observation data for', obsId)
        return (
            <div style={{ padding: '8px', fontSize: 13, color: '#f59e0b' }}>
                Waiting for observation data... (ID: {obsId})
            </div>
        )
    }

    // Always show something if we have obs data, even if points are 0 or null
    const pointsEarned = obs.points_earned
    const qcFeedback = obs.qc_feedback
    const maskUrl = obs.mask_url
    const presence = obs.pred?.presence
    const seg = obs.pred?.seg

    // Show feedback even if points are 0 - helps with debugging
    const hasPoints = pointsEarned !== null && pointsEarned !== undefined && pointsEarned > 0
    const hasFeedback = qcFeedback || maskUrl || presence || seg

    // Determine header text and icon based on status
    const getHeaderInfo = () => {
        if (hasPoints) {
            return {
                text: `+${pointsEarned} points earned!`,
                color: '#10b981',
                icon: '✓'
            }
        }
        if (qcFeedback) {
            const isAccepted = qcFeedback.accepted === true
            return {
                text: qcFeedback.message,
                color: isAccepted ? '#10b981' : '#ef4444',
                icon: isAccepted ? '✓' : '✗'
            }
        }
        if (obs.status === 'processing' || obs.status === 'received') {
            return {
                text: 'Processing...',
                color: '#6b7280',
                icon: '⏳'
            }
        }
        return {
            text: 'Upload completed',
            color: '#6b7280',
            icon: '📤'
        }
    }

    const headerInfo = getHeaderInfo()

    return (
        <div style={{ marginTop: 8, background: '#f9fafb', borderRadius: 8, fontSize: 13, border: '1px solid #e5e7eb' }}>
            {/* Collapsible header */}
            <div
                onClick={() => setIsExpanded(!isExpanded)}
                style={{
                    padding: 12,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    userSelect: 'none',
                    backgroundColor: isExpanded ? '#f3f4f6' : 'transparent',
                    borderRadius: 8,
                    transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => e.target.style.backgroundColor = '#f3f4f6'}
                onMouseLeave={(e) => e.target.style.backgroundColor = isExpanded ? '#f3f4f6' : 'transparent'}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 16 }}>{headerInfo.icon}</span>
                    <div>
                        <div style={{ fontWeight: 600, color: headerInfo.color, fontSize: 13 }}>
                            {headerInfo.text}
                        </div>
                        {hasPoints && profile && (
                            <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
                                Total: {profile.points} pts (Level {profile.level})
                            </div>
                        )}
                    </div>
                </div>
                <div style={{ 
                    fontSize: 18, 
                    color: '#6b7280',
                    transition: 'transform 0.2s',
                    transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)'
                }}>
                    ▼
                </div>
            </div>

            {/* Collapsible content */}
            {isExpanded && (
                <div style={{ padding: 12, paddingTop: 8 }}>
                    {/* Debug info */}
                    {process.env.NODE_ENV === 'development' && (
                        <div style={{ marginBottom: 8, padding: 6, background: '#e5e7eb', borderRadius: 4, fontSize: 11, color: '#6b7280' }}>
                            <strong>Debug:</strong> Status={obs.status}, Points={pointsEarned ?? 'null'}, HasQC={!!qcFeedback}, HasMask={!!maskUrl}
                            <div style={{ marginTop: 4, fontSize: 10 }}>
                                QC data: {obs.qc ? 'exists' : 'missing'}, QC score: {obs.qc_score ?? 'null'}, 
                                Pred: {obs.pred ? `exists (keys: ${Object.keys(obs.pred).join(', ')})` : 'missing'},
                                {obs.pred?.seg && ` Seg keys: ${Object.keys(obs.pred.seg).join(', ')}`}
                            </div>
                        </div>
                    )}

                    {/* Points earned and balance (duplicate for when expanded) */}
                    {hasPoints && profile && (
                        <div style={{ marginBottom: 8 }}>
                            <div style={{ 
                                display: 'inline-block',
                                padding: '4px 12px',
                                background: '#10b981',
                                color: 'white',
                                borderRadius: 16,
                                fontWeight: 600,
                                fontSize: 14,
                                marginRight: 8
                            }}>
                                +{pointsEarned} points earned!
                            </div>
                            <span style={{ color: '#475569', fontSize: 12 }}>
                                Total: {profile.points} pts (Level {profile.level})
                            </span>
                        </div>
                    )}

                    {/* QC Feedback - Show even if accepted is null (processing) */}
                    {qcFeedback && (
                        <div style={{ 
                            marginBottom: 8,
                            padding: 8,
                            background: qcFeedback.accepted === true ? '#dcfce7' : 
                                       qcFeedback.accepted === false ? '#fee2e2' : '#f3f4f6',
                            borderRadius: 6,
                            borderLeft: `3px solid ${qcFeedback.accepted === true ? '#10b981' : 
                                         qcFeedback.accepted === false ? '#ef4444' : '#6b7280'}`,
                            fontSize: 12
                        }}>
                            <div style={{ fontWeight: 600, marginBottom: 4 }}>
                                {qcFeedback.message}
                            </div>
                            {qcFeedback.score !== undefined && (
                                <div style={{ color: '#6b7280', fontSize: 11 }}>
                                    Quality score: {qcFeedback.score.toFixed(2)}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Segmentation mask preview */}
                    {maskUrl && (
                        <div style={{ marginTop: 8 }}>
                            <div style={{ 
                                fontWeight: 600, 
                                marginBottom: 4,
                                fontSize: 12,
                                color: '#374151'
                            }}>
                                Segmentation Preview:
                            </div>
                            <div style={{ position: 'relative', display: 'inline-block' }}>
                                <img 
                                    src={maskUrl} 
                                    alt="Segmentation mask"
                                    style={{
                                        width: '100%',
                                        maxWidth: 200,
                                        height: 'auto',
                                        borderRadius: 6,
                                        border: '2px solid #e5e7eb',
                                        background: '#f3f4f6'
                                    }}
                                    onError={(e) => {
                                        e.target.style.display = 'none'
                                    }}
                                />
                                {seg?.cover_pct !== undefined && (
                                    <div style={{
                                        position: 'absolute',
                                        bottom: 4,
                                        right: 4,
                                        padding: '2px 6px',
                                        background: 'rgba(0, 0, 0, 0.7)',
                                        color: 'white',
                                        borderRadius: 4,
                                        fontSize: 10,
                                        fontWeight: 600
                                    }}>
                                        {seg.cover_pct.toFixed(1)}% cover
                                    </div>
                                )}
                            </div>
                            {presence && (
                                <div style={{ 
                                    marginTop: 4, 
                                    fontSize: 11, 
                                    color: presence.label === 'present' ? '#10b981' : '#ef4444',
                                    fontWeight: presence.label === 'absent' ? 600 : 400
                                }}>
                                    {presence.label === 'present' 
                                        ? `✓ Hyacinth detected (${(presence.score * 100).toFixed(0)}% confidence)`
                                        : `✗ No hyacinth detected (${(presence.score * 100).toFixed(0)}% confidence) - Rejected`
                                    }
                                </div>
                            )}
                        </div>
                    )}

                    {/* Show presence info even when no mask (for rejected/absent observations) */}
                    {!maskUrl && presence && presence.label === 'absent' && (
                        <div style={{ 
                            marginTop: 8,
                            padding: 8,
                            background: '#fee2e2',
                            borderRadius: 6,
                            borderLeft: '3px solid #ef4444',
                            fontSize: 12
                        }}>
                            <div style={{ fontWeight: 600, color: '#991b1b', marginBottom: 4 }}>
                                ✗ Rejected: No hyacinth detected
                            </div>
                            <div style={{ color: '#7f1d1d', fontSize: 11 }}>
                                Confidence: {(presence.score * 100).toFixed(0)}% • 
                                Status: {obs.status || 'unknown'}
                            </div>
                        </div>
                    )}

                    {/* Show message if no feedback yet - helps user understand what's happening */}
                    {!hasFeedback && obs && (
                        <div style={{ 
                            padding: 8,
                            background: '#fef3c7',
                            borderRadius: 6,
                            borderLeft: '3px solid #f59e0b',
                            fontSize: 12,
                            color: '#92400e'
                        }}>
                            Processing observation... Points and feedback will appear once analysis completes.
                            {obs.status && ` (Status: ${obs.status})`}
                        </div>
                    )}

                    {/* Processing status - show only if still processing */}
                    {obs.status === 'processing' || obs.status === 'received' ? (
                        <div style={{ 
                            marginTop: 8, 
                            fontSize: 11, 
                            color: '#6b7280',
                            fontStyle: 'italic'
                        }}>
                            Still processing... (checking every 2 seconds)
                        </div>
                    ) : obs.status === 'done' && !hasPoints && !hasFeedback ? (
                        <div style={{ 
                            marginTop: 8, 
                            fontSize: 11, 
                            color: '#ef4444'
                        }}>
                            No points earned. Image may not contain hyacinth or processing is incomplete.
                        </div>
                    ) : null}
                </div>
            )}
        </div>
    )
}

